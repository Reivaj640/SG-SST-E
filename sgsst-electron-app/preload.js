// preload.js - Script de precarga para Electron

const { contextBridge, ipcRenderer } = require('electron');

// Función de logging para el renderer
function log(level, message) {
  console.log(`[${level}] ${message}`);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // --- App & Configuración ---
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),

  // --- Manejo de archivos y directorios ---
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  mapDirectory: (directoryPath) => {
    log('DEBUG', `mapDirectory llamado con: ${directoryPath}`);
    return ipcRenderer.invoke('map-directory', directoryPath)
      .then(result => {
        log('DEBUG', 'mapDirectory resultado:', result);
        return result;
      })
      .catch(error => {
        log('ERROR', `Error en mapDirectory: ${error.message}`);
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

  // --- New Document Viewer ---
  getDocumentFolders: (payload) => ipcRenderer.invoke('get-document-folders', payload),
  getFolderContents: (folderPath) => ipcRenderer.invoke('read-directory', folderPath),
  getDocumentsInFolder: (folderPath) => ipcRenderer.invoke('read-directory', folderPath), // REMAPPED
  getPDFPreview: (filePath) => ipcRenderer.invoke('get-pdf-preview', filePath),
  getWordPreview: (filePath) => ipcRenderer.invoke('get-word-preview', filePath),
  getExcelPreview: (filePath) => ipcRenderer.invoke('get-excel-preview', filePath),
  downloadDocument: (filePath) => ipcRenderer.invoke('download-document', filePath),

  // --- Submódulos / rutas ---
  findSubmodulePath: (companyName, module, submodule) =>
    ipcRenderer.invoke('find-submodule-path', companyName, module, submodule),

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
  initExcel: (filePath) => ipcRenderer.invoke('init-excel', filePath),
  updateExcelCell: (data) => ipcRenderer.invoke('update-excel-cell', data),
  convertExcelToPdf: (filePath) => ipcRenderer.invoke('convertExcelToPdf', filePath),

  // --- Presupuesto ---
  getPresupuestoFiles: (companyName) => ipcRenderer.invoke('getPresupuestoFiles', companyName),
  readPresupuestoData: (filePath) => ipcRenderer.invoke('readPresupuestoData', filePath),
  saveBudgetFile: (filePath, data) => ipcRenderer.invoke('saveBudgetFile', filePath, data),
  openBudgetWindow: (file) => ipcRenderer.invoke('open-budget-window', file),

  // --- Accidentes ---
  selectAccidentPdf: () => ipcRenderer.invoke('select-accident-pdf'),
  processAccidentPdf: (pdfPath) => ipcRenderer.invoke('process-accident-pdf', pdfPath),
  analyzeAccident: (extractedData, contextoAdicional) =>
    ipcRenderer.invoke('analyze-accident', extractedData, contextoAdicional),
  startModelLoading: () => ipcRenderer.invoke('start-model-loading'),
  generateAccidentReport: (combinedData) =>
    ipcRenderer.invoke('generate-accident-report', combinedData),
  readAusentismoData: (companyName) =>
    ipcRenderer.invoke('get-ausentismo-data', companyName),

  // --- Ausentismo ---
  buscarEmpleadoPorCedula: (cedula, empresa) =>
    ipcRenderer.invoke('buscar-empleado-por-cedula', { cedula, empresa }),
  buscarCie10Descripcion: (companyName, cie10Code) =>
    ipcRenderer.invoke('buscar-cie10-descripcion', { companyName, cie10Code }),
  procesarAusentismo: (empresa, formData) =>
    ipcRenderer.invoke('procesar-ausentismo', empresa, formData),

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

  // --- Eventos IPC ---
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