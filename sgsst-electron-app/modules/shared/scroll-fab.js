/**
 * 📦640 (2026-07-31) — ScrollToTopBottomButton
 *
 * Botón flotante (FAB) que:
 *  - Muestra una flecha hacia ABAJO cuando el user NO está al final del scroll
 *  - Muestra una flecha hacia ARRIBA cuando el user está al final del scroll
 *  - Click → scroll suave al extremo correspondiente (bottom ↔ top)
 *  - Se oculta solo si la tabla cabe entera en pantalla (no hay nada que scrollear)
 *
 * Es un componente reusable: se puede inicializar en cualquier vista que tenga
 * un contenedor scrollable (tabla, lista, panel, etc.) sin importar el módulo.
 *
 * Uso típico:
 *   const fab = new ScrollToTopBottomButton({
 *       target: '#ver-ausentismo-scroll-wrapper',  // o window (default)
 *       color: '#174ea6',                          // default: azul K+AIR
 *   });
 *   fab.init();
 *   // ... cuando se desmonta la vista:
 *   fab.destroy();
 *
 * Opciones:
 *   target    {string|HTMLElement|Window}  Elemento scrollable a controlar.
 *                                           Default: window.
 *   threshold {number}                     Distancia en px para considerar
 *                                           que estamos "al final" / "al inicio".
 *                                           Default: 50.
 *   color     {string}                     Color de fondo del FAB. Default '#174ea6'.
 *   size      {number}                     Tamaño en px. Default 48.
 *   position  {'bottom-right'|'bottom-left'} Default 'bottom-right'.
 *   bottom    {number}                     Offset desde el bottom en px. Default 24.
 *   right     {number}                     Offset desde la derecha en px. Default 24.
 *   zIndex    {number}                     Default 9999.
 */
class ScrollToTopBottomButton {
    constructor(options = {}) {
        this.options = Object.assign({
            target: window,
            threshold: 50,
            color: '#174ea6',
            size: 48,
            position: 'bottom-right',
            bottom: 24,
            right: 24,
            zIndex: 9999
        }, options);

        this.btn = null;
        this._scrollEl = null;
        this._onScroll = this._update.bind(this);
        this._onResize = this._update.bind(this);
        this._onClick = this._handleClick.bind(this);
    }

    /**
     * Resuelve el target a un elemento DOM (o window). Maneja selector o HTMLElement.
     */
    _resolveTarget() {
        const t = this.options.target;
        if (!t || t === window) return window;
        if (typeof t === 'string') return document.querySelector(t);
        return t;
    }

    /**
     * Crea el botón, lo agrega al DOM y conecta los listeners.
     */
    init() {
        if (this.btn) return; // ya inicializado
        this._scrollEl = this._resolveTarget();

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kair-scroll-fab';
        btn.setAttribute('aria-label', 'Ir al final');
        btn.title = 'Ir al final';
        this._applyStyles(btn);
        btn.innerHTML = this._arrowDownSvg();
        btn.addEventListener('click', this._onClick);
        document.body.appendChild(btn);
        this.btn = btn;

        this._scrollEl.addEventListener('scroll', this._onScroll, { passive: true });
        // 📦640 (fix2) — También escuchar scroll de window por si el target
        // no scrollea (height:100% colapsado) y la ventana termina siendo
        // quien realmente scrollea. Solo si el target NO es window mismo.
        if (this._scrollEl !== window) {
            this._onWindowScroll = this._update.bind(this);
            window.addEventListener('scroll', this._onWindowScroll, { passive: true });
        }
        window.addEventListener('resize', this._onResize);
        // Estado inicial (en caso de que ya haya scroll al cargar)
        this._update();
    }

    /**
     * Elimina el botón del DOM y desconecta los listeners.
     */
    destroy() {
        if (!this.btn) return;
        this.btn.removeEventListener('click', this._onClick);
        if (this._scrollEl) this._scrollEl.removeEventListener('scroll', this._onScroll);
        if (this._onWindowScroll) window.removeEventListener('scroll', this._onWindowScroll);
        window.removeEventListener('resize', this._onResize);
        this.btn.remove();
        this.btn = null;
        this._scrollEl = null;
    }

    _applyStyles(btn) {
        const isLeft = this.options.position === 'bottom-left';
        btn.style.cssText = [
            'position: fixed',
            `bottom: ${this.options.bottom}px`,
            `${isLeft ? 'left' : 'right'}: ${this.options.right}px`,
            `width: ${this.options.size}px`,
            `height: ${this.options.size}px`,
            'border-radius: 50%',
            `background: ${this.options.color}`,
            'color: #fff',
            'border: none',
            'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18)',
            'cursor: pointer',
            'display: flex',
            'align-items: center',
            'justify-content: center',
            `z-index: ${this.options.zIndex}`,
            'transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease',
            'opacity: 1',
            'pointer-events: auto',
            'padding: 0',
            'outline: none'
        ].join(';');
        // Hover scale (CSS nativo via :hover via inline no aplica — usamos eventos)
        btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.08)'; btn.style.background = this._shade(this.options.color, -10); });
        btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; btn.style.background = this.options.color; });
        btn.addEventListener('mousedown', () => { btn.style.transform = 'scale(0.96)'; });
        btn.addEventListener('mouseup', () => { btn.style.transform = 'scale(1.08)'; });
    }

    _arrowDownSvg() {
        // 24x24 viewBox, trazo blanco. Independiente de FontAwesome (cero red).
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 5V19M12 19L6 13M12 19L18 13" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    _arrowUpSvg() {
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 19V5M12 5L6 11M12 5L18 11" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    /**
     * Oscurece (factor negativo) o aclara (positivo) un color hex.
     * factor en -100..100.
     */
    _shade(hex, factor) {
        const m = hex.replace('#', '');
        if (m.length !== 6) return hex;
        const num = parseInt(m, 16);
        let r = (num >> 16) & 0xff;
        let g = (num >> 8) & 0xff;
        let b = num & 0xff;
        const f = factor / 100;
        r = Math.max(0, Math.min(255, Math.round(r + (f < 0 ? r : 255 - r) * f)));
        g = Math.max(0, Math.min(255, Math.round(g + (f < 0 ? g : 255 - g) * f)));
        b = Math.max(0, Math.min(255, Math.round(b + (f < 0 ? b : 255 - b) * f)));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    _isAtTop() {
        const el = this._getEffectiveScrollEl();
        const top = el === window
            ? (window.scrollY || document.documentElement.scrollTop || 0)
            : (el.scrollTop || 0);
        return top <= this.options.threshold;
    }

    _isAtBottom() {
        const threshold = this.options.threshold;
        const el = this._getEffectiveScrollEl();
        if (el === window) {
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            const innerH = window.innerHeight;
            const docH = Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight
            );
            return (scrollY + innerH) >= (docH - threshold);
        }
        return (el.scrollTop + el.clientHeight) >= (el.scrollHeight - threshold);
    }

    /**
     * 📦640 (fix2) — Elige el elemento que REALMENTE está scrolleando.
     * Si el target configurado (ej. un wrapper con height:100% colapsado) no
     * tiene overflow, fallback automático al window. Así el botón siempre
     * controla el scroll que el user está viendo.
     */
    _getEffectiveScrollEl() {
        if (this._scrollEl === window) return window;
        if (!this._scrollEl) return window;
        try {
            const overflows = this._scrollEl.scrollHeight > (this._scrollEl.clientHeight + 1);
            if (overflows) return this._scrollEl;
        } catch (e) { /* ignore */ }
        return window;
    }

    _update() {
        if (!this.btn) return;
        // 📦640 (fix2) — Botón SIEMPRE visible. El icono cambia según la
        // posición de scroll. Antes se ocultaba cuando la tabla cabía
        // entera, pero eso confundía al user en ventanas chicas.
        this.btn.style.opacity = '1';
        this.btn.style.pointerEvents = 'auto';

        const atBottom = this._isAtBottom();
        if (atBottom) {
            this.btn.innerHTML = this._arrowUpSvg();
            this.btn.setAttribute('aria-label', 'Ir al inicio');
            this.btn.title = 'Ir al inicio';
        } else {
            this.btn.innerHTML = this._arrowDownSvg();
            this.btn.setAttribute('aria-label', 'Ir al final');
            this.btn.title = 'Ir al final';
        }
    }

    _handleClick() {
        const el = this._getEffectiveScrollEl();
        const atBottom = this._isAtBottom();
        if (atBottom) {
            if (el === window) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                el.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            if (el === window) {
                window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
            } else {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            }
        }
    }
}

// Exponer globalmente (patrón de la app, sin ES modules)
if (typeof window !== 'undefined') {
    window.ScrollToTopBottomButton = ScrollToTopBottomButton;
}
