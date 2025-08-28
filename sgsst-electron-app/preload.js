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
  updateExcelCell: (filePath, row, col, value) => ipcRenderer.invoke('update-excel-cell', filePath, row, col, value)
});