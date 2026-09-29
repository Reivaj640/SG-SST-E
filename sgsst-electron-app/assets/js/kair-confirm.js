// =====================================================================
// 📦708 (2026-08-15) — KairConfirm
// Modal de confirmación moderno para reemplazar `confirm()` nativo de Electron.
// Mismo lenguaje visual que KAIRToast (rounded card, icon, shadow, animation).
//
// API:
//   KairConfirm.confirm({
//     title: '¿Importar a BD?',
//     message: 'Esto crea un nuevo registro en la BD.',
//     confirmText: 'Importar',
//     cancelText: 'Cancelar',
//     type: 'info' | 'warning' | 'danger' | 'success'
//   })
//   → Promise<boolean>  (true si confirma, false si cancela)
//
//   KairConfirm.alert({
//     title: 'Error',
//     message: 'Algo salió mal',
//     type: 'error'
//   })
//   → Promise<void>  (se cierra al click en OK o Esc)
//
// 📦696 — Funciona tanto en el parent como en iframes (mismo patrón que
// KAIRToast: si estamos en un iframe, el DOM se crea en el parent).
// =====================================================================

class KairConfirm {
  constructor() {
    this._container = null;
    this._activeDialog = null;
    this._escHandler = null;
  }

  get container() {
    if (!this._container) {
      var isInIframe = (typeof window !== 'undefined' && window.parent && window.parent !== window);
      var doc = isInIframe ? window.parent.document : document;
      this._container = doc.getElementById('kair-confirm-container');
      if (!this._container) {
        const el = doc.createElement('div');
        el.id = 'kair-confirm-container';
        // Inyectar en el body del parent (o del doc actual)
        (isInIframe ? window.parent.document.body : doc.body).appendChild(el);
        this._container = el;
      }
    }
    return this._container;
  }

  /**
   * Muestra un dialog de confirmación. Devuelve Promise<boolean>.
   */
  confirm({
    title = '¿Confirmar?',
    message = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'info',
    details = null  // HTML opcional para info adicional
  } = {}) {
    var self = this;
    return new Promise(function (resolve) {
      self._render({
        title: title,
        message: message,
        details: details,
        confirmText: confirmText,
        cancelText: cancelText,
        type: type,
        showCancel: true,
        onResolve: resolve
      });
    });
  }

  /**
   * Muestra un dialog informativo (solo botón OK). Devuelve Promise<void>.
   */
  alert({
    title = 'Información',
    message = '',
    type = 'info',
    confirmText = 'OK'
  } = {}) {
    var self = this;
    return new Promise(function (resolve) {
      self._render({
        title: title,
        message: message,
        details: null,
        confirmText: confirmText,
        cancelText: null,
        type: type,
        showCancel: false,
        onResolve: function () { resolve(); }
      });
    });
  }

  /**
   * Muestra un dialog con campos de input. Devuelve Promise<object | null>.
   *   - Si el usuario confirma: Promise<{[key]: value}>
   *   - Si el usuario cancela: Promise<null>
   *
   * fields: array de { key, label, type, value, placeholder, required, options, default, multiple, accept }
   *   - type: 'text' | 'number' | 'textarea' | 'select' | 'file'
   *   - key: nombre de la clave devuelta (alias: name)
   *   - options (solo select): [{ value, label }] — value '' = opción vacía
   *   - default (solo select): valor preseleccionado
   *   - multiple/accept (solo file): selección múltiple y filtro (devuelve File[])
   */
  input({
    title = 'Ingresar datos',
    message = '',
    fields = [],
    confirmText = 'Guardar',
    cancelText = 'Cancelar',
    type = 'info'
  } = {}) {
    var self = this;
    return new Promise(function (resolve) {
      var fieldsHtml = fields.map(function (f, i) {
        var inputType = f.type || 'text';
        var required = f.required ? 'required' : '';
        var value = (f.value != null) ? String(f.value) : '';
        var placeholder = f.placeholder || '';
        var labelText = f.label + (f.required ? ' *' : '');
        if (inputType === 'file') {
          return '<div class="kair-input-group">' +
            '<label class="kair-input-label" for="kair-input-' + i + '">' + this._escapeHtml(labelText) + '</label>' +
            '<input class="kair-input" type="file" id="kair-input-' + i + '"' + (f.multiple ? ' multiple' : '') + (f.accept ? ' accept="' + this._escapeHtml(f.accept) + '"' : '') + ' />' +
          '</div>';
        }
        if (inputType === 'textarea') {
          return '<div class="kair-input-group">' +
            '<label class="kair-input-label" for="kair-input-' + i + '">' + this._escapeHtml(labelText) + '</label>' +
            '<textarea class="kair-input kair-textarea" id="kair-input-' + i + '" rows="' + (f.rows || 3) + '" placeholder="' + this._escapeHtml(placeholder) + '" ' + required + '>' + this._escapeHtml(value) + '</textarea>' +
          '</div>';
        }
        if (inputType === 'select') {
          var current = (f.value != null && f.value !== '') ? String(f.value) : (f.default != null ? String(f.default) : '');
          var opts = (f.options || []).map(function (o) {
            var v = (o && typeof o === 'object') ? o.value : o;
            var l = (o && typeof o === 'object') ? (o.label != null ? o.label : o.value) : o;
            var sel = String(v) === current ? ' selected' : '';
            return '<option value="' + this._escapeHtml(String(v == null ? '' : v)) + '"' + sel + '>' + this._escapeHtml(String(l == null ? '' : l)) + '</option>';
          }.bind(this)).join('');
          return '<div class="kair-input-group">' +
            '<label class="kair-input-label" for="kair-input-' + i + '">' + this._escapeHtml(labelText) + '</label>' +
            '<select class="kair-input" id="kair-input-' + i + '" ' + required + '>' + opts + '</select>' +
          '</div>';
        }
        return '<div class="kair-input-group">' +
          '<label class="kair-input-label" for="kair-input-' + i + '">' + this._escapeHtml(labelText) + '</label>' +
          '<input class="kair-input" type="' + inputType + '" id="kair-input-' + i + '" value="' + this._escapeHtml(value) + '" placeholder="' + this._escapeHtml(placeholder) + '" ' + required + ' />' +
        '</div>';
      }.bind(self)).join('');

      var inputContent =
        (message ? '<p class="kair-confirm-message">' + self._escapeHtml(message).replace(/\n/g, '<br>') + '</p>' : '') +
        '<div class="kair-inputs">' + fieldsHtml + '</div>';

      // Render base con un dialog estándar, después reemplazamos el contenido
      // del body. Para hacerlo, usamos un type custom que el _render detecta.
      self._render({
        title: title,
        message: '',
        details: inputContent,
        confirmText: confirmText,
        cancelText: cancelText,
        type: type,
        showCancel: true,
        onResolve: function (confirmed) {
          if (!confirmed) {
            resolve(null);
            return;
          }
          // Recoger valores
          var values = {};
          var valid = true;
          fields.forEach(function (f, i) {
            var inputEl = document.getElementById('kair-input-' + i);
            if (!inputEl) return;
            var key = f.key || f.name || ('field' + i);
            if (f.type === 'file') {
              var picked = inputEl.files ? Array.prototype.slice.call(inputEl.files) : [];
              if (f.required && picked.length === 0) {
                inputEl.style.borderColor = '#dc3545';
                valid = false;
                return;
              }
              values[key] = picked;
              return;
            }
            var raw = inputEl.value.trim();
            if (f.required && !raw) {
              inputEl.style.borderColor = '#dc3545';
              valid = false;
              return;
            }
            if (f.type === 'number') {
              var n = parseFloat(raw);
              values[key] = isNaN(n) ? 0 : n;
            } else {
              values[key] = raw;
            }
          });
          if (valid) resolve(values);
        }
      });
    });
  }

  _render(opts) {
    var self = this;
    // Cerrar cualquier dialog activo
    self._close();

    var icons = {
      info: 'bi-info-circle-fill',
      success: 'bi-check-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      danger: 'bi-exclamation-octagon-fill',
      error: 'bi-exclamation-circle-fill'
    };
    var iconClass = icons[opts.type] || icons.info;

    var isInIframe = (typeof window !== 'undefined' && window.parent && window.parent !== window);
    var doc = isInIframe ? window.parent.document : document;

    // Backdrop
    var backdrop = doc.createElement('div');
    backdrop.className = 'kair-confirm-backdrop';

    // Dialog
    var dialog = doc.createElement('div');
    dialog.className = 'kair-confirm-dialog kair-confirm-type-' + opts.type;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'kair-confirm-title');

    var confirmBtnClass = 'kair-btn kair-btn-' + (opts.type === 'danger' || opts.type === 'warning' ? 'danger' : 'primary');
    if (opts.type === 'success') confirmBtnClass = 'kair-btn kair-btn-success';

    var detailsHtml = '';
    if (opts.details) {
      detailsHtml = '<div class="kair-confirm-details">' + opts.details + '</div>';
    }

    var cancelHtml = '';
    if (opts.showCancel) {
      cancelHtml = '<button class="kair-btn kair-btn-secondary" data-action="cancel">' +
        (opts.cancelText || 'Cancelar') + '</button>';
    }

    dialog.innerHTML =
      '<div class="kair-confirm-icon">' +
        '<i class="bi ' + iconClass + '"></i>' +
      '</div>' +
      '<h3 class="kair-confirm-title" id="kair-confirm-title">' + this._escapeHtml(opts.title) + '</h3>' +
      (opts.message ? '<p class="kair-confirm-message">' + this._escapeHtml(opts.message).replace(/\n/g, '<br>') + '</p>' : '') +
      detailsHtml +
      '<div class="kair-confirm-actions">' +
        cancelHtml +
        '<button class="' + confirmBtnClass + '" data-action="confirm">' +
          (opts.confirmText || 'OK') +
        '</button>' +
      '</div>';

    backdrop.appendChild(dialog);
    self.container.appendChild(backdrop);
    self._activeDialog = backdrop;

    // Animar entrada (forzar reflow)
    void backdrop.offsetWidth;
    backdrop.classList.add('kair-confirm-show');

    // Focus en el botón de confirmar (o cancel si danger)
    setTimeout(function () {
      var primaryBtn = dialog.querySelector('[data-action="confirm"]');
      if (primaryBtn) primaryBtn.focus();
    }, 50);

    // Listeners
    var confirmed = false;
    var cleanup = function () {
      confirmed = true;
      self._close();
    };

    dialog.querySelector('[data-action="confirm"]').onclick = function () {
      cleanup();
      opts.onResolve(true);
    };
    if (opts.showCancel) {
      dialog.querySelector('[data-action="cancel"]').onclick = function () {
        cleanup();
        opts.onResolve(false);
      };
    }
    backdrop.onclick = function (e) {
      if (e.target === backdrop && opts.showCancel) {
        cleanup();
        opts.onResolve(false);
      }
    };

    // Esc para cancelar
    self._escHandler = function (e) {
      if (e.key === 'Escape' && opts.showCancel) {
        cleanup();
        opts.onResolve(false);
      } else if (e.key === 'Enter' && !confirmed) {
        // Enter confirma (pero solo si el foco no está en cancel)
        var cancelBtn = dialog.querySelector('[data-action="cancel"]');
        if (document.activeElement !== cancelBtn) {
          cleanup();
          opts.onResolve(true);
        }
      }
    };
    doc.addEventListener('keydown', self._escHandler);
  }

  _close() {
    if (this._activeDialog) {
      var self = this;
      this._activeDialog.classList.remove('kair-confirm-show');
      this._activeDialog.classList.add('kair-confirm-hide');
      var isInIframe = (typeof window !== 'undefined' && window.parent && window.parent !== window);
      var doc = isInIframe ? window.parent.document : document;
      if (this._escHandler) {
        doc.removeEventListener('keydown', this._escHandler);
        this._escHandler = null;
      }
      var dialog = this._activeDialog;
      setTimeout(function () {
        if (dialog && dialog.parentNode) dialog.remove();
      }, 250);
      this._activeDialog = null;
    }
  }

  _escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
}

window.KairConfirm = new KairConfirm();
