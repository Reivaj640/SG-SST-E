/* ═══════════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Auditoría Anual
   Service Layer — Proxy IPC + Fallback a Mocks (F2, 2026-06-19)

   Patrón idéntico al 6.1.3 (revision-alta-direccion-service.js):
   - _hasAPI(): ¿electronAPI disponible?
   - _fallback(): retorna datos mock cuando no hay API
   - Cada método público: intenta IPC primero, fallback a mock

   Cache en memoria: una vez cargado via cargarTodo(), las funciones
   derivadas (getKpiStats, getCronogramaData, etc.) operan sobre
   el cache local para evitar múltiples llamadas IPC.

   Mocks mantenidos como respaldo — se usan si:
     - electronAPI no está disponible (modo dev sin Electron)
     - La llamada IPC falla por cualquier razón
   ═══════════════════════════════════════════════════════════════════════ */

var AuditoriaService = (function () {
  'use strict';

  /* ── Datos mock de respaldo (cuando no hay Electron o falla IPC) ── */
  var AUDITORIAS_MOCK = [
    {
      id: 'AUD-2026-001',
      nombre: 'Auditoría Interna SG-SST - Q1',
      tipo: 'Interna',
      alcance: 'Todos los departamentos',
      fechaInicio: '2026-01-15',
      fechaFin: '2026-01-17',
      estado: 'completada',
      auditorLider: 'María García López',
      equipo: ['Carlos Ruiz', 'Ana Martínez'],
      hallazgos: 5,
      hallazgosCriticos: 1,
      trimestre: 'Q1',
      calificacion: 85
    },
    {
      id: 'AUD-2026-002',
      nombre: 'Auditoría Seguridad Electricidad',
      tipo: 'Especializada',
      alcance: 'Planta Industrial',
      fechaInicio: '2026-02-10',
      fechaFin: '2026-02-11',
      estado: 'completada',
      auditorLider: 'Pedro Sánchez',
      equipo: ['Laura Díaz'],
      hallazgos: 3,
      hallazgosCriticos: 0,
      trimestre: 'Q1',
      calificacion: 92
    },
    {
      id: 'AUD-2026-003',
      nombre: 'Auditoría Interna SG-SST - Q2',
      tipo: 'Interna',
      alcance: 'Todos los departamentos',
      fechaInicio: '2026-04-20',
      fechaFin: '2026-04-22',
      estado: 'completada',
      auditorLider: 'María García López',
      equipo: ['Carlos Ruiz', 'Roberto Díaz'],
      hallazgos: 7,
      hallazgosCriticos: 2,
      trimestre: 'Q2',
      calificacion: 78
    },
    {
      id: 'AUD-2026-004',
      nombre: 'Auditoría Extintores',
      tipo: 'Especializada',
      alcance: 'Edificio Central',
      fechaInicio: '2026-05-05',
      fechaFin: '2026-05-05',
      estado: 'completada',
      auditorLider: 'Carlos Ruiz',
      equipo: [],
      hallazgos: 2,
      hallazgosCriticos: 0,
      trimestre: 'Q2',
      calificacion: 95
    },
    {
      id: 'AUD-2026-005',
      nombre: 'Auditoría Interna SG-SST - Q3',
      tipo: 'Interna',
      alcance: 'Todos los departamentos',
      fechaInicio: '2026-07-14',
      fechaFin: '2026-07-16',
      estado: 'en-progreso',
      auditorLider: 'María García López',
      equipo: ['Ana Martínez', 'Laura Díaz'],
      hallazgos: 0,
      hallazgosCriticos: 0,
      trimestre: 'Q3',
      calificacion: null
    }
  ];

  var HALLAZGOS_MOCK = [
    {
      id: 'HJ-001',
      auditoriaId: 'AUD-2026-001',
      codigo: 'HJ-2026-001',
      descripcion: 'Falta de señalización en zona de riesgo eléctrico',
      severidad: 'critico',
      estado: 'cerrado',
      responsable: 'Juan Pérez',
      fechaDeteccion: '2026-01-15',
      fechaCierre: '2026-02-28',
      accionCorrectiva: 'Instalar señalización de peligro y barandillas'
    },
    {
      id: 'HJ-002',
      auditoriaId: 'AUD-2026-001',
      codigo: 'HJ-2026-002',
      descripcion: 'EPP dañado en área de soldadura',
      severidad: 'mayor',
      estado: 'cerrado',
      responsable: 'Carlos López',
      fechaDeteccion: '2026-01-16',
      fechaCierre: '2026-03-15',
      accionCorrectiva: 'Reposición de EPP y capacitación al personal'
    },
    {
      id: 'HJ-003',
      auditoriaId: 'AUD-2026-003',
      codigo: 'HJ-2026-003',
      descripcion: 'Capacitación pendiente para nuevos operarios',
      severidad: 'critico',
      estado: 'en-progreso',
      responsable: 'Ana Martínez',
      fechaDeteccion: '2026-04-21',
      fechaCierre: null,
      accionCorrectiva: 'Programar y ejecutar capacitación en SST'
    },
    {
      id: 'HJ-004',
      auditoriaId: 'AUD-2026-003',
      codigo: 'HJ-2026-004',
      descripcion: 'Documentación desactualizada en brigada de emergencia',
      severidad: 'mayor',
      estado: 'en-progreso',
      responsable: 'Laura Díaz',
      fechaDeteccion: '2026-04-22',
      fechaCierre: null,
      accionCorrectiva: 'Actualizar plan de emergencia y simulacros'
    }
  ];

  /* ── Cache en memoria ── */
  var _cache = { auditorias: null, hallazgos: null, fuente: null, lastLoad: 0 };
  var CACHE_TTL_MS = 30000; // re-fetch cada 30s para mantener datos frescos

  /* ── Helpers de API ── */
  function _hasAPI() {
    return !!(window.electronAPI && window.electronAPI.auditoriaAnual);
  }

  function _fallback(data, message) {
    return Promise.resolve({
      success: false,
      data: data || null,
      error: { code: 'NO_API', message: message || 'ElectronAPI no disponible' }
    });
  }

  function _normalizeAuditoria(a) {
    /* El backend devuelve campos snake_case (fecha_inicio, etc.);
       normalizamos a camelCase que es lo que esperan las vistas. */
    if (!a) return null;
    return {
      id: a.id,
      nombre: a.nombre,
      tipo: a.tipo,
      alcance: a.alcance,
      fechaInicio: a.fechaInicio || a.fecha_inicio,
      fechaFin: a.fechaFin || a.fecha_fin,
      estado: a.estado,
      auditorLider: a.auditorLider || a.auditor_lider,
      equipo: Array.isArray(a.equipo) ? a.equipo : [],
      trimestre: a.trimestre,
      calificacion: a.calificacion,
      created_at: a.created_at,
      updated_at: a.updated_at
    };
  }

  function _normalizeHallazgo(h) {
    if (!h) return null;
    return {
      id: h.id,
      auditoriaId: h.auditoriaId || h.auditoria_id,
      codigo: h.codigo,
      descripcion: h.descripcion,
      severidad: h.severidad,
      estado: h.estado,
      responsable: h.responsable,
      fechaDeteccion: h.fechaDeteccion || h.fecha_deteccion,
      fechaCierre: h.fechaCierre || h.fecha_cierre,
      accionCorrectiva: h.accionCorrectiva || h.accion_correctiva,
      created_at: h.created_at,
      updated_at: h.updated_at
    };
  }

  function _isCacheValid() {
    return _cache.auditorias && (Date.now() - _cache.lastLoad) < CACHE_TTL_MS;
  }

  /* ── API pública ── */

  /**
   * Carga auditorías + hallazgos. Si hay ElectronAPI usa SQLite/JSON del backend,
   * si no, usa mocks locales. Siempre refresca el cache.
   */
  function cargarTodo(empresaId) {
    if (!empresaId) {
      return Promise.reject(new Error('Falta empresaId para cargarTodo'));
    }

    var apiCall;
    if (_hasAPI()) {
      apiCall = window.electronAPI.auditoriaAnual.cargarTodo(empresaId);
    } else {
      apiCall = _fallback({
        auditorias: AUDITORIAS_MOCK.slice(),
        hallazgos: HALLAZGOS_MOCK.slice(),
        fuente: 'mock-local'
      }, 'Modo sin ElectronAPI — usando mocks locales');
    }

    return Promise.resolve(apiCall).then(function (resp) {
      if (resp && resp.success && resp.data) {
        var rawAuds = resp.data.auditorias || [];
        var rawHals = resp.data.hallazgos || [];
        _cache.auditorias = rawAuds.map(_normalizeAuditoria).filter(Boolean);
        _cache.hallazgos = rawHals.map(_normalizeHallazgo).filter(Boolean);
        _cache.fuente = resp.data.fuente || 'desconocida';
        _cache.lastLoad = Date.now();
        return {
          success: true,
          data: {
            auditorias: _cache.auditorias,
            hallazgos: _cache.hallazgos,
            fuente: _cache.fuente
          }
        };
      }
      // Si la API respondió pero con error, devolver el error del backend
      // (no caer a mock para no ocultar errores reales)
      return resp;
    });
  }

  /** Garantiza que el cache esté cargado. Si no, llama cargarTodo. */
  function _ensureLoaded(empresaId) {
    if (_isCacheValid()) return Promise.resolve();
    return cargarTodo(empresaId);
  }

  function guardarAuditoria(empresaId, auditoria) {
    if (!empresaId || !auditoria) return Promise.reject(new Error('Faltan parámetros'));
    if (_hasAPI()) {
      return window.electronAPI.auditoriaAnual.guardarAuditoria(empresaId, auditoria)
        .then(function (resp) {
          if (resp && resp.success) {
            /* Invalidar cache para que el siguiente cargarTodo traiga datos frescos */
            _cache.lastLoad = 0;
          }
          return resp;
        });
    }
    /* Fallback mock: agregar al array local */
    AUDITORIAS_MOCK.push(auditoria);
    return Promise.resolve({
      success: true,
      data: { id: auditoria.id || ('AUD-' + Date.now()) },
      fuente: 'mock-local'
    });
  }

  function eliminarAuditoria(empresaId, id) {
    if (!empresaId || !id) return Promise.reject(new Error('Faltan parámetros'));
    if (_hasAPI()) {
      return window.electronAPI.auditoriaAnual.eliminarAuditoria(empresaId, id)
        .then(function (resp) {
          if (resp && resp.success) _cache.lastLoad = 0;
          return resp;
        });
    }
    AUDITORIAS_MOCK = AUDITORIAS_MOCK.filter(function (a) { return a.id !== id; });
    return Promise.resolve({ success: true, fuente: 'mock-local' });
  }

  function guardarHallazgo(empresaId, hallazgo) {
    if (!empresaId || !hallazgo) return Promise.reject(new Error('Faltan parámetros'));
    if (_hasAPI()) {
      return window.electronAPI.auditoriaAnual.guardarHallazgo(empresaId, hallazgo)
        .then(function (resp) {
          if (resp && resp.success) _cache.lastLoad = 0;
          return resp;
        });
    }
    HALLAZGOS_MOCK.push(hallazgo);
    return Promise.resolve({
      success: true,
      data: { id: hallazgo.id || ('HAL-' + Date.now()) },
      fuente: 'mock-local'
    });
  }

  function eliminarHallazgo(empresaId, id) {
    if (!empresaId || !id) return Promise.reject(new Error('Faltan parámetros'));
    if (_hasAPI()) {
      return window.electronAPI.auditoriaAnual.eliminarHallazgo(empresaId, id)
        .then(function (resp) {
          if (resp && resp.success) _cache.lastLoad = 0;
          return resp;
        });
    }
    HALLAZGOS_MOCK = HALLAZGOS_MOCK.filter(function (h) { return h.id !== id; });
    return Promise.resolve({ success: true, fuente: 'mock-local' });
  }

  /* F4 — Exportar a XLSX (devuelve ruta del archivo generado) */
  function exportarXlsx(empresaId) {
    if (!empresaId) return Promise.reject(new Error('Falta empresaId'));
    if (_hasAPI()) {
      return window.electronAPI.auditoriaAnual.exportarXlsx(empresaId)
        .then(function (resp) {
          if (resp && resp.success) _cache.lastLoad = 0;
          return resp;
        });
    }
    return Promise.resolve({ success: false, error: { code: 'NO_API', message: 'Exportación XLSX requiere ElectronAPI' } });
  }

  /* F4 — Importar desde XLSX */
  function importarXlsx(empresaId, archivoPath) {
    if (!empresaId || !archivoPath) return Promise.reject(new Error('Faltan parámetros'));
    if (_hasAPI()) {
      return window.electronAPI.auditoriaAnual.importarXlsx(empresaId, archivoPath)
        .then(function (resp) {
          if (resp && resp.success) _cache.lastLoad = 0;
          return resp;
        });
    }
    return Promise.resolve({ success: false, error: { code: 'NO_API', message: 'Importación XLSX requiere ElectronAPI' } });
  }

  /* F4 — Mostrar diálogo nativo para elegir archivo a importar */
  function seleccionarArchivoImportar() {
    if (_hasAPI()) {
      return window.electronAPI.auditoriaAnual.seleccionarArchivoImportar();
    }
    return Promise.resolve({ success: false, error: { code: 'NO_API', message: 'Selección de archivo requiere ElectronAPI' } });
  }

  /* ── Helpers síncronos sobre el cache (compatibilidad con código existente) ── */

  function getAuditorias() {
    return (_cache.auditorias || AUDITORIAS_MOCK).slice();
  }

  function getAuditoriaById(id) {
    return getAuditorias().find(function (a) { return a.id === id; }) || null;
  }

  function getAuditoriasByTrimestre(trimestre) {
    return getAuditorias().filter(function (a) { return a.trimestre === trimestre; });
  }

  function getAuditoriasByEstado(estado) {
    return getAuditorias().filter(function (a) { return a.estado === estado; });
  }

  function getHallazgos() {
    return (_cache.hallazgos || HALLAZGOS_MOCK).slice();
  }

  function getHallazgosByAuditoria(auditoriaId) {
    return getHallazgos().filter(function (h) { return h.auditoriaId === auditoriaId; });
  }

  function getHallazgosByEstado(estado) {
    return getHallazgos().filter(function (h) { return h.estado === estado; });
  }

  function getKpiStats() {
    var auds = getAuditorias();
    var hals = getHallazgos();
    var total = auds.length;
    var completadas = auds.filter(function (a) { return a.estado === 'completada'; }).length;
    var enProgreso = auds.filter(function (a) { return a.estado === 'en-progreso'; }).length;
    var programadas = auds.filter(function (a) { return a.estado === 'programada'; }).length;
    var totalHallazgos = hals.length;
    var hallazgosCriticos = hals.filter(function (h) { return h.severidad === 'critico'; }).length;
    var hallazgosAbiertos = hals.filter(function (h) { return h.estado !== 'cerrado'; }).length;
    var calificacionProm = 0;
    var auditCalificadas = auds.filter(function (a) { return a.calificacion !== null && a.calificacion !== undefined; });
    if (auditCalificadas.length > 0) {
      var sum = auditCalificadas.reduce(function (s, a) { return s + a.calificacion; }, 0);
      calificacionProm = Math.round(sum / auditCalificadas.length);
    }
    return {
      total: total,
      completadas: completadas,
      enProgreso: enProgreso,
      programadas: programadas,
      totalHallazgos: totalHallazgos,
      hallazgosCriticos: hallazgosCriticos,
      hallazgosAbiertos: hallazgosAbiertos,
      calificacionProm: calificacionProm
    };
  }

  function getCronogramaData() {
    var meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var auds = getAuditorias();
    var data = meses.map(function (mes, idx) {
      var mesNum = idx + 1;
      var audsMes = auds.filter(function (a) {
        if (!a.fechaInicio) return false;
        var inicio = new Date(a.fechaInicio);
        var fin = new Date(a.fechaFin || a.fechaInicio);
        return (inicio.getMonth() + 1 === mesNum) || (fin.getMonth() + 1 === mesNum);
      });
      return {
        mes: mes,
        mesNum: mesNum,
        auditorias: audsMes.length,
        completadas: audsMes.filter(function (a) { return a.estado === 'completada'; }).length,
        programadas: audsMes.filter(function (a) { return a.estado === 'programada'; }).length,
        enProgreso: audsMes.filter(function (a) { return a.estado === 'en-progreso'; }).length
      };
    });
    return data;
  }

  /** Útil para diagnóstico: devuelve metadatos del estado actual del service. */
  function getInfo() {
    return {
      hasAPI: _hasAPI(),
      cacheLoaded: !!_cache.auditorias,
      fuente: _cache.fuente,
      auditorias: (_cache.auditorias || []).length,
      hallazgos: (_cache.hallazgos || []).length,
      lastLoad: _cache.lastLoad ? new Date(_cache.lastLoad).toISOString() : null,
      ttlMs: CACHE_TTL_MS
    };
  }

  return {
    cargarTodo: cargarTodo,
    guardarAuditoria: guardarAuditoria,
    eliminarAuditoria: eliminarAuditoria,
    guardarHallazgo: guardarHallazgo,
    eliminarHallazgo: eliminarHallazgo,
    exportarXlsx: exportarXlsx,
    importarXlsx: importarXlsx,
    seleccionarArchivoImportar: seleccionarArchivoImportar,
    getAuditorias: getAuditorias,
    getAuditoriaById: getAuditoriaById,
    getAuditoriasByTrimestre: getAuditoriasByTrimestre,
    getAuditoriasByEstado: getAuditoriasByEstado,
    getHallazgos: getHallazgos,
    getHallazgosByAuditoria: getHallazgosByAuditoria,
    getHallazgosByEstado: getHallazgosByEstado,
    getKpiStats: getKpiStats,
    getCronogramaData: getCronogramaData,
    getInfo: getInfo,
    /* Utilidades para invalidar cache desde fuera */
    invalidateCache: function () { _cache.lastLoad = 0; }
  };
})();

window.AuditoriaService = AuditoriaService;
