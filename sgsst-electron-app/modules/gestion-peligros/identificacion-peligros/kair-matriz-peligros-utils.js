/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
utils.js — Helpers: GTC-45, escape, toasts, modales, logging
========================================================================== */
(function (global) {
  'use strict';

  var KM = {};

  KM.esc = function (s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  /* GTC-45 */
  KM.GTC45 = {
    nd: [
      { value: 0, label: '0 — No existe', short: '0' },
      { value: 1, label: '1 — Muy Bajo', short: '1' },
      { value: 2, label: '2 — Bajo', short: '2' },
      { value: 3, label: '3 — Medio', short: '3' },
      { value: 4, label: '4 — Alto', short: '4' },
      { value: 5, label: '5 — Muy Alto', short: '5' }
    ],
    ne: [
      { value: 1, label: '1 — Esporádica', short: '1' },
      { value: 2, label: '2 — Ocasional', short: '2' },
      { value: 3, label: '3 — Frecuente', short: '3' },
      { value: 4, label: '4 — Continua', short: '4' }
    ],
    /* F439.8 (2026-06-24): GTC-45 Tabla 6 — Niveles de Consecuencia.
     Etiquetas alineadas con la tabla oficial del PDF GTC_45_2012:
     10 → Leve (L) - Lesiones que no requieren incapacidad
     25 → Grave (G) - Lesiones con incapacidad laboral temporal
     60 → Muy Grave (MG) - Incapacidad permanente parcial o invalidez
     100 → Mortal/Catastrófico (M) - Muerte(s) */
    nc: [
      { value: 10,  label: '10 — Leve (L)',                   short: '10' },
      { value: 25,  label: '25 — Grave (G)',                  short: '25' },
      { value: 60,  label: '60 — Muy Grave (MG)',             short: '60' },
      { value: 100, label: '100 — Mortal/Catastrófico (M)',   short: '100' }
    ],
    tipos: ['Físico', 'Químico', 'Biológico', 'Psicosocial', 'Ergonómico', 'Mecánico', 'Eléctrico', 'Locativo', 'Fenómenos Naturales', 'Público', 'Biomecánico', 'De seguridad', 'De seguridad (Locativo)', 'Físico-Químico', 'Transito', 'Sin clasificar']
  };

KM.calcNP = function (nd, ne) {
    if (nd == null || ne == null) return null;
    return Number(nd) * Number(ne);
  };

  KM.calcNR = function (np, nc) {
    if (np == null || nc == null) return null;
    return Number(np) * Number(nc);
  };

  /* F439.7 (2026-06-24): GTC-45 Tabla 23 — Nivel de Probabilidad (NP = ND × NE).
     Rangos oficiales:
       NP 0-4   → BAJO
       NP 5-8   → MEDIO
       NP 9-40  → ALTO */
  KM.interpNP = function (np) {
    if (np == null) return { label: '', tone: '' };
    if (np <= 4)  return { label: 'BAJO', tone: 'bajo' };
    if (np <= 8)  return { label: 'MEDIO', tone: 'medio' };
    return { label: 'ALTO', tone: 'alto' };
  };

  /* F439.7 (2026-06-24): GTC-45 Tabla 25 — Aceptabilidad del Riesgo.
     Convención: I = mejor (Aceptable), V = peor (No aceptable nivel 3).
     Rangos oficiales:
       NR ≤ 20       → Nivel I  — Aceptable
       NR 21-100     → Nivel II — Aceptable con control específico
       NR 101-300    → Nivel III — Mejorable (No aceptable)
       NR 301-600    → Nivel IV — No aceptable nivel 1
       NR > 600      → Nivel V  — No aceptable nivel 2 (catastrófico) */
  KM.interpNR = function (nr) {
    if (nr == null || nr === '') return { nivel: '', label: '', tone: '' };
    if (nr > 600)  return { nivel: 'V',   label: 'NO ACEPTABLE NIVEL 2',           tone: 'danger' };
    if (nr > 300)  return { nivel: 'IV',  label: 'NO ACEPTABLE NIVEL 1',           tone: 'danger' };
    if (nr > 100)  return { nivel: 'III', label: 'MEJORABLE / NO ACEPTABLE',      tone: 'warning' };
    if (nr > 20)   return { nivel: 'II',  label: 'ACEPTABLE CON CONTROL ESPECIFICO', tone: 'info' };
    return { nivel: 'I', label: 'ACEPTABLE', tone: 'success' };
  };

  /* F439.7 (2026-06-24): Clasifica nivel de riesgo (1-5) según NR — convención GTC-45:
     1 = mejor (Aceptable), 5 = peor (No aceptable nivel 2) */
  KM.nivelRiesgo = function (nr) {
    if (nr == null) return 0;
    if (nr > 600) return 5;
    if (nr > 300) return 4;
    if (nr > 100) return 3;
    if (nr > 20)  return 2;
    return 1;
  };

  /* Cuenta y agrega estadísticas */
  KM.calcStats = function (matriz) {
    if (!matriz || !matriz.sedes) return null;
    var total = 0, evaluados = 0, totalSedes = matriz.sedes.length;
    var totalExpuestos = 0;
    var porNivel = { I: 0, II: 0, III: 0, IV: 0, V: 0 };
    var porTipo = {}, porSede = {};
    var nivelGlobalMax = 0;

    matriz.sedes.forEach(function (s) {
      var sName = s.nombre || '';
      var sCount = 0;
      (s.procesos || []).forEach(function (p) {
        (p.cargos || []).forEach(function (c) {
          (c.peligros || []).forEach(function (pel) {
            total++;
            sCount++;
            if (pel.nd != null && pel.ne != null && pel.nc != null) evaluados++;
            if (pel.expuestos) totalExpuestos += Number(pel.expuestos) || 0;
            var nr = pel.nr;
            var nivel = KM.nivelRiesgo(nr);
            if (nivel > nivelGlobalMax) nivelGlobalMax = nivel;
            // Mapear NR-> nivel I-V
            if (nivel === 1) porNivel.I++;
            else if (nivel === 2) porNivel.II++;
            else if (nivel === 3) porNivel.III++;
            else if (nivel === 4) porNivel.IV++;
            else if (nivel === 5) porNivel.V++;
            if (pel.tipo) porTipo[pel.tipo] = (porTipo[pel.tipo] || 0) + 1;
          });
        });
      });
      if (sCount > 0) porSede[sName] = sCount;
    });

    return {
      total: total,
      totalSedes: totalSedes,
      totalExpuestos: totalExpuestos,
      evaluados: evaluados,
      porNivel: porNivel,
      porTipo: porTipo,
      porSede: porSede,
      nivelGlobalMax: nivelGlobalMax
    };
  };

  KM.log = function (modulo, accion, status, extra) {
    var tag = '[K+AIRSST][' + modulo + '][' + accion + '][' + status + ']';
    if (extra != null) tag += ' ' + extra;
    if (status === 'ERROR') console.error(tag);
    else if (status === 'WARNING') console.warn(tag);
    else console.log(tag);
  };

  KM.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  };

  /* Notificaciones — usa el sistema estándar del proyecto (window.updateNotifier)
     Compatible con la API de 6.1.3 / 6.1.2 / 6.2.4 / 7.1.1.
     Firma nueva (recomendada):  KM.notify(title, subtitle, type, autoClose)
     Firma legacy (compatible):  KM.toast(msg, type, duration)
       donde type es 'success'|'error'|'warning'|'info' y duration es ms (opcional) */
  KM.notify = function (title, subtitle, type, autoClose) {
    type = type || 'info';
    autoClose = autoClose || (type === 'error' ? 6000 : type === 'warning' ? 4000 : 5000);

    /* Preferir el sistema estándar del proyecto */
    if (typeof window !== 'undefined' && window.updateNotifier && typeof window.updateNotifier.show === 'function') {
      window.updateNotifier.show({
        type: type,
        title: title,
        subtitle: subtitle || '',
        autoClose: autoClose
      });
      return;
    }

    /* Fallback: toast efímero propio */
    KM._legacyToast(title, subtitle, type, autoClose);
  };

  /* Wrapper con firma legacy: KM.toast(msg, type, duration) */
  KM.toast = function (msg, type, duration) {
    if (typeof type === 'string' && /^(success|error|warning|info)$/i.test(type)) {
      /* Firma legacy: (msg, type, duration?) */
      var subtitle = '';
      if (typeof duration === 'number') {
        return KM.notify(msg, '', type, duration);
      }
      return KM.notify(msg, '', type);
    }
    /* Si solo pasaron (msg) o (msg, duration), tratar msg como title */
    if (typeof type === 'number') {
      return KM.notify(msg, '', 'info', type);
    }
    return KM.notify(msg, '', 'info');
  };

  /* Fallback toast efímero (DOM propio) */
  KM._legacyToast = function (title, subtitle, type, autoClose) {
    var existing = document.getElementById('km-toast-active');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.id = 'km-toast-active';
    el.className = 'km-toast km-toast--' + (type || 'info');
    var iconMap = { success: 'check-circle-fill', error: 'x-circle-fill', warning: 'exclamation-triangle-fill', info: 'info-circle-fill' };
    el.innerHTML =
      '<i class="bi bi-' + (iconMap[type] || 'check-circle-fill') + '"></i> ' +
      '<div class="km-toast__text">' +
        '<strong>' + KM.esc(title) + '</strong>' +
        (subtitle ? '<div class="km-toast__sub">' + KM.esc(subtitle) + '</div>' : '') +
      '</div>';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, autoClose || 4000);
  };

  /* Modal genérico */
  KM.modal = function (opts) {
    opts = opts || {};
    var overlay = document.createElement('div');
    overlay.className = 'km-modal-overlay';
    overlay.innerHTML =
      '<div class="km-modal">' +
        '<div class="km-modal__header">' +
          '<h3 class="km-modal__title">' + KM.esc(opts.title || 'Mensaje') + '</h3>' +
          '<button type="button" class="km-modal__close" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="km-modal__body">' + (opts.body || '') + '</div>' +
        (opts.confirm || opts.cancel
          ? '<div class="km-modal__footer">' +
              (opts.cancel ? '<button type="button" class="km-btn km-btn--ghost" data-action="cancel">Cancelar</button>' : '') +
              '<button type="button" class="km-btn ' + (opts.danger ? 'km-btn--danger' : 'km-btn--primary') + '" data-action="confirm">' + KM.esc(opts.confirm || 'Aceptar') + '</button>' +
            '</div>'
          : '') +
      '</div>';
    document.body.appendChild(overlay);
    function close() { overlay.remove(); }
    overlay.querySelector('.km-modal__close').addEventListener('click', function () { if (typeof opts.onClose === 'function') opts.onClose(); close(); });
    var cancelBtn = overlay.querySelector('[data-action="cancel"]');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { if (typeof opts.onCancel === 'function') opts.onCancel(); close(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { if (typeof opts.onClose === 'function') opts.onClose(); close(); } });
    var confirmBtn = overlay.querySelector('[data-action="confirm"]');
    if (confirmBtn) confirmBtn.addEventListener('click', function () { if (typeof opts.onConfirm === 'function') opts.onConfirm(); close(); });
    return { close: close, element: overlay };
  };

  global.KM = KM;
})(window);
