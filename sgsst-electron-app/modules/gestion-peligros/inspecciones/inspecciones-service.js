/* ==========================================================================
K+AIR — Módulo 4.2.4 Inspecciones Sistemáticas
Servicio frontend — Comunicación con electronAPI + fallback mock para desarrollo
Todos los métodos retornan { success, data?, error? } conforme al contrato estándar.
========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'kair_inspecciones_data';
  var MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  var INSPECTION_TYPES = [
    { code: 'EXTINTOR', name: 'Extintores', format: 'GI-FO-026', icon: 'bi-fire' },
    { code: 'INSTALACION', name: 'Instalaciones', format: 'GI-FO-025', icon: 'bi-building' },
    { code: 'EMERGENCIA', name: 'Equipos de Emergencia', format: 'GI-FO-023', icon: 'bi-exclamation-triangle' },
    { code: 'BOTIQUIN', name: 'Botiquines', format: 'GI-FO-031', icon: 'bi-bandaid' }
  ];

  var SAMPLE_ACTIVITIES = [
    { id: 'act-1', name: 'Inspección de Extintores', type: 'EXTINTOR', frequency: 'Mensual', months: { 0:'c',1:'c',2:'p',3:'c',4:'c',5:'p',6:'c',7:'c',8:null,9:null,10:null,11:null } },
    { id: 'act-2', name: 'Inspección de Instalaciones', type: 'INSTALACION', frequency: 'Trimestral', months: { 0:'c',1:null,2:null,3:'c',4:null,5:null,6:'p',7:null,8:null,9:null,10:null,11:null } },
    { id: 'act-3', name: 'Inspección Equipos de Emergencia', type: 'EMERGENCIA', frequency: 'Semestral', months: { 0:'c',1:null,2:null,3:null,4:null,5:null,6:'p',7:null,8:null,9:null,10:null,11:null } },
    { id: 'act-4', name: 'Inspección de Botiquines', type: 'BOTIQUIN', frequency: 'Trimestral', months: { 0:'c',1:null,2:null,3:'p',4:null,5:null,6:null,7:null,8:null,9:null,10:null,11:null } },
    { id: 'act-5', name: 'Inspección Sede Caribe', type: 'INSTALACION', frequency: 'Mensual', months: { 0:'c',1:'c',2:'c',3:'c',4:'p',5:'c',6:'c',7:'c',8:null,9:null,10:null,11:null } },
    { id: 'act-6', name: 'Inspección Plasdibar', type: 'INSTALACION', frequency: 'Mensual', months: { 0:'c',1:'c',2:'p',3:'c',4:'c',5:'c',6:'p',7:null,8:null,9:null,10:null,11:null } }
  ];

  var SAMPLE_INSPECTIONS = [
    { id: 'insp-001', type: 'EXTINTOR', format: 'GI-FO-026', location: 'Sede Caribe - Piso 1', inspector: 'Carlos Méndez', date: '2026-04-15', status: 'COMPLETED', items: 8, observations: 'Extintor UB-04 requiere recarga' },
    { id: 'insp-002', type: 'INSTALACION', format: 'GI-FO-025', location: 'Sede Caribe - Oficinas', inspector: 'Ana Gutiérrez', date: '2026-04-10', status: 'COMPLETED', items: 25, observations: 'Salida de emergencia bloqueada en piso 2' },
    { id: 'insp-003', type: 'EXTINTOR', format: 'GI-FO-026', location: 'Plasdibar - Área de producción', inspector: 'Carlos Méndez', date: '2026-04-08', status: 'DRAFT', items: 6, observations: '' },
    { id: 'insp-004', type: 'EMERGENCIA', format: 'GI-FO-023', location: 'Bahía - Zona de almacenamiento', inspector: 'Roberto Peña', date: '2026-03-28', status: 'COMPLETED', items: 9, observations: 'Lámpara de emergencia piso 1 sin función' },
    { id: 'insp-005', type: 'BOTIQUIN', format: 'GI-FO-031', location: 'Sede Caribe - Área común', inspector: 'Ana Gutiérrez', date: '2026-03-15', status: 'COMPLETED', items: 15, observations: '3 insumos vencidos reposición solicitada' },
    { id: 'insp-006', type: 'INSTALACION', format: 'GI-FO-025', location: 'Pedicentro', inspector: 'Luis Herrera', date: '2026-02-20', status: 'COMPLETED', items: 20, observations: '' },
    { id: 'insp-007', type: 'EXTINTOR', format: 'GI-FO-026', location: 'Malbec Lalique 2', inspector: 'Carlos Méndez', date: '2026-02-10', status: 'COMPLETED', items: 4, observations: 'Todos en buen estado' },
    { id: 'insp-008', type: 'INSTALACION', format: 'GI-FO-025', location: 'Testarosa', inspector: 'Ana Gutiérrez', date: '2026-01-25', status: 'COMPLETED', items: 18, observations: 'Pintura demarcación pasillos desgastada' }
  ];

  var SAMPLE_EXTINTOR_TEMPLATE = {
    code: 'GI-FO-026',
    name: 'Inspección de Extintores',
    type: 'EXTINTOR',
    structure: {
      headerRows: [
        { cells: [{ col: 'A', label: 'UBICACIÓN' },{ col: 'B', label: 'TIPO' },{ col: 'C', label: 'CAPACIDAD' },{ col: 'D', label: 'FABRICACIÓN' },{ col: 'E', label: 'VENCIMIENTO' },{ col: 'F', label: 'PRESIÓN' },{ col: 'G', label: 'MANÓMETRO' },{ col: 'H', label: 'MANGUERA' },{ col: 'I', label: 'SEGURO' },{ col: 'J', label: 'ETIQUETA' },{ col: 'K', label: 'SEÑALIZACIÓN' },{ col: 'L', label: 'OBSERVACIONES' }] }
      ],
      dataStartRow: 12,
      dataEndRow: 19
    },
    items: [
      { row: 12, ubicacion: 'Piso 1 - Recepción', tipo: 'ABC', capacidad: '5 kg', fabricacion: '2023', vencimiento: '2028', presion: 'OK', manometro: 'BUENO', manguera: 'BUENO', seguro: 'BUENO', etiqueta: 'BUENO', senalizacion: 'BUENO', observaciones: '' },
      { row: 13, ubicacion: 'Piso 1 - Cocina', tipo: 'K', capacidad: '6 kg', fabricacion: '2022', vencimiento: '2027', presion: 'OK', manometro: 'BUENO', manguera: 'BUENO', seguro: 'BUENO', etiqueta: 'REGULAR', senalizacion: 'BUENO', observaciones: 'Etiqueta parcialmente legible' },
      { row: 14, ubicacion: 'Piso 2 - Oficinas', tipo: 'ABC', capacidad: '5 kg', fabricacion: '2024', vencimiento: '2029', presion: 'OK', manometro: 'BUENO', manguera: 'BUENO', seguro: 'BUENO', etiqueta: 'BUENO', senalizacion: 'REGULAR', observaciones: 'Señalización baja' },
      { row: 15, ubicacion: 'Piso 2 - Sala de servidores', tipo: 'CO2', capacidad: '5 kg', fabricacion: '2023', vencimiento: '2028', presion: 'BAJO', manometro: 'MALO', manguera: 'BUENO', seguro: 'BUENO', etiqueta: 'BUENO', senalizacion: 'BUENO', observaciones: 'Recarga urgente' },
      { row: 16, ubicacion: 'Piso 3 - Área común', tipo: 'ABC', capacidad: '5 kg', fabricacion: '2021', vencimiento: '2026', presion: 'OK', manometro: 'BUENO', manguera: 'BUENO', seguro: 'BUENO', etiqueta: 'BUENO', senalizacion: 'BUENO', observaciones: '' },
      { row: 17, ubicacion: 'Sótano - Parqueadero', tipo: 'ABC', capacidad: '10 kg', fabricacion: '2022', vencimiento: '2027', presion: 'OK', manometro: 'BUENO', manguera: 'REGULAR', seguro: 'BUENO', etiqueta: 'BUENO', senalizacion: 'BUENO', observaciones: 'Manguera con grieta leve' },
      { row: 18, ubicacion: 'Terraza', tipo: 'ABC', capacidad: '5 kg', fabricacion: '2020', vencimiento: '2025', presion: 'BAJO', manometro: 'MALO', manguera: 'MALO', seguro: 'REGULAR', etiqueta: 'MALO', senalizacion: 'MALO', observaciones: 'Reemplazo inmediato' },
      { row: 19, ubicacion: 'Bodega', tipo: 'K', capacidad: '9 kg', fabricacion: '2023', vencimiento: '2028', presion: 'OK', manometro: 'BUENO', manguera: 'BUENO', seguro: 'BUENO', etiqueta: 'BUENO', senalizacion: 'BUENO', observaciones: '' }
    ],
    validationRules: {
      presion: ['OK', 'BAJO', 'N/A'],
      estado: ['BUENO', 'MALO', 'N/A', 'REGULAR']
    }
  };

  function _loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  function _saveToStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function _initData() {
    var existing = _loadFromStorage();
    if (existing && existing.inspections) return existing;
    var data = {
      inspections: SAMPLE_INSPECTIONS.slice(),
      activities: SAMPLE_ACTIVITIES.slice(),
      templates: { EXTINTOR: SAMPLE_EXTINTOR_TEMPLATE }
    };
    _saveToStorage(data);
    return data;
  }

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
      var data = _initData();
      var inspections = data.inspections;
      var completed = inspections.filter(function (i) { return i.status === 'COMPLETED'; }).length;
      var currentMonth = new Date().getMonth();
      var pendingThisMonth = data.activities.filter(function (a) {
        return a.months[currentMonth] === 'p';
      }).length;
      var totalProgrammed = data.activities.reduce(function (sum, a) {
        return sum + Object.values(a.months).filter(function (v) { return v === 'c' || v === 'p'; }).length;
      }, 0);
      var totalCompleted = data.activities.reduce(function (sum, a) {
        return sum + Object.values(a.months).filter(function (v) { return v === 'c'; }).length;
      }, 0);
      var rate = totalProgrammed > 0 ? Math.round((totalCompleted / totalProgrammed) * 100) : 0;
      var vigentes = 0;
      var currentYear = new Date().getFullYear();
      if (data.templates && data.templates.EXTINTOR && data.templates.EXTINTOR.items) {
        vigentes = data.templates.EXTINTOR.items.filter(function (item) {
          return parseInt(item.vencimiento) >= currentYear;
        }).length;
      }
      return Promise.resolve({
        success: true,
        data: {
          totalInspecciones: inspections.length,
          completadas: completed,
          pendientesMes: pendingThisMonth,
          tasaCumplimiento: rate,
          extintoresVigentes: vigentes,
          extintoresTotal: data.templates && data.templates.EXTINTOR ? data.templates.EXTINTOR.items.length : 0
        }
      });
    },

    getSchedule: function (companyName, year) {
      if (_hasElectronAPI()) {
        return window.electronAPI.inspecciones.getSchedule(companyName, year || new Date().getFullYear());
      }
      var data = _initData();
      var activities = data.activities;
      var totalC = 0, totalP = 0;
      activities.forEach(function (a) {
        Object.values(a.months).forEach(function (v) {
          if (v === 'c') totalC++;
          else if (v === 'p') totalP++;
        });
      });
      var total = totalC + totalP;
      return Promise.resolve({
        success: true,
        data: {
          year: year || new Date().getFullYear(),
          activities: activities,
          kpis: {
            indicator: total > 0 ? Math.round((totalC / total) * 100) : 0,
            completed: totalC,
            pending: totalP,
            total: total
          }
        }
      });
    },

    updateMonth: function (companyName, activityId, month, status) {
      if (_hasElectronAPI()) {
        return window.electronAPI.inspecciones.updateMonth(companyName, activityId, month, status);
      }
      var data = _initData();
      var activity = data.activities.find(function (a) { return a.id === activityId; });
      if (activity) {
        activity.months[month] = status || null;
        _saveToStorage(data);
      }
      var totalC = 0, totalP = 0;
      data.activities.forEach(function (a) {
        Object.values(a.months).forEach(function (v) {
          if (v === 'c') totalC++;
          else if (v === 'p') totalP++;
        });
      });
      var total = totalC + totalP;
      return Promise.resolve({
        success: true,
        data: {
          year: new Date().getFullYear(),
          activities: data.activities,
          kpis: {
            indicator: total > 0 ? Math.round((totalC / total) * 100) : 0,
            completed: totalC,
            pending: totalP,
            total: total
          }
        }
      });
    },

    readExcel: function (companyName, type) {
      if (_hasElectronAPI()) {
        return window.electronAPI.inspecciones.readExcel(companyName, type);
      }
      var data = _initData();
      var template = data.templates && data.templates[type];
      if (template) {
        return Promise.resolve({ success: true, data: template });
      }
      return Promise.resolve({
        success: false,
        error: { code: 'TEMPLATE_NOT_FOUND', message: 'No se encontró la plantilla para el tipo: ' + type }
      });
    },

    writeExcel: function (companyName, type, formData) {
      if (_hasElectronAPI()) {
        return window.electronAPI.inspecciones.writeExcel(companyName, type, formData);
      }
      var data = _initData();
      if (type === 'EXTINTOR' && data.templates && data.templates.EXTINTOR) {
        data.templates.EXTINTOR.items = formData.items || data.templates.EXTINTOR.items;
        _saveToStorage(data);
        return Promise.resolve({
          success: true,
          data: { filePath: 'local-storage', saved: true, rowCount: (formData.items || []).length }
        });
      }
      return Promise.resolve({
        success: false,
        error: { code: 'WRITE_FAILED', message: 'No se pudo guardar el formulario' }
      });
    },

    getTemplate: function (companyName, type) {
      if (_hasElectronAPI()) {
        return window.electronAPI.inspecciones.getTemplate(companyName, type);
      }
      var data = _initData();
      var tpl = data.templates && data.templates[type];
      if (tpl) {
        return Promise.resolve({ success: true, data: tpl });
      }
      return Promise.resolve({
        success: false,
        error: { code: 'TEMPLATE_NOT_FOUND', message: 'Plantilla no encontrada para: ' + type }
      });
    },

    listInspections: function (companyName, filters) {
      if (_hasElectronAPI()) {
        return window.electronAPI.inspecciones.listInspections(companyName, filters || {});
      }
      var data = _initData();
      var results = data.inspections.slice();
      if (filters) {
        if (filters.type) results = results.filter(function (i) { return i.type === filters.type; });
        if (filters.status) results = results.filter(function (i) { return i.status === filters.status; });
        if (filters.dateFrom) results = results.filter(function (i) { return i.date >= filters.dateFrom; });
        if (filters.dateTo) results = results.filter(function (i) { return i.date <= filters.dateTo; });
        if (filters.search) {
          var s = filters.search.toLowerCase();
          results = results.filter(function (i) {
            return i.location.toLowerCase().indexOf(s) !== -1 ||
                   i.inspector.toLowerCase().indexOf(s) !== -1 ||
                   i.observations.toLowerCase().indexOf(s) !== -1;
          });
        }
      }
      return Promise.resolve({ success: true, data: { items: results, total: results.length } });
    },

    getInspection: function (companyName, id) {
      if (_hasElectronAPI()) {
        return window.electronAPI.inspecciones.getInspection(companyName, id);
      }
      var data = _initData();
      var insp = data.inspections.find(function (i) { return i.id === id; });
      if (insp) {
        return Promise.resolve({ success: true, data: insp });
      }
      return Promise.resolve({
        success: false,
        error: { code: 'INSPECTION_NOT_FOUND', message: 'Inspección no encontrada: ' + id }
      });
    },

    createInspection: function (companyName, inspectionData) {
      if (_hasElectronAPI()) {
        return window.electronAPI.inspecciones.createInspection(companyName, inspectionData);
      }
      var data = _initData();
      var newInsp = {
        id: 'insp-' + Date.now(),
        type: inspectionData.type || 'EXTINTOR',
        format: inspectionData.format || 'GI-FO-026',
        location: inspectionData.location || '',
        inspector: inspectionData.inspector || '',
        date: inspectionData.date || new Date().toISOString().slice(0, 10),
        status: inspectionData.status || 'DRAFT',
        items: inspectionData.items || 0,
        observations: inspectionData.observations || ''
      };
      data.inspections.unshift(newInsp);
      _saveToStorage(data);
      return Promise.resolve({ success: true, data: newInsp });
    },

    deleteInspection: function (companyName, id) {
      if (_hasElectronAPI()) {
        return window.electronAPI.inspecciones.deleteInspection(companyName, id);
      }
      var data = _initData();
      data.inspections = data.inspections.filter(function (i) { return i.id !== id; });
      _saveToStorage(data);
      return Promise.resolve({ success: true, data: { deleted: true, id: id } });
    },

    getTypeLabel: function (code) {
      var t = INSPECTION_TYPES.find(function (tp) { return tp.code === code; });
      return t ? t.name : code;
    },

    getTypeIcon: function (code) {
      var t = INSPECTION_TYPES.find(function (tp) { return tp.code === code; });
      return t ? t.icon : 'bi-clipboard-check';
    },

    getStatusLabel: function (status) {
      switch (status) {
        case 'COMPLETED': return 'Completada';
        case 'DRAFT': return 'Borrador';
        case 'IN_PROGRESS': return 'En Progreso';
        default: return status;
      }
    },

    getStatusVariant: function (status) {
      switch (status) {
        case 'COMPLETED': return 'success';
        case 'DRAFT': return 'warning';
        case 'IN_PROGRESS': return 'info';
        default: return 'secondary';
      }
    }
  };

  window.InspeccionesService = InspeccionesService;
})();
