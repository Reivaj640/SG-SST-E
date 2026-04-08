// preload.js - Script de precarga para Electron

const { contextBridge, ipcRenderer } = require('electron');

// Función de logging para el renderer
function log(level, message) {
  console.log(`[${level}] ${message}`);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // --- App & Configuración ---
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  getRecursosStats: (companyName) => ipcRenderer.invoke('get-recursos-stats', companyName),
  getGestionIntegralStats: (companyName) => ipcRenderer.invoke('get-gestion-integral-stats', companyName),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  loadNormativa: () => ipcRenderer.invoke('load-normativa'),
  authLoginV1: (payload) => ipcRenderer.invoke('auth-login-v1', payload),
  authLogoutV1: (payload) => ipcRenderer.invoke('auth-logout-v1', payload),
  companiesSyncV1: (payload) => ipcRenderer.invoke('companies-sync-v1', payload),
  usersListV1: (payload) => ipcRenderer.invoke('users-list-v1', payload),
  usersCreateV1: (payload) => ipcRenderer.invoke('users-create-v1', payload),
  usersUpdateV1: (payload) => ipcRenderer.invoke('users-update-v1', payload),
  usersDisableV1: (payload) => ipcRenderer.invoke('users-disable-v1', payload),
  assignmentsSetV1: (payload) => ipcRenderer.invoke('assignments-set-v1', payload),
  assignmentsListV1: (payload) => ipcRenderer.invoke('assignments-list-v1', payload),
  assignmentsListByUserV1: (payload) => ipcRenderer.invoke('assignments-list-by-user-v1', payload),
  
  // --- Dashboard Scanner ---
  getDashboardSummary: (companyName) => ipcRenderer.invoke('get-dashboard-summary', companyName),

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
  saveProveedoresExcelData: (filePath, data) => ipcRenderer.invoke('save-proveedores-excel-data', filePath, data),
  processExcelData: (payload) => ipcRenderer.invoke('process-excel-data', payload),
  updatePlanTrabajoExcel: (payload) => ipcRenderer.invoke('update-plan-trabajo-excel', payload),

  // --- Gestión de Archivos de Proveedores (Evidencias) ---
  createProviderFolder: (basePath, folderName) => ipcRenderer.invoke('create-provider-folder', basePath, folderName),
  copyFileToProviderFolder: (sourcePath, destFolderPath, fileName) => ipcRenderer.invoke('copy-file-to-provider-folder', sourcePath, destFolderPath, fileName),
  listProviderFiles: (folderPath) => ipcRenderer.invoke('list-provider-files', folderPath),

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
  uploadDocument: (payload) => ipcRenderer.invoke('upload-document', payload),
  deleteDocument: (filePath) => ipcRenderer.invoke('delete-document', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),

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
  duplicateCapacitacionesSheet: (args) => ipcRenderer.invoke('duplicate-capacitaciones-sheet', args),
  updateExcelCell: (data) => ipcRenderer.invoke('update-excel-cell', data),
  convertExcelToPdf: (filePath) => ipcRenderer.invoke('convertExcelToPdf', filePath),
  auditExcelContent: (data) => ipcRenderer.invoke('audit-excel-content', data),

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

  // --- Investigación de Accidentes (Gestión) ---
  getInvestigacionStats: (companyName) => ipcRenderer.invoke('investigacion-accidentes-get-stats', { companyName }),
  listInvestigations: (companyName, filter) => ipcRenderer.invoke('investigacion-accidentes-list-investigations', { companyName, filter }),
  getInvestigationDetail: (companyName, investigationName) => ipcRenderer.invoke('investigacion-accidentes-get-investigation-detail', { companyName, investigationName }),

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
  buscarRegistrosCedula: (cedula, companyName) =>
    ipcRenderer.invoke('buscar-registros-cedula', cedula, companyName),

  // --- Inducciones ---
  getInduccionesData: (companyName) => ipcRenderer.invoke('get-inducciones-data', companyName),
  syncInduccionesFromForms: (companyName) => ipcRenderer.invoke('sync-inducciones-from-forms', companyName),
  checkInduccionesChanges: (companyName, lastKnownHash) => ipcRenderer.invoke('check-inducciones-changes', companyName, lastKnownHash),

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
  buscarTodosRegistrosPRI: (companyName) => ipcRenderer.invoke('buscar-todos-registros-pri', companyName),

  // --- Objetivos SST ---
  getObjetivosExcelPath: (companyName) => ipcRenderer.invoke('get-objetivos-excel-path', companyName),
  loadObjetivosExcelData: (filePath) => ipcRenderer.invoke('load-objetivos-excel-data', filePath),
  saveObjetivosExcelData: (filePath, data) => ipcRenderer.invoke('save-objetivos-excel-data', filePath, data),

  // --- Evaluación Inicial SG-SST ---
  processEvaluacionPdf: (pdfPath, sourceType) => ipcRenderer.invoke('process-evaluacion-pdf', pdfPath, sourceType),

  // --- Archivo y Retención Documental (Submódulo 2.5.1) ---
  archivoRetencion: {
    getStats: (companyName) => ipcRenderer.invoke('archivo-retencion:get-stats', companyName),
    getExcelPath: (companyName) => ipcRenderer.invoke('archivo-retencion:get-excel-path', companyName),
    leerTodos: (companyName) => ipcRenderer.invoke('archivo-retencion:leer-todos', companyName),
    guardar: (companyName, documentos) => ipcRenderer.invoke('archivo-retencion:guardar', companyName, documentos),
    crear: (companyName, documento) => ipcRenderer.invoke('archivo-retencion:crear', companyName, documento),
    actualizar: (companyName, documento) => ipcRenderer.invoke('archivo-retencion:actualizar', companyName, documento),
    eliminar: (companyName, numero) => ipcRenderer.invoke('archivo-retencion:eliminar', companyName, { numero }),
  },

  // --- Gestión del Cambio (2.11.1) ---
  loadGestionCambioData: (companyName) => ipcRenderer.invoke('gestion-cambio-load-data', companyName),
  saveGestionCambioData: (companyName, changeData) => ipcRenderer.invoke('gestion-cambio-save-data', companyName, changeData),
  generateGestionCambioId: (companyName) => ipcRenderer.invoke('gestion-cambio-generate-id', companyName),
  updateGestionCambioEstado: (companyName, changeId, nuevoEstado, extraData) =>
    ipcRenderer.invoke('gestion-cambio-update-estado', companyName, changeId, nuevoEstado, extraData),

  // --- Eventos IPC ---
  send: (channel, data) => ipcRenderer.send(channel, data),
  onIpcMessage: (channel, listener) => {
    ipcRenderer.on(channel, (event, ...args) => listener(...args));
  },
  removeIpcMessageListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
  onUpdateAvailable: (callback) => ipcRenderer.on('update_available', (event, ...args) => callback(...args)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', (event, ...args) => callback(...args)),
  onUpdateChecking: (callback) => ipcRenderer.on('update_checking', (event, ...args) => callback(...args)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update_not_available', (event, ...args) => callback(...args)),
  onUpdateProgress: (callback) => ipcRenderer.on('update_progress', (event, ...args) => callback(...args)),
  onUpdateError: (callback) => ipcRenderer.on('update_error', (event, ...args) => callback(...args)),
  restartApp: () => ipcRenderer.send('restart_app'),
});
