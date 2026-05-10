/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
Service — Capa de acceso a datos vía IPC
========================================================================== */
(function () {
'use strict';

function _hasElectronAPI() {
  return window.electronAPI && window.electronAPI.matrizPeligros;
}

function _toast(message, type) {
  var existing = document.getElementById('kair-mp-toast');
  if (existing) existing.remove();

  var div = document.createElement('div');
  div.id = 'kair-mp-toast';
  div.className = 'kair-mp-toast kair-mp-toast--' + (type || 'success');
  var icon = type === 'error' ? '<i class="bi bi-x-circle-fill"></i>' : '<i class="bi bi-check-circle-fill"></i>';
  div.innerHTML = icon + ' ' + message;
  document.body.appendChild(div);

  setTimeout(function () {
    div.classList.add('kair-mp-toast--hide');
    setTimeout(function () { div.remove(); }, 400);
  }, 4500);
}

var _mockMatriz = {
  version: 1,
  companyName: 'Demo',
  lastModified: new Date().toISOString(),
  metadata: { formatCode: 'GI-FO-019', version: 'V0', elaborado: '', revisado: '', aprobado: '', fecha: '' },
  _nextId: 10,
  sedes: [
    {
      id: 'sed_1', nombre: 'Sede Principal',
      procesos: [
        {
          id: 'pro_1', nombre: 'Administrativo',
          cargos: [
            {
              id: 'car_1', nombre: 'Auxiliar Administrativo', zona: '', actividades: '', tareas: '', rutinaria: null,
              peligros: [
        { id: 'pel_1', tipo: 'Físico', peligro: 'Ruido', efectosPosibles: 'Pérdida auditiva', nd: 2, ne: 3, nc: 20, expuestos: 5, criterioEstablecido: 'Res. 0312/2019', fuente: 'Equipos de aire acondicionado', medio: 'Oficina sin aislamiento', individuo: 'Trabajador expuesto 8h/día', medidasExistenteFuente: 'Mantenimiento preventivo', medidasExistenteMedio: 'Tabique separador', medidasExistenteIndividuo: 'EPP (tapabocas)', medidasIntervencion: 'Instalar cabinas insonorizadas', peorConsecuencia: 'Sordera profesional', responsable: 'Coordinador SST', plazo: '2026-Q3', observaciones: '' },
          { id: 'pel_2', tipo: 'Ergonómico', peligro: 'Postura prolongada', efectosPosibles: 'Lumbalgia', nd: 2, ne: 4, nc: 20, expuestos: 5, criterioEstablecido: 'Res. 0312/2019', fuente: 'Silla inadecuada', medio: 'Puesto de trabajo', individuo: 'Trabajador 8h sentado', medidasExistenteFuente: '', medidasExistenteMedio: '', medidasExistenteIndividuo: 'Silla ergonómica', medidasIntervencion: 'Pausas activas cada 2h', peorConsecuencia: 'Hernia discal', responsable: 'Coordinador SST', plazo: '2026-Q2', observaciones: '' }
              ]
            }
          ]
        },
        {
          id: 'pro_2', nombre: 'Operativo',
          cargos: [
            {
              id: 'car_2', nombre: 'Operario de Campo', zona: '', actividades: '', tareas: '', rutinaria: null,
              peligros: [
                { id: 'pel_3', tipo: 'Químico', peligro: 'Sustancias químicas', efectosPosibles: 'Irritación dérmica', nd: 1, ne: 2, nc: 60, expuestos: 3, criterioEstablecido: 'Res. 0312/2019', fuente: 'Productos de limpieza', medio: 'Área de almacenamiento', individuo: 'Trabajador sin guantes', medidasExistenteFuente: 'Etiquetado', medidasExistenteMedio: 'Ventilación', medidasExistenteIndividuo: 'EPP (guantes)', medidasIntervencion: 'Sustituir por productos menos agresivos', peorConsecuencia: 'Quemadura química', responsable: 'Supervisor', plazo: '2026-Q4', observaciones: '' }
              ]
            }
          ]
        }
      ]
    }
  ]
};

var _mockStats = {
  total: 3,
  totalSedes: 1,
  totalProcesos: 2,
  totalCargos: 2,
  evaluados: 3,
  tasaEvaluados: 100,
  porAcept: { I: 0, II: 1, III: 2, IV: 0, V: 0 },
  porTipo: { Físico: 1, Ergonómico: 1, Químico: 1 },
  porSede: { 'Sede Principal': 3 },
  porCargo: { 'Auxiliar Administrativo@@Sede Principal': 2, 'Operario de Campo@@Sede Principal': 1 },
  maxNR: 160,
  inaceptables: 0,
  tasaInaceptable: 0
};

var IdentificacionPeligrosService = {
  TIPOS_PELIGRO: ['Físico', 'Químico', 'Biológico', 'Psicosocial', 'Ergonómico', 'Mecánico', 'Eléctrico', 'Locativo', 'Fenómenos Naturales', 'Público'],

  read: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.read(companyName);
    }
    return Promise.resolve({ success: true, data: { matriz: _mockMatriz, stats: _mockStats } });
  },

  save: function (companyName, data) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.save(companyName, data);
    }
    _toast('Guardado (mock)', 'success');
    return Promise.resolve({ success: true, data: { matriz: _mockMatriz } });
  },

  addSede: function (companyName, nombre) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.addSede(companyName, nombre);
    }
    return Promise.resolve({ success: true, data: { id: 'sed_' + Date.now(), nombre: nombre } });
  },

  addProceso: function (companyName, sedeId, nombre) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.addProceso(companyName, sedeId, nombre);
    }
    return Promise.resolve({ success: true, data: { id: 'pro_' + Date.now(), nombre: nombre } });
  },

  addCargo: function (companyName, procesoId, nombre) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.addCargo(companyName, procesoId, nombre);
    }
    return Promise.resolve({ success: true, data: { id: 'car_' + Date.now(), nombre: nombre } });
  },

  addPeligro: function (companyName, cargoId, data) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.addPeligro(companyName, cargoId, data);
    }
    return Promise.resolve({ success: true, data: { id: 'pel_' + Date.now(), nd: null, ne: null, nc: null, np: null, nr: null, npInterpretacion: '', nrNivel: '', nrLabel: '', nrColor: '' } });
  },

  updatePeligro: function (companyName, peligroId, cambios) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.updatePeligro(companyName, peligroId, cambios);
    }
    return Promise.resolve({ success: true, data: { id: peligroId, nd: cambios.nd, ne: cambios.ne, nc: cambios.nc, np: (cambios.nd || 0) * (cambios.ne || 0), nr: 0, npInterpretacion: '', nrNivel: '', nrLabel: '', nrColor: '' } });
  },

  deletePeligro: function (companyName, peligroId) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.deletePeligro(companyName, peligroId);
    }
    return Promise.resolve({ success: true });
  },

  deleteCargo: function (companyName, cargoId) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.deleteCargo(companyName, cargoId);
    }
    return Promise.resolve({ success: true });
  },

  deleteProceso: function (companyName, procesoId) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.deleteProceso(companyName, procesoId);
    }
    return Promise.resolve({ success: true });
  },

  deleteSede: function (companyName, sedeId) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.deleteSede(companyName, sedeId);
    }
    return Promise.resolve({ success: true });
  },

  renameSede: function (companyName, sedeId, nombre) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.renameSede(companyName, sedeId, nombre);
    }
    return Promise.resolve({ success: true });
  },

  renameProceso: function (companyName, procesoId, nombre) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.renameProceso(companyName, procesoId, nombre);
    }
    return Promise.resolve({ success: true });
  },

  renameCargo: function (companyName, cargoId, nombre) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.renameCargo(companyName, cargoId, nombre);
    }
    return Promise.resolve({ success: true });
  },

  updateCargo: function (companyName, cargoId, cambios) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.updateCargo(companyName, cargoId, cambios);
    }
    return Promise.resolve({ success: true });
  },

  stats: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.stats(companyName);
    }
    return Promise.resolve({ success: true, data: _mockStats });
  },

  heatmap: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.heatmap(companyName);
    }
    return Promise.resolve({ success: true, data: [] });
  },

  priorizacion: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.priorizacion(companyName);
    }
    return Promise.resolve({ success: true, data: [] });
  },

  metadata: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.metadata(companyName);
    }
    return Promise.resolve({ success: true, data: _mockMatriz.metadata });
  },

  updateMetadata: function (companyName, metadata) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.updateMetadata(companyName, metadata);
    }
    return Promise.resolve({ success: true });
  },

  notasAnaliticas: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.notasAnaliticas(companyName);
    }
    return Promise.resolve({ success: true, data: ['Datos mock — 3 peligros identificados.', 'El tipo de peligro más frecuente es "Físico" con 1 registros.'] });
  },

  gtc45Options: function () {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.gtc45Options();
    }
    return Promise.resolve({
      success: true,
      data: {
        nd: [
          { value: 0, label: 'Muy Alto' }, { value: 1, label: 'Alto' },
          { value: 2, label: 'Medio' }, { value: 3, label: 'Bajo' },
          { value: 4, label: 'Muy Bajo' }, { value: 5, label: 'No existe' }
        ],
        ne: [
          { value: 1, label: 'Esporádica' }, { value: 2, label: 'Intermitente' },
          { value: 3, label: 'Permanente' }, { value: 4, label: 'Continua' }
        ],
        nc: [
          { value: 10, label: 'Lesiones sin incapacidad' }, { value: 20, label: 'Incapacidad temporal' },
          { value: 40, label: 'Incapacidad permanente parcial' }, { value: 60, label: 'Incapacidad permanente total' },
          { value: 80, label: 'Muerte' }, { value: 100, label: 'Muerte múltiple' }
        ],
        tipos: IdentificacionPeligrosService.TIPOS_PELIGRO
      }
    });
  },

  discoverXlsx: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.discoverXlsx(companyName);
    }
    return Promise.resolve({ success: true, data: { found: false, filePath: null, fileName: null } });
  },

  importXlsx: function (companyName, filePath) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.importXlsx(companyName, filePath);
    }
    return Promise.resolve({ success: true, data: { rowsImported: 0, sedesCreated: 0, procesosCreated: 0, cargosCreated: 0, errors: [] } });
  },

  syncXlsx: function (companyName) {
    if (_hasElectronAPI()) {
      return window.electronAPI.matrizPeligros.syncXlsx(companyName);
    }
    return Promise.resolve({ success: false });
  },

  toast: _toast,

  getColorForNivel: function (nivel) {
    switch (nivel) {
      case 'I': return '#1b5e20';
      case 'II': return '#f57f17';
      case 'III': return '#e65100';
      case 'IV': return '#b71c1c';
      case 'V': return '#4a148c';
      default: return '#6b7280';
    }
  },

  getColorName: function (colorName) {
    switch (colorName) {
      case 'verde': return '#1b5e20';
      case 'amarillo': return '#f57f17';
      case 'naranja': return '#e65100';
      case 'rojo': return '#b71c1c';
      case 'morado': return '#4a148c';
      default: return '#6b7280';
    }
  }
};

window.IdentificacionPeligrosService = IdentificacionPeligrosService;
})();
