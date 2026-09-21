class KAIRToast {
  constructor() {
    this._hub = null;
    this._maxToasts = 3;
  }

  get hub() {
    if (!this._hub) {
      // 📦696 — Si estamos en un iframe, usar el hub del PARENT (donde SÍ está
      // el CSS de styles.css y el <div id="notification-hub">). El iframe
      // no carga styles.css (heredar estilos cross-frame es complejo), así
      // que el toast se ve sin estilo si se renderiza local.
      var isInIframe = (typeof window !== 'undefined' && window.parent && window.parent !== window);
      var doc = isInIframe ? window.parent.document : document;
      this._hub = doc.getElementById('notification-hub');
      if (!this._hub) {
        const el = doc.createElement('div');
        el.id = 'notification-hub';
        doc.body.appendChild(el);
        this._hub = el;
      }
    }
    return this._hub;
  }

  show(message, type = 'info', { subtitle, autoClose = 4000 } = {}) {
    const toastType = type === 'danger' ? 'error' : type;

    const existing = this.hub.querySelectorAll('.toast-card:not(.kair-toast-exit)');
    if (existing.length >= this._maxToasts) {
      this._removeToast(existing[0]);
    }

    const toast = document.createElement('div');
    toast.className = `toast-card toast-${toastType}`;

    const icons = {
      info: 'bi-info-circle-fill',
      success: 'bi-check-circle-fill',
      error: 'bi-exclamation-circle-fill',
      warning: 'bi-exclamation-triangle-fill'
    };

    toast.innerHTML = `
      <div class="toast-header">
        <div class="toast-icon bi-icon">
          <i class="bi ${icons[toastType] || icons.info}"></i>
        </div>
        <div class="toast-title-group">
          <div class="toast-title">${message}</div>
          ${subtitle ? `<div class="toast-subtitle">${subtitle}</div>` : ''}
        </div>
        <button class="toast-close"><i class="bi bi-x"></i></button>
      </div>
    `;

    toast.querySelector('.toast-close').onclick = () => this._removeToast(toast);

    this.hub.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add('show');

    if (autoClose > 0) {
      setTimeout(() => this._removeToast(toast), autoClose);
    }

    return toast;
  }

  _removeToast(toast) {
    if (!toast || toast.classList.contains('kair-toast-exit')) return;
    toast.classList.add('kair-toast-exit');
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 400);
  }
}

window.KAIRToast = new KAIRToast();
