/**
 * @fileoverview Theme Manager - Sistema centralizado de gestión de temas para K+AIR
 * @module scripts/theme-manager
 * @description Maneja los modos de tema: Claro, Oscuro (Negro/Gris), y Sistema.
 *              Proporciona sincronización de temas entre ventanas principales e iframes.
 * 
 * Características:
 * - Tres modos: Claro (light), Oscuro (dark), Sistema (system)
 * - Sincronización automática con el tema del sistema operativo
 * - Propagación de temas a iframes embebidos
 * - Sistema de suscriptores para reactividad
 * - Persistencia en localStorage y configuración de Electron
 * 
 * @example
 * // El ThemeManager se inicializa automáticamente al cargar el DOM
 * // Para cambiar el tema manualmente:
 * await ThemeManager.setTheme('dark');
 * 
 * // Para suscribirse a cambios de tema:
 * ThemeManager.subscribe((preference, effective) => {
 *   console.log(`Tema: ${preference}, Efectivo: ${effective}`);
 * });
 */

/**
 * Objeto ThemeManager - Gestor central de temas
 * @namespace
 * @memberof module:scripts/theme-manager
 */
const ThemeManager = {
    /**
     * Clave usada para persistir la preferencia en localStorage
     * @constant {string}
     * @default 'kair-theme-preference'
     */
    THEME_KEY: 'kair-theme-preference',
    
    /**
     * Tema actual seleccionado por el usuario
     * @type {string}
     * @default 'system'
     */
    currentTheme: 'system',
    
    /**
     * Conjunto de funciones callback para notificar cambios de tema
     * @private
     * @type {Set<Function>}
     */
    listeners: new Set(),

    /**
     * Enumeración de temas disponibles
     * @readonly
     * @enum {string}
     * @property {string} LIGHT - Tema claro (por defecto)
     * @property {string} DARK - Tema oscuro (paleta Negro/Gris, usa data-theme="dark-legacy")
     * @property {string} SYSTEM - Tema sistema (usa data-theme="dark" cuando es oscuro)
     */
    THEMES: {
        LIGHT: 'light',
        DARK: 'dark',       // Tema Oscuro (Paleta Negro/Gris) - usa data-theme="dark-legacy"
        SYSTEM: 'system'    // Tema Sistema - usa data-theme="dark" cuando es oscuro
    },

    /**
     * Inicializa el ThemeManager
     * @async
     * @function init
     * @memberof module:scripts/theme-manager.ThemeManager
     * @description Carga la preferencia guardada, aplica el tema y configura listeners
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Prioridad: config.json > localStorage > default
            if (window.electronAPI && window.electronAPI.getThemePreference) {
                const result = await window.electronAPI.getThemePreference();
                this.currentTheme = result.theme || 'system';
                console.log('[ThemeManager] Preferencia cargada desde config.json:', this.currentTheme);
            } else {
                this.currentTheme = localStorage.getItem(this.THEME_KEY) || 'system';
                console.log('[ThemeManager] Preferencia cargada desde localStorage:', this.currentTheme);
            }
        } catch (e) {
            console.warn('[ThemeManager] Error cargando preferencia:', e);
            this.currentTheme = localStorage.getItem(this.THEME_KEY) || 'system';
        }

        await this.applyTheme(this.currentTheme);
        this._setupSystemThemeListener();
        console.log('[ThemeManager] Initialized with theme:', this.currentTheme);
    },

    /**
     * Establece el tema preferido y lo persiste
     * @async
     * @function setTheme
     * @memberof module:scripts/theme-manager.ThemeManager
     * @param {string} themeMode - Modo de tema a establecer ('light', 'dark', o 'system')
     * @returns {Promise<void>}
     * @description Guarda la preferencia en localStorage y Electron, luego aplica el tema
     * @example
     * await ThemeManager.setTheme('dark'); // Cambia a tema oscuro
     * await ThemeManager.setTheme('system'); // Sigue el tema del sistema
     */
    async setTheme(themeMode) {
        if (!Object.values(this.THEMES).includes(themeMode)) {
            console.error('[ThemeManager] Invalid theme:', themeMode);
            return;
        }
        
        this.currentTheme = themeMode;
        localStorage.setItem(this.THEME_KEY, themeMode);
        
        if (window.electronAPI && window.electronAPI.saveThemePreference) {
            await window.electronAPI.saveThemePreference(themeMode);
        }
        
        await this.applyTheme(themeMode);
        this._notifyListeners(themeMode);
    },

    /**
     * Aplica el tema efectivo al documento DOM
     * @async
     * @function applyTheme
     * @memberof module:scripts/theme-manager.ThemeManager
     * @param {string} themeMode - Modo de tema a aplicar
     * @returns {Promise<void>}
     * @description
     * - Para 'dark': aplica data-theme="dark-legacy"
     * - Para 'system' (oscuro): aplica data-theme="dark"
     * - Para 'light': remueve el atributo data-theme
     * - Propaga el tema a todos los iframes
     */
    async applyTheme(themeMode) {
        let effectiveTheme = themeMode;

        if (themeMode === this.THEMES.SYSTEM) {
            if (window.electronAPI && window.electronAPI.getSystemTheme) {
                const result = await window.electronAPI.getSystemTheme();
                effectiveTheme = result.theme || 'light';
            } else if (window.matchMedia) {
                effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            } else {
                effectiveTheme = 'light';
            }
        }

        // Aplicar atributo según el tipo de tema
        if (effectiveTheme === 'dark') {
            if (themeMode === this.THEMES.DARK) {
                // Tema Oscuro (Paleta Negro/Gris)
                document.documentElement.setAttribute('data-theme', 'dark-legacy');
            } else if (themeMode === this.THEMES.SYSTEM) {
                // Tema de Sistema (cuando el sistema es oscuro)
                document.documentElement.setAttribute('data-theme', 'dark');
            }
        } else {
            // Tema Claro
            document.documentElement.removeAttribute('data-theme');
        }

        this._propagateToIframes(effectiveTheme, themeMode);
        console.log('[ThemeManager] Applied effective theme:', effectiveTheme, '(mode:', themeMode + ')');
    },

    /**
     * Obtiene el tema efectivo actual (resuelve 'system' a 'light' o 'dark')
     * @function getEffectiveTheme
     * @memberof module:scripts/theme-manager.ThemeManager
     * @returns {string} Tema efectivo ('light' o 'dark')
     * @description Si el modo es 'system', detecta el tema del sistema operativo
     */
    getEffectiveTheme() {
        if (this.currentTheme === this.THEMES.SYSTEM) {
            if (window.matchMedia) {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            return 'light';
        }
        return this.currentTheme;
    },

    /**
     * Obtiene la preferencia actual del usuario
     * @function getCurrentPreference
     * @memberof module:scripts/theme-manager.ThemeManager
     * @returns {string} Preferencia actual ('light', 'dark', o 'system')
     */
    getCurrentPreference() {
        return this.currentTheme;
    },

    /**
     * Suscribe un callback para notificaciones de cambio de tema
     * @function subscribe
     * @memberof module:scripts/theme-manager.ThemeManager
     * @param {Function} callback - Función a llamar cuando cambie el tema
     * @returns {Function} Función para cancelar la suscripción
     * @example
     * const unsubscribe = ThemeManager.subscribe((pref, eff) => {
     *   console.log(`Preferencia: ${pref}, Efectivo: ${eff}`);
     * });
     * // Para cancelar: unsubscribe();
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    },

    _notifyListeners(theme) {
        const effectiveTheme = this.getEffectiveTheme();
        this.listeners.forEach(callback => {
            try {
                callback(theme, effectiveTheme);
            } catch (e) {
                console.error('[ThemeManager] Listener error:', e);
            }
        });
    },

    _setupSystemThemeListener() {
        if (window.electronAPI && window.electronAPI.onSystemThemeChanged) {
            window.electronAPI.onSystemThemeChanged((systemTheme) => {
                console.log('[ThemeManager] System theme changed to:', systemTheme);
                if (this.currentTheme === this.THEMES.SYSTEM) {
                    this.applyTheme(this.THEMES.SYSTEM);
                    this._notifyListeners(this.THEMES.SYSTEM);
                }
            });
        }
        
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                if (this.currentTheme === this.THEMES.SYSTEM) {
                    this.applyTheme(this.THEMES.SYSTEM);
                    this._notifyListeners(this.THEMES.SYSTEM);
                }
            });
        }
    },

    _propagateToIframes(theme, mode) {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                if (iframe.contentDocument) {
                    if (theme === 'dark') {
                        if (mode === 'dark') {
                            iframe.contentDocument.documentElement.setAttribute('data-theme', 'dark-legacy');
                        } else if (mode === 'system') {
                            iframe.contentDocument.documentElement.setAttribute('data-theme', 'dark');
                        }
                    } else {
                        iframe.contentDocument.documentElement.removeAttribute('data-theme');
                    }
                }

                iframe.contentWindow?.postMessage({
                    type: 'theme-changed',
                    theme: theme,
                    mode: mode
                }, '*');
            } catch (e) {
                // Iframe puede no estar accesible
            }
        });
    }
};

window.ThemeManager = ThemeManager;

// NO inicializar automáticamente - renderer.js se encarga de aplicar el tema al cargar
// document.addEventListener('DOMContentLoaded', () => {
//     ThemeManager.init();
// });

window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'get-theme-request') {
        const sourceWindow = event.source;
        if (sourceWindow) {
            sourceWindow.postMessage({
                type: 'get-theme-response',
                theme: ThemeManager.getEffectiveTheme(),
                preference: ThemeManager.getCurrentPreference()
            }, '*');
        }
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
