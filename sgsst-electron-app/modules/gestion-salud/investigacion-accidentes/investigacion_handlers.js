const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fsp = require('fs').promises;
const { promisify } = require('util');
const { execFile } = require('child_process');

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


// --- ACCIDENT INVESTIGATION HANDLERS ---

ipcMain.handle('select-accident-pdf', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('start-model-loading', async () => {
    console.log('Iniciando carga del modelo LLM en segundo plano (simulado).');
    return { success: true };
});

ipcMain.handle('process-accident-pdf', (event, pdfPath) => {
    return new Promise(async (resolve, reject) => {
        let hasResolved = false;

        try {
            sendLog(`IPC: process-accident-pdf (extract) recibido para: ${pdfPath}`);
            const pythonExecutable = await getPython();
            const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'accident_processor.py');
            const pythonProcess = spawn(pythonExecutable, [pythonScriptPath, 'extract', '--pdf_path', pdfPath], { cwd: path.dirname(pythonScriptPath) });

            let stdoutData = '';
            let stderrData = '';

            pythonProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
                const lines = stdoutData.split('\n');
                stdoutData = lines.pop(); // The last line might be incomplete

                lines.forEach(line => {
                    if (line) {
                        try {
                            const json = JSON.parse(line);
                            if (json.type === 'progress') {
                                event.sender.send('accident-processing-progress', json);
                            } else if (json.type === 'result') {
                                if (!hasResolved) {
                                    hasResolved = true;
                                    resolve(json.payload);
                                }
                            }
                        } catch (e) {
                            sendLog(`Error parsing python output line: ${line}. Error: ${e.message}`, 'WARN');
                        }
                    }
                });
            });

            pythonProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
                sendLog(`Python stderr: ${data}`, 'ERROR');
            });

            pythonProcess.on('close', (code) => {
                // Procesar cualquier línea restante en stdoutData
                if (stdoutData.trim() && !hasResolved) {
                    try {
                        const json = JSON.parse(stdoutData.trim());
                        if (json.type === 'progress') {
                            event.sender.send('accident-processing-progress', json);
                        } else if (json.type === 'result') {
                            hasResolved = true;
                            resolve(json.payload);
                            return;
                        }
                    } catch (e) {
                        sendLog(`Error parsing final python output line: ${stdoutData.trim()}. Error: ${e.message}`, 'WARN');
                    }
                }

                if (!hasResolved) {
                    if (code !== 0) {
                        reject(new Error(`Script de Python falló con código ${code}: ${stderrData}`));
                    } else {
                        // Si el proceso terminó exitosamente pero no se recibió resultado, es un error
                        reject(new Error("El script de Python terminó sin enviar un resultado JSON válido."));
                    }
                }
            });

            pythonProcess.on('error', (err) => {
                if (!hasResolved) {
                    hasResolved = true;
                    reject(err);
                }
            });

        } catch (error) {
            if (!hasResolved) {
                hasResolved = true;
                reject(error);
            }
        }
    });
});

ipcMain.handle('analyze-accident', (event, extractedData, contextoAdicional) => {
    return new Promise(async (resolve, reject) => {
        let hasResolved = false;

        try {
            sendLog(`IPC: analyze-accident recibido`);
            const pythonExecutable = await getPython();
            const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'accident_processor.py');
            const jsonData = JSON.stringify(extractedData);
            const pythonProcess = spawn(pythonExecutable, [pythonScriptPath, 'analyze', '--json_data', jsonData, '--contexto', contextoAdicional], { cwd: path.dirname(pythonScriptPath) });

            let stdoutData = '';
            let stderrData = '';

            pythonProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
                const lines = stdoutData.split('\n');
                stdoutData = lines.pop(); // The last line might be incomplete

                lines.forEach(line => {
                    if (line) {
                        try {
                            const json = JSON.parse(line);
                            if (json.type === 'progress' && event.sender) {
                                event.sender.send('accident-processing-progress', json);
                            } else if (json.type === 'result') {
                                if (!hasResolved) {
                                    hasResolved = true;
                                    resolve(json.payload);
                                }
                            }
                        } catch (e) {
                            sendLog(`Error parsing python output line: ${line}. Error: ${e.message}`, 'WARN');
                        }
                    }
                });
            });

            pythonProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
                sendLog(`Python stderr: ${data}`, 'ERROR');
            });

            pythonProcess.on('close', (code) => {
                // Procesar cualquier línea restante en stdoutData
                if (stdoutData.trim() && !hasResolved) {
                    try {
                        const json = JSON.parse(stdoutData.trim());
                        if (json.type === 'progress' && event.sender) {
                            event.sender.send('accident-processing-progress', json);
                        } else if (json.type === 'result') {
                            hasResolved = true;
                            resolve(json.payload);
                            return;
                        }
                    } catch (e) {
                        sendLog(`Error parsing final python output line: ${stdoutData.trim()}. Error: ${e.message}`, 'WARN');
                    }
                }

                if (!hasResolved) {
                    if (code !== 0) {
                        reject(new Error(`Script de Python falló con código ${code}: ${stderrData}`));
                    } else {
                        // Si el proceso terminó exitosamente pero no se recibió resultado, es un error
                        reject(new Error("El script de Python terminó sin enviar un resultado JSON válido."));
                    }
                }
            });

            pythonProcess.on('error', (err) => {
                if (!hasResolved) {
                    hasResolved = true;
                    reject(err);
                }
            });

        } catch (error) {
            if (!hasResolved) {
                hasResolved = true;
                reject(error);
            }
        }
    });
});

ipcMain.handle('generate-accident-report', (event, combinedData) => {
    return new Promise(async (resolve, reject) => {
        let tempDataPath;
        try {
            sendLog(`IPC: generate-accident-report recibido`);
            tempDataPath = path.join(app.getPath('temp'), `accident_report_data_${Date.now()}.json`);
            const reportData = { combinedData: combinedData, empresa: combinedData.empresa || 'TEMPOACTIVA' };
            await fsp.writeFile(tempDataPath, JSON.stringify(reportData, null, 2));

            const pythonExecutable = await getPython();
            const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'accident_report_generator.py');
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

ipcMain.handle('get-config', async (event, empresa) => {
    const pythonExecutable = await getPython();
    const investAppPath = path.join(__dirname, 'Portear', 'src', 'Invest_APP_V_3.py');
    const { stdout } = await promisify(execFile)(pythonExecutable, [investAppPath, '--get-config', empresa], { cwd: path.dirname(investAppPath) });
    return JSON.parse(stdout.trim());
});