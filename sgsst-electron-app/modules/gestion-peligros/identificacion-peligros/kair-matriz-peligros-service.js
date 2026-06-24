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

    addProceso: function (companyName, sedeId, nombre) {
      var r = passthrough('addProceso', [companyName, sedeId, nombre]);
      if (r) return r;
      return Promise.resolve({ success: true, data: { id: KM.uid('pro'), nombre: nombre } });
    },

    addCargo: function (companyName, procesoId, nombre) {
      var r = passthrough('addCargo', [companyName, procesoId, nombre]);
      if (r) return r;
      return Promise.resolve({ success: true, data: { id: KM.uid('car'), nombre: nombre } });
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

    /* F21.62 (2026-06-23) — AUTO-IMPORT DESACTIVADO.
       Antes esta funcion SIEMPRE re-importaba el XLSX de la empresa con
       replace:true cada vez que el usuario entraba al modulo, lo cual
       BORRABA cualquier peligro que el usuario hubiera creado en la
       sesion anterior (el JSON se sobrescribia con el contenido del Excel).
       Resultado visible: el usuario creaba "pel_71", veia el toast de
       exito, y al regresar a la matriz el peligro ya no estaba.

       Fix: loadWithAutoImport ahora SOLO lee del JSON. Si el usuario
       quiere re-importar desde el Excel, debe usar el boton "Importar
       Excel" de la toolbar de la vista (que ya existia, solo estaba
       siendo ignorado por el auto-import). El JSON queda como la unica
       fuente de verdad entre sesiones. */
    loadWithAutoImport: function (companyName) {
      KM.log('PELIGROS', 'AUTO_IMPORT', 'INFO', 'desactivado — leyendo solo del JSON local');
      return Service.read(companyName);
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
