/* ==========================================================================
   K+AIR — Servicio de No Conformidades para módulo 2.10.1
   Usa caché interna para evitar problemas de async/sync con electronAPI.
   ========================================================================== */

(function () {
  'use strict';

  var NC_KEY = 'kair_noconformidades_es';
  var _cache = null;
  var _loaded = false;

  function _readData() {
    if (_loaded && _cache !== null) return _cache;
    try {
      if (window.electronAPI && typeof window.electronAPI.getNoConformidadesES === 'function') {
        var result = window.electronAPI.getNoConformidadesES();
        if (result && typeof result.then === 'function') {
          result.then(function (data) {
            _cache = Array.isArray(data) ? data : [];
            _loaded = true;
          }).catch(function () { _cache = []; _loaded = true; });
          return [];
        }
        _cache = Array.isArray(result) ? result : [];
        _loaded = true;
        return _cache;
      }
      var raw = localStorage.getItem(NC_KEY);
      _cache = raw ? JSON.parse(raw) : [];
      _loaded = true;
      return _cache;
    } catch (e) { _cache = []; _loaded = true; return _cache; }
  }

  function _writeData(data) {
    _cache = data;
    _loaded = true;
    try {
      if (window.electronAPI && typeof window.electronAPI.saveNoConformidadesES === 'function') {
        window.electronAPI.saveNoConformidadesES(data); return;
      }
      localStorage.setItem(NC_KEY, JSON.stringify(data));
    } catch (err) { console.error('Error guardando no conformidades ES:', err); }
  }

  function _forceReload() { _cache = null; _loaded = false; }

  function getAll() {
    var data = _readData();
    if (!Array.isArray(data)) return [];
    return data.slice().sort(function (a, b) { return new Date(b.fechaDeteccion) - new Date(a.fechaDeteccion); });
  }

  function getById(id) {
    return _readData().find(function (nc) { return nc.id === id; }) || null;
  }

  function create(data) {
    var ncs = _readData();
    var newNC = {
      id: window.KAIRUtils.generateId(),
      asociadoId: data.asociadoId,
      fechaDeteccion: data.fechaDeteccion || window.KAIRUtils.todayISO(),
      descripcion: data.descripcion || '',
      detectadoPor: data.detectadoPor || 'SST',
      planAccion: data.planAccion || '',
      responsableSeguimiento: data.responsableSeguimiento || '',
      fechaLimite: data.fechaLimite || '',
      estado: 'ABIERTA',
      observaciones: data.observaciones || '',
      fechaCreacion: window.KAIRUtils.nowISO(),
    };
    ncs.push(newNC);
    _writeData(ncs);
    return newNC;
  }

  function updateEstado(id, nuevoEstado) {
    var ncs = _readData();
    var index = ncs.findIndex(function (nc) { return nc.id === id; });
    if (index === -1) return null;

    var transitions = {
      ABIERTA: ['EN_SEGUIMIENTO'],
      EN_SEGUIMIENTO: ['CERRADA'],
      CERRADA: [],
    };

    var allowed = transitions[ncs[index].estado] || [];
    if (!allowed.includes(nuevoEstado)) {
      console.error('Transición de estado inválida: ' + ncs[index].estado + ' → ' + nuevoEstado);
      return null;
    }

    ncs[index].estado = nuevoEstado;
    _writeData(ncs);
    return ncs[index];
  }

  function update(id, updates) {
    var ncs = _readData();
    var index = ncs.findIndex(function (nc) { return nc.id === id; });
    if (index === -1) return null;
    ncs[index] = Object.assign({}, ncs[index], updates, { id: id, fechaCreacion: ncs[index].fechaCreacion });
    _writeData(ncs);
    return ncs[index];
  }

  function remove(id) {
    var ncs = _readData().filter(function (nc) { return nc.id !== id; });
    _writeData(ncs);
    return true;
  }

  function filterByEstado(estado) {
    var ncs = _readData();
    if (!estado) return ncs;
    return ncs.filter(function (nc) { return nc.estado === estado; });
  }

  function filterByAsociado(asociadoId) {
    var ncs = _readData();
    if (!asociadoId) return ncs;
    return ncs.filter(function (nc) { return nc.asociadoId === asociadoId; });
  }

  function countByEstado() {
    var ncs = _readData();
    return {
      ABIERTA: ncs.filter(function (nc) { return nc.estado === 'ABIERTA'; }).length,
      EN_SEGUIMIENTO: ncs.filter(function (nc) { return nc.estado === 'EN_SEGUIMIENTO'; }).length,
      CERRADA: ncs.filter(function (nc) { return nc.estado === 'CERRADA'; }).length,
    };
  }

  function seedSampleData() {
    var ncs = _readData();
    if (ncs.length > 0) return;

    var AsociadosServiceES = window.AsociadosServiceES;
    if (!AsociadosServiceES) return;
    var asociados = AsociadosServiceES.getAll();
    if (!Array.isArray(asociados) || asociados.length < 2) return;

    var samples = [
      {
        id: window.KAIRUtils.generateId(), asociadoId: asociados[1] && asociados[1].id,
        fechaDeteccion: '2025-04-01',
        descripcion: 'Incumplimiento en la entrega de certificados de disposición final de residuos.',
        detectadoPor: 'SST',
        planAccion: 'Solicitar certificado de disposición final y verificar cumplimiento del cronograma.',
        responsableSeguimiento: 'Ana Rodríguez', fechaLimite: '2025-04-15',
        estado: 'ABIERTA', observaciones: 'Se envió comunicación al contratista.',
        fechaCreacion: '2025-04-01T09:00:00.000Z',
      },
      {
        id: window.KAIRUtils.generateId(), asociadoId: asociados[2] && asociados[2].id,
        fechaDeteccion: '2025-03-20',
        descripcion: 'Reactivo recibido con etiquetado incompleto, sin hoja de seguridad en español.',
        detectadoPor: 'USUARIO_FINAL',
        planAccion: 'Proveedor envió MSDS actualizada. Se verificó cumplimiento.',
        responsableSeguimiento: 'Luis Fernando Gómez', fechaLimite: '2025-04-01',
        estado: 'CERRADA', observaciones: 'NC cerrada tras verificación de entrega de MSDS completa.',
        fechaCreacion: '2025-03-20T14:30:00.000Z',
      },
    ].filter(function (s) { return s.asociadoId; });

    _writeData(samples);
  }

  window.NoConformidadesServiceES = {
    getAll: getAll, getById: getById, create: create, updateEstado: updateEstado,
    update: update, remove: remove,
    filterByEstado: filterByEstado, filterByAsociado: filterByAsociado,
    countByEstado: countByEstado, seedSampleData: seedSampleData,
    _forceReload: _forceReload,
  };
})();
