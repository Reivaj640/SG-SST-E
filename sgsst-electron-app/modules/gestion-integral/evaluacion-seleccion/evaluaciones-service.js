/* ==========================================================================
   K+AIR — Servicio de Evaluaciones y Reevaluaciones para módulo 2.10.1
   Usa caché interna para evitar problemas de async/sync con electronAPI.
   ========================================================================== */

(function () {
  'use strict';

  var EVAL_KEY = 'kair_evaluaciones_es';
  var REEVAL_KEY = 'kair_reevaluaciones_es';

  var _evalCache = null, _evalLoaded = false;
  var _reevalCache = null, _reevalLoaded = false;

  function _readEvals() {
    if (_evalLoaded && _evalCache !== null) return _evalCache;
    try {
      if (window.electronAPI && typeof window.electronAPI.getEvaluacionesES === 'function') {
        var result = window.electronAPI.getEvaluacionesES();
        if (result && typeof result.then === 'function') {
          result.then(function (data) {
            _evalCache = Array.isArray(data) ? data : [];
            _evalLoaded = true;
          }).catch(function () { _evalCache = []; _evalLoaded = true; });
          return [];
        }
        _evalCache = Array.isArray(result) ? result : [];
        _evalLoaded = true;
        return _evalCache;
      }
      var raw = localStorage.getItem(EVAL_KEY);
      _evalCache = raw ? JSON.parse(raw) : [];
      _evalLoaded = true;
      return _evalCache;
    } catch (e) { _evalCache = []; _evalLoaded = true; return _evalCache; }
  }

  function _writeEvals(data) {
    _evalCache = data; _evalLoaded = true;
    try {
      if (window.electronAPI && typeof window.electronAPI.saveEvaluacionesES === 'function') {
        window.electronAPI.saveEvaluacionesES(data); return;
      }
      localStorage.setItem(EVAL_KEY, JSON.stringify(data));
    } catch (err) { console.error('Error guardando evaluaciones ES:', err); }
  }

  function _readReevals() {
    if (_reevalLoaded && _reevalCache !== null) return _reevalCache;
    try {
      if (window.electronAPI && typeof window.electronAPI.getReevaluacionesES === 'function') {
        var result = window.electronAPI.getReevaluacionesES();
        if (result && typeof result.then === 'function') {
          result.then(function (data) {
            _reevalCache = Array.isArray(data) ? data : [];
            _reevalLoaded = true;
          }).catch(function () { _reevalCache = []; _reevalLoaded = true; });
          return [];
        }
        _reevalCache = Array.isArray(result) ? result : [];
        _reevalLoaded = true;
        return _reevalCache;
      }
      var raw = localStorage.getItem(REEVAL_KEY);
      _reevalCache = raw ? JSON.parse(raw) : [];
      _reevalLoaded = true;
      return _reevalCache;
    } catch (e) { _reevalCache = []; _reevalLoaded = true; return _reevalCache; }
  }

  function _writeReevals(data) {
    _reevalCache = data; _reevalLoaded = true;
    try {
      if (window.electronAPI && typeof window.electronAPI.saveReevaluacionesES === 'function') {
        window.electronAPI.saveReevaluacionesES(data); return;
      }
      localStorage.setItem(REEVAL_KEY, JSON.stringify(data));
    } catch (err) { console.error('Error guardando reevaluaciones ES:', err); }
  }

  function _forceReload() { _evalCache = null; _evalLoaded = false; _reevalCache = null; _reevalLoaded = false; }

  /* --- Evaluaciones de Selección --- */

  function getSelectionEvals() { return _readEvals(); }

  function getSelectionEvalByAsociado(asociadoId) {
    return _readEvals().filter(function (e) { return e.asociadoId === asociadoId; });
  }

  function createSelectionEval(data) {
    var evals = _readEvals();
    var criteriaValues = Object.values(data.criterios);
    var total = window.KAIRUtils.average(criteriaValues);

    var newEval = {
      id: window.KAIRUtils.generateId(),
      asociadoId: data.asociadoId,
      fecha: window.KAIRUtils.nowISO(),
      tipoEvaluacion: 'SELECCION',
      criterios: data.criterios,
      puntajeTotal: Math.round(total * 100) / 100,
      clasificacion: window.KAIRUtils.classifyScore(total),
      observaciones: data.observaciones || '',
    };
    evals.push(newEval);
    _writeEvals(evals);
    return newEval;
  }

  /* --- Reevaluaciones --- */

  function getReevaluations() { return _readReevals(); }

  function getReevaluationsByAsociado(asociadoId) {
    return _readReevals().filter(function (r) { return r.asociadoId === asociadoId; });
  }

  function getLastReevaluation(asociadoId) {
    var reevals = _readReevals()
      .filter(function (r) { return r.asociadoId === asociadoId; })
      .sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
    return reevals.length > 0 ? reevals[0] : null;
  }

  function createReevaluation(data) {
    var reevals = _readReevals();
    var criteriaValues = Object.values(data.criterios);
    var total = window.KAIRUtils.average(criteriaValues);

    var lastEval = getLastReevaluation(data.asociadoId);
    var previousScore = null;
    if (!lastEval) {
      var selEvals = getSelectionEvalByAsociado(data.asociadoId);
      if (selEvals.length > 0) {
        previousScore = selEvals[selEvals.length - 1].puntajeTotal;
      }
    } else {
      previousScore = lastEval.puntajeTotal;
    }

    var newReeval = {
      id: window.KAIRUtils.generateId(),
      asociadoId: data.asociadoId,
      fecha: window.KAIRUtils.nowISO(),
      frecuencia: data.frecuencia || 'ANUAL',
      criterios: data.criterios,
      puntajeTotal: Math.round(total * 100) / 100,
      clasificacion: window.KAIRUtils.classifyScore(total),
      puntajeAnterior: previousScore,
      tendencia: window.KAIRUtils.getTrend(total, previousScore),
      observaciones: data.observaciones || '',
    };
    reevals.push(newReeval);
    _writeReevals(reevals);
    return newReeval;
  }

  /* --- Consultas cruzadas --- */

  function getAsociadoStatus(asociadoId) {
    var lastReeval = getLastReevaluation(asociadoId);
    if (lastReeval) {
      return {
        puntaje: lastReeval.puntajeTotal,
        clasificacion: lastReeval.clasificacion,
        fecha: lastReeval.fecha,
        tipo: 'Reevaluación',
        tendencia: lastReeval.tendencia,
      };
    }
    var selEvals = getSelectionEvalByAsociado(asociadoId);
    if (selEvals.length > 0) {
      var last = selEvals[selEvals.length - 1];
      return {
        puntaje: last.puntajeTotal,
        clasificacion: last.clasificacion,
        fecha: last.fecha,
        tipo: 'Selección',
        tendencia: null,
      };
    }
    return null;
  }

  function getAllEvaluationsForReport() {
    var AsociadosServiceES = window.AsociadosServiceES;
    if (!AsociadosServiceES) return [];
    var asociados = AsociadosServiceES.getAll();
    if (!Array.isArray(asociados)) return [];
    return asociados.map(function (a) {
      var selEvals = getSelectionEvalByAsociado(a.id);
      var reevals = getReevaluationsByAsociado(a.id);
      var status = getAsociadoStatus(a.id);
      return {
        asociadoId: a.id,
        razonSocial: a.razonSocial,
        tipo: a.tipo,
        nit: a.nit,
        selectionScore: selEvals.length > 0 ? selEvals[selEvals.length - 1].puntajeTotal : null,
        lastReevalScore: reevals.length > 0 ? reevals[reevals.length - 1].puntajeTotal : null,
        clasificacion: status ? status.clasificacion : null,
        tendencia: status ? status.tendencia : null,
        fecha: status ? status.fecha : null,
      };
    });
  }

  function getStats() {
    var AsociadosServiceES = window.AsociadosServiceES;
    var NoConformidadesServiceES = window.NoConformidadesServiceES;
    var asociados = AsociadosServiceES ? AsociadosServiceES.getAll() : [];
    if (!Array.isArray(asociados)) asociados = [];
    var evals = _readEvals();
    var reevals = _readReevals();
    if (!Array.isArray(evals)) evals = [];
    if (!Array.isArray(reevals)) reevals = [];

    var evaluatedIds = {};
    evals.forEach(function (e) { evaluatedIds[e.asociadoId] = true; });
    var pendingEvals = asociados.filter(function (a) { return !evaluatedIds[a.id] && a.estado === 'ACTIVO'; });

    var now = new Date();
    var monthReevals = reevals.filter(function (r) {
      var d = new Date(r.fecha);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    var activeNCs = [];
    if (NoConformidadesServiceES) {
      var ncs = NoConformidadesServiceES.getAll();
      if (Array.isArray(ncs)) activeNCs = ncs.filter(function (nc) { return nc.estado !== 'CERRADA'; });
    }

    var allEvals = evals.map(function (e) { return e.clasificacion; }).concat(reevals.map(function (r) { return r.clasificacion; }));
    var distribution = {
      BUENO: allEvals.filter(function (c) { return c === 'BUENO'; }).length,
      REGULAR: allEvals.filter(function (c) { return c === 'REGULAR'; }).length,
      DEFICIENTE: allEvals.filter(function (c) { return c === 'DEFICIENTE'; }).length,
    };

    return {
      totalAsociados: asociados.filter(function (a) { return a.estado === 'ACTIVO'; }).length,
      evaluacionesPendientes: pendingEvals.length,
      reevaluacionesMes: monthReevals.length,
      ncActivas: activeNCs.length,
      distribution: distribution,
    };
  }

  function seedSampleData() {
    var evals = _readEvals();
    if (evals.length > 0) return;

    var AsociadosServiceES = window.AsociadosServiceES;
    if (!AsociadosServiceES) return;
    var asociados = AsociadosServiceES.getAll();
    if (!Array.isArray(asociados) || asociados.length === 0) return;

    var samples = [
      { asociadoId: asociados[0] && asociados[0].id, criterios: { precio: 3, disponibilidad: 3, experiencia: 5, calidad: 5, marca: 5, requisitosLegales: 5 }, observaciones: 'Buen proveedor con excelente calidad y marca reconocida.' },
      { asociadoId: asociados[1] && asociados[1].id, criterios: { precio: 5, disponibilidad: 3, experiencia: 3, calidad: 3, marca: 3, requisitosLegales: 5 }, observaciones: 'Cumple requisitos mínimos. Se requiere seguimiento en calidad.' },
      { asociadoId: asociados[2] && asociados[2].id, criterios: { precio: 1, disponibilidad: 3, experiencia: 3, calidad: 3, marca: 1, requisitosLegales: 3 }, observaciones: 'Precio elevado, marca no reconocida. Requiere plan de mejora.' },
    ].filter(function (s) { return s.asociadoId; });

    samples.forEach(function (s) { createSelectionEval(s); });

    if (asociados[0]) {
      createReevaluation({
        asociadoId: asociados[0].id, frecuencia: 'ANUAL',
        criterios: { calidad: 5, tiempoEntrega: 3, cantidadesPactadas: 5, gestionFacturacion: 5, garantia: 5, sst: 3 },
        observaciones: 'Reevaluación anual satisfactoria.',
      });
    }
  }

  window.EvaluacionesServiceES = {
    getSelectionEvals: getSelectionEvals, getSelectionEvalByAsociado: getSelectionEvalByAsociado,
    createSelectionEval: createSelectionEval,
    getReevaluations: getReevaluations, getReevaluationsByAsociado: getReevaluationsByAsociado,
    getLastReevaluation: getLastReevaluation, createReevaluation: createReevaluation,
    getAsociadoStatus: getAsociadoStatus, getAllEvaluationsForReport: getAllEvaluationsForReport,
    getStats: getStats, seedSampleData: seedSampleData,
    _forceReload: _forceReload,
  };
})();
