// =====================================================================
// 3.1.2 — Actividades de medicina preventiva y promocion de la salud
// medicina-preventiva-logic.js
//
// Componente padre del submodulo. Mismo contrato que el resto de los
// submodulos de `modules/gestion-salud/` (ver `sociodemografica-component.js`
// y `perfiles-cargo-profesiograma-component.js`) y que
// `PresupuestoGestionComponent`:
//   - `render()` monta un iframe con la vista pedida.
//   - La vista (dentro del iframe) pide cambios via `postMessage`.
//   - `handleMessage` es el unico `switch` que decide a donde se va.
//
// 📦825 (2026-09-29) — Esqueleto de gestión de programas. Vistas:
//   - 'home'            → home con las 3 tarjetas de línea (SVE/DME/Promoción)
//   - 'programa-lista'  → programas de una línea (crear/abrir/gestionar)
//   - 'programa-detalle'→ un programa: secciones, progreso y ciclo de vida
// Los datos viajan por el bridge `medprev:programas:*` (main/
// medprev-programas-bridge.js); las vistas del iframe llaman a
// window.electronAPI directamente y el padre solo navega.
//
// NOTA sobre el CACHE-BUST: el `?v=` del `renderIframeView` cambia cada vez
// que se toca el HTML o el JS de una vista. Sin eso Electron sigue sirviendo
// la version vieja desde su cache y el cambio "no aparece".
// =====================================================================

// Cache-bust de las vistas del submodulo (subir cuando se toque HTML/JS).
var MEDPREV_V = 'MEDPREV-20261001-paleta-azul';

class MedicinaPreventivaComponent {
    /**
     * @param {HTMLElement} container  Div donde se dibuja el submodulo.
     * @param {string}      currentCompany
     * @param {string}      moduleName
     * @param {string}      submoduleName
     * @param {Function}   onBack      Vuelve al listado de submodulos.
     */
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.currentView = 'home';
        this.currentProgramaTipo = 'sve';
        this.currentProgramaId = null;
        this.messageHandlers = new Map();

        this.log('INFO', 'MedicinaPreventivaComponent inicializado (gestión de programas)');
    }

    log(level, message, data) {
        const stamp = new Date().toISOString().split('T')[1].split('.')[0];
        console.log('[MED-PREV][' + level + '][' + stamp + '] ' + message, data === undefined ? '' : data);
    }

    render() {
        this.log('INFO', 'Renderizando vista: ' + this.currentView);
        this.clearMessageHandlers();
        this.container.innerHTML = '';
        window.currentMedicinaPreventivaComponent = this;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';

        const empresaEnc = encodeURIComponent(this.currentCompany || '');

        switch (this.currentView) {
            case 'home':
                this.renderIframeView(
                    mainContainer,
                    'modules/gestion-salud/medicina-preventiva/medicina-preventiva-home.html?v=' + MEDPREV_V +
                        '&empresa=' + empresaEnc,
                    'home'
                );
                break;
            case 'programa-lista':
                this.renderIframeView(
                    mainContainer,
                    'modules/gestion-salud/medicina-preventiva/medicina-preventiva-programa.html?v=' + MEDPREV_V +
                        '&modo=lista&tipo=' + encodeURIComponent(this.currentProgramaTipo) +
                        '&empresa=' + empresaEnc,
                    'programa (' + this.currentProgramaTipo + ')'
                );
                break;
            case 'programa-detalle':
                this.renderIframeView(
                    mainContainer,
                    'modules/gestion-salud/medicina-preventiva/medicina-preventiva-programa.html?v=' + MEDPREV_V +
                        '&modo=detalle&tipo=' + encodeURIComponent(this.currentProgramaTipo) +
                        '&id=' + encodeURIComponent(this.currentProgramaId || '') +
                        '&empresa=' + empresaEnc,
                    'programa detalle'
                );
                break;
            default:
                this.log('WARN', 'Vista desconocida: ' + this.currentView + ', se usa home.');
                this.currentView = 'home';
                this.renderIframeView(
                    mainContainer,
                    'modules/gestion-salud/medicina-preventiva/medicina-preventiva-home.html?v=' + MEDPREV_V +
                        '&empresa=' + empresaEnc,
                    'home'
                );
        }

        this.container.appendChild(mainContainer);
    }

    renderIframeView(container, src, viewType) {
        const iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;';

        const loading = this.createLoadingElement('Cargando ' + viewType + '...');

        iframe.onload = () => {
            this.log('INFO', 'Iframe cargado (' + viewType + ')');
            if (loading.parentNode) loading.style.display = 'none';
        };
        iframe.onerror = (error) => this.log('CRITICAL', 'Error al cargar iframe: ' + error.message);

        const handler = (event) => this.handleMessage(event);
        this.registerMessageHandler(viewType, handler);

        container.appendChild(loading);
        container.appendChild(iframe);
    }

    registerMessageHandler(key, handler) {
        this.messageHandlers.set(key, handler);
        window.addEventListener('message', handler);
    }

    clearMessageHandlers() {
        this.messageHandlers.forEach((handler) => window.removeEventListener('message', handler));
        this.messageHandlers.clear();
    }

    async handleMessage(event) {
        const data = event.data || {};
        const action = data.action;
        if (!action) return;

        this.log('INFO', 'Accion recibida: ' + action, data);

        switch (action) {
            // El home (o el detalle, al volver) pidió la lista de una línea.
            case 'open-program':
                if (!data.program || ['sve', 'dme', 'promocion'].indexOf(data.program) === -1) {
                    this.avisoEnConstruccion(data.program);
                    break;
                }
                this.currentProgramaTipo = data.program;
                this.currentProgramaId = null;
                this.currentView = 'programa-lista';
                this.render();
                break;

            // Una vista pidió abrir el detalle de un programa concreto
            // (click en tarjeta de la lista o creación exitosa del wizard).
            case 'open-program-id':
                if (!data.id) {
                    this.avisoEnConstruccion(data.program);
                    break;
                }
                this.currentProgramaTipo = ['sve', 'dme', 'promocion'].indexOf(data.program) !== -1 ? data.program : 'sve';
                this.currentProgramaId = data.id;
                this.currentView = 'programa-detalle';
                this.render();
                break;

            // Volver del detalle/lista al home del 3.1.2.
            case 'backToHome':
                this.currentView = 'home';
                this.currentProgramaId = null;
                this.render();
                break;

            case 'backToSubmodules':
                if (this.onBack) this.onBack();
                break;
        }
    }

    createLoadingElement(message) {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 100%;';
        div.innerHTML = '<h3>' + message + '</h3>';
        return div;
    }

    avisoEnConstruccion(program) {
        const nombres = {
            sve: 'SVE (Sistema de Vigilancia Epidemiologica)',
            dme: 'DME (Diagnostico Medico Epidemiologico)',
            promocion: 'Programas de promocion y prevencion',
            programas: 'Programas de promocion y prevencion'
        };
        const nombre = nombres[program] || 'Este programa';

        this.log('INFO', 'Accion sin destino para "' + program + '".');

        if (window.KAIRToast && typeof window.KAIRToast.show === 'function') {
            window.KAIRToast.show(
                'La linea "' + nombre + '" no esta disponible: ' + 'intenta de nuevo desde el home del 3.1.2.',
                'info'
            );
        } else {
            console.warn('[MED-PREV] KAIRToast no disponible; no se muestra aviso para "' + program + '".');
        }
    }
}

// Se expone en `window` como el resto de los componentes (`index.html` lo carga
// con un <script> y `renderer.js` lo instancia desde el dispatch del submodulo).
if (typeof window !== 'undefined') {
    window.MedicinaPreventivaComponent = MedicinaPreventivaComponent;
}
