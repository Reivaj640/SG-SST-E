(function () {
'use strict';

var MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

var INSPECTION_TYPES = [
  { code: 'EXTINTOR', name: 'Extintores', format: 'GI-FO-026', icon: 'bi-fire' },
  { code: 'INSTALACION', name: 'Instalaciones', format: 'GI-FO-025', icon: 'bi-building' },
  { code: 'EMERGENCIA', name: 'Equipos de Emergencia', format: 'GI-FO-023', icon: 'bi-exclamation-triangle' },
  { code: 'BOTIQUIN', name: 'Botiquines', format: 'GI-FO-031', icon: 'bi-bandaid' }
];

function _hasElectronAPI() {
  return window.electronAPI && window.electronAPI.inspecciones && typeof window.electronAPI.inspecciones.getStats === 'function';
}

function _toast(message, type) {
  var mappedType = type === 'error' ? 'danger' : (type || 'info');
  if (window.KAIRUtils && typeof window.KAIRUtils.showToast === 'function') {
    window.KAIRUtils.showToast(message, mappedType);
  } else {
    console.log('[4.2.4] ' + mappedType.toUpperCase() + ': ' + message);
  }
}

var InspeccionesService = {

  MONTHS: MONTHS,
  TYPES: INSPECTION_TYPES,
  toast: _toast,

  getStats: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.getStats(companyName);
    }
    return Promise.resolve({
      success: true,
      data: { totalInspecciones: 0, completadas: 0, pendientesMes: 0, tasaCumplimiento: 0, extintoresVigentes: 0, extintoresTotal: 0 }
    });
  },

  getSchedule: function (companyName, year) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.getSchedule(companyName, year || new Date().getFullYear());
    }
    return Promise.resolve({
      success: true,
      data: { year: year || new Date().getFullYear(), activities: [], kpis: { indicator: 0, completed: 0, pending: 0, total: 0, realizadas: 0, sinRealizar: 0 } }
    });
  },

  updateMonth: function (companyName, activityId, month, status) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.updateMonth(companyName, activityId, month, status);
    }
    return Promise.resolve({ success: true, data: null });
  },

  updateField: function (companyName, activityId, field, value) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.updateField(companyName, activityId, field, value);
    }
    return Promise.resolve({ success: true, data: null });
  },

  readExcel: function (companyName, type) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.readExcel(companyName, type);
    }
    return Promise.resolve({
      success: false,
      error: { code: 'NO_API', message: 'electronAPI no disponible. Conecte la app para leer archivos Excel.' }
    });
  },

  writeExcel: function (companyName, type, formData) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.writeExcel(companyName, type, formData);
    }
    return Promise.resolve({
      success: false,
      error: { code: 'NO_API', message: 'electronAPI no disponible. Conecte la app para guardar en Excel.' }
    });
  },

  writeHeader: function (companyName, type, headerData) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.writeHeader(companyName, type, headerData);
    }
    return Promise.resolve({
      success: false,
      error: { code: 'NO_API', message: 'electronAPI no disponible.' }
    });
  },

  getTemplate: function (companyName, type) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.getTemplate(companyName, type);
    }
    return Promise.resolve({
      success: false,
      error: { code: 'NO_API', message: 'electronAPI no disponible.' }
    });
  },

  listFiles: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.listFiles(companyName);
    }
    return Promise.resolve({ success: true, data: { files: [] } });
  },

  getFileMetadata: function (companyName, filePath) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.getFileMetadata(companyName, filePath);
    }
    return Promise.resolve({
      success: false,
      error: { code: 'NO_API', message: 'electronAPI no disponible.' }
    });
  },

  listInspections: function (companyName, filters) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.listInspections(companyName, filters || {});
    }
    return Promise.resolve({ success: true, data: { items: [], total: 0 } });
  },

  getInspection: function (companyName, filePath) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.getInspection(companyName, filePath);
    }
    return Promise.resolve({
      success: false,
      error: { code: 'NO_API', message: 'electronAPI no disponible.' }
    });
  },

  deleteInspection: function (companyName, filePath) {
    if (_hasElectronAPI()) {
      return window.electronAPI.inspecciones.deleteInspection(companyName, filePath);
    }
    return Promise.resolve({
      success: false,
      error: { code: 'NO_API', message: 'electronAPI no disponible.' }
    });
  },

  getTypeLabel: function (code) {
    var t = INSPECTION_TYPES.find(function (tp) { return tp.code === code; });
    return t ? t.name : code;
  },

  getTypeIcon: function (code) {
    var t = INSPECTION_TYPES.find(function (tp) { return tp.code === code; });
    return t ? t.icon : 'bi-clipboard-check';
  },

  getTypeByCode: function (formatCode) {
    var t = INSPECTION_TYPES.find(function (tp) { return tp.format === formatCode; });
    return t ? t.code : null;
  }
};

window.InspeccionesService = InspeccionesService;
})();
