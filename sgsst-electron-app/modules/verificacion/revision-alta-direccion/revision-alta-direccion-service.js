/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — REVISIÓN POR LA ALTA DIRECCIÓN
 * Service · Renderer Process
 * Proxy IPC con fallback graceful
 * =====================================================================
 */

var RevisionAltaDireccionService = (function() {
  'use strict';

  function _hasAPI() {
    return !!(window.electronAPI && window.electronAPI.revisionAltaDireccion);
  }

  function _fallback(data) {
    return Promise.resolve({ success: false, data: data || null, error: { code: 'NO_API', message: 'ElectronAPI no disponible' } });
  }

  return {
    cargarTodo: function(empresaId) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.cargarTodo(empresaId);
      return _fallback({ programacion: [], actas: [], hallazgos: [], indicadores: [], documentos: [] });
    },

    listarRevisiones: function(empresaId, filtros) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.listarRevisiones(empresaId, filtros || {});
      return _fallback([]);
    },

    obtenerRevision: function(empresaId, id) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.obtenerRevision(empresaId, id);
      return _fallback(null);
    },

    crearRevision: function(empresaId, data) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.crearRevision(empresaId, data);
      return _fallback(null);
    },

    actualizarRevision: function(empresaId, id, cambios) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.actualizarRevision(empresaId, id, cambios);
      return _fallback(null);
    },

    cambiarEstadoRevision: function(empresaId, id, nuevoEstado) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.cambiarEstadoRevision(empresaId, id, nuevoEstado);
      return _fallback(null);
    },

    eliminarRevision: function(empresaId, id) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.eliminarRevision(empresaId, id);
      return _fallback(null);
    },

    listarActas: function(empresaId, filtros) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.listarActas(empresaId, filtros || {});
      return _fallback([]);
    },

    guardarActa: function(empresaId, acta) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.guardarActa(empresaId, acta);
      return _fallback(null);
    },

    listarIndicadores: function(empresaId) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.listarIndicadores(empresaId);
      return _fallback([]);
    },

    guardarIndicador: function(empresaId, indicador) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.guardarIndicador(empresaId, indicador);
      return _fallback(null);
    },

    importarXlsx: function(empresaId, archivoPath, tipoPlantilla) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.importarXlsx(empresaId, archivoPath, tipoPlantilla);
      return _fallback(null);
    },

    exportarXlsx: function(empresaId, tipoPlantilla, id) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.exportarXlsx(empresaId, tipoPlantilla, id);
      return _fallback(null);
    },

    subirDocumento: function(empresaId, buffer, metadata) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.subirDocumento(empresaId, buffer, metadata);
      return _fallback(null);
    },

    obtenerProcedimiento: function(empresaId) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.obtenerProcedimiento(empresaId);
      return _fallback(null);
    },

    abrirProcedimiento: function(empresaId) {
      if (_hasAPI()) return window.electronAPI.revisionAltaDireccion.abrirProcedimiento(empresaId);
      return _fallback(null);
    }
  };
})();

window.RevisionAltaDireccionService = RevisionAltaDireccionService;
