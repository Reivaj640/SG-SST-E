// preload.js - Script de precarga para Electron

const { contextBridge, ipcRenderer } = require('electron');

// Función de logging para el renderer
function log(level, message) {
  console.log(`[${level}] ${message}`);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // --- App & Configuración ---
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getRecursosStats: (companyName) => ipcRenderer.invoke('get-recursos-stats', companyName),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  loadNormativa: () => ipcRenderer.invoke('load-normativa'),

  // --- Sistema de Temas ---
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  saveThemePreference: (themeMode) => ipcRenderer.invoke('save-theme-preference', themeMode),
  getThemePreference: () => ipcRenderer.invoke('get-theme-preference'),
  getEffectiveTheme: () => ipcRenderer.invoke('get-effective-theme'),
  onSystemThemeChanged: (callback) => {
    const listener = (event, theme) => callback(theme);
    ipcRenderer.on('system-theme-changed', listener);
    return () => ipcRenderer.removeListener('system-theme-changed', listener);
  },

  // --- Manejo de archivos y directorios ---
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  mapDirectory: (directoryPath) => {
    console.log(`[MAPEO][PRELOAD] mapDirectory llamado con: ${directoryPath}`);
    console.log(`[MAPEO][PRELOAD] Enviando invoke 'map-directory'...`);
    return ipcRenderer.invoke('map-directory', directoryPath)
      .then(result => {
        console.log(`[MAPEO][PRELOAD] mapDirectory resultado recibido:`, {
          success: result.success,
          hasStructure: !!result.structure,
          hasLog: !!result.log
        });
        return result;
      })
      .catch(error => {
        console.error(`[MAPEO][PRELOAD] Error en mapDirectory:`, error);
        throw error;
      });
  },

  readDirectory: (directoryPath) => {
    log('DEBUG', `readDirectory llamado con: ${directoryPath}`);
    return ipcRenderer.invoke('read-directory', directoryPath)
      .then(result => {
        log('DEBUG', 'readDirectory resultado:', result);
        return result;
      })
      .catch(error => {
        log('ERROR', `Error en readDirectory: ${error.message}`);
        throw error;
      });
  },

  openPath: (filePath) => {
    log('DEBUG', `openPath llamado con: ${filePath}`);
    return ipcRenderer.invoke('open-path', filePath)
      .then(result => {
        log('DEBUG', 'openPath resultado:', result);
        return result;
      })
      .catch(error => {
        log('ERROR', `Error en openPath: ${error.message}`);
        throw error;
      });
  },

  readExcelFile: (filePath) => ipcRenderer.invoke('read-excel-file', filePath),
  processExcelData: (payload) => ipcRenderer.invoke('process-excel-data', payload),

  // --- New Document Viewer ---
  getDocumentFolders: async (payload) => {
    try {
      // Verificar si el renderer aún está activo
      if (!document || !document.visibilityState || document.visibilityState === 'hidden') {
        log('WARN', 'Documento no visible, evitando llamada IPC');
        return { success: false, error: 'Documento no visible' };
      }
      
      log('DEBUG', `getDocumentFolders llamado con: ${JSON.stringify(payload)}`);
      const result = await ipcRenderer.invoke('get-document-folders', payload);
      log('DEBUG', 'getDocumentFolders resultado:', result);
      return result;
    } catch (error) {
      // Verificar si el error es "Object has been destroyed"
      if (error.message && error.message.includes('Object has been destroyed')) {
        log('WARN', 'El objeto IPC ha sido destruido. La ventana puede estar cerrándose.');
        return { success: false, error: 'La aplicación se está cerrando. Por favor, intente de nuevo.' };
      }
      
      // Verificar si es un error de canal inválido
      if (error.message && error.message.includes('channel')) {
        log('WARN', `Canal no disponible: ${error.message}`);
        return { success: false, error: 'El canal de comunicación no está disponible.' };
      }
      
      log('ERROR', `Error en getDocumentFolders: ${error.message}`);
      throw error;
    }
  },
  getFolderContents: (folderPath) => ipcRenderer.invoke('read-directory', folderPath),
  getDocumentsInFolder: (folderPath) => ipcRenderer.invoke('read-directory', folderPath), // REMAPPED
  getPDFPreview: (filePath) => ipcRenderer.invoke('get-pdf-preview', filePath),
  getWordPreview: (filePath) => ipcRenderer.invoke('get-word-preview', filePath),
  getExcelPreview: (filePath) => ipcRenderer.invoke('get-excel-preview', filePath),
  downloadDocument: (filePath) => ipcRenderer.invoke('download-document', filePath),
  
  // --- Edición de documentos ---
  getEditableContent: (payload) => ipcRenderer.invoke('get-editable-content', payload),
  saveEditedDocument: (payload) => ipcRenderer.invoke('save-edited-document', payload),
  openOnlyOfficeEditor: (payload) => ipcRenderer.invoke('open-onlyoffice-editor', payload),
  generateOnlyOfficeConfig: (payload) => ipcRenderer.invoke('generate-onlyoffice-config', payload),

  // --- Submódulos / rutas ---
  findSubmodulePath: (companyName, module, submodule) =>
    ipcRenderer.invoke('find-submodule-path', companyName, module, submodule),
  getFilePath: (payload) => ipcRenderer.invoke('get-file-path', payload),

  // --- Remisiones ---
  getControlRemisionesData: (companyName) =>
    ipcRenderer.invoke('get-control-remisiones-data', companyName),
  processRemisionPdf: (pdfPath) => ipcRenderer.invoke('process-remision-pdf', pdfPath),
  convertDocxToPdf: (docxPath) => ipcRenderer.invoke('convert-docx-to-pdf', docxPath),
  selectPdfFile: () => ipcRenderer.invoke('select-pdf-file'),
  generateRemisionDocument: (extractedData, empresa) =>
    ipcRenderer.invoke('generate-remision-document', extractedData, empresa),
  sendRemisionByEmail: (docPath, extractedData, empresa) =>
    ipcRenderer.invoke('send-remision-by-email', docPath, extractedData, empresa),
  sendRemisionByWhatsapp: (docPath, extractedData, empresa) =>
    ipcRenderer.invoke('send-remision-by-whatsapp', docPath, extractedData, empresa),

  // --- Excel ---
  getCapacitacionesSheets: (filePath) => ipcRenderer.invoke('get-capacitaciones-sheets', filePath),
  initExcel: (data) => ipcRenderer.invoke('init-excel', data),
  updateCapacitacionesExcel: (data) => ipcRenderer.invoke('update-capacitaciones-excel', data),
      duplicateCapacitacionesSheet: (args) => ipcRenderer.invoke('duplicate-capacitaciones-sheet', args),  updateExcelCell: (data) => ipcRenderer.invoke('update-excel-cell', data),
  convertExcelToPdf: (filePath) => ipcRenderer.invoke('convertExcelToPdf', filePath),

  // --- Presupuesto ---
  getPresupuestoFiles: (companyName) => ipcRenderer.invoke('getPresupuestoFiles', companyName),
  readPresupuestoData: (filePath) => ipcRenderer.invoke('readPresupuestoData', filePath),
  saveBudgetFile: (filePath, data) => ipcRenderer.invoke('saveBudgetFile', filePath, data),
  openBudgetWindow: (file) => ipcRenderer.invoke('open-budget-window', file),
  duplicateBudgetFile: (params) => ipcRenderer.invoke('duplicate-budget-file', params),

  // --- Accidentes ---
  selectAccidentPdf: () => ipcRenderer.invoke('investigacion-accidentes-select-accident-pdf'),
  processAccidentPdf: (pdfPath) => ipcRenderer.invoke('investigacion-accidentes-process-accident-pdf', pdfPath),
  analyzeAccident: (extractedData, contextoAdicional) =>
    ipcRenderer.invoke('investigacion-accidentes-analyze-accident', extractedData, contextoAdicional),
  startModelLoading: () => ipcRenderer.invoke('investigacion-accidentes-start-model-loading'),
  generateAccidentReport: (combinedData) =>
    ipcRenderer.invoke('investigacion-accidentes-generate-accident-report', combinedData),
  saveTempPdfFile: (filename, data) => ipcRenderer.invoke('investigacion-accidentes-save-temp-pdf-file', filename, data),
  readAusentismoData: (companyName) =>
    ipcRenderer.invoke('get-ausentismo-data', companyName),
  getPriSeguimientoData: (companyName) =>
    ipcRenderer.invoke('get-pri-seguimiento-data', companyName),

  // --- Ausentismo ---
  buscarEmpleadoPorCedula: (cedula, empresa) =>
    ipcRenderer.invoke('buscar-empleado-por-cedula', { cedula, empresa }),
  buscarCie10Descripcion: (companyName, cie10Code) =>
    ipcRenderer.invoke('buscar-cie10-descripcion', { companyName, cie10Code }),
  procesarAusentismo: (empresa, formData) =>
    ipcRenderer.invoke('procesar-ausentismo', empresa, formData),

  // --- Inducciones ---
  getInduccionesData: (companyName) => ipcRenderer.invoke('get-inducciones-data', companyName),

  // --- Actas ---
  getActaData: () => ipcRenderer.invoke('get-acta-data'),
  getConvivenciaActaData: () => ipcRenderer.invoke('getConvivenciaActaData'),
  generateCopasstActa: (changes) => ipcRenderer.invoke('generate-copasst-acta', changes),
  generateConvivenciaActa: (changes) => ipcRenderer.invoke('generate-convivencia-acta', changes),

  // --- Diálogo de guardado ---
  showSaveDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),

  // --- Seguimiento de Incapacidades ---
  saveFollowUp: (followUpData, companyName) => ipcRenderer.invoke('save-follow-up', followUpData, companyName),
  exportIncapacityData: (companyName) => ipcRenderer.invoke('export-incapacity-data', companyName),
  getFollowUpHistory: (caseId, companyName) => ipcRenderer.invoke('get-follow-up-history', caseId, companyName),
  loadFollowUpData: (companyName) => ipcRenderer.invoke('load-follow-up-data', companyName),
  saveDebugHtml: (htmlContent) => ipcRenderer.invoke('save-debug-html', htmlContent),

  // --- Objetivos SST ---
  getObjetivosExcelPath: (companyName) => ipcRenderer.invoke('get-objetivos-excel-path', companyName),
  loadObjetivosExcelData: (filePath) => ipcRenderer.invoke('load-objetivos-excel-data', filePath),
  saveObjetivosExcelData: (filePath, data) => ipcRenderer.invoke('save-objetivos-excel-data', filePath, data),

  // --- Evaluación Inicial SG-SST ---
  processEvaluacionPdf: (pdfPath, sourceType) => ipcRenderer.invoke('process-evaluacion-pdf', pdfPath, sourceType),

  // --- Eventos IPC ---
  send: (channel, data) => ipcRenderer.send(channel, data),
  onIpcMessage: (channel, listener) => {
    ipcRenderer.on(channel, (event, ...args) => listener(...args));
  },
  removeIpcMessageListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', callback),
  restartApp: () => ipcRenderer.send('restart_app'),
});