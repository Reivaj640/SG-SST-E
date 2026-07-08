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
  onFullscreenChanged: (callback) => {
    const listener = (event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('fullscreen-changed', listener);
  },
  isMaximized: () => ipcRenderer.invoke('get-maximized-state'),

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

  // Muestra el archivo en su carpeta (Explorer/Finder). Usado por el botón
  // "Visualizar investigación" del módulo 3.2.2 para abrir el docx recién generado.
  showItemInFolder: (filePath) => {
    log('DEBUG', `showItemInFolder llamado con: ${filePath}`);
    return ipcRenderer.invoke('show-item-in-folder', filePath)
      .then(result => {
        log('DEBUG', 'showItemInFolder resultado:', result);
        return result;
      })
      .catch(error => {
        log('ERROR', `Error en showItemInFolder: ${error.message}`);
        throw error;
      });
  },

  readExcelFile: (filePath) => ipcRenderer.invoke('read-excel-file', filePath),
  saveProveedoresExcelData: (filePath, data) => ipcRenderer.invoke('save-proveedores-excel-data', filePath, data),
  processExcelData: (payload) => ipcRenderer.invoke('process-excel-data', payload),
  updatePlanTrabajoExcel: (payload) => ipcRenderer.invoke('update-plan-trabajo-excel', payload),
  repairPlanTrabajoExcel: (payload) => ipcRenderer.invoke('repair-plan-trabajo-excel', payload),

  // --- Módulo 2.10.1 Evaluación y Selección de Proveedores y Contratistas ---
  getAsociadosES: () => ipcRenderer.invoke('get-asociados-es'),
  saveAsociadosES: (data) => ipcRenderer.invoke('save-asociados-es', data),
  getEvaluacionesES: () => ipcRenderer.invoke('get-evaluaciones-es'),
  saveEvaluacionesES: (data) => ipcRenderer.invoke('save-evaluaciones-es', data),
  getReevaluacionesES: () => ipcRenderer.invoke('get-reevaluaciones-es'),
  saveReevaluacionesES: (data) => ipcRenderer.invoke('save-reevaluaciones-es', data),
  getNoConformidadesES: () => ipcRenderer.invoke('get-noconformidades-es'),
  saveNoConformidadesES: (data) => ipcRenderer.invoke('save-noconformidades-es', data),

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
  createFolder: (payload) => ipcRenderer.invoke('create-folder', payload),
  deleteFolder: (payload) => ipcRenderer.invoke('delete-folder', payload),
  renameItem: (payload) => ipcRenderer.invoke('rename-item', payload),
  
  // --- Diagnóstico y reparación de Word COM ---
  diagnoseWordCom: () => ipcRenderer.invoke('diagnose-word-com'),
  repairWordCom: () => ipcRenderer.invoke('repair-word-com'),

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
  getContactInfo: (cedula, empresa) =>
    ipcRenderer.invoke('get-contact-info', cedula, empresa),

  // --- Excel ---
  getCapacitacionesSheets: (filePath) => ipcRenderer.invoke('get-capacitaciones-sheets', filePath),
  initExcel: (data) => ipcRenderer.invoke('init-excel', data),
  updateCapacitacionesExcel: (data) => ipcRenderer.invoke('update-capacitaciones-excel', data),
  duplicateCapacitacionesSheet: (args) => ipcRenderer.invoke('duplicate-capacitaciones-sheet', args),
  updateExcelCell: (data) => ipcRenderer.invoke('update-excel-cell', data),
  convertExcelToPdf: (filePath) => ipcRenderer.invoke('convertExcelToPdf', filePath),
  printInformeToPdf: (payload) => ipcRenderer.invoke('print-informe-to-pdf', payload),
  auditExcelContent: (data) => ipcRenderer.invoke('audit-excel-content', data),

  // --- K+AIR Calendar: Eventos Rápidos ---
  // Usado por el calendario central del header (#calendar-button).
  // Crea/lee/edita/elimina eventos personales del usuario sin necesidad de un módulo específico.
  eventosRapidos: {
    list: (range) => ipcRenderer.invoke('eventos-rapidos:list', range),
    create: (event) => ipcRenderer.invoke('eventos-rapidos:create', event),
    update: (event) => ipcRenderer.invoke('eventos-rapidos:update', event),
    remove: (id) => ipcRenderer.invoke('eventos-rapidos:remove', id)
  },

  // --- K+AIR Calendar: agregadores de las 3 fuentes principales ---
  // Devuelven eventos en formato unificado: { id, title, date, start, end, type }.
  // type puede ser: 'plan' | 'capacitacion' | 'auditoria' | 'rapido' | 'vencido' | 'gestacion'.
  planTrabajo: {
    getEvents: (range) => ipcRenderer.invoke('plan-trabajo:get-events', range)
  },
  capacitaciones: {
    getEvents: (range) => ipcRenderer.invoke('capacitaciones:get-events', range)
  },
  auditoria: {
    getFases: (range) => ipcRenderer.invoke('auditoria:get-fases', range)
  },
  // 📦497 — Eventos de seguimientos de gestación (Salud Materna).
  // Devuelve los próximos seguimientos programados por gestante activa/reintegro.
  gestaciones: {
    getEvents: (payload) => ipcRenderer.invoke('gestaciones:get-events', payload)
  },

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
  regenerateAnalysis: (params) =>
    ipcRenderer.invoke('investigacion-accidentes-regenerate-analysis', params),
  saveTempPdfFile: (filename, data) => ipcRenderer.invoke('investigacion-accidentes-save-temp-pdf-file', filename, data),

  // --- Gestión de Modelo LLM (Configuración IA) ---
  llmListModels: () => ipcRenderer.invoke('llm-list-models'),
  llmSelectModel: (model) => ipcRenderer.invoke('llm-select-model', { model }),
  llmGetConfig: () => ipcRenderer.invoke('llm-get-config'),
  llmSaveConfig: (config) => ipcRenderer.invoke('llm-save-config', config),

  // --- Investigación de Accidentes (Gestión) ---
  getInvestigacionStats: (companyName) => ipcRenderer.invoke('investigacion-accidentes-get-stats', { companyName }),
  listInvestigations: (companyName, filter) => ipcRenderer.invoke('investigacion-accidentes-list-investigations', { companyName, filter }),
  getInvestigationDetail: (companyName, investigationName) => ipcRenderer.invoke('investigacion-accidentes-get-investigation-detail', { companyName, investigationName }),
  getCrossReferenceData: (companyName) => ipcRenderer.invoke('investigacion-accidentes-cross-reference-data', { companyName }),
  // Busca el archivo FURAT (PDF) en 3.2.1 por nombre — usado como fallback cuando
  // el viewer no envía la ruta del FURAT al iframe de nueva investigación.
  findFuratByName: (companyName, caseName) => ipcRenderer.invoke('investigacion-accidentes-find-furat-by-name', { companyName, caseName }),

  // --- Registro Estadístico (3.2.3) ---
  registroEstadisticoCargarDatos: (companyName) =>
    ipcRenderer.invoke('registro-estadistico:cargar-datos', { companyName }),

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

  // --- Consulta de Trabajadores (Módulo Ausentismo) ---
  consultarTrabajadoresGlobal: (params) =>
    ipcRenderer.invoke('consultar-trabajadores-global', params),
  obtenerEmpresasConBDPersonal: () =>
    ipcRenderer.invoke('obtener-empresas-con-bd-personal'),

  // --- Estadísticas de Ausentismo (widget home) ---
  getAusentismoStats: (companyName, mode) =>
    ipcRenderer.invoke('get-ausentismo-stats', companyName, mode),

  // --- 📦465 (2026-07-03) — Seguimiento de Gestación (Salud Materna) ---
  // Handlers del bridge `gestacion-bridge.js` (persistencia SQLite central).
  gestacionCargarTodo: (params) =>
    ipcRenderer.invoke('gestacion:cargarTodo', params),
  gestacionGetStats: (params) =>
    ipcRenderer.invoke('gestacion:getStats', params),
  gestacionListarGestantes: (params) =>
    ipcRenderer.invoke('gestacion:listarGestantes', params),
  gestacionObtenerGestante: (params) =>
    ipcRenderer.invoke('gestacion:obtenerGestante', params),
  gestacionRegistrarGestante: (params) =>
    ipcRenderer.invoke('gestacion:registrarGestante', params),
  gestacionActualizarGestante: (params) =>
    ipcRenderer.invoke('gestacion:actualizarGestante', params),
  gestacionEliminarGestante: (params) =>
    ipcRenderer.invoke('gestacion:eliminarGestante', params),
  gestacionGuardarSeguimiento: (params) =>
    ipcRenderer.invoke('gestacion:guardarSeguimiento', params),
  gestacionObtenerSeguimientos: (params) =>
    ipcRenderer.invoke('gestacion:obtenerSeguimientos', params),
  // 📦469 — Motor de cálculos para Reportes de Seguimiento (Resumen Ejecutivo / Detallado / Individual)
  gestacionCalcularReporte: (params) =>
    ipcRenderer.invoke('gestacion:calcularReporte', params),
  // 📦469 — Cambio de estado con validación de flujo lineal estricto
  gestacionActualizarEstado: (params) =>
    ipcRenderer.invoke('gestacion:actualizarEstado', params),

  // 📦498 — Marcado de eventos del calendario como cumplidos (persistente).
  // Funciona para cualquier tipo de evento del calendario (capacitacion,
  // gestacion, reunion, plan, rapido, etc.). Es solo una marca personal
  // en el calendario — NO impacta los modulos origen.
  eventosCumplidos: {
    listar: (params) => ipcRenderer.invoke('eventos-cumplidos:listar', params),
    marcar: (params) => ipcRenderer.invoke('eventos-cumplidos:marcar', params),
    desmarcar: (params) => ipcRenderer.invoke('eventos-cumplidos:desmarcar', params)
  },
  // 📦481-fix — Ruta de Downloads del usuario (para guardar PDFs de reportes)
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),

  // --- Estadísticas de Accidentes FURAT (widget home) ---
getAccidentesStats: (companyName) =>
ipcRenderer.invoke('get-accidentes-stats', companyName),

getIndicadoresSaludStats: (companyName) =>
ipcRenderer.invoke('get-indicadores-salud-stats', companyName),

  // --- Estadísticas de Exámenes Médicos (widget home) ---
  getExamenesStats: (companyName) =>
    ipcRenderer.invoke('get-examenes-stats', companyName),

  getRemisionesStats: (companyName) =>
    ipcRenderer.invoke('get-remisiones-stats', companyName),

  getSaludSeguimientosStats: (companyName) =>
    ipcRenderer.invoke('get-salud-seguimientos-stats', companyName),

  // --- Inducciones ---
  getInduccionesData: (companyName) => ipcRenderer.invoke('get-inducciones-data', companyName),
  syncInduccionesFromForms: (companyName) => ipcRenderer.invoke('sync-inducciones-from-forms', companyName),
  checkInduccionesChanges: (companyName, lastKnownHash) => ipcRenderer.invoke('check-inducciones-changes', companyName, lastKnownHash),

  // --- Actas ---
  getActaData: () => ipcRenderer.invoke('get-acta-data'),
  getConvivenciaActaData: () => ipcRenderer.invoke('getConvivenciaActaData'),
  generateCopasstActa: (changes, savePath) => ipcRenderer.invoke('generate-copasst-acta', changes, savePath),
  generateConvivenciaActa: (changes, savePath) => ipcRenderer.invoke('generate-convivencia-acta', changes, savePath),
 getCopasstAutoFillData: (companyName) => ipcRenderer.invoke('get-copasst-auto-fill-data', companyName),
 getCopasstSavePath: (companyName, year, monthName, actaNumber) => ipcRenderer.invoke('get-copasst-save-path', companyName, year, monthName, actaNumber),
 getConvivenciaAutoFillData: (companyName) => ipcRenderer.invoke('get-convivencia-auto-fill-data', companyName),
 getConvivenciaSavePath: (companyName, year, monthName) => ipcRenderer.invoke('get-convivencia-save-path', companyName, year, monthName),

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
  getObjetivosResultados: (excelFilePath) => ipcRenderer.invoke('get-objetivos-resultados', excelFilePath),
  saveObjetivosResultados: (excelFilePath, data) => ipcRenderer.invoke('save-objetivos-resultados', excelFilePath, data),
  getObjetivosResultadosAuto: (companyName) => ipcRenderer.invoke('get-objetivos-resultados-auto', companyName),

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

  // --- Revisión por la Alta Dirección (Submódulo 6.1.3) ---
  revisionAltaDireccion: {
    cargarTodo: (empresaId) => ipcRenderer.invoke('revisionAltaDireccion:cargarTodo', { empresaId }),
    listarRevisiones: (empresaId, filtros) => ipcRenderer.invoke('revisionAltaDireccion:listarRevisiones', { empresaId, filtros }),
    obtenerRevision: (empresaId, id) => ipcRenderer.invoke('revisionAltaDireccion:obtenerRevision', { empresaId, id }),
    crearRevision: (empresaId, data) => ipcRenderer.invoke('revisionAltaDireccion:crearRevision', { empresaId, data }),
    actualizarRevision: (empresaId, id, cambios) => ipcRenderer.invoke('revisionAltaDireccion:actualizarRevision', { empresaId, id, cambios }),
    cambiarEstadoRevision: (empresaId, id, nuevoEstado) => ipcRenderer.invoke('revisionAltaDireccion:cambiarEstadoRevision', { empresaId, id, nuevoEstado }),
    eliminarRevision: (empresaId, id) => ipcRenderer.invoke('revisionAltaDireccion:eliminarRevision', { empresaId, id }),
    listarActas: (empresaId, filtros) => ipcRenderer.invoke('revisionAltaDireccion:listarActas', { empresaId, filtros }),
    guardarActa: (empresaId, acta) => ipcRenderer.invoke('revisionAltaDireccion:guardarActa', { empresaId, acta }),
    listarIndicadores: (empresaId) => ipcRenderer.invoke('revisionAltaDireccion:listarIndicadores', { empresaId }),
    guardarIndicador: (empresaId, indicador) => ipcRenderer.invoke('revisionAltaDireccion:guardarIndicador', { empresaId, indicador }),
    importarXlsx: (empresaId, archivoPath, tipoPlantilla) => ipcRenderer.invoke('revisionAltaDireccion:importarXlsx', { empresaId, archivoPath, tipoPlantilla }),
    exportarXlsx: (empresaId, tipoPlantilla, id) => ipcRenderer.invoke('revisionAltaDireccion:exportarXlsx', { empresaId, tipoPlantilla, id }),
    subirDocumento: (empresaId, buffer, metadata) => ipcRenderer.invoke('revisionAltaDireccion:subirDocumento', { empresaId, buffer, metadata }),
    obtenerProcedimiento: (empresaId) => ipcRenderer.invoke('revisionAltaDireccion:obtenerProcedimiento', { empresaId }),
    abrirProcedimiento: (empresaId) => ipcRenderer.invoke('revisionAltaDireccion:abrirProcedimiento', { empresaId }),
  },

  // --- Auditoría Anual (Submódulo 6.1.2) — F1 (2026-06-19) ---
  auditoriaAnual: {
    cargarTodo: (empresaId) => ipcRenderer.invoke('auditoriaAnual:cargarTodo', { empresaId }),
    guardarAuditoria: (empresaId, auditoria) => ipcRenderer.invoke('auditoriaAnual:guardarAuditoria', { empresaId, auditoria }),
    eliminarAuditoria: (empresaId, id) => ipcRenderer.invoke('auditoriaAnual:eliminarAuditoria', { empresaId, id }),
    guardarHallazgo: (empresaId, hallazgo) => ipcRenderer.invoke('auditoriaAnual:guardarHallazgo', { empresaId, hallazgo }),
    eliminarHallazgo: (empresaId, id) => ipcRenderer.invoke('auditoriaAnual:eliminarHallazgo', { empresaId, id }),
    exportarXlsx: (empresaId) => ipcRenderer.invoke('auditoriaAnual:exportarXlsx', { empresaId }),
    /* F18 (2026-06-20): Lee el GI-FO-062 del repositorio de la empresa */
    cargarCronograma: (empresaId, anio) => ipcRenderer.invoke('auditoriaAnual:cargarCronograma', { empresaId, anio }),
    /* F20 (2026-06-20): Crea un nuevo archivo de cronograma para un año futuro */
    crearCronograma: (empresaId, anio) => ipcRenderer.invoke('auditoriaAnual:crearCronograma', { empresaId, anio }),
    importarXlsx: (empresaId, archivoPath) => ipcRenderer.invoke('auditoriaAnual:importarXlsx', { empresaId, archivoPath }),
    seleccionarArchivoImportar: () => ipcRenderer.invoke('auditoriaAnual:seleccionarArchivoImportar'),
  },

  // --- Acciones Preventivas y Correctivas (Submódulo 7.1.1) — F21.41 (2026-06-21) ---
  accionesPc: {
    cargarTodo: (empresaId) => ipcRenderer.invoke('accionesPc:cargarTodo', { empresaId }),
    guardarAccion: (empresaId, accion) => ipcRenderer.invoke('accionesPc:guardarAccion', { empresaId, accion }),
    eliminarAccion: (empresaId, id) => ipcRenderer.invoke('accionesPc:eliminarAccion', { empresaId, id }),
    cambiarEstado: (empresaId, id, estado) => ipcRenderer.invoke('accionesPc:cambiarEstado', { empresaId, id, estado }),
    exportarXlsx: (empresaId) => ipcRenderer.invoke('accionesPc:exportarXlsx', { empresaId }),
    importarXlsx: (empresaId, archivoPath) => ipcRenderer.invoke('accionesPc:importarXlsx', { empresaId, archivoPath }),
    seleccionarArchivoImportar: () => ipcRenderer.invoke('accionesPc:seleccionarArchivoImportar'),
  },

  // --- Gestión del Cambio (2.11.1) ---
  loadGestionCambioData: (companyName) => ipcRenderer.invoke('gestion-cambio-load-data', companyName),
  saveGestionCambioData: (companyName, changeData) => ipcRenderer.invoke('gestion-cambio-save-data', companyName, changeData),
  generateGestionCambioId: (companyName) => ipcRenderer.invoke('gestion-cambio-generate-id', companyName),
  updateGestionCambioEstado: (companyName, changeId, nuevoEstado, extraData) =>
    ipcRenderer.invoke('gestion-cambio-update-estado', companyName, changeId, nuevoEstado, extraData),

// --- Frecuencia de la Accidentalidad (3.3.1) ---
frecuenciaAccidentalidad: {
  configurarRutas: (companyName, year) => ipcRenderer.invoke('frecuencia-accidentalidad:configurar-rutas', companyName, year),
  leerIndicadores: () => ipcRenderer.invoke('frecuencia-accidentalidad:leer-indicadores'),
  leerCaracterizacion: () => ipcRenderer.invoke('frecuencia-accidentalidad:leer-caracterizacion'),
  contarATPorMes: (year, companyName) => ipcRenderer.invoke('frecuencia-accidentalidad:contar-at-por-mes', year, companyName),
  leerMetaObjetivo: (companyName) => ipcRenderer.invoke('frecuencia-accidentalidad:leer-meta-objetivo', companyName),
  escribirEnExcel: (mes, campos) => ipcRenderer.invoke('frecuencia-accidentalidad:escribir-excel', mes, campos),
},

// --- Severidad de la Accidentalidad (3.3.2) ---
severidadAccidentalidad: {
  configurarRutas: (companyName, year) => ipcRenderer.invoke('severidad-accidentalidad:configurar-rutas', companyName, year),
  leerIndicadores: () => ipcRenderer.invoke('severidad-accidentalidad:leer-indicadores'),
  escribirEnExcel: (mes, campos) => ipcRenderer.invoke('severidad-accidentalidad:escribir-excel', mes, campos),
},

// --- Índice de Mortalidad (3.3.3) ---
mortalidad: {
  configurarRutas: (companyName, year) => ipcRenderer.invoke('mortalidad:configurar-rutas', companyName, year),
  leerIndicadores: () => ipcRenderer.invoke('mortalidad:leer-indicadores'),
  escribirExcel: (mes, campos) => ipcRenderer.invoke('mortalidad:escribir-excel', mes, campos),
  leerSeveridadJson: (companyName, year) => ipcRenderer.invoke('mortalidad:leer-severidad-json', companyName, year),
},

// --- Prevalencia de Enfermedad Laboral (3.3.4) ---
prevalencia: {
  configurarRutas: (companyName, year) => ipcRenderer.invoke('prevalencia:configurar-rutas', companyName, year),
  leerIndicadores: () => ipcRenderer.invoke('prevalencia:leer-indicadores'),
  escribirEnExcel: (mes, campos) => ipcRenderer.invoke('prevalencia:escribir-excel', mes, campos),
},

// --- Incidencia de Enfermedad Laboral (3.3.5) ---
incidencia: {
  configurarRutas: (companyName, year) => ipcRenderer.invoke('incidencia:configurar-rutas', companyName, year),
  leerIndicadores: () => ipcRenderer.invoke('incidencia:leer-indicadores'),
  escribirEnExcel: (mes, campos) => ipcRenderer.invoke('incidencia:escribir-excel', mes, campos),
},

getIndicadoresFiles: ({ companyName, submodule }) => ipcRenderer.invoke('get-indicadores-files', { companyName, submodule }),
duplicateIndicadoresFile: ({ currentFilePath, newYear }) => ipcRenderer.invoke('duplicate-indicadores-file', { currentFilePath, newYear }),

  // --- Inspecciones Sistemáticas (4.2.4) — NUEVO CONTRATO ---
  // 📦500 — Nuevo bridge con 8 canales `modulo:accion` (file-based JSON store).
  // Se conserva `getStats` como wrapper backward-compat para los widgets del
  // home de gestion-peligros. Los métodos se exponen al TOP-LEVEL de
  // electronAPI (no dentro del namespace `inspecciones`) para que el adapter
  // pueda llamarlos como `electronAPI.programaObtener(...)` directamente.
  // `inspecciones.getStats` se mantiene solo por backward-compat del home.

  // Top-level: nuevo contrato modulo:accion (8 canales)
  companyListar: () => ipcRenderer.invoke('company:listar'),
  programaObtener: (year, companyId) => ipcRenderer.invoke('programa:obtener', year, companyId),
  programaActualizarActividad: (activityId, patch) => ipcRenderer.invoke('programa:actualizarActividad', activityId, patch),
  inspeccionListar: (filter) => ipcRenderer.invoke('inspeccion:listar', filter),
  inspeccionObtener: (id) => ipcRenderer.invoke('inspeccion:obtener', id),
  inspeccionCrear: (payload) => ipcRenderer.invoke('inspeccion:crear', payload),
  inspeccionActualizar: (id, patch) => ipcRenderer.invoke('inspeccion:actualizar', id, patch),
  inspeccionEliminar: (id) => ipcRenderer.invoke('inspeccion:eliminar', id),
  // 📦506 — Devuelve los eventos del calendario para las inspecciones
  // planificadas del programa anual. Params: { start, end, currentCompany }.
  // Cada actividad con monthlySchedule[Mes]="p" o "c" genera 1 evento
  // en uno de los primeros 5 días hábiles del mes (round-robin entre
  // actividades del mes).
  // 📦507 — Notifica al renderer cuando se actualiza el programa para que
  // el calendario recargue eventos si está visible.
  inspeccionPrograma: {
    getEventsCalendario: (params) => ipcRenderer.invoke('inspeccion:programa:getEventsCalendario', params),
    onProgramaActualizado: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('inspeccion:programa:actualizado', listener);
      // Devuelve función de cleanup para des-suscribirse si hace falta
      return () => ipcRenderer.off('inspeccion:programa:actualizado', listener);
    }
  },
  // 📦504 — Exporta la inspección a .xlsx usando la plantilla oficial de
  // su tipo (instalaciones, botiquin, extintores, equipos_emergencia) como
  // base. Preserva bordes, fonts, fills, merges y anchos de columna.
  // Devuelve el archivo serializado en base64.
  inspeccionExportarXlsx: (insp) => ipcRenderer.invoke('inspeccion:exportarXlsx', insp),

  // Backward-compat: consumido por gestion-peligros-home.js widgets
  inspecciones: {
    getStats: (companyName) => ipcRenderer.invoke('inspecciones:get-stats', companyName)
  },

  // --- Mantenimiento Periódico (4.2.5) ---
  mantenimiento: {
    read: (companyName) => ipcRenderer.invoke('mantenimiento:read', companyName),
    save: (companyName, items) => ipcRenderer.invoke('mantenimiento:save', companyName, items),
    toggleMonth: (companyName, rowIndex, month, type, value) => ipcRenderer.invoke('mantenimiento:toggle-month', companyName, rowIndex, month, type, value),
    updateField: (companyName, rowIndex, field, value) => ipcRenderer.invoke('mantenimiento:update-field', companyName, rowIndex, field, value),
    addRow: (companyName, itemData) => ipcRenderer.invoke('mantenimiento:add-row', companyName, itemData),
    saveEvidence: (companyName, evidenceData) => ipcRenderer.invoke('mantenimiento:save-evidence', companyName, evidenceData),
    readEvidenceFile: (companyName, relativePath) => ipcRenderer.invoke('mantenimiento:read-evidence-file', companyName, relativePath),
    deleteEvidence: (companyName, relativePath) => ipcRenderer.invoke('mantenimiento:delete-evidence', companyName, relativePath),
    listEvidences: (companyName, rowIndex, category, year) => ipcRenderer.invoke('mantenimiento:list-evidences', companyName, rowIndex, category, year),
    getStats: (companyName) => ipcRenderer.invoke('mantenimiento:get-stats', companyName),
    // 📦509 — Devuelve los eventos del calendario para los mantenimientos
    // PROGRAMADOS PENDIENTES (MPP). Por cada item con MPP en un mes, genera
    // 1 evento en uno de los 10 días hábiles de las semanas 2 y 3 del mes
    // (round-robin entre actividades). Solo MPP, NO MPE/MPC.
    calendarioGetEvents: (params) => ipcRenderer.invoke('mantenimiento:calendario:get-events', params),
    // 📦509 — Notifica al renderer cuando se actualiza el cronograma para que
    // el calendario recargue eventos si está visible (mismo patrón que
    // inspecciones en 📦507).
    onProgramaActualizado: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('mantenimiento:programa:actualizado', listener);
      return () => ipcRenderer.off('mantenimiento:programa:actualizado', listener);
    }
  },

  // --- Identificación de Peligros (4.1.2) ---
  matrizPeligros: {
    read: (companyName) => ipcRenderer.invoke('matriz-peligros:read', companyName),
    save: (companyName, data) => ipcRenderer.invoke('matriz-peligros:save', companyName, data),
    addSede: (companyName, nombre) => ipcRenderer.invoke('matriz-peligros:add-sede', companyName, nombre),
    addProceso: (companyName, sedeId, nombre) => ipcRenderer.invoke('matriz-peligros:add-proceso', companyName, sedeId, nombre),
    addCargo: (companyName, procesoId, nombre) => ipcRenderer.invoke('matriz-peligros:add-cargo', companyName, procesoId, nombre),
    addPeligro: (companyName, cargoId, data) => ipcRenderer.invoke('matriz-peligros:add-peligro', companyName, cargoId, data),
    updatePeligro: (companyName, peligroId, cambios) => ipcRenderer.invoke('matriz-peligros:update-peligro', companyName, peligroId, cambios),
    deletePeligro: (companyName, peligroId) => ipcRenderer.invoke('matriz-peligros:delete-peligro', companyName, peligroId),
    deleteCargo: (companyName, cargoId) => ipcRenderer.invoke('matriz-peligros:delete-cargo', companyName, cargoId),
    deleteProceso: (companyName, procesoId) => ipcRenderer.invoke('matriz-peligros:delete-proceso', companyName, procesoId),
    deleteSede: (companyName, sedeId) => ipcRenderer.invoke('matriz-peligros:delete-sede', companyName, sedeId),
    renameSede: (companyName, sedeId, nombre) => ipcRenderer.invoke('matriz-peligros:rename-sede', companyName, sedeId, nombre),
    renameProceso: (companyName, procesoId, nombre) => ipcRenderer.invoke('matriz-peligros:rename-proceso', companyName, procesoId, nombre),
renameCargo: (companyName, cargoId, nombre) => ipcRenderer.invoke('matriz-peligros:rename-cargo', companyName, cargoId, nombre),
      updateCargo: (companyName, cargoId, cambios) => ipcRenderer.invoke('matriz-peligros:update-cargo', companyName, cargoId, cambios),
      stats: (companyName) => ipcRenderer.invoke('matriz-peligros:stats', companyName),
    heatmap: (companyName) => ipcRenderer.invoke('matriz-peligros:heatmap', companyName),
    priorizacion: (companyName) => ipcRenderer.invoke('matriz-peligros:priorizacion', companyName),
    metadata: (companyName) => ipcRenderer.invoke('matriz-peligros:metadata', companyName),
    updateMetadata: (companyName, metadata) => ipcRenderer.invoke('matriz-peligros:update-metadata', companyName, metadata),
    notasAnaliticas: (companyName) => ipcRenderer.invoke('matriz-peligros:notas-analiticas', companyName),
      gtc45Options: () => ipcRenderer.invoke('matriz-peligros:gtc45-options'),
    discoverXlsx: (companyName) => ipcRenderer.invoke('matriz-peligros:discover-xlsx', companyName),
    importXlsx: (companyName, filePath, opts) => ipcRenderer.invoke('matriz-peligros:import-xlsx', companyName, filePath, opts),
    syncXlsx: (companyName) => ipcRenderer.invoke('matriz-peligros:sync-xlsx', companyName),
    reset: (companyName) => ipcRenderer.invoke('matriz-peligros:reset', companyName),
  },

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
  // 📦503 — Descarga e instalación 100% manuales. La app chequea en background
  // y notifica al usuario, pero NO baja ni instala sola.
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  restartApp: () => ipcRenderer.send('restart_app'),
  checkForUpdatesManual: () => ipcRenderer.invoke('check-for-updates-manual'),
  // Acceso directo en escritorio (autoUpdater no lo recrea tras update)
  createDesktopShortcut: () => ipcRenderer.invoke('create-desktop-shortcut'),
  checkDesktopShortcut: () => ipcRenderer.invoke('check-desktop-shortcut'),
});
