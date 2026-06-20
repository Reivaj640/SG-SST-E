/* ==========================================================================
   K+AIR — Servicio de Asociados (CRUD) para módulo 2.10.1
   Usa caché interna para evitar problemas de async/sync con electronAPI.
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'kair_asociados_es';
  var _cache = null;
  var _loaded = false;

  function _readData() {
    if (_loaded && _cache !== null) return _cache;
    try {
      if (window.electronAPI && typeof window.electronAPI.getAsociadosES === 'function') {
        var result = window.electronAPI.getAsociadosES();
        // electronAPI.invoke retorna Promise — si es Promise, retornar [] y cargar después
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
      var raw = localStorage.getItem(STORAGE_KEY);
      _cache = raw ? JSON.parse(raw) : [];
      _loaded = true;
      return _cache;
    } catch (err) {
      console.error('Error leyendo asociados ES:', err);
      _cache = [];
      _loaded = true;
      return _cache;
    }
  }

  function _writeData(data) {
    _cache = data;
    _loaded = true;
    try {
      if (window.electronAPI && typeof window.electronAPI.saveAsociadosES === 'function') {
        window.electronAPI.saveAsociadosES(data);
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Error guardando asociados ES:', err);
    }
  }

  function _forceReload() { _cache = null; _loaded = false; }

  function getAll() { return _readData(); }

  function getById(id) {
    return _readData().find(function (a) { return a.id === id; }) || null;
  }

  function create(asociado) {
    var data = _readData();
    var newAsociado = {
      id: window.KAIRUtils.generateId(),
      tipo: asociado.tipo || 'PROVEEDOR',
      nit: asociado.nit || '',
      razonSocial: asociado.razonSocial || '',
      producto: asociado.producto || '',
      direccion: asociado.direccion || '',
      telefono: asociado.telefono || '',
      email: asociado.email || '',
      contacto: asociado.contacto || '',
      documentos: asociado.documentos || {},
      estado: asociado.estado || 'ACTIVO',
      fechaRegistro: window.KAIRUtils.nowISO(),
      observaciones: asociado.observaciones || '',
    };
    data.push(newAsociado);
    _writeData(data);
    return newAsociado;
  }

  function update(id, updates) {
    var data = _readData();
    var index = data.findIndex(function (a) { return a.id === id; });
    if (index === -1) return null;
    data[index] = Object.assign({}, data[index], updates, { id: id, fechaRegistro: data[index].fechaRegistro });
    _writeData(data);
    return data[index];
  }

  function remove(id) {
    var data = _readData().filter(function (a) { return a.id !== id; });
    _writeData(data);
    return true;
  }

  function search(query) {
    var data = _readData();
    if (!query) return data;
    var q = query.toLowerCase();
    return data.filter(function (a) {
      return a.razonSocial.toLowerCase().includes(q) ||
        a.nit.toLowerCase().includes(q) ||
        a.producto.toLowerCase().includes(q);
    });
  }

  function filterByTipo(tipo) {
    var data = _readData();
    if (!tipo) return data;
    return data.filter(function (a) { return a.tipo === tipo; });
  }

  function getWithoutSelectionEval() {
    var asociados = _readData();
    if (!window.EvaluacionesServiceES) return [];
    var evaluaciones = window.EvaluacionesServiceES.getSelectionEvals();
    if (!Array.isArray(evaluaciones)) return asociados.filter(function (a) { return a.estado === 'ACTIVO'; });
    var evaluatedIds = {};
    evaluaciones.forEach(function (e) { evaluatedIds[e.asociadoId] = true; });
    return asociados.filter(function (a) { return !evaluatedIds[a.id] && a.estado === 'ACTIVO'; });
  }

  function getWithSelectionEval() {
    var asociados = _readData();
    if (!window.EvaluacionesServiceES) return [];
    var evaluaciones = window.EvaluacionesServiceES.getSelectionEvals();
    if (!Array.isArray(evaluaciones)) return [];
    var evaluatedIds = {};
    evaluaciones.forEach(function (e) { evaluatedIds[e.asociadoId] = true; });
    return asociados.filter(function (a) { return evaluatedIds[a.id] && a.estado === 'ACTIVO'; });
  }

  function seedSampleData() {
    var data = _readData();
    if (data.length > 0) return;

    var samples = [
      {
        id: window.KAIRUtils.generateId(), tipo: 'PROVEEDOR', nit: '900123456-1',
        razonSocial: 'Suministros Industriales SAS', producto: 'Elementos de protección personal (EPP)',
        direccion: 'Cra 15 #82-34, Bogotá', telefono: '601-3456789', email: 'contacto@suministrosind.com',
        contacto: 'Carlos Méndez', documentos: { camaraComercio: true, rut: true, cedulaRepresentante: true, formatoRegistro: true, certificacionBancaria: true },
        estado: 'ACTIVO', fechaRegistro: '2025-01-15T10:00:00.000Z', observaciones: 'Proveedor confiable con más de 10 años de experiencia.'
      },
      {
        id: window.KAIRUtils.generateId(), tipo: 'CONTRATISTA', nit: '800654321-3',
        razonSocial: 'Servicios Ambientales del Caribe Ltda', producto: 'Gestión de residuos peligrosos',
        direccion: 'Av. El Paseo #4-56, Barranquilla', telefono: '605-3123456', email: 'info@ambientalescaribe.com',
        contacto: 'Ana Rodríguez', documentos: { camaraComercio: true, rut: true, certificacionBancaria: true, certificadosSGSST: true, hojasSeguridad: true, fichasTecnicas: true, cedulaRepresentante: true },
        estado: 'ACTIVO', fechaRegistro: '2025-02-10T08:30:00.000Z', observaciones: 'Contratista especializado en manejo ambiental.'
      },
      {
        id: window.KAIRUtils.generateId(), tipo: 'PROVEEDOR', nit: '901234567-8',
        razonSocial: 'Químicos y Derivados SA', producto: 'Reactivos de laboratorio y químicos industriales',
        direccion: 'Cl 72 #10-45, Medellín', telefono: '604-5678901', email: 'ventas@quimicosderivados.com',
        contacto: 'Luis Fernando Gómez', documentos: { camaraComercio: true, rut: true, cedulaRepresentante: true, formatoRegistro: true, hojasSeguridad: true, fichasTecnicas: true },
        estado: 'ACTIVO', fechaRegistro: '2025-03-05T14:20:00.000Z', observaciones: ''
      },
    ];
    _writeData(samples);
  }

  window.AsociadosServiceES = {
    getAll: getAll, getById: getById, create: create, update: update, remove: remove,
    search: search, filterByTipo: filterByTipo,
    getWithoutSelectionEval: getWithoutSelectionEval, getWithSelectionEval: getWithSelectionEval,
    seedSampleData: seedSampleData,
    _forceReload: _forceReload,
  };
})();
