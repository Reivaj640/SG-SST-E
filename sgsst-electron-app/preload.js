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
  // 📦103.A1.1 · NIT por empresa (config.companyPaths[companyKey].nit)
  // Usa company-config-writer.js en main process. NO usa save-config.
  companyNitGet: (companyKey) => ipcRenderer.invoke('company-nit:get', { companyKey }),
  companyNitSet: (companyKey, nit) => ipcRenderer.invoke('company-nit:set', { companyKey, nit }),
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
  // 📦702 (2026-08-13) — Permisos de Bandeja Integrada por usuario.
  // Usado por: Bandeja Integrada (chequear acceso antes de abrir iframe) y
  // modal de Gestión de Usuario (toggle por user).
  usersGetBandejaIntegradaFlag: (payload) => ipcRenderer.invoke('users-get-bandeja-integrada-flag', payload),
  usersSetBandejaIntegradaFlag: (payload) => ipcRenderer.invoke('users-set-bandeja-integrada-flag', payload),
  
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

  // --- F3.A — Google OAuth (Calendar + Gmail) para Bandeja Integrada ---
  google: {
    start: () => ipcRenderer.invoke('google-oauth:start'),
    awaitCallback: () => ipcRenderer.invoke('google-oauth:await-callback'),
    exchange: (payload) => ipcRenderer.invoke('google-oauth:exchange', payload),
    cancel: () => ipcRenderer.invoke('google-oauth:cancel'),
    status: () => ipcRenderer.invoke('google-oauth:status'),
    disconnect: () => ipcRenderer.invoke('google-oauth:disconnect')
  },

  // F4-fix — Abre URL en el browser externo del usuario (usado por el flow OAuth de Gmail).
  openExternalUrl: (url) => ipcRenderer.send('open-external-url', url),

  // --- F3.B — Gmail reader (correos reales de Gmail) ---
  googleGmail: {
    listInbox: (options) => ipcRenderer.invoke('google-gmail:list-inbox', options),
    getMessage: (messageId) => ipcRenderer.invoke('google-gmail:get-message', messageId),
    markRead: (messageId) => ipcRenderer.invoke('google-gmail:mark-read', messageId),
    // F4-fix — Para mostrar el email del usuario conectado en el switch de Config.
    getProfile: () => ipcRenderer.invoke('google-gmail:get-profile'),
    // F1.B — Enviar correo (Reply / Reply all / Forward / Nuevo).
    sendMessage: (options) => ipcRenderer.invoke('google-gmail:send-message', options),
    // F1-Feature1 — Listar labels de Gmail.
    listLabels: () => ipcRenderer.invoke('google-gmail:list-labels'),
    // F1-Feature3 — Marcar mensaje como leído/no leído en Gmail.
    markMessageRead: (options) => ipcRenderer.invoke('google-gmail:mark-read', options),
    // F1-Feature3 — Archivar thread en Gmail.
    archiveThread: (options) => ipcRenderer.invoke('google-gmail:archive-thread', options),
    // F1-Feature5 — Descargar attachment de Gmail.
    downloadAttachment: (options) => ipcRenderer.invoke('google-gmail:download-attachment', options)
  },

  // --- F3.C — Google Calendar sync (lectura/escritura desde Bandeja Integrada) ---
  // Reusa el token OAuth de Gmail/Calendar que ya está autorizado. El scope
  // calendar ya está en shared/google-auth.js (línea 82), no requiere re-autorización.
  googleCalendar: {
    list: (options) => ipcRenderer.invoke('google-calendar:list', options),
    get: (googleEventId) => ipcRenderer.invoke('google-calendar:get', googleEventId),
    create: (event) => ipcRenderer.invoke('google-calendar:create', event),
    update: (payload) => ipcRenderer.invoke('google-calendar:update', payload),
    delete: (googleEventId) => ipcRenderer.invoke('google-calendar:delete', googleEventId),
    sync: (options) => ipcRenderer.invoke('google-calendar:sync', options),
    // 📦600 — Responder a una invitación (Sí / No / Tal vez)
    respond: (payload) => ipcRenderer.invoke('google-calendar:respond', payload),
    // 📦602 — Crear/actualizar evento desde un .ics y responder al organizador
    upsertFromIcs: (payload) => ipcRenderer.invoke('google-calendar:upsert-from-ics', payload)
  },

  // 📦 Bandeja Integrada — Email cache (SQLite) — Fase 0
  // Patrón Mail-0: driver que lee de SQLite instantáneo en vez de llamar al API cada vez.
  emailCache: {
    // Sincroniza el inbox desde Gmail al cache local
    syncInbox: (options) => ipcRenderer.invoke('email-cache:sync-inbox', options),
    // Lee los threads del cache (instantáneo, sin API call)
    getThreads: (options) => ipcRenderer.invoke('email-cache:get-threads', options),
    // Lee un thread completo con sus mensajes
    getThread: (threadId) => ipcRenderer.invoke('email-cache:get-thread', threadId),
    // Estadísticas (totales para el footer)
    getStats: () => ipcRenderer.invoke('email-cache:get-stats'),
    // F1-Feature1 — Obtener labels cacheados.
    getLabels: (connectionId) => ipcRenderer.invoke('email-cache:get-labels', connectionId),
    // F1-Feature5 — Obtener adjuntos de un mensaje específico.
    getAttachments: (messageId) => ipcRenderer.invoke('email-cache:get-attachments', messageId)
  },

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
  // 📦608 — Lectura genérica de bytes para @file-viewer (no convierte, no pasa por LibreOffice)
  readFileBytes: (filePath) => ipcRenderer.invoke('read-file-bytes', filePath),
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

  // --- 📦658 — FURAT (Reportes de Accidentes) ---
  furatUploadFile: (payload) => ipcRenderer.invoke('furat:upload-file', payload),
  furatListMetadata: (companyName) => ipcRenderer.invoke('furat:list-metadata', companyName),
  // 📦659 — Dashboard analítico (Fase 3)
  furatGetAnalytics: (companyName) => ipcRenderer.invoke('furat:get-analytics', companyName),
  // 📦680 — Crear nueva carpeta (período) en el filesystem
  furatCreateFolder: (payload) => ipcRenderer.invoke('furat:create-folder', payload),
  // 📦692 — Eliminar carpeta (con todo su contenido) y limpiar metadata
  furatDeleteFolder: (payload) => ipcRenderer.invoke('furat:delete-folder', payload),
  // 📦693 — Upsert metadata (crear o actualizar) para un PDF
  furatUpsertMetadata: (payload) => ipcRenderer.invoke('furat:upsert-metadata', payload),
  // 📦693 — Obtener metadata de un solo archivo
  furatGetMetadataForFile: (filePath) => ipcRenderer.invoke('furat:get-metadata-for-file', filePath),

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

  // 📦708 (2026-08-15) — Presupuesto SG-SST · FASE 2-3
  // Canales del bridge nuevo (main/presupuesto-bridge.js). Auth opcional
  // (soft auth) para alinear con el patrón de los handlers viejos de Excel.
  // Plan completo: docs/plans/presupuesto-bd-migration.md
  presupuestoListByEmpresa: (payload) => ipcRenderer.invoke('presupuesto:list-by-empresa', payload),
  presupuestoGet: (payload) => ipcRenderer.invoke('presupuesto:get', payload),
  presupuestoGetByEmpresaAnio: (payload) => ipcRenderer.invoke('presupuesto:get-by-empresa-anio', payload),
  presupuestoCalcularResumen: (payload) => ipcRenderer.invoke('presupuesto:calcular-resumen', payload),
  presupuestoImportFromExcel: (payload) => ipcRenderer.invoke('presupuesto:import-from-excel', payload),
  presupuestoExportExcel: (payload) => ipcRenderer.invoke('presupuesto:export-excel', payload),
  presupuestoCreate: (payload) => ipcRenderer.invoke('presupuesto:create', payload),
  presupuestoBulkSave: (payload) => ipcRenderer.invoke('presupuesto:bulk-save', payload),
  // 📦708 (Fase 3.5) — Handlers granulares
  presupuestoAddPartida: (payload) => ipcRenderer.invoke('presupuesto:add-partida', payload),
  presupuestoDeletePartida: (payload) => ipcRenderer.invoke('presupuesto:delete-partida', payload),
  presupuestoSetMesValues: (payload) => ipcRenderer.invoke('presupuesto:set-mes-values', payload),
  presupuestoUpdateMeta: (payload) => ipcRenderer.invoke('presupuesto:update-meta', payload),
  presupuestoDiag: (payload) => ipcRenderer.invoke('presupuesto:diag', payload),

  // 📦709 (2026-08-15) — Gestión Humana (nuevo módulo top-level) · FASE 0
  // 16 canales: 5 read + 4 write-contratacion + 4 write-personal + 2 write-sedes + 1 diag
  // Plan: docs/plans/2026-08-15-gestion-humana-design.md
  // Read (5)
  ghListContrataciones: (payload) => ipcRenderer.invoke('gh:list-contrataciones', payload),
  ghGetContratacion: (payload) => ipcRenderer.invoke('gh:get-contratacion', payload),
  ghListPersonal: (payload) => ipcRenderer.invoke('gh:list-personal', payload),
  ghGetPersonal: (payload) => ipcRenderer.invoke('gh:get-personal', payload),
  // 📦767 · Validación de cédula en UI de Contratación (búsqueda exacta antes de submit)
  ghGetPersonalByCedula: (payload) => ipcRenderer.invoke('gh:get-personal-by-cedula', payload),
  ghListSedes: (payload) => ipcRenderer.invoke('gh:list-sedes', payload),
  // 📦760 · Documentos de Afiliaciones (5) — certificados EPS / Pensión / ARL / Caja
  ghListDocumentosAfiliaciones: (payload) => ipcRenderer.invoke('gh:list-documentos-afiliaciones', payload),
  ghSubirDocumentoAfiliacion: (payload) => ipcRenderer.invoke('gh:subir-documento-afiliacion', payload),
  ghEliminarDocumentoAfiliacion: (payload) => ipcRenderer.invoke('gh:eliminar-documento-afiliacion', payload),
  ghObtenerDocumentoAfiliacion: (payload) => ipcRenderer.invoke('gh:obtener-documento-afiliacion', payload),
  ghAbrirDocumentoAfiliacion: (payload) => ipcRenderer.invoke('gh:abrir-documento-afiliacion', payload),
  // Soportes de Contratación (4) — evidencias adjuntas por paso del pipeline
  ghListarSoportesContratacion: (payload) => ipcRenderer.invoke('gh:listar-soportes-contratacion', payload),
  ghSubirSoportePaso: (payload) => ipcRenderer.invoke('gh:subir-soporte-paso', payload),
  ghAbrirSoportePaso: (payload) => ipcRenderer.invoke('gh:abrir-soporte-paso', payload),
  ghEliminarSoportePaso: (payload) => ipcRenderer.invoke('gh:eliminar-soporte-paso', payload),
  // 📦764 · Templates de Documentos (5) — .docx/.pdf subidos por el user
  ghListTemplates: (payload) => ipcRenderer.invoke('gh:list-templates', payload),
  ghSubirTemplate: (payload) => ipcRenderer.invoke('gh:subir-template', payload),
  ghEliminarTemplate: (payload) => ipcRenderer.invoke('gh:eliminar-template', payload),
  ghObtenerTemplate: (payload) => ipcRenderer.invoke('gh:obtener-template', payload),
  ghAbrirTemplate: (payload) => ipcRenderer.invoke('gh:abrir-template', payload),
  // 📦732 · Import Excel (3)
  ghSelectExcel: (payload) => ipcRenderer.invoke('gh:select-excel', payload),
  ghParseExcel: (payload) => ipcRenderer.invoke('gh:parse-excel', payload),
  ghImportPersonal: (payload) => ipcRenderer.invoke('gh:import-personal', payload),
  // Write Contratación (4)
  ghCreateContratacion: (payload) => ipcRenderer.invoke('gh:create-contratacion', payload),
  ghUpdateContratacion: (payload) => ipcRenderer.invoke('gh:update-contratacion', payload),
  ghDeleteContratacion: (payload) => ipcRenderer.invoke('gh:delete-contratacion', payload),
  ghMarcarPaso: (payload) => ipcRenderer.invoke('gh:marcar-paso', payload),
  // 📦767 · I-103.A1.0-D-2 · Recontratar bp retirado + vincular CT
  ghRecontratarPersonal: (payload) => ipcRenderer.invoke('gh:recontratar-personal', payload),
  // Read adicional FASE 2 (A1.5.4-B) · bp-ids con contratación en_proceso
  ghListTrabajadoresConContratacionActiva: (payload) => ipcRenderer.invoke('gh:list-trabajadores-con-contratacion-activa', payload),
  // Write Personal (4)
  ghCreatePersonal: (payload) => ipcRenderer.invoke('gh:create-personal', payload),
  ghUpdatePersonal: (payload) => ipcRenderer.invoke('gh:update-personal', payload),
  ghDeletePersonal: (payload) => ipcRenderer.invoke('gh:delete-personal', payload),
  ghCambiarEstado: (payload) => ipcRenderer.invoke('gh:cambiar-estado', payload),
  // Write Sedes (2)
  ghCreateSede: (payload) => ipcRenderer.invoke('gh:create-sede', payload),
  ghUpdateSede: (payload) => ipcRenderer.invoke('gh:update-sede', payload),
  // 📦710 (2026-08-15) — Gestión Humana (FASE C: handlers para 6 tablas nuevas)
  // Vacaciones (6)
  ghListVacaciones: (payload) => ipcRenderer.invoke('gh:list-vacaciones', payload),
  ghGetVacacion: (payload) => ipcRenderer.invoke('gh:get-vacacion', payload),
  ghCreateVacacion: (payload) => ipcRenderer.invoke('gh:create-vacacion', payload),
  ghUpdateVacacion: (payload) => ipcRenderer.invoke('gh:update-vacacion', payload),
  ghDeleteVacacion: (payload) => ipcRenderer.invoke('gh:delete-vacacion', payload),
  ghCambiarEstadoVacacion: (payload) => ipcRenderer.invoke('gh:cambiar-estado-vacacion', payload),
  // Permisos (5)
  ghListPermisos: (payload) => ipcRenderer.invoke('gh:list-permisos', payload),
  ghGetPermiso: (payload) => ipcRenderer.invoke('gh:get-permiso', payload),
  ghCreatePermiso: (payload) => ipcRenderer.invoke('gh:create-permiso', payload),
  ghUpdatePermiso: (payload) => ipcRenderer.invoke('gh:update-permiso', payload),
  ghFinalizarPermiso: (payload) => ipcRenderer.invoke('gh:finalizar-permiso', payload),
  // Documentos (5 — LEGACY-SIGN-REMOVE: eliminado ghFirmarDocumento 2026-08-20)
  // La firma canvas operativa interna se reemplazó por firma electrónica
  // vía firma-service. Ver canales firma:* más abajo.
  ghListDocumentos: (payload) => ipcRenderer.invoke('gh:list-documentos', payload),
  ghGetDocumento: (payload) => ipcRenderer.invoke('gh:get-documento', payload),
  // I-103.A1.6 · Consulta mínima de un consentimiento por ID (Fase 3).
  // Usado por el módulo Firma electrónica para obtener correo_verificacion
  // sin pedirlo de nuevo al usuario. Retorna solo campos mínimos.
  ghGetConsentimiento: (consentId, args) => ipcRenderer.invoke('gh:get-consentimiento', Object.assign({ consentId }, args || {})),
  // I-103.A1.6 · Consulta mínima de un sign request por id_solicitud (Fase 3).
  // Complementa firmaSignRequestGet (datos generales) y firmaSignRequestLink
  // (url_publica). Retorna correo_verificacion (de metadata) y fecha_envio
  // (último INVITE_SENT). Lectura READ-ONLY, no modifica firma.sqlite.
  ghGetSignRequest: (id, args) => ipcRenderer.invoke('gh:get-sign-request', Object.assign({ id }, args || {})),
  ghCreateDocumento: (payload) => ipcRenderer.invoke('gh:create-documento', payload),
  ghUpdateDocumento: (payload) => ipcRenderer.invoke('gh:update-documento', payload),
  ghDeleteDocumento: (payload) => ipcRenderer.invoke('gh:delete-documento', payload),
  // 📦764 · Abrir archivo generado del documento
  ghAbrirDocumento: (payload) => ipcRenderer.invoke('gh:abrir-documento', payload),
  // Anuncios (5)
  ghListAnuncios: (payload) => ipcRenderer.invoke('gh:list-anuncios', payload),
  ghGetAnuncio: (payload) => ipcRenderer.invoke('gh:get-anuncio', payload),
  ghCreateAnuncio: (payload) => ipcRenderer.invoke('gh:create-anuncio', payload),
  ghUpdateAnuncio: (payload) => ipcRenderer.invoke('gh:update-anuncio', payload),
  ghDeleteAnuncio: (payload) => ipcRenderer.invoke('gh:delete-anuncio', payload),
  // Mensajes (4)
  ghListMensajes: (payload) => ipcRenderer.invoke('gh:list-mensajes', payload),
  ghGetMensaje: (payload) => ipcRenderer.invoke('gh:get-mensaje', payload),
  ghCreateMensaje: (payload) => ipcRenderer.invoke('gh:create-mensaje', payload),
  ghMarcarLeido: (payload) => ipcRenderer.invoke('gh:marcar-leido', payload),
  // Diag (1)
  ghDiag: () => ipcRenderer.invoke('gh:diag'),

  // 📦101 (2026-08-20) — Firma Electrónica K+AIR v1 (I-101)
  // 13 canales: 4 config + 7 sign-request + 2 consent + 1 agreement
  // Plan: docs/kair-firma-integration/READY-TO-IMPLEMENT.md §D (I-101)
  // Spec: docs/gestion-humana/firma-electronica/API.md
  // Config (4)
  firmaConfigGet: () => ipcRenderer.invoke('firma:config:get'),
  firmaConfigSetApiKey: (apiKey) => ipcRenderer.invoke('firma:config:set-api-key', { apiKey }),
  firmaConfigSetUrl: (url) => ipcRenderer.invoke('firma:config:set-url', { url }),
  firmaConfigDiag: () => ipcRenderer.invoke('firma:config:diag'),
  // Sign request (6)
  firmaSignRequestCreate: (payload) => ipcRenderer.invoke('firma:sign-request:create', payload),
  // I-102.2.D · Lectura de bytes del PDF para calcular document_hash
  firmaDocumentoReadBytes: (args) => {
    // I-103.A1.5.4-B · DIAGNÓSTICO TEMPORAL (visible en DevTools Console)
    try {
      console.log('[A154] preload.firmaDocumentoReadBytes ARGS', JSON.stringify({
        arg_typeof: typeof args,
        arg_isString: typeof args === 'string',
        arg_isObject: (typeof args === 'object' && args !== null),
        arg_length: (typeof args === 'string') ? args.length : 'n/a',
        arg_keys: (typeof args === 'object' && args !== null) ? Object.keys(args) : []
      }));
    } catch (_diagE) { /* noop */ }
    return ipcRenderer.invoke('firma:documento:read-bytes', args || {});
  },
  firmaSignRequestGet: (id, args) => ipcRenderer.invoke('firma:sign-request:get', Object.assign({ id }, args || {})),
  firmaSignRequestList: (ids, args) => ipcRenderer.invoke('firma:sign-request:list', Object.assign({ ids }, args || {})),
  firmaSignRequestDocument: (id, args) => {
    return ipcRenderer.invoke('firma:sign-request:document', Object.assign({ id }, args || {}));
  },
  firmaSignRequestConstancia: (id, args) => ipcRenderer.invoke('firma:sign-request:constancia', Object.assign({ id }, args || {})),
  // I-104 (SaveAs): bridge hace dialog.showSaveDialog, retorna solo la ruta final.
  firmaSignRequestConstanciaSaveAs: (id, args) => ipcRenderer.invoke('firma:sign-request:constancia-save-as', Object.assign({ id }, args || {})),
  // Constancia GENERAL del expediente (SaveAs): `id` = cédula del trabajador.
  // El bridge pide el PDF consolidado (al vuelo) y muestra dialog.showSaveDialog.
  firmaExpedienteConstanciaSaveAs: (id, args) => ipcRenderer.invoke('firma:expediente:constancia-save-as', Object.assign({ id }, args || {})),
  firmaSignRequestLink: (id, args) => ipcRenderer.invoke('firma:sign-request:link', Object.assign({ id }, args || {})),
  // I-103.A1.5.2 · Enviar invitación de firma al firmante por correo.
  // Args: { id: 'SIGN-YYYY-NNNNNN' | <int>, correo: 'firmante@x.com', context?: { ... } }
  firmaSignRequestNotifyRemote: (id, args) => ipcRenderer.invoke('firma:sign-request:notify-remote', Object.assign({ id }, args || {})),
  // I-103.A1.6.B · Reenviar OTP al firmante desde K+AIR (wrapper per-empresa
  // de publicFlow.resendOtp). Body vacío (el backend no requiere params).
  // El renderer habilita este botón solo en estados {OTP_SENT, OTP_LOCKED}
  // y aplica cooldown visual de 60s.
  // Args: { id: 'SIGN-YYYY-NNNNNN' | <int>, companyName?: string, context?: { ... } }
  firmaSignRequestResendOtp: (id, args) => ipcRenderer.invoke('firma:sign-request:resend-otp', Object.assign({ id }, args || {})),
  // Trazabilidad — línea de tiempo de auditoría de la solicitud de firma.
  // Requiere op audit:read. Backend ya redacta secretos de metadata.
  firmaSignRequestEventos: (id, args) => ipcRenderer.invoke('firma:sign-request:eventos', Object.assign({ id }, args || {})),
  // Consent (2)
  firmaConsentCreate: (payload) => ipcRenderer.invoke('firma:consent:create', payload),
  firmaConsentVerifyOtp: (companyName, consentId, otp) => ipcRenderer.invoke('firma:consent:verify-otp', { companyName, consentId, otp }),
  // Agreement (1)
  firmaAgreementGet: (args) => ipcRenderer.invoke('firma:agreement:get', args || {}),

  // --- I-FIRMA-DUAL · v0.1.180 — Representante Legal por empresa ---
  // Bridge: main/empresa-representante-legal-bridge.js (canal 'rep-legal:get').
  // Multi-tenant: el bridge recibe `empresaId` (= company_key).
  // Soft auth: el handler acepta sin token; no se requiere enviar credenciales.
  // Retorna: { success, data: { representante: { id, empresaId, nombre,
  //   tipoIdentificacion, numeroIdentificacion, correo, telefono, cargo,
  //   activo, creadoEn, actualizadoEn } | null } }
  repLegalGet: (empresaId) => ipcRenderer.invoke('rep-legal:get', { empresaId }),

  // 📦 I-FIRMA-DUAL · v0.1.180 — Upsert del Representante Legal.
  // Bridge: main/empresa-representante-legal-bridge.js (canal 'rep-legal:upsert').
  // Input:  { data: { empresaId, nombre, tipoId, numId, correo, telefono?, cargo? } }
  // Output: { success, data: { id, updated: bool } } | { success: false, error }
  repLegalUpsert: (args) => ipcRenderer.invoke('rep-legal:upsert', args || {}),

  // 📦101-extra (2026-08-20) — Per-empresa admin (I-010 per-company authz, AUD-04)
  // 7 canales: 6 firma:empresa:* + 1 firma:config:set-admin-key
  // DR-1..6 binding. Ver storage-backup/specs/kair-auth-spec.md §5.6/5.7
  // y AUD-04 §13. Sin lógica acá: solo delegación ipcRenderer.invoke.
  // Per-empresa (6)
  firmaEmpresaList: (args) => ipcRenderer.invoke('firma:empresa:list', args || {}),
  firmaEmpresaCreate: (args) => ipcRenderer.invoke('firma:empresa:create', args),
  firmaEmpresaSetApiKey: (args) => ipcRenderer.invoke('firma:empresa:set-api-key', args),
  firmaEmpresaRotateApiKey: (args) => ipcRenderer.invoke('firma:empresa:rotate-api-key', args),
  firmaEmpresaRevokeApiKey: (args) => ipcRenderer.invoke('firma:empresa:revoke-api-key', args),
  firmaEmpresaListFirmaRemote: (args) => ipcRenderer.invoke('firma:empresa:list-firma-remote', args || {}),
  // I-104 RECOVERY: lista empresas del backend con metadata no sensible.
  firmaEmpresaListBackend: (args) => ipcRenderer.invoke('firma:empresa:list-backend', args || {}),
  // I-104 RECOVERY: rota una empresa que existe en backend pero no en secrets.enc.
  firmaEmpresaRecoverAndRotate: (args) => ipcRenderer.invoke('firma:empresa:recover-and-rotate', args || {}),
  // Admin token persistido (DR-2)
  firmaConfigSetAdminKey: (adminApiKey) => ipcRenderer.invoke('firma:config:set-admin-key', { adminApiKey }),

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
  // 🆕 Editar/eliminar fila de ausentismo desde la vista "Ver registros"
  updateAusentismoRow: (payload) =>
    ipcRenderer.invoke('update-ausentismo-row', payload),
  deleteAusentismoRow: (payload) =>
    ipcRenderer.invoke('delete-ausentismo-row', payload),
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
  // 📦538 — Eliminar un seguimiento mensual especifico (se propaga via sync multipc)
  gestacionEliminarSeguimiento: (params) =>
    ipcRenderer.invoke('gestacion:eliminarSeguimiento', params),
  // 📦469 — Motor de cálculos para Reportes de Seguimiento (Resumen Ejecutivo / Detallado / Individual)
  gestacionCalcularReporte: (params) =>
    ipcRenderer.invoke('gestacion:calcularReporte', params),
  // 📦469 — Cambio de estado con validación de flujo lineal estricto
  gestacionActualizarEstado: (params) =>
    ipcRenderer.invoke('gestacion:actualizarEstado', params),

  // 📦701 (2026-08-11) — Seguimiento de Incapacidad (respaldo en SQLite).
  // ANTES: el guardado iba directo al Excel (vía Python). AHORA: el guardado
  // va a SQLite (kair.db) como fuente de verdad primaria, y el Excel se
  // exporta después con un botón "Exportar a Excel" (vía `exportarExcel`).
  // Si el Excel se daña, los datos están en SQLite y se pueden re-exportar.
  seguimientoIncapacidad: {
    guardar: (params) => ipcRenderer.invoke('seguimiento-incapacidad:guardar', params),
    listar: (params) => ipcRenderer.invoke('seguimiento-incapacidad:listar', params),
    obtener: (params) => ipcRenderer.invoke('seguimiento-incapacidad:obtener', params),
    // 📦701-fix4 — Buscar casos por cédula para reabrir uno existente
    buscarPorCedula: (params) => ipcRenderer.invoke('seguimiento-incapacidad:buscarPorCedula', params),
    eliminar: (params) => ipcRenderer.invoke('seguimiento-incapacidad:eliminar', params),
    exportarExcel: (params) => ipcRenderer.invoke('seguimiento-incapacidad:exportarExcel', params),
    exportarTodos: (params) => ipcRenderer.invoke('seguimiento-incapacidad:exportarTodos', params)
  },

  // 📦498 — Marcado de eventos del calendario como cumplidos (persistente).
  // Funciona para cualquier tipo de evento del calendario (capacitacion,
  // gestacion, reunion, plan, rapido, etc.). Es solo una marca personal
  // en el calendario — NO impacta los modulos origen.
  eventosCumplidos: {
    listar: (params) => ipcRenderer.invoke('eventos-cumplidos:listar', params),
    marcar: (params) => ipcRenderer.invoke('eventos-cumplidos:marcar', params),
    desmarcar: (params) => ipcRenderer.invoke('eventos-cumplidos:desmarcar', params)
  },
  // 📦705 (2026-08-13) — Roles y Responsabilidades (estándar 1.1.2 Res. 0312 + Dto. 1072)
  rolesResp: {
    listarCatalogo: () => ipcRenderer.invoke('roles-resp:catalogo-listar'),
    crearRol: (payload) => ipcRenderer.invoke('roles-resp:catalogo-crear', payload),
    actualizarRol: (payload) => ipcRenderer.invoke('roles-resp:catalogo-actualizar', payload),
    // 📦706-fix24 (2026-08-14) — Edición de matriz desde la app (3 columnas del Excel)
    actualizarMatriz: (payload) => ipcRenderer.invoke('roles-resp:catalogo-matriz-actualizar', payload),
    desactivarRol: (payload) => ipcRenderer.invoke('roles-resp:catalogo-desactivar', payload),
    listarAsignaciones: (empresaId) => ipcRenderer.invoke('roles-resp:asignacion-listar', { empresaId }),
    upsertAsignacion: (payload) => ipcRenderer.invoke('roles-resp:asignacion-upsert', payload),
    listarDivulgaciones: (empresaId) => ipcRenderer.invoke('roles-resp:divulgacion-listar', { empresaId }),
    upsertDivulgacion: (payload) => ipcRenderer.invoke('roles-resp:divulgacion-upsert', payload),
    eliminarDivulgacion: (id) => ipcRenderer.invoke('roles-resp:divulgacion-eliminar', { id }),
    generarReportePDF: (payload) => ipcRenderer.invoke('roles-resp:reporte-pdf', payload),
    // 📦705-fix8 (2026-08-14) — File dialogs + copia para el modal "Subir soporte"
    seleccionarArchivoOrigen: () => ipcRenderer.invoke('roles-resp:archivo-seleccionar-origen'),
    seleccionarCarpetaDestino: (payload) => ipcRenderer.invoke('roles-resp:archivo-seleccionar-destino', payload || {}),
    copiarArchivo: (payload) => ipcRenderer.invoke('roles-resp:archivo-copiar', payload),
    // 📦705-fix10 (2026-08-14) — Descargar PDF de soporte
    descargarArchivo: (payload) => ipcRenderer.invoke('roles-resp:archivo-descargar', payload),
    // 📦706 (2026-08-14) — Multi-documento por divulgación
    listarDocumentosDivulgacion: (payload) => ipcRenderer.invoke('roles-resp:divulgacion-documento-listar', payload || {}),
    marcarDocumentoActual: (payload) => ipcRenderer.invoke('roles-resp:divulgacion-documento-marcar-actual', payload),
    // 📦706-fix20 (2026-08-14) — Resolver path de carpeta del trabajador
    // (sin crearla). Lo usa el modal "Subir soporte" como destino default.
    resolverCarpetaTrabajador: (payload) => ipcRenderer.invoke('roles-resp:carpeta-trabajador-resolver', payload || {})
  },
  // 📦531 — Persistencia de planes de acción del submódulo 2.3.1 Evaluación
  // Inicial del SG-SST. Antes los planes vivían en memoria y se perdían al
  // cerrar el módulo. Ahora se persisten por (empresaId, year) y se
  // recuperan al abrir el submódulo.
  evaluacionActionPlans: {
    listar: (params) => ipcRenderer.invoke('evaluacion-action-plans:listar', params),
    guardar: (params) => ipcRenderer.invoke('evaluacion-action-plans:guardar', params),
    eliminar: (params) => ipcRenderer.invoke('evaluacion-action-plans:eliminar', params)
  },
  // 📦537 — Sync multipc. Sincroniza datos de una empresa entre varias PCs
  // usando una carpeta compartida (Google Drive por ahora, TrueNAS después).
  // La BD local de cada PC queda intacta; solo se sincroniza un JSON resumen.
  sync: {
    status: (params) => ipcRenderer.invoke('sync:status', params),
    pull: (params) => ipcRenderer.invoke('sync:pull', params),
    push: (params) => ipcRenderer.invoke('sync:push', params),
    start: (params) => ipcRenderer.invoke('sync:start', params),
    stop: (params) => ipcRenderer.invoke('sync:stop', params),
    startAll: () => ipcRenderer.invoke('sync:start-all'),
    stopAll: () => ipcRenderer.invoke('sync:stop-all'),
    configure: (params) => ipcRenderer.invoke('sync:configure', params),
    disable: (params) => ipcRenderer.invoke('sync:disable', params),
    pickFolder: (params) => ipcRenderer.invoke('sync:pick-folder', params)
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
  // 📦522 — Recordatorios mensuales de cumplimiento legal (COPASST).
  // Genera 1 evento por mes en el calendario: "Realizar Acta del COPASST"
  // el dia 1 de cada mes (recordatorio legal Decreto 614/1984, Res. 0312/2019).
  // No depende de la empresa — es global. Acepta rango opcional.
  recordatorios: {
    copasstGetEvents: (params) => ipcRenderer.invoke('recordatorio-copasst:get-events', params),
    // 📦523 — Idem para el Comite de Convivencia (Res. 0312/2019 estandar 6.2.2).
    // Misma logica: 1 evento por mes el dia 1 (movido al lunes si cae en
    // fin de semana). Color cyan #0891b2 para distinguirse del naranja COPASST.
    convivenciaGetEvents: (params) => ipcRenderer.invoke('recordatorio-convivencia:get-events', params),
    // 📦524 — Recordatorio de Actualización de Presupuesto Mensual: 2 eventos
    // por mes (día 5 y día 20, ajustados al lunes si caen en fin de semana).
    // Color emerald #10b981 (verde monetario) para distinguirse del naranja
    // COPASST y cyan Convivencia. Recordatorio OPERATIVO (no legal).
    presupuestoGetEvents: (params) => ipcRenderer.invoke('recordatorio-presupuesto:get-events', params),
    // 📦525 — Recordatorio de Afiliación al SSSI (Sistema de Seguridad Social
    // Integral): 1 evento por mes (día 10, ajustado al lunes si cae en fin
    // de semana). Color amber #f59e0b para distinguirse del resto. Recordatorio
    // LEGAL-OPERATIVO (Ley 100/1993, Decreto 1295/1994, Decreto 806/1998 art. 16).
    afiliacionGetEvents: (params) => ipcRenderer.invoke('recordatorio-afiliacion:get-events', params),
    // 📦525 — Recordatorio de Actualización de Inducciones: 1 evento por mes
    // (día 2, ajustado al lunes si cae en fin de semana). Color indigo #6366f1
    // para distinguirse del resto. Recordatorio LEGAL-OPERATIVO (Decreto
    // 1072/2015 art. 2.2.4.6.11 — todo trabajador nuevo debe recibir inducción
    // antes de iniciar tareas).
    induccionesGetEvents: (params) => ipcRenderer.invoke('recordatorio-inducciones:get-events', params)
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
  // 📦546 — Descarga automática (A). La app detecta update y descarga en background
  // sin requerir click. Esta función queda como FALLBACK por si la auto-descarga
  // falla (poco probable) y el usuario quiere reintentar desde el panel.
  // La instalación al cerrar es automática (C: autoInstallOnAppQuit=true en main).
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  restartApp: () => ipcRenderer.send('restart_app'),
  checkForUpdatesManual: () => ipcRenderer.invoke('check-for-updates-manual'),
  // 📦581 (Loop 9) — Release notes de la última versión de GitHub
  getReleaseNotes: () => ipcRenderer.invoke('get-release-notes'),
  // Acceso directo en escritorio (autoUpdater no lo recrea tras update)
  createDesktopShortcut: () => ipcRenderer.invoke('create-desktop-shortcut'),
  checkDesktopShortcut: () => ipcRenderer.invoke('check-desktop-shortcut'),

  // --- 📦589 (2026-07-23) — Submódulo 3.1.3 Perfiles de Cargo y Profesiograma ---
  // Handlers del bridge `profesiograma-bridge.js` (persistencia SQLite central).
  profesiograma: {
    kpis: () => ipcRenderer.invoke('profesiograma:kpis'),
    matriz: () => ipcRenderer.invoke('profesiograma:matriz'),
    cargosList: () => ipcRenderer.invoke('profesiograma:cargos:list'),
    cargosGet: (id) => ipcRenderer.invoke('profesiograma:cargos:get', { id }),
    cargosSave: (data) => ipcRenderer.invoke('profesiograma:cargos:save', data),
    cargosDelete: (id) => ipcRenderer.invoke('profesiograma:cargos:delete', { id }),
    tipoExamenList: () => ipcRenderer.invoke('profesiograma:tipo-examen:list'),
    tipoExamenSave: (data) => ipcRenderer.invoke('profesiograma:tipo-examen:save', data),
    tipoExamenDelete: (id) => ipcRenderer.invoke('profesiograma:tipo-examen:delete', { id }),
    pruebasList: () => ipcRenderer.invoke('profesiograma:pruebas:list'),
    pruebasSave: (data) => ipcRenderer.invoke('profesiograma:pruebas:save', data),
    pruebasDelete: (id) => ipcRenderer.invoke('profesiograma:pruebas:delete', { id }),
    recomendacionesList: () => ipcRenderer.invoke('profesiograma:recomendaciones:list'),
    recomendacionesSave: (data) => ipcRenderer.invoke('profesiograma:recomendaciones:save', data),
    recomendacionesDelete: (id) => ipcRenderer.invoke('profesiograma:recomendaciones:delete', { id }),
    vacunacionList: () => ipcRenderer.invoke('profesiograma:vacunacion:list'),
    vacunacionSave: (data) => ipcRenderer.invoke('profesiograma:vacunacion:save', data),
    vacunacionDelete: (id) => ipcRenderer.invoke('profesiograma:vacunacion:delete', { id }),
    alturasList: () => ipcRenderer.invoke('profesiograma:alturas:list'),
    alturasSave: (data) => ipcRenderer.invoke('profesiograma:alturas:save', data),
    alturasDelete: (id) => ipcRenderer.invoke('profesiograma:alturas:delete', { id }),
    grupoOcupacionalList: () => ipcRenderer.invoke('profesiograma:grupo-ocupacional:list'),
    grupoOcupacionalSave: (data) => ipcRenderer.invoke('profesiograma:grupo-ocupacional:save', data),
    grupoOcupacionalDelete: (id) => ipcRenderer.invoke('profesiograma:grupo-ocupacional:delete', { id }),
    importExcel: (data) => ipcRenderer.invoke('profesiograma:import-excel', data),
    selectExcel: () => ipcRenderer.invoke('profesiograma:select-excel'),
    selectSavePath: (opts) => ipcRenderer.invoke('profesiograma:select-save-path', opts || {}),
    exportExcel: (data) => ipcRenderer.invoke('profesiograma:export-excel', data),
  },
});
