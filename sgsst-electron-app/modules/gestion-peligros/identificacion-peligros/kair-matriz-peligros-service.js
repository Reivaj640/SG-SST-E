/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
service.js — IPC + seed JSON fallback
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;

  var SEED_URL = './modules/gestion-peligros/identificacion-peligros/peligros-seed.json';
  var _seedData = null;
  var _seedPromise = null;
  var _seedStats = null;

  function hasElectronAPI() {
    return !!(global.electronAPI && global.electronAPI.matrizPeligros);
  }

  function loadSeed() {
    if (_seedData) return Promise.resolve(_seedData);
    if (_seedPromise) return _seedPromise;
    if (typeof fetch !== 'function') return Promise.resolve(null);
    _seedPromise = fetch(SEED_URL)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        _seedData = data;
        _seedStats = KM.calcStats(data);
        KM.log('PELIGROS', 'SEED_LOAD', 'SUCCESS', 'peligros=' + ((_seedStats && _seedStats.total) || 0));
        return data;
      })
      .catch(function (err) {
        KM.log('PELIGROS', 'SEED_LOAD', 'WARNING', err.message);
        _seedData = null;
        return null;
      });
    return _seedPromise;
  }

  function passthrough(method, args) {
    if (hasElectronAPI()) {
      var fn = global.electronAPI.matrizPeligros[method];
      if (typeof fn === 'function') return fn.apply(global.electronAPI.matrizPeligros, args);
    }
    return null;
  }

  var Service = {
    hasElectronAPI: hasElectronAPI,

    read: function (companyName) {
      var r = passthrough('read', [companyName]);
      if (r) return r;
      return loadSeed().then(function (full) {
        if (full) return { success: true, data: { matriz: full, stats: _seedStats } };
        return { success: true, data: { matriz: { sedes: [] }, stats: KM.calcStats({ sedes: [] }) } };
      });
    },

    save: function (companyName, data) {
      var r = passthrough('save', [companyName, data]);
      if (r) return r;
      return Promise.resolve({ success: true });
    },

    addPeligro: function (companyName, cargoId, data) {
      var r = passthrough('addPeligro', [companyName, cargoId, data]);
      if (r) return r;
      return Promise.resolve({ success: true, data: Object.assign({ id: KM.uid('pel') }, data) });
    },

    updatePeligro: function (companyName, peligroId, cambios) {
      var r = passthrough('updatePeligro', [companyName, peligroId, cambios]);
      if (r) return r;
      return Promise.resolve({ success: true, data: Object.assign({ id: peligroId }, cambios) });
    },

    deletePeligro: function (companyName, peligroId) {
      var r = passthrough('deletePeligro', [companyName, peligroId]);
      if (r) return r;
      return Promise.resolve({ success: true });
    },

    addSede: function (companyName, nombre) {
      var r = passthrough('addSede', [companyName, nombre]);
      if (r) return r;
      return Promise.resolve({ success: true, data: { id: KM.uid('sed'), nombre: nombre } });
    },

    deleteSede: function (companyName, sedeId) {
      var r = passthrough('deleteSede', [companyName, sedeId]);
      if (r) return r;
      return Promise.resolve({ success: true });
    },

    updateCargo: function (companyName, cargoId, cambios) {
      var r = passthrough('updateCargo', [companyName, cargoId, cambios]);
      if (r) return r;
      return Promise.resolve({ success: true });
    },

    stats: function (companyName) {
      var r = passthrough('stats', [companyName]);
      if (r) return r;
      return loadSeed().then(function (full) {
        return { success: true, data: full ? _seedStats : KM.calcStats({ sedes: [] }) };
      });
    },

    gtc45Options: function () {
      var r = passthrough('gtc45Options', []);
      if (r) return r;
      return Promise.resolve({
        success: true,
        data: { nd: KM.GTC45.nd, ne: KM.GTC45.ne, nc: KM.GTC45.nc, tipos: KM.GTC45.tipos }
      });
    },

    discoverXlsx: function (companyName) {
      var r = passthrough('discoverXlsx', [companyName]);
      if (r) return r;
      return Promise.resolve({ success: true, data: { found: false } });
    },

    importXlsx: function (companyName, filePath, opts) {
      var r = passthrough('importXlsx', [companyName, filePath, opts]);
      if (r) return r;
      return Promise.resolve({ success: false, error: { code: 'NO_ELECTRON', message: 'Import solo en Electron' } });
    },

    syncXlsx: function (companyName) {
      var r = passthrough('syncXlsx', [companyName]);
      if (r) return r;
      return Promise.resolve({ success: false, error: { code: 'NO_ELECTRON', message: 'Sync solo en Electron' } });
    },

    /* Carga la matriz y SIEMPRE auto-importa desde el XLSX de la empresa.
   Si no existe XLSX, usa los datos existentes de la BD. */
    loadWithAutoImport: function (companyName) {
      if (!hasElectronAPI()) {
        return Service.read(companyName);
      }
      /* Paso 1: descubrir si hay XLSX */
      return Service.discoverXlsx(companyName).then(function (d) {
        if (!d || !d.success || !d.data || !d.data.found) {
          KM.log('PELIGROS', 'AUTO_IMPORT', 'INFO', 'no xlsx encontrado, usando datos en BD');
          return Service.read(companyName);
        }
        KM.log('PELIGROS', 'AUTO_IMPORT', 'INFO', 'xlsx=' + d.data.fileName + ' (reimport forzado)');
if (global.KM && global.KM.notify) {
          global.KM.notify('Cargando matriz desde Excel', 'Importación automática en curso…', 'info');
        }
        /* Paso 2: importar con replace:true (siempre reemplaza) */
        return Service.importXlsx(companyName, null, { replace: true }).then(function (ir) {
          if (ir && ir.success) {
            var sheets = (ir.data && ir.data.sheetsProcessed) || 0;
            KM.log('PELIGROS', 'AUTO_IMPORT', 'SUCCESS',
              'rows=' + (ir.data.rowsImported || 0) +
              ' sedes=' + (ir.data.sedesCreated || 0) +
              ' sheets=' + sheets);
            if (global.KM && global.KM.notify) {
              var summary = ir.data.rowsImported + ' peligros en ' + ir.data.sedesCreated + ' sedes';
              if (sheets > 1) summary += ' (' + sheets + ' hojas)';
              global.KM.notify('Matriz importada', summary, 'success', 4500);
            }
            return Service.read(companyName);
          }
          KM.log('PELIGROS', 'AUTO_IMPORT', 'WARNING',
            ir && ir.error ? ir.error.message : 'unknown');
          return Service.read(companyName);
        });
      });
    },

    reset: function (companyName) {
      var r = passthrough('reset', [companyName]);
      if (r) return r;
      return loadSeed().then(function (full) {
        return { success: true, data: { matriz: full, stats: _seedStats } };
      });
    }
  };

  global.KMService = Service;
  KM.log('PELIGROS', 'SERVICE_INIT', 'SUCCESS', 'hasElectronAPI=' + hasElectronAPI());
})(window);
