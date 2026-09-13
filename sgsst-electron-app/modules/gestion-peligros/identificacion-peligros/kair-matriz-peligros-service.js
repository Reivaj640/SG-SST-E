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

    /* F21.62 (2026-06-23) — AUTO-IMPORT DESACTIVADO con replace:true porque
       sobrescribia el JSON y borraba peligros nuevos como pel_71.

       F439.4 (2026-06-24) — Reactivado en modo SEGURO (merge-empty). Ya NO
       sobrescribe nada: solo completa los campos VACÍOS del JSON con los
       valores del Excel. Si el usuario ya editó algo, eso se preserva.
       Si el Excel no está disponible, simplemente lee del JSON como antes.

       📦441 (2026-06-25) — Ahora detecta cuando el JSON y el Excel están
       totalmente desfasados (sedesMatched=0 en el debug de merge-empty) y
       agrega la bandera `needsReplace: true` al resultado para que la UI
       pueda notificar al usuario y sugerir "Reemplazar desde Excel". */
    loadWithAutoImport: function (companyName) {
      KM.log('PELIGROS', 'AUTO_MERGE', 'INFO', 'modo merge-empty — completa vacíos desde Excel sin sobrescribir');
      return Service.read(companyName).then(function (readResult) {
        if (!readResult || !readResult.success) return readResult;
        /* Intentar descubrir el Excel; si está, hacer merge-empty */
        return Service.discoverXlsx(companyName).then(function (disc) {
          if (!disc || !disc.success || !disc.data || !disc.data.found) {
            KM.log('PELIGROS', 'AUTO_MERGE', 'INFO', 'Excel no encontrado — JSON local sin cambios');
            return readResult;
          }
          var excelPath = (disc.data && disc.data.filePath) || '';
          return Service.importXlsx(companyName, null, { mode: 'merge-empty' }).then(function (imp) {
            var needsReplace = false;
            var mismatchDetail = null;
            if (imp && imp.success) {
              var filled = (imp.data && imp.data.fieldsFilled) || 0;
              var dbg = (imp.data && imp.data.debug) || null;
              var msg = (imp.data && imp.data.message) || ('campos vacíos completados=' + filled);
              KM.log('PELIGROS', 'AUTO_MERGE', filled > 0 ? 'SUCCESS' : 'INFO', msg);
              /* 📦441 — Detectar desfase total entre JSON y Excel */
              if (dbg) {
                var sedMatched = dbg.sedesMatched || 0;
                var sedJson = dbg.jsonSedes || 0;
                var sedExcel = dbg.excelSedes || 0;
                /* Si merge-empty NO encontró NINGUNA sede en común y AMBOS lados
                   tienen datos, el JSON está completamente desfasado del Excel */
                if (sedMatched === 0 && sedJson > 0 && sedExcel > 0) {
                  needsReplace = true;
                  mismatchDetail = {
                    excelPath: excelPath,
                    excelSedes: dbg.excelSedeNames || [],
                    jsonSedes: dbg.jsonSedeNames || []
                  };
                  KM.log('PELIGROS', 'AUTO_MERGE', 'WARN',
                    'DESFASE detectado: JSON (' + sedJson + ' sedes) y Excel (' +
                    sedExcel + ' sedes) no comparten ninguna sede. ' +
                    'Use "Reemplazar desde Excel" para sincronizar.');
                }
              }
              if (filled > 0) {
                return Service.read(companyName).then(function (fresh) {
                  if (fresh && fresh.data) {
                    fresh.data.needsReplace = needsReplace;
                    fresh.data.mismatchDetail = mismatchDetail;
                  }
                  return fresh;
                });
              }
            } else {
              KM.log('PELIGROS', 'AUTO_MERGE', 'WARN', 'merge-empty returned no success: ' + JSON.stringify(imp));
            }
            /* Sin cambios: anotar la bandera needsReplace en el resultado original */
            if (readResult && readResult.data) {
              readResult.data.needsReplace = needsReplace;
              readResult.data.mismatchDetail = mismatchDetail;
            }
            return readResult;
          }).catch(function () {
            return readResult;
          });
        }).catch(function () {
          return readResult;
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
