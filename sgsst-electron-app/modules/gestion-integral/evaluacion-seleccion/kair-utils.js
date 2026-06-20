/* ==========================================================================
   K+AIR Utils — Utilidades compartidas para el módulo 2.10.1
   Evaluación y Selección de Proveedores y Contratistas
   ========================================================================== */

(function () {
  'use strict';

  const KAIRUtils = {
    generateId: function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },

    formatDate: function (isoString) {
      if (!isoString) return '—';
      try {
        const date = new Date(isoString);
        return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch {
        return isoString;
      }
    },

    formatDateLong: function (isoString) {
      if (!isoString) return '—';
      try {
        const date = new Date(isoString);
        return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
      } catch {
        return isoString;
      }
    },

    todayISO: function () {
      return new Date().toISOString().split('T')[0];
    },

    nowISO: function () {
      return new Date().toISOString();
    },

    average: function (values) {
      if (!values || values.length === 0) return 0;
      const sum = values.reduce(function (acc, v) { return acc + (Number(v) || 0); }, 0);
      return sum / values.length;
    },

    classifyScore: function (score) {
      if (score >= 3.1) return 'BUENO';
      if (score >= 2.6) return 'REGULAR';
      return 'DEFICIENTE';
    },

    getClasificacionLabel: function (clasificacion) {
      var labels = { BUENO: 'Bueno', REGULAR: 'Regular', DEFICIENTE: 'Deficiente' };
      return labels[clasificacion] || clasificacion;
    },

    getClasificacionBadgeClass: function (clasificacion) {
      var classes = { BUENO: 'kair-badge--success', REGULAR: 'kair-badge--warning', DEFICIENT: 'kair-badge--danger' };
      return classes[clasificacion] || 'kair-badge--secondary';
    },

    getTipoLabel: function (tipo) {
      return tipo === 'PROVEEDOR' ? 'Proveedor' : 'Contratista';
    },

    getEstadoLabel: function (estado) {
      var labels = { ACTIVO: 'Activo', INACTIVO: 'Inactivo' };
      return labels[estado] || estado;
    },

    getNCEstadoLabel: function (estado) {
      var labels = { ABIERTA: 'Abierta', EN_SEGUIMIENTO: 'En seguimiento', CERRADA: 'Cerrada' };
      return labels[estado] || estado;
    },

    getNCEstadoBadgeClass: function (estado) {
      var classes = { ABIERTA: 'kair-badge--danger', EN_SEGUIMIENTO: 'kair-badge--warning', CERRADA: 'kair-badge--success' };
      return classes[estado] || 'kair-badge--secondary';
    },

    required: function (value, fieldName) {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return fieldName + ' es requerido';
      }
      return null;
    },

    validateEmail: function (email) {
      if (!email) return null;
      var regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!regex.test(email)) return 'El formato del correo electrónico no es válido';
      return null;
    },

    showToast: function (message, type) {
      if (type === undefined) type = 'info';
      var container = document.getElementById('kair-toast-container-es');
      if (!container) {
        container = document.createElement('div');
        container.id = 'kair-toast-container-es';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(container);
      }

      var icons = {
        success: '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
        danger: '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
        warning: '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
        info: '<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>',
      };

      var toast = document.createElement('div');
      toast.className = 'kair-toast kair-toast--' + type;
      toast.innerHTML =
        '<span class="kair-toast__icon">' + (icons[type] || icons.info) + '</span>' +
        '<span class="kair-toast__message">' + KAIRUtils.escapeHtml(message) + '</span>';
      toast.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fff;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:14px;opacity:1;transform:translateX(0);transition:all 0.3s ease;';
      if (type === 'success') toast.style.borderLeft = '4px solid #28a745';
      else if (type === 'danger') toast.style.borderLeft = '4px solid #dc3545';
      else if (type === 'warning') toast.style.borderLeft = '4px solid #ffc107';
      else toast.style.borderLeft = '4px solid #17a2b8';

      container.appendChild(toast);
      setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(function () { toast.remove(); }, 300);
      }, 3500);
    },

    showConfirm: function (message) {
      return new Promise(function (resolve) {
        var overlay = document.createElement('div');
        overlay.className = 'kair-confirm-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        overlay.innerHTML =
          '<div class="kair-confirm" style="background:#fff;padding:24px;border-radius:8px;max-width:400px;width:90%;text-align:center;">' +
            '<div class="kair-confirm__message" style="margin-bottom:20px;font-size:15px;">' + KAIRUtils.escapeHtml(message) + '</div>' +
            '<div class="kair-confirm__actions" style="display:flex;gap:10px;justify-content:center;">' +
              '<button class="kair-confirm-cancel" style="padding:8px 20px;border:1px solid #dee2e6;background:#f8f9fa;border-radius:4px;cursor:pointer;">Cancelar</button>' +
              '<button class="kair-confirm-ok" style="padding:8px 20px;border:none;background:#dc3545;color:#fff;border-radius:4px;cursor:pointer;">Confirmar</button>' +
            '</div>' +
          '</div>';

        overlay.querySelector('.kair-confirm-cancel').addEventListener('click', function () { overlay.remove(); resolve(false); });
        overlay.querySelector('.kair-confirm-ok').addEventListener('click', function () { overlay.remove(); resolve(true); });
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) { overlay.remove(); resolve(false); }
        });

        document.body.appendChild(overlay);
      });
    },

    escapeHtml: function (text) {
      if (!text) return '';
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    getRequiredDocuments: function (tipo) {
      if (tipo === 'PROVEEDOR') {
        return [
          { key: 'camaraComercio', label: 'Cámara de comercio' },
          { key: 'rut', label: 'RUT' },
          { key: 'cedulaRepresentante', label: 'Cédula representante legal' },
          { key: 'formatoRegistro', label: 'Formato registro proveedores' },
          { key: 'certificacionBancaria', label: 'Certificaciones bancarias' },
        ];
      }
      if (tipo === 'CONTRATISTA') {
        return [
          { key: 'camaraComercio', label: 'Cámara de comercio' },
          { key: 'rut', label: 'RUT' },
          { key: 'certificacionBancaria', label: 'Certificación bancaria' },
          { key: 'certificadosSGSST', label: 'Certificados SG-SST (si aplica)' },
          { key: 'hojasSeguridad', label: 'Hojas seguridad / MSDS (químicos)' },
          { key: 'fichasTecnicas', label: 'Fichas técnicas' },
          { key: 'cedulaRepresentante', label: 'Cédula representante legal' },
        ];
      }
      return [];
    },

    getSelectionCriteria: function () {
      return [
        { key: 'precio', label: 'Precio', desc1: 'Mayor al valor de mercado', desc3: 'Igual al valor de mercado', desc5: 'Menor al valor de mercado' },
        { key: 'disponibilidad', label: 'Disponibilidad', desc1: 'Después de 5 días', desc3: '≤ 5 días', desc5: 'Inmediata' },
        { key: 'experiencia', label: 'Experiencia en el mercado', desc1: 'Menor a 3 años', desc3: 'Entre 3 y 5 años', desc5: 'Mayor a 10 años' },
        { key: 'calidad', label: 'Calidad del producto', desc1: 'No cumple', desc3: 'Cumple', desc5: 'Supera' },
        { key: 'marca', label: 'Marca', desc1: 'No reconocida', desc3: '—', desc5: 'Reconocida' },
        { key: 'requisitosLegales', label: 'Cumplimiento requisitos mínimos legales', desc1: 'No cumple', desc3: '—', desc5: 'Sí cumple' },
      ];
    },

    getReevaluationCriteria: function () {
      return [
        { key: 'calidad', label: 'Calidad', desc1: 'No cumple estándares', desc3: 'Problemas parciales', desc5: 'Sin problemas' },
        { key: 'tiempoEntrega', label: 'Tiempo de entrega', desc1: 'Mayor a 4 días', desc3: '1-2 días después', desc5: 'En tiempo' },
        { key: 'cantidadesPactadas', label: 'Cantidades pactadas', desc1: 'No cumple', desc3: 'Parcial con justificación', desc5: 'Cumple' },
        { key: 'gestionFacturacion', label: 'Gestión de facturación', desc1: 'No entregan', desc3: '—', desc5: 'Con factura y remisión' },
        { key: 'garantia', label: 'Garantía', desc1: 'No aplican', desc3: '—', desc5: 'Aplican inmediata' },
        { key: 'sst', label: 'SST (solo contratistas)', desc1: 'Menor a 70%', desc3: '71% - 80%', desc5: 'Igual o mayor a 81%', onlyContratista: true },
      ];
    },

    getTrend: function (current, previous) {
      if (previous === null || previous === undefined) return null;
      var diff = current - previous;
      if (Math.abs(diff) < 0.05) return 'same';
      return diff > 0 ? 'up' : 'down';
    },

    getTrendInfo: function (trend) {
      if (trend === 'up') return { label: 'Mejoró', color: 'kair-trend--up', icon: '\u2191' };
      if (trend === 'down') return { label: 'Empeoró', color: 'kair-trend--down', icon: '\u2193' };
      return { label: 'Mantuvo', color: 'kair-trend--same', icon: '\u2192' };
    },

    capitalize: function (str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
  };

  window.KAIRUtils = KAIRUtils;
})();
