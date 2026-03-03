/**
 * ==========================================
 * SISTEMA DE NOTIFICACIONES MODERNO - K+AIR
 * Gestor de Notificaciones de Actualizaciones
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
            console.log('[UPDATER] get hub(): Elemento encontrado:', !!this._hub);
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
        toast.className = `toast-card toast-${type}`;
        
        // Iconos según tipo
        const icons = {
            info: 'fa-sync-alt',
            success: 'fa-rocket',
            error: 'fa-exclamation-triangle',
            warning: 'fa-bell'
        };

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

        let actionHTML = '';
        if (buttonText && onClick) {
            actionHTML = `
                <div class="toast-action">
                    <button class="btn-toast-action">${buttonText}</button>
                </div>
            `;
        }

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
     */
    notifyAvailable(version) {
        this.currentVersion = version;
        this.show({
            type: 'info',
            title: `Nueva Versión ${version}`,
            subtitle: 'Descargando en segundo plano...',
            message: 'La aplicación se actualizará automáticamente.',
            progress: { percent: 0 },
            autoClose: 0
        });
    }

    /**
     * Actualizar barra de progreso
     * @param {number} percent - Porcentaje completado (0-100)
     * @param {string} speed - Velocidad de descarga
     */
    updateProgress(percent, speed) {
        if (!this.currentToast) return;
        const fill = this.currentToast.querySelector('.progress-bar-fill');
        const stats = this.currentToast.querySelector('.progress-stats');
        if (fill) fill.style.width = `${percent}%`;
        if (stats) stats.innerHTML = `<span>${percent}%</span><span>${speed || 'Calculando...'}</span>`;
    }

    /**
     * Notificación: Actualización descargada y lista para instalar
     * @param {string} version - Versión descargada
     * @param {Function} onRestart - Función a ejecutar al reiniciar
     */
    notifyDownloaded(version, onRestart) {
        this.show({
            type: 'success',
            title: '¡Actualización Lista!',
            subtitle: `Versión ${version} descargada`,
            message: 'Es necesario reiniciar la aplicación para instalar.',
            buttonText: 'Reiniciar e Instalar Ahora',
            onClick: onRestart,
            autoClose: 0
        });
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

// Integración con electronAPI (si está disponible)
console.log('[UPDATER] update-notifications.js: Verificando electronAPI...');
console.log('[UPDATER] electronAPI disponible:', !!window.electronAPI);

if (window.electronAPI) {
    console.log('[UPDATER] Configurando listeners en update-notifications.js...');
    
    // Cuando comienza a buscar actualizaciones
    window.electronAPI.onUpdateChecking && window.electronAPI.onUpdateChecking(() => {
        console.log('[UPDATER] update-notifications.js: update_checking recibido');
        window.updateNotifier.notifyChecking();
    });
    
    // Cuando hay actualización disponible
    window.electronAPI.onUpdateAvailable && window.electronAPI.onUpdateAvailable((info) => {
        console.log('[UPDATER] update-notifications.js: update_available recibido', info);
        if (info && info.version) {
            window.updateNotifier.notifyAvailable(info.version);
        }
    });
    
    // Progreso de descarga
    window.electronAPI.onUpdateProgress && window.electronAPI.onUpdateProgress((data) => {
        console.log('[UPDATER] update-notifications.js: update_progress recibido', data);
        if (data && data.percent !== undefined) {
            window.updateNotifier.updateProgress(data.percent, data.speed);
        }
    });

    // Cuando la descarga se completa
    window.electronAPI.onUpdateDownloaded && window.electronAPI.onUpdateDownloaded((info) => {
        console.log('[UPDATER] update-notifications.js: update_downloaded recibido', info);
        const version = info ? info.version : 'nueva';
        window.updateNotifier.notifyDownloaded(version, () => {
            // Reiniciar la aplicación
            if (window.electronAPI.restartApp) {
                window.electronAPI.restartApp();
            }
        });
    });
    
    console.log('[UPDATER] Listeners configurados en update-notifications.js');
}

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpdateNotificationManager;
}
