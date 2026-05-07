/* ==========================================================================
K+AIR — Módulo 4.2.5 Mantenimiento Periódico
Service — Capa de acceso a datos vía IPC
========================================================================== */
(function () {
 'use strict';

 var MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
 ];

 var FREQUENCIES = ['Diaria','Semanal','Quincenal','Mensual','Bimestral','Trimestral','Semestral','Anual'];

 function _hasElectronAPI() {
  return window.electronAPI && window.electronAPI.mantenimiento;
 }

 function _toast(message, type) {
  var existing = document.getElementById('kair-mnt-toast');
  if (existing) existing.remove();

  var div = document.createElement('div');
  div.id = 'kair-mnt-toast';
  div.className = 'kair-mnt-toast kair-mnt-toast--' + (type || 'success');
  var icon = type === 'error' ? '<i class="bi bi-x-circle-fill"></i>' : '<i class="bi bi-check-circle-fill"></i>';
  div.innerHTML = icon + ' ' + message;
  document.body.appendChild(div);

  setTimeout(function () {
   div.classList.add('kair-mnt-toast--hide');
   setTimeout(function () { div.remove(); }, 400);
  }, 4500);
 }

 var MantenimientoService = {
  MONTHS: MONTHS,
  FREQUENCIES: FREQUENCIES,

  read: function (companyName) {
   if (_hasElectronAPI()) {
    return window.electronAPI.mantenimiento.read(companyName);
   }
   return Promise.resolve({
    success: true,
    data: {
     header: { process: 'Gestión de Sistemas', title: 'CRONOGRAMA DE MANTENIMIENTO PREVENTIVO', code: 'GS-FO-008', year: new Date().getFullYear() },
     items: [
      { rowIndex: 9, item: 'COMPUTADORES', _category: 'COMPUTADORES', instalacion: 'Dpto. Gerencia', codigo: '', responsable: 'Pedro Marañon', diagnostico: 'Mantenimiento Preventivo', actividades: '', frecuencia: 'Anual', months: { Enero: { MPP: false, MPE: false, MPC: false }, Febrero: { MPP: false, MPE: false, MPC: false }, Marzo: { MPP: false, MPE: false, MPC: false }, Abril: { MPP: true, MPE: false, MPC: false }, Mayo: { MPP: false, MPE: false, MPC: false }, Junio: { MPP: false, MPE: false, MPC: false }, Julio: { MPP: false, MPE: false, MPC: false }, Agosto: { MPP: false, MPE: false, MPC: false }, Septiembre: { MPP: false, MPE: false, MPC: false }, Octubre: { MPP: true, MPE: false, MPC: false }, Noviembre: { MPP: false, MPE: false, MPC: false }, Diciembre: { MPP: false, MPE: false, MPC: false } }, costo: null },
      { rowIndex: 10, item: 'COMPUTADORES', _category: 'COMPUTADORES', instalacion: 'Dpto. Cartera', codigo: '', responsable: 'Pedro Marañon', diagnostico: 'Mantenimiento Preventivo', actividades: '', frecuencia: 'Anual', months: {}, costo: null }
     ],
     categories: ['COMPUTADORES', 'IMPRESORAS', 'A. ACONDICIONADO'],
     totalRows: 30, totalCols: 49
    }
   });
  },

  save: function (companyName, items) {
   if (_hasElectronAPI()) {
    return window.electronAPI.mantenimiento.save(companyName, items);
   }
   _toast('Guardado (mock)', 'success');
   return Promise.resolve({ success: true, data: { message: 'Guardado mock', itemsUpdated: items.length } });
  },

  toggleMonth: function (companyName, rowIndex, month, type, value) {
   if (_hasElectronAPI()) {
    return window.electronAPI.mantenimiento.toggleMonth(companyName, rowIndex, month, type, value);
   }
   return Promise.resolve({ success: true, data: { message: 'Toggle mock' } });
  },

  updateField: function (companyName, rowIndex, field, value) {
   if (_hasElectronAPI()) {
    return window.electronAPI.mantenimiento.updateField(companyName, rowIndex, field, value);
   }
   return Promise.resolve({ success: true, data: { message: 'Update mock' } });
  },

  addRow: function (companyName, itemData) {
   if (_hasElectronAPI()) {
    return window.electronAPI.mantenimiento.addRow(companyName, itemData);
   }
   return Promise.resolve({ success: true, data: { message: 'Row added mock', newRowIndex: 99 } });
  },

  saveEvidence: function (companyName, evidenceData) {
   if (_hasElectronAPI()) {
    return window.electronAPI.mantenimiento.saveEvidence(companyName, evidenceData);
   }
   return Promise.resolve({ success: true, data: { id: 'mock', itemRowIndex: evidenceData.itemRowIndex, fileName: evidenceData.fileName, filePath: 'mock', fileSize: 0, createdAt: new Date().toISOString() } });
  },

  readEvidenceFile: function (companyName, fileName) {
   if (_hasElectronAPI()) {
    return window.electronAPI.mantenimiento.readEvidenceFile(companyName, fileName);
   }
   return Promise.resolve({ success: true, data: { buffer: '', fileName: fileName, mimeType: 'image/png' } });
  },

  deleteEvidence: function (companyName, fileName) {
   if (_hasElectronAPI()) {
    return window.electronAPI.mantenimiento.deleteEvidence(companyName, fileName);
   }
   return Promise.resolve({ success: true, data: { message: 'Deleted mock' } });
  },

  listEvidences: function (companyName, rowIndex) {
   if (_hasElectronAPI()) {
    return window.electronAPI.mantenimiento.listEvidences(companyName, rowIndex);
   }
   return Promise.resolve({ success: true, data: [] });
  },

  toast: _toast,

  getFrequencyIcon: function (freq) {
   switch ((freq || '').toLowerCase()) {
    case 'diaria': return 'bi-clock';
    case 'semanal': return 'bi-calendar-week';
    case 'quincenal': return 'bi-calendar2-week';
    case 'mensual': return 'bi-calendar-event';
    case 'bimestral': return 'bi-calendar2';
    case 'trimestral': return 'bi-calendar3';
    case 'semestral': return 'bi-calendar3-range';
    case 'anual': return 'bi-calendar4';
    default: return 'bi-calendar';
   }
  },

  getCategoryIcon: function (cat) {
   var c = (cat || '').toLowerCase();
   if (c.indexOf('comput') !== -1) return 'bi-pc-display';
   if (c.indexOf('impres') !== -1) return 'bi-printer';
   if (c.indexOf('acondic') !== -1 || c.indexOf('aa') !== -1) return 'bi-fan';
   if (c.indexOf('red') !== -1 || c.indexOf('switch') !== -1) return 'bi-router';
   if (c.indexOf('vehic') !== -1 || c.indexOf('auto') !== -1) return 'bi-truck';
   if (c.indexOf('extint') !== -1) return 'bi-fire';
   return 'bi-gear';
  }
 };

 window.MantenimientoService = MantenimientoService;
})();
