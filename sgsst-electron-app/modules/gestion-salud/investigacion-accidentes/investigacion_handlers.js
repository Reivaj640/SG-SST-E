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

// Esta función debe ser provista por main.js o importada
async function getPython() {
    // Implementación simplificada para este módulo.
    // La verdadera función está en main.js y la usaremos a través de la memoria compartida.
    if (global.cachedPythonPath) {
        return global.cachedPythonPath;
    }
    // Este fallback es solo de emergencia.
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
            timeout: 600000 // 10 minutos de timeout
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
 * Inicia el servidor LLM si no está corriendo
 */
async function startLlmServer() {
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
    let pythonExecutable = global.cachedPythonPath;
    if (!pythonExecutable || !require('fs').existsSync(pythonExecutable)) {
        try {
            const { execSync } = require('child_process');
            pythonExecutable = execSync('where python').toString().trim().split('\n')[0];
        } catch (e) {
            throw new Error('No se encontró Python en el sistema');
        }
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
        
        // USAR global.cachedPythonPath CON VERIFICACIÓN
        let pythonExecutable = global.cachedPythonPath;
        if (!pythonExecutable || !require('fs').existsSync(pythonExecutable)) {
            // Si no hay Python cached, buscar en el PATH del sistema
            try {
                const { execSync } = require('child_process');
                pythonExecutable = execSync('where python').toString().trim().split('\n')[0];
            } catch (e) {
                throw new Error('No se encontró Python en el sistema. Por favor instale Python 3.10+ y agréguelo al PATH.');
            }
        }
        
        // Verificar que el ejecutable existe
        if (!require('fs').existsSync(pythonExecutable)) {
            throw new Error(`Python no encontrado en: ${pythonExecutable}`);
        }
        
        // USAR PORTAR_SRC_PATH para ruta correcta
        const pythonScriptPath = path.join(PORTAR_SRC_PATH, 'accident_processor.py');
        
        // Verificar que el script existe
        if (!require('fs').existsSync(pythonScriptPath)) {
            throw new Error(`Script de Python no encontrado en: ${pythonScriptPath}`);
        }
        
        // Usar spawn con shell: true y rutas entre comillas para manejar espacios
        const { spawn } = require('child_process');
        
        // LOGS DE DIAGNÓSTICO - CRÍTICO PARA DEBUG
        sendLog(`[DEBUG] pythonExecutable valor: "${pythonExecutable}"`);
        sendLog(`[DEBUG] pythonScriptPath valor: "${pythonScriptPath}"`);
        sendLog(`[DEBUG] actualPdfPath valor: "${actualPdfPath}"`);
        sendLog(`[DEBUG] PORTAR_SRC_PATH: "${PORTAR_SRC_PATH}"`);
        
        // Construir el comando con TODAS las rutas entre comillas dobles
        // CRÍTICO: En Windows, las rutas con espacios deben estar entre comillas dobles
        const escapedPython = `"${pythonExecutable}"`;
        const escapedPdfPath = `"${actualPdfPath}"`;
        const escapedScriptPath = `"${pythonScriptPath}"`;
        const command = `${escapedPython} ${escapedScriptPath} extract --pdf_path ${escapedPdfPath}`;
        
        sendLog(`[DEBUG] Comando completo a ejecutar: ${command}`);
        
        // Usar spawn con shell: true para que Windows maneje las rutas con espacios
        // IMPORTANTE: En Windows, spawn con shell:true ejecuta: cmd.exe /c <command>
        const pythonProcess = spawn(command, [], {
            shell: true,
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
            
            tempDataPath = path.join(app.getPath('temp'), `accident_report_data_${Date.now()}.json`);
            const reportData = { combinedData: combinedData, empresa: empresa };
            await fsp.writeFile(tempDataPath, JSON.stringify(reportData, null, 2));

            const pythonExecutable = await getPython();
            const pythonScriptPath = path.join(PORTAR_SRC_PATH, 'accident_report_generator.py');
            await fsp.access(pythonScriptPath);

            const pythonProcess = spawn(pythonExecutable, ['-X', 'utf8', pythonScriptPath, tempDataPath], { cwd: path.dirname(pythonScriptPath) });

            let stdoutData = '';
            let stderrData = '';

            pythonProcess.stdout.on('data', (data) => { stdoutData += data.toString(); });
            pythonProcess.stderr.on('data', (data) => { stderrData += data.toString(); sendLog(`[Python STDERR] ${data}`, 'ERROR'); });

            pythonProcess.on('close', async (code) => {
                if (tempDataPath) await fsp.unlink(tempDataPath).catch(err => sendLog(`No se pudo limpiar el archivo temporal: ${err.message}`, 'WARN'));
                if (code !== 0) return reject(new Error(`El script de Python falló con código ${code}. Revisa los logs de STDERR.`));

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
    const pythonExecutable = await getPython();
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
        let pythonExecutable = global.cachedPythonPath;
        if (!pythonExecutable || !require('fs').existsSync(pythonExecutable)) {
            try {
                const { execSync } = require('child_process');
                pythonExecutable = execSync('where python').toString().trim().split('\n')[0];
                sendLog(`[LLM] Python encontrado en PATH: ${pythonExecutable}`);
            } catch (e) {
                sendLog('[LLM] No se encontró Python, se iniciará bajo demanda', 'WARN');
                return false;
            }
        } else {
            sendLog(`[LLM] Python cached: ${pythonExecutable}`);
        }

        const serverScriptPath = path.join(PORTAR_SRC_PATH, 'llm_server.py');
        sendLog(`[LLM] Ruta del script: ${serverScriptPath}`);
        
        // Verificar que el script existe
        if (!require('fs').existsSync(serverScriptPath)) {
            sendLog(`[LLM] Script del servidor no encontrado: ${serverScriptPath}`, 'ERROR');
            return false;
        }

        sendLog(`[LLM] Iniciando servidor: "${pythonExecutable}" "${serverScriptPath}"`);

        // Iniciar el servidor como proceso en background CON LOGS
        // Usar shell: true para manejar rutas con espacios correctamente
        llmServerProcess = spawn(`"${pythonExecutable}"`, [`"${serverScriptPath}"`], {
            cwd: path.dirname(serverScriptPath),
            detached: false,  // NO detached para poder capturar logs
            stdio: ['ignore', 'pipe', 'pipe'],  // Capturar stdout y stderr
            windowsHide: true,
            shell: true  // CRÍTICO: Usar shell para manejar rutas con espacios
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

        // Buscar por nombre del nodo
        if (node.name && node.name.includes(targetCode)) {
            // Construir la ruta completa
            return node.path || null;
        }

        if (node.subdirectories) {
            for (const childName of Object.keys(node.subdirectories)) {
                const child = node.subdirectories[childName];
                if (child.name && child.name.includes(targetCode)) {
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

/**
 * Helper: extrae el nombre de la persona desde el nombre del archivo.
 * Soporta patrones: "InformeATE-Maria Ferrer", "GI-FO-020 INVESTIGACION Cristian Alvarez",
 * "Jose Fernando Lopez - 5-5", "Ramiro Romero Fierro".
 */
function _extractPersonName(filename) {
    const noExt = filename.replace(/\.[^.]+$/, '');
    // "InformeATE-Maria Ferrer" o "InformeATE Maria Ferrer"
    let m = noExt.match(/InformeATE?[-\s]+(.+)/i);
    if (m) return m[1].trim();
    // "GI-FO-020 INVESTIGACION Cristian Alvarez"
    m = noExt.match(/GI-FO-020\s+INVESTIGACION\s+(.+)/i);
    if (m) return m[1].trim();
    // "Jose Fernando Lopez - 5-5" (nombre + fecha separada por " - ")
    m = noExt.match(/^(.+?)\s*-\s*\d.*$/);
    if (m) return m[1].trim();
    // Fallback: nombre de archivo completo sin extensión
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
                const key = personName.toLowerCase().replace(/\s+/g, '_');
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
 * su estado (pendiente, en_curso, completada).
 *
 * Criterios:
 * - PENDIENTE: solo contiene archivos FURAT (PDFs con "FURAT" en el nombre)
 * - EN_CURSO: contiene FURAT + archivos intermedios (evidencias, notas) pero NO informe final
 * - COMPLETADA: contiene un archivo con "Informe_Investigacion" o "informe" en el nombre
 */
function _analyzeInvestigationState(folderName, files) {
    const hasFurat = files.some(f =>
        f.name.toUpperCase().includes('FURAT') && f.name.toLowerCase().endsWith('.pdf')
    );
    const hasInforme = files.some(f =>
        f.name.toLowerCase().includes('informe_investigacion') ||
        f.name.toLowerCase().includes('informe de investigacion') ||
        f.name.toLowerCase().includes('informe_accidente')      ||
        f.name.toUpperCase().includes('INFORMEATE')             ||
        f.name.toUpperCase().includes('INFORMEAT ')
    );

    if (!hasFurat && !hasInforme) {
        return { estado: 'pendiente', tipo: 'carpeta', reason: 'Sin FURAT ni informe' };
    }

    if (hasFurat && hasInforme) {
        return { estado: 'completada', tipo: 'carpeta', reason: 'Con informe final' };
    }

    if (hasFurat && !hasInforme) {
        return { estado: 'pendiente', tipo: 'carpeta', reason: 'FURAT sin informe' };
    }

    return { estado: 'pendiente', tipo: 'carpeta', reason: 'Estado desconocido' };
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
                if (inv._hasInforme) completadas++;
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
 * IPC Handler: investigacion-accidentes-list-investigations
 * Lista todas las investigaciones con su estado, metadata y archivos.
 * Soporta estructura plana y estructura Año > Mes > Investigación.
 *
 * Input: { companyName: string, filter?: 'todas' | 'pendiente' | 'completada' }
 * Output: { success: true, data: [ { id, nombre, estado, fecha, archivos: [] } ] }
 */
ipcMain.handle('investigacion-accidentes-list-investigations', async (event, { companyName, filter }) => {
    try {
        sendLog(`[INV-LIST] Solicitud de lista para: ${companyName}, filtro: ${filter || 'todas'}`, 'INFO');

        if (!companyName) {
            return { success: false, error: { code: 'MISSING_COMPANY', message: 'Nombre de empresa requerido' } };
        }

        const submodulePath = await _findInvestigacionSubmodulePath(companyName);

        if (!fs.existsSync(submodulePath)) {
            sendLog(`[INV-LIST] La ruta del submódulo no existe: ${submodulePath}`, 'WARN');
            return { success: true, data: [] };
        }

        // Usar descubrimiento inteligente (detecta año/mes o estructura plana)
        const discovered = await _discoverInvestigations(submodulePath);
        const investigations = [];

        for (const inv of discovered) {
            // Aplicar filtro si existe
            if (filter && filter !== 'todas') {
                // Para filtrar necesitamos analizar el estado
                if (inv.isFolder) {
                    const folderFiles = await fsp.readdir(inv.fullPath, { withFileTypes: true });
                    const fileInfos = folderFiles
                        .filter(f => f.isFile())
                        .map(f => {
                            const filePath = path.join(inv.fullPath, f.name);
                            const stats = fs.statSync(filePath);
                            return {
                                name: f.name,
                                path: filePath,
                                extension: path.extname(f.name).substring(1),
                                size: stats.size,
                                modified: stats.mtime.toISOString()
                            };
                        });
                    const state = _analyzeInvestigationState(inv.name, fileInfos);
                    if (state.estado !== filter) continue;

                    const folderStats = fs.statSync(inv.fullPath);
                    investigations.push({
                        id: `inv-${inv.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                        nombre: inv.name,
                        estado: state.estado,
                        tipo: 'carpeta',
                        fecha: folderStats.mtime.toISOString(),
                        totalArchivos: fileInfos.length,
                        archivos: fileInfos,
                        relativePath: inv.relativePath
                    });
                } else {
                    const invEstado = inv._hasInforme ? 'completada' : 'pendiente';
                    if (filter !== 'todas' && filter !== invEstado) continue;
                    const folderStats = fs.statSync(inv.fullPath);
                    const archivos = (inv._filesInMonth || [inv.name]).map(fname => {
                        const fp = path.join(inv.fullPath, fname);
                        try {
                            const s = fs.statSync(fp);
                            return { name: fname, path: fp, extension: path.extname(fname).substring(1), size: s.size, modified: s.mtime.toISOString() };
                        } catch (_) {
                            return { name: fname, path: fp, extension: path.extname(fname).substring(1), size: 0, modified: folderStats.mtime.toISOString() };
                        }
                    });
                    investigations.push({
                        id: `inv-${inv.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                        nombre: inv.name,
                        estado: invEstado,
                        tipo: 'archivo',
                        fecha: folderStats.mtime.toISOString(),
                        totalArchivos: archivos.length,
                        archivos,
                        relativePath: inv.relativePath
                    });
                }
            } else {
                // Sin filtro, construir entrada completa
                if (inv.isFolder) {
                    const folderFiles = await fsp.readdir(inv.fullPath, { withFileTypes: true });
                    const fileInfos = folderFiles
                        .filter(f => f.isFile())
                        .map(f => {
                            const filePath = path.join(inv.fullPath, f.name);
                            const stats = fs.statSync(filePath);
                            return {
                                name: f.name,
                                path: filePath,
                                extension: path.extname(f.name).substring(1),
                                size: stats.size,
                                modified: stats.mtime.toISOString()
                            };
                        });
                    const state = _analyzeInvestigationState(inv.name, fileInfos);
                    const folderStats = fs.statSync(inv.fullPath);

                    investigations.push({
                        id: `inv-${inv.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                        nombre: inv.name,
                        estado: state.estado,
                        tipo: 'carpeta',
                        fecha: folderStats.mtime.toISOString(),
                        totalArchivos: fileInfos.length,
                        archivos: fileInfos,
                        relativePath: inv.relativePath
                    });
                } else {
                    const invEstado = inv._hasInforme ? 'completada' : 'pendiente';
                    const folderStats = fs.statSync(inv.fullPath);
                    const archivos = (inv._filesInMonth || [inv.name]).map(fname => {
                        const fp = path.join(inv.fullPath, fname);
                        try {
                            const s = fs.statSync(fp);
                            return { name: fname, path: fp, extension: path.extname(fname).substring(1), size: s.size, modified: s.mtime.toISOString() };
                        } catch (_) {
                            return { name: fname, path: fp, extension: path.extname(fname).substring(1), size: 0, modified: folderStats.mtime.toISOString() };
                        }
                    });
                    investigations.push({
                        id: `inv-${inv.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                        nombre: inv.name,
                        estado: invEstado,
                        tipo: 'archivo',
                        fecha: folderStats.mtime.toISOString(),
                        totalArchivos: archivos.length,
                        archivos,
                        relativePath: inv.relativePath
                    });
                }
            }
        }

        // Ordenar por fecha más reciente primero
        investigations.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        sendLog(`[INV-LIST] ${investigations.length} investigaciones encontradas`, 'INFO');
        return { success: true, data: investigations };

    } catch (error) {
        sendLog(`[INV-LIST] Error: ${error.message}`, 'ERROR');
        return { success: false, error: { code: 'LIST_ERROR', message: error.message } };
    }
});

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

// Exportar funciones para inicialización desde el exterior
module.exports = {
    initializeLlmServer,
    checkLlmServerHealth,
    startLlmServer,
    analyzeAccidentViaServer
};

// Inicializar servidor automáticamente al cargar el módulo
// Esto permite pre-cargar el modelo en segundo plano
sendLog('[HANDLERS] Iniciando inicialización del módulo...');
initializeLlmServer().then((result) => {
    sendLog(`[HANDLERS] Módulo de handlers inicializado. Resultado: ${result}`);
}).catch(err => {
    sendLog(`[HANDLERS] Error en inicialización: ${err.message}`, 'WARN');
});

