/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Store (vanilla port de Zustand)
   v3.0 · 2026-06-19
   Patrón pub/sub: getState(), setState(updater), subscribe(fn)
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var _state = {
    audits: (window.KairMockData && window.KairMockData.audits) || [],
    /* F21.23 (2026-06-20): items de cronograma sin auditoría asociada
       (texto libre). Se muestran junto al resto en el cronograma. */
    freeCronograma: [],
    hydrated: false,
    view: 'hub',
    activeAuditId: undefined,
    activeTab: undefined
  };

  var _subscribers = [];

  function getState() { return _state; }

  function setState(updater) {
    var next = typeof updater === 'function' ? updater(_state) : updater;
    _state = Object.assign({}, _state, next);
    _notify();
  }

  function _notify() {
    _subscribers.forEach(function (fn) {
      try { fn(_state); } catch (e) { console.error('[K+AIRSST][6.1.2][STORE] subscriber error:', e); }
    });
  }

  function subscribe(fn) {
    _subscribers.push(fn);
    return function unsubscribe() {
      _subscribers = _subscribers.filter(function (s) { return s !== fn; });
    };
  }

  /* ─── Logger K+AIR ────────────────────────────────────────── */
  function log(modulo, accion, status, detail) {
    var d = detail ? ' ' + detail : '';
    console.log('[K+AIRSST][' + modulo + '][' + accion + '][' + status + ']' + d);
  }

  /* ─── Selectors ─────────────────────────────────────────── */
  function selectAudits() { return _state.audits; }
  function selectAuditById(id) { return _state.audits.find(function (a) { return a.id === id; }); }
  function selectAllHallazgos() {
    return _state.audits.flatMap(function (a) {
      return a.hallazgos.map(function (h) {
        return Object.assign({}, h, {
          auditCode: a.code,
          auditProcess: a.process,
          empresa: a.empresa
        });
      });
    });
  }

  /* ─── Computed KPIs ────────────────────────────────────── */
  function computeKpisAuditorias() {
    var a = _state.audits;
    return {
      total: a.length,
      programadas: a.filter(function (x) { return x.status === 'programada'; }).length,
      enCurso: a.filter(function (x) { return x.status === 'en_curso'; }).length,
      realizadas: a.filter(function (x) { return x.status === 'realizada'; }).length,
      vencidas: a.filter(function (x) { return x.status === 'vencida'; }).length
    };
  }

  function computeKpisHallazgos() {
    var h = selectAllHallazgos();
    return {
      total: h.length,
      abiertas: h.filter(function (x) { return x.estado === 'abierta'; }).length,
      enTratamiento: h.filter(function (x) { return x.estado === 'en_tratamiento'; }).length,
      verificadas: h.filter(function (x) { return x.estado === 'verificada'; }).length,
      cerradas: h.filter(function (x) { return x.estado === 'cerrada'; }).length,
      vencidas: h.filter(function (x) { return x.estado === 'vencida'; }).length
    };
  }

  function computeKpisCronograma(anio) {
    var items = _state.audits.flatMap(function (a) { return a.cronograma; })
      .filter(function (c) { return c.anio === anio; });
    return {
      total: items.length,
      pendientes: items.filter(function (c) { return c.estado === 'pendiente'; }).length,
      enCurso: items.filter(function (c) { return c.estado === 'en_curso'; }).length,
      completados: items.filter(function (c) { return c.estado === 'completado'; }).length,
      vencidos: items.filter(function (c) { return c.estado === 'vencido'; }).length,
      auditoriasConCronograma: _state.audits.filter(function (a) {
        return a.cronograma.filter(function (c) { return c.anio === anio; }).length > 0;
      }).length
    };
  }

  function computeKpisInformes() {
    var conInforme = _state.audits.filter(function (a) {
      return a.status === 'realizada' || a.status === 'en_curso';
    });
    var emitidos = 0, borradores = 0, pendientesFirma = 0, firmados = 0;
    conInforme.forEach(function (a) {
      var tieneFirmas = a.firmas.length > 0;
      var todasFirmadas = tieneFirmas && a.firmas.every(function (f) { return f.firmado; });
      var algunasFirmadas = tieneFirmas && a.firmas.some(function (f) { return f.firmado; });
      if (a.status === 'realizada' && todasFirmadas) { emitidos++; firmados++; }
      else if (a.status === 'realizada' && !tieneFirmas) { emitidos++; pendientesFirma++; }
      else if (a.status === 'realizada' && algunasFirmadas && !todasFirmadas) { emitidos++; pendientesFirma++; }
      else if (a.status === 'en_curso') { borradores++; }
    });
    return { total: conInforme.length, emitidos: emitidos, borradores: borradores, pendientesFirma: pendientesFirma, firmados: firmados };
  }

  /* ─── Acciones de navegación ──────────────────────────── */
  var actions = {
    goHub: function () { log('AUDIT', 'NAV_HUB', 'INFO'); setState({ view: 'hub', activeAuditId: undefined, activeTab: undefined }); },
    goList: function () { log('AUDIT', 'NAV_LIST', 'INFO'); setState({ view: 'list', activeAuditId: undefined, activeTab: undefined }); },
    goEditor: function (auditId, tab) { log('AUDIT', 'NAV_EDITOR', 'INFO', 'audit=' + auditId + ' tab=' + (tab || '-')); setState({ view: 'editor', activeAuditId: auditId, activeTab: tab || 'plan' }); },
    goHallazgos: function () { log('AUDIT', 'NAV_HALLAZGOS', 'INFO'); setState({ view: 'hallazgos', activeAuditId: undefined, activeTab: undefined }); },
    goCronograma: function () { log('AUDIT', 'NAV_CRONOGRAMA', 'INFO'); setState({ view: 'cronograma', activeAuditId: undefined, activeTab: undefined }); },
    goInformes: function () { log('AUDIT', 'NAV_INFORMES', 'INFO'); setState({ view: 'informes', activeAuditId: undefined, activeTab: undefined }); },
    setTab: function (tab) { setState({ activeTab: tab }); },

    /* CRUD auditoría */
    addAudit: function (audit) { log('AUDIT', 'ADD_AUDIT', 'SUCCESS', 'id=' + audit.id); setState(function (s) { return { audits: [].concat(s.audits, [audit]) }; }); },
    updateAudit: function (id, patch) {
      log('AUDIT', 'UPDATE_AUDIT', 'SUCCESS', 'id=' + id);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return a.id === id ? Object.assign({}, a, patch, { updatedAt: new Date().toISOString() }) : a;
          })
        };
      });
    },
    updateAuditStatus: function (id, status) {
      log('AUDIT', 'UPDATE_STATUS', 'SUCCESS', 'id=' + id + ' status=' + status);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return a.id === id ? Object.assign({}, a, { status: status, updatedAt: new Date().toISOString() }) : a;
          })
        };
      });
    },

    /* CRUD hallazgo */
    addHallazgo: function (auditId, hallazgo) {
      log('HALLAZGO', 'ADD', 'SUCCESS', 'auditId=' + auditId + ' id=' + hallazgo.id);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return a.id === auditId ? Object.assign({}, a, { hallazgos: [].concat(a.hallazgos, [hallazgo]) }) : a;
          })
        };
      });
    },
    updateHallazgo: function (hallazgoId, patch) {
      log('HALLAZGO', 'UPDATE', 'SUCCESS', 'id=' + hallazgoId);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return Object.assign({}, a, {
              hallazgos: a.hallazgos.map(function (h) {
                return h.id === hallazgoId ? Object.assign({}, h, patch) : h;
              })
            });
          })
        };
      });
    },
    updateHallazgoEstado: function (hallazgoId, estado) {
      log('HALLAZGO', 'UPDATE_ESTADO', 'SUCCESS', 'id=' + hallazgoId + ' estado=' + estado);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return Object.assign({}, a, {
              hallazgos: a.hallazgos.map(function (h) {
                if (h.id !== hallazgoId) return h;
                var fechaCierreReal = h.fechaCierreReal;
                if ((estado === 'cerrada' || estado === 'verificada') && !fechaCierreReal) {
                  fechaCierreReal = new Date().toISOString().slice(0, 10);
                }
                return Object.assign({}, h, { estado: estado, fechaCierreReal: fechaCierreReal });
              })
            });
          })
        };
      });
    },

    /* CRUD plan acción */
    addPlanAccionItem: function (item) {
      log('PLAN_ACCION', 'ADD', 'SUCCESS', 'id=' + item.id);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return a.id === item.auditId ? Object.assign({}, a, { planAccion: [].concat(a.planAccion, [item]) }) : a;
          })
        };
      });
    },
    updatePlanAccionItem: function (id, patch) {
      log('PLAN_ACCION', 'UPDATE', 'SUCCESS', 'id=' + id);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return Object.assign({}, a, {
              planAccion: a.planAccion.map(function (p) {
                return p.id === id ? Object.assign({}, p, patch) : p;
              })
            });
          })
        };
      });
    },
    updatePlanAccionEstado: function (id, estado) {
      log('PLAN_ACCION', 'UPDATE_ESTADO', 'SUCCESS', 'id=' + id + ' estado=' + estado);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return Object.assign({}, a, {
              planAccion: a.planAccion.map(function (p) {
                if (p.id !== id) return p;
                var fechaRealizacion = p.fechaRealizacion;
                if ((estado === 'cerrada' || estado === 'verificada') && !fechaRealizacion) {
                  fechaRealizacion = new Date().toISOString().slice(0, 10);
                }
                return Object.assign({}, p, { estado: estado, fechaRealizacion: fechaRealizacion });
              })
            });
          })
        };
      });
    },

    /* CRUD cronograma */
    addCronogramaItem: function (item) {
      log('CRONOGRAMA', 'ADD', 'SUCCESS', 'id=' + item.id + ' audit=' + (item.auditId || 'libre'));
      setState(function (s) {
        /* F21.23: si auditId está vacío, guardar en freeCronograma (texto libre). */
        if (!item.auditId) {
          return { freeCronograma: [].concat(s.freeCronograma, [item]) };
        }
        return {
          audits: s.audits.map(function (a) {
            return a.id === item.auditId ? Object.assign({}, a, { cronograma: [].concat(a.cronograma, [item]) }) : a;
          })
        };
      });
    },
    updateCronogramaItem: function (id, patch) {
      log('CRONOGRAMA', 'UPDATE', 'SUCCESS', 'id=' + id);
      setState(function (s) {
        /* Buscar primero en items libres. */
        var inFree = s.freeCronograma.some(function (c) { return c.id === id; });
        if (inFree) {
          return {
            freeCronograma: s.freeCronograma.map(function (c) {
              return c.id === id ? Object.assign({}, c, patch) : c;
            })
          };
        }
        return {
          audits: s.audits.map(function (a) {
            return Object.assign({}, a, {
              cronograma: a.cronograma.map(function (c) { return c.id === id ? Object.assign({}, c, patch) : c; })
            });
          })
        };
      });
    },
    updateCronogramaItemEstado: function (id, estado) {
      log('CRONOGRAMA', 'UPDATE_ESTADO', 'SUCCESS', 'id=' + id + ' estado=' + estado);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return Object.assign({}, a, {
              cronograma: a.cronograma.map(function (c) { return c.id === id ? Object.assign({}, c, { estado: estado }) : c; })
            });
          })
        };
      });
    },
    removeCronogramaItem: function (id) {
      log('CRONOGRAMA', 'REMOVE', 'SUCCESS', 'id=' + id);
      setState(function (s) {
        /* F21.23: si el item está en freeCronograma, removerlo de ahí. */
        if (s.freeCronograma.some(function (c) { return c.id === id; })) {
          return { freeCronograma: s.freeCronograma.filter(function (c) { return c.id !== id; }) };
        }
        return {
          audits: s.audits.map(function (a) {
            return Object.assign({}, a, {
              cronograma: a.cronograma.filter(function (c) { return c.id !== id; })
            });
          })
        };
      });
    },

    /* Firmas */
    toggleFirma: function (firmaId) {
      log('FIRMA', 'TOGGLE', 'SUCCESS', 'id=' + firmaId);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return Object.assign({}, a, {
              firmas: a.firmas.map(function (f) {
                if (f.id !== firmaId) return f;
                var firmado = !f.firmado;
                var fecha = f.firmado ? f.fecha : new Date().toISOString().slice(0, 10);
                return Object.assign({}, f, { firmado: firmado, fecha: fecha });
              })
            });
          })
        };
      });
    },
    addFirma: function (auditId, firma) {
      log('FIRMA', 'ADD', 'SUCCESS', 'audit=' + auditId + ' id=' + firma.id);
      setState(function (s) {
        return {
          audits: s.audits.map(function (a) {
            return a.id === auditId ? Object.assign({}, a, { firmas: [].concat(a.firmas, [firma]) }) : a;
          })
        };
      });
    },

    /* Reset */
    resetSeed: function () {
      log('AUDIT', 'RESET_SEED', 'SUCCESS');
      setState({ audits: (window.KairMockData && window.KairMockData.audits) || [] });
    }
  };

  /* ─── EXPORT ───────────────────────────────────────────── */
  window.KairStore = {
    getState: getState,
    setState: setState,
    subscribe: subscribe,
    /* Selectors */
    selectAudits: selectAudits,
    selectAuditById: selectAuditById,
    selectAllHallazgos: selectAllHallazgos,
    /* Computed */
    computeKpisAuditorias: computeKpisAuditorias,
    computeKpisHallazgos: computeKpisHallazgos,
    computeKpisCronograma: computeKpisCronograma,
    computeKpisInformes: computeKpisInformes,
    /* Actions */
    actions: actions
  };

  console.log('[K+AIRSST][6.1.2][STORE] Store v3 inicializado · ' + _state.audits.length + ' auditorías, ' + selectAllHallazgos().length + ' hallazgos');
})();
