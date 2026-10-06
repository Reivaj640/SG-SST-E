class KAIRToast {
  constructor() {
    this._hub = null;
    this._maxToasts = 3;
  }

  // 📦829 — El toast lo puede pedir un IFRAME que navega y se destruye justo
  // despues de mostrarlo (p. ej. el 3.1.2: mostrar "Programa eliminado" y
  // volver a la lista borra el iframe con container.innerHTML=''). Si los
  // timers (auto-cierre y retiro del nodo) y el onclick de la X vivieran en
  // el realm del iframe, moririan con el y el toast quedaria pegado en
  // pantalla para siempre. Por eso se DELEGA al KAIRToast de la ventana que
  // SOBREVIVE (la principal, que index.html carga siempre): ahi se crean el
  // nodo, los timers y el handler, y ninguno depende del iframe.
  // Verificado con Temp/probe-toast-829.js (reproduccion del bug).
  _instanciaQueSobrevive() {
    try {
      var w = window;
      while (w.parent && w.parent !== w) {
        w = w.parent;
        if (w.KAIRToast && typeof w.KAIRToast.show === 'function' && w.KAIRToast !== this) {
          return w.KAIRToast;
        }
      }
    } catch (e) {
      // ventana cruzada (cross-origin): se usa la instancia local.
    }
    return null;
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
    // 📦829 — delegar al KAIRToast de la ventana que sobrevive (ver arriba).
    const vivo = this._instanciaQueSobrevive();
    if (vivo) return vivo.show(message, type, { subtitle, autoClose });

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
