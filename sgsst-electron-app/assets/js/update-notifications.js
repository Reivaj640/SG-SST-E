/**
 * ==========================================
 * SISTEMA DE NOTIFICACIONES MODERNO - K+AIR
 * Gestor de Notificaciones de Actualizaciones
 * Diseño Limpio sin Franjas Laterales
 * ==========================================
 */

class UpdateNotificationManager {
    constructor() {
        this._hub = null;
        this.currentToast = null;
        this.currentVersion = null;
    }
    
        get hub() {
        if (!this._hub) {
            this._hub = document.getElementById('notification-hub');
            
            // Si no existe el contenedor en el HTML, lo creamos dinámicamente
            if (!this._hub) {
                console.log('[UPDATER] Creando #notification-hub dinámicamente...');
                const newHub = document.createElement('div');
                newHub.id = 'notification-hub';
                document.body.appendChild(newHub);
                this._hub = newHub;
            }
        }
        return this._hub;
    }

    /**
     * Método genérico para mostrar un toast
     * @param {Object} options - Configuración del toast
     * @param {string} options.type - Tipo de toast (info, success, error, warning)
     * @param {string} options.title - Título principal
     * @param {string} options.subtitle - Subtítulo opcional
     * @param {string} options.message - Mensaje del cuerpo opcional
     * @param {Object} options.progress - Objeto de progreso { percent, speed }
     * @param {string} options.buttonText - Texto del botón de acción
     * @param {Function} options.onClick - Función al hacer clic en el botón
     * @param {number} options.autoClose - Tiempo de auto-cierre en ms (0 = no auto-cerrar)
     */
    show({ type, title, subtitle, message, progress, buttonText, onClick, autoClose = 5000 }) {
        console.log('[UPDATER] show() llamado:', { type, title, subtitle });
        console.log('[UPDATER] notification-hub existe:', !!this.hub);
        
        // Si hay un toast anterior, removerlo
        if (this.currentToast) {
            this.remove(this.currentToast);
        }

        const toast = document.createElement('div');
        // Clase base toast-card + clase de tipo para colores de icono
        toast.className = `toast-card toast-${type}`;
        
        // Iconos según tipo - Usando los mismos del diseño proporcionado
        const icons = {
            info: 'fa-sync-alt',
            success: 'fa-rocket',
            error: 'fa-exclamation-triangle',
            warning: 'fa-bell'
        };

        // Generar HTML de progreso si existe
        let progressHTML = '';
        if (progress !== undefined) {
            progressHTML = `
                <div class="toast-progress-container">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${progress.percent}%"></div>
                    </div>
                    <div class="progress-stats">
                        <span>${progress.percent}%</span>
                        <span>${progress.speed || 'Calculando...'}</span>
                    </div>
                </div>
            `;
        }

        // Generar HTML de botón de acción si existe
        let actionHTML = '';
        if (buttonText && onClick) {
            actionHTML = `
                <div class="toast-action">
                    <button class="btn-toast-action">${buttonText}</button>
                </div>
            `;
        }

        // Estructura HTML del toast - Sin franjas laterales, solo icono circular coloreado
        toast.innerHTML = `
            <div class="toast-header">
                <div class="toast-icon ${type === 'info' && !progress ? 'pulse-icon' : ''}">
                    <i class="fas ${icons[type]}"></i>
                </div>
                <div class="toast-title-group">
                    <div class="toast-title">${title}</div>
                    ${subtitle ? `<div class="toast-subtitle">${subtitle}</div>` : ''}
                </div>
                <button class="toast-close"><i class="fas fa-times"></i></button>
            </div>
            ${message ? `<div class="toast-body">${message}</div>` : ''}
            ${progressHTML}
            ${actionHTML}
        `;

        // Eventos
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.remove(toast);
        }
        
        if (onClick) {
            const actionBtn = toast.querySelector('.btn-toast-action');
            if (actionBtn) {
                actionBtn.onclick = onClick;
            }
        }

        if (this.hub) {
            this.hub.appendChild(toast);
        }
        
        // Forzar reflujo para animación
        void toast.offsetWidth; 
        toast.classList.add('show');

        this.currentToast = toast;

        // Auto-cerrar si aplica
        if (autoClose > 0) {
            setTimeout(() => this.remove(toast), autoClose);
        }

        return toast;
    }

    /**
     * Remover un toast del DOM
     * @param {HTMLElement} toastElement - Elemento toast a remover
     */
    remove(toastElement) {
        if (!toastElement) return;
        toastElement.classList.remove('show');
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }
        }, 400);
    }

    /**
     * Notificación: Buscando actualizaciones
     */
    notifyChecking() {
        this.show({
            type: 'info',
            title: 'Buscando Actualizaciones',
            subtitle: 'Conectando con el servidor...',
            autoClose: 0
        });
    }

    /**
     * Notificación: No hay actualizaciones disponibles
     */
    notifyNotAvailable() {
        this.show({
            type: 'warning',
            title: 'Estás al día',
            subtitle: 'No hay actualizaciones disponibles',
            autoClose: 4000
        });
    }

    /**
     * Notificación: Actualización disponible (con progreso)
     * @param {string} version - Versión disponible
     * @deprecated 📦581 (Loop 3) — Ya NO muestra toast. La UI ahora es
     *   el botón del header + dropdown (no invasivo). Este método se mantiene
     *   por compatibilidad con callers viejos pero solo loguea.
     */
    notifyAvailable(version) {
        this.currentVersion = version;
        // 📦581 (Loop 3) — Ya no creamos toast invasivo. La info se ve en
        // el botón del header (con ícono de descarga + pulse) y en el dropdown
        // (al hacer click). Si querés ver el progreso, abrí el dropdown.
        console.log('[UPDATER] notifyAvailable (no-op desde Loop 3): nueva versión ' + version);
        // Llamamos al callback de progreso si existe, para que el progress bar
        // (si hay alguno visible) se actualice
        if (typeof this.onAvailable === 'function') {
            try { this.onAvailable(version); } catch (e) { /* ignore */ }
        }
    }

    /**
     * Actualizar barra de progreso
     * @param {number} percent - Porcentaje completado (0-100)
     * @param {string} speed - Velocidad de descarga
     * @deprecated 📦581 (Loop 3) — No-op. No hay toast que actualizar.
     *   Si en el futuro queremos mostrar progreso, lo agregamos como sub-elemento
     *   del dropdown nuevo (no como toast separado).
     */
    updateProgress(percent, speed) {
        // No-op. Si querés ver el progreso, abrí el dropdown.
        // Mantenido por compatibilidad con callers viejos.
    }

    /**
     * Notificación: Actualización descargada y lista para instalar
     * @param {string} version - Versión descargada
     * @param {Function} onRestart - Función a ejecutar al reiniciar
     * @deprecated 📦581 (Loop 3) — Ya NO muestra toast. La UI ahora es
     *   el botón del header + dropdown. El botón "Reiniciar" del dropdown
     *   llama a window.electronAPI.restartApp() directamente (ver Loop 2).
     *   El callback onRestart se ignora.
     */
    notifyDownloaded(version, onRestart) {
        // 📦581 (Loop 3) — Ya no creamos toast. La info se ve en el botón del
        // header (estado "ready", color verde pulse) y en el dropdown al hacer click.
        // El reinicio se hace desde el botón "Reiniciar ahora" del dropdown.
        console.log('[UPDATER] notifyDownloaded (no-op desde Loop 3): v' + version + ' lista para instalar');
        if (typeof onRestart === 'function') {
            // No llamamos al callback automáticamente — el usuario debe decidir
            // cuándo reiniciar haciendo click en el botón del dropdown.
            // Si el caller quiere que se ejecute, debe usar el botón del dropdown.
        }
    }

    /**
     * Notificación: Error en la actualización
     * @param {string} errMsg - Mensaje de error
     */
    notifyError(errMsg) {
        this.show({
            type: 'error',
            title: 'Error de Actualización',
            subtitle: 'No se pudo completar el proceso',
            message: errMsg,
            autoClose: 6000
        });
    }
}

// Instancia global del gestor de notificaciones
window.updateNotifier = new UpdateNotificationManager();

// Los listeners de eventos de actualización están en renderer.js (handler principal)
// Esta clase solo gestiona la UI de notificaciones toast

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpdateNotificationManager;
}
