/**
 * Theme Manager - Sistema centralizado de gestión de temas para K+AIR
 * Maneja los modos: Claro, Oscuro (Negro/Gris), Sistema
 */

const ThemeManager = {
    THEME_KEY: 'kair-theme-preference',
    currentTheme: 'system',
    listeners: new Set(),

    THEMES: {
        LIGHT: 'light',
        DARK: 'dark',       // Tema Oscuro (Paleta Negro/Gris) - usa data-theme="dark-legacy"
        SYSTEM: 'system'    // Tema Sistema - usa data-theme="dark" cuando es oscuro
    },

    async init() {
        try {
            if (window.electronAPI && window.electronAPI.getThemePreference) {
                const result = await window.electronAPI.getThemePreference();
                this.currentTheme = result.theme || 'system';
            } else {
                this.currentTheme = localStorage.getItem(this.THEME_KEY) || 'system';
            }
        } catch (e) {
            this.currentTheme = localStorage.getItem(this.THEME_KEY) || 'system';
        }
        
        await this.applyTheme(this.currentTheme);
        this._setupSystemThemeListener();
        console.log('[ThemeManager] Initialized with theme:', this.currentTheme);
    },

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

    getEffectiveTheme() {
        if (this.currentTheme === this.THEMES.SYSTEM) {
            if (window.matchMedia) {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            return 'light';
        }
        return this.currentTheme;
    },

    getCurrentPreference() {
        return this.currentTheme;
    },

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

document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
});

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
