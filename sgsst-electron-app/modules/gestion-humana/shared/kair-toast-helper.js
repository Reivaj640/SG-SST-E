// modules/gestion-humana/shared/kair-toast-helper.js
// Helper estandarizado de toasts para el módulo de Gestión Humana.
// Usa window.KAIRToast (sistema unificado de toda la app) con la estructura
// title + subtitle + type que pidió el user en Sep 2026.
//
// API:
//   const t = new GestionHumanaToast();        // o usar window.GestionHumanaToast (auto-instancia)
//   t.success('Título', 'Subtítulo opcional')
//   t.error('Título', 'Subtítulo opcional')
//   t.warning('Título', 'Subtítulo opcional')
//   t.info('Título', 'Subtítulo opcional')
//   t.show('Título', 'success|error|warning|info', { subtitle, autoClose })
//
// Si solo se pasa 1 argumento, va como title (compatibilidad con mensajes cortos).
// Si se pasa 2, el primero es title y el segundo subtitle.

(function () {
  'use strict';

  function getBaseToast() {
    // 📦696 — Mismo patrón que el resto de la app: si estamos en iframe,
    // usar el KAIRToast del parent (donde sí está el CSS de styles.css).
    if (typeof window === 'undefined') return null;
    if (window.parent && window.parent.KAIRToast && window.parent !== window) {
      return window.parent.KAIRToast;
    }
    return window.KAIRToast || null;
  }

  function GestionHumanaToast() {
    this._base = null;
  }

  GestionHumanaToast.prototype._get = function () {
    if (!this._base) this._base = getBaseToast();
    return this._base;
  };

  // Tipo + contenido en 1 línea (compatibilidad con mensajes cortos)
  GestionHumanaToast.prototype.show = function (title, type, opts) {
    var base = this._get();
    if (!base) {
      if (typeof console !== 'undefined') console.warn('[GH-Toast] KAIRToast no disponible:', title, type);
      return null;
    }
    return base.show(title, type, opts);
  };

  // Helpers tipados — title + subtitle opcional
  ['success', 'error', 'warning', 'info'].forEach(function (type) {
    GestionHumanaToast.prototype[type] = function (title, subtitle) {
      var opts = subtitle ? { subtitle: subtitle } : {};
      return this.show(title, type, opts);
    };
  });

  // API legacy: _showToast(msg, type) → mapea a la estructura nueva cuando hay detalle
  // Se mantiene en cada componente, pero ahora delega a este helper.
  // Esta función NO se exporta — cada componente ya tiene su _showToast local.

  // Auto-instancia global
  if (typeof window !== 'undefined') {
    window.GestionHumanaToast = new GestionHumanaToast();
  }
})();
