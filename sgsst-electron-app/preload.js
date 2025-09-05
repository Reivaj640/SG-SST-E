// preload.js - Script de precarga para Electron

const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  // Diálogo para seleccionar directorios
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // Guardar y cargar configuración
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  
  // Mapear estructura de directorio
  mapDirectory: (path) => ipcRenderer.invoke('map-directory', path),
  
  // Leer contenido de un directorio
  readDirectory: (path) => ipcRenderer.invoke('read-directory', path),

  findFilesRecursively: (path) => ipcRenderer.invoke('find-files-recursively', path),
  
  // Abrir archivo o carpeta
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  
  // Encontrar ruta de un submódulo
  findSubmodulePath: (company, module, submodule) => ipcRenderer.invoke('find-submodule-path', company, module, submodule),

  // Obtener datos del archivo de control de remisiones
  getControlRemisionesData: (companyName) => ipcRenderer.invoke('get-control-remisiones-data', companyName),
  
  // Convertir DOCX a PDF para previsualización
  convertDocxToPdf: (path) => ipcRenderer.invoke('convert-docx-to-pdf', path),
  
  // Seleccionar archivo PDF
  selectPdfFile: () => ipcRenderer.invoke('select-pdf-file'),

  // Nueva función para enviar mensajes IPC al proceso principal
  sendIpcMessage: (channel, data) => ipcRenderer.send(channel, data),
  
  // Nueva función para escuchar mensajes IPC del proceso principal
  onIpcMessage: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),
  
  // Nueva función para remover listeners de mensajes IPC
  removeIpcMessageListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),

  // Procesar PDF de remisión
  processRemisionPdf: (path) => ipcRenderer.invoke('process-remision-pdf', path),
  
  // Generar documento de remisión
  generateRemisionDocument: (extractedData, empresa) => ipcRenderer.invoke('generate-remision-document', extractedData, empresa),
  
  // Enviar remisión por WhatsApp
  sendRemisionByWhatsApp: (docPath, extractedData, empresa) => ipcRenderer.invoke('send-remision-by-whatsapp', docPath, extractedData, empresa),
  
  // Enviar remisión por correo electrónico
  sendRemisionByEmail: (docPath, extractedData, empresa) => ipcRenderer.invoke('send-remision-by-email', docPath, extractedData, empresa),

  // Agrega esto en el contextBridge.exposeInMainWorld
  updateExcelCell: (filePath, row, col, value) => ipcRenderer.invoke('update-excel-cell', filePath, row, col, value),
  
  // Funciones para procesamiento de accidentes
  selectAccidentPdf: () => ipcRenderer.invoke('select-accident-pdf'),
  processAccidentPdf: (pdfPath, empresa, contextoAdicional) => ipcRenderer.invoke('process-accident-pdf', pdfPath, empresa, contextoAdicional),
  
  // Funciones para procesamiento de accidentes
  startModelLoading: () => ipcRenderer.invoke('start-model-loading'),

  // --- LÍNEA QUE FALTABA ---
  // Generar informe de accidente
  //  generateAccidentReport: (combinedData, empresa) => ipcRenderer.invoke('generate-accident-report', combinedData, empresa),
  
  // Obtener datos de la plantilla de acta
  getActaData: () => ipcRenderer.invoke('get-acta-data'),

  // Generar acta de COPASST via Python
  generateCopasstActa: (changes) => ipcRenderer.invoke('generate-copasst-acta', changes),

  // Obtener datos de la plantilla de acta de Convivencia
  getConvivenciaActaData: () => ipcRenderer.invoke('getConvivenciaActaData'),

  // Generar acta de Convivencia via Python
  generateConvivenciaActa: (changes) => ipcRenderer.invoke('generateConvivenciaActa', changes),

  // Guardar datos de acta de COPASST
  saveActa: (data) => ipcRenderer.invoke('save-acta', data),

  // Convertir Excel a PDF usando Microsoft Office
  convertExcelToPdf: (filePath) => ipcRenderer.invoke('convertExcelToPdf', filePath),
  // -------------------------
});