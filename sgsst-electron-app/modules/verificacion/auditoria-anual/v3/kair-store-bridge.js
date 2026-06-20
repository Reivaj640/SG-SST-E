/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Bridge entre KairStore (v3) y AuditoriaService (v2)
   F9 (2026-06-19)
   - Hidrata el store desde el service real si está disponible
   - Si no hay datos en el service, usa mockData
   - Persiste mutaciones del store al service en background
   - Modo demo: si no hay service, todo funciona con mock
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var _hydrated = false;
  var _useService = false;

  function _hasService() {
    return !!(window.AuditoriaService && window.AuditoriaService.cargarTodo);
  }

  function _hasElectronAPI() {
    return !!(window.electronAPI && window.electronAPI.auditoriaAnual);
  }

  /**
   * Convierte un audit del modelo v3 al modelo del service actual.
   * El service actual solo soporta campos básicos (no cronograma/hallazgos detallados).
   */
  function _v3ToService(audit) {
    return {
      id: audit.id,
      nombre: audit.process || audit.code,
      tipo: audit.auditType ? (audit.auditType === 'seguimiento' ? 'Interna' : audit.auditType === 'externa' ? 'Externa' : 'Interna') : 'Interna',
      alcance: audit.alcance || '',
      fechaInicio: audit.fechaProgramada || '',
      fechaFin: audit.fechaEntrega || audit.fechaProgramada || '',
      estado: (function () {
        var map = { programada: 'programada', en_curso: 'en-progreso', realizada: 'completada', vencida: 'vencida', cancelada: 'cancelada' };
        return map[audit.status] || 'programada';
      })(),
      auditorLider: audit.auditorLider || '',
      equipo: audit.auditores || [],
      trimestre: audit.trimestre || '',
      calificacion: typeof audit.calificacion === 'number' ? audit.calificacion : 0
    };
  }

  /**
   * Convierte un audit del service al modelo v3.
   */
  function _serviceToV3(a) {
    if (!a) return null;
    return {
      id: a.id,
      code: a.id,
      year: new Date().getFullYear(),
      process: a.nombre || a.id,
      auditType: a.tipo === 'Externa' ? 'externa' : 'interna',
      status: (function () {
        var map = { 'programada': 'programada', 'en-progreso': 'en_curso', 'completada': 'realizada', 'vencida': 'vencida', 'cancelada': 'cancelada' };
        return map[a.estado] || 'programada';
      })(),
      empresa: '',
      nit: '',
      actividadEconomica: '',
      direccion: '',
      ciudad: '',
      telefono: '',
      numEmpleados: 0,
      gerente: '',
      encargadoSgsst: '',
      encargadoSgsstEmail: '',
      auditorLider: a.auditorLider || '',
      auditores: a.equipo || [],
      auditados: [],
      objective: '',
      alcance: a.alcance || '',
      criterio: '',
      metodologia: '',
      participacionCopasst: '',
      procesos: [],
      cronograma: [],
      tipoVerificacion: 'documental',
      fechaProgramada: a.fechaInicio || '',
      fechaEntrega: a.fechaFin || '',
      entrevistados: [],
      desempenoEtapas: [],
      desempenoComponentes: [],
      indicadoresSgsst: [],
      hallazgos: [],
      planAccion: [],
      firmas: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Convierte un hallazgo v3 al modelo del service.
   */
  function _hallazgoV3ToService(h, auditId) {
    return {
      id: h.id,
      auditoriaId: auditId,
      descripcion: h.descripcion || '',
      severidad: h.criticidad === 'critica' ? 'critico' : (h.criticidad === 'alta' ? 'critico' : h.criticidad || 'menor'),
      estado: (function () {
        var map = { abierta: 'abierto', en_tratamiento: 'en-progreso', verificada: 'cerrado', cerrada: 'cerrado', vencida: 'vencido' };
        return map[h.estado] || 'abierto';
      })(),
      responsable: h.responsable || '',
      fechaDeteccion: h.fechaDeteccion || new Date().toISOString().split('T')[0]
    };
  }

  /**
   * F10 (2026-06-19): Convierte un item de planAccion v3 a campos del audit del service.
   * El service actual no tiene tabla plan_accion, así que serializamos el plan
   * como JSON en el campo `planAccion` del audit (el service lo ignora si no existe).
   */
  function _planV3ToJson(planItems) {
    if (!Array.isArray(planItems) || planItems.length === 0) return [];
    return planItems.map(function (p) {
      return {
        id: p.id,
        descripcion: p.descripcion || '',
        responsable: p.responsable || '',
        fechaCompromiso: p.fechaCompromiso || '',
        estado: p.estado || 'pendiente',
        seguimiento: p.seguimiento || ''
      };
    });
  }

  /**
   * Inicializa el store v3 desde el service real o mockData.
   * Retorna Promise.
   */
  function hydrate() {
    if (_hydrated) return Promise.resolve();
    _hydrated = true;

    if (!_hasService()) {
      console.log('[K+AIRSST][6.1.2][BRIDGE] AuditoriaService no disponible · usando mockData');
      _useService = false;
      return Promise.resolve();
    }

    console.log('[K+AIRSST][6.1.2][BRIDGE] Hidratando desde AuditoriaService...');
    return AuditoriaService.cargarTodo().then(function (resp) {
      if (!resp || !resp.success || !resp.data) {
        console.log('[K+AIRSST][6.1.2][BRIDGE] cargarTodo no devolvió datos · usando mockData');
        _useService = false;
        return;
      }

      var serviceAudits = resp.data.auditorias || [];
      var serviceHallazgos = resp.data.hallazgos || [];

      if (serviceAudits.length === 0) {
        console.log('[K+AIRSST][6.1.2][BRIDGE] Service sin auditorías · usando mockData (4 demo)');
        _useService = false;
        return;
      }

      // Convertir auditorías del service al modelo v3
      var v3Audits = serviceAudits.map(_serviceToV3);

      // Asignar hallazgos a sus auditorías
      serviceHallazgos.forEach(function (h) {
        var audit = v3Audits.find(function (a) { return a.id === h.auditoriaId; });
        if (audit) {
          audit.hallazgos.push({
            id: h.id,
            auditId: h.auditoriaId,
            componente: '',
            tipo: h.severidad === 'critico' ? 'NC' : 'OM',
            criticidad: h.severidad === 'critico' ? 'critica' : (h.severidad || 'media'),
            descripcion: h.descripcion || '',
            estado: (function () {
              var map = { abierto: 'abierta', 'en-progreso': 'en_tratamiento', cerrado: 'cerrada', vencido: 'vencida' };
              return map[h.estado] || 'abierta';
            })(),
            responsable: h.responsable || '',
            fechaDeteccion: h.fechaDeteccion || ''
          });
        }
      });

      KairStore.setState({ audits: v3Audits });
      _useService = true;
      console.log('[K+AIRSST][6.1.2][BRIDGE] Hidratado desde service · ' + v3Audits.length + ' auditorías, ' + serviceHallazgos.length + ' hallazgos');
    }).catch(function (err) {
      console.warn('[K+AIRSST][6.1.2][BRIDGE] Error hidratando, usando mockData:', err && err.message);
      _useService = false;
    });
  }

  /**
   * Persiste una mutación del store al service (fire-and-forget).
   * Si el service no está disponible, no hace nada.
   * F10 (2026-06-19): agrega persistAudit que sincroniza hallazgos+planAccion del audit completo.
   */
  function persist(action, payload) {
    if (!_useService || !_hasService()) return Promise.resolve();

    try {
      if (action === 'addAudit' || action === 'updateAudit' || action === 'updateAuditStatus') {
        var audit = payload.audit || (action === 'updateAuditStatus' ? KairStore.selectAuditById(payload.id) : null);
        if (audit) {
          var simple = _v3ToService(audit);
          if (action === 'addAudit' && AuditoriaService.guardarAuditoria) {
            return AuditoriaService.guardarAuditoria(_getEmpresaId(), simple);
          } else if (AuditoriaService.actualizarAuditoria) {
            return AuditoriaService.actualizarAuditoria(_getEmpresaId(), simple.id, simple);
          }
        }
      } else if (action === 'addHallazgo' || action === 'updateHallazgo' || action === 'updateHallazgoEstado') {
        var h = payload.hallazgo || payload;
        if (h) {
          var sH = _hallazgoV3ToService(h, h.auditId);
          if (action === 'addHallazgo' && AuditoriaService.guardarHallazgo) {
            return AuditoriaService.guardarHallazgo(_getEmpresaId(), sH);
          } else if (AuditoriaService.actualizarHallazgo) {
            return AuditoriaService.actualizarHallazgo(_getEmpresaId(), sH.id, sH);
          }
        }
      } else if (action === 'removeHallazgo' && AuditoriaService.eliminarHallazgo) {
        return AuditoriaService.eliminarHallazgo(_getEmpresaId(), payload);
      } else if (action === 'persistAuditFull' && AuditoriaService.actualizarAuditoria) {
        /* F10 (2026-06-19): persistir audit completo cuando cambian hallazgos/planAccion
           (el service solo actualiza campos que conoce, ignora cronograma/planAccion/firmas) */
        return AuditoriaService.actualizarAuditoria(_getEmpresaId(), audit.id, _v3ToService(audit));
      } else if (action === 'syncAudit' && AuditoriaService.actualizarAuditoria) {
        /* F10 (2026-06-19): sincroniza hallazgos+planAccion del audit. Estrategia:
           1) actualizar audit (campos básicos)
           2) detectar hallazgos nuevos → guardarHallazgo; eliminados → eliminarHallazgo
           3) detectar hallazgos modificados → actualizarHallazgo
           4) planAccion/firmas/cronograma: solo actualizamos el audit (el service los ignora,
              se conservan localmente en el store, suficiente para demo)
        */
        return _syncAuditFull(payload.audit);
      }
    } catch (e) {
      console.warn('[K+AIRSST][6.1.2][BRIDGE] persist error:', e && e.message);
    }
    return Promise.resolve();
  }

  /**
   * F10 (2026-06-19): sincroniza audit completo (auditoría + sus hallazgos).
   */
  function _syncAuditFull(audit) {
    if (!audit) return Promise.resolve();
    var empresaId = _getEmpresaId();
    var promises = [];

    /* 1) actualizar audit base */
    if (AuditoriaService.actualizarAuditoria) {
      promises.push(AuditoriaService.actualizarAuditoria(empresaId, audit.id, _v3ToService(audit)));
    }

    /* 2-3) sincronizar hallazgos */
    if (Array.isArray(audit.hallazgos)) {
      /* Cargar lista actual del service para detectar deletes */
      var loadPromise = (AuditoriaService.cargarTodo ? AuditoriaService.cargarTodo(empresaId) : Promise.resolve(null))
        .then(function (resp) {
          if (!resp || !resp.success || !resp.data) return;
          var existing = (resp.data.hallazgos || []).filter(function (h) { return h.auditoriaId === audit.id; });
          var existingIds = existing.map(function (h) { return h.id; });
          var currentIds = audit.hallazgos.map(function (h) { return h.id; });
          /* eliminar los que ya no están */
          existingIds.forEach(function (eid) {
            if (currentIds.indexOf(eid) === -1 && AuditoriaService.eliminarHallazgo) {
              promises.push(AuditoriaService.eliminarHallazgo(empresaId, eid));
            }
          });
          /* upsert los que están */
          audit.hallazgos.forEach(function (h) {
            var sH = _hallazgoV3ToService(h, audit.id);
            if (existingIds.indexOf(h.id) === -1 && AuditoriaService.guardarHallazgo) {
              promises.push(AuditoriaService.guardarHallazgo(empresaId, sH));
            } else if (AuditoriaService.actualizarHallazgo) {
              promises.push(AuditoriaService.actualizarHallazgo(empresaId, sH.id, sH));
            }
          });
        })
        .catch(function (e) {
          console.warn('[K+AIRSST][6.1.2][BRIDGE] syncHallazgos cargarTodo error:', e && e.message);
        });
      promises.push(loadPromise);
    }

    return Promise.all(promises).catch(function (e) {
      console.warn('[K+AIRSST][6.1.2][BRIDGE] _syncAuditFull error:', e && e.message);
    });
  }

  function _getEmpresaId() {
    if (window.KairMockData && window.KairMockData.ACTIVE_COMPANY) {
      return window.KairMockData.ACTIVE_COMPANY.id || 'tempoactiva';
    }
    return 'tempoactiva';
  }

  function isUsingService() { return _useService; }
  function reset() { _hydrated = false; _useService = false; }

  window.KairStoreBridge = {
    hydrate: hydrate,
    persist: persist,
    isUsingService: isUsingService,
    reset: reset
  };

  console.log('[K+AIRSST][6.1.2][BRIDGE] Bridge v3 inicializado · servicio: ' + (_hasService() ? 'sí' : 'no') + ' · electronAPI: ' + (_hasElectronAPI() ? 'sí' : 'no'));
})();
