// preload.js - Script de precarga para Electron

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // --- App & Configuración ---
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),

  // --- Manejo de archivos y directorios ---
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  mapDirectory: (directoryPath) => ipcRenderer.invoke('map-directory', directoryPath),
  readDirectory: (directoryPath) => ipcRenderer.invoke('read-directory', directoryPath),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),

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
  updateExcelCell: (filePath, row, col, value) => 
    ipcRenderer.invoke('update-excel-cell', filePath, row, col, value),
  convertExcelToPdf: (filePath) => ipcRenderer.invoke('convertExcelToPdf', filePath),

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

  // --- Actas ---
  getActaData: () => ipcRenderer.invoke('get-acta-data'),
  getConvivenciaActaData: () => ipcRenderer.invoke('getConvivenciaActaData'),
  generateCopasstActa: (changes) => ipcRenderer.invoke('generate-copasst-acta', changes),
  generateConvivenciaActa: (changes) => ipcRenderer.invoke('generateConvivenciaActa', changes),

  // --- Eventos IPC ---
  onIpcMessage: (channel, listener) => {
    ipcRenderer.on(channel, (event, ...args) => listener(...args));
  },
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', callback),
  restartApp: () => ipcRenderer.send('restart_app'),
});
