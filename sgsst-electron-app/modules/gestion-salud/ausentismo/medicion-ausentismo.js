// medicion-ausentismo.js - Componente para el submódulo "3.3.6 Medición del ausentismo por causa médica"

class MedicionAusentismoComponent {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.currentView = 'main'; // 'main', 'ver-ausentismo' o 'registrar-ausentismo'
        this.currentPath = null;
        this.pathHistory = [];
        this.ausentismoFilePath = null; // Para guardar la ruta del archivo
        this.logMessage = (msg, type) => console.log(`[${type}] ${msg}`); // Placeholder
        this.excelInitialized = false; // Para saber si ya inicializamos el gestor de Excel

        // 📦459 (2026-07-02) — Estado del último load de PI-FO-076. Se llena cada vez
        // que se llama readAusentismoData. Sirve para que el wizard seguimiento sepa
        // si debe mostrar banner preventivo en la Sección 2 cuando los datos de
        // incapacidad lleguen vacíos (causa: archivo no disponible).
        // Estructura: { missing: bool, reason: string, expectedDir: string, details: string }
        this.ausentismoFileStatus = null;

        this.openDocument = this.openDocument.bind(this);
    }

    /* 📦459 (2026-07-02) — Mapeo de razones de modo degradado a mensajes UI.
       Cada razón tiene un texto amigable + sugerencia de acción para el usuario.
       Esto centraliza los mensajes para que sean consistentes en todas las vistas
       (Ver Ausentismo, Estadísticas, Wizard Seguimiento, Registrar Incapacidad). */
    _getMissingFileMessage(reason, details) {
        const messages = {
            folder_missing: {
                title: 'Carpeta de ausentismo no encontrada',
                detail: 'La carpeta "Medición del ausentismo por causa médica" no existe en la raíz de la empresa. Sin ella, los datos de incapacidad no se pueden cargar.',
                action: 'Verificar ruta de la empresa'
            },
            folder_unreadable: {
                title: 'No se puede acceder a la carpeta',
                detail: 'La carpeta existe pero no se puede leer (permisos o error de red).',
                action: 'Verificar permisos'
            },
            not_found: {
                title: 'Archivo PI-FO-076 no encontrado',
                detail: 'La carpeta existe pero ningún archivo coincide con "PI-FO-076" o "AUSENTISMO". Puede haber sido renombrado o movido.',
                action: 'Buscar archivo manualmente'
            },
            corrupt: {
                title: 'Archivo ilegible',
                detail: 'El archivo existe pero no se puede abrir. Puede estar corrupto o tener un formato no soportado.',
                action: 'Re-abrir archivo en Excel'
            },
            unreadable: {
                title: 'Archivo bloqueado',
                detail: 'El archivo existe pero está bloqueado por otra aplicación (¿abierto en Excel?).',
                action: 'Cerrar archivo en Excel'
            }
        };
        const m = messages[reason] || {
            title: 'Archivo de ausentismo no disponible',
            detail: 'No se pudo acceder al archivo de ausentismo.',
            action: 'Verificar estado'
        };
        return {
            ...m,
            technicalDetail: details || ''
        };
    }

    /* 📦459 — Helper que retorna HTML del banner amarillo estandarizado.
       Reusado en Ver Ausentismo, Estadísticas y Wizard Seguimiento (Sección 2).
       Variantes:
         - variant: 'info' (azul) | 'warning' (amarillo) | 'error' (rojo)
         - compact: true para versiones inline (ej: dentro de sección de wizard)
         - showAction: false para esconder botón "Buscar manualmente"
         - retryMethod: nombre del método del componente a invocar al reintentar.
           Default: 'loadSeguimientoData'. Si el banner está en vista de estadísticas
           o ausentismo, pasar el método correspondiente. */
    _ausentismoMissingBannerHtml(status, options) {
        options = options || {};
        const variant = options.variant || 'warning';
        const compact = !!options.compact;
        const showAction = options.showAction !== false;
        const retryMethod = options.retryMethod || 'loadSeguimientoData';

        const msg = this._getMissingFileMessage(status.reason, status.details);

        const iconByVariant = {
            warning: 'fa-exclamation-triangle',
            error: 'fa-times-circle',
            info: 'fa-info-circle'
        };
        const icon = iconByVariant[variant] || iconByVariant.warning;

        const actionButton = showAction ? `
            <button type="button" class="km-missing-banner__action" onclick="window.electronAPI.openPath('${(status.expectedDir || '').replace(/'/g, "\\'")}')">
                <i class="fas fa-folder-open"></i> Abrir carpeta esperada
            </button>` : '';

        // El botón reintento usa guard para evitar errores si el componente ya no existe
        const retryButton = !compact ? `
            <button type="button" class="km-missing-banner__action km-missing-banner__action--secondary" onclick="window.medicAusentismoComponent && typeof window.medicAusentismoComponent.${retryMethod} === 'function' && window.medicAusentismoComponent.${retryMethod}()">
                <i class="fas fa-sync-alt"></i> Reintentar
            </button>` : '';

        if (compact) {
            return `<div class="km-missing-banner km-missing-banner--${variant} km-missing-banner--compact">
                <i class="fas ${icon} km-missing-banner__icon"></i>
                <div class="km-missing-banner__body">
                    <strong>${msg.title}</strong>
                    <small>${msg.detail}</small>
                </div>
                ${actionButton}
            </div>`;
        }

        return `<div class="km-missing-banner km-missing-banner--${variant}">
            <div class="km-missing-banner__icon-wrap"><i class="fas ${icon}"></i></div>
            <div class="km-missing-banner__body">
                <strong class="km-missing-banner__title">${msg.title}</strong>
                <p class="km-missing-banner__detail">${msg.detail}</p>
                ${msg.technicalDetail ? `<small class="km-missing-banner__tech"><i class="fas fa-wrench"></i> ${msg.technicalDetail}</small>` : ''}
                <div class="km-missing-banner__hint"><i class="fas fa-lightbulb"></i> <strong>${msg.action}</strong></div>
            </div>
            <div class="km-missing-banner__actions">
                ${actionButton}
                ${retryButton}
            </div>
        </div>`;
    }

    /* 📦459 — Helper que inyecta el banner al inicio de un contenedor si el archivo
       está en modo degradado. Retorna true si inyectó banner, false si no hizo nada.
       Usar después de cargar datos en cualquier vista para alertar al usuario. */
    _injectAusentismoMissingBanner(container, options) {
        if (!container) return false;
        if (!this.ausentismoFileStatus || !this.ausentismoFileStatus.missing) return false;
        // Si ya existe un banner idéntico, no duplicar
        const existing = container.querySelector('.km-missing-banner');
        if (existing) return true;
        const banner = document.createElement('div');
        banner.innerHTML = this._ausentismoMissingBannerHtml(this.ausentismoFileStatus, options);
        container.insertBefore(banner.firstElementChild, container.firstChild);
        return true;
    }

    /* 📦443 (2026-06-25) — Helper de loading animado estándar.
       Devuelve HTML para insertar en <td colspan> o contenedor cuando se está
       cargando datos. Usa animación CSS consistente con el resto del proyecto.
       Parámetros:
       - message: texto a mostrar ("Cargando seguimientos...", etc.)
       - colspan: para usar dentro de <tr><td colspan="N">
       Uso:
         row.innerHTML = `<tr><td>${this._loadingRowHtml('Cargando X...', 17)}</td></tr>`;
       O sin colspan:
         container.innerHTML = this._loadingRowHtml('Cargando X...'); */
    _loadingRowHtml(message, colspan) {
        var colspanAttr = colspan ? ' colspan="' + colspan + '"' : '';
        return `<td${colspanAttr} class="km-loading-cell">
            <div class="km-loading-spinner">
                <div class="km-loading-spinner__ring"></div>
                <div class="km-loading-spinner__ring"></div>
                <div class="km-loading-spinner__ring"></div>
            </div>
            <p class="km-loading-text">${message || 'Cargando...'}</p>
            <div class="km-loading-skeleton">
                <div class="km-loading-skeleton__bar"></div>
                <div class="km-loading-skeleton__bar"></div>
                <div class="km-loading-skeleton__bar"></div>
            </div>
        </td>`;
    }

    /* 📦443 — Helper de loading para contenedor (no fila de tabla).
       Devuelve HTML para mostrar en un div vacío mientras se carga. */
    _loadingBlockHtml(message) {
        return `<div class="km-loading-block">
            <div class="km-loading-spinner km-loading-spinner--lg">
                <div class="km-loading-spinner__ring"></div>
                <div class="km-loading-spinner__ring"></div>
                <div class="km-loading-spinner__ring"></div>
            </div>
            <p class="km-loading-text">${message || 'Cargando...'}</p>
        </div>`;
    }

    /* 📦443 (2026-06-25) — Helper de notificación compatible con iframe.
       Resuelve window.parent.updateNotifier automáticamente (porque este archivo
       se ejecuta dentro de un iframe). Usar este helper en lugar de llamar
       window.updateNotifier directamente para garantizar compatibilidad. */
    _notify(title, subtitle, type, autoClose) {
        var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (!notifier || typeof notifier.show !== 'function') return;
        var opts = { type: type || 'info', title: title, subtitle: subtitle || '' };
        if (autoClose != null) opts.autoClose = autoClose;
        else opts.autoClose = type === 'error' ? 6000 : type === 'warning' ? 4000 : 3000;
        notifier.show(opts);
    }

    render() {
        // Ejecutar cleanup anterior si existe
        if (this.portalMessageCleanup) {
            this.portalMessageCleanup();
            this.portalMessageCleanup = null;
        }
        if (this.iframeMessageCleanup) {
            this.iframeMessageCleanup();
            this.iframeMessageCleanup = null;
        }

        this.container.innerHTML = '';
        // Añadir clase específica para identificar este módulo y permitir estilos específicos
        this.container.classList.add('medicion-ausentismo');
        window.currentMedicionAusentismoComponent = this;

        switch (this.currentView) {
            case 'main':
                this.renderMainView(this.container);
                break;
            case 'ver-ausentismo':
                this.renderVerAusentismoView(this.container);
                break;
            case 'registrar-ausentismo':
                this.renderRegistrarAusentismoView(this.container);
                break;
            case 'seguimiento-incapacidades':
                this.renderSeguimientoIncapacidadesView(this.container);
                break;
            case 'ver-estadisticas':
                this.renderEstadisticasView(this.container);
                break;
            case 'consulta-trabajadores':
                this.renderConsultaTrabajadoresView(this.container);
                break;
            // 📦462 (2026-07-03) — Vistas nuevas de Seguimiento de Gestación
            case 'seguimiento-gestacion':
                this.renderSeguimientoGestacionView(this.container);
                break;
            // 📦464 (2026-07-03) — Antesala: vista resumen de la gestante
            // que se muestra ANTES del wizard mensual de seguimiento.
            case 'seguimiento-gestacion-antesala':
                this.renderGestacionAntesalaView(this.container, this._gestanteActualId);
                break;
            case 'seguimiento-gestacion-mensual':
                this.renderSeguimientoMensualView(this.container, this._gestanteActualId);
                break;
            // 📦477 — Reportes de Seguimiento de Gestación
            case 'seguimiento-gestacion-reportes':
                this.renderGestacionReportesView(this.container);
                break;
            default:
                this.renderMainView(this.container);
        }
    }

    renderMainView(container) {
        // Limpiar padding para que el portal ocupe todo el espacio
        container.style.padding = '0';
        container.style.overflow = 'hidden';

        // Crear iframe para cargar el portal de bienvenida
        const iframe = document.createElement('iframe');
        iframe.src = 'modules/gestion-salud/ausentismo/medicion-ausentismo-home.html';
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        `;

        // Manejar mensajes desde el iframe
        const handleIframeMessage = (event) => {
            if (event.source !== iframe.contentWindow) return;

            const data = event.data;
            
            if (data.type === 'back-to-module-request') {
                // Volver al módulo principal
                if (this.onBack && typeof this.onBack === 'function') {
                    this.onBack();
                }
            } else if (data.type === 'ausentismo-home-action') {
                // Manejar acciones del portal
                switch (data.action) {
                    case 'registrar-ausentismo':
                        this.currentView = 'registrar-ausentismo';
                        this.render();
                        break;
                    case 'ver-ausentismo':
                        this.currentView = 'ver-ausentismo';
                        this.render();
                        break;
                    case 'seguimiento-incapacidades':
                        this.currentView = 'seguimiento-incapacidades';
                        this.render();
                        break;
                    case 'ver-estadisticas':
                        this.currentView = 'ver-estadisticas';
                        this.render();
                        break;
                    case 'consulta-trabajadores':
                        this.currentView = 'consulta-trabajadores';
                        this.render();
                        break;
                    case 'seguimiento-gestacion':
                        // 📦462 (2026-07-03) — Vista principal de Seguimiento de Gestación (Salud Materna)
                        this.currentView = 'seguimiento-gestacion';
                        this._gestanteActualId = null;
                        this.render();
                        break;
                    case 'seguimiento-gestacion-antesala':
                        // 📦464 (2026-07-03) — Antesala de seguimiento (vista resumen de la gestante)
                        this.currentView = 'seguimiento-gestacion-antesala';
                        this._gestanteActualId = (data.payload && data.payload.gestanteId) || null;
                        this.render();
                        break;
                    case 'seguimiento-gestacion-mensual':
                        // 📦462 (2026-07-03) — Vista de seguimiento mensual de una gestante específica
                        this.currentView = 'seguimiento-gestacion-mensual';
                        this._gestanteActualId = (data.payload && data.payload.gestanteId) || null;
                        this.render();
                        break;
                    case 'seguimiento-gestacion-reportes':
                        // 📦477 — Reportes de Seguimiento de Gestación (3 tipos)
                        this.currentView = 'seguimiento-gestacion-reportes';
                        this.render();
                        break;
                    case 'main':
                        // 📦462 (2026-07-03) — Volver al home principal del módulo
                        this.currentView = 'main';
                        this.render();
                        break;
                }
            } else if (data.type === 'ipc-invoke') {
                // 📦459 (2026-07-02) — IPC proxy: el iframe home no tiene acceso directo
                // al contextBridge de Electron (corre en isolated world). Proxyamos las
                // invocaciones IPC a través de postMessage: el iframe pide, nosotros
                // invocamos window.electronAPI[channel] y devolvemos el resultado.
                // Esto cubre los 3 escenarios diagnosticados:
                //   - electronAPI undefined en iframe → sin esto no hay IPC
                //   - electronAPI existe pero getAusentismoStats falta → mismo síntoma
                //   - IPC cuelga en el iframe → al menos tenemos logs en el parent
                const respond = (payload) => {
                    try {
                        iframe.contentWindow.postMessage(payload, '*');
                    } catch (postErr) {
                        console.error('[ipc-invoke] No se pudo enviar respuesta al iframe:', postErr.message);
                    }
                };
                if (!data || !data.channel || !data.requestId) {
                    console.warn('[ipc-invoke] Mensaje mal formado:', data);
                    return;
                }
                const api = window.electronAPI;
                if (!api || typeof api[data.channel] !== 'function') {
                    console.error(`[ipc-invoke] electronAPI.${data.channel} no existe en el parent`);
                    respond({
                        type: 'ipc-response',
                        requestId: data.requestId,
                        error: `electronAPI.${data.channel} no disponible en el renderer principal`
                    });
                    return;
                }
                // Invocar y responder (async para no bloquear el message handler)
                (async () => {
                    try {
                        const args = Array.isArray(data.args) ? data.args : [];
                        const result = await api[data.channel](...args);
                        respond({
                            type: 'ipc-response',
                            requestId: data.requestId,
                            result
                        });
                    } catch (invokeErr) {
                        console.error(`[ipc-invoke] Error invocando ${data.channel}:`, invokeErr.message);
                        respond({
                            type: 'ipc-response',
                            requestId: data.requestId,
                            error: invokeErr.message
                        });
                    }
                })();
            }
        };

        // Agregar listener para mensajes desde el iframe
        window.addEventListener('message', handleIframeMessage);

        // Guardar cleanup para cuando se desmonte
        if (this.portalMessageCleanup) {
            this.portalMessageCleanup();
        }
        this.portalMessageCleanup = () => {
            window.removeEventListener('message', handleIframeMessage);
        };

        // Pasar contexto de empresa al iframe cuando cargue
        iframe.onload = () => {
            try {
                iframe.contentWindow.postMessage({
                    type: 'SET_COMPANY_CONTEXT',
                    company: this.currentCompany
                }, '*');
            } catch (error) {
                console.error('Error al enviar contexto al iframe:', error);
            }
        };

        container.appendChild(iframe);
    }

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'card-header';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'card-icon-placeholder';
        headerDiv.appendChild(iconDiv);

        const cardTitle = document.createElement('h3');
        cardTitle.textContent = title;
        cardTitle.className = 'card-title';
        headerDiv.appendChild(cardTitle);

        card.appendChild(headerDiv);

        const cardDescription = document.createElement('p');
        cardDescription.textContent = description;
        cardDescription.className = 'card-description';
        card.appendChild(cardDescription);

        const cardButton = document.createElement('button');
        cardButton.className = 'btn btn-primary';
        cardButton.textContent = 'Abrir';
        cardButton.addEventListener('click', onClick);
        card.appendChild(cardButton);

        return card;
    }

    handleViewAusentismo() {
        this.currentView = 'ver-ausentismo';
        this.render();
    }

    handleRegistrarAusentismo() {
        console.log(' handleClick en tarjeta Registrar Ausentismo');
        // Verificar si el componente está disponible
        if (typeof window.RegistrarAusentismoComponent === 'undefined') {
            console.error('RegistrarAusentismoComponent no está definido');
            this._notify('Error', 'El componente de registro de ausentismo no está disponible.', 'error', 6000);
            return;
        }

        // Aquí debemos cargar el componente de RegistrarAusentismoComponent
        // pero primero necesitamos crear una nueva vista para esto
        this.currentView = 'registrar-ausentismo';
        console.log('Cambiando a vista registrar-ausentismo');
        this.render();
    }

    handleVerAusentismo() {
        this.currentView = 'ver-ausentismo';
        this.render();
    }

    handleComingSoon() {
        this._notify('Próximamente', 'Esta funcionalidad estará disponible próximamente.', 'info');
    }

    handleSeguimientoIncapacidades() {
        // Crear un iframe o contenedor para la nueva funcionalidad
        this.currentView = 'seguimiento-incapacidades';
        this.render();
    }

    async renderSeguimientoIncapacidadesView(container) {
        console.log('[DEBUG] renderSeguimientoIncapacidadesView: Iniciando renderizado de seguimiento moderno.');
        container.innerHTML = '';

        // Contenedor wrapper con scroll condicional
        const scrollWrapper = document.createElement('div');
        scrollWrapper.id = 'seguimiento-incapacidades-scroll-wrapper';
        scrollWrapper.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
        `;

        // Guardar referencia global del componente
        window.medicAusentismoComponent = this;

        // Agregar FontAwesome dinámicamente si no está cargado
        if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
            const fontAwesomeLink = document.createElement('link');
            fontAwesomeLink.rel = 'stylesheet';
            fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            document.head.appendChild(fontAwesomeLink);
        }

        // Contenedor principal
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            width: 100%;
            min-height: 100%;
            box-sizing: border-box;
        `;

        // Header con botón volver
        const headerSection = document.createElement('div');
        headerSection.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
        `;

        const leftSection = document.createElement('div');
        leftSection.style.cssText = `display: flex; align-items: center; gap: 10px;`;

        const headerIcon = document.createElement('i');
        headerIcon.className = 'fas fa-user-injured';
        headerIcon.style.cssText = `color: #174ea6; font-size: 20px;`;

        const headerTitle = document.createElement('h3');
        headerTitle.textContent = 'Seguimiento de Incapacidades';
        headerTitle.style.cssText = `font-size: 18px; font-weight: 600; margin: 0; color: #1E293B;`;

        leftSection.appendChild(headerIcon);
        leftSection.appendChild(headerTitle);

        const backBtn = document.createElement('button');
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
        backBtn.style.cssText = `
            padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
            cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
            border: 1px solid #dee2e6; background-color: #f8f9fa; color: #64748B;
            transition: all 0.2s;
        `;
        backBtn.onmouseover = function() {
            this.style.backgroundColor = '#e2e8f0';
            this.style.color = '#174ea6';
            this.style.borderColor = '#174ea6';
        };
        backBtn.onmouseout = function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.color = '#64748B';
            this.style.borderColor = '#dee2e6';
        };
        backBtn.onclick = () => {
            this.currentView = 'main';
            this.render();
        };

        headerSection.appendChild(leftSection);
        headerSection.appendChild(backBtn);
        mainContent.appendChild(headerSection);

        // KPI Cards Grid
        const kpiGrid = document.createElement('div');
        kpiGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        `;

        const createKPICard = (icon, title, value, sub, color) => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: white; padding: 20px; border-radius: 12px;
                border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px;
            `;

            const iconDiv = document.createElement('div');
            iconDiv.style.cssText = `
                width: 50px; height: 50px; border-radius: 10px; display: flex;
                align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
                background: ${color.bg}; color: ${color.text};
            `;
            iconDiv.innerHTML = `<i class="${icon}"></i>`;

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = `flex: 1;`;

            const titleEl = document.createElement('h3');
            titleEl.textContent = title;
            titleEl.style.cssText = `font-size: 13px; color: #64748B; margin-bottom: 4px; text-transform: uppercase;`;

            const valueEl = document.createElement('div');
            valueEl.className = 'kpi-value';
            valueEl.textContent = value;
            valueEl.style.cssText = `font-size: 24px; font-weight: 700; color: #1E293B;`;

            const subEl = document.createElement('div');
            subEl.textContent = sub;
            subEl.style.cssText = `font-size: 12px; color: #64748B; margin-top: 2px;`;

            infoDiv.appendChild(titleEl);
            infoDiv.appendChild(valueEl);
            infoDiv.appendChild(subEl);
            card.appendChild(iconDiv);
            card.appendChild(infoDiv);

            return card;
        };

        // Crear las 4 tarjetas KPI
        kpiGrid.appendChild(createKPICard(
            'fas fa-spinner',
            'En Seguimiento',
            this.kpiEnSeguimiento || '0',
            'Casos con seguimiento activo',
            { bg: 'rgba(59, 130, 246, 0.1)', text: '#3B82F6' }
        ));

        kpiGrid.appendChild(createKPICard(
            'fas fa-hourglass-half',
            'Casos PRIC',
            this.kpiCasosPRIC || '0',
            'Próximos a vencer',
            { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B' }
        ));

        kpiGrid.appendChild(createKPICard(
            'fas fa-file-exclamation',
            'Sin Iniciar',
            this.kpiSinIniciar || '0',
            'Requieren iniciar gestión',
            { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444' }
        ));

        kpiGrid.appendChild(createKPICard(
            'fas fa-check-circle',
            'Cerrados (Mes)',
            this.kpiCerradosMes || '0',
            'Altas exitosas',
            { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981' }
        ));

        mainContent.appendChild(kpiGrid);

        // Filters Container
        const filtersContainer = document.createElement('div');
        filtersContainer.style.cssText = `
            background: white; padding: 20px; border-radius: 12px;
            border: 1px solid #e2e8f0; margin-bottom: 20px;
            display: flex; flex-wrap: wrap; align-items: flex-end; gap: 15px;
        `;

        const currentYear = new Date().getFullYear();
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        filtersContainer.innerHTML = `
            <div style="flex: 2; min-width: 200px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Buscar Paciente</label>
                <input type="text" id="seguimientoSearchInput" class="form-control" placeholder="Nombre o Cédula..."
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
            </div>
            <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Estado</label>
                <select id="seguimientoEstadoFilter" class="form-control"
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    <option value="En curso">En curso</option>
                    <option value="Próximo a vencer">Próximo a vencer</option>
                    <option value="Finalizado">Finalizado</option>
                </select>
            </div>
            <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Tipo</label>
                <select id="seguimientoTipoFilter" class="form-control"
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    <option value="EPS">EPS</option>
                    <option value="ARL">ARL</option>
                </select>
            </div>
            <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Año</label>
                <select id="seguimientoYearFilter" class="form-control"
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    <!-- Los años se llenarán dinámicamente después de cargar los datos -->
                </select>
            </div>
            <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Mes</label>
                <select id="seguimientoMonthFilter" class="form-control"
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    ${months.map((month, index) => `<option value="${index}">${month}</option>`).join('')}
                </select>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <button id="seguimientoFilterBtn" class="btn btn-primary"
                    style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: none; background-color: #174ea6; color: white;">
                    <i class="fas fa-filter"></i> Filtrar
                </button>
                <button id="seguimientoClearBtn" class="btn btn-outline"
                    style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0; background: white; color: #1E293B;">
                    <i class="fas fa-times"></i> Limpiar
                </button>
            </div>
        `;

        mainContent.appendChild(filtersContainer);

        // Table Container
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = `
            background: white; border-radius: 12px;
            border: 1px solid #e2e8f0; overflow: hidden; overflow-x: auto;
        `;

        tableContainer.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; min-width: 1100px;">
                <thead>
                    <tr>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Empleado</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Tipo</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;" title="¿Es un caso PRI formal?">PRI</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Periodo</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Avance</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Estado</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="seguimientoTableBody">
                    <tr>
                        <td colspan="7" class="ks-loading-cell" style="padding: 16px;">
                            ${KairSkeleton.table(8, 7)}
                        </td>
                    </tr>
                </tbody>
            </table>
        `;

        mainContent.appendChild(tableContainer);
        scrollWrapper.appendChild(mainContent);
        container.appendChild(scrollWrapper);

        // Crear modales
        this.createSeguimientoModals(container);

        // Cargar datos
        this.loadSeguimientoData();

        // Setup event listeners
        setTimeout(() => {
            const filterBtn = document.getElementById('seguimientoFilterBtn');
            const clearBtn = document.getElementById('seguimientoClearBtn');

            if (filterBtn) {
                filterBtn.addEventListener('click', () => {
                    this.applySeguimientoFilters();
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    document.getElementById('seguimientoSearchInput').value = '';
                    document.getElementById('seguimientoEstadoFilter').value = '';
                    document.getElementById('seguimientoTipoFilter').value = '';
                    document.getElementById('seguimientoYearFilter').value = '';
                    document.getElementById('seguimientoMonthFilter').value = '';
                    this.loadSeguimientoData();
                    this.showNotification('Filtros limpiados', 'info');
                });
            }
        }, 0);
    }

    async loadSeguimientoData() {
        try {
            const result = await window.electronAPI.readAusentismoData(this.currentCompany);

            // 📦459 (2026-07-02) — Persistir estado del archivo para uso en wizard
            // seguimiento (banner preventivo en Sección 2). El handler puede retornar
            // success:true con _missingFile:true (modo degradado) — eso es éxito
            // operacional, la app sigue funcionando con BD y muestra banners.
            if (result && result._missingFile) {
                this.ausentismoFileStatus = {
                    missing: true,
                    reason: result._missingFileReason,
                    expectedDir: result._expectedDir,
                    details: result._details
                };
                console.warn('[MEDICION-AUSENT][📦459] Archivo de ausentismo no disponible:',
                    result._missingFileReason, result._details);
            } else if (result && result.success) {
                this.ausentismoFileStatus = { missing: false };
                this.ausentismoFilePath = result.file || null;
            } else if (result && !result.success) {
                // Error grave (empresa sin mapear, etc.) — no es modo degradado
                this.ausentismoFileStatus = {
                    missing: true,
                    reason: 'unreadable',
                    expectedDir: null,
                    details: result.error || 'Error desconocido'
                };
            }

            if (result.success && result.rows && !result._missingFile) {
                // Procesar datos para seguimiento
                const today = new Date();
                const currentMonth = today.toLocaleString('default', { month: 'long' }).toUpperCase();

                console.log('✅ Ausentismo cargado correctamente');

                // === CARGAR DATOS DE PRI.xlsx PARA OBTENER FECHAS DE CIERRE ===

                // Declarar priMap fuera del try para que esté disponible en todo el scope
                let priMap = new Map();

                try {
                    const priData = await window.electronAPI.buscarTodosRegistrosPRI(this.currentCompany);

                    if (priData && priData.success && priData.registros) {
                        // Crear mapa por cédula para acceso rápido
                        priData.registros.forEach(reg => {
                            const cedulaLimpia = reg.cedula?.replace(/,/g, '') || reg.CEDULA?.replace(/,/g, '') || '';
                            priMap.set(cedulaLimpia, reg);
                        });
                        // 📦459 (2026-07-02) — DIAGNÓSTICO: mostrar el primer registro recibido
                        // para ver la estructura real que llega al frontend
                        const primer = priData.registros[0];
                        if (primer) {
                            console.log(`[LOAD-PRI][📦459-DEBUG] Total registros: ${priData.registros.length}`);
                            console.log(`[LOAD-PRI][📦459-DEBUG] Cédula primer registro: ${primer.cedula}`);
                            console.log(`[LOAD-PRI][📦459-DEBUG] Nivel raíz tiene:`, {
                                fecha_cierre: primer.fecha_cierre,
                                fechaCierre: primer.fechaCierre,
                                motivo_cierre: primer.motivo_cierre,
                                motivoCierre: primer.motivoCierre,
                                fecha_reintegro: primer.fecha_reintegro,
                                fechaReintegro: primer.fechaReintegro,
                                pric_existe: !!primer.pric,
                                pric_es_objeto: typeof primer.pric === 'object' && primer.pric !== null
                            });
                            if (primer.pric && typeof primer.pric === 'object') {
                                console.log(`[LOAD-PRI][📦459-DEBUG] Dentro de pric:`, {
                                    fechaCierre: primer.pric.fechaCierre,
                                    motivoCierre: primer.pric.motivoCierre,
                                    fechaReintegro: primer.pric.fechaReintegro,
                                    fecha_cierre: primer.pric.fecha_cierre
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ ERROR cargando PRI.xlsx:', error);
                }
                // ================================================================

                // Convertir filas a objetos
                const allRecords = result.rows.map(row => {
                    const rowObj = {};
                    result.headers.forEach((header, i) => {
                        rowObj[header ? header.trim() : `col_${i}`] = row[i];
                    });
                    return rowObj;
                });

                //console.log('[DEBUG loadSeguimientoData] Primer registro:', allRecords[0]);

                // Calcular KPIs con TODOS los registros (antes de filtrar)
                this.calculateKPIsFromRawData(allRecords);

                // AGRUPAR incapacidades por empleado (cedula)
                const empleadosMap = new Map();

                allRecords.forEach((record, recordIndex) => {
                    const cedula = record['CEDULA'] || record['cedula'];
                    if (!cedula) return;
                    
                    // Limpiar cédula para buscar en PRI
                    const cedulaLimpia = cedula.replace(/,/g, '').replace(/\./g, '').trim();
                    
                    // Limpiar y parsear días de incapacidad
                    let diasIncapacidad = 0;
                    const diasRaw = record['N° DIAS DE INCAPACIDAD'] || record['n°_dias_de_incapacidad'] || record['N° DIAS'] || '0';
                    
                    // Convertir string a número (manejar formatos como "1", "1,000", etc.)
                    if (typeof diasRaw === 'string') {
                        diasIncapacidad = parseInt(diasRaw.replace(/,/g, '').replace(/\./g, '').trim()) || 0;
                    } else if (typeof diasRaw === 'number') {
                        diasIncapacidad = Math.floor(diasRaw);
                    }
                    
                    const fechaFin = record['F. FIN'] || record['f._fin'] || record['F. FIN'] || null;
                    const fechaInicio = record['F. INICIO'] || record['f._inicio'] || record['F. INICIO'] || null;

                    // === FUNCIÓN AUXILIAR para parsear fechas correctamente ===
                    // Maneja años de 2 dígitos (ej: "4/1/25" → 2025, no 1925)
                    //
                    // 📦459 (2026-07-02) — Mejorado: cuando NO puede parsear una fecha,
                    // loguea contexto útil para que el usuario ubique la fila en su Excel:
                    // fila aproximada + cédula + nombre + campo. Esto facilita corregir
                    // datos corruptos como "30/012/2017", "20222", "109/2017" que aparecen
                    // por tipeo en el archivo fuente.
                    //
                    // IMPORTANTE: NO hace "best effort" (no inventa fechas). En un sistema
                    // de salud ocupacional regulado por la Resolución 0312 de 2019, una fecha
                    // inventada en un reporte oficial es peor que omitir la fila.
                    function parsearFecha(fechaStr, ctx) {
                        if (!fechaStr) return null;

                        // Si ya es un objeto Date, retornarlo
                        if (fechaStr instanceof Date) return fechaStr;

                        const str = fechaStr.toString().trim();

                        // Intentar parsear directamente primero
                        let date = new Date(str);

                        // Si la fecha es inválida o el año es anterior a 2000, intentar formato DD/MM/YY o DD/MM/YYYY
                        if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
                            // Intentar extraer componentes manualmente
                            const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
                            if (match) {
                                const dia = parseInt(match[1], 10);
                                const mes = parseInt(match[2], 10) - 1; // Meses en JS son 0-11
                                let anio = parseInt(match[3], 10);

                                // Si el año tiene 2 dígitos, asumir 2000s
                                if (anio < 100) {
                                    anio = anio < 50 ? 2000 + anio : 1900 + anio;
                                }

                                date = new Date(anio, mes, dia);
                            }
                        }

                        // Validar que la fecha sea correcta
                        if (isNaN(date.getTime())) {
                            // 📦459 — Log enriquecido con contexto para facilitar ubicación
                            // en el Excel. La fila es aproximada (header en fila 1, datos
                            // desde fila 2); main.js no retorna headerRowIndex, así que no
                            // podemos calcular la fila exacta sin tocar el IPC.
                            const filaAprox = (ctx && ctx.recordIndex != null) ? ctx.recordIndex + 2 : '?';
                            const cedulaCtx = (ctx && ctx.cedula) ? `Cédula ${ctx.cedula}` : 'Cédula ?';
                            const nombreCtx = (ctx && ctx.nombre) ? `(${ctx.nombre})` : '';
                            const campoCtx = (ctx && ctx.campo) ? `campo "${ctx.campo}"` : '';
                            console.warn(
                                `[PARSEAR FECHA] No se pudo parsear: "${fechaStr}"` +
                                ` — Fila ~${filaAprox} del Excel` +
                                ` | ${cedulaCtx} ${nombreCtx}` +
                                (campoCtx ? ` | ${campoCtx}` : '') +
                                ` | Sugerencia: revisar la celda y corregir el formato de fecha.`
                            );
                            return null;
                        }

                        return date;
                    }

                    if (!empleadosMap.has(cedula)) {
                        empleadosMap.set(cedula, {
                            cedula: cedula,
                            nombre: record['NOMBRE'] || record['nombre'] || '',
                            cargo: record['CARGO'] || record['cargo'] || '',
                            departamento: record['ÁREA O DPTO'] || record['area_o_dpto'] || '',
                            empresaUsuaria: record['EMPRESA USUARIA'] || record['empresa_usuaria'] || '',
                            genero: record['GENERO'] || record['genero'] || '',
                            incapacidades: [],
                            registroPRI: priMap.get(cedulaLimpia) || null  // 🆕 Agregar datos de PRI
                        });
                    }

                    empleadosMap.get(cedula).incapacidades.push({
                        fechaInicio: parsearFecha(fechaInicio, { recordIndex, cedula, nombre: record['NOMBRE'] || record['nombre'] || '', campo: 'F. INICIO' }),
                        fechaFin: parsearFecha(fechaFin, { recordIndex, cedula, nombre: record['NOMBRE'] || record['nombre'] || '', campo: 'F. FIN' }),
                        diasIncapacidad: diasIncapacidad,
                        record
                    });
                });

                //console.log('[DEBUG loadSeguimientoData] Total de empleados únicos:', empleadosMap.size);
                //console.log('[DEBUG loadSeguimientoData] Empleados con datos PRI:', Array.from(empleadosMap.values()).filter(emp => emp.registroPRI).length);
                
                // LOG DETALLADO: Mostrar TODAS las incapacidades de cada empleado
                //console.log('========== DETALLE DE EMPLEADOS ==========');
                //empleadosMap.forEach((empleado, cedula) => {
                //    console.log(`\n[EMPLEADO] ${empleado.nombre} (CC: ${cedula})`);
                //    console.log(`  Total incapacidades: ${empleado.incapacidades.length}`);
                //    empleado.incapacidades.forEach((inc, idx) => {
                //        const fechaIniStr = inc.fechaInicio ? inc.fechaInicio.toLocaleDateString() : 'N/A';
                //        const fechaFinStr = inc.fechaFin ? inc.fechaFin.toLocaleDateString() : 'N/A';
                //        console.log(`    [${idx}] ${fechaIniStr} a ${fechaFinStr} = ${inc.diasIncapacidad} días`);
                //    });
                //});
                //console.log('==========================================');
                
                //console.log('[DEBUG loadSeguimientoData] Empleados agrupados:', Array.from(empleadosMap.entries()).map(([cedula, emp]) => ({
                //    cedula,
                //    nombre: emp.nombre,
                //    totalIncapacidades: emp.incapacidades.length,
                //    totalDias: emp.incapacidades.reduce((sum, inc) => sum + inc.diasIncapacidad, 0),
                //    incapacidades: emp.incapacidades.map(inc => ({
                //        dias: inc.diasIncapacidad,
                //        inicio: inc.fechaInicio,
                //        fin: inc.fechaFin
                //    }))
                //})).slice(0, 5)); // Mostrar solo primeros 5

                // FILTRAR empleados que cumplen las condiciones
                this.seguimientoData = Array.from(empleadosMap.values()).filter(empleado => {
                    // Ordenar incapacidades por fecha de inicio
                    empleado.incapacidades.sort((a, b) => {
                        if (!a.fechaInicio) return 1;
                        if (!b.fechaInicio) return -1;
                        return a.fechaInicio - b.fechaInicio;
                    });

                    // Condición 1: Alguna incapacidad individual >= 10 días
                    const tieneIncapacidadLarga = empleado.incapacidades.some(inc => {
                        return inc.diasIncapacidad >= 10;
                    });
                    
                    if (tieneIncapacidadLarga) {
                        //console.log('[DEBUG FILTRO] Empleado cumple Condición 1 (incapacidad >= 10 días):', empleado.nombre, 'Cédula:', empleado.cedula);
                        // Log de qué incapacidades cumplen >= 10 días
                        empleado.incapacidades.forEach((inc, idx) => {
                            if (inc.diasIncapacidad >= 10) {
                                const fechaStr = inc.fechaInicio ? inc.fechaInicio.toLocaleDateString() : 'N/A';
                                // console.log(`  → Incapacidad [${idx}]: ${fechaStr} = ${inc.diasIncapacidad} días (CUMPLE >= 10)`);
                            }
                        });
                        return true;
                    }

                    // Condición 2: Suma de incapacidades >= 10 días Y gap entre incapacidades <= 3 días
                    const totalDias = empleado.incapacidades.reduce((sum, inc) => sum + inc.diasIncapacidad, 0);
                    
                    if (totalDias >= 10) {
                        // Verificar que el gap entre incapacidades consecutivas sea <= 3 días
                        let gapValido = true;
                        
                        for (let i = 1; i < empleado.incapacidades.length; i++) {
                            const incAnterior = empleado.incapacidades[i - 1];
                            const incActual = empleado.incapacidades[i];
                            
                            if (!incAnterior.fechaFin || !incActual.fechaInicio) {
                                gapValido = false;
                                break;
                            }
                            
                            // Calcular gap entre el fin de la anterior y el inicio de la actual
                            const gapDias = Math.ceil((incActual.fechaInicio - incAnterior.fechaFin) / (1000 * 60 * 60 * 24));
                            
                            // Si el gap es mayor a 3 días, no cumple la condición
                            if (gapDias > 3) {
                                gapValido = false;
                                break;
                            }
                        }
                        
                        if (gapValido && empleado.incapacidades.length > 1) {
                            //console.log('[DEBUG FILTRO] Empleado cumple Condición 2 (suma >= 10 y gaps <= 3):', empleado.nombre, 'Cédula:', empleado.cedula, 'Total días:', totalDias);
                            return true;
                        } else {
                            //console.log('[DEBUG FILTRO] Empleado NO cumple Condición 2 (gaps > 3):', empleado.nombre, 'Cédula:', empleado.cedula, 'Total días:', totalDias);
                        }
                    }

                    return false;
                });

                //console.log('[DEBUG loadSeguimientoData] Total de empleados que cumplen filtros:', this.seguimientoData.length);
                //console.log('[DEBUG loadSeguimientoData] Empleados filtrados:', this.seguimientoData.map(emp => ({
                //    nombre: emp.nombre,
                //    cedula: emp.cedula,
                //    totalIncapacidades: emp.incapacidades.length,
                //    totalDias: emp.incapacidades.reduce((sum, inc) => sum + inc.diasIncapacidad, 0),
                //    ultimaIncapacidad: emp.incapacidades.length > 0 ? {
                //        fechaInicio: emp.incapacidades[emp.incapacidades.length - 1].fechaInicio,
                //        dias: emp.incapacidades[emp.incapacidades.length - 1].diasIncapacidad
                //    } : null
                //})));

                // Verificar si hay datos antes de renderizar
                if (this.seguimientoData.length === 0) {
                    //console.warn('[DEBUG loadSeguimientoData] ⚠️ ADVERTENCIA: No hay empleados que cumplan las condiciones!');
                    //console.log('[DEBUG loadSeguimientoData] Revisar datos de ejemplo:', Array.from(empleadosMap.values()).slice(0, 3).map(emp => ({
                    //    nombre: emp.nombre,
                    //    incapacidades: emp.incapacidades.map(inc => ({
                    //        dias: inc.diasIncapacidad,
                    //        inicio: inc.fechaInicio,
                    //        fin: inc.fechaFin
                    //    }))
                    //})));
                } else {
                    //console.log('[DEBUG loadSeguimientoData] ✅ Hay', this.seguimientoData.length, 'empleados para mostrar en la tabla');
                }

                // Llenar el filtro de años con todos los años únicos de los datos
                this.llenarFiltroAnios(empleadosMap);

                // Calcular KPIs
                this.calculateKPIs();

                //console.log('[DEBUG loadSeguimientoData] Renderizando tabla con', this.seguimientoData.length, 'empleados');

                // Renderizar tabla
                this.renderSeguimientoTable(this.seguimientoData);
            } else if (result && result.success && result._missingFile) {
                // 📦459 — Modo degradado: archivo no disponible, pero app sigue funcionando.
                // Mostrar banner preventivo arriba de la tabla + tabla vacía con CTA.
                console.log('[MEDICION-AUSENT][📦459] Cargando vista con banner de archivo faltante');
                this.seguimientoData = [];
                this.calculateKPIs();
                this.renderSeguimientoTable([]);

                // Buscar contenedor principal de la vista de seguimiento
                const scrollWrapper = document.getElementById('seguimiento-incapacidades-scroll-wrapper');
                const bannerContainer = scrollWrapper || this.container;
                // Quitar banner previo si existe
                const oldBanner = bannerContainer.querySelector('.km-missing-banner');
                if (oldBanner) oldBanner.remove();
                this._injectAusentismoMissingBanner(bannerContainer, { variant: 'warning' });
            } else {
                //console.log('[DEBUG loadSeguimientoData] No hay datos o error en result');
                this.renderSeguimientoTable([]);
            }
        } catch (error) {
            console.error('[DEBUG loadSeguimientoData] Error loading seguimiento data:', error);
            this.renderSeguimientoTable([]);
        }
    }

    /**
     * Llena el dropdown de años con todos los años únicos presentes en los datos
     * @param {Map} empleadosMap - Mapa de empleados con sus incapacidades
     */
    llenarFiltroAnios(empleadosMap) {
        const yearSelect = document.getElementById('seguimientoYearFilter');
        if (!yearSelect) return;

        // Extraer todos los años únicos de las incapacidades
        const yearsSet = new Set();
        empleadosMap.forEach(empleado => {
            empleado.incapacidades.forEach(inc => {
                if (inc.fechaInicio) {
                    const anio = inc.fechaInicio instanceof Date 
                        ? inc.fechaInicio.getFullYear() 
                        : new Date(inc.fechaInicio).getFullYear();
                    yearsSet.add(anio);
                }
            });
        });

        // Convertir a array y ordenar descendente (año más reciente primero)
        const yearsArray = Array.from(yearsSet).sort((a, b) => b - a);

        console.log('[DEBUG llenarFiltroAnios] Años encontrados:', yearsArray);

        // Llenar el select
        yearSelect.innerHTML = '<option value="">Todos</option>' + 
            yearsArray.map(year => `<option value="${year}">${year}</option>`).join('');
    }

    calculateKPIs() {
        const today = new Date();
        const currentMonth = today.toLocaleString('default', { month: 'long' }).toUpperCase();
        let enSeguimiento = 0;
        let casosPRIC = 0;
        let sinIniciar = 0;
        let cerradosMes = 0;

        //console.log('[KPIs] Calculando con', this.seguimientoData ? this.seguimientoData.length : 0, 'empleados');

        if (!this.seguimientoData || this.seguimientoData.length === 0) {
            //console.warn('[KPIs] No hay datos para calcular KPIs');
            // Actualizar UI con 0
            const kpiElements = document.querySelectorAll('.kpi-value');
            if (kpiElements[0]) kpiElements[0].textContent = '0';
            if (kpiElements[1]) kpiElements[1].textContent = '0';
            if (kpiElements[2]) kpiElements[2].textContent = '0';
            if (kpiElements[3]) kpiElements[3].textContent = '0';
            return;
        }

        // 🆕 CONTAR CASOS PRIC (ARL) - Buscar en TODOS los registros por tipo ARL
        this.seguimientoData.forEach(empleado => {
            const incapacidades = empleado.incapacidades || [];
            incapacidades.forEach(incapacidad => {
                const tipo = incapacidad.record?.['CLASE DE INCAPACIDAD'] || 
                            incapacidad.record?.['clase_de_incapacidad'] || 
                            incapacidad.record?.['TIPO'] || '';
                if (tipo.toUpperCase() === 'ARL') {
                    casosPRIC++;
                }
            });
        });

        this.seguimientoData.forEach(empleado => {
            // 🆕 IMPORTANTE: Contar solo UNA vez por EMPLEADO, no por cada incapacidad
            // Identificar la incapacidad PRINCIPAL (la más reciente) para determinar el estado
            const incapacidades = empleado.incapacidades || [];

            if (incapacidades.length === 0) {
                // Sin incapacidades -> Sin Iniciar
                sinIniciar++;
                //console.log(`[KPIs] ${empleado.nombre}: SIN INICIAR (sin incapacidades)`);
                return;
            }

            // Tomar la incapacidad más reciente para determinar el estado
            const incapacidadPrincipal = incapacidades[incapacidades.length - 1];
            const fechaFin = incapacidadPrincipal.fechaFin ? new Date(incapacidadPrincipal.fechaFin) : null;
            const fechaInicio = incapacidadPrincipal.fechaInicio ? new Date(incapacidadPrincipal.fechaInicio) : null;

            if (!fechaFin || !fechaInicio) {
                // Sin fechas válidas -> Sin Iniciar
                sinIniciar++;
                //console.log(`[KPIs] ${empleado.nombre}: SIN INICIAR (sin fechas)`);
                return;
            }

            const diffTime = fechaFin - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // 🆕 Determinar estado usando la nueva lógica con fechas de cierre
            const estadoInfo = this.determinarEstadoCaso(incapacidadPrincipal, empleado.registroPRI);
            const estado = estadoInfo.estado;

            //console.log(`[KPIs] ${empleado.nombre}: ${estado} (registroPRI: ${empleado.registroPRI ? 'SÍ' : 'NO'})`);

            // Contar por estado (UNA SOLA VEZ por empleado)
            if (estado === 'En Seguimiento') {
                enSeguimiento++;
            } else if (estado === 'Cerrado') {
                cerradosMes++; // 🆕 Ahora cuenta TODOS los casos cerrados, no solo los del mes
            } else if (estado === 'Sin Iniciar') {
                sinIniciar++;
            }
        });

        this.kpiEnSeguimiento = enSeguimiento;
        this.kpiCasosPRIC = casosPRIC;
        this.kpiSinIniciar = sinIniciar;
        this.kpiCerradosMes = cerradosMes;

        //console.log('[KPIs] Resultados:', { enSeguimiento, casosPRIC, sinIniciar, cerradosMes, total: this.seguimientoData.length });
        //console.log('[KPIs] Verificación:', enSeguimiento + casosPRIC + sinIniciar, '==', this.seguimientoData.length);

        // Actualizar UI de KPIs
        const kpiElements = document.querySelectorAll('.kpi-value');
        if (kpiElements[0]) kpiElements[0].textContent = enSeguimiento;
        if (kpiElements[1]) kpiElements[1].textContent = casosPRIC;
        if (kpiElements[2]) kpiElements[2].textContent = sinIniciar;
        if (kpiElements[3]) kpiElements[3].textContent = cerradosMes;
    }

    /**
     * Calcula KPIs desde datos crudos (antes de filtrar)
     * @param {Array} allRecords - Todos los registros del Excel
     */
    calculateKPIsFromRawData(allRecords) {
        const today = new Date();
        const currentMonth = today.toLocaleString('default', { month: 'long' }).toUpperCase();
        let casosActivos = 0;
        let proximosVencer = 0;
        let docsPendientes = 0;
        let cerradosMes = 0;

        //console.log('[KPIs Raw] Calculando con', allRecords.length, 'registros crudos');

        allRecords.forEach(row => {
            // Leer fechas directamente del row
            const fechaFinStr = row['F. FIN'] || row['f._fin'] || row['F. FIN'] || null;
            const fechaInicioStr = row['F. INICIO'] || row['f._inicio'] || row['F. INICIO'] || null;

            if (!fechaFinStr || !fechaInicioStr) return;

            // Parsear fechas
            const fechaFin = new Date(fechaFinStr);
            const fechaInicio = new Date(fechaInicioStr);

            if (isNaN(fechaFin.getTime()) || isNaN(fechaInicio.getTime())) return;

            const diffTime = fechaFin - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Casos activos (fecha fin futura o dentro de los últimos 30 días)
            if (diffDays >= -30) {
                casosActivos++;

                // Próximos a vencer (menos de 2 días)
                if (diffDays >= 0 && diffDays <= 2) {
                    proximosVencer++;
                }
            }

            // Casos cerrados este mes (fecha fin en el mes actual y ya venció)
            const finMonth = fechaFin.toLocaleString('default', { month: 'long' }).toUpperCase();
            const finYear = fechaFin.getFullYear();
            if (finMonth === currentMonth && finYear === today.getFullYear() && diffDays < 0) {
                cerradosMes++;
            }

            // Docs pendientes (simulado - verificar si hay descripción)
            const descripcion = row['DESCRIPCION'] || row['descripcion'] || row['DESCRIPCIÓN'] || '';
            if (!descripcion || descripcion.trim() === '') {
                docsPendientes++;
            }
        });

        this.kpiCasosActivos = casosActivos;
        this.kpiProximosVencer = proximosVencer;
        this.kpiDocsPendientes = docsPendientes;
        this.kpiCerradosMes = cerradosMes;

        //console.log('[KPIs Raw] Resultados:', { casosActivos, proximosVencer, docsPendientes, cerradosMes });

        // Actualizar UI de KPIs
        const kpiElements = document.querySelectorAll('.kpi-value');
        if (kpiElements[0]) kpiElements[0].textContent = casosActivos;
        if (kpiElements[1]) kpiElements[1].textContent = proximosVencer;
        if (kpiElements[2]) kpiElements[2].textContent = docsPendientes;
        if (kpiElements[3]) kpiElements[3].textContent = cerradosMes;
    }

    renderSeguimientoTable(data) {
        const tbody = document.getElementById('seguimientoTableBody');
        
        if (!tbody) {
            console.error('[DEBUG renderSeguimientoTable] ERROR: Elemento seguimientoTableBody no encontrado en el DOM!');
            
            // Intentar buscar con otros selectores
            const alternativeTbody = document.querySelector('#seguimientoTableBody, tbody[id*="seguimiento"], tbody');
            
            if (alternativeTbody) {
                this.renderSeguimientoTableWithBody(alternativeTbody, data);
            }
            return;
        }

        this.renderSeguimientoTableWithBody(tbody, data);
    }

    /**
     * Determina el estado de un caso basado en la disponibilidad de datos en el Excel
     * @param {Object} incapacidad - Objeto de incapacidad con fechaInicio, fechaFin y record (datos del Excel de Ausentismo)
     * @param {Object} registroPRI - Registro completo desde PRI.xlsx (opcional, contiene fechas de cierre)
     * @returns {Object} { estado: string, badgeClass: string, progressClass: string }
     */
    determinarEstadoCaso(incapacidad, registroPRI = null) {
        // Los datos del Excel de Ausentismo están en incapacidad.record
        const recordAusentismo = incapacidad?.record || {};
        
        // Los datos de PRI.xlsx (si están disponibles)
        const recordPRI = registroPRI || {};
        
        //console.log('[DETERMINAR ESTADO] Record Ausentismo:', recordAusentismo);
        //console.log('[DETERMINAR ESTADO] Record PRI:', recordPRI);
        
        // === 📦459 (2026-07-02) — Detección AMPLIADA de cierre ===
        // BUG RAÍZ: el handler Python `cargar_todos_registros_pri` devuelve los campos
        // de cierre en camelCase DENTRO de `pric`:
        //   recordPRI.pric.fechaCierre   (NO recordPRI.fecha_cierre)
        //   recordPRI.pric.motivoCierre
        //   recordPRI.pric.fechaReintegro
        // Mi código buscaba snake_case a nivel raíz → nunca encontraba nada.
        // AHORA busca snake_case a nivel raíz (de buscar_registros_por_cedula) Y
        // camelCase dentro de pric (de cargar_todos_registros_pri).
        let tieneFechaCierre = false;
        let motivoCierreDetectado = null;

        if (recordPRI && Object.keys(recordPRI).length > 0) {
            // PRI primero (fuente primaria) — 22 variantes
            const candidatosPRI = [
                // snake_case a nivel raíz (de buscar_registros_por_cedula)
                recordPRI.fecha_cierre, recordPRI.fechaCierre,
                recordPRI.fecha_cierre_pric, recordPRI.fechaCierrePric,
                recordPRI.fecha_reintegro, recordPRI.fechaReintegro,
                recordPRI.fecha_alta, recordPRI.fechaAlta,
                recordPRI.fecha_cierre_seguimiento, recordPRI.fechaCierreSeguimiento,
                recordPRI.motivo_cierre, recordPRI.motivoCierre,
                recordPRI.estado_caso, recordPRI.estadoCaso, recordPRI.estado,
                recordPRI['Estado Caso'], recordPRI['ESTADO'],
                // camelCase dentro de pric (de cargar_todos_registros_pri)
                recordPRI.pric?.fechaCierre, recordPRI.pric?.fechaCierrePric,
                recordPRI.pric?.fechaReintegro, recordPRI.pric?.fechaAlta,
                recordPRI.pric?.motivoCierre, recordPRI.pric?.estadoCaso,
                // snake_case dentro de pric (por si acaso)
                recordPRI.pric?.fecha_cierre, recordPRI.pric?.fecha_reintegro,
                recordPRI.pric?.fecha_alta, recordPRI.pric?.motivo_cierre
            ];
            for (const cand of candidatosPRI) {
                if (cand && String(cand).trim() !== '') {
                    tieneFechaCierre = true;
                    motivoCierreDetectado = String(cand);
                    break;
                }
            }
        }
        if (!tieneFechaCierre) {
            // Fallback al Excel de Ausentismo
            const candidatosAus = [
                recordAusentismo['FECHA CIERRE'], recordAusentismo['fecha_cierre'],
                recordAusentismo['FECHA CIERRE INC'], recordAusentismo['fecha_cierre_inc'],
                recordAusentismo['FECHA CIERRE PRIC'], recordAusentismo['fecha_cierre_pric'],
                recordAusentismo['FECHA REINTEGRO'], recordAusentismo['fecha_reintegro'],
                recordAusentismo['FECHA ALTA'], recordAusentismo['fecha_alta'],
                recordAusentismo['MOTIVO CIERRE'], recordAusentismo['motivo_cierre']
            ];
            for (const cand of candidatosAus) {
                if (cand && String(cand).trim() !== '') {
                    tieneFechaCierre = true;
                    motivoCierreDetectado = String(cand);
                    break;
                }
            }
        }

        // === Buscar fecha de seguimiento ===
        let fechaSeguimiento1 = null;

        if (recordPRI && Object.keys(recordPRI).length > 0) {
            // Buscar en PRI.xlsx primero
            fechaSeguimiento1 = recordPRI.seguimientos?.[0]?.fecha ||
                               recordPRI.fecha_seguimiento_1 ||
                               recordPRI.pric?.fechaSeguimiento1 || null;
        } else {
            // Si no hay PRI, buscar en Ausentismo (backup)
            fechaSeguimiento1 = recordAusentismo['FECHA SEGUIMIENTO 1'] || recordAusentismo['fecha_seguimiento_1'] || null;
        }

        const tieneSeguimientos = fechaSeguimiento1 ? true : false;

        // === Verificar si hay cédula (siempre debería haberla si estamos en la tabla) ===
        const tieneCedulaEnExcel = recordAusentismo['CEDULA'] || recordAusentismo['cedula'] ||
                                   recordPRI.cedula || recordPRI.CEDULA || null;

        //console.log('[DETERMINAR ESTADO] tieneFechaCierre:', tieneFechaCierre, 'motivo:', motivoCierreDetectado);
        //console.log('[DETERMINAR ESTADO] fechaSeguimiento1:', fechaSeguimiento1, 'tieneSeguimientos:', tieneSeguimientos);
        //console.log('[DETERMINAR ESTADO] tieneCedulaEnExcel:', tieneCedulaEnExcel);

        // Estado por defecto
        let estado = 'Sin Iniciar';
        let badgeClass = 'badge-pending';
        let progressClass = 'warning';

        // Regla 1: Si tiene fecha de cierre → CERRADO
        if (tieneFechaCierre) {
            estado = 'Cerrado';
            badgeClass = 'badge-finished';
            progressClass = 'success';
            console.log('[DETERMINAR ESTADO] Estado determinado: CERRADO (motivo:', motivoCierreDetectado + ')');
        }
        // Regla 2: Si tiene fecha de seguimiento → EN SEGUIMIENTO
        else if (tieneSeguimientos) {
            estado = 'En Seguimiento';
            badgeClass = 'badge-active';
            progressClass = '';
            //console.log('[DETERMINAR ESTADO] Estado determinado: EN SEGUIMIENTO (tiene fecha de seguimiento:', fechaSeguimiento1 + ')');
        }
        // Regla 3: Si NO tiene información de la cédula en el Excel → SIN INICIAR
        else if (!tieneCedulaEnExcel) {
            estado = 'Sin Iniciar';
            badgeClass = 'badge-pending';
            progressClass = 'warning';
            console.log('[DETERMINAR ESTADO] Estado determinado: SIN INICIAR (no tiene cédula en Excel)');
        }
        // Regla 4: Por defecto, si tiene cédula pero no seguimiento ni cierre → SIN INICIAR
        else {
            estado = 'Sin Iniciar';
            badgeClass = 'badge-pending';
            progressClass = 'warning';
            //console.log('[DETERMINAR ESTADO] Estado determinado: SIN INICIAR (por defecto)');
        }

        return { estado, badgeClass, progressClass };
    }

    /**
     * Calcula el porcentaje de avance del caso basado en hitos del proceso en PRI.xlsx
     * @param {Object} incapacidad - Objeto de incapacidad con fechaInicio, fechaFin y record
     * @param {Object} registroPRI - Registro completo desde PRI.xlsx (opcional)
     * @returns {Object} { porcentaje: number, color: string, descripcion: string }
     */
    calcularPorcentajeAvance(incapacidad, registroPRI = null) {
        const recordAusentismo = incapacidad?.record || {};
        const recordPRI = registroPRI || {};
        
        // === Buscar fechas de seguimiento en PRI.xlsx (fuente primaria) ===
        let seguimientos = [];
        
        if (recordPRI && Object.keys(recordPRI).length > 0) {
            // Buscar en PRI.xlsx primero
            seguimientos = recordPRI.seguimientos || [];
            
            // Si no hay seguimientos en el array, intentar con campos individuales
            if (seguimientos.length === 0) {
                if (recordPRI.fecha_seguimiento_1) seguimientos.push({ fecha: recordPRI.fecha_seguimiento_1 });
                if (recordPRI.fecha_seguimiento_2) seguimientos.push({ fecha: recordPRI.fecha_seguimiento_2 });
                if (recordPRI.pric?.fechaSeguimiento1) seguimientos.push({ fecha: recordPRI.pric.fechaSeguimiento1 });
                if (recordPRI.pric?.fechaSeguimiento2) seguimientos.push({ fecha: recordPRI.pric.fechaSeguimiento2 });
            }
        } else {
            // Si no hay PRI, buscar en Ausentismo (backup)
            if (recordAusentismo['FECHA SEGUIMIENTO 1'] || recordAusentismo['fecha_seguimiento_1']) {
                seguimientos.push({ fecha: recordAusentismo['FECHA SEGUIMIENTO 1'] || recordAusentismo['fecha_seguimiento_1'] });
            }
            if (recordAusentismo['FECHA SEGUIMIENTO 2'] || recordAusentismo['fecha_seguimiento_2']) {
                seguimientos.push({ fecha: recordAusentismo['FECHA SEGUIMIENTO 2'] || recordAusentismo['fecha_seguimiento_2'] });
            }
        }
        
        // === 📦459 (2026-07-02) — Detección AMPLIADA de cierre (igual que determinarEstadoCaso)
        // BUG RAÍZ: buscar_todos_registros_pri devuelve campos en camelCase dentro de pric:
        //   recordPRI.pric.fechaCierre, recordPRI.pric.motivoCierre, etc.
        // Por eso el cálculo de avance quedaba en 60% aunque la fecha de cierre existiera.
        let tieneFechaCierre = false;

        if (recordPRI && Object.keys(recordPRI).length > 0) {
            const candidatosPRI = [
                // snake_case a nivel raíz
                recordPRI.fecha_cierre, recordPRI.fechaCierre,
                recordPRI.fecha_cierre_pric, recordPRI.fechaCierrePric,
                recordPRI.fecha_reintegro, recordPRI.fechaReintegro,
                recordPRI.fecha_alta, recordPRI.fechaAlta,
                recordPRI.fecha_cierre_seguimiento, recordPRI.fechaCierreSeguimiento,
                recordPRI.motivo_cierre, recordPRI.motivoCierre,
                recordPRI.estado_caso, recordPRI.estadoCaso, recordPRI.estado,
                recordPRI['Estado Caso'], recordPRI['ESTADO'],
                // camelCase dentro de pric (lo que usa cargar_todos_registros_pri)
                recordPRI.pric?.fechaCierre, recordPRI.pric?.fechaCierrePric,
                recordPRI.pric?.fechaReintegro, recordPRI.pric?.fechaAlta,
                recordPRI.pric?.motivoCierre, recordPRI.pric?.estadoCaso,
                // snake_case dentro de pric (por si acaso)
                recordPRI.pric?.fecha_cierre, recordPRI.pric?.fecha_reintegro,
                recordPRI.pric?.fecha_alta, recordPRI.pric?.motivo_cierre
            ];
            for (const cand of candidatosPRI) {
                if (cand && String(cand).trim() !== '') {
                    tieneFechaCierre = true;
                    break;
                }
            }
        }
        if (!tieneFechaCierre) {
            const candidatosAus = [
                recordAusentismo['FECHA CIERRE'], recordAusentismo['fecha_cierre'],
                recordAusentismo['FECHA CIERRE INC'], recordAusentismo['fecha_cierre_inc'],
                recordAusentismo['FECHA CIERRE PRIC'], recordAusentismo['fecha_cierre_pric'],
                recordAusentismo['FECHA REINTEGRO'], recordAusentismo['fecha_reintegro'],
                recordAusentismo['FECHA ALTA'], recordAusentismo['fecha_alta'],
                recordAusentismo['MOTIVO CIERRE'], recordAusentismo['motivo_cierre']
            ];
            for (const cand of candidatosAus) {
                if (cand && String(cand).trim() !== '') {
                    tieneFechaCierre = true;
                    break;
                }
            }
        }
        const cantidadSeguimientos = seguimientos.filter(s => s.fecha && s.fecha.trim() !== '').length;

        // 📦459 (2026-07-02) — DIAGNÓSTICO: mostrar qué campos de cierre encuentra y dónde
        if (recordPRI && Object.keys(recordPRI).length > 0) {
            const todosCandidatos = [
                ['nivel_raiz.fecha_cierre', recordPRI.fecha_cierre],
                ['nivel_raiz.fechaCierre', recordPRI.fechaCierre],
                ['nivel_raiz.fecha_reintegro', recordPRI.fecha_reintegro],
                ['nivel_raiz.fechaReintegro', recordPRI.fechaReintegro],
                ['nivel_raiz.motivo_cierre', recordPRI.motivo_cierre],
                ['nivel_raiz.motivoCierre', recordPRI.motivoCierre],
                ['pric.fechaCierre', recordPRI.pric?.fechaCierre],
                ['pric.motivoCierre', recordPRI.pric?.motivoCierre],
                ['pric.fechaReintegro', recordPRI.pric?.fechaReintegro],
                ['pric.fecha_cierre', recordPRI.pric?.fecha_cierre],
                ['pric.disponible', !!recordPRI.pric]
            ];
            const encontrados = todosCandidatos.filter(([_, val]) => val && String(val).trim() !== '');
            console.log(`[CALCULAR AVANCE][📦459-DEBUG] Cédula=${recordPRI.cedula || '?'} | pric_disponible=${!!recordPRI.pric} | campos_con_valor_encontrados=[${encontrados.map(([k, v]) => k + '=' + JSON.stringify(String(v).slice(0, 30))).join(', ')}]`);
            console.log(`[CALCULAR AVANCE][📦459-DEBUG] tieneFechaCierre final: ${tieneFechaCierre} | cantidadSeguimientos: ${cantidadSeguimientos}`);
        }
        
        // === Reglas de porcentaje de avance ===
        let porcentaje = 0;
        let color = '#F59E0B'; // Ámbar por defecto (0%)
        let descripcion = 'Sin iniciar';
        
        // Regla 1: Si tiene fecha de cierre → 100%
        if (tieneFechaCierre) {
            porcentaje = 100;
            color = '#10B981'; // Verde
            descripcion = 'Caso cerrado';
            console.log('[CALCULAR AVANCE] 100% - Caso cerrado');
        }
        // Regla 2: Basado en cantidad de seguimientos
        else if (cantidadSeguimientos >= 4) {
            porcentaje = 80;
            color = '#3B82F6'; // Azul
            descripcion = '4° seguimiento realizado';
            console.log('[CALCULAR AVANCE] 80% - 4 seguimientos');
        }
        else if (cantidadSeguimientos === 3) {
            porcentaje = 60;
            color = '#3B82F6'; // Azul
            descripcion = '3° seguimiento realizado';
            console.log('[CALCULAR AVANCE] 60% - 3 seguimientos');
        }
        else if (cantidadSeguimientos === 2) {
            porcentaje = 30;
            color = '#8B5CF6'; // Violeta
            descripcion = '2° seguimiento realizado';
            console.log('[CALCULAR AVANCE] 30% - 2 seguimientos');
        }
        else if (cantidadSeguimientos === 1) {
            porcentaje = 10;
            color = '#A78BFA'; // Violeta claro
            descripcion = '1° seguimiento realizado';
            console.log('[CALCULAR AVANCE] 10% - 1 seguimiento');
        }
        else {
            porcentaje = 0;
            color = '#F59E0B'; // Ámbar
            descripcion = 'Sin iniciar';
            console.log('[CALCULAR AVANCE] 0% - Sin seguimientos');
        }
        
        return { porcentaje, color, descripcion };
    }

    renderSeguimientoTableWithBody(tbody, data) {
        console.log('[DEBUG renderSeguimientoTableWithBody] Renderizando', data.length, 'empleados en la tabla');

        if (!data || data.length === 0) {
            console.log('[DEBUG renderSeguimientoTableWithBody] No hay datos para mostrar');
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #64748B;">
                        <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                        <p>No hay seguimientos para mostrar</p>
                    </td>
                </tr>
            `;
            return;
        }

        const today = new Date();
        console.log('[DEBUG renderSeguimientoTableWithBody] Fecha hoy:', today);
        console.log('[DEBUG renderSeguimientoTableWithBody] Primer empleado:', data[0]);

        tbody.innerHTML = data.map((empleado, index) => {
            // Estructura de datos agrupados: {nombre, cedula, incapacidades: [...], cargo, departamento, etc.}
            const nombre = empleado.nombre || 'Sin nombre';
            const cedula = empleado.cedula || '';

            // IDENTIFICAR la incapacidad PRINCIPAL que activa el seguimiento
            // Las incapacidades ya están ordenadas por fecha de inicio (ascendente) en loadSeguimientoData

            // Primero, buscar incapacidades >= 10 días (Condición 1)
            const incapacidadesLargas = empleado.incapacidades.filter(inc => inc.diasIncapacidad >= 10);

            let incapacidadPrincipal = null;

            if (incapacidadesLargas.length > 0) {
                // Condición 1: Tomar la incapacidad >= 10 días MÁS RECIENTE
                incapacidadPrincipal = incapacidadesLargas[incapacidadesLargas.length - 1];
            } else if (empleado.incapacidades.length > 1) {
                // Condición 2: Secuencia de incapacidades que suman >= 10 días con gaps <= 3 días
                // Tomar la última incapacidad de la secuencia (la más reciente)
                incapacidadPrincipal = empleado.incapacidades[empleado.incapacidades.length - 1];
            } else {
                // Caso fallback: tomar la única incapacidad disponible
                incapacidadPrincipal = empleado.incapacidades.length > 0
                    ? empleado.incapacidades[empleado.incapacidades.length - 1]
                    : null;
            }

            // Obtener tipo de la incapacidad principal (o default EPS)
            const tipo = incapacidadPrincipal?.record?.['CLASE DE INCAPACIDAD'] ||
                        incapacidadPrincipal?.record?.['clase_de_incapacidad'] || 'EPS';

            // Usar fechas de la incapacidad PRINCIPAL (la que activa el seguimiento)
            const fechaInicio = incapacidadPrincipal?.fechaInicio || null;
            const fechaFin = incapacidadPrincipal?.fechaFin || null;
            const diasIncapacidad = incapacidadPrincipal?.diasIncapacidad || 0;

            // 🆕 Determinar estado usando la nueva lógica con fechas de cierre
            const estadoInfo = this.determinarEstadoCaso(incapacidadPrincipal, empleado.registroPRI);
            const estado = estadoInfo.estado;
            const badgeClass = estadoInfo.badgeClass;
            
            // 🆕 Calcular avance basado en hitos del proceso (seguimientos + cierre)
            const avanceInfo = this.calcularPorcentajeAvance(incapacidadPrincipal, empleado.registroPRI);
            const avancePorcentaje = avanceInfo.porcentaje;
            const avanceColor = avanceInfo.color;
            const avanceDescripcion = avanceInfo.descripcion;

            // Iniciales para avatar
            const initials = nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            // 📦 Modalidad PRI: badge "📋 PRI" si está marcado como caso PRI formal,
            // "⚠️ Seg." para los que sólo son seguimiento de incapacidad, "○ Seg."
            // para los que aún no están clasificados. Lee registroPRI?.casoIngresadoPRIC
            // (mismo campo que controla el banner).
            const priValor = (empleado.registroPRI && empleado.registroPRI.casoIngresadoPRIC
                ? String(empleado.registroPRI.casoIngresadoPRIC).toUpperCase()
                : '');
            let priBadge;
            if (priValor === 'SI') {
                priBadge = '<span class="sp-pri-badge is-pri" title="Caso PRI formal"><i class="fas fa-clipboard-check"></i> PRI</span>';
            } else if (priValor === 'NO') {
                priBadge = '<span class="sp-pri-badge is-no-pri-strong" title="Seguimiento: NO es caso PRI formal">⚠ Seg.</span>';
            } else {
                priBadge = '<span class="sp-pri-badge is-no-pri" title="Aún sin clasificar">○ Seg.</span>';
            }

            // Formatear fechas
            const periodoStr = fechaInicio && fechaFin ?
                `${fechaInicio.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'})} - ${fechaFin.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'})}` :
                'Sin fechas';

            return `
                <tr style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#F8FAFC'" onmouseout="this.style.backgroundColor='white'">
                    <td style="padding: 15px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: #F1F5F9; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #64748B; font-size: 14px;">${initials}</div>
                            <div>
                                <div style="font-weight: 500; color: #1E293B;">${nombre}</div>
                                <div style="font-size: 12px; color: #64748B;">CC: ${cedula}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 15px;">
                        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${tipo === 'ARL' ? '#FEF3C7' : '#DCFCE7'}; color: ${tipo === 'ARL' ? '#92400E' : '#166534'};">${tipo}</span>
                    </td>
                    <td style="padding: 15px;">
                        ${priBadge}
                    </td>
                    <td style="padding: 15px;">
                        <div style="font-size: 13px; color: #1E293B;">${periodoStr}</div>
                        <div style="font-size: 11px; color: #64748B;">${diasIncapacidad} Días</div>
                    </td>
                    <td style="padding: 15px;">
                        <div style="width: 100px;">
                            <div style="font-size: 11px; color: #64748B; margin-bottom: 2px; text-align: right;">${avancePorcentaje}% (${avanceDescripcion})</div>
                            <div style="width: 100%; height: 6px; background: #E2E8F0; border-radius: 3px; overflow: hidden;">
                                <div style="width: ${avancePorcentaje}%; height: 100%; background: ${avanceColor}; border-radius: 3px; transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 15px;">
                        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${badgeClass === 'badge-active' ? '#DCFCE7' : badgeClass === 'badge-pending' ? '#FEF3C7' : '#F3F4F6'}; color: ${badgeClass === 'badge-active' ? '#166534' : badgeClass === 'badge-pending' ? '#92400E' : '#374151'};">${estado}</span>
                    </td>
                    <td style="padding: 15px;">
                        <div style="display: flex; gap: 5px;">
                            <button style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748B; transition: all 0.2s;" title="Ver Detalles" onclick="if(window.medicAusentismoComponent) window.medicAusentismoComponent.openDetailModal(${JSON.stringify(empleado).replace(/"/g, '&quot;')})">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748B; transition: all 0.2s;" title="Agregar Nota" onclick="console.log('Agregar nota:', '${nombre.replace(/'/g, "\\'")}');">
                                <i class="fas fa-sticky-note"></i>
                            </button>
                            <button style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748B; transition: all 0.2s;" title="Adjuntar Archivo" onclick="console.log('Adjuntar:', '${nombre.replace(/'/g, "\\'")}');">
                                <i class="fas fa-paperclip"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    applySeguimientoFilters() {
        const search = document.getElementById('seguimientoSearchInput').value.toLowerCase();
        const estado = document.getElementById('seguimientoEstadoFilter').value;
        const tipo = document.getElementById('seguimientoTipoFilter').value;
        const year = document.getElementById('seguimientoYearFilter').value;
        const month = document.getElementById('seguimientoMonthFilter').value;

        if (!this.seguimientoData) {
            this.showNotification('No hay datos cargados', 'warning');
            return;
        }

        const today = new Date();
        let filtered = this.seguimientoData.filter(empleado => {
            const nombre = (empleado.nombre || '').toLowerCase();
            const cedula = (empleado.cedula || '').toLowerCase();
            const matchesSearch = !search || nombre.includes(search) || cedula.includes(search);

            // Obtener tipo de la incapacidad más reciente
            const incapacidadReciente = empleado.incapacidades && empleado.incapacidades.length > 0
                ? empleado.incapacidades[empleado.incapacidades.length - 1]
                : null;
            const rowTipo = incapacidadReciente?.record?.['CLASE DE INCAPACIDAD'] ||
                           incapacidadReciente?.record?.['clase_de_incapacidad'] || '';
            const matchesTipo = !tipo || rowTipo.toUpperCase() === tipo.toUpperCase();

            // Filtro por año (verificar si ALGUNA incapacidad >= 10 días es del año seleccionado)
            let matchesYear = true;
            if (year) {
                const yearSeleccionado = parseInt(year);
                matchesYear = empleado.incapacidades.some(inc => {
                    if (!inc.fechaInicio || inc.diasIncapacidad < 10) return false;
                    const anioInicio = inc.fechaInicio instanceof Date
                        ? inc.fechaInicio.getFullYear()
                        : new Date(inc.fechaInicio).getFullYear();
                    return anioInicio === yearSeleccionado;
                });
            }

            // Filtro por mes (verificar si ALGUNA incapacidad >= 10 días inicia en el mes seleccionado)
            let matchesMonth = true;
            if (month !== '') {
                const monthSeleccionado = parseInt(month);
                matchesMonth = empleado.incapacidades.some(inc => {
                    if (!inc.fechaInicio || inc.diasIncapacidad < 10) return false;
                    const dateInicio = inc.fechaInicio instanceof Date
                        ? inc.fechaInicio
                        : new Date(inc.fechaInicio);
                    return dateInicio.getMonth() === monthSeleccionado;
                });
            }

            let matchesEstado = true;
            if (estado) {
                const fechaFin = incapacidadReciente?.fechaFin || null;
                if (fechaFin) {
                    const diffTime = fechaFin - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (estado === 'En curso') {
                        matchesEstado = diffDays > 2;
                    } else if (estado === 'Próximo a vencer') {
                        matchesEstado = diffDays >= 0 && diffDays <= 2;
                    } else if (estado === 'Finalizado') {
                        matchesEstado = diffDays < 0;
                    }
                }
            }

            return matchesSearch && matchesTipo && matchesYear && matchesMonth && matchesEstado;
        });

        // Renderizar tabla con datos filtrados
        this.renderSeguimientoTable(filtered);
        
        // Recalcular KPIs con los datos filtrados
        this.calculateKPIsFromFilteredData(filtered);
        
        this.showNotification(`${filtered.length} registros encontrados`, 'success');
    }

    /**
     * Calcula KPIs desde datos filtrados (cuando se aplican filtros)
     * @param {Array} filteredData - Datos filtrados por año/mes/búsqueda
     */
    calculateKPIsFromFilteredData(filteredData) {
        const today = new Date();
        const currentMonth = today.toLocaleString('default', { month: 'long' }).toUpperCase();
        let enSeguimiento = 0;
        let casosPRIC = 0;
        let sinIniciar = 0;
        let cerradosMes = 0;

        console.log('[KPIs Filtered] Calculando con', filteredData.length, 'registros filtrados');

        // Calcular KPIs usando EXACTAMENTE la misma lógica que renderSeguimientoTableWithBody()
        filteredData.forEach(empleado => {
            const incapacidades = empleado.incapacidades || [];

            if (incapacidades.length === 0) {
                sinIniciar++;
                console.log(`[KPIs Filtered] ${empleado.nombre}: SIN INICIAR (sin incapacidades)`);
                return;
            }

            // 🆕 IDENTIFICAR la incapacidad PRINCIPAL (MISMA LÓGICA QUE LA TABLA)
            // Primero, buscar incapacidades >= 10 días (Condición 1)
            const incapacidadesLargas = incapacidades.filter(inc => inc.diasIncapacidad >= 10);

            let incapacidadPrincipal = null;

            if (incapacidadesLargas.length > 0) {
                // Condición 1: Tomar la incapacidad >= 10 días MÁS RECIENTE
                incapacidadPrincipal = incapacidadesLargas[incapacidadesLargas.length - 1];
            } else if (incapacidades.length > 1) {
                // Condición 2: Secuencia de incapacidades - Tomar la última de la secuencia
                incapacidadPrincipal = incapacidades[incapacidades.length - 1];
            } else {
                // Caso fallback: tomar la única incapacidad disponible
                incapacidadPrincipal = incapacidades.length > 0 ? incapacidades[incapacidades.length - 1] : null;
            }

            if (!incapacidadPrincipal) {
                sinIniciar++;
                return;
            }

            // 🆕 CONTAR CASOS PRIC (ARL) - Solo de la incapacidad principal (la que se muestra en la columna "Tipo" de la tabla)
            const tipoPrincipal = incapacidadPrincipal.record?.['CLASE DE INCAPACIDAD'] ||
                                 incapacidadPrincipal.record?.['clase_de_incapacidad'] ||
                                 incapacidadPrincipal.record?.['TIPO'] || '';
            if (tipoPrincipal.toUpperCase() === 'ARL') {
                casosPRIC++;
            }

            // 🆕 Determinar estado usando la misma lógica con fechas de cierre
            const estadoInfo = this.determinarEstadoCaso(incapacidadPrincipal, empleado.registroPRI);
            const estado = estadoInfo.estado;

            console.log(`[KPIs Filtered] ${empleado.nombre}: ${estado} (Tipo: ${tipoPrincipal}, registroPRI: ${empleado.registroPRI ? 'SÍ' : 'NO'})`);

            // Contar por estado (UNA SOLA VEZ por empleado)
            if (estado === 'En Seguimiento') {
                enSeguimiento++;
            } else if (estado === 'Cerrado') {
                cerradosMes++; // Ahora cuenta TODOS los casos cerrados filtrados
            } else if (estado === 'Sin Iniciar') {
                sinIniciar++;
            }
        });

        console.log('[KPIs Filtered] Resultados:', { enSeguimiento, casosPRIC, sinIniciar, cerradosMes, total: filteredData.length });
        console.log('[KPIs Filtered] Verificación:', enSeguimiento + casosPRIC + sinIniciar, '==', filteredData.length);

        // Actualizar UI de KPIs - MISMAS TARJETAS QUE calculateKPIs()
        const kpiElements = document.querySelectorAll('.kpi-value');
        if (kpiElements[0]) kpiElements[0].textContent = enSeguimiento;
        if (kpiElements[1]) kpiElements[1].textContent = casosPRIC;
        if (kpiElements[2]) kpiElements[2].textContent = sinIniciar;
        if (kpiElements[3]) kpiElements[3].textContent = cerradosMes;
    }

    createSeguimientoModals(container) {
        // Modal de Exportar
        const exportModal = document.createElement('div');
        exportModal.id = 'exportModal';
        exportModal.className = 'modal-backdrop';
        exportModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.6); z-index: 1000;
            display: none; justify-content: center; align-items: center;
            backdrop-filter: blur(2px);
        `;
        exportModal.innerHTML = `
            <div style="background: white; width: 90%; max-width: 500px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <div style="padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 16px; font-weight: 600;"><i class="fas fa-file-pdf" style="margin-right: 8px; color: #dc3545;"></i>Exportar Informes</div>
                    <button onclick="document.getElementById('exportModal').style.display='none'" style="background: none; border: none; font-size: 20px; color: #64748B; cursor: pointer;">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 15px; font-size: 14px; color: #64748B;">Seleccione el tipo de informe y formato:</p>
                    <div style="margin-bottom: 15px;">
                        <label style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 5px;">Tipo de Reporte</label>
                        <select id="exportReportType" style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                            <option>General de Incapacidades</option>
                            <option>Seguimiento Detallado</option>
                            <option>Casos Abiertos vs Cerrados</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 5px;">Formato</label>
                        <div style="display: flex; gap: 10px; margin-top: 5px;">
                            <div id="exportExcelOption" onclick="this.classList.toggle('selected')" style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;">
                                <i class="fas fa-file-excel" style="color: #10B981;"></i> Excel
                            </div>
                            <div id="exportPdfOption" onclick="this.classList.toggle('selected')" style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;">
                                <i class="fas fa-file-pdf" style="color: #dc3545;"></i> PDF
                            </div>
                        </div>
                    </div>
                </div>
                <div style="padding: 15px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="document.getElementById('exportModal').style.display='none'" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #e2e8f0; background: white; color: #1E293B;">Cancelar</button>
                    <button onclick="console.log('Exportando...'); document.getElementById('exportModal').style.display='none';" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background: #174ea6; color: white;"><i class="fas fa-download"></i> Generar</button>
                </div>
            </div>
        `;
        container.appendChild(exportModal);

        // Modal de Detalle Modernizado
        const detailModal = document.createElement('div');
        detailModal.id = 'detailModal';
        detailModal.className = 'modal-backdrop';
        detailModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.6); z-index: 1000;
            display: none; justify-content: center; align-items: center;
            backdrop-filter: blur(4px);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        `;
        detailModal.innerHTML = `
            <div style="background: white; width: 90%; max-width: 700px; max-height: 90vh; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden; display: flex; flex-direction: column; transform: translateY(20px); transition: transform 0.3s ease;" class="modal-container">
                <!-- Header Moderno -->
                <div style="background: #FFFFFF; padding: 0; border-bottom: 1px solid #E2E8F0; flex-shrink: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #EEF2FF, #E0E7FF); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #4F46E5; font-size: 18px;">
                                <i class="fas fa-eye"></i>
                            </div>
                            <div>
                                <h2 style="font-size: 18px; font-weight: 700; color: #1E293B; margin: 0;">Detalle de Seguimiento</h2>
                                <span style="font-size: 13px; color: #64748B; font-weight: 400;">Historial del paciente</span>
                            </div>
                        </div>
                        <button onclick="document.getElementById('detailModal').style.display='none'; document.getElementById('detailModal').style.opacity='0'; document.getElementById('detailModal').style.visibility='hidden'" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid #E2E8F0; background: white; cursor: pointer; color: #94A3B8; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" class="close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Body -->
                <div id="detailModalContent" style="margin-bottom: 0; overflow-y: auto; padding: 24px; max-height: calc(90vh - 140px); background: #F8FAFC; flex: 1;">
                    <!-- Contenido dinámico -->
                </div>
                
                <!-- Footer -->
                <div style="padding: 16px 24px; background: white; border-top: 1px solid #E2E8F0; display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
                    <button onclick="document.getElementById('detailModal').style.display='none'; document.getElementById('detailModal').style.opacity='0'; document.getElementById('detailModal').style.visibility='hidden'" style="padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #E2E8F0; background: white; color: #475569; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px;" class="btn btn-secondary">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                    <button onclick="window.medicAusentismoComponent.openSeguimientoPanelFromModal()" style="padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background: linear-gradient(135deg, #4F46E5, #4338CA); color: white; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2); display: inline-flex; align-items: center; gap: 8px;" class="btn btn-primary">
                        <i class="fas fa-folder-open"></i> Abrir Seguimiento
                    </button>
                </div>
            </div>
        `;
        container.appendChild(detailModal);
    }

    openExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    /**
     * 🆕 Abre el constructor de informes PRI multicaso
     */
    openReportBuilder() {
        console.log('[REPORT BUILDER] Abriendo constructor de informes PRI...');
        
        // Abrir el archivo HTML en una ventana modal o nueva ventana
        const reportUrl = 'modules/gestion-salud/ausentismo/informe-pri-builder.html';
        
        // Opción 1: Abrir en ventana emergente
        const reportWindow = window.open(
            reportUrl, 
            'Informe PRI - K+AIR', 
            'width=1400,height=900,resizable=yes,scrollbars=yes,status=no'
        );
        
        if (reportWindow) {
            // Pasar datos de seguimiento si es necesario
            reportWindow.addEventListener('load', () => {
                console.log('[REPORT BUILDER] Ventana cargada');
                // Aquí se podrían pasar los datos via postMessage si se necesita
            });
        } else {
            console.error('[REPORT BUILDER] No se pudo abrir la ventana');
            this.showNotification('⚠️ Bloquee de pop-ups detectado. Permita las ventanas emergentes para este sitio.', 'warning');
        }
    }

    openDetailModal(empleado) {
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('detailModalContent');
        const modalContainer = modal.querySelector('.modal-container');

        if (!modal || !content || !empleado) return;

        // Guardar empleado actual para usar en "Abrir Seguimiento"
        this.currentDetalleEmpleado = empleado;

        const nombre = empleado.nombre || 'Sin nombre';
        const cedula = empleado.cedula || '';
        let incapacidades = empleado.incapacidades || [];

        // === APLICAR FILTRO DE AÑO (igual que en la tabla) ===
        const yearFilter = document.getElementById('seguimientoYearFilter')?.value;
        if (yearFilter && yearFilter !== 'all') {
            const yearSeleccionado = parseInt(yearFilter);
            incapacidades = incapacidades.filter(inc => {
                if (!inc.fechaInicio) return false;
                const fechaIni = inc.fechaInicio instanceof Date ? inc.fechaInicio : new Date(inc.fechaInicio);
                return !isNaN(fechaIni.getTime()) && fechaIni.getFullYear() === yearSeleccionado;
            });
            console.log(`[MODAL DETALLES] Filtrado por año ${yearSeleccionado}: ${incapacidades.length} incapacidades`);
        }

        if (incapacidades.length === 0) {
            content.innerHTML = '<div style="text-align: center; color: #64748B; padding: 40px;"><i class="fas fa-inbox" style="font-size: 48px; color: #CBD5E1; margin-bottom: 16px;"></i><p>No hay incapacidades del año seleccionado</p></div>';
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';
                modalContainer.style.transform = 'translateY(0)';
            }, 10);
            return;
        }

        // Ordenar incapacidades por fecha de inicio
        const incapacidadesOrdenadas = [...incapacidades].sort((a, b) => {
            if (!a.fechaInicio) return 1;
            if (!b.fechaInicio) return -1;
            return a.fechaInicio - b.fechaInicio;
        });

        // Identificar incapacidades >= 10 días (las que activan el seguimiento por Condición 1)
        const incapacidadesLargas = incapacidadesOrdenadas.filter(inc => inc.diasIncapacidad >= 10);

        // Determinar tipo de caso
        const esCondicion1 = incapacidadesLargas.length > 0;
        const esCondicion2 = !esCondicion1 && incapacidadesOrdenadas.length > 1;

        // Calcular total de días (SOLO de las incapacidades que se van a mostrar)
        let totalDias;
        if (esCondicion1) {
            // Para Condición 1, sumar solo las incapacidades >= 10 días
            totalDias = incapacidadesLargas.reduce((sum, inc) => sum + inc.diasIncapacidad, 0);
        } else {
            // Para Condición 2, sumar todas las incapacidades
            totalDias = incapacidadesOrdenadas.reduce((sum, inc) => sum + inc.diasIncapacidad, 0);
        }

        // Construir HTML según el tipo de caso
        if (esCondicion1) {
            // CASO 1: Mostrar incapacidades >= 10 días
            content.innerHTML = this.renderCondicion1Detalle(nombre, cedula, incapacidadesLargas, totalDias);
        } else if (esCondicion2) {
            // CASO 2: Mostrar secuencia de incapacidades que suman >= 10 días
            content.innerHTML = this.renderCondicion2Detalle(nombre, cedula, incapacidadesOrdenadas, totalDias);
        } else {
            // CASO ESPECIAL: Solo una incapacidad < 10 días (no debería llegar aquí)
            content.innerHTML = this.renderCondicion1Detalle(nombre, cedula, incapacidadesOrdenadas, totalDias);
        }

        // Mostrar modal con animación
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
            modalContainer.style.transform = 'translateY(0)';
        }, 10);
    }

    openSeguimientoPanelFromModal() {
        console.log('[OPEN SEGUIMIENTO] === INICIO ===');
        
        // Verificar si hay empleado seleccionado
        if (!this.currentDetalleEmpleado) {
            console.error('[SEGUIMIENTO] No hay empleado seleccionado');
            this.showNotification('❌ Error: No hay empleado seleccionado', 'error');
            return;
        }

        // Obtener cédula y nombre del empleado
        const cedula = this.currentDetalleEmpleado.cedula || '';
        const nombre = this.currentDetalleEmpleado.nombre || '';

        console.log('[SEGUIMIENTO] Cédula:', cedula);
        console.log('[SEGUIMIENTO] Nombre:', nombre);
        console.log('[SEGUIMIENTO] Incapacidad seleccionada:', this.incapacidadSeleccionada);

        // === 1. CERRAR MODAL DE DETALLES ===
        const modalDetalles = document.getElementById('detailModal');
        const modalContainer = modalDetalles.querySelector('.modal-container');
        
        if (modalDetalles) {
            modalDetalles.style.opacity = '0';
            modalDetalles.style.visibility = 'hidden';
            if (modalContainer) {
                modalContainer.style.transform = 'translateY(20px)';
            }
            setTimeout(() => {
                modalDetalles.style.display = 'none';
            }, 300);
        }

        // === 2. BUSCAR REGISTROS Y MOSTRAR MODAL ANTIGUO ===
        console.log('[SEGUIMIENTO] Buscando registros existentes...');
        window.electronAPI.buscarRegistrosCedula(cedula, this.currentCompany)
            .then(resultado => {
                console.log('[SEGUIMIENTO] Resultado búsqueda:', resultado);
                console.log('[SEGUIMIENTO] success:', resultado.success);
                console.log('[SEGUIMIENTO] registros:', resultado.registros);
                console.log('[SEGUIMIENTO] total:', resultado.total);
                console.log('[SEGUIMIENTO] registros.length:', resultado.registros ? resultado.registros.length : 'N/A');

                if (resultado.success && resultado.registros && resultado.registros.length > 0) {
                    // Hay registros - mostrar modal antiguo adaptado
                    console.log('[SEGUIMIENTO] Mostrando modal de registros existentes');
                    this.mostrarModalSeleccionRegistros(resultado.registros, {
                        trabajador: { nombre: nombre, cedula: cedula }
                    });
                } else {
                    // No hay registros - abrir panel directamente para crear nuevo
                    console.log('[SEGUIMIENTO] No hay registros, abriendo panel para caso nuevo');
                    this.abrirPanelSeguimientoConEmpleado(this.currentDetalleEmpleado);
                }
            })
            .catch(error => {
                console.error('[SEGUIMIENTO] Error buscando registros:', error);
                // En caso de error, abrir panel directamente
                this.abrirPanelSeguimientoConEmpleado(this.currentDetalleEmpleado);
            });
    }

    renderCondicion1Detalle(nombre, cedula, incapacidadesLargas, totalDias) {
        const today = new Date();
        const initials = nombre.split(' ').map(n => n[0]).filter(c => c).join('').substring(0, 2).toUpperCase();

        // Ordenar incapacidades de MÁS RECIENTE a MÁS ANTIGUA
        const incapacidadesOrdenadas = [...incapacidadesLargas].sort((a, b) => {
            let dateA = a.fechaInicio instanceof Date ? a.fechaInicio : new Date(a.fechaInicio);
            let dateB = b.fechaInicio instanceof Date ? b.fechaInicio : new Date(b.fechaInicio);
            if (!isNaN(dateB) && !isNaN(dateA)) return dateB - dateA;
            return 0;
        });

        return `
            <!-- Employee Card -->
            <div style="background: white; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0;">
                    ${initials}
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1E293B;">${nombre}</h3>
                    <p style="margin: 0; font-size: 13px; color: #64748B;">CC: ${cedula}</p>
                </div>
                <span style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: #FEF3C7; color: #D97706;">
                    <i class="fas fa-exclamation-triangle"></i> Seguimiento Activo
                </span>
            </div>

            <!-- Timeline Section Title -->
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748B; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-history"></i> Incapacidades que activan seguimiento (${incapacidadesOrdenadas.length})
                </div>
                <div style="font-size: 11px; font-weight: 400; text-transform: none; color: #94A3B8;">
                    <i class="fas fa-info-circle"></i> Selecciona para seguimiento
                </div>
            </div>

            <!-- Timeline Items -->
            ${incapacidadesOrdenadas.map((inc, index) => {
                const isPrincipal = index === 0;
                const incId = `inc-${index}-${Date.now()}`;

                // Formatear fechas
                let fechaInicio = 'N/A';
                let fechaFin = 'N/A';
                if (inc.fechaInicio) {
                    try {
                        const fechaIni = inc.fechaInicio instanceof Date ? inc.fechaInicio : new Date(inc.fechaInicio);
                        if (!isNaN(fechaIni.getTime())) {
                            fechaInicio = fechaIni.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                        }
                    } catch (e) { console.warn('Error fechaInicio:', e); }
                }
                if (inc.fechaFin) {
                    try {
                        const fechaFi = inc.fechaFin instanceof Date ? inc.fechaFin : new Date(inc.fechaFin);
                        if (!isNaN(fechaFi.getTime())) {
                            fechaFin = fechaFi.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                        }
                    } catch (e) { console.warn('Error fechaFin:', e); }
                }

                const codigo = inc.record?.['CODIGO'] || 'N/A';
                const diagnostico = inc.record?.['DESCRIPCION'] || 'Sin descripción';
                const tipo = inc.record?.['CLASE DE INCAPACIDAD'] || 'EPS';

                // Calcular estado
                let estado = 'Finalizado';
                let estadoColor = '#64748B';
                let estadoBg = '#F1F5F9';
                if (inc.fechaFin) {
                    try {
                        const fechaFi = inc.fechaFin instanceof Date ? inc.fechaFin : new Date(inc.fechaFin);
                        if (!isNaN(fechaFi.getTime())) {
                            const diffDays = Math.ceil((fechaFi - today) / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) { estado = 'Finalizado'; estadoColor = '#64748B'; estadoBg = '#F1F5F9'; }
                            else if (diffDays <= 2) { estado = 'Próximo a vencer'; estadoColor = '#D97706'; estadoBg = '#FEF3C7'; }
                            else { estado = 'En curso'; estadoColor = '#059669'; estadoBg = '#D1FAE5'; }
                        }
                    } catch (e) { console.warn('Error estado:', e); }
                }

                const dotColor = isPrincipal ? '#F59E0B' : '#CBD5E1';
                const dotBg = isPrincipal ? '#FEF3C7' : 'white';

                return `
                    <!-- Timeline Item -->
                    <div style="position: relative; padding-left: 28px; margin-bottom: 20px;">
                        <div style="position: absolute; left: 5px; top: 24px; bottom: -10px; width: 2px; background: #E2E8F0;"></div>
                        ${index === incapacidadesOrdenadas.length - 1 ? '<div style="position: absolute; left: 0; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: white; border: 2px solid ' + dotColor + ';"></div>' : ''}
                        <div style="position: absolute; left: 0; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: ${dotBg}; border: 2px solid ${dotColor};"></div>

                        <div style="background: white; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; transition: all 0.2s;" 
                            onmouseover="this.style.borderColor='#4F46E5'; this.style.boxShadow='0 2px 8px rgba(79, 70, 229, 0.1)'"
                            onmouseout="this.style.borderColor='#E2E8F0'; this.style.boxShadow='none'">
                            <!-- Timeline Header -->
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #F1F5F9;">
                                <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                                    <input type="checkbox" 
                                        id="${incId}" 
                                        class="incapacidad-checkbox"
                                        data-inc-index="${index}"
                                        data-inc-fecha-inicio="${inc.fechaInicio}"
                                        data-inc-fecha-fin="${inc.fechaFin}"
                                        data-inc-dias="${inc.diasIncapacidad}"
                                        data-inc-diagnostico="${diagnostico.replace(/"/g, '&quot;')}"
                                        data-inc-codigo="${codigo}"
                                        style="width: 18px; height: 18px; accent-color: #4F46E5; cursor: pointer;"
                                        onchange="window.medicAusentismoComponent.onIncapacidadSeleccionada(this)">
                                    <div style="font-size: 13px; font-weight: 600; color: #1E293B; display: flex; align-items: center; gap: 6px;">
                                        <i class="fas fa-calendar-alt" style="color: #94A3B8; font-size: 12px;"></i>
                                        ${fechaInicio} - ${fechaFin}
                                    </div>
                                </div>
                                ${isPrincipal ? '<span style="padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; text-transform: uppercase; background: #DBEAFE; color: #2563EB;">Principal</span>' : '<span style="padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; text-transform: uppercase; background: ' + estadoBg + '; color: ' + estadoColor + ';">' + estado + '</span>'}
                            </div>

                            <!-- Timeline Body -->
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-left: 30px;">
                                <div>
                                    <label style="display: block; font-size: 10px; color: #94A3B8; margin-bottom: 2px; text-transform: uppercase;">Días Totales</label>
                                    <strong style="font-size: 14px; color: #334155; font-weight: 600;">${inc.diasIncapacidad} días</strong>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 10px; color: #94A3B8; margin-bottom: 2px; text-transform: uppercase;">Tipo</label>
                                    <strong style="font-size: 14px; color: #334155; font-weight: 600;">
                                        <span style="padding: 2px 8px; border-radius: 12px; background: ${tipo === 'ARL' ? '#FEF3C7' : tipo === 'EMPRESA' ? '#DCFCE7' : '#DBEAFE'}; color: ${tipo === 'ARL' ? '#92400E' : tipo === 'EMPRESA' ? '#166534' : '#1E40AF'}; font-size: 11px;">
                                            ${tipo}
                                        </span>
                                    </strong>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 10px; color: #94A3B8; margin-bottom: 2px; text-transform: uppercase;">Estado</label>
                                    <strong style="font-size: 14px; color: ${estadoColor}; font-weight: 600;">${estado}</strong>
                                </div>
                                <!-- Diagnóstico para TODAS las incapacidades -->
                                <div style="grid-column: span 3; margin-top: 8px; padding-top: 12px; border-top: 1px solid #F1F5F9;">
                                    <label style="display: block; font-size: 10px; color: #94A3B8; margin-bottom: 4px; text-transform: uppercase;">Diagnóstico</label>
                                    <strong style="font-size: 14px; color: #1E293B; font-weight: 600;">${codigo}</strong>
                                    <div style="font-size: 13px; color: #64748B; margin-top: 4px; line-height: 1.5;">${diagnostico}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}

            <!-- Total Días -->
            <div style="background: white; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; color: #64748B;">Total días en incapacidades >= 10:</span>
                    <strong style="font-size: 18px; color: #4F46E5; font-weight: 700;">${totalDias} días</strong>
                </div>
            </div>
        `;
    }

    renderCondicion2Detalle(nombre, cedula, incapacidades, totalDias) {
        const today = new Date();

        return `
            <!-- Encabezado del empleado -->
            <div style="display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
                <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #10B981, #059669); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 22px; flex-shrink: 0;">
                    ${nombre.split(' ').map(n => n[0]).filter(c => c).join('').substring(0, 2).toUpperCase()}
                </div>
                <div style="margin-left: 15px; flex: 1;">
                    <h3 style="font-size: 18px; margin: 0; color: #1E293B; font-weight: 600;">${nombre}</h3>
                    <div style="font-size: 14px; color: #64748B; margin-top: 4px;">CC: ${cedula}</div>
                </div>
                <div style="background: #DCFCE7; color: #166534; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                    🔗 Suma >= 10 días
                </div>
            </div>

            <!-- Secuencia de incapacidades -->
            <div style="margin-bottom: 20px;">
                <h4 style="font-size: 14px; font-weight: 600; color: #1E293B; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-link" style="color: #10B981;"></i>
                        SECUENCIA DE INCAPACIDADES (Gaps <= 3 días)
                    </div>
                    <div style="font-size: 11px; font-weight: 400; color: #94A3B8; text-transform: none;">
                        <i class="fas fa-info-circle"></i> Selecciona para seguimiento
                    </div>
                </h4>
                ${incapacidades.map((inc, index) => {
                    const incId = `inc2-${index}-${Date.now()}`;
                    const fechaInicio = inc.fechaInicio ? inc.fechaInicio.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
                    const fechaFin = inc.fechaFin ? inc.fechaFin.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
                    const codigo = inc.record?.['CODIGO'] || inc.record?.['CÓDIGO'] || inc.record?.['codigo'] || 'N/A';
                    const diagnostico = inc.record?.['DESCRIPCION'] || inc.record?.['DESCRIPCIÓN'] || inc.record?.['descripcion'] || 'Sin descripción';
                    const tipo = inc.record?.['CLASE DE INCAPACIDAD'] || inc.record?.['clase_de_incapacidad'] || 'EPS';

                    // Calcular gap con la incapacidad anterior
                    let gapHTML = '';
                    if (index > 0) {
                        const incAnterior = incapacidades[index - 1];
                        if (incAnterior.fechaFin && inc.fechaInicio) {
                            const gapDias = Math.ceil((inc.fechaInicio - incAnterior.fechaFin) / (1000 * 60 * 60 * 24));
                            const gapColor = gapDias <= 3 ? '#10B981' : '#F59E0B';
                            gapHTML = `
                                <div style="font-size: 11px; color: ${gapColor}; margin-top: 6px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <i class="fas fa-hourglass-half"></i>
                                    Gap: ${gapDias} día${gapDias !== 1 ? 's' : ''} desde la anterior
                                </div>
                            `;
                        }
                    }

                    return `
                        <div style="background: #F8FAFC; border-left: 4px solid ${index === 0 ? '#10B981' : '#94A3B8'}; border-radius: 8px; padding: 15px; margin-bottom: 12px; position: relative; transition: all 0.2s;"
                            onmouseover="this.style.boxShadow='0 2px 8px rgba(16, 185, 129, 0.1)'"
                            onmouseout="this.style.boxShadow='none'">
                            <div style="position: absolute; top: 15px; right: 15px; display: flex; align-items: center; gap: 10px;">
                                <input type="checkbox" 
                                    id="${incId}" 
                                    class="incapacidad-checkbox"
                                    data-inc-index="${index}"
                                    data-inc-fecha-inicio="${inc.fechaInicio}"
                                    data-inc-fecha-fin="${inc.fechaFin}"
                                    data-inc-dias="${inc.diasIncapacidad}"
                                    data-inc-diagnostico="${diagnostico.replace(/"/g, '&quot;')}"
                                    data-inc-codigo="${codigo}"
                                    style="width: 18px; height: 18px; accent-color: #10B981; cursor: pointer;"
                                    onchange="window.medicAusentismoComponent.onIncapacidadSeleccionada(this)">
                                <div style="background: ${index === 0 ? '#10B981' : '#94A3B8'}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                                    ${index + 1}
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Fecha Inicio</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 14px;">📅 ${fechaInicio}</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Fecha Fin</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 14px;">📅 ${fechaFin}</div>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Días</div>
                                    <div style="font-weight: 700; color: #174ea6; font-size: 16px;">📊 ${inc.diasIncapacidad} días</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Tipo</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 14px;">
                                        <span style="padding: 2px 8px; border-radius: 12px; background: ${tipo === 'ARL' ? '#FEF3C7' : tipo === 'EMPRESA' ? '#DCFCE7' : '#DBEAFE'}; color: ${tipo === 'ARL' ? '#92400E' : tipo === 'EMPRESA' ? '#166534' : '#1E40AF'}; font-size: 12px;">
                                            ${tipo}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Código</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 13px;">🏷️ ${codigo}</div>
                                </div>
                            </div>
                            <div style="background: white; border-radius: 6px; padding: 10px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                                <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">📝 Diagnóstico</div>
                                <div style="color: #475569; font-size: 13px; line-height: 1.4;">${diagnostico}</div>
                            </div>
                            ${gapHTML}
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Resumen -->
            <div style="background: linear-gradient(135deg, #10B981, #059669); border-radius: 8px; padding: 15px; margin-bottom: 20px; color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">TOTAL ACUMULADO</div>
                        <div style="font-size: 24px; font-weight: 700;">${totalDias} días</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">INCAPACIDADES</div>
                        <div style="font-size: 24px; font-weight: 700;">${incapacidades.length}</div>
                    </div>
                </div>
            </div>
        `;
    }

    guardarNota(cedula) {
        const textarea = document.getElementById(`notaSeguimiento_${cedula.replace(/[^a-zA-Z0-9]/g, '_')}`);
        if (!textarea) return;

        const nota = textarea.value.trim();
        if (!nota) {
            this.showNotification('Por favor escribe una nota', 'warning');
            return;
        }

        // En una implementación real, aquí se guardaría en backend/archivo
        // Por ahora, simulamos el guardado
        console.log(`[NOTA GUARDADA] Cédula: ${cedula}, Nota: ${nota}`);

        // Simular guardado exitoso
        this.showNotification('Nota guardada exitosamente', 'success');

        // Cerrar modal después de guardar
        setTimeout(() => {
            document.getElementById('detailModal').style.display = 'none';
        }, 1000);
    }

    /**
     * Crea el panel slideover de Seguimiento PRIC
     */
    createSeguimientoPanel() {
        // Agregar estilos CSS del panel
        const styleId = 'seguimiento-panel-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                :root {
                    --sp-primary: #4F46E5;
                    --sp-primary-light: #EEF2FF;
                    --sp-secondary: #F1F5F9;
                    --sp-accent: #10B981;
                    --sp-danger: #EF4444;
                    --sp-text-main: #1E293B;
                    --sp-text-muted: #64748B;
                    --sp-border: #E2E8F0;
                    --sp-bg-panel: #FFFFFF;
                }

                /* Panel Slideover */
                .seguimiento-backdrop {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 2000;
                    opacity: 0; visibility: hidden; transition: all 0.3s ease;
                }
                .seguimiento-backdrop.active { opacity: 1; visibility: visible; }

                .seguimiento-panel {
                    position: fixed; top: 0; right: 0; width: 95%; max-width: 1100px; height: 100%;
                    background: var(--sp-bg-panel); box-shadow: -5px 0 30px rgba(0,0,0,0.1);
                    transform: translateX(100%); transition: transform 0.3s ease; z-index: 2001;
                    display: flex; flex-direction: column;
                }
                .seguimiento-backdrop.active .seguimiento-panel { transform: translateX(0); }

                /* Header */
                .sp-panel-header {
                    padding: 15px 30px; border-bottom: 1px solid var(--sp-border);
                    display: flex; justify-content: space-between; align-items: center; background: #FAFAFA; flex-shrink: 0;
                }
                .sp-header-info h2 { font-size: 18px; font-weight: 600; color: var(--sp-text-main); }
                .sp-header-info p { font-size: 12px; color: var(--sp-text-muted); margin-top: 2px; }
                .sp-close-btn {
                    width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--sp-border);
                    background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
                }
                .sp-close-btn:hover { background: var(--sp-danger); color: white; border-color: var(--sp-danger); }

                /* Navegación Horizontal */
                .sp-horizontal-nav {
                    display: flex; background: white; border-bottom: 1px solid var(--sp-border); padding: 0 20px;
                    overflow-x: auto; flex-shrink: 0;
                }
                .sp-nav-item {
                    padding: 15px 20px; color: var(--sp-text-muted); font-size: 13px; font-weight: 500;
                    border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap;
                    display: flex; align-items: center; gap: 8px; transition: all 0.2s;
                }
                .sp-nav-item:hover { color: var(--sp-text-main); background: var(--sp-secondary); }
                .sp-nav-item.active {
                    color: var(--sp-primary); border-bottom-color: var(--sp-primary); font-weight: 600;
                }
                .sp-nav-item i { font-size: 14px; }

                /* 📦 Bloqueo de pasos: las navs futuras a la sección activa están bloqueadas
                con candado y sin pointer-events. Solo "Siguiente" las desbloquea. */
                .sp-nav-item.is-locked-step {
                    opacity: 0.4;
                    cursor: not-allowed;
                    pointer-events: none;
                    background: repeating-linear-gradient(
                        -45deg,
                        transparent,
                        transparent 4px,
                        rgba(100, 116, 139, 0.04) 4px,
                        rgba(100, 116, 139, 0.04) 8px
                    );
                }
                .sp-nav-item .sp-nav-lock-icon {
                    font-size: 11px;
                    margin-left: 4px;
                    color: var(--sp-text-muted);
                }

                /* Área de Contenido */
                .sp-content-area {
                    flex: 1; padding: 25px 30px; overflow-y: auto; background: #FDFEFE;
                }
                .sp-form-section { display: none; animation: spFadeIn 0.3s ease; }
                .sp-form-section.active { display: block; }
                @keyframes spFadeIn { from { opacity: 0; } to { opacity: 1; } }

                .sp-section-title {
                    font-size: 16px; font-weight: 600; color: var(--sp-text-main); margin-bottom: 20px;
                    border-bottom: 1px solid var(--sp-border); padding-bottom: 10px;
                    display: flex; align-items: center; gap: 10px;
                }
                .sp-section-title i { color: var(--sp-primary); }

                /* Grid Forms */
                .sp-form-grid {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 18px 25px; margin-bottom: 25px;
                }
                .sp-form-group { display: flex; flex-direction: column; gap: 6px; }
                .sp-form-group.full-width { grid-column: 1 / -1; }

                .sp-form-label {
                    font-size: 11.5px; font-weight: 600; color: var(--sp-text-muted); text-transform: uppercase; letter-spacing: 0.3px;
                }

                .sp-form-control {
                    width: 100%; padding: 10px 12px; border: 1px solid var(--sp-border);
                    border-radius: 6px; font-size: 13px; background: white; font-family: inherit;
                    transition: all 0.2s;
                }
                .sp-form-control:focus {
                    outline: none; border-color: var(--sp-primary);
                    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
                }
                .sp-form-control:disabled {
                    background: #F3F4F6; cursor: not-allowed; color: #9CA3AF;
                }
                .sp-form-control[readonly] {
                    background: #F9FAFB; color: var(--sp-text-main);
                }

                /* 📦 Wizard de validación — recuadro rojo universal para TODO input/select/
                textarea vacío, sea obligatorio u opcional. La distinción "obligatorio" se
                sigue marcando con el asterisco rojo en el label, no con el recuadro. */
                .sp-form-control.is-empty {
                    border-color: #EF4444 !important;
                    background: #FEF2F2;
                    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23EF4444' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='12'/><line x1='12' y1='16' x2='12.01' y2='16'/></svg>");
                    background-repeat: no-repeat;
                    background-position: right 10px center;
                    background-size: 14px;
                    padding-right: 32px;
                }
                .sp-form-control.is-empty:focus {
                    outline: none;
                    border-color: #EF4444 !important;
                    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
                }

                /* 📦 SELECTS: el ícono no debe chocar con la flecha nativa del dropdown.
                Movemos el ícono a la izquierda de la flecha y reservamos espacio. */
                select.sp-form-control.is-empty {
                    padding-right: 44px;
                    background-position: right 28px center;
                }

                /* Asterisco rojo en label cuando el campo es requerido */
                .sp-form-label[data-required-mark="true"]::after {
                    content: ' *';
                    color: #EF4444;
                    font-weight: 700;
                }

                /* Contador de completitud en el header de cada sección */
                .sp-section-completitud {
                    margin-left: auto; font-size: 12px; font-weight: 500;
                    padding: 4px 10px; border-radius: 12px;
                    background: var(--sp-secondary); color: var(--sp-text-muted);
                    transition: all 0.25s ease;
                }
                .sp-section-completitud.is-complete {
                    background: #D1FAE5; color: #065F46;
                }
                .sp-section-completitud.is-incomplete {
                    background: #FEE2E2; color: #991B1B;
                }

                /* Mensaje inline de error pegado al primer campo vacío de la sección */
                .sp-required-hint {
                    display: block; font-size: 11.5px; color: #DC2626;
                    margin-top: 4px; font-weight: 500;
                }

                /* Footer reorganizado con navegación de wizard */
                .sp-panel-footer {
                    padding: 15px 30px; border-top: 1px solid var(--sp-border); background: white;
                    display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
                    gap: 12px;
                }
                .sp-panel-footer-left { display: flex; gap: 8px; align-items: center; }
                .sp-panel-footer-right { display: flex; gap: 8px; align-items: center; }
                .sp-panel-footer-progress {
                    font-size: 12px; color: var(--sp-text-muted);
                    padding: 6px 12px; border-radius: 16px;
                    background: var(--sp-secondary);
                }
                .sp-panel-footer-progress strong { color: var(--sp-text-main); font-weight: 600; }

                /* Subsection */
                .sp-subsection {
                    background: white; border: 1px solid var(--sp-border); border-radius: 8px;
                    padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                }
                .sp-subsection-title {
                    font-size: 14px; font-weight: 600; color: var(--sp-text-main); margin-bottom: 15px;
                    display: flex; align-items: center; gap: 8px;
                }
                .sp-subsection-title i { color: var(--sp-accent); font-size: 12px; }

                /* 📦 Banner PRI — estado formal del caso (PRIC vs seguimiento simple) */
                .sp-pri-banner {
                    padding: 12px 30px; flex-shrink: 0;
                    display: flex; align-items: center; gap: 12px;
                    border-bottom: 1px solid var(--sp-border);
                    font-size: 13px;
                    background: var(--sp-secondary);
                    transition: background-color 0.25s ease, border-color 0.25s ease;
                }
                .sp-pri-banner .sp-pri-banner-icon {
                    width: 36px; height: 36px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 16px; flex-shrink: 0;
                }
                .sp-pri-banner .sp-pri-banner-text { flex: 1; line-height: 1.35; }
                .sp-pri-banner .sp-pri-banner-text strong { font-weight: 600; }
                .sp-pri-banner .sp-pri-banner-text small { display: block; font-size: 11.5px; opacity: 0.85; margin-top: 2px; }

                /* Estado 1: Caso PRI formal */
                .sp-pri-banner.is-pri {
                    background: linear-gradient(90deg, #ECFDF5 0%, #D1FAE5 100%);
                    border-bottom-color: #10B981;
                }
                .sp-pri-banner.is-pri .sp-pri-banner-icon { background: var(--sp-accent); color: white; }

                /* Estado 2: Caso con seguimiento pero NO PRI formal */
                .sp-pri-banner.is-no-pri {
                    background: linear-gradient(90deg, #FFFBEB 0%, #FEF3C7 100%);
                    border-bottom-color: #F59E0B;
                }
                .sp-pri-banner.is-no-pri .sp-pri-banner-icon { background: #F59E0B; color: white; }

                /* Estado 3: Aún sin clasificar (caso recién creado sin valor) */
                .sp-pri-banner.is-unclassified {
                    background: linear-gradient(90deg, #F8FAFC 0%, #F1F5F9 100%);
                    border-bottom-color: var(--sp-border);
                }
                .sp-pri-banner.is-unclassified .sp-pri-banner-icon { background: #94A3B8; color: white; }

                /* Botones contextuales del banner — el control de decisión vive aquí para
                que NUNCA dependa de navegar a una sección atenuada. */
                .sp-pri-banner .sp-pri-banner-actions {
                    display: flex; gap: 8px; flex-shrink: 0; align-items: center;
                }
                .sp-pri-banner .sp-pri-banner-btn {
                    padding: 7px 14px; border-radius: 6px; cursor: pointer;
                    font-size: 12px; font-weight: 600; white-space: nowrap;
                    display: inline-flex; align-items: center; gap: 6px;
                    transition: all 0.2s; border: 1px solid transparent;
                }
                .sp-pri-banner .sp-pri-banner-btn.is-pri {
                    background: var(--sp-accent); color: white;
                }
                .sp-pri-banner .sp-pri-banner-btn.is-pri:hover {
                    background: #059669; transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(16, 185, 129, 0.25);
                }
                .sp-pri-banner .sp-pri-banner-btn.is-no-pri {
                    background: white; color: #92400E; border-color: #F59E0B;
                }
                .sp-pri-banner .sp-pri-banner-btn.is-no-pri:hover {
                    background: #FEF3C7; transform: translateY(-1px);
                }
                .sp-pri-banner .sp-pri-banner-btn.is-ghost {
                    background: transparent; color: #4F46E5; border-color: #4F46E5;
                }
                .sp-pri-banner .sp-pri-banner-btn.is-ghost:hover {
                    background: var(--sp-primary-light); transform: translateY(-1px);
                }

                /* Atenuación — sólo aplica a Calificación PCL, que genuinamente requiere
                ser caso PRI formal. La sección Etapas PRIC nunca se atenúa: el usuario debe
                poder entrar a diligenciar lo que aplique sin estar bloqueado. */
                .sp-section-dimmed { opacity: 0.45; pointer-events: none; transition: opacity 0.25s ease; }
                .sp-section-dimmed .sp-subsection { position: relative; }
                .sp-nav-item.is-dimmed { opacity: 0.5; }
                .sp-nav-item.is-dimmed i { color: var(--sp-text-muted); }

                /* Badge de modalidad en la tabla principal */
                .sp-pri-badge {
                    display: inline-flex; align-items: center; gap: 5px;
                    padding: 3px 9px; border-radius: 12px;
                    font-size: 11px; font-weight: 600;
                    letter-spacing: 0.2px;
                    white-space: nowrap;
                }
                .sp-pri-badge i { font-size: 11px; line-height: 1; }
                .sp-pri-badge.is-pri { background: #D1FAE5; color: #065F46; }
                .sp-pri-badge.is-no-pri { background: #F1F5F9; color: #64748B; }
                .sp-pri-badge.is-no-pri-strong { background: #FEF3C7; color: #92400E; }

                /* Tabla de Recomendaciones */
                .sp-data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .sp-data-table th {
                    text-align: left; padding: 10px; background: var(--sp-secondary);
                    border: 1px solid var(--sp-border); font-size: 11px; color: var(--sp-text-muted); font-weight: 600;
                }
                .sp-data-table td { padding: 8px; border: 1px solid var(--sp-border); }
                .sp-data-table input, .sp-data-table select {
                    border: none; background: transparent; width: 100%; font-size: 13px; font-family: inherit;
                }
                .sp-data-table input:focus, .sp-data-table select:focus {
                    outline: 1px solid var(--sp-primary); background: var(--sp-primary-light);
                }

                /* Footer */
                .sp-panel-footer {
                    padding: 15px 30px; border-top: 1px solid var(--sp-border); background: white;
                    display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
                    gap: 12px;
                }
                .sp-panel-footer-left { display: flex; gap: 8px; align-items: center; }
                .sp-panel-footer-right { display: flex; gap: 8px; align-items: center; }
                .sp-panel-footer-progress {
                    font-size: 12px; color: var(--sp-text-muted);
                    padding: 6px 12px; border-radius: 16px;
                    background: var(--sp-secondary);
                }
                .sp-panel-footer-progress strong { color: var(--sp-text-main); font-weight: 600; }
                .sp-btn {
                    padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;
                    cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: none;
                    transition: all 0.2s;
                }
                .sp-btn-primary { background: var(--sp-primary); color: white; }
                .sp-btn-primary:hover { background: #4338CA; transform: translateY(-1px); box-shadow: 0 4px 6px rgba(79, 70, 229, 0.3); }
                .sp-btn-outline { background: white; border: 1px solid var(--sp-border); color: var(--sp-text-main); }
                .sp-btn-outline:hover { background: var(--sp-secondary); border-color: #CBD5E1; }
                .sp-btn-outline:disabled { opacity: 0.4; cursor: not-allowed; }
                .sp-btn-outline:disabled:hover { background: white; border-color: var(--sp-border); transform: none; box-shadow: none; }
                .sp-btn-success { background: var(--sp-accent); color: white; }
                .sp-btn-success:hover { background: #059669; transform: translateY(-1px); box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3); }
                .sp-btn-sm { padding: 4px 8px; font-size: 11px; }

                /* Scrollbar personalizado */
                .sp-content-area::-webkit-scrollbar { width: 8px; }
                .sp-content-area::-webkit-scrollbar-track { background: #F1F5F9; border-radius: 4px; }
                .sp-content-area::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
                .sp-content-area::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

                .sp-horizontal-nav::-webkit-scrollbar { height: 6px; }
                .sp-horizontal-nav::-webkit-scrollbar-track { background: #F8FAFC; }
                .sp-horizontal-nav::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 3px; }
            `;
            document.head.appendChild(style);
        }

        // Crear el HTML del panel
        const backdrop = document.createElement('div');
        backdrop.id = 'seguimientoPanelBackdrop';
        backdrop.className = 'seguimiento-backdrop';
        backdrop.innerHTML = `
            <div class="seguimiento-panel">
                <!-- Header -->
                <div class="sp-panel-header">
                    <div class="sp-header-info">
                        <h2 id="spPanelTitle">Gestión de Caso en Seguimiento</h2>
                        <p>Formato alineado a hoja "Casos en seguimiento"</p>
                    </div>
                    <button class="sp-close-btn" onclick="window.medicAusentismoComponent.closeSeguimientoPanel()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- 📦 Banner PRI: estado formal del caso (PRIC formal vs seguimiento simple) + control directo -->
                <div id="sp-pri-banner" class="sp-pri-banner is-unclassified">
                    <div class="sp-pri-banner-icon"><i class="fas fa-info-circle"></i></div>
                    <div class="sp-pri-banner-text" id="sp-pri-banner-text">
                        <strong>Sin clasificar aún</strong>
                        <small>Este caso aún no tiene definido si es un seguimiento simple o un caso PRI formal.</small>
                    </div>
                    <div class="sp-pri-banner-actions" id="sp-pri-banner-actions">
                        <!-- Se llenan dinámicamente según el estado (is-pri / is-no-pri / is-unclassified) -->
                    </div>
                </div>

                <!-- Navegación Horizontal — navegación secuencial: solo se desbloquea la siguiente
                al hacer click en "Siguiente". Click en navs futuras se ignora. -->
                <nav class="sp-horizontal-nav">
                    <div class="sp-nav-item active" onclick="window.medicAusentismoComponent._intentarNavegarANavItem(this, 'datos')">
                        <i class="fas fa-id-card"></i> <span>1. Datos Generales</span>
                    </div>
                    <div class="sp-nav-item" onclick="window.medicAusentismoComponent._intentarNavegarANavItem(this, 'incapacidad')">
                        <i class="fas fa-procedures"></i> <span>2. Incapacidad Temporal</span>
                    </div>
                    <div class="sp-nav-item" onclick="window.medicAusentismoComponent._intentarNavegarANavItem(this, 'etapas')">
                        <i class="fas fa-tasks"></i> <span>3. Etapas PRIC</span>
                    </div>
                    <div class="sp-nav-item" onclick="window.medicAusentismoComponent._intentarNavegarANavItem(this, 'recomendaciones')">
                        <i class="fas fa-clipboard-check"></i> <span>4. Seg. Recomendaciones</span>
                    </div>
                    <div class="sp-nav-item" onclick="window.medicAusentismoComponent._intentarNavegarANavItem(this, 'calificacion')">
                        <i class="fas fa-balance-scale"></i> <span>5. Calificación PCL</span>
                    </div>
                </nav>

                <!-- Área de Contenido -->
                <div class="sp-content-area">
                    
                    <!-- SECCIÓN 1: DATOS GENERALES -->
                    <div id="sp-section-datos" class="sp-form-section active">
                        <div class="sp-section-title"><i class="fas fa-user-tie"></i> 1. Información del Trabajador</div>
                        
                        <div class="sp-subsection">
                            <div class="sp-subsection-title"><i class="fas fa-address-card"></i> Identificación</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Nombre Completo</label>
                                    <input type="text" id="sp-nombre" class="sp-form-control" placeholder="Nombres y Apellidos">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Cédula de Ciudadanía</label>
                                    <input type="text" id="sp-cedula" class="sp-form-control" readonly>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Nacimiento</label>
                                    <input type="date" id="sp-fecha-nacimiento" class="sp-form-control" onchange="window.medicAusentismoComponent.calcularEdad()">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Edad</label>
                                    <input type="number" id="sp-edad" class="sp-form-control" placeholder="0" readonly style="background-color: #f0f0f0;">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Género</label>
                                    <select id="sp-genero" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="sp-subsection">
                            <div class="sp-subsection-title"><i class="fas fa-briefcase"></i> Información Laboral</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Cargo Actual</label>
                                    <input type="text" id="sp-cargo" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Tipo de Cargo</label>
                                    <select id="sp-tipo-cargo" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Operativo">Operativo</option>
                                        <option value="Administrativo">Administrativo</option>
                                        <option value="Mando Medio">Mando Medio</option>
                                        <option value="Directivo">Directivo</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Área / Dependencia</label>
                                    <input type="text" id="sp-area" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Ingreso</label>
                                    <input type="date" id="sp-fecha-ingreso" class="sp-form-control" onchange="window.medicAusentismoComponent.calcularAntiguedad()">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Antigüedad (Meses)</label>
                                    <input type="number" id="sp-antiguedad" class="sp-form-control" placeholder="0">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Tipo de Evento</label>
                                    <select id="sp-tipo-evento" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Accidente de Trabajo">Accidente de Trabajo</option>
                                        <option value="Enfermedad Laboral">Enfermedad Laboral</option>
                                        <option value="Enfermedad General">Enfermedad General</option>
                                        <option value="Licencia de Maternidad">Licencia de Maternidad</option>
                                        <option value="Licencia de Paternidad">Licencia de Paternidad</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Tipo de Contrato</label>
                                    <select id="sp-tipo-contrato" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Término Indefinido">Término Indefinido</option>
                                        <option value="Término Fijo">Término Fijo</option>
                                        <option value="Prestación de Servicios">Prestación de Servicios</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Salario Básico</label>
                                    <input type="number" id="sp-salario" class="sp-form-control" placeholder="">
                                </div>
                            </div>
                        </div>

                        <div class="sp-subsection">
                            <div class="sp-subsection-title"><i class="fas fa-hospital-user"></i> Seguridad Social</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">EPS</label>
                                    <input type="text" id="sp-eps" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">AFP (Pensión)</label>
                                    <input type="text" id="sp-afp" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">ARL</label>
                                    <input type="text" id="sp-arl" class="sp-form-control" value="COLMENA SEGUROS" readonly>
                                </div>
                            </div>
                        </div>

                        <div class="sp-subsection">
                            <div class="sp-subsection-title"><i class="fas fa-heartbeat"></i> Salud</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Peso (Kg)</label>
                                    <input type="number" id="sp-peso" class="sp-form-control" placeholder="0.0" step="0.1" onchange="window.medicAusentismoComponent.calcularIMC()">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Talla (cm)</label>
                                    <input type="number" id="sp-talla" class="sp-form-control" placeholder="0" step="1" onchange="window.medicAusentismoComponent.calcularIMC()">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">IMC</label>
                                    <input type="text" id="sp-imc" class="sp-form-control" placeholder="0.0" readonly style="background-color: #f0f0f0;">
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Estado Nutricional</label>
                                    <div id="sp-imc-estado" style="padding: 10px; border-radius: 6px; font-weight: 600; text-align: center; display: none;"></div>
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Actividades Extralaborales / Deportes</label>
                                    <textarea id="sp-actividades-extralaborales" class="sp-form-control" rows="2" placeholder="Ej: Fútbol los fines de semana, natación, gimnasio..."></textarea>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Dominancia</label>
                                    <select id="sp-dominancia" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Diestro">Diestro</option>
                                        <option value="Zurdo">Zurdo</option>
                                        <option value="Ambidiestro">Ambidiestro</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 2: INCAPACIDAD TEMPORAL -->
                    <div id="sp-section-incapacidad" class="sp-form-section">
                        <div class="sp-section-title"><i class="fas fa-calendar-times"></i> 2. Detalle de la Incapacidad Temporal</div>
                        
                        <div class="sp-form-grid">
                            <div class="sp-form-group">
                                <label class="sp-form-label">Fecha de Inicio</label>
                                <input type="date" id="sp-fecha-inicio" class="sp-form-control" onchange="window.medicAusentismoComponent.calcularDiasAcumulados()">
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Fecha de Fin</label>
                                <input type="date" id="sp-fecha-fin" class="sp-form-control" onchange="window.medicAusentismoComponent.calcularDiasAcumulados()">
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Total Días Acumulados</label>
                                <input type="number" id="sp-dias-acumulados" class="sp-form-control" placeholder="Ej: 21" readonly style="background-color: #f0f0f0;">
                            </div>
                        </div>

                        <div class="sp-subsection">
                            <div class="sp-subsection-title"><i class="fas fa-diagnoses"></i> Diagnóstico</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Código CIE-10</label>
                                    <input type="text" id="sp-codigo-cie10" class="sp-form-control" placeholder="Ej: K910">
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Descripción del Diagnóstico</label>
                                    <input type="text" id="sp-descripcion-diagnostico" class="sp-form-control" placeholder="Ej: Vómitos postoperatorios">
                                </div>
                                
                                <!-- Sección de Seguimientos -->
                                <div class="sp-form-group full-width" style="grid-column: 1 / -1;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <label class="sp-form-label" style="margin: 0;">
                                            <i class="fas fa-clipboard-list" style="color: #4F46E5;"></i> Seguimientos
                                        </label>
                                        <button type="button" onclick="window.medicAusentismoComponent.agregarSeguimiento()" 
                                            style="padding: 6px 12px; border-radius: 6px; border: 1px solid #4F46E5; background: white; color: #4F46E5; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;"
                                            onmouseover="this.style.background='#EEF2FF'; this.style.borderColor='#4338CA'"
                                            onmouseout="this.style.background='white'; this.style.borderColor='#4F46E5'">
                                            <i class="fas fa-plus"></i> Agregar Seguimiento
                                        </button>
                                    </div>
                                    
                                    <!-- Contenedor de seguimientos -->
                                    <div id="sp-seguimientos-container" style="display: flex; flex-direction: column; gap: 12px;">
                                        <!-- El primer seguimiento se agrega por defecto -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="sp-subsection">
                            <div class="sp-subsection-title"><i class="fas fa-sync-alt"></i> Prórrogas</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Número de Prórrogas</label>
                                    <input type="number" id="sp-numero-prorrogas" class="sp-form-control" placeholder="0">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha Última Prórroga</label>
                                    <input type="date" id="sp-fecha-ultima-prorroga" class="sp-form-control">
                                </div>
                            </div>
                        </div>

                        <!-- Diagnósticos Múltiples -->
                        <div class="sp-subsection">
                            <div class="sp-subsection-title"><i class="fas fa-stethoscope"></i> Diagnósticos Adicionales</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">CIE-10 Incapacidad Temporal DX 2</label>
                                    <input type="text" id="sp-cie10-dx2" class="sp-form-control" placeholder="Ej: M545">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Origen Incapacidad DX 2</label>
                                    <select id="sp-origen-dx2" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="LABORAL">LABORAL</option>
                                        <option value="COMÚN">COMÚN</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">CIE-10 Incapacidad Temporal DX 3</label>
                                    <input type="text" id="sp-cie10-dx3" class="sp-form-control" placeholder="Ej: G439">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Origen Incapacidad DX 3</label>
                                    <select id="sp-origen-dx3" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="LABORAL">LABORAL</option>
                                        <option value="COMÚN">COMÚN</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Etapa 4: Reincorporación Laboral -->
                        <div class="sp-subsection" style="margin-top: 20px;">
                            <div class="sp-subsection-title"><i class="fas fa-briefcase"></i> Etapa 4: Reincorporación Laboral</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Reincorporación</label>
                                    <input type="date" id="sp-fecha-reincorporacion-inc" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Tipo de Reintegro</label>
                                    <select id="sp-tipo-reintegro-inc" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Mismo Cargo">Mismo Cargo</option>
                                        <option value="Funciones Restrictivas">Funciones Restrictivas</option>
                                        <option value="Otro Oficio">Otro Oficio</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Adaptaciones en el Puesto de Trabajo</label>
                                    <input type="text" id="sp-adaptaciones-inc" class="sp-form-control" placeholder="Ej: Silla ergonómica, Rotación de turnos...">
                                </div>
                            </div>
                        </div>

                        <!-- Etapa 5: Cierre de Caso -->
                        <div class="sp-subsection" style="margin-top: 20px;">
                            <div class="sp-subsection-title"><i class="fas fa-check-circle"></i> Etapa 5: Cierre de Caso</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Cierre</label>
                                    <input type="date" id="sp-fecha-cierre-inc" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Motivo de Cierre</label>
                                    <select id="sp-motivo-cierre-inc" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Alta Médica">Alta Médica</option>
                                        <option value="Calificación PCL">Calificación PCL</option>
                                        <option value="Retiro Voluntario">Retiro Voluntario</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Observaciones Finales</label>
                                    <textarea id="sp-observaciones-finales-inc" class="sp-form-control" rows="2"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 3: ETAPAS PRIC -->
                    <div id="sp-section-etapas" class="sp-form-section">
                        <div class="sp-section-title"><i class="fas fa-tasks"></i> 3. Proceso de Rehabilitación y Reincorporación (PRIC)</div>

                        <!-- Condiciones de Salud (NUEVO) -->
                        <div class="sp-subsection">
                            <div class="sp-subsection-title" style="color: #174ea6;"><i class="fas fa-heartbeat"></i> Condiciones de Salud</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha del Último Examen Médico Periódico</label>
                                    <input type="date" id="sp-fecha-examen-medico" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Resultado Examen Médico Periódico</label>
                                    <select id="sp-resultado-examen-medico" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Apto">Apto</option>
                                        <option value="Apto con Restricciones">Apto con Restricciones</option>
                                        <option value="No Apto">No Apto</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha Último Examen Médico Post Incapacidad</label>
                                    <input type="date" id="sp-fecha-examen-periodico" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Resultado Examen Médico Post Incapacidad</label>
                                    <select id="sp-resultado-examen-post-incapacidad" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Apto">Apto</option>
                                        <option value="Apto con Restricciones">Apto con Restricciones</option>
                                        <option value="No Apto">No Apto</option>
                                        <option value="Pendiente">Pendiente</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Trabajador Remoto / Teletrabajo / Trabajo en Casa</label>
                                    <select id="sp-trabajador-remoto" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="SI">Sí</option>
                                        <option value="NO">No</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Fecha de Inicio en Trabajo Remoto / Teletrabajo / Trabajo en Casa (si aplica)</label>
                                    <input type="date" id="sp-fecha-inicio-remoto" class="sp-form-control">
                                </div>
                            </div>
                        </div>

                        <!-- Etapa 1 -->
                        <div class="sp-subsection">
                            <div class="sp-subsection-title">Etapa 1: Captura de Caso</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">¿El caso es ingresado en PRIC?</label>
                                    <select id="sp-caso-ingresado-pric" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="SI">Sí</option>
                                        <option value="NO">No</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Mecanismo de Detección</label>
                                    <select id="sp-mecanismo-deteccion" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Accidente de trabajo">Accidente de trabajo</option>
                                        <option value="Enfermedad general">Enfermedad general</option>
                                        <option value="Enfermedad laboral">Enfermedad laboral</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Ingreso al PRIC</label>
                                    <input type="date" id="sp-fecha-ingreso-pric" class="sp-form-control">
                                </div>
                            </div>
                        </div>

                        <!-- Etapa 2 -->
                        <div class="sp-subsection">
                            <div class="sp-subsection-title">Etapa 2: Plan de Tratamiento</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">¿El trabajador tiene plan de tratamiento autorizado?</label>
                                    <select id="sp-trabajador-plan-tratamiento" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="SI">Sí</option>
                                        <option value="NO">No</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Meta de Rehabilitación</label>
                                    <textarea id="sp-objetivos-tratamiento" class="sp-form-control" rows="2"></textarea>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Emisión del Plan de Tratamiento</label>
                                    <input type="date" id="sp-fecha-inicio-plan" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha Probable de Reintegro</label>
                                    <input type="date" id="sp-fecha-probable-alta" class="sp-form-control">
                                </div>
                            </div>
                        </div>

                        <!-- Etapa 3 -->
                        <div class="sp-subsection">
                            <div class="sp-subsection-title">Etapa 3: Ejecución y Seguimiento</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Próxima Cita Médica</label>
                                    <input type="date" id="sp-fecha-proxima-cita" class="sp-form-control">
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Observaciones del Seguimiento - Citas</label>
                                    <textarea id="sp-evolucion-clinica" class="sp-form-control" rows="2" placeholder="Detalle de las observaciones..."></textarea>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de APT para Reincorporación Laboral (si aplica)</label>
                                    <input type="date" id="sp-fecha-ultimo-seguimiento" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Modalidad de Reincorporación</label>
                                    <select id="sp-adherencia" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Si">Sí</option>
                                        <option value="No">No</option>
                                        <option value="Parcial">Parcial</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Reintegro</label>
                                    <input type="date" id="sp-fecha-reintegro" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Periodicidad del Seguimiento al Trabajador</label>
                                    <select id="sp-periodicidad-seguimiento" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Semanal">Semanal</option>
                                        <option value="Quincenal">Quincenal</option>
                                        <option value="Mensual">Mensual</option>
                                        <option value="Bimensual">Bimensual</option>
                                        <option value="Trimestral">Trimestral</option>
                                        <option value="Cuatrimestral">Cuatrimestral</option>
                                        <option value="Semestral">Semestral</option>
                                        <option value="Anual">Anual</option>
                                        <option value="No Aplica">No Aplica</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Recomendaciones Laborales Vigentes</label>
                                    <select id="sp-recomendaciones-laborales" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="SI">Sí</option>
                                        <option value="NO">No</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Vencimiento de Recomendaciones Laborales (si aplica)</label>
                                    <input type="date" id="sp-fecha-vencimiento-recomendaciones" class="sp-form-control">
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Descripción Recomendaciones Laborales Vigentes: Incluye Tareas Asignadas</label>
                                    <textarea id="sp-descripcion-recomendaciones" class="sp-form-control" rows="2" placeholder="Describa las recomendaciones..."></textarea>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Próximo Seguimiento a las Recomendaciones en Puesto de Trabajo (si aplica)</label>
                                    <input type="date" id="sp-fecha-proximo-seguimiento-recomendaciones" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">¿Tiene Deserción o Incumplimiento de Citas?</label>
                                    <select id="sp-tiene-desercion" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="SI">Sí</option>
                                        <option value="NO">No</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">¿Logró Mejoría Médica Máxima?</label>
                                    <select id="sp-logro-mejoria-medica" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="SI">Sí</option>
                                        <option value="NO">No</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Seguimientos (Sección Intermedia - Parte de Etapa 3) -->
                        <div class="sp-subsection">
                            <div class="sp-subsection-title" style="color: #174ea6;">Seguimientos</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label" style="font-weight: 600;">Seguimiento 1</label>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha Seguimiento 1</label>
                                    <input type="date" id="sp-fecha-seguimiento-1" class="sp-form-control">
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Descripción Seguimiento 1</label>
                                    <textarea id="sp-descripcion-seguimiento-1" class="sp-form-control" rows="2" placeholder="Describa el seguimiento..."></textarea>
                                </div>
                                <div class="sp-form-group full-width" style="margin-top: 10px;">
                                    <label class="sp-form-label" style="font-weight: 600;">Seguimiento 2</label>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha Seguimiento 2</label>
                                    <input type="date" id="sp-fecha-seguimiento-2" class="sp-form-control">
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Descripción Seguimiento 2</label>
                                    <textarea id="sp-descripcion-seguimiento-2" class="sp-form-control" rows="2" placeholder="Describa el seguimiento..."></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Etapa 4 -->
                        <div class="sp-subsection">
                            <div class="sp-subsection-title">Etapa 4: Reincorporación Laboral</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Reincorporación Laboral</label>
                                    <input type="date" id="sp-fecha-reincorporacion" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Tipo de Reintegro</label>
                                    <select id="sp-tipo-reintegro" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Mismo Cargo">Mismo Cargo</option>
                                        <option value="Funciones Restrictivas">Funciones Restrictivas</option>
                                        <option value="Otro Oficio">Otro Oficio</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label">Adaptación en el Puesto de Trabajo</label>
                                    <input type="text" id="sp-adaptaciones" class="sp-form-control" placeholder="Ej: Silla ergonómica, Rotación de turnos...">
                                </div>
                            </div>
                        </div>

                        <!-- Etapa 5 -->
                        <div class="sp-subsection">
                            <div class="sp-subsection-title">Etapa 5: Cierre de Caso</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Cierre de Caso por PRIC</label>
                                    <input type="date" id="sp-fecha-cierre" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Caso con Cierre de Seguimientos por PRIC sin Seguimientos Pendientes</label>
                                    <select id="sp-motivo-cierre" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="SI">Sí</option>
                                        <option value="NO">No</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Fecha de Calificación de PCL (Pérdida de Capacidad Laboral)</label>
                                    <input type="date" id="sp-fecha-calificacion-pcl" class="sp-form-control">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Porcentaje de PCL</label>
                                    <input type="number" id="sp-porcentaje-pcl-calificacion" class="sp-form-control" placeholder="0.00%" step="0.01">
                                </div>
                            </div>
                        </div>

                        <!-- Historial de Diagnóstico -->
                        <div class="sp-subsection">
                            <div class="sp-subsection-title" style="color: #174ea6;"><i class="fas fa-file-medical"></i> Historial de Diagnóstico</div>
                            <div class="sp-form-grid">
                                <div class="sp-form-group full-width">
                                    <label class="sp-form-label" style="font-weight: 600;">Diagnóstico 1 (DX 1)</label>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">CIE-10 Calificada DX 1</label>
                                    <input type="text" id="sp-cie10-dx1-calificada" class="sp-form-control" placeholder="Ej: M545">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Origen DX 1</label>
                                    <select id="sp-origen-dx1" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="AT">AT (Accidente de Trabajo)</option>
                                        <option value="EL">EL (Enfermedad Laboral)</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width" style="margin-top: 10px;">
                                    <label class="sp-form-label" style="font-weight: 600;">Diagnóstico 2 (DX 2)</label>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">CIE-10 Calificada DX 2</label>
                                    <input type="text" id="sp-cie10-dx2-calificada" class="sp-form-control" placeholder="Ej: M545">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Origen DX 2</label>
                                    <select id="sp-origen-dx2-calificada" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="AT">AT (Accidente de Trabajo)</option>
                                        <option value="EL">EL (Enfermedad Laboral)</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width" style="margin-top: 10px;">
                                    <label class="sp-form-label" style="font-weight: 600;">Diagnóstico 3 (DX 3)</label>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">CIE-10 Calificada DX 3</label>
                                    <input type="text" id="sp-cie10-dx3-calificada" class="sp-form-control" placeholder="Ej: M545">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Origen DX 3</label>
                                    <select id="sp-origen-dx3-calificada" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="AT">AT (Accidente de Trabajo)</option>
                                        <option value="EL">EL (Enfermedad Laboral)</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width" style="margin-top: 10px;">
                                    <label class="sp-form-label" style="font-weight: 600;">Diagnóstico 4 (DX 4)</label>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">CIE-10 Calificada DX 4</label>
                                    <input type="text" id="sp-cie10-dx4-calificada" class="sp-form-control" placeholder="Ej: M545">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Origen DX 4</label>
                                    <select id="sp-origen-dx4-calificada" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="AT">AT (Accidente de Trabajo)</option>
                                        <option value="EL">EL (Enfermedad Laboral)</option>
                                    </select>
                                </div>
                                <div class="sp-form-group full-width" style="margin-top: 15px; border-top: 1px solid #dee2e6; padding-top: 15px;">
                                    <label class="sp-form-label" style="font-weight: 600;">Información Adicional</label>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Origen del Caso</label>
                                    <select id="sp-origen-caso" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="Enfermedad General">Enfermedad General</option>
                                        <option value="Accidente de Trabajo">Accidente de Trabajo</option>
                                        <option value="Enfermedad Laboral">Enfermedad Laboral</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Ingreso a SVE</label>
                                    <select id="sp-ingreso-sve" class="sp-form-control">
                                        <option value="">Seleccione...</option>
                                        <option value="SI">Sí</option>
                                        <option value="NO">No</option>
                                    </select>
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Año Última Calificación PCL</label>
                                    <input type="number" id="sp-anio-ultima-calificacion-pcl" class="sp-form-control" placeholder="Ej: 2024" min="2000" max="2100">
                                </div>
                                <div class="sp-form-group">
                                    <label class="sp-form-label">Año en que se Realiza Seguimiento por Parte de la Empresa</label>
                                    <input type="number" id="sp-anio-seguimiento-empresa" class="sp-form-control" placeholder="Ej: 2025" min="2000" max="2100">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN 4: SEGUIMIENTO RECOMENDACIONES -->
                    <div id="sp-section-recomendaciones" class="sp-form-section">
                        <div class="sp-section-title"><i class="fas fa-clipboard-check"></i> 4. Seguimiento a Recomendaciones Médico Laborales</div>
                        <p style="font-size: 13px; color: var(--sp-text-muted); margin-bottom: 15px;">Listado de recomendaciones emitidas por la ARL/EPS y su cumplimiento por parte de la empresa y el trabajador.</p>

                        <table class="sp-data-table">
                            <thead>
                                <tr>
                                    <th width="5%">Item</th>
                                    <th width="28%">Recomendación Emitida</th>
                                    <th width="14%">Entidad que Emite</th>
                                    <th width="11%">Fecha Límite</th>
                                    <th width="11%">Cumple?</th>
                                    <th width="23%">Observación / Evidencia</th>
                                    <th width="8%">Acción</th>
                                </tr>
                            </thead>
                            <tbody id="sp-recomTableBody">
                                <tr>
                                    <td style="text-align: center; vertical-align: middle;"><span class="recom-item-number">1</span></td>
                                    <td><input type="text" class="sp-form-control" placeholder="Ej: Reposo absoluto"></td>
                                    <td>
                                        <select class="sp-form-control">
                                            <option>ARL</option>
                                            <option>EPS</option>
                                            <option>JRC</option>
                                        </select>
                                    </td>
                                    <td><input type="date" class="sp-form-control"></td>
                                    <td>
                                        <select class="sp-form-control">
                                            <option>SI</option>
                                            <option>NO</option>
                                            <option>EN PROCESO</option>
                                        </select>
                                    </td>
                                    <td><input type="text" class="sp-form-control" placeholder="Detalle"></td>
                                    <td style="text-align:center;">
                                        <button class="sp-btn sp-btn-outline sp-btn-sm" onclick="window.medicAusentismoComponent.removeRecomRow(this)">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="text-align: center; vertical-align: middle;"><span class="recom-item-number">2</span></td>
                                    <td><input type="text" class="sp-form-control" placeholder="Ej: Prohibido levantar >5kg"></td>
                                    <td>
                                        <select class="sp-form-control">
                                            <option>ARL</option>
                                            <option>EPS</option>
                                        </select>
                                    </td>
                                    <td><input type="date" class="sp-form-control"></td>
                                    <td>
                                        <select class="sp-form-control">
                                            <option>SI</option>
                                            <option>NO</option>
                                        </select>
                                    </td>
                                    <td><input type="text" class="sp-form-control" placeholder="Detalle"></td>
                                    <td style="text-align:center;">
                                        <button class="sp-btn sp-btn-outline sp-btn-sm" onclick="window.medicAusentismoComponent.removeRecomRow(this)">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <button class="sp-btn sp-btn-outline sp-btn-sm" style="margin-top: 10px;" onclick="window.medicAusentismoComponent.addRecomRow()">
                            <i class="fas fa-plus"></i> Agregar Fila
                        </button>
                    </div>

                    <!-- SECCIÓN 5: CALIFICACIÓN PCL -->
                    <div id="sp-section-calificacion" class="sp-form-section">
                        <div class="sp-section-title"><i class="fas fa-balance-scale"></i> 5. Proceso de Calificación / PCL</div>

                        <div class="sp-form-grid">
                            <!-- CALIFICACIÓN REGIONAL -->
                            <div class="sp-form-group full-width" style="margin-top: 10px; padding-top: 15px; border-top: 2px solid #E2E8F0;">
                                <label class="sp-form-label" style="color: #4F46E5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                    <i class="fas fa-map-marker-alt"></i> Calificación Regional
                                </label>
                            </div>

                            <div class="sp-form-group">
                                <label class="sp-form-label">Estado del Proceso</label>
                                <select id="sp-estado-proceso-regional" class="sp-form-control">
                                    <option value="">Seleccione...</option>
                                    <option value="No Requiere">No Requiere</option>
                                    <option value="Solicitud Radicada">Solicitud Radicada</option>
                                    <option value="En Estudio">En Estudio</option>
                                    <option value="Calificado">Calificado</option>
                                </select>
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Fecha de Solicitud</label>
                                <input type="date" id="sp-fecha-solicitud-regional" class="sp-form-control">
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Fecha Dictamen</label>
                                <input type="date" id="sp-fecha-dictamen-regional" class="sp-form-control">
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">% PCL Regional</label>
                                <input type="number" id="sp-porcentaje-pcl-regional" class="sp-form-control" placeholder="0.00%" step="0.01">
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Origen Calificado</label>
                                <select id="sp-origen-calificacion-regional" class="sp-form-control">
                                    <option value="">Seleccione...</option>
                                    <option value="Común">Común</option>
                                    <option value="Laboral">Laboral</option>
                                    <option value="Accidente Trabajo">Accidente de Trabajo</option>
                                </select>
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Fecha de Estructuración</label>
                                <input type="date" id="sp-fecha-estructuracion-regional" class="sp-form-control">
                            </div>

                            <div class="sp-form-group full-width">
                                <label class="sp-form-label">Observaciones Calificación Regional</label>
                                <textarea id="sp-observaciones-calificacion-regional" class="sp-form-control" rows="2"></textarea>
                            </div>

                            <!-- CALIFICACIÓN NACIONAL -->
                            <div class="sp-form-group full-width" style="margin-top: 10px; padding-top: 15px; border-top: 2px solid #E2E8F0;">
                                <label class="sp-form-label" style="color: #174ea6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                    <i class="fas fa-building"></i> Calificación Nacional
                                </label>
                            </div>

                            <div class="sp-form-group">
                                <label class="sp-form-label">Estado del Proceso</label>
                                <select id="sp-estado-proceso-nacional" class="sp-form-control">
                                    <option value="">Seleccione...</option>
                                    <option value="No Requiere">No Requiere</option>
                                    <option value="Solicitud Radicada">Solicitud Radicada</option>
                                    <option value="En Estudio">En Estudio</option>
                                    <option value="Calificado">Calificado</option>
                                </select>
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Fecha de Solicitud</label>
                                <input type="date" id="sp-fecha-solicitud-nacional" class="sp-form-control">
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Fecha Dictamen</label>
                                <input type="date" id="sp-fecha-dictamen-nacional" class="sp-form-control">
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">% PCL Nacional</label>
                                <input type="number" id="sp-porcentaje-pcl-nacional" class="sp-form-control" placeholder="0.00%" step="0.01">
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Origen Calificado</label>
                                <select id="sp-origen-calificacion-nacional" class="sp-form-control">
                                    <option value="">Seleccione...</option>
                                    <option value="Común">Común</option>
                                    <option value="Laboral">Laboral</option>
                                    <option value="Accidente Trabajo">Accidente de Trabajo</option>
                                </select>
                            </div>
                            <div class="sp-form-group">
                                <label class="sp-form-label">Fecha de Estructuración</label>
                                <input type="date" id="sp-fecha-estructuracion-nacional" class="sp-form-control">
                            </div>

                            <div class="sp-form-group full-width">
                                <label class="sp-form-label">Observaciones de la Calificación</label>
                                <textarea id="sp-observaciones-calificacion" class="sp-form-control" rows="3"></textarea>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Footer con navegación wizard -->
                <div class="sp-panel-footer">
                    <div class="sp-panel-footer-left">
                        <button class="sp-btn sp-btn-outline" onclick="window.medicAusentismoComponent.closeSeguimientoPanel()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                    <div class="sp-panel-footer-progress" id="sp-panel-progress">
                        Sección <strong id="sp-panel-progress-current">1</strong> de <strong id="sp-panel-progress-total">5</strong> —
                        <span id="sp-panel-progress-text">0/0 campos diligenciados</span>
                    </div>
                    <div class="sp-panel-footer-right">
                        <button class="sp-btn sp-btn-outline" id="sp-btn-prev" onclick="window.medicAusentismoComponent._irASeccionAnterior()">
                            <i class="fas fa-arrow-left"></i> Anterior
                        </button>
                        <button class="sp-btn sp-btn-primary" id="sp-btn-next" onclick="window.medicAusentismoComponent._irASiguienteSeccion()">
                            Siguiente <i class="fas fa-arrow-right"></i>
                        </button>
                        <button class="sp-btn sp-btn-success" onclick="window.medicAusentismoComponent.saveSeguimientoData()">
                            <i class="fas fa-save"></i> Guardar en Excel
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Cerrar al hacer clic en el backdrop
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                this.closeSeguimientoPanel();
            }
        });

        // 📦 Banner PRI — listener "live": cualquier cambio en el campo clave dispara
        // la re-evaluación del banner y la atenuación/desatenua ción de secciones.
        // El listener se engancha una sola vez (porque createSeguimientoPanel sólo se
        // llama cuando el backdrop aún no existe en el DOM).
        const selCaso = document.getElementById('sp-caso-ingresado-pric');
        const fIngresoPric = document.getElementById('sp-fecha-ingreso-pric');
        if (selCaso) {
            selCaso.addEventListener('change', () => this._actualizarBannerPRI());
        }
        if (fIngresoPric) {
            fIngresoPric.addEventListener('change', () => this._actualizarBannerPRI());
        }

        // 📦 Wizard de validación: enganchar delegación de eventos sobre el panel
        // para que cualquier input/select requerido se valide en vivo (borde rojo +
        // asterisco en label). Se llama una sola vez al crear el panel.
        this._setupListenersValidacion();
        // Marcar de entrada los campos base como requeridos.
        this._aplicarReglasRequeridos();
    }

    /**
     * Cierra el panel de seguimiento
     */
    closeSeguimientoPanel() {
        const backdrop = document.getElementById('seguimientoPanelBackdrop');
        if (backdrop) {
            backdrop.classList.remove('active');
        }
    }

    /**
     * Maneja la selección de una incapacidad en el modal de detalles
     */
    onIncapacidadSeleccionada(checkbox) {
        const incapacidadesSeleccionadas = document.querySelectorAll('.incapacidad-checkbox:checked');
        
        console.log('[INCAPACIDAD SELECCIONADA] Total seleccionadas:', incapacidadesSeleccionadas.length);
        
        // Opcional: Limitar a una sola selección
        if (incapacidadesSeleccionadas.length > 1) {
            // Desmarcar las anteriores excepto la actual
            incapacidadesSeleccionadas.forEach((cb, idx) => {
                if (cb !== checkbox) {
                    cb.checked = false;
                }
            });
        }
        
        // Guardar referencia de la incapacidad seleccionada
        if (checkbox.checked) {
            this.incapacidadSeleccionada = {
                index: checkbox.dataset.incIndex,
                fechaInicio: checkbox.dataset.incFechaInicio,
                fechaFin: checkbox.dataset.incFechaFin,
                dias: checkbox.dataset.incDias,
                diagnostico: checkbox.dataset.incDiagnostico,
                codigo: checkbox.dataset.incCodigo
            };
            console.log('[INCAPACIDAD SELECCIONADA]', this.incapacidadSeleccionada);
        } else {
            this.incapacidadSeleccionada = null;
        }
    }

    /**
     * Abre el modal para cargar casos existentes filtrados por cédula
     * Se usa después de hacer clic en "Abrir Seguimiento" desde el modal de detalles
     */
    async openCargarCasosModalPorCedula(cedula, nombre) {
        console.log('[CARGAR CASOS POR CEDULA] Abriendo modal para cédula:', cedula);

        // Crear modal si no existe
        if (!document.getElementById('modalCargarCasos')) {
            this.crearModalCargarCasos();
        }

        // Cargar casos desde PRI.xlsx
        const modal = document.getElementById('modalCargarCasos');
        const listaCasos = document.getElementById('listaCasosContenido');
        const modalHeader = modal.querySelector('h3');
        const modalSubheader = modal.querySelector('p');
        
        // Actualizar título del modal
        if (modalHeader) modalHeader.textContent = 'Seleccionar Caso para Cargar';
        if (modalSubheader) modalSubheader.textContent = `Casos registrados para: ${nombre} (CC: ${cedula})`;
        
        // Mostrar estado de carga
        listaCasos.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748B;">
                <i class="fas fa-spinner fa-spin" style="font-size: 32px; margin-bottom: 16px;"></i>
                <p>Buscando casos registrados...</p>
            </div>
        `;

        // Mostrar modal
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
        }, 10);

        // Buscar casos por cédula desde el backend
        try {
            const resultado = await window.electronAPI.buscarRegistrosCedula(cedula, this.currentCompany);
            console.log('[CARGAR CASOS] Resultado:', resultado);

            if (resultado.success && resultado.registros && resultado.registros.length > 0) {
                // Renderizar lista de casos encontrados
                listaCasos.innerHTML = `
                    <div style="margin-bottom: 16px; padding: 12px; background: #EEF2FF; border-radius: 8px; border-left: 4px solid #4F46E5;">
                        <div style="font-weight: 600; color: #1E40AF; font-size: 13px;">
                            <i class="fas fa-info-circle"></i> ${resultado.registros.length} caso(s) encontrado(s)
                        </div>
                        <div style="font-size: 12px; color: #64748B; margin-top: 4px;">
                            Selecciona un caso para cargar sus datos o crea uno nuevo
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${resultado.registros.map((caso, idx) => `
                            <div style="display: flex; align-items: center; padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: white;"
                                onmouseover="this.style.borderColor='#4F46E5'; this.style.background='#EEF2FF'"
                                onmouseout="this.style.borderColor='#E2E8F0'; this.style.background='white'"
                                onclick="window.medicAusentismoComponent.cargarCasoSeleccionado(${JSON.stringify(caso).replace(/"/g, '&quot;')}, ${idx === 0 ? 'true' : 'false'})">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #10B981, #059669); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">
                                    <i class="fas fa-file-medical" style="font-size: 16px;"></i>
                                </div>
                                <div style="flex: 1; margin-left: 12px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div style="font-weight: 600; font-size: 14px; color: #1E293B;">
                                            ${caso.fecha_fin || 'Sin fecha fin'} | 
                                            <span style="color: #4F46E5;">${caso.dias || '0'} días</span>
                                        </div>
                                        ${idx === 0 ? '<span style="padding: 2px 8px; background: #FEF3C7; color: #D97706; font-size: 10px; font-weight: 600; border-radius: 12px; text-transform: uppercase;">Más reciente</span>' : ''}
                                    </div>
                                    <div style="font-size: 12px; color: #64748B; margin-top: 4px;">
                                        ${caso.diagnostico || 'Sin diagnóstico'}
                                    </div>
                                </div>
                                <i class="fas fa-chevron-right" style="color: #94A3B8; font-size: 12px;"></i>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #E2E8F0; text-align: center;">
                        <button onclick="window.medicAusentismoComponent.cargarCasoSeleccionado(null, false)"
                            style="padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid #E2E8F0; background: white; color: #64748B; transition: all 0.2s;"
                            onmouseover="this.style.borderColor='#94A3B8'; this.style.background='#F1F5F9'"
                            onmouseout="this.style.borderColor='#E2E8F0'; this.style.background='white'">
                            <i class="fas fa-plus"></i> Crear caso nuevo
                        </button>
                    </div>
                `;
                console.log(`[CARGAR CASOS] ${resultado.registros.length} casos encontrados`);
            } else if (resultado.success && (!resultado.registros || resultado.registros.length === 0)) {
                // No hay casos registrados - mostrar opción de crear nuevo
                listaCasos.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                            <i class="fas fa-inbox" style="font-size: 32px;"></i>
                        </div>
                        <h4 style="font-size: 16px; font-weight: 600; color: #1E293B; margin-bottom: 8px;">No hay casos registrados</h4>
                        <p style="font-size: 13px; color: #64748B; margin-bottom: 20px;">
                            No se encontraron casos previos para esta cédula
                        </p>
                        <button onclick="window.medicAusentismoComponent.cargarCasoSeleccionado(null, false)"
                            style="padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);"
                            onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 8px -1px rgba(79, 70, 229, 0.3)'"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(79, 70, 229, 0.2)'">
                            <i class="fas fa-plus"></i> Crear caso nuevo
                        </button>
                    </div>
                `;
            } else {
                throw new Error(resultado.error || 'Error al buscar casos');
            }
        } catch (error) {
            console.error('[CARGAR CASOS] Error:', error);
            listaCasos.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #EF4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <p>Error al buscar casos: ${error.message}</p>
                    <button onclick="window.medicAusentismoComponent.cargarCasoSeleccionado(null, false)"
                        style="margin-top: 16px; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid #E2E8F0; background: white; color: #64748B;">
                        Continuar sin cargar
                    </button>
                </div>
            `;
        }
    }

    /**
     * Crea el modal para cargar casos existentes
     */
    crearModalCargarCasos() {
        const modal = document.createElement('div');
        modal.id = 'modalCargarCasos';
        modal.className = 'modal-backdrop';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px);
            z-index: 10001; display: none;
            align-items: center; justify-content: center;
            opacity: 0; visibility: hidden; transition: all 0.3s ease;
        `;

        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; max-width: 800px; width: 90%; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <div style="padding: 24px; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; border-radius: 16px 16px 0 0;">
                    <div>
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Cargar Caso Existente</h3>
                        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Selecciona un caso registrado para cargar sus datos</p>
                    </div>
                    <button onclick="document.getElementById('modalCargarCasos').style.display='none'"
                        style="width: 32px; height: 32px; border-radius: 8px; border: none; background: rgba(255,255,255,0.2); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Body - Lista de casos -->
                <div id="listaCasosContenido" style="padding: 24px; overflow-y: auto; max-height: calc(80vh - 140px); background: #F8FAFC;">
                    <!-- Se llena dinámicamente -->
                </div>

                <!-- Footer -->
                <div style="padding: 16px 24px; border-top: 1px solid #E2E8F0; display: flex; justify-content: flex-end; background: white; border-radius: 0 0 16px 16px;">
                    <button onclick="document.getElementById('modalCargarCasos').style.display='none'"
                        style="padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #E2E8F0; background: white; color: #475569; transition: all 0.2s;"
                        onmouseover="this.style.borderColor='#CBD5E1'; this.style.background='#F1F5F9'"
                        onmouseout="this.style.borderColor='#E2E8F0'; this.style.background='white'">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Cerrar al hacer clic en el backdrop
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    /**
     * Carga un caso seleccionado desde el modal de búsqueda por cédula
     * @param {Object} caso - Datos del caso (null si es caso nuevo)
     * @param {boolean} esRegistroExistente - true si carga de registro existente, false si es nuevo
     */
    cargarCasoSeleccionado(caso, esRegistroExistente) {
        console.log('[CARGAR CASO SELECCIONADO] Caso:', caso, 'Es registro existente:', esRegistroExistente);

        // Cerrar modal
        const modal = document.getElementById('modalCargarCasos');
        if (modal) {
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }

        // Si es caso nuevo (null), abrir panel vacío con datos básicos del empleado actual
        if (!caso) {
            console.log('[CARGAR CASO SELECCIONADO] Creando caso nuevo');
            if (this.currentDetalleEmpleado) {
                // Abrir panel directamente
                this.abrirPanelSeguimientoConEmpleado(this.currentDetalleEmpleado);
                this.showNotification('📝 Creando caso nuevo', 'info');
            }
            return;
        }

        // Cargar caso existente
        console.log('[CARGAR CASO SELECCIONADO] Cargando caso existente de fila:', caso.fila);

        // Abrir panel con el empleado actual
        if (this.currentDetalleEmpleado) {
            this.abrirPanelSeguimientoConEmpleado(this.currentDetalleEmpleado);
        }

        // Esperar a que el panel esté visible y cargar datos
        setTimeout(() => {
            // Cambiar a sección de datos generales
            this.showSeguimientoPanelSection('datos', document.querySelector('.sp-nav-item'));

            // === Cargar TODOS los datos del caso ===
            
            // Datos básicos del trabajador
            document.getElementById('sp-nombre').value = caso.nombre || '';
            document.getElementById('sp-cedula').value = caso.cedula || '';
            document.getElementById('sp-genero').value = caso.genero || '';
            document.getElementById('sp-tipo-evento').value = caso.tipo_evento || '';
            
            // Fechas personales
            if (caso.fecha_nacimiento) {
                try {
                    const fecha = new Date(caso.fecha_nacimiento);
                    if (!isNaN(fecha.getTime())) {
                        document.getElementById('sp-fecha-nacimiento').value = fecha.toISOString().split('T')[0];
                        this.calcularEdad();
                    }
                } catch (e) { console.warn('Error cargando fecha_nacimiento:', e); }
            }
            
            if (caso.fecha_ingreso) {
                try {
                    const fecha = new Date(caso.fecha_ingreso);
                    if (!isNaN(fecha.getTime())) {
                        document.getElementById('sp-fecha-ingreso').value = fecha.toISOString().split('T')[0];
                    }
                } catch (e) { console.warn('Error cargando fecha_ingreso:', e); }
            }
            
            // Información laboral
            document.getElementById('sp-cargo').value = caso.cargo || '';
            document.getElementById('sp-area').value = caso.sede_area || '';
            document.getElementById('sp-tipo-cargo').value = caso.tipo_cargo || '';
            document.getElementById('sp-tipo-contrato').value = caso.tipo_vinculacion || '';
            document.getElementById('sp-eps').value = caso.eps || '';
            document.getElementById('sp-afp').value = caso.afp || '';
            
            // Datos de salud
            document.getElementById('sp-peso').value = caso.peso || '';
            document.getElementById('sp-talla').value = caso.talla || '';
            document.getElementById('sp-imc').value = caso.imc || '';
            document.getElementById('sp-actividades-extralaborales').value = caso.actividades_extralaborales || '';

            // Calcular IMC si hay peso y talla
            if (caso.peso && caso.talla) {
                this.calcularIMC();
            }

            // === Datos de incapacidad ===
            if (caso.fecha_fin) {
                try {
                    const fecha = new Date(caso.fecha_fin);
                    if (!isNaN(fecha.getTime())) {
                        document.getElementById('sp-fecha-fin').value = fecha.toISOString().split('T')[0];
                    }
                } catch (e) { console.warn('Error cargando fecha_fin:', e); }
            }

            document.getElementById('sp-dias-acumulados').value = caso.dias_acumulados || '';
            document.getElementById('sp-codigo-cie10').value = caso.codigo_cie10 || '';
            document.getElementById('sp-descripcion-diagnostico').value = caso.diagnostico || '';

            // 📦 Actualizar el banner PRI ahora que el campo sp-caso-ingresado-pric ya tiene valor.
            // (Este campo se setea arriba en líneas previas; banner refleja el estado real del caso).
            this._actualizarBannerPRI();
            // 📦 Wizard: aplicar reglas (muchos condicionales solo si es PRI) y progreso.
            this._aplicarReglasRequeridos();
            this._actualizarProgresoSeccion();

            // 📦 Auto-completar desde BD de personal para campos que el Excel pudo no
            // tener guardados (ej: Área, AFP, Cargo, EPS). Usa la versión "if empty"
            // para no pisar nada que ya estuviera guardado en el Excel del caso.
            if (caso.cedula) {
                this._loadDatosEmpleado(String(caso.cedula).trim());
            }

            // Mostrar notificación
            this.showNotification(`✅ Caso cargado: ${caso.nombre} (Fila ${caso.fila})`, 'success');
            console.log('[CARGAR CASO SELECCIONADO] Datos cargados exitosamente');
            
            // Navegar a la sección de incapacidad para mostrar datos cargados
            setTimeout(() => {
                const navIncapacidad = document.querySelector('.sp-nav-item:nth-child(2)');
                if (navIncapacidad) {
                    this.showSeguimientoPanelSection('incapacidad', navIncapacidad);
                }
            }, 500);
        }, 300);
    }

    /**
     * Abre el panel de seguimiento con los datos de un empleado
     */
    abrirPanelSeguimientoConEmpleado(empleadoData) {
        console.log('[ABRIR PANEL] Abriendo panel para empleado:', empleadoData.nombre);

        // Crear el panel slideover si no existe
        if (!document.getElementById('seguimientoPanelBackdrop')) {
            this.createSeguimientoPanel();
        }

        // Cargar datos del empleado en el formulario
        if (empleadoData) {
            this.cargarDatosEnPanelSeguimiento(empleadoData);
        }

        // 📦 Autollenar Sección 2 (Incapacidad Temporal) desde la incapacidad que el
        // usuario seleccionó en el modal de "Agregar Seguimiento". Si no hay una
        // seleccionada, no hace nada (el usuario puede diligenciar a mano).
        if (this.incapacidadSeleccionada) {
            this._poblarSeccionIncapacidadDesdeSeleccion(this.incapacidadSeleccionada);
        }

        // Inicializar seguimientos
        this.inicializarSeguimientos();

        // 📦 Actualizar el banner PRI antes de mostrar el panel (caso nuevo: sin clasificar).
        this._actualizarBannerPRI();
        // 📦459 (2026-07-02) — Banner preventivo en Sección 2: si el archivo de
        // ausentismo no está disponible Y la Sección 2 quedó vacía tras autollenar,
        // mostramos un banner compacto amarillo. Caso contrario removemos cualquier
        // banner previo (porque los datos sí están disponibles ahora).
        this._actualizarBannerSeccion2Incapacidad();
        // 📦 Wizard: aplicar reglas de requeridos + actualizar progreso del footer.
        // (caso nuevo: la mayoría de campos estará vacía → borde rojo aparecerá)
        this._aplicarReglasRequeridos();
        this._actualizarProgresoSeccion();

        // Abrir el panel
        document.getElementById('seguimientoPanelBackdrop').classList.add('active');

        // Mostrar notificación
        this.showNotification(`Gestión de caso: ${empleadoData.nombre}`, 'info');
    }

    /**
     * Muestra una sección específica del panel
     */
    showSeguimientoPanelSection(sectionId, navElement) {
        // Ocultar todas las secciones
        document.querySelectorAll('.sp-form-section').forEach(el => el.classList.remove('active'));
        // Mostrar la sección seleccionada
        document.getElementById(`sp-section-${sectionId}`).classList.add('active');

        // Actualizar navegación
        document.querySelectorAll('.sp-nav-item').forEach(el => el.classList.remove('active'));
        navElement.classList.add('active');

        // 📦 Wizard: al cambiar de sección, re-aplicar reglas + actualizar progreso
        // + actualizar candados en las navs futuras.
        // (setTimeout para asegurar que el cambio de display ya surtió efecto.)
        setTimeout(() => {
            this._aplicarReglasRequeridos();
            this._actualizarProgresoSeccion();
            this._aplicarBloqueoStepNav();
        }, 0);
    }

    /**
     * 📦 Actualiza el banner PRI según el valor del campo "sp-caso-ingresado-pric".
     *
     * Reglas REORGANIZADAS para evitar el deadlock anterior:
     *  - "SI"  → banner verde; Calificación PCL habilitada.
     *  - "NO"  → banner amarillo; Calificación PCL atenuada (no aplica).
     *  - ""     → banner gris; Calificación PCL atenuada (mientras no defina).
     *
     * Importante: la sección "Etapas PRIC" NUNCA se atenúa. Su control de decisión
     * vive duplicado en el banner (botones contextuales) para que el usuario pueda
     * cambiar el modo sin tener que entrar a la sección ni depender de un
     * sub-bloque específico.
     */
    _actualizarBannerPRI() {
        const banner = document.getElementById('sp-pri-banner');
        const textEl = document.getElementById('sp-pri-banner-text');
        const actionsEl = document.getElementById('sp-pri-banner-actions');
        if (!banner || !textEl || !actionsEl) return;

        const secCalificacion = document.getElementById('sp-section-calificacion');
        const navItems = document.querySelectorAll('.sp-nav-item');
        const navCalificacion = navItems[4];

        const sel = document.getElementById('sp-caso-ingresado-pric');
        const fechaIngreso = document.getElementById('sp-fecha-ingreso-pric');
        const valor = sel ? (sel.value || '').toUpperCase() : '';

        // Limpiar estado anterior
        banner.classList.remove('is-pri', 'is-no-pri', 'is-unclassified');
        [secCalificacion, navCalificacion].forEach(el => {
            if (el) el.classList.remove('sp-section-dimmed', 'is-dimmed');
        });
        actionsEl.innerHTML = ''; // limpiar botones del estado previo

        if (valor === 'SI') {
            // Estado: Caso PRI formal
            banner.classList.add('is-pri');
            const fechaStr = fechaIngreso && fechaIngreso.value
                ? new Date(fechaIngreso.value + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'sin fecha registrada';
            textEl.innerHTML = '<strong>📋 Caso PRI Formal</strong>' +
                '<small>Ingreso al PRIC: ' + fechaStr + ' — Calificación PCL habilitada. Etapas PRIC siempre están disponibles.</small>';
            // Sin botones: ya está clasificado como PRI formal.
        } else if (valor === 'NO') {
            // Estado: Seguimiento explícito, no PRI formal
            banner.classList.add('is-no-pri');
            textEl.innerHTML = '<strong>⚠️ Seguimiento (no es caso PRI formal)</strong>' +
                '<small>Calificación PCL atenuada porque no aplica. Cambia a PRI formal si necesitas diligenciarla.</small>';
            // Ofrecer cambiar a PRI formal (un solo botón, evita clic accidental)
            actionsEl.innerHTML = '<button type="button" class="sp-pri-banner-btn is-ghost" onclick="window.medicAusentismoComponent._setModoPRI(\'SI\')">' +
                '<i class="fas fa-arrow-up"></i> Convertir en caso PRI formal</button>';
            // Atenuar Calificación PCL
            if (secCalificacion) secCalificacion.classList.add('sp-section-dimmed');
            if (navCalificacion) navCalificacion.classList.add('is-dimmed');
        } else {
            // Estado: Sin clasificar (campo vacío) — caso nuevo o recién abierto
            banner.classList.add('is-unclassified');
            textEl.innerHTML = '<strong>Sin clasificar aún</strong>' +
                '<small>Este caso aún no tiene definido si es un seguimiento simple o un caso PRI formal.</small>';
            // 2 botones: el usuario decide explícitamente
            actionsEl.innerHTML =
                '<button type="button" class="sp-pri-banner-btn is-pri" onclick="window.medicAusentismoComponent._setModoPRI(\'SI\')">' +
                '<i class="fas fa-check"></i> Marcar como PRI formal</button>' +
                '<button type="button" class="sp-pri-banner-btn is-no-pri" onclick="window.medicAusentismoComponent._setModoPRI(\'NO\')">' +
                '<i class="fas fa-stethoscope"></i> Solo seguimiento</button>';
            // Atenuar Calificación PCL (también bloqueada mientras no defina)
            if (secCalificacion) secCalificacion.classList.add('sp-section-dimmed');
            if (navCalificacion) navCalificacion.classList.add('is-dimmed');
        }
    }

    /**
     * 📦 Setea el modo PRI desde el banner (botones contextuales). Sincroniza el select
     * "sp-caso-ingresado-pric" para que el guardado en Excel use el valor correcto, y
     * dispara la actualización del banner (que a su vez ajusta Calificación PCL).
     *
     * Si el campo está vacío y se elige "SI" se autocompleta la fecha de ingreso al PRIC
     * con la fecha de hoy para no dejar el caso inconsistente.
     */
    _setModoPRI(modo) {
        const sel = document.getElementById('sp-caso-ingresado-pric');
        const fechaIngreso = document.getElementById('sp-fecha-ingreso-pric');
        if (!sel) return;

        sel.value = modo;
        // Si eligió PRI formal y no había fecha, proponer hoy.
        if (modo === 'SI' && fechaIngreso && !fechaIngreso.value) {
            const hoy = new Date();
            const yyyy = hoy.getFullYear();
            const mm = String(hoy.getMonth() + 1).padStart(2, '0');
            const dd = String(hoy.getDate()).padStart(2, '0');
            fechaIngreso.value = `${yyyy}-${mm}-${dd}`;
        }
        // Disparar change manualmente para que cualquier listener externo reaccione
        // y refrescar banner + atenuaciones.
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        this._actualizarBannerPRI();
        // Al cambiar el modo también cambian los campos requeridos.
        this._aplicarReglasRequeridos();
        this._actualizarProgresoSeccion();

        const etiquetas = { SI: 'caso PRI formal', NO: 'seguimiento simple' };
        this.showNotification('Modo actualizado: ' + (etiquetas[modo] || modo), 'success');
    }

    /**
     * 📦 Mapa de IDs de inputs/selects REQUERIDOS por sección.
     * Separamos lo que SIEMRE es obligatorio de lo que solo aplica a casos PRI formales.
     * Lo demás (peso, talla, AFP, salario, diagnósticos secundarios, etc.) queda libre.
     *
     * Notas:
     *  - "sp-nombre" y "sp-cedula" son autollenados, pero los dejamos en la lista por
     *    si alguien abre un caso huérfano sin datos del empleado.
     *  - "sp-caso-ingresado-pric" (Etapa 1) es SIEMPRE requerido para bloquear el flujo
     *    hasta que el usuario clasifique el caso (tema de la vueltita anterior).
     */
    _CAMPOS_REQUERIDOS_BASE = [
        // Sección 1 — Datos Generales
        'sp-nombre', 'sp-cedula', 'sp-genero', 'sp-cargo', 'sp-tipo-cargo',
        'sp-area', 'sp-fecha-ingreso', 'sp-tipo-evento', 'sp-tipo-contrato', 'sp-eps',
        // Sección 2 — Incapacidad Temporal
        'sp-fecha-inicio', 'sp-fecha-fin', 'sp-codigo-cie10', 'sp-descripcion-diagnostico',
        // Sección 3 — Etapas PRIC (Etapa 1 siempre)
        'sp-caso-ingresado-pric'
    ];
    _CAMPOS_REQUERIDOS_SOLO_PRI = [
        // Etapa 1 ampliada
        'sp-mecanismo-deteccion', 'sp-fecha-ingreso-pric',
        // Etapa 2 — Plan de Tratamiento
        'sp-trabajador-plan-tratamiento', 'sp-objetivos-tratamiento',
        'sp-fecha-inicio-plan', 'sp-fecha-probable-alta',
        // Etapa 3 — Ejecución y Seguimiento
        'sp-fecha-proxima-cita', 'sp-periodicidad-seguimiento',
        // Etapa 4 — Reincorporación
        'sp-fecha-reincorporacion', 'sp-tipo-reintegro',
        // Etapa 5 — Cierre
        'sp-fecha-cierre', 'sp-motivo-cierre',
        // Sección 5 — Calificación PCL
        'sp-estado-proceso-regional', 'sp-fecha-solicitud-regional'
    ];

    /**
     * 📦 IDs de inputs que NUNCA deben mostrar la marca visual is-empty (recuadro rojo +
     * icono) aunque estén vacíos. Son campos informativos/complementarios: si el caso
     * no aplica (ej: no hubo prórogas, no hay DX adicional), no tiene sentido alarmar
     * al usuario con un recuadro rojo de "obligatorio".
     *
     * Estos campos siguen siendo editables y pueden guardarse vacíos sin problema.
     * Solo se EXCLUYEN de la marca visual universal.
     *
     * Adicionalmente, _getCamposExcluidosVacios() amplía esta lista dinámicamente:
     *  - Si el caso NO es PRI formal, todos los _CAMPOS_REQUERIDOS_SOLO_PRI también
     *    se excluyen (porque "fuera de scope" = no aplica a este caso).
     *  - Si es PRI formal, esos campos SÍ muestran is-empty si están vacíos.
     */
    _CAMPOS_SIN_MARCA_VACIA = [
        // Sección 2 — Prórrogas: si el caso no tuvo prórogas, no debe alarmar.
        'sp-numero-prorrogas', 'sp-fecha-ultima-prorroga',
        // Sección 2 — Diagnósticos adicionales: opcionales (puede haber 1 solo DX).
        'sp-cie10-dx2', 'sp-origen-dx2', 'sp-cie10-dx3', 'sp-origen-dx3',
        // Sección 2 — Reincorporación / cierre del seguimiento de incapacidad:
        // todos opcionales porque solo aplican si el caso terminó.
        'sp-adaptaciones-inc', 'sp-fecha-reincorporacion-inc', 'sp-tipo-reintegro-inc',
        'sp-observaciones-finales-inc', 'sp-fecha-cierre-inc', 'sp-motivo-cierre-inc',
        // Sección 3 — Etapas PRIC: campos informativos y Etapa 5 ampliada.
        'sp-adaptaciones', 'sp-tiene-desercion', 'sp-logro-mejoria-medica',
        'sp-anio-ultima-calificacion-pcl', 'sp-anio-seguimiento-empresa',
        'sp-fecha-calificacion-pcl', 'sp-porcentaje-pcl-calificacion',
        'sp-cie10-dx1-calificada', 'sp-origen-dx1',
        'sp-cie10-dx2-calificada', 'sp-origen-dx2-calificada',
        'sp-cie10-dx3-calificada', 'sp-origen-dx3-calificada',
        'sp-cie10-dx4-calificada', 'sp-origen-dx4-calificada',
        'sp-origen-caso', 'sp-ingreso-sve',
        'sp-fecha-examen-medico', 'sp-resultado-examen-medico',
        'sp-fecha-examen-periodico', 'sp-resultado-examen-post-incapacidad',
        'sp-trabajador-remoto', 'sp-fecha-inicio-remoto',
        'sp-fecha-ultimo-seguimiento', 'sp-evolucion-clinica', 'sp-adherencia',
        'sp-fecha-reintegro', 'sp-recomendaciones-laborales',
        'sp-fecha-vencimiento-recomendaciones', 'sp-descripcion-recomendaciones',
        'sp-fecha-proximo-seguimiento-recomendaciones',
        'sp-descripcion-seguimiento-1', 'sp-descripcion-seguimiento-2'
        // Los campos de seguimiento "Fecha seguimiento 1/2" también se excluyen porque
        // ya hay un control de "Agregar Seguimiento" para crear filas dedicadas.
    ];

    /**
     * 📦 Devuelve el Set de IDs que deben EXCLUIRSE del recuadro rojo universal.
     * Combina:
     *  - _CAMPOS_SIN_MARCA_VACIA (lista base: prórogas, DX adicionales, etc.)
     *  - Si el modo PRI es != 'SI', también se excluyen los _CAMPOS_REQUERIDOS_SOLO_PRI
     *    (porque las Etapas 2-5 y Calificación PCL están fuera de scope).
     *
     * Devolver un Set permite la búsqueda O(1) en loops grandes.
     */
    _getCamposExcluidosVacios() {
        const excluidos = new Set(this._CAMPOS_SIN_MARCA_VACIA);
        const sel = document.getElementById('sp-caso-ingresado-pric');
        const modo = sel ? (sel.value || '').toUpperCase() : '';
        if (modo !== 'SI') {
            // El resto del formulario (Etapas 2-5 + Calificación PCL) NO aplica
            // si el caso no es PRI formal — no debe alarmar con recuadro rojo.
            this._CAMPOS_REQUERIDOS_SOLO_PRI.forEach(id => excluidos.add(id));
        }
        return excluidos;
    }

    /**
     * 📦 Aplica data-required="true" según el modo PRI del caso.
     *  - Campos _CAMPOS_REQUERIDOS_BASE siempre quedan marcados.
     *  - Campos _CAMPOS_REQUERIDOS_SOLO_PRI solo se marcan si el caso es PRI formal.
     *  - Campos no listados quedan libres (sin validación).
     */
    _aplicarReglasRequeridos() {
        // Quitar todas las marcas previas (atributo + asterisco rojo en label)
        document.querySelectorAll('.sp-form-control[data-required="true"]').forEach(el => {
            el.removeAttribute('data-required');
        });
        document.querySelectorAll('.sp-form-label[data-required-mark="true"]').forEach(el => {
            el.removeAttribute('data-required-mark');
        });

        const aplicar = (id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.setAttribute('data-required', 'true');
            // Marcar el label hermano con asterisco rojo via CSS ::after
            const group = el.closest('.sp-form-group');
            if (group) {
                const label = group.querySelector('.sp-form-label');
                if (label) label.setAttribute('data-required-mark', 'true');
            }
        };

        // Restaurar los base (siempre)
        this._CAMPOS_REQUERIDOS_BASE.forEach(aplicar);

        // Condicionales: solo si el caso es PRI formal
        const sel = document.getElementById('sp-caso-ingresado-pric');
        if (sel && (sel.value || '').toUpperCase() === 'SI') {
            this._CAMPOS_REQUERIDOS_SOLO_PRI.forEach(aplicar);
        }
    }

    /**
     * 📦 Determina si un input/select está "vacío" para efectos de validación.
     * Trata "Seleccione..." (placeholder de los selects) como vacío.
     */
    _esCampoVacio(el) {
        if (!el || el.disabled || el.readOnly) return false;
        const val = (el.value || '').trim();
        if (!val) return true;
        // En los <select> el primer <option> tiene value="" y texto "Seleccione..."
        if (el.tagName === 'SELECT' && el.selectedIndex === 0) return true;
        return false;
    }

    /**
     * 📦 Valida la sección actualmente visible. Aplica el recuadro rojo universal
     * (is-empty) a TODO control vacío de la sección, cuente o no como obligatorio.
     * Para la lógica de "bloqueo de Siguiente" sólo considera los [data-required="true"]
     * vacíos.
     * Retorna { valido, vacios: [{ el, nombre }], total }.
     */
    _validarSeccionActual() {
        const section = document.querySelector('.sp-form-section.active');
        if (!section) return { valido: true, vacios: [], total: 0 };

        // 1) Marca universal is-empty en TODOS los .sp-form-control EXCEPTO los que están
        // excluidos (lista base + dinámica según modo PRI).
        const excluidos = this._getCamposExcluidosVacios();
        const todos = section.querySelectorAll('.sp-form-control');
        todos.forEach(el => {
            if (excluidos.has(el.id)) {
                el.classList.remove('is-empty');
                return;
            }
            if (this._esCampoVacio(el)) el.classList.add('is-empty');
            else el.classList.remove('is-empty');
        });

        // 2) Lista de campos OBLIGATORIOS vacíos (los que bloquean "Siguiente")
        const requeridos = section.querySelectorAll('.sp-form-control[data-required="true"]');
        const vacios = [];
        const total = requeridos.length;

        requeridos.forEach(el => {
            const nombre = this._nombreAmigableDeCampo(el) || el.id;
            if (this._esCampoVacio(el)) {
                vacios.push({ el: el, nombre: nombre });
            }
        });

        // Actualizar el contador visible en el section-title de la sección activa
        this._actualizarContadorSeccion(section, total - vacios.length, total);

        return { valido: vacios.length === 0, vacios, total };
    }

    /**
     * 📦 Devuelve un nombre legible del campo para mensajes de error, p. ej.
     * "sp-tipo-evento" → "Tipo de evento", "sp-codigo-cie10" → "Código CIE10".
     */
    _nombreAmigableDeCampo(el) {
        // Buscar el label asociado (estructura: div.sp-form-group > label + input)
        const group = el.closest('.sp-form-group');
        if (group) {
            const label = group.querySelector('.sp-form-label');
            if (label) return label.textContent.trim();
        }
        return el.id;
    }

    /**
     * 📦 Inserta/actualiza el contador de completitud en el section-title.
     *   - Cuando todos los campos requeridos están diligenciados: badge verde "✓ X/X".
     *   - Cuando faltan: badge rojo "⚠ X/Y".
     *   - Cuando no hay campos requeridos: badge gris "○ libre".
     */
    _actualizarContadorSeccion(section, diligenciados, total) {
        if (!section) return;
        const title = section.querySelector('.sp-section-title');
        if (!title) return;

        let badge = title.querySelector('.sp-section-completitud');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'sp-section-completitud';
            title.appendChild(badge);
        }

        if (total === 0) {
            badge.classList.remove('is-complete', 'is-incomplete');
            badge.textContent = '○ sin campos obligatorios';
            return;
        }

        if (diligenciados === total) {
            badge.classList.add('is-complete');
            badge.classList.remove('is-incomplete');
            badge.textContent = '✓ ' + diligenciados + '/' + total + ' completos';
        } else {
            badge.classList.add('is-incomplete');
            badge.classList.remove('is-complete');
            badge.textContent = '⚠ ' + diligenciados + '/' + total + ' pendientes';
        }
    }

    /**
     * 📦 Engancha listeners live (blur + change + input) en cada input/select con
     * data-required="true". Cada vez que el usuario sale del campo o cambia su valor,
     * se re-valida la sección y se actualiza el contador. Se llama una sola vez al
     * crear el panel; los nuevos data-required se enganchan dinámicamente vía
     * delegación escuchando el DOM completo.
     */
    _setupListenersValidacion() {
        const handler = (e) => {
            const t = e.target;
            if (!t || !t.classList || !t.classList.contains('sp-form-control')) return;
            // Saltar campos excluidos (lista dinámica: base + modo PRI).
            // Recalculamos la exclusión cada vez porque el modo PRI puede cambiar.
            if (this._getCamposExcluidosVacios().has(t.id)) {
                t.classList.remove('is-empty');
                this._actualizarProgresoSeccion();
                return;
            }
            // Marca universal is-empty (aplica a TODO control que NO esté excluido)
            if (this._esCampoVacio(t)) t.classList.add('is-empty');
            else t.classList.remove('is-empty');
            // Actualizar contador del footer + progreso
            this._actualizarProgresoSeccion();
        };
        // Capturamos los eventos a nivel del panel (delegación)
        const panel = document.querySelector('.seguimiento-panel');
        if (!panel) return;
        panel.addEventListener('blur', handler, true);
        panel.addEventListener('change', handler, true);
        panel.addEventListener('input', handler, true);
    }

    /**
     * 📦 Actualiza el contador del footer (X/Y completados de la SECCIÓN ACTUAL).
     * También deshabilita el botón "Siguiente" si la sección actual está incompleta.
     */
    _actualizarProgresoSeccion() {
        const r = this._validarSeccionActual();
        const cur = document.getElementById('sp-panel-progress-current');
        const total = document.getElementById('sp-panel-progress-total');
        const txt = document.getElementById('sp-panel-progress-text');
        const btnNext = document.getElementById('sp-btn-next');
        const btnPrev = document.getElementById('sp-btn-prev');

        if (cur && total && txt) {
            // Calcular índice de la sección actual
            const sections = Array.from(document.querySelectorAll('.sp-form-section'));
            const idx = sections.findIndex(s => s.classList.contains('active'));
            cur.textContent = String(idx >= 0 ? idx + 1 : 1);
            total.textContent = String(sections.length);
            const dilig = r.total === 0 ? 'libre' : (r.total - r.vacios.length) + '/' + r.total;
            txt.textContent = (r.total === 0 ? 'Sin campos obligatorios' : dilig + ' campos diligenciados');
        }
        if (btnNext) {
            // El botón siempre se puede pulsar; al hacer click se valida y se muestra error.
            // Solo lo deshabilitamos si NO hay sección siguiente (última sección).
            const sections = Array.from(document.querySelectorAll('.sp-form-section'));
            const idx = sections.findIndex(s => s.classList.contains('active'));
            btnNext.disabled = idx < 0 || idx >= sections.length - 1;
        }
        if (btnPrev) {
            const sections = Array.from(document.querySelectorAll('.sp-form-section'));
            const idx = sections.findIndex(s => s.classList.contains('active'));
            btnPrev.disabled = idx <= 0;
        }
    }

    /**
     * 📦 Wizard: intenta avanzar a la siguiente sección. Si la actual tiene campos
     * requeridos vacíos, los marca con borde rojo, hace focus al primero y muestra
     * un toast de error con conteo. Si todo OK, navega a la siguiente.
     */
    _irASiguienteSeccion() {
        const r = this._validarSeccionActual();
        if (!r.valido) {
            // Mostrar toast con conteo y nombres de los primeros 3 campos.
            const nombres = r.vacios.slice(0, 3).map(v => v.nombre).join(', ');
            const extra = r.vacios.length > 3 ? ` y ${r.vacios.length - 3} más` : '';
            this.showNotification(
                `Tienes ${r.vacios.length} campo(s) por diligenciar: ${nombres}${extra}`,
                'error', 6000
            );
            // Focus + scroll al primer campo vacío
            const primero = r.vacios[0];
            if (primero && primero.el) {
                try {
                    primero.el.focus({ preventScroll: false });
                } catch (e) {
                    primero.el.focus();
                }
                primero.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }

        // Avanzar a la siguiente sección visible y habilitada
        const sections = Array.from(document.querySelectorAll('.sp-form-section'));
        const idx = sections.findIndex(s => s.classList.contains('active'));
        if (idx < 0 || idx >= sections.length - 1) return true;
        const nextSection = sections[idx + 1];
        const sectionId = nextSection.id.replace(/^sp-section-/, '');
        // Saltarse la sección Calificación si está atenuada (no aplica al caso).
        if (sectionId === 'calificacion' && nextSection.classList.contains('sp-section-dimmed')) {
            // Si la calificación está atenuada, saltarla e ir a la anterior ya está cubierta
            // al volver; aquí el flujo natural lleva al usuario al final del wizard.
            // Igual navegamos porque la atenuación no la hace desaparecer del DOM.
        }
        const navItems = document.querySelectorAll('.sp-nav-item');
        const targetNav = navItems[idx + 1];
        if (targetNav) {
            this.showSeguimientoPanelSection(sectionId, targetNav);
            this._actualizarProgresoSeccion();
            // Scroll al top del panel
            const contentArea = document.querySelector('.sp-content-area');
            if (contentArea) contentArea.scrollTop = 0;
        }
        return true;
    }

    /**
     * 📦 Wizard: ir a la sección anterior. Sin validación dura (porque ya llenamos
     * la sección en la que estamos); solo navega.
     */
    _irASeccionAnterior() {
        const sections = Array.from(document.querySelectorAll('.sp-form-section'));
        const idx = sections.findIndex(s => s.classList.contains('active'));
        if (idx <= 0) return;
        const prevSection = sections[idx - 1];
        const sectionId = prevSection.id.replace(/^sp-section-/, '');
        const navItems = document.querySelectorAll('.sp-nav-item');
        const targetNav = navItems[idx - 1];
        if (targetNav) {
            this.showSeguimientoPanelSection(sectionId, targetNav);
            this._actualizarProgresoSeccion();
            const contentArea = document.querySelector('.sp-content-area');
            if (contentArea) contentArea.scrollTop = 0;
        }
    }

    /**
     * 📦 Wizard: handler único para clicks en las nav-tabs. Valida si la sección
     * destino está desbloqueada y, si no, aborta con un toast claro.
     *
     * Reglas:
     *  - idx destino <= idx actual → permitido (atrás o misma).
     *  - idx destino === idx actual + 1 → permitido SOLO si la sección actual pasa
     *    _validarSeccionActual(); si falla, muestra toast y hace focus al 1er vacío.
     *  - idx destino > idx actual + 1 → NO permitido. Toast: "completa las secciones
     *    intermedias primero". El usuario DEBE ir paso a paso con "Siguiente".
     */
    _intentarNavegarANavItem(navEl, sectionId) {
        const sections = Array.from(document.querySelectorAll('.sp-form-section'));
        const targetIdx = sections.findIndex(s => s.id === `sp-section-${sectionId}`);
        const idxActual = sections.findIndex(s => s.classList.contains('active'));
        if (targetIdx < 0 || idxActual < 0) return;

        // Click en la misma sección: no hacer nada
        if (targetIdx === idxActual) return;

        // Click atrás: siempre permitido
        if (targetIdx < idxActual) {
            this.showSeguimientoPanelSection(sectionId, navEl);
            this._actualizarProgresoSeccion();
            const contentArea = document.querySelector('.sp-content-area');
            if (contentArea) contentArea.scrollTop = 0;
            return;
        }

        // Click 1 adelante: exigir validación
        if (targetIdx === idxActual + 1) {
            const r = this._validarSeccionActual();
            if (!r.valido) {
                const nombres = r.vacios.slice(0, 3).map(v => v.nombre).join(', ');
                const extra = r.vacios.length > 3 ? ` y ${r.vacios.length - 3} más` : '';
                this.showNotification(
                    `Completa los ${r.vacios.length} campo(s) pendiente(s) en esta sección antes de avanzar: ${nombres}${extra}`,
                    'error', 6000
                );
                const primero = r.vacios[0];
                if (primero && primero.el) {
                    try { primero.el.focus({ preventScroll: false }); } catch (e) { primero.el.focus(); }
                    primero.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }
            // OK: navegar
            this.showSeguimientoPanelSection(sectionId, navEl);
            this._actualizarProgresoSeccion();
            const contentArea = document.querySelector('.sp-content-area');
            if (contentArea) contentArea.scrollTop = 0;
            return;
        }

        // Click más adelante (salto): bloquear
        const restantes = targetIdx - idxActual;
        const palabra = restantes === 1 ? 'sección' : 'secciones';
        this.showNotification(
            `Debes avanzar paso a paso. Completa las ${restantes} ${palabra} intermedia(s) usando el botón "Siguiente" antes de saltar a "${sectionId}".`,
            'warning', 5000
        );
    }

    /**
     * 📦 Aplica el candado visual a las navs futuras: idx > idxActual+1 se marcan
     * como is-locked-step (con candado y pointer-events:none).
     *
     * La nav INMEDIATAMENTE SIGUIENTE a la actual se desbloquea visualmente en cuanto
     * la sección actual cumple validación (todos los requeridos diligenciados). Eso
     * da una pista visual de "ya podés pasar" sin permitir saltos (para saltar sigue
     * siendo obligatorio usar el botón "Siguiente" o click directo sobre esa nav
     * ya desbloqueada).
     *
     * Si la sección actual NO cumple, todas las navs desde idxActual+1 en adelante
     * quedan bloqueadas (incluida la inmediata siguiente).
     *
     * Se llama automáticamente desde showSeguimientoPanelSection y desde los handlers
     * de validación live.
     */
    _aplicarBloqueoStepNav() {
        const sections = Array.from(document.querySelectorAll('.sp-form-section'));
        const idxActual = sections.findIndex(s => s.classList.contains('active'));
        if (idxActual < 0) return;

        // Chequear si la sección actual cumple validación
        const r = this._validarSeccionActual();
        // Umbral de desbloqueo visual: si la actual cumple, idxActual+1 está libre.
        // Si no, todas desde idxActual+1 quedan bloqueadas.
        const primerIdxDesbloqueado = r.valido ? idxActual + 2 : idxActual + 1;

        const navItems = document.querySelectorAll('.sp-nav-item');
        navItems.forEach((nav, i) => {
            if (i >= primerIdxDesbloqueado) {
                // Bloqueada
                nav.classList.add('is-locked-step');
                if (!nav.querySelector('.sp-nav-lock-icon')) {
                    const icon = document.createElement('i');
                    icon.className = 'fas fa-lock sp-nav-lock-icon';
                    nav.appendChild(icon);
                }
                if (!nav.getAttribute('title')) {
                    nav.setAttribute('title',
                        r.valido
                            ? 'Completa las secciones intermedias usando "Siguiente" antes de saltar acá'
                            : 'Completa esta sección y haz clic en "Siguiente" para desbloquear'
                    );
                }
            } else {
                // Libre
                nav.classList.remove('is-locked-step');
                const icon = nav.querySelector('.sp-nav-lock-icon');
                if (icon) icon.remove();
                if (nav.getAttribute('title') && nav.getAttribute('title').indexOf('desbloquear') >= 0) {
                    nav.removeAttribute('title');
                }
            }
        });
    }

    /**
     * Calcula la edad automáticamente desde la fecha de nacimiento
     */
    calcularEdad() {
        const fechaNacimientoInput = document.getElementById('sp-fecha-nacimiento');
        const edadInput = document.getElementById('sp-edad');

        if (!fechaNacimientoInput?.value || !edadInput) return;

        const fechaNacimiento = new Date(fechaNacimientoInput.value);
        const hoy = new Date();

        let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
        const mesDiferencia = hoy.getMonth() - fechaNacimiento.getMonth();

        // Ajustar si aún no ha cumplido años este año
        if (mesDiferencia < 0 || (mesDiferencia === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
            edad--;
        }

        edadInput.value = edad >= 0 ? edad : 0;
        console.log('[SEGUIMIENTO] Edad calculada:', edad, 'años');
    }

    /**
     * Calcula la antigüedad automáticamente desde la fecha de ingreso
     */
    calcularAntiguedad() {
        const fechaIngresoInput = document.getElementById('sp-fecha-ingreso');
        const antiguedadInput = document.getElementById('sp-antiguedad');

        if (!fechaIngresoInput?.value || !antiguedadInput) return;

        const fechaIngreso = new Date(fechaIngresoInput.value);
        const hoy = new Date();

        // [📦455 v4] Calcular meses totales desde la fecha de ingreso hasta hoy.
        // (anios * 12) + meses_transcurridos, ajustando si el dia del mes actual
        // es menor al dia del mes de ingreso (aun no cumplio el mes completo).
        let mesesTotales = (hoy.getFullYear() - fechaIngreso.getFullYear()) * 12
            + (hoy.getMonth() - fechaIngreso.getMonth());

        if (hoy.getDate() < fechaIngreso.getDate()) {
            mesesTotales--;
        }

        antiguedadInput.value = mesesTotales >= 0 ? mesesTotales : 0;
        console.log('[SEGUIMIENTO] Antigüedad calculada:', mesesTotales, 'meses');
    }

    /**
     * Calcula los días acumulados automáticamente desde fecha de inicio y fin de incapacidad
     */
    calcularDiasAcumulados() {
        const fechaInicioInput = document.getElementById('sp-fecha-inicio');
        const fechaFinInput = document.getElementById('sp-fecha-fin');
        const diasInput = document.getElementById('sp-dias-acumulados');

        if (!fechaInicioInput?.value || !fechaFinInput?.value || !diasInput) return;

        const fechaInicio = new Date(fechaInicioInput.value);
        const fechaFin = new Date(fechaFinInput.value);

        // Calcular diferencia en días (inclusive)
        const diffTime = Math.abs(fechaFin - fechaInicio);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        diasInput.value = diffDays > 0 ? diffDays : 0;
        console.log('[SEGUIMIENTO] Días acumulados calculados:', diffDays);
    }

    /**
     * Calcula el IMC automáticamente desde peso y talla (en cm)
     */
    calcularIMC() {
        const pesoInput = document.getElementById('sp-peso');
        const tallaInput = document.getElementById('sp-talla');
        const imcInput = document.getElementById('sp-imc');
        const estadoDiv = document.getElementById('sp-imc-estado');
        
        if (!pesoInput?.value || !tallaInput?.value || !imcInput) return;
        
        const peso = parseFloat(pesoInput.value);
        const tallaCm = parseFloat(tallaInput.value);
        
        if (peso > 0 && tallaCm > 0) {
            // Convertir cm a metros para el cálculo
            const tallaMt = tallaCm / 100;
            const imc = peso / (tallaMt * tallaMt);
            imcInput.value = imc.toFixed(2);
            
            // Determinar categoría de IMC con colores
            let categoria = '';
            let color = '';
            let mensaje = '';
            
            if (imc < 18.5) {
                categoria = 'Bajo peso';
                color = '#FFA500'; // Naranja
                mensaje = '⚠️ Bajo peso - Consultar nutricionista';
            } else if (imc < 25) {
                categoria = 'Normal';
                color = '#28a745'; // Verde
                mensaje = '✅ Peso saludable - ¡Excelente!';
            } else if (imc < 30) {
                categoria = 'Sobrepeso';
                color = '#FFA500'; // Naranja
                mensaje = '⚠️ Sobrepeso - Considerar dieta y ejercicio';
            } else if (imc < 35) {
                categoria = 'Obesidad Tipo I';
                color = '#dc3545'; // Rojo
                mensaje = '🔴 Obesidad Tipo I - Consultar médico';
            } else if (imc < 40) {
                categoria = 'Obesidad Tipo II';
                color = '#dc3545'; // Rojo
                mensaje = '🔴 Obesidad Tipo II - Atención médica requerida';
            } else {
                categoria = 'Obesidad Tipo III';
                color = '#721c24'; // Rojo oscuro
                mensaje = '🚨 Obesidad Tipo III - Atención médica urgente';
            }
            
            // Mostrar estado con estilo
            estadoDiv.style.display = 'block';
            estadoDiv.style.backgroundColor = color + '20'; // 20% opacity
            estadoDiv.style.color = color;
            estadoDiv.style.border = `2px solid ${color}`;
            estadoDiv.textContent = `${categoria} (IMC: ${imc.toFixed(2)}) - ${mensaje}`;
            
            console.log('[SEGUIMIENTO] IMC calculado:', imc.toFixed(2), '-', categoria);
        } else {
            imcInput.value = '';
            estadoDiv.style.display = 'none';
        }
    }

    /**
     * Carga los datos del empleado en el panel
     */
    cargarDatosEnPanelSeguimiento(empleadoData) {
        // empleadoData tiene estructura: {nombre, cedula, incapacidades: [...], cargo, departamento, genero, etc.}

        console.log('[SEGUIMIENTO][PANEL] Cargando datos del empleado:', empleadoData.nombre);
        console.log('[SEGUIMIENTO][PANEL] Total incapacidades recibidas:', empleadoData.incapacidades?.length || 0);

        // Datos básicos del trabajador (SOLO nombre y cédula, lo demás vacío para caso nuevo)
        document.getElementById('sp-nombre').value = empleadoData.nombre || '';
        document.getElementById('sp-cedula').value = empleadoData.cedula || '';

        // [📦455 2026-07-01 v3] Auto-completar cargo, area, fecha ingreso, salario
        // y fecha de nacimiento desde BD de personal ASEL. Misma fuente que usa
        // Consulta de Trabajadores. Llamada async que no bloquea el modal.
        this._loadDatosEmpleado(empleadoData.cedula);

        // Los demás campos se dejan VACÍOS para que el usuario los diligencie manualmente
        document.getElementById('sp-genero').value = '';
        document.getElementById('sp-cargo').value = '';
        document.getElementById('sp-area').value = '';
        document.getElementById('sp-eps').value = '';
        document.getElementById('sp-fecha-nacimiento').value = '';
        document.getElementById('sp-fecha-ingreso').value = '';
        document.getElementById('sp-edad').value = '';
        document.getElementById('sp-antiguedad').value = '';
        document.getElementById('sp-tipo-evento').value = '';
        document.getElementById('sp-tipo-contrato').value = '';
        document.getElementById('sp-salario').value = '';
        document.getElementById('sp-afp').value = '';
        document.getElementById('sp-peso').value = '';
        document.getElementById('sp-talla').value = '';
        document.getElementById('sp-imc').value = '';
        document.getElementById('sp-dominancia').value = '';
        document.getElementById('sp-actividades-extralaborales').value = '';

        // Campos de incapacidad vacíos
        document.getElementById('sp-fecha-inicio').value = '';
        document.getElementById('sp-fecha-fin').value = '';
        document.getElementById('sp-dias-acumulados').value = '';
        document.getElementById('sp-codigo-cie10').value = '';
        document.getElementById('sp-descripcion-diagnostico').value = '';
        document.getElementById('sp-numero-prorrogas').value = '';
        document.getElementById('sp-fecha-ultima-prorroga').value = '';
        document.getElementById('sp-cie10-dx2').value = '';
        document.getElementById('sp-origen-dx2').value = '';
        document.getElementById('sp-cie10-dx3').value = '';
        document.getElementById('sp-origen-dx3').value = '';

        // 🆕 Campos de Condiciones de Salud vacíos
        document.getElementById('sp-fecha-examen-medico').value = '';
        document.getElementById('sp-resultado-examen-medico').value = '';
        document.getElementById('sp-fecha-examen-periodico').value = '';
        document.getElementById('sp-resultado-examen-post-incapacidad').value = '';
        document.getElementById('sp-trabajador-remoto').value = '';
        document.getElementById('sp-fecha-inicio-remoto').value = '';

        console.log('[SEGUIMIENTO][PANEL] Panel vacío para nuevo caso - solo nombre y cédula precargados');
    }

    /**
     * [📦455 2026-07-01 v2] Auto-completar Fecha de Nacimiento desde BD de personal ASEL/Temporales.
     * Usa el mismo endpoint que Consulta de Trabajadores (consultarTrabajadoresGlobal)
     * con la misma robustez de parseo que formatearFecha() de ese modulo: maneja
     * Date objects, strings ISO, strings dd/mm/yyyy y Excel serial numbers.
     *
     * Race-safe: si el usuario cambia de empleado antes de que llegue la respuesta,
     * el token comparativo descarta el resultado obsoleto.
     */
    async _loadDatosEmpleado(cedula) {
        if (!cedula) return;
        // Token anti-race: descarta respuestas tardias si el usuario ya cambio de empleado.
        this._datosEmpToken = (this._datosEmpToken || 0) + 1;
        const myToken = this._datosEmpToken;
        try {
            if (!window.electronAPI || typeof window.electronAPI.consultarTrabajadoresGlobal !== 'function') {
                return;
            }
            const result = await window.electronAPI.consultarTrabajadoresGlobal({
                cedula: String(cedula).trim(),
                nombre: '',
                empresa: 'all'
            });
            // Si el usuario ya selecciono otro empleado, descartar.
            if (myToken !== this._datosEmpToken) return;
            if (!result || !result.success || !Array.isArray(result.data) || result.data.length === 0) {
                return;
            }
            // Preferir registro ASEL (BD de personal); caer a cualquier resultado si no hay.
            const trab = result.data.find(t => t.tipoBD === 'ASEL') || result.data[0];

            // Cargo Actual
            this._setInputValueIfEmpty('sp-cargo', trab.cargo);

            // Area / Dependencia (algunas BDs usan 'departamento', otras 'ubicacion')
            this._setInputValueIfEmpty('sp-area', trab.departamento || trab.ubicacion);

            // EPS y AFP (datos utiles que normalmente faltan)
            this._setInputValueIfEmpty('sp-eps', trab.eps);
            this._setInputValueIfEmpty('sp-afp', trab.afp);

            // Fecha de Ingreso: usar el parser robusto. Solo autollenar si el input está
            // vacío (para no pisar lo que ya tenía guardado en el Excel del caso).
            const fechaIngRaw = trab.fechaIngreso || trab.fecIng || trab.fecha_ingreso || '';
            const fechaIng = this._parsearFechaNacimiento(fechaIngRaw);
            const inputFechaIng = document.getElementById('sp-fecha-ingreso');
            if (fechaIng && inputFechaIng && !String(inputFechaIng.value || '').trim()) {
                inputFechaIng.value = fechaIng.toISOString().split('T')[0];
                this.calcularAntiguedad();
            }

            // Salario: limpiar simbolos y separadores antes de asignar a input type=number.
            // El backend puede enviarlo como '$ 1.500.000' o '1500000' o 'No disponible'.
            // Aceptar salario >= 0 (incluyendo 0 real) y descartar solo si
            // la BD devuelve null, vacio, "No disponible", "n/a" o "na".
            // Solo autollenar si el input está vacío.
            const salarioRaw = trab.salario;
            const salarioStr = salarioRaw == null ? '' : String(salarioRaw).trim();
            const salarioLower = salarioStr.toLowerCase();
            const inputSalario = document.getElementById('sp-salario');

            if (salarioStr === '' || salarioLower === 'no disponible' || salarioLower === 'n/a' || salarioLower === 'na') {
                // No hay salario real en la BD: dejar el input vacio.
            } else if (inputSalario && !String(inputSalario.value || '').trim()) {
                const salNum = parseFloat(salarioStr.replace(/[^\d.-]/g, ''));
                if (!isNaN(salNum) && salNum >= 0) {
                    inputSalario.value = salNum;
                }
            }

            // Fecha de Nacimiento: misma logica que antes (mantener compatibilidad).
            // Solo autollenar si el input está vacío.
            const fechaNacRaw = trab.fechaNacimiento || trab.fecNac || trab.fecha_nacimiento || '';
            const fechaNac = this._parsearFechaNacimiento(fechaNacRaw);
            const inputFechaNac = document.getElementById('sp-fecha-nacimiento');
            if (fechaNac && inputFechaNac && !String(inputFechaNac.value || '').trim()) {
                inputFechaNac.value = fechaNac.toISOString().split('T')[0];
                this.calcularEdad();
            }

            console.log('[SEGUIMIENTO] Datos del empleado auto-cargados:', JSON.stringify({
                cargo: !!trab.cargo,
                area: !!(trab.departamento || trab.ubicacion),
                fechaIngRaw: fechaIngRaw,
                salario_raw: trab.salario,
                salario_tipo: typeof trab.salario,
                fechaNac: !!fechaNac
            }));
        } catch (err) {
            // Silencioso: si falla la BD, el usuario puede digitar manualmente.
            if (myToken !== this._datosEmpToken) return;
            console.log('[SEGUIMIENTO] No se pudieron auto-cargar datos del empleado:', err && err.message ? err.message : err);
        }
    }

    /**
     * [📦455 v3] Helper simple: setea .value en un input por id, solo si el valor es
     * truthy y el input existe. Usado por _loadDatosEmpleado.
     */
    _setInputValue(id, value) {
        if (value == null || value === '') return;
        const el = document.getElementById(id);
        if (el) el.value = String(value);
    }

    /**
     * 📦 Puebla los campos de la sección "Incapacidad Temporal" con los datos de la
     * incapacidad que el usuario seleccionó en el modal de selección.
     *
     * Las fechas pueden venir como:
     *  - string ISO 'yyyy-mm-dd'
     *  - string 'd/m/yy' (formato corto del Excel legacy)
     *  - Date object (cuando vienen del preview del modal)
     *  - string YYYYMMDD sin separador
     *
     * El método reusa _parsearFechaNacimiento (mismo parser robusto que se usa
     * para fecha de nacimiento del empleado desde la BD de personal).
     */
    _poblarSeccionIncapacidadDesdeSeleccion(sel) {
        if (!sel) return;

        // Fechas
        const setFecha = (inputId, raw) => {
            const el = document.getElementById(inputId);
            if (!el || !raw) return;
            const d = this._parsearFechaNacimiento(raw);
            if (d && !isNaN(d.getTime())) {
                el.value = d.toISOString().split('T')[0];
            }
        };
        setFecha('sp-fecha-inicio', sel.fechaInicio);
        setFecha('sp-fecha-fin', sel.fechaFin);

        // Días acumulados: usar el dato si viene como número, si no recalcular
        const elDias = document.getElementById('sp-dias-acumulados');
        if (elDias && sel.dias != null && sel.dias !== '') {
            const d = parseInt(String(sel.dias), 10);
            if (!isNaN(d) && d > 0) elDias.value = d;
        }
        // Si no vino en dias y tenemos fechas válidas, recalcular
        if (elDias && (!elDias.value || elDias.value === '')) {
            const fi = document.getElementById('sp-fecha-inicio').value;
            const ff = document.getElementById('sp-fecha-fin').value;
            if (fi && ff) {
                try {
                    const diff = (new Date(ff) - new Date(fi)) / (1000 * 60 * 60 * 24);
                    if (diff >= 0) elDias.value = Math.ceil(diff) + 1;
                } catch (e) { /* silencioso */ }
            }
        }

        // Diagnóstico
        this._setInputValue('sp-codigo-cie10', sel.codigo);
        this._setInputValue('sp-descripcion-diagnostico', sel.diagnostico);

        console.log('[INCAPACIDAD AUTOLLENADA] sección 2 poblada desde selección:', sel);
    }

    /**
     * 📦459 (2026-07-02) — Plan B: banner preventivo en Sección 2 del wizard.
     *
     * Decisión de mostrar banner:
     *   - Si `this.ausentismoFileStatus.missing === true` Y la Sección 2 quedó
     *     vacía (fecha inicio + fin + días + diagnóstico) → banner amarillo
     *     compacto: "No pude autollenar la incapacidad — el archivo PI-FO-076
     *     no está disponible. Llena los campos manualmente."
     *   - Si los datos están disponibles → remover cualquier banner previo.
     *
     * Por qué compacto: el wizard ya tiene banners (PRI, progreso, validación).
     * Un banner gigante rompería la jerarquía visual.
     */
    _actualizarBannerSeccion2Incapacidad() {
        const seccion = document.getElementById('sp-section-incapacidad');
        if (!seccion) return;

        // Limpiar banner previo siempre (idempotente)
        const oldBanner = seccion.querySelector('.km-missing-banner');
        if (oldBanner) oldBanner.remove();

        // Si archivo está OK, no hacer nada (ya removimos el banner)
        if (!this.ausentismoFileStatus || !this.ausentismoFileStatus.missing) return;

        // Verificar si Sección 2 quedó vacía tras autollenar
        const fechaInicio = document.getElementById('sp-fecha-inicio');
        const fechaFin = document.getElementById('sp-fecha-fin');
        const codigoCie10 = document.getElementById('sp-codigo-cie10');
        const descripcionDx = document.getElementById('sp-descripcion-diagnostico');

        const camposClave = [fechaInicio, fechaFin, codigoCie10, descripcionDx].filter(Boolean);
        const todosVacios = camposClave.length > 0 && camposClave.every(el => !String(el.value || '').trim());

        // Solo mostrar banner si NO hay datos Y el archivo está missing
        if (!todosVacios) return;

        const titleEl = seccion.querySelector('.sp-section-title');
        if (!titleEl) return;

        // Inyectar banner compacto amarillo justo después del título
        const banner = document.createElement('div');
        banner.style.cssText = 'margin: 8px 0 16px 0;';
        banner.innerHTML = this._ausentismoMissingBannerHtml(
            {
                reason: this.ausentismoFileStatus.reason,
                expectedDir: this.ausentismoFileStatus.expectedDir,
                details: this.ausentismoFileStatus.details
            },
            { variant: 'warning', compact: true, showAction: false }
        );

        titleEl.insertAdjacentElement('afterend', banner.firstElementChild);

        console.log('[WIZARD][📦459] Banner preventivo inyectado en Sección 2 — archivo missing:', this.ausentismoFileStatus.reason);
    }

    /**
     * Igual que _setInputValue pero SOLO escribe si el input está vacío. Usado al
     * auto-completar desde la BD de personal después de cargar un caso existente,
     * para no pisar un valor que ya estaba guardado en el Excel.
     */
    _setInputValueIfEmpty(id, value) {
        if (value == null || value === '') return;
        const el = document.getElementById(id);
        if (el && !String(el.value || '').trim()) el.value = String(value);
    }

    /**
     * [📦455 2026-07-01 v3] Parsea fechas de nacimiento en cualquier formato que
     * venga del Excel (Date object, ISO string, dd/mm/yyyy, YYYYMMDD sin
     * separadores, Excel serial number, timestamp ms).
     *
     * IMPORTANTE (v3): el caso YYYYMMDD debe probarse ANTES del fallback ISO,
     * porque new Date('19830927') se interpreta como 19.830.927 ms desde epoch
     * (que cae en año 1980, NO en la fecha 27-sept-1983 que el dato representa).
     *
     * Rechaza fechas invalidas (epoch 1970, años < 1940 o > año actual).
     * Inspirado en formatearFecha() de consulta-trabajadores.js.
     * @param {*} fecha - Valor crudo de la BD de personal
     * @returns {Date|null} - Date valida o null si no se puede parsear
     */
    _parsearFechaNacimiento(fecha) {
        if (fecha == null || fecha === '') return null;
        try {
            // Caso 1: ya es Date object
            if (fecha instanceof Date) {
                if (isNaN(fecha.getTime())) return null;
                if (fecha.getFullYear() < 1940 || fecha.getFullYear() > new Date().getFullYear()) return null;
                return fecha;
            }
            const str = String(fecha).trim();
            if (!str) return null;

            // ============================================================
            // Caso 2 (v3): string YYYYMMDD (8 digitos, sin separadores) — PRIORIDAD ALTA
            // Detecta esto ANTES de new Date() porque la conversion ISO basica
            // interpreta '19830927' como ms (no como fecha), produciendo 1970-01-01.
            // ============================================================
            if (/^\d{8}$/.test(str)) {
                const anio = parseInt(str.substring(0, 4), 10);
                const mes = parseInt(str.substring(4, 6), 10) - 1;
                const dia = parseInt(str.substring(6, 8), 10);
                const d4 = new Date(anio, mes, dia);
                if (!isNaN(d4.getTime()) && d4.getFullYear() >= 1940 && d4.getFullYear() <= new Date().getFullYear()) {
                    return d4;
                }
            }

            // ============================================================
            // Caso 3: string ISO (YYYY-MM-DD o con tiempo)
            // Solo si Caso 2 no matcheo. NOTA: la iso basica sin separadores
            // ('19830927') no la usamos aqui porque fue atrapada por Caso 2.
            // ============================================================
            const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/);
            if (isoMatch) {
                const date = new Date(str);
                if (!isNaN(date.getTime()) && date.getFullYear() >= 1940 && date.getFullYear() <= new Date().getFullYear()) {
                    return date;
                }
            }

            // ============================================================
            // Caso 4: string dd/mm/yyyy o dd-mm-yyyy
            // ============================================================
            const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (ddmmyyyy) {
                const dia = parseInt(ddmmyyyy[1], 10);
                const mes = parseInt(ddmmyyyy[2], 10) - 1;
                let anio = parseInt(ddmmyyyy[3], 10);
                if (anio < 100) anio = anio < 50 ? 2000 + anio : 1900 + anio;
                // Solo aceptar anios en rango razonable de fechas de nacimiento.
                if (anio >= 1940 && anio <= new Date().getFullYear()) {
                    const d3 = new Date(anio, mes, dia);
                    if (!isNaN(d3.getTime()) && d3.getFullYear() >= 1940 && d3.getFullYear() <= new Date().getFullYear()) {
                        return d3;
                    }
                }
            }

            // ============================================================
            // Caso 5: numero serial de Excel (eg. 28000 para 1976-08-21).
            // Seriales Excel razonables estan entre 1 (1900) y ~60000 (año 2064).
            // Si es > 100000 NO es serial — es otra cosa (timestamp ms o year*10000+mmdd).
            // ============================================================
            if (/^\d+(\.\d+)?$/.test(str)) {
                const serial = parseFloat(str);
                if (serial >= 1 && serial < 100000) {
                    // Excel epoch: 1899-12-30 (corrigiendo el bug del 29-feb-1900)
                    const ms = (serial - 25569) * 86400 * 1000;
                    const d = new Date(ms);
                    if (!isNaN(d.getTime()) && d.getFullYear() >= 1940 && d.getFullYear() <= new Date().getFullYear()) {
                        return d;
                    }
                }
                // Si es numero grande (timestamp ms o year*10000+mmdd NO matcheable),
                // retornar null — mejor no asignar nada que asignar una fecha incorrecta.
                return null;
            }

            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Agrega una fila a la tabla de recomendaciones
     */
    addRecomRow() {
        const tbody = document.getElementById('sp-recomTableBody');
        const rows = tbody.querySelectorAll('tr');
        const newItemNumber = rows.length + 1;
        
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td style="text-align: center; vertical-align: middle;"><span class="recom-item-number">${newItemNumber}</span></td>
            <td><input type="text" class="sp-form-control" placeholder="Ej: Reposo absoluto"></td>
            <td>
                <select class="sp-form-control">
                    <option>ARL</option>
                    <option>EPS</option>
                    <option>JRC</option>
                </select>
            </td>
            <td><input type="date" class="sp-form-control"></td>
            <td>
                <select class="sp-form-control">
                    <option>SI</option>
                    <option>NO</option>
                    <option>EN PROCESO</option>
                </select>
            </td>
            <td><input type="text" class="sp-form-control" placeholder="Detalle"></td>
            <td style="text-align:center;">
                <button class="sp-btn sp-btn-outline sp-btn-sm" onclick="window.medicAusentismoComponent.removeRecomRow(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(newRow);
        this.updateRecomItemNumbers();
    }

    /**
     * Elimina una fila de la tabla de recomendaciones
     */
    removeRecomRow(button) {
        button.closest('tr').remove();
        this.updateRecomItemNumbers();
    }

    /**
     * Actualiza la numeración de la columna Item en la tabla de recomendaciones
     */
    updateRecomItemNumbers() {
        const tbody = document.getElementById('sp-recomTableBody');
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const itemSpan = row.querySelector('.recom-item-number');
            if (itemSpan) {
                itemSpan.textContent = index + 1;
            }
        });
    }

    /**
     * Agrega un nuevo seguimiento al contenedor
     */
    agregarSeguimiento(fecha = '', descripcion = '') {
        const container = document.getElementById('sp-seguimientos-container');
        if (!container) return;

        const seguimientoId = `seg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const seguimientoDiv = document.createElement('div');
        seguimientoDiv.id = seguimientoId;
        seguimientoDiv.className = 'seguimiento-item';
        seguimientoDiv.style.cssText = `
            display: flex; gap: 10px; align-items: flex-start; padding: 12px; 
            background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;
        `;
        seguimientoDiv.innerHTML = `
            <div style="flex: 1; display: grid; grid-template-columns: 150px 1fr; gap: 12px;">
                <div>
                    <label class="sp-form-label">Fecha</label>
                    <input type="date" class="sp-form-control seguimiento-fecha" value="${fecha}" style="width: 100%;">
                </div>
                <div>
                    <label class="sp-form-label">Descripción</label>
                    <textarea class="sp-form-control seguimiento-descripcion" rows="2" placeholder="Describa el seguimiento..." style="width: 100%;">${descripcion}</textarea>
                </div>
            </div>
            <button type="button" onclick="window.medicAusentismoComponent.eliminarSeguimiento('${seguimientoId}')" 
                style="padding: 8px; border-radius: 6px; border: 1px solid #EF4444; background: white; color: #EF4444; cursor: pointer; font-size: 13px; transition: all 0.2s; flex-shrink: 0;"
                onmouseover="this.style.background='#FEF2F2'; this.style.borderColor='#DC2626'"
                onmouseout="this.style.background='white'; this.style.borderColor='#EF4444'">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(seguimientoDiv);
        console.log('[SEGUIMIENTO] Agregado:', seguimientoId);
    }

    /**
     * Elimina un seguimiento del contenedor
     */
    eliminarSeguimiento(seguimientoId) {
        const elemento = document.getElementById(seguimientoId);
        if (elemento) {
            elemento.remove();
            console.log('[SEGUIMIENTO] Eliminado:', seguimientoId);
        }
    }

    /**
     * Inicializa el contenedor de seguimientos con un elemento vacío
     */
    inicializarSeguimientos() {
        const container = document.getElementById('sp-seguimientos-container');
        if (container) {
            container.innerHTML = '';
            this.agregarSeguimiento();
        }
    }

    /**
     * Obtiene todos los seguimientos del contenedor
     */
    obtenerSeguimientos() {
        const seguimientos = [];
        const container = document.getElementById('sp-seguimientos-container');
        if (container) {
            const items = container.querySelectorAll('.seguimiento-item');
            items.forEach(item => {
                const fecha = item.querySelector('.seguimiento-fecha')?.value || '';
                const descripcion = item.querySelector('.seguimiento-descripcion')?.value || '';
                if (fecha || descripcion) {
                    seguimientos.push({ fecha, descripcion });
                }
            });
        }
        console.log('[SEGUIMIENTOS] Obtenidos:', seguimientos.length);
        return seguimientos;
    }

    /**
     * Guarda los datos del seguimiento
     */
    saveSeguimientoData() {
        // Recopilar todos los datos del formulario
        const seguimientoData = {
            // Datos generales
            trabajador: {
                nombre: document.getElementById('sp-nombre').value,
                cedula: document.getElementById('sp-cedula').value,
                fechaNacimiento: document.getElementById('sp-fecha-nacimiento').value,
                genero: document.getElementById('sp-genero').value,
                cargo: document.getElementById('sp-cargo').value,
                area: document.getElementById('sp-area').value,
                fechaIngreso: document.getElementById('sp-fecha-ingreso').value,
                antiguedad: document.getElementById('sp-antiguedad').value,
                tipoContrato: document.getElementById('sp-tipo-contrato').value,
                salario: document.getElementById('sp-salario').value,
                eps: document.getElementById('sp-eps').value,
                afp: document.getElementById('sp-afp').value,
                arl: document.getElementById('sp-arl').value,
                // Nuevos campos de Salud
                peso: document.getElementById('sp-peso').value,
                talla: document.getElementById('sp-talla').value,
                imc: document.getElementById('sp-imc').value,
                actividadesExtralaborales: document.getElementById('sp-actividades-extralaborales').value,
                // Nuevos campos laborales
                tipoEvento: document.getElementById('sp-tipo-evento').value,
                tipoCargo: document.getElementById('sp-tipo-cargo').value,
                dominancia: document.getElementById('sp-dominancia').value  // 🆕 Dominancia
            },
            // Incapacidad
            incapacidad: {
                fechaInicio: document.getElementById('sp-fecha-inicio').value,
                fechaFin: document.getElementById('sp-fecha-fin').value,
                diasAcumulados: document.getElementById('sp-dias-acumulados').value,
                clase: '',  // Campo eliminado del UI
                codigoCie10: document.getElementById('sp-codigo-cie10').value,
                descripcionDiagnostico: document.getElementById('sp-descripcion-diagnostico').value,
                numeroProrrogas: document.getElementById('sp-numero-prorrogas').value,
                fechaUltimaProrroga: document.getElementById('sp-fecha-ultima-prorroga').value,
                // 🆕 Diagnósticos adicionales
                cie10Dx2: document.getElementById('sp-cie10-dx2').value,
                origenDx2: document.getElementById('sp-origen-dx2').value,
                cie10Dx3: document.getElementById('sp-cie10-dx3').value,
                origenDx3: document.getElementById('sp-origen-dx3').value,
                // 🆕 Etapa 4: Reincorporación Laboral
                fechaReincorporacion: document.getElementById('sp-fecha-reincorporacion-inc').value,
                tipoReintegro: document.getElementById('sp-tipo-reintegro-inc').value,
                adaptaciones: document.getElementById('sp-adaptaciones-inc').value,
                // 🆕 Etapa 5: Cierre de Caso
                fechaCierre: document.getElementById('sp-fecha-cierre-inc').value,
                motivoCierre: document.getElementById('sp-motivo-cierre-inc').value,
                observacionesFinales: document.getElementById('sp-observaciones-finales-inc').value,
                // Seguimientos múltiples
                seguimientos: this.obtenerSeguimientos()
            },
            // Etapas PRIC
            pric: {
                // 🆕 Condiciones de Salud (antes de Etapa 1) - Columnas AY(50), AZ(51), BA(52), BB(53), BC(54), BD(55)
                fechaExamenMedico: document.getElementById('sp-fecha-examen-medico').value,
                resultadoExamenMedico: document.getElementById('sp-resultado-examen-medico').value,
                fechaExamenPeriodico: document.getElementById('sp-fecha-examen-periodico').value,
                resultadoExamenPostIncapacidad: document.getElementById('sp-resultado-examen-post-incapacidad').value,
                trabajadorRemoto: document.getElementById('sp-trabajador-remoto').value,
                fechaInicioRemoto: document.getElementById('sp-fecha-inicio-remoto').value,
                // Etapa 1: Captura de Caso - Columnas BE(56), BF(57), BG(58)
                casoIngresadoPRIC: document.getElementById('sp-caso-ingresado-pric').value,
                mecanismoDeteccion: document.getElementById('sp-mecanismo-deteccion').value,
                fechaIngresoPRIC: document.getElementById('sp-fecha-ingreso-pric').value,
                // Etapa 2: Plan de Tratamiento - Columnas BH(59), BI(60), BJ(61), BK(62)
                trabajadorPlanTratamiento: document.getElementById('sp-trabajador-plan-tratamiento').value,
                metaRehabilitacion: document.getElementById('sp-objetivos-tratamiento').value,
                fechaEmisionPlan: document.getElementById('sp-fecha-inicio-plan').value,
                fechaProbableReintegro: document.getElementById('sp-fecha-probable-alta').value,
                // Etapa 3: Ejecución y Seguimiento - Columnas BL(63) a BW(74)
                fechaProximaCita: document.getElementById('sp-fecha-proxima-cita').value,
                observacionesSeguimiento: document.getElementById('sp-evolucion-clinica').value,
                fechaAPTReincorporacion: document.getElementById('sp-fecha-ultimo-seguimiento').value,
                modalidadReincorporacion: document.getElementById('sp-adherencia').value,
                fechaReintegro: document.getElementById('sp-fecha-reintegro').value,
                periodicidadSeguimiento: document.getElementById('sp-periodicidad-seguimiento').value,
                recomendacionesLaborales: document.getElementById('sp-recomendaciones-laborales').value,
                fechaVencimientoRecomendaciones: document.getElementById('sp-fecha-vencimiento-recomendaciones').value,
                descripcionRecomendaciones: document.getElementById('sp-descripcion-recomendaciones').value,
                fechaProximoSeguimientoRecomendaciones: document.getElementById('sp-fecha-proximo-seguimiento-recomendaciones').value,
                tieneDesercion: document.getElementById('sp-tiene-desercion').value,
                logroMejoriaMedica: document.getElementById('sp-logro-mejoria-medica').value,
                // 🆕 Seguimientos (Sección Intermedia - Parte de Etapa 3) - Columnas BX(75), BY(76), BZ(77), CA(78)
                fechaSeguimiento1: document.getElementById('sp-fecha-seguimiento-1').value,
                descripcionSeguimiento1: document.getElementById('sp-descripcion-seguimiento-1').value,
                fechaSeguimiento2: document.getElementById('sp-fecha-seguimiento-2').value,
                descripcionSeguimiento2: document.getElementById('sp-descripcion-seguimiento-2').value,
                // Etapa 4: Reincorporación Laboral - Columnas CB(79), CC(80), CD(81)
                fechaReincorporacion: document.getElementById('sp-fecha-reincorporacion').value,
                tipoReintegro: document.getElementById('sp-tipo-reintegro').value,
                adaptaciones: document.getElementById('sp-adaptaciones').value,
                // Etapa 5: Cierre de Caso - Columnas CE(82), CF(83), CG(84), CH(85)
                fechaCierre: document.getElementById('sp-fecha-cierre').value,
                motivoCierre: document.getElementById('sp-motivo-cierre').value,
                fechaCalificacionPCL: document.getElementById('sp-fecha-calificacion-pcl').value,
                porcentajePCLCalificacion: document.getElementById('sp-porcentaje-pcl-calificacion').value,
                // 🆕 Historial de Diagnóstico - Columnas CI(86) a CT(96)
                cie10CalificadaDX1: document.getElementById('sp-cie10-dx1-calificada').value,
                origenDX1: document.getElementById('sp-origen-dx1').value,
                cie10CalificadaDX2: document.getElementById('sp-cie10-dx2-calificada').value,
                origenDX2: document.getElementById('sp-origen-dx2-calificada').value,
                cie10CalificadaDX3: document.getElementById('sp-cie10-dx3-calificada').value,
                origenDX3: document.getElementById('sp-origen-dx3-calificada').value,
                cie10CalificadaDX4: document.getElementById('sp-cie10-dx4-calificada').value,
                origenDX4: document.getElementById('sp-origen-dx4-calificada').value,
                origenCaso: document.getElementById('sp-origen-caso').value,
                ingresoSVE: document.getElementById('sp-ingreso-sve').value,
                anioUltimaCalificacionPCL: document.getElementById('sp-anio-ultima-calificacion-pcl').value,
                anioSeguimientoEmpresa: document.getElementById('sp-anio-seguimiento-empresa').value
            },
            // Calificación PCL
            calificacion: {
                // 🆕 Calificación Regional (columnas FC-FI, índices 158-164)
                estadoProcesoRegional: document.getElementById('sp-estado-proceso-regional').value,
                fechaSolicitudRegional: document.getElementById('sp-fecha-solicitud-regional').value,
                fechaDictamenRegional: document.getElementById('sp-fecha-dictamen-regional').value,
                porcentajePclRegional: document.getElementById('sp-porcentaje-pcl-regional').value,
                origenCalificacionRegional: document.getElementById('sp-origen-calificacion-regional').value,
                fechaEstructuracionRegional: document.getElementById('sp-fecha-estructuracion-regional').value,
                observacionesCalificacionRegional: document.getElementById('sp-observaciones-calificacion-regional').value,
                // 🆕 Calificación Nacional (columnas FJ-FP, índices 165-171)
                estadoProcesoNacional: document.getElementById('sp-estado-proceso-nacional').value,
                fechaSolicitudNacional: document.getElementById('sp-fecha-solicitud-nacional').value,
                fechaDictamenNacional: document.getElementById('sp-fecha-dictamen-nacional').value,
                porcentajePclNacional: document.getElementById('sp-porcentaje-pcl-nacional').value,
                origenCalificacionNacional: document.getElementById('sp-origen-calificacion-nacional').value,
                fechaEstructuracionNacional: document.getElementById('sp-fecha-estructuracion-nacional').value,
                observacionesCalificacionNacional: document.getElementById('sp-observaciones-calificacion').value
            },
            // Campos legacy (para compatibilidad con logs antiguos)
            calificacionLegacy: {
                estadoProceso: document.getElementById('sp-estado-proceso-regional').value,
                fechaSolicitud: document.getElementById('sp-fecha-solicitud-regional').value,
                fechaDictamen: document.getElementById('sp-fecha-dictamen-regional').value,
                porcentajePcl: document.getElementById('sp-porcentaje-pcl-regional').value,
                origenCalificacion: document.getElementById('sp-origen-calificacion-regional').value,
                fechaEstructuracion: document.getElementById('sp-fecha-estructuracion-regional').value,
                observacionesCalificacion: document.getElementById('sp-observaciones-calificacion').value
            },
            // Recomendaciones (tabla)
            recomendaciones: []
        };

        // Recopilar recomendaciones de la tabla
        // La columna 0 es Item (numeración automática, no se guarda)
        // Las columnas 1-5 son: Recomendación, Entidad, Fecha Límite, Cumple, Observación
        document.querySelectorAll('#sp-recomTableBody tr').forEach((row, index) => {
            const inputs = row.querySelectorAll('input, select');
            // Necesitamos al menos 5 inputs (excluyendo el Item que es un span)
            if (inputs.length >= 5) {
                seguimientoData.recomendaciones.push({
                    item: index + 1,  // Numeración automática
                    recomendacion: inputs[0].value,  // Columna 1: Recomendación Emitida
                    entidad: inputs[1].value,        // Columna 2: Entidad que Emite
                    fechaLimite: inputs[2].value,    // Columna 3: Fecha Límite
                    cumple: inputs[3].value,         // Columna 4: Cumple?
                    observacion: inputs[4].value     // Columna 5: Observación / Evidencia
                });
            }
        });

        console.log('[GUARDAR SEGUIMIENTO] Datos recopilados:', seguimientoData);
        console.log('[GUARDAR SEGUIMIENTO] Recomendaciones:', seguimientoData.recomendaciones);

        // === GUARDAR DIRECTAMENTE (sin mostrar modal) ===
        // El usuario ya seleccionó qué hacer al abrir el panel (actualizar o crear nuevo)
        // Ahora solo guardamos los datos directamente
        const cedula = seguimientoData.trabajador.cedula;
        console.log('[GUARDAR SEGUIMIENTO] Guardando datos para cédula:', cedula);
        
        // Determinar si es actualización buscando la fila
        window.electronAPI.buscarRegistrosCedula(cedula, this.currentCompany)
            .then(resultadoBusqueda => {
                let filaObjetivo = null;
                let esActualizacion = false;
                
                if (resultadoBusqueda.success && resultadoBusqueda.registros && resultadoBusqueda.registros.length > 0) {
                    // Usar el registro más reciente
                    filaObjetivo = resultadoBusqueda.registros[0].fila;
                    esActualizacion = true;
                    console.log('[GUARDAR SEGUIMIENTO] Actualizando registro en fila:', filaObjetivo);
                } else {
                    console.log('[GUARDAR SEGUIMIENTO] Creando nuevo registro');
                }
                
                // Ejecutar guardado
                this.ejecutarGuardadoReal(seguimientoData, esActualizacion, filaObjetivo);
            })
            .catch(error => {
                console.error('[GUARDAR SEGUIMIENTO] Error buscando registros:', error);
                // En caso de error, guardar como nuevo
                this.ejecutarGuardadoReal(seguimientoData, false, null);
            });
    }

    /**
     * Muestra modal moderno para seleccionar qué registro actualizar o si crear uno nuevo
     */
    mostrarModalSeleccionRegistros(registros, seguimientoData) {
        const empleadoNombre = seguimientoData.trabajador.nombre;
        const empleadoCedula = seguimientoData.trabajador.cedula;

        // Generar iniciales para el avatar
        const initials = empleadoNombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        // Crear modal dinámicamente con diseño moderno
        const modalHTML = `
            <div id="modalSeleccionRegistro" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(5px); z-index: 10000; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; color: #1E293B; animation: fadeIn 0.2s ease-out;">
                <div style="background: white; padding: 0; border-radius: 16px; max-width: 650px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; display: flex; flex-direction: column; animation: slideUp 0.3s ease-out; max-height: 90vh;">

                    <!-- Header Moderno -->
                    <div style="padding: 24px; background: linear-gradient(135deg, #64748B 0%, #475569 100%); color: white; display: flex; align-items: center; gap: 16px;">
                        <div style="background: rgba(255,255,255,0.2); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas fa-folder-open" style="font-size: 20px;"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Registros Existentes Detectados</h3>
                            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Selecciona un registro para cargar sus datos</p>
                        </div>
                    </div>

                    <!-- Body -->
                    <div style="padding: 24px; overflow-y: auto; flex: 1;">

                        <!-- Tarjeta de Identificación del Empleado -->
                        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
                            <div style="background: #E0E7FF; color: #4F46E5; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; text-transform: uppercase;">
                                ${initials}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 15px; color: #1E293B;">${empleadoNombre}</div>
                                <div style="font-size: 13px; color: #64748B; margin-top: 2px;">CC: ${empleadoCedula}</div>
                            </div>
                        </div>

                        <!-- Lista de Registros Existentes -->
                        <div style="margin-bottom: 24px;">
                            <label style="display: block; font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Selecciona un registro para cargar:</label>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${registros.map((reg, idx) => `
                                    <div style="display: flex; align-items: center; padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: white;"
                                        onmouseover="this.style.borderColor='#F59E0B'; this.style.background='#FFFBEB'"
                                        onmouseout="this.style.borderColor='#E2E8F0'; this.style.background='white'"
                                        onclick="window.medicAusentismoComponent.cargarRegistroYAbrirPanel(${JSON.stringify(reg).replace(/"/g, '&quot;')})">
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #F59E0B, #D97706); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">
                                            <i class="fas fa-file-medical" style="font-size: 16px;"></i>
                                        </div>
                                        <div style="flex: 1; margin-left: 12px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <div style="font-weight: 600; font-size: 14px; color: #1E293B;">
                                                    ${reg.fecha_fin || 'Sin fecha fin'} |
                                                    <span style="color: #F59E0B;">${reg.dias || '0'} días</span>
                                                </div>
                                                ${idx === 0 ? '<span style="padding: 2px 8px; background: #FEF3C7; color: #D97706; font-size: 10px; font-weight: 600; border-radius: 12px; text-transform: uppercase;">Más reciente</span>' : ''}
                                            </div>
                                            <div style="font-size: 12px; color: #64748B; margin-top: 4px;">
                                                <strong style="color: #4F46E5;">${reg.cie10 || ''}</strong> - ${reg.diagnostico || 'Sin diagnóstico'}
                                            </div>
                                        </div>
                                        <i class="fas fa-chevron-right" style="color: #94A3B8; font-size: 12px;"></i>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Opción Crear Nuevo -->
                        <div style="text-align: center; padding-top: 16px; border-top: 1px solid #E2E8F0;">
                            <button onclick="window.medicAusentismoComponent.crearNuevoRegistroYAbrirPanel()"
                                style="padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; background: linear-gradient(135deg, #10B981, #059669); color: white; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);"
                                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 8px -1px rgba(16, 185, 129, 0.3)'"
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(16, 185, 129, 0.2)'">
                                <i class="fas fa-plus"></i> Crear nuevo registro
                            </button>
                        </div>

                    </div>

                    <!-- Footer -->
                    <div style="padding: 16px 24px; background: #F8FAFC; border-top: 1px solid #E2E8F0; display: flex; justify-content: flex-end; flex-shrink: 0;">
                        <button onclick="document.getElementById('modalSeleccionRegistro').remove()" style="padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #E2E8F0; background: white; color: #64748B; transition: all 0.2s;">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    /**
     * Carga un registro seleccionado y abre el panel de gestión
     */
    cargarRegistroYAbrirPanel(registro) {
        console.log('[CARGAR REGISTRO] Cargando registro fila:', registro.fila);
        console.log('[CARGAR REGISTRO] Datos del registro:', registro);

        // Cerrar modal
        const modal = document.getElementById('modalSeleccionRegistro');
        if (modal) {
            modal.remove();
        }

        // Abrir panel
        if (this.currentDetalleEmpleado) {
            this.abrirPanelSeguimientoConEmpleado(this.currentDetalleEmpleado);
        }

        // Esperar a que el panel esté visible y cargar TODOS los datos
        setTimeout(() => {
            // Cambiar a sección de datos generales
            this.showSeguimientoPanelSection('datos', document.querySelector('.sp-nav-item'));

            // === Cargar TODOS los datos del registro ===

            // Datos básicos del trabajador
            document.getElementById('sp-nombre').value = registro.nombre || this.currentDetalleEmpleado?.nombre || '';
            document.getElementById('sp-cedula').value = registro.cedula || this.currentDetalleEmpleado?.cedula || '';
            document.getElementById('sp-genero').value = registro.genero || '';
            document.getElementById('sp-cargo').value = registro.cargo || '';
            document.getElementById('sp-area').value = registro.area || '';
            document.getElementById('sp-eps').value = registro.eps || '';
            document.getElementById('sp-afp').value = registro.afp || '';

            // Fechas
            if (registro.fecha_nacimiento) {
                try {
                    const fecha = new Date(registro.fecha_nacimiento);
                    if (!isNaN(fecha.getTime())) {
                        document.getElementById('sp-fecha-nacimiento').value = fecha.toISOString().split('T')[0];
                        this.calcularEdad();
                    }
                } catch (e) { console.warn('Error fecha_nacimiento:', e); }
            }

            if (registro.fecha_ingreso) {
                try {
                    const fecha = new Date(registro.fecha_ingreso);
                    if (!isNaN(fecha.getTime())) {
                        document.getElementById('sp-fecha-ingreso').value = fecha.toISOString().split('T')[0];
                        this.calcularAntiguedad();
                    }
                } catch (e) { console.warn('Error fecha_ingreso:', e); }
            }

            // Información laboral
            document.getElementById('sp-tipo-evento').value = registro.tipo_evento || '';
            document.getElementById('sp-tipo-cargo').value = registro.tipo_cargo || '';
            document.getElementById('sp-tipo-contrato').value = registro.tipo_contrato || '';
            document.getElementById('sp-salario').value = registro.salario || '';

            // Salud
            document.getElementById('sp-peso').value = registro.peso || '';
            document.getElementById('sp-talla').value = registro.talla || '';
            document.getElementById('sp-imc').value = registro.imc || '';
            document.getElementById('sp-dominancia').value = registro.dominancia || '';
            document.getElementById('sp-actividades-extralaborales').value = registro.actividades_extralaborales || '';

            // Datos de incapacidad
            if (registro.fecha_inicio) {
                try {
                    const fecha = new Date(registro.fecha_inicio);
                    if (!isNaN(fecha.getTime())) {
                        document.getElementById('sp-fecha-inicio').value = fecha.toISOString().split('T')[0];
                        this.calcularDiasAcumulados();
                    }
                } catch (e) { console.warn('Error fecha_inicio:', e); }
            }

            if (registro.fecha_fin) {
                try {
                    const fecha = new Date(registro.fecha_fin);
                    if (!isNaN(fecha.getTime())) {
                        document.getElementById('sp-fecha-fin').value = fecha.toISOString().split('T')[0];
                        this.calcularDiasAcumulados();
                    }
                } catch (e) { console.warn('Error fecha_fin:', e); }
            }

            document.getElementById('sp-dias-acumulados').value = registro.dias || '';
            // Campo 'clase-incapacidad' eliminado del UI - ya no se carga
            document.getElementById('sp-codigo-cie10').value = registro.cie10 || '';
            document.getElementById('sp-descripcion-diagnostico').value = registro.diagnostico || '';
            
            // 🆕 Cargar DX2, DX3 y orígenes
            document.getElementById('sp-cie10-dx2').value = registro.cie10_dx2 || '';
            document.getElementById('sp-origen-dx2').value = registro.origen_dx2 || '';
            document.getElementById('sp-cie10-dx3').value = registro.cie10_dx3 || '';
            document.getElementById('sp-origen-dx3').value = registro.origen_dx3 || '';
            
            // 🆕 Cargar número de prórrogas y fecha última prórroga
            document.getElementById('sp-numero-prorrogas').value = registro.numero_prorrogas || '';
            document.getElementById('sp-fecha-ultima-prorroga').value = registro.fecha_ultima_prorroga || '';

            // 🆕 Cargar seguimientos múltiples
            if (registro.seguimientos && registro.seguimientos.length > 0) {
                // Limpiar contenedor primero
                const container = document.getElementById('sp-seguimientos-container');
                if (container) {
                    container.innerHTML = '';
                    // Cargar cada seguimiento
                    registro.seguimientos.forEach(seg => {
                        this.agregarSeguimiento(seg.fecha || '', seg.descripcion || '');
                    });
                    console.log(`[CARGAR REGISTRO] ${registro.seguimientos.length} seguimientos cargados`);
                }
            }

            // 🆕 Cargar Etapa 4: Reincorporación Laboral - de incapacidad
            document.getElementById('sp-fecha-reincorporacion-inc').value = registro.fecha_reincorporacion || '';
            document.getElementById('sp-tipo-reintegro-inc').value = registro.tipo_reintegro || '';
            document.getElementById('sp-adaptaciones-inc').value = registro.adaptaciones || '';

            // 🆕 Cargar Etapa 5: Cierre de Caso - de incapacidad
            document.getElementById('sp-fecha-cierre-inc').value = registro.fecha_cierre || '';
            document.getElementById('sp-motivo-cierre-inc').value = registro.motivo_cierre || '';
            document.getElementById('sp-observaciones-finales-inc').value = registro.observaciones_finales || '';

            // ============================================
            // 🆕 Cargar TODOS los campos de PRIC
            // ============================================
            if (registro.pric) {
                const pric = registro.pric;
                
                // Condiciones de Salud
                document.getElementById('sp-fecha-examen-medico').value = pric.fechaExamenMedico || '';
                document.getElementById('sp-resultado-examen-medico').value = pric.resultadoExamenMedico || '';
                document.getElementById('sp-fecha-examen-periodico').value = pric.fechaExamenPeriodico || '';
                document.getElementById('sp-resultado-examen-post-incapacidad').value = pric.resultadoExamenPostIncapacidad || '';
                document.getElementById('sp-trabajador-remoto').value = pric.trabajadorRemoto || '';
                document.getElementById('sp-fecha-inicio-remoto').value = pric.fechaInicioRemoto || '';
                
                // Etapa 1: Captura de Caso
                document.getElementById('sp-caso-ingresado-pric').value = pric.casoIngresadoPRIC || '';
                document.getElementById('sp-mecanismo-deteccion').value = pric.mecanismoDeteccion || '';
                document.getElementById('sp-fecha-ingreso-pric').value = pric.fechaIngresoPRIC || '';
                
                // Etapa 2: Plan de Tratamiento
                document.getElementById('sp-trabajador-plan-tratamiento').value = pric.trabajadorPlanTratamiento || '';
                document.getElementById('sp-objetivos-tratamiento').value = pric.metaRehabilitacion || '';
                document.getElementById('sp-fecha-inicio-plan').value = pric.fechaEmisionPlan || '';
                document.getElementById('sp-fecha-probable-alta').value = pric.fechaProbableReintegro || '';
                
                // Etapa 3: Ejecución y Seguimiento
                document.getElementById('sp-fecha-proxima-cita').value = pric.fechaProximaCita || '';
                document.getElementById('sp-evolucion-clinica').value = pric.observacionesSeguimiento || '';
                document.getElementById('sp-fecha-ultimo-seguimiento').value = pric.fechaAPTReincorporacion || '';
                document.getElementById('sp-adherencia').value = pric.modalidadReincorporacion || '';
                document.getElementById('sp-fecha-reintegro').value = pric.fechaReintegro || '';
                document.getElementById('sp-periodicidad-seguimiento').value = pric.periodicidadSeguimiento || '';
                document.getElementById('sp-recomendaciones-laborales').value = pric.recomendacionesLaborales || '';
                document.getElementById('sp-fecha-vencimiento-recomendaciones').value = pric.fechaVencimientoRecomendaciones || '';
                document.getElementById('sp-descripcion-recomendaciones').value = pric.descripcionRecomendaciones || '';
                document.getElementById('sp-fecha-proximo-seguimiento-recomendaciones').value = pric.fechaProximoSeguimientoRecomendaciones || '';
                document.getElementById('sp-tiene-desercion').value = pric.tieneDesercion || '';
                document.getElementById('sp-logro-mejoria-medica').value = pric.logroMejoriaMedica || '';
                
                // Seguimientos adicionales
                document.getElementById('sp-fecha-seguimiento-1').value = pric.fechaSeguimiento1 || '';
                document.getElementById('sp-descripcion-seguimiento-1').value = pric.descripcionSeguimiento1 || '';
                document.getElementById('sp-fecha-seguimiento-2').value = pric.fechaSeguimiento2 || '';
                document.getElementById('sp-descripcion-seguimiento-2').value = pric.descripcionSeguimiento2 || '';
                
                // Etapa 4: Reincorporación Laboral - de pric
                document.getElementById('sp-fecha-reincorporacion').value = pric.fechaReincorporacion || '';
                document.getElementById('sp-tipo-reintegro').value = pric.tipoReintegro || '';
                document.getElementById('sp-adaptaciones').value = pric.adaptaciones || '';
                
                // Etapa 5: Cierre de Caso - de pric
                document.getElementById('sp-fecha-cierre').value = pric.fechaCierre || '';
                document.getElementById('sp-motivo-cierre').value = pric.motivoCierre || '';
                document.getElementById('sp-fecha-calificacion-pcl').value = pric.fechaCalificacionPCL || '';
                document.getElementById('sp-porcentaje-pcl-calificacion').value = pric.porcentajePCLCalificacion || '';
                
                // Historial de Diagnóstico
                document.getElementById('sp-cie10-dx1-calificada').value = pric.cie10CalificadaDX1 || '';
                document.getElementById('sp-origen-dx1').value = pric.origenDX1 || '';
                document.getElementById('sp-cie10-dx2-calificada').value = pric.cie10CalificadaDX2 || '';
                document.getElementById('sp-origen-dx2-calificada').value = pric.origenDX2 || '';
                document.getElementById('sp-cie10-dx3-calificada').value = pric.cie10CalificadaDX3 || '';
                document.getElementById('sp-origen-dx3-calificada').value = pric.origenDX3 || '';
                document.getElementById('sp-cie10-dx4-calificada').value = pric.cie10CalificadaDX4 || '';
                document.getElementById('sp-origen-dx4-calificada').value = pric.origenDX4 || '';
                document.getElementById('sp-origen-caso').value = pric.origenCaso || '';
                document.getElementById('sp-ingreso-sve').value = pric.ingresoSVE || '';
                document.getElementById('sp-anio-ultima-calificacion-pcl').value = pric.anioUltimaCalificacionPCL || '';
                document.getElementById('sp-anio-seguimiento-empresa').value = pric.anioSeguimientoEmpresa || '';
                
                console.log('[CARGAR REGISTRO] Campos PRIC cargados exitosamente');
            }

            // ============================================
            // 🆕 Cargar campos de Calificación Regional y Nacional
            // ============================================
            if (registro.calificacion) {
                const calificacion = registro.calificacion;

                // 🆕 Calificación Regional (columnas FC-FI, índices 158-164)
                document.getElementById('sp-estado-proceso-regional').value = calificacion.estadoProcesoRegional || '';
                document.getElementById('sp-fecha-solicitud-regional').value = calificacion.fechaSolicitudRegional || '';
                document.getElementById('sp-fecha-dictamen-regional').value = calificacion.fechaDictamenRegional || '';
                document.getElementById('sp-porcentaje-pcl-regional').value = calificacion.porcentajePclRegional || '';
                document.getElementById('sp-origen-calificacion-regional').value = calificacion.origenCalificacionRegional || '';
                document.getElementById('sp-fecha-estructuracion-regional').value = calificacion.fechaEstructuracionRegional || '';
                document.getElementById('sp-observaciones-calificacion-regional').value = calificacion.observacionesCalificacionRegional || '';

                // 🆕 Calificación Nacional (columnas FJ-FP, índices 165-171)
                document.getElementById('sp-estado-proceso-nacional').value = calificacion.estadoProcesoNacional || '';
                document.getElementById('sp-fecha-solicitud-nacional').value = calificacion.fechaSolicitudNacional || '';
                document.getElementById('sp-fecha-dictamen-nacional').value = calificacion.fechaDictamenNacional || '';
                document.getElementById('sp-porcentaje-pcl-nacional').value = calificacion.porcentajePclNacional || '';
                document.getElementById('sp-origen-calificacion-nacional').value = calificacion.origenCalificacionNacional || '';
                document.getElementById('sp-fecha-estructuracion-nacional').value = calificacion.fechaEstructuracionNacional || '';
                document.getElementById('sp-observaciones-calificacion').value = calificacion.observacionesCalificacionNacional || '';

                console.log('[CARGAR REGISTRO] Campos de Calificación Regional y Nacional cargados exitosamente');
            }

            // ============================================
            // 🆕 Cargar Recomendaciones (tabla)
            // ============================================
            if (registro.recomendaciones && registro.recomendaciones.length > 0) {
                const tbody = document.getElementById('sp-recomTableBody');
                if (tbody) {
                    // Limpiar tabla primero (dejar al menos una fila vacía)
                    tbody.innerHTML = '';
                    
                    // Cargar cada recomendación
                    registro.recomendaciones.forEach((rec, index) => {
                        const newRow = document.createElement('tr');
                        newRow.innerHTML = `
                            <td style="text-align: center; vertical-align: middle;"><span class="recom-item-number">${rec.item || index + 1}</span></td>
                            <td><input type="text" class="sp-form-control" value="${rec.recomendacion || ''}" placeholder="Ej: Reposo absoluto"></td>
                            <td>
                                <select class="sp-form-control">
                                    <option value="ARL" ${rec.entidad === 'ARL' ? 'selected' : ''}>ARL</option>
                                    <option value="EPS" ${rec.entidad === 'EPS' ? 'selected' : ''}>EPS</option>
                                    <option value="JRC" ${rec.entidad === 'JRC' ? 'selected' : ''}>JRC</option>
                                </select>
                            </td>
                            <td><input type="date" class="sp-form-control" value="${rec.fechaLimite || ''}"></td>
                            <td>
                                <select class="sp-form-control">
                                    <option value="SI" ${rec.cumple === 'SI' ? 'selected' : ''}>SI</option>
                                    <option value="NO" ${rec.cumple === 'NO' ? 'selected' : ''}>NO</option>
                                    <option value="EN PROCESO" ${rec.cumple === 'EN PROCESO' ? 'selected' : ''}>EN PROCESO</option>
                                </select>
                            </td>
                            <td><input type="text" class="sp-form-control" value="${rec.observacion || ''}" placeholder="Detalle"></td>
                            <td style="text-align:center;">
                                <button class="sp-btn sp-btn-outline sp-btn-sm" onclick="window.medicAusentismoComponent.removeRecomRow(this)">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        tbody.appendChild(newRow);
                    });
                    
                    this.updateRecomItemNumbers();
                    console.log(`[CARGAR REGISTRO] ${registro.recomendaciones.length} recomendaciones cargadas`);
                }
            }

            // Navegar a incapacidad para mostrar datos
            setTimeout(() => {
                const navIncapacidad = document.querySelector('.sp-nav-item:nth-child(2)');
                if (navIncapacidad) {
                    this.showSeguimientoPanelSection('incapacidad', navIncapacidad);
                }
            }, 500);

            // Mostrar notificación
            this.showNotification(`✅ Registro cargado: ${registro.nombre || ''}`, 'success');
            console.log('[CARGAR REGISTRO] TODOS los datos cargados exitosamente');
        }, 300);
    }

    /**
     * Crea un nuevo registro y abre el panel vacío
     */
    crearNuevoRegistroYAbrirPanel() {
        console.log('[CREAR NUEVO] Abriendo panel para nuevo registro');
        
        // Cerrar modal
        const modal = document.getElementById('modalSeleccionRegistro');
        if (modal) {
            modal.remove();
        }

        // Abrir panel
        if (this.currentDetalleEmpleado) {
            this.abrirPanelSeguimientoConEmpleado(this.currentDetalleEmpleado);
            this.showNotification('📝 Creando nuevo registro', 'info');
        }
    }

    /**
     * Ejecuta el guardado real de los datos
     */
    ejecutarGuardadoReal(seguimientoData, esActualizacion, filaObjetivo) {
        console.log('[GUARDAR SEGUIMIENTO] Iniciando guardado en PRI.xlsx...');

        // Verificar si hay API disponible
        const apiToUse = window.electronAPI?.saveFollowUp ||
                        window.parent?.electronAPI?.saveFollowUp;

        if (!apiToUse) {
            console.error('[GUARDAR SEGUIMIENTO] API saveFollowUp no disponible');
            this.showNotification('❌ Error: Función de guardado no disponible', 'error');
            return;
        }

        // Mostrar indicador de carga
        const saveButton = document.querySelector('.sp-btn-success');
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }

        // Preparar datos para guardar - ESTRUCTURA ANIDADA para coincidir con Python
        const followUpData = {
            employeeId: seguimientoData.trabajador.cedula,
            employeeName: seguimientoData.trabajador.nombre,
            diagnosis: seguimientoData.incapacidad.descripcionDiagnostico,
            followUpDate: new Date().toISOString().split('T')[0],
            followUpType: 'presencial',
            evolution: seguimientoData.incapacidad.contingencia,
            // 🆕 Enviar array completo de recomendaciones (no un string)
            recommendations: seguimientoData.recomendaciones || [],
            nextFollowUp: seguimientoData.pric.fechaProbableAlta || '',
            caseStatus: 'En seguimiento',
            timestamp: new Date().toISOString(),
            // Datos anidados para coincidir con Python
            trabajador: {
                cedula: seguimientoData.trabajador.cedula,
                nombre: seguimientoData.trabajador.nombre,
                fechaNacimiento: seguimientoData.trabajador.fechaNacimiento || '',
                genero: seguimientoData.trabajador.genero || '',
                fechaIngreso: seguimientoData.trabajador.fechaIngreso || '',
                area: seguimientoData.trabajador.area || '',
                cargo: seguimientoData.trabajador.cargo || '',
                tipoCargo: seguimientoData.trabajador.tipoCargo || '',
                tipoContrato: seguimientoData.trabajador.tipoContrato || '',
                salario: seguimientoData.trabajador.salario || '',
                eps: seguimientoData.trabajador.eps || '',
                afp: seguimientoData.trabajador.afp || '',
                peso: seguimientoData.trabajador.peso || '',
                talla: seguimientoData.trabajador.talla || '',
                imc: seguimientoData.trabajador.imc || '',
                dominancia: seguimientoData.trabajador.dominancia || '',
                actividadesExtralaborales: seguimientoData.trabajador.actividadesExtralaborales || '',
                tipoEvento: seguimientoData.trabajador.tipoEvento || ''
            },
            incapacidad: {
                diasAcumulados: seguimientoData.incapacidad.diasAcumulados || '',
                codigoCie10: seguimientoData.incapacidad.codigoCie10 || '',
                clase: seguimientoData.incapacidad.clase || '',
                fechaInicio: seguimientoData.incapacidad.fechaInicio || '',
                fechaFin: seguimientoData.incapacidad.fechaFin || '',
                descripcionDiagnostico: seguimientoData.incapacidad.descripcionDiagnostico || '',
                cie10Dx2: seguimientoData.incapacidad.cie10Dx2 || '',
                origenDx2: seguimientoData.incapacidad.origenDx2 || '',
                cie10Dx3: seguimientoData.incapacidad.cie10Dx3 || '',
                origenDx3: seguimientoData.incapacidad.origenDx3 || '',
                fechaReincorporacion: seguimientoData.incapacidad.fechaReincorporacion || '',
                tipoReintegro: seguimientoData.incapacidad.tipoReintegro || '',
                adaptaciones: seguimientoData.incapacidad.adaptaciones || '',
                fechaCierre: seguimientoData.incapacidad.fechaCierre || '',
                motivoCierre: seguimientoData.incapacidad.motivoCierre || '',
                observacionesFinales: seguimientoData.incapacidad.observacionesFinales || '',
                seguimientos: seguimientoData.incapacidad.seguimientos || []
            },
            pric: {
                fechaExamenMedico: seguimientoData.pric.fechaExamenMedico || '',
                resultadoExamenMedico: seguimientoData.pric.resultadoExamenMedico || '',
                fechaExamenPeriodico: seguimientoData.pric.fechaExamenPeriodico || '',
                resultadoExamenPostIncapacidad: seguimientoData.pric.resultadoExamenPostIncapacidad || '',
                trabajadorRemoto: seguimientoData.pric.trabajadorRemoto || '',
                fechaInicioRemoto: seguimientoData.pric.fechaInicioRemoto || '',
                casoIngresadoPRIC: seguimientoData.pric.casoIngresadoPRIC || '',
                mecanismoDeteccion: seguimientoData.pric.mecanismoDeteccion || '',
                fechaIngresoPRIC: seguimientoData.pric.fechaIngresoPRIC || '',
                trabajadorPlanTratamiento: seguimientoData.pric.trabajadorPlanTratamiento || '',
                metaRehabilitacion: seguimientoData.pric.metaRehabilitacion || '',
                fechaEmisionPlan: seguimientoData.pric.fechaEmisionPlan || '',
                fechaProbableReintegro: seguimientoData.pric.fechaProbableReintegro || '',
                fechaProximaCita: seguimientoData.pric.fechaProximaCita || '',
                observacionesSeguimiento: seguimientoData.pric.observacionesSeguimiento || '',
                fechaAPTReincorporacion: seguimientoData.pric.fechaAPTReincorporacion || '',
                modalidadReincorporacion: seguimientoData.pric.modalidadReincorporacion || '',
                fechaReintegro: seguimientoData.pric.fechaReintegro || '',
                periodicidadSeguimiento: seguimientoData.pric.periodicidadSeguimiento || '',
                recomendacionesLaborales: seguimientoData.pric.recomendacionesLaborales || '',
                fechaVencimientoRecomendaciones: seguimientoData.pric.fechaVencimientoRecomendaciones || '',
                descripcionRecomendaciones: seguimientoData.pric.descripcionRecomendaciones || '',
                fechaProximoSeguimientoRecomendaciones: seguimientoData.pric.fechaProximoSeguimientoRecomendaciones || '',
                tieneDesercion: seguimientoData.pric.tieneDesercion || '',
                logroMejoriaMedica: seguimientoData.pric.logroMejoriaMedica || '',
                fechaSeguimiento1: seguimientoData.pric.fechaSeguimiento1 || '',
                descripcionSeguimiento1: seguimientoData.pric.descripcionSeguimiento1 || '',
                fechaSeguimiento2: seguimientoData.pric.fechaSeguimiento2 || '',
                descripcionSeguimiento2: seguimientoData.pric.descripcionSeguimiento2 || '',
                fechaReincorporacion: seguimientoData.pric.fechaReincorporacion || '',
                tipoReintegro: seguimientoData.pric.tipoReintegro || '',
                adaptaciones: seguimientoData.pric.adaptaciones || '',
                fechaCierre: seguimientoData.pric.fechaCierre || '',
                motivoCierre: seguimientoData.pric.motivoCierre || '',
                fechaCalificacionPCL: seguimientoData.pric.fechaCalificacionPCL || '',
                porcentajePCLCalificacion: seguimientoData.pric.porcentajePCLCalificacion || '',
                cie10CalificadaDX1: seguimientoData.pric.cie10CalificadaDX1 || '',
                origenDX1: seguimientoData.pric.origenDX1 || '',
                cie10CalificadaDX2: seguimientoData.pric.cie10CalificadaDX2 || '',
                origenDX2: seguimientoData.pric.origenDX2 || '',
                cie10CalificadaDX3: seguimientoData.pric.cie10CalificadaDX3 || '',
                origenDX3: seguimientoData.pric.origenDX3 || '',
                cie10CalificadaDX4: seguimientoData.pric.cie10CalificadaDX4 || '',
                origenDX4: seguimientoData.pric.origenDX4 || '',
                origenCaso: seguimientoData.pric.origenCaso || '',
                ingresoSVE: seguimientoData.pric.ingresoSVE || '',
                anioUltimaCalificacionPCL: seguimientoData.pric.anioUltimaCalificacionPCL || '',
                anioSeguimientoEmpresa: seguimientoData.pric.anioSeguimientoEmpresa || ''
            },
            calificacion: {
                // 🆕 Calificación Regional (columnas FC-FI, índices 158-164)
                estadoProcesoRegional: seguimientoData.calificacion.estadoProcesoRegional || '',
                fechaSolicitudRegional: seguimientoData.calificacion.fechaSolicitudRegional || '',
                fechaDictamenRegional: seguimientoData.calificacion.fechaDictamenRegional || '',
                porcentajePclRegional: seguimientoData.calificacion.porcentajePclRegional || '',
                origenCalificacionRegional: seguimientoData.calificacion.origenCalificacionRegional || '',
                fechaEstructuracionRegional: seguimientoData.calificacion.fechaEstructuracionRegional || '',
                observacionesCalificacionRegional: seguimientoData.calificacion.observacionesCalificacionRegional || '',
                // 🆕 Calificación Nacional (columnas FJ-FP, índices 165-171)
                estadoProcesoNacional: seguimientoData.calificacion.estadoProcesoNacional || '',
                fechaSolicitudNacional: seguimientoData.calificacion.fechaSolicitudNacional || '',
                fechaDictamenNacional: seguimientoData.calificacion.fechaDictamenNacional || '',
                porcentajePclNacional: seguimientoData.calificacion.porcentajePclNacional || '',
                origenCalificacionNacional: seguimientoData.calificacion.origenCalificacionNacional || '',
                fechaEstructuracionNacional: seguimientoData.calificacion.fechaEstructuracionNacional || '',
                observacionesCalificacionNacional: seguimientoData.calificacion.observacionesCalificacionNacional || ''
            }
        };

        console.log('[GUARDAR SEGUIMIENTO] Enviando datos:', followUpData);
        console.log('[GUARDAR SEGUIMIENTO] Recomendaciones:', seguimientoData.recomendaciones);
        console.log('[GUARDAR SEGUIMIENTO] Seguimientos:', seguimientoData.incapacidad.seguimientos);
        console.log('[GUARDAR SEGUIMIENTO] Empresa:', this.currentCompany);
        
        // Llamar a la API
        apiToUse(followUpData, this.currentCompany)
            .then(result => {
                console.log('[GUARDAR SEGUIMIENTO] Resultado:', result);
                
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.innerHTML = '<i class="fas fa-save"></i> Guardar Seguimiento';
                }
                
                if (result && result.success) {
                    console.log('[GUARDAR SEGUIMIENTO] ✅ Datos guardados exitosamente');
                    console.log('[GUARDAR SEGUIMIENTO] ¿Es actualización?', esActualizacion, 'Fila:', filaObjetivo);
                    
                    // Mostrar notificación diferente según si actualizó o creó
                    if (esActualizacion && filaObjetivo) {
                        // Registro existente actualizado
                        this.showNotification(
                            `📝 Registro ACTUALIZADO en fila ${filaObjetivo} para ${followUpData.employeeName}`, 
                            'success'
                        );
                        console.log('[GUARDAR SEGUIMIENTO] 📝 Registro actualizado en fila:', filaObjetivo);
                    } else if (result.actualizado) {
                        // Registro existente actualizado (viene del backend)
                        this.showNotification(
                            `📝 Registro ACTUALIZADO en fila ${result.fila} para ${followUpData.employeeName}`, 
                            'success'
                        );
                        console.log('[GUARDAR SEGUIMIENTO] 📝 Registro actualizado (backend) en fila:', result.fila);
                    } else {
                        // Registro nuevo creado
                        this.showNotification(
                            `➕ Registro CREADO para ${followUpData.employeeName}`, 
                            'success'
                        );
                        console.log('[GUARDAR SEGUIMIENTO] ✅ Registro creado');
                    }
                    
                    // 🆕 ACTUALIZAR LA TABLA AUTOMÁTAMENTE DESPUÉS DE GUARDAR
                    console.log('[GUARDAR SEGUIMIENTO] 🔄 Actualizando tabla de seguimiento...');
                    this.loadSeguimientoData()
                        .then(() => {
                            console.log('[GUARDAR SEGUIMIENTO] ✅ Tabla actualizada correctamente');
                        })
                        .catch(error => {
                            console.error('[GUARDAR SEGUIMIENTO] ❌ Error actualizando tabla:', error);
                        });
                    
                    // Cerrar el panel después de un breve delay
                    setTimeout(() => {
                        this.closeSeguimientoPanel();
                    }, 2000);
                } else {
                    const errorMsg = result?.error || 'Error desconocido';
                    console.error('[GUARDAR SEGUIMIENTO] ❌ Error:', errorMsg);
                    this.showNotification('❌ Error al guardar: ' + errorMsg, 'error');
                }
            })
            .catch(error => {
                console.error('[GUARDAR SEGUIMIENTO] ❌ Error en la llamada:', error);
                
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.innerHTML = '<i class="fas fa-save"></i> Guardar Seguimiento';
                }
                
                this.showNotification('❌ Error al guardar: ' + error.message, 'error');
            });
    }

    async renderRegistrarAusentismoView(container) {
        console.log('[DEBUG] renderRegistrarAusentismoView: Iniciando renderizado del formulario modernizado.');
        container.innerHTML = '';

        // Contenedor wrapper con scroll condicional
        const scrollWrapper = document.createElement('div');
        scrollWrapper.id = 'registrar-ausentismo-scroll-wrapper';
        scrollWrapper.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
        `;

        // Contenedor principal modernizado
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      width: 100%;
      min-height: 100%;
      box-sizing: border-box;
        `;

        // 📦443 (2026-06-25) — Notificación toast ELIMINADA.
        // Antes había un notificationDiv con position:fixed + translateX(120%)
        // que asomaba una franja verde en la esquina superior derecha (sistema
        // viejo de notificaciones). Ahora todo va por window.parent.updateNotifier
        // (sistema estándar del proyecto, mismo que 6.1.3), así que ya no
        // necesitamos este div. Si el fallback del showNotification legacy
        // llega a buscarlo, simplemente no mostrará nada (mejor que el viejo
        // div verde que se asomaba).

        // Contenedor del formulario
        const formContainer = document.createElement('div');
        formContainer.className = 'registrar-ausentismo-form';
        formContainer.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            border: 1px solid #dee2e6;
        `;

        // Header del formulario con botón volver
        const formHeader = document.createElement('div');
        formHeader.className = 'form-header-responsive';
        formHeader.style.cssText = `
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        `;
        
        const leftSection = document.createElement('div');
        leftSection.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const formIcon = document.createElement('i');
        formIcon.className = 'fas fa-plus-circle';
        formIcon.style.cssText = `color: #174ea6; font-size: 20px;`;
        
        const formTitleContainer = document.createElement('div');
        const formTitle = document.createElement('h3');
        formTitle.textContent = 'Formulario de Registro';
        formTitle.style.cssText = `font-size: 18px; font-weight: 600; margin: 0; color: #1E293B;`;
        
        const formSubtitle = document.createElement('p');
        formSubtitle.textContent = 'Ingrese los datos completos para registrar una nueva incapacidad.';
        formSubtitle.style.cssText = `font-size: 14px; color: #64748B; margin: 4px 0 0 0;`;
        
        formTitleContainer.appendChild(formTitle);
        formTitleContainer.appendChild(formSubtitle);
        leftSection.appendChild(formIcon);
        leftSection.appendChild(formTitleContainer);
        
        // Botón Volver
        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
        backBtn.style.cssText = `
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #dee2e6;
            background-color: #f8f9fa;
            color: #64748B;
            transition: all 0.2s;
            white-space: nowrap;
        `;
        backBtn.onmouseover = function() {
            this.style.backgroundColor = '#e2e8f0';
            this.style.color = '#174ea6';
            this.style.borderColor = '#174ea6';
        };
        backBtn.onmouseout = function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.color = '#64748B';
            this.style.borderColor = '#dee2e6';
        };
        backBtn.onclick = () => {
            this.currentView = 'main';
            this.render();
        };
        
        formHeader.appendChild(leftSection);
        formHeader.appendChild(backBtn);
        formContainer.appendChild(formHeader);

        // Área de estado (oculta por defecto)
        const statusDiv = document.createElement('div');
        statusDiv.id = 'form-status';
        statusDiv.style.cssText = `
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 8px;
            font-weight: 500;
            text-align: center;
            display: none;
        `;
        formContainer.appendChild(statusDiv);

        // Agregar estilos responsivos
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            .form-grid-responsive {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
            }
      .form-grid-responsive .full-width {
        grid-column: span 2;
      }
      @media (min-width: 1200px) {
        .form-grid-responsive {
          grid-template-columns: repeat(3, 1fr);
        }
        .form-grid-responsive .full-width {
          grid-column: span 3;
        }
      }
      @media (max-width: 768px) {
                .form-grid-responsive {
                    grid-template-columns: 1fr;
                }
                .form-grid-responsive .full-width {
                    grid-column: span 1;
                }
                .form-header-responsive {
                    flex-direction: column !important;
                    align-items: flex-start !important;
                }
                .form-header-responsive .back-btn {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        formContainer.appendChild(styleTag);

        // Formulario con grid layout responsivo
        const form = document.createElement('form');
        form.id = 'registrar-ausentismo-form';
        form.className = 'form-grid-responsive';

        form.innerHTML = `
            <div class="form-group-modern">
                <label for="cedula-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Cédula del Empleado</label>
                <input type="text" id="cedula-input" class="form-control-modern" placeholder="Ej: 12345678" 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="nombre-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Nombre Completo</label>
                <input type="text" id="nombre-input" class="form-control-modern" placeholder="Nombre completo" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="cargo-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Cargo</label>
                <input type="text" id="cargo-input" class="form-control-modern" placeholder="Cargo actual" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="departamento-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Departamento / Área</label>
                <input type="text" id="departamento-input" class="form-control-modern" placeholder="Departamento" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="empresa-usuaria-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Empresa Usuaria</label>
                <input type="text" id="empresa-usuaria-input" class="form-control-modern" placeholder="Empresa donde presta el servicio" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="genero-select" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Género</label>
                <select id="genero-select" class="form-control-modern" 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                </select>
            </div>

            <div class="form-group-modern">
                <label for="clase-incapacidad-select" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Clase de Incapacidad</label>
                <select id="clase-incapacidad-select" class="form-control-modern" required
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="EPS">EPS</option>
                    <option value="ARL">ARL</option>
                    <option value="EMPRESA">EMPRESA</option>
                </select>
            </div>

            <div class="form-group-modern">
                <label for="tipo-incapacidad-select" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Tipo de Incapacidad</label>
                <select id="tipo-incapacidad-select" class="form-control-modern" required
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="ACCIDENTE DE TRANSITO">ACCIDENTE DE TRANSITO</option>
                    <option value="ACCIDENTE LABORAL">ACCIDENTE LABORAL</option>
                    <option value="ENFERMEDAD GENERAL">ENFERMEDAD GENERAL</option>
                    <option value="LICENCIA DE LUTO">LICENCIA DE LUTO</option>
                    <option value="LICENCIA DE MATERNIDAD">LICENCIA DE MATERNIDAD</option>
                    <option value="LICENCIA DE PATERNIDAD">LICENCIA DE PATERNIDAD</option>
                    <option value="CALAMIDAD DOMÉSTICA">CALAMIDAD DOMÉSTICA</option>
                </select>
            </div>

            <div class="form-group-modern">
                <label for="entidad-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Entidad (EPS/ARL)</label>
                <input type="text" id="entidad-input" class="form-control-modern" placeholder="Entidad de salud" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="fecha-inicio-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Fecha de Inicio</label>
                <input type="date" id="fecha-inicio-input" class="form-control-modern" required
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="fecha-fin-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Fecha de Finalización</label>
                <input type="date" id="fecha-fin-input" class="form-control-modern" required
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="codigo-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Código Diagnóstico (CIE-10)</label>
                <input type="text" id="codigo-input" class="form-control-modern" placeholder="Ej: Z34.0"
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern full-width">
                <label for="descripcion-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Descripción Diagnóstico</label>
                <input type="text" id="descripcion-input" class="form-control-modern" placeholder="Descripción del diagnóstico"
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-actions-modern full-width" style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 15px; border-top: 1px solid #dee2e6; padding-top: 20px; flex-wrap: wrap;">
                <button type="button" id="limpiar-btn" class="btn btn-secondary-modern"
                    style="padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #dee2e6; background-color: #f8f9fa; color: #1E293B; transition: all 0.2s;"
                    onmouseover="this.style.backgroundColor='#e2e8f0'; this.style.transform='translateY(-1px)'"
                    onmouseout="this.style.backgroundColor='#f8f9fa'; this.style.transform='translateY(0)'">
                    <i class="fas fa-eraser"></i> Limpiar
                </button>
                <button type="button" id="registrar-btn" class="btn btn-primary-modern"
                    style="padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: none; background-color: #174ea6; color: white; transition: all 0.2s;"
                    onmouseover="this.style.backgroundColor='#185abd'; this.style.transform='translateY(-1px)'"
                    onmouseout="this.style.backgroundColor='#174ea6'; this.style.transform='translateY(0)'">
                    <i class="fas fa-save"></i> Registrar Incapacidad
                </button>
            </div>
        `;

        formContainer.appendChild(form);
        mainContent.appendChild(formContainer);
        scrollWrapper.appendChild(mainContent);
        container.appendChild(scrollWrapper);

        // Setup de eventos
        setTimeout(() => {
            console.log('Event listeners setup started');
            console.log('Current company:', this.currentCompany);

            console.log('[DEBUG] Setup búsqueda de empleado habilitado. Escribe una cédula y presiona Tab.');

            // 1. Autocompletar al salir del campo Cédula
            const cedulaInput = document.getElementById('cedula-input');
            if (cedulaInput) {
                console.log('Cédula input found, adding blur event listener');
                cedulaInput.addEventListener('blur', async () => {
                    const cedula = cedulaInput.value.trim();
                    console.log('[DEBUG cedula blur] cedula:', cedula);
                    if (!cedula) return;

                    /* 📦443 (2026-06-25) — loading=true para mostrar spinner
                       animado durante la búsqueda asíncrona del empleado. */
                    this.showStatus(statusDiv, 'Buscando empleado...', 'info', true);

                    try {
                        const result = await window.electronAPI.buscarEmpleadoPorCedula(cedula, this.currentCompany);
                        console.log('[DEBUG buscarEmpleado] result:', JSON.stringify(result));

                        if (result && result.success) {
                            console.log('[DEBUG buscarEmpleado] datos:', JSON.stringify(result.datos));
                            document.getElementById('nombre-input').value = result.datos.nombre || '';
                            document.getElementById('cargo-input').value = result.datos.cargo || '';
                            document.getElementById('departamento-input').value = result.datos.area || '';
                            document.getElementById('empresa-usuaria-input').value = result.datos.empresa_usuaria || '';
                            document.getElementById('entidad-input').value = result.datos.entidad || '';

                            // ✅ VALIDACIÓN: Verificar si el empleado pertenece a la empresa seleccionada
                            const empresaSeleccionada = this.currentCompany.toUpperCase();
                            const empresaEmpleado = (result.datos.empresa || '').toUpperCase();
                            
                            if (empresaEmpleado && empresaSeleccionada !== empresaEmpleado) {
                                // ⚠️ ALERTA: El empleado pertenece a otra empresa - Mostrar modal personalizado
                                this.showEmpresaMismatchModal(
                                    result.datos.nombre,
                                    result.datos.empresa,
                                    this.currentCompany,
                                    () => {
                                        // Usuario confirmó - continuar con el registro
                                        /* 📦443 — Mini-tarjeta con datos del empleado en lugar de mensaje plano */
                                        this._showEmpleadoCard(statusDiv, result.datos);
                                    },
                                    () => {
                                        // Usuario canceló - limpiar formulario
                                        this.showStatus(statusDiv, 'Búsqueda cancelada. Empleado no pertenece a esta empresa.', 'warning');
                                        document.getElementById('nombre-input').value = '';
                                        document.getElementById('cargo-input').value = '';
                                        document.getElementById('departamento-input').value = '';
                                        document.getElementById('empresa-usuaria-input').value = '';
                                        document.getElementById('entidad-input').value = '';
                                    }
                                );
                            } else {
                                // ✅ Empleado de la misma empresa
                                /* 📦443 — Mini-tarjeta con datos del empleado en lugar de mensaje plano */
                                this._showEmpleadoCard(statusDiv, result.datos);
                            }
                        } else {
                            this.showStatus(statusDiv, 'Empleado no encontrado. Diligencie manualmente.', 'warning');
                            document.getElementById('nombre-input').value = '';
                            document.getElementById('cargo-input').value = '';
                            document.getElementById('departamento-input').value = '';
                            document.getElementById('empresa-usuaria-input').value = '';
                            document.getElementById('entidad-input').value = '';
                        }
                    } catch (error) {
                        console.error('Error buscando empleado:', error);
                        this.showStatus(statusDiv, `Error: ${error.message}`, 'error');
                    }
                });
            }

            // 2. Autocompletar descripción CIE-10
            const codigoInput = document.getElementById('codigo-input');
            if (codigoInput) {
                codigoInput.addEventListener('blur', async () => {
                    const cie10Code = codigoInput.value.trim();
                    if (!cie10Code) return;

                    /* 📦443 (2026-06-25) — loading=true para mostrar spinner
                       animado durante la búsqueda asíncrona del CIE-10. */
                    this.showStatus(statusDiv, 'Buscando descripción...', 'info', true);

                    try {
                        const result = await window.electronAPI.buscarCie10Descripcion(this.currentCompany, cie10Code);

                        if (result && result.success) {
                            document.getElementById('descripcion-input').value = result.datos.descripcion || '';
                            /* 📦443 — Mensaje enriquecido con código + descripción */
                            this.showStatus(
                                statusDiv,
                                '<strong>CIE-10 ' + this._escapeHtml(cie10Code) + '</strong> · ' + this._escapeHtml(result.datos.descripcion || ''),
                                'success'
                            );
                        } else {
                            this.showStatus(statusDiv, 'Descripción no encontrada para el código ' + cie10Code + '. Verifica o digita manualmente.', 'warning');
                            document.getElementById('descripcion-input').value = '';
                        }
                    } catch (error) {
                        this.showStatus(statusDiv, `Error: ${error.message}`, 'error');
                    }
                });
            }

            // 3. Autocompletar código y descripción CIE-10 para LICENCIA DE LUTO
            const tipoIncapacidadSelect = document.getElementById('tipo-incapacidad-select');
            if (tipoIncapacidadSelect) {
                tipoIncapacidadSelect.addEventListener('change', async () => {
                    const tipoIncapacidad = tipoIncapacidadSelect.value;
                    const codigoInput = document.getElementById('codigo-input');
                    const descripcionInput = document.getElementById('descripcion-input');

                    // Si es LICENCIA DE LUTO, autocompletar código y descripción
                    if (tipoIncapacidad === 'LICENCIA DE LUTO') {
                        codigoInput.value = 'Z63.4';
                        descripcionInput.value = 'Luto';
                        this.showStatus(statusDiv, 'Código CIE-10 autocompletado para Licencia de Luto.', 'info');
                    }
                });
            }

            // 3. Registrar incapacidad
            const registrarBtn = document.getElementById('registrar-btn');
            if (registrarBtn) {
                registrarBtn.addEventListener('click', async () => {
                    const formData = this.getFormData();
                    if (!this.validateFormData(formData)) {
                        this.showStatus(statusDiv, 'Complete campos obligatorios.', 'error');
                        return;
                    }

                    if (new Date(formData.fecha_inicio) > new Date(formData.fecha_finalizacion)) {
                        this.showStatus(statusDiv, 'Fecha inicio no puede ser posterior a fecha fin.', 'error');
                        return;
                    }

                    this.showNotification('Registrando incapacidad...', 'info');
                    this.disableForm(true);

                    try {
                        const ausentismoResult = await window.electronAPI.readAusentismoData(this.currentCompany);
                        // 📦459 (2026-07-02) — Registrar incapacidad SÍ es bloqueante (sin
                        // archivo no podemos escribir). Distinguimos modo degradado
                        // (_missingFile:true) para mostrar mensaje útil vs error genérico.
                        if (!ausentismoResult.success) throw new Error(ausentismoResult.error);
                        if (ausentismoResult._missingFile) {
                            const msg = this._getMissingFileMessage(
                                ausentismoResult._missingFileReason,
                                ausentismoResult._details
                            );
                            throw new Error(
                                `No se puede registrar la incapacidad: ${msg.title}. ` +
                                `${msg.action}. (${ausentismoResult._expectedDir || 'ruta desconocida'})`
                            );
                        }

                        const result = await window.electronAPI.procesarAusentismo(this.currentCompany, formData);

                        if (result.success) {
                            this.showNotification('¡Incapacidad registrada exitosamente!', 'success');
                            this.limpiarFormulario();
                            statusDiv.style.display = 'none';
                        } else {
                            throw new Error(result.error);
                        }
                    } catch (error) {
                        this.showNotification(`Error: ${error.message}`, 'error');
                    } finally {
                        this.disableForm(false);
                    }
                });
            }

            // 4. Limpiar formulario
            const limpiarBtn = document.getElementById('limpiar-btn');
            if (limpiarBtn) {
                limpiarBtn.addEventListener('click', () => {
                    this.limpiarFormulario();
                    statusDiv.style.display = 'none';
                    this.showNotification('Formulario limpiado.', 'info');
                });
            }
        }, 0);
    }

    // --- Funciones Auxiliares para el Formulario ---

    /**
     * 📦443 (2026-06-25) — Muestra una mini-tarjeta de éxito con los datos
     * del empleado encontrado. Reemplaza el mensaje plano "Empleado
     * encontrado" con una card visual que incluye:
     *  - Avatar circular con las iniciales del empleado (animado)
     *  - Check verde animado (scale-in)
     *  - Nombre destacado
     *  - Cédula en formato "Cédula 12345"
     *  - Cargo · Departamento · Empresa (línea secundaria)
     *  - Mensaje de confirmación en la parte inferior
     * @param {HTMLElement} statusDiv - Elemento contenedor del estado
     * @param {Object} datos - Datos del empleado (nombre, cedula, cargo, area, empresa, etc.)
     */
    _showEmpleadoCard(statusDiv, datos) {
        var nombre = (datos.nombre || 'Empleado').trim();
        var cedula = (datos.cedula || '').trim();
        var cargo = (datos.cargo || '').trim();
        var area = (datos.area || '').trim();
        var empresa = (datos.empresa || datos.empresa_usuaria || '').trim();

        // 📦443 (2026-06-25) — Asegurar visibilidad: display:block y limpiar
        // estilos inline conflictivos de llamadas anteriores.
        statusDiv.style.display = 'block';
        statusDiv.style.removeProperty('cssText');
        statusDiv.className = 'status-message status-message--empleado';

        // Construir lista de detalles (cargo · área · empresa)
        var detalles = [];
        if (cargo) detalles.push('<i class="bi bi-briefcase"></i> ' + this._escapeHtml(cargo));
        if (area) detalles.push('<i class="bi bi-geo-alt"></i> ' + this._escapeHtml(area));
        if (empresa) detalles.push('<i class="bi bi-building"></i> ' + this._escapeHtml(empresa));

        // 📦443 (2026-06-25) — Diseño minimalista con icono de persona.
        // Reemplaza el avatar morado por un círculo con icono bi-person-fill.
        // El icono es universal (no requiere iniciales ni cálculo de hash)
        // y combina mejor con el estilo general del formulario.
        statusDiv.innerHTML =
            '<div class="km-empleado-card">' +
                '<div class="km-empleado-card__icon">' +
                    '<i class="bi bi-person-fill"></i>' +
                '</div>' +
                '<div class="km-empleado-card__body">' +
                    '<div class="km-empleado-card__name">' + this._escapeHtml(nombre) + '</div>' +
                    (cedula ? '<div class="km-empleado-card__cedula"><i class="bi bi-credit-card-2-front"></i> Cédula ' + this._escapeHtml(cedula) + '</div>' : '') +
                    (detalles.length > 0
                        ? '<div class="km-empleado-card__details">' + detalles.join('<span class="km-empleado-card__sep">·</span>') + '</div>'
                        : '') +
                    '<div class="km-empleado-card__success-msg">' +
                        '<i class="bi bi-check-circle-fill"></i> Empleado encontrado. Puede continuar con el registro.' +
                    '</div>' +
                '</div>' +
            '</div>';
    }

    /**
     * Helper para escapar HTML y prevenir XSS en los datos del empleado
     * (que vienen del backend y no son sanitizados).
     */
    _escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Muestra mensaje de estado moderno con icono y animación
     * @param {HTMLElement} statusDiv - Elemento contenedor del estado
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo de estado: 'success', 'error', 'warning', 'info'
     * @param {boolean} loading - Si true, muestra spinner animado de búsqueda
     */
    showStatus(statusDiv, message, type, loading) {
        statusDiv.style.display = 'block';
        statusDiv.className = loading ? 'status-message status-message--loading' : 'status-message';

        // Definir configuración por tipo
        const config = {
            success: {
                icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
                bg: '#F0FDF4',
                border: '#86EFAC',
                text: '#166534',
                iconBg: '#DCFCE7'
            },
            error: {
                icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
                bg: '#FEF2F2',
                border: '#FCA5A5',
                text: '#991B1B',
                iconBg: '#FEE2E2'
            },
            warning: {
                icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
                bg: '#FFFBEB',
                border: '#FCD34D',
                text: '#92400E',
                iconBg: '#FEF3C7'
            },
            info: {
                icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
                bg: '#EFF6FF',
                border: '#93C5FD',
                text: '#1E40AF',
                iconBg: '#DBEAFE'
            }
        };

        const currentConfig = config[type] || config.info;

        // Aplicar estilos modernos (con position:relative cuando loading para shimmer)
        statusDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 18px;
            background: ${currentConfig.bg};
            border: 1px solid ${currentConfig.border};
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
            color: ${currentConfig.text};
            animation: slideDown 0.3s ease-out;
            margin-bottom: 20px;
            ${loading ? 'position: relative; overflow: hidden;' : ''}
        `;

        // 📦443 (2026-06-25) — Contenido con icono estático O spinner animado.
        // Cuando loading=true (búsqueda asíncrona), mostramos:
        // 1. Spinner de 3 anillos rotando (en lugar del icono info estático)
        // 2. Shimmer effect de fondo (barrido de luz que indica "buscando")
        var iconHtml;
        if (loading) {
            iconHtml = '<div class="km-loading-spinner km-loading-spinner--sm">' +
                          '<div class="km-loading-spinner__ring"></div>' +
                          '<div class="km-loading-spinner__ring"></div>' +
                          '<div class="km-loading-spinner__ring"></div>' +
                       '</div>';
        } else {
            iconHtml = '<div style="' +
                'width: 36px;' +
                'height: 36px;' +
                'border-radius: 50%;' +
                'background: ' + currentConfig.iconBg + ';' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: center;' +
                'flex-shrink: 0;' +
                'color: ' + currentConfig.text + ';' +
            '">' +
                currentConfig.icon +
            '</div>';
        }

        // Shimmer effect: capa con gradiente animado que se desplaza horizontalmente
        var shimmerHtml = loading
            ? '<div class="km-status-shimmer"></div>'
            : '';

        statusDiv.innerHTML = shimmerHtml +
            '<div class="km-status-icon-wrap">' + iconHtml + '</div>' +
            '<span style="flex: 1;">' + message + '</span>';

        // Agregar animación si no existe
        if (!document.getElementById('status-animations')) {
            const style = document.createElement('style');
            style.id = 'status-animations';
            style.textContent = `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    showNotification(message, type = 'success') {
        const notificationDiv = document.getElementById('notification-toast');
        if (!notificationDiv) return;
        
        notificationDiv.textContent = message;
        notificationDiv.style.borderLeftColor = type === 'error' ? '#dc3545' : '#28a745';
        notificationDiv.style.transform = 'translateX(0)';

        setTimeout(() => {
            notificationDiv.style.transform = 'translateX(120%)';
        }, 3000);
    }

    disableForm(disabled) {
        const inputs = document.querySelectorAll('.registrar-ausentismo-form input, .registrar-ausentismo-form select, .registrar-ausentismo-form button');
        inputs.forEach(input => input.disabled = disabled);
    }

    getFormData() {
        return {
            cedula: document.getElementById('cedula-input').value.trim(),
            nombre: document.getElementById('nombre-input').value.trim(),
            cargo: document.getElementById('cargo-input').value.trim(),
            departamento: document.getElementById('departamento-input').value.trim(),
            empresa_usuaria: document.getElementById('empresa-usuaria-input').value.trim(),
            genero: document.getElementById('genero-select').value,
            entidad: document.getElementById('entidad-input').value.trim(),
            clase_incapacidad: document.getElementById('clase-incapacidad-select').value,
            tipo_incapacidad: document.getElementById('tipo-incapacidad-select').value,
            fecha_inicio: document.getElementById('fecha-inicio-input').value,
            fecha_finalizacion: document.getElementById('fecha-fin-input').value,
            codigo: document.getElementById('codigo-input').value.trim(),
            descripcion: document.getElementById('descripcion-input').value.trim()
        };
    }

    validateFormData(data) {
        // Campos obligatorios
        const requiredFields = ['cedula', 'nombre', 'clase_incapacidad', 'tipo_incapacidad', 'fecha_inicio', 'fecha_finalizacion'];
        for (const field of requiredFields) {
            if (!data[field]) {
                return false;
            }
        }
        return true;
    }

    limpiarFormulario() {
    // Limpiar campos de entrada
    const inputs = document.querySelectorAll('.registrar-ausentismo-form input:not([type="button"])');
    inputs.forEach(input => input.value = '');

    // Limpiar selects
    const selects = document.querySelectorAll('.registrar-ausentismo-form select');
    selects.forEach(select => select.selectedIndex = 0);

    // Los campos readonly ya se limpian explícitamente
    document.getElementById('nombre-input').value = '';
    document.getElementById('cargo-input').value = '';
    document.getElementById('departamento-input').value = '';
    document.getElementById('empresa-usuaria-input').value = '';
    document.getElementById('entidad-input').value = '';
    }

    /**
     * Muestra modal personalizado de advertencia por empresa diferente
     * @param {string} nombreEmpleado - Nombre del empleado encontrado
     * @param {string} empresaEmpleado - Empresa a la que pertenece el empleado
     * @param {string} empresaSeleccionada - Empresa actualmente seleccionada en la UI
     * @param {Function} onConfirm - Callback cuando el usuario confirma
     * @param {Function} onCancel - Callback cuando el usuario cancela
     */
    showEmpresaMismatchModal(nombreEmpleado, empresaEmpleado, empresaSeleccionada, onConfirm, onCancel) {
        // Crear overlay del modal
        const overlay = document.createElement('div');
        overlay.id = 'empresa-mismatch-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            animation: fadeIn 0.2s ease-out;
        `;

        // Crear modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            max-width: 500px;
            width: 90%;
            overflow: hidden;
            animation: slideUp 0.3s ease-out;
        `;

        // Header del modal
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px 24px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        // Icono de advertencia
        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #FEF3C7;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        `;
        iconContainer.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400E" stroke-width="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
        `;

        // Título
        const title = document.createElement('h3');
        title.textContent = '⚠️ Empresa Diferente';
        title.style.cssText = `
            font-size: 16px;
            font-weight: 600;
            color: #1E293B;
            margin: 0;
        `;

        header.appendChild(iconContainer);
        header.appendChild(title);

        // Cuerpo del modal
        const body = document.createElement('div');
        body.style.cssText = `
            padding: 24px;
        `;

        // Mensaje
        const message = document.createElement('div');
        message.style.cssText = `
            font-size: 14px;
            color: #64748B;
            line-height: 1.6;
            margin-bottom: 16px;
        `;
        message.innerHTML = `
            El empleado <strong style="color: #1E293B;">${nombreEmpleado}</strong> pertenece a la empresa 
            <strong style="color: #174ea6;">${empresaEmpleado}</strong>, pero usted está registrado en 
            <strong style="color: #174ea6;">${empresaSeleccionada}</strong>.
        `;

        // Nota informativa
        const note = document.createElement('div');
        note.style.cssText = `
            background: #F8FAFC;
            border-left: 3px solid #174ea6;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 13px;
            color: #475569;
        `;
        note.innerHTML = `
            <strong>Nota:</strong> Los datos se guardarán en el archivo de 
            <strong>${empresaSeleccionada}</strong>. Asegúrese de que esta sea la empresa correcta 
            antes de continuar.
        `;

        body.appendChild(message);
        body.appendChild(note);

        // Footer con botones
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 16px 24px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: #F8FAFC;
        `;

        // Botón Cancelar
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid #dee2e6;
            background: white;
            color: #64748B;
            transition: all 0.2s;
        `;
        cancelBtn.onmouseover = function() {
            this.style.backgroundColor = '#f1f5f9';
            this.style.borderColor = '#cbd5e1';
        };
        cancelBtn.onmouseout = function() {
            this.style.backgroundColor = 'white';
            this.style.borderColor = '#dee2e6';
        };
        cancelBtn.onclick = () => {
            overlay.remove();
            if (onCancel) onCancel();
        };

        // Botón Confirmar
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Continuar';
        confirmBtn.style.cssText = `
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            background: #174ea6;
            color: white;
            transition: all 0.2s;
        `;
        confirmBtn.onmouseover = function() {
            this.style.backgroundColor = '#185abd';
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 4px 6px -1px rgba(23, 78, 166, 0.3)';
        };
        confirmBtn.onmouseout = function() {
            this.style.backgroundColor = '#174ea6';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        };
        confirmBtn.onclick = () => {
            overlay.remove();
            if (onConfirm) onConfirm();
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        // Ensamblar modal
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);

        // Agregar al documento
        document.body.appendChild(overlay);

        // Agregar animaciones CSS dinámicamente
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);

        // Enfocar botón de confirmar por defecto
        setTimeout(() => confirmBtn.focus(), 100);
    }

    renderVerAusentismoView(container) {
        console.log('[DEBUG] renderVerAusentismoView: Iniciando renderizado de lista de registros.');
        container.innerHTML = '';

        // Contenedor wrapper con scroll condicional
        const scrollWrapper = document.createElement('div');
        scrollWrapper.id = 'ver-ausentismo-scroll-wrapper';
        scrollWrapper.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
        `;

        // Contenedor principal modernizado
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
            width: 100%;
            min-height: 100%;
            box-sizing: border-box;
        `;

        // 📦443 (2026-06-25) — Notificación toast ELIMINADA (sistema legacy).
        // Ahora todo va por window.parent.updateNotifier (estándar K+AIR).

        // Contenedor de la lista
        const listContainer = document.createElement('div');
        listContainer.className = 'ver-ausentismo-list';
        listContainer.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            border: 1px solid #dee2e6;
        `;

        // Header de la lista
        const listHeader = document.createElement('div');
        listHeader.style.cssText = `
            padding: 20px 25px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        `;

        const leftSection = document.createElement('div');
        leftSection.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        const listIcon = document.createElement('i');
        listIcon.className = 'fas fa-list-ul';
        listIcon.style.cssText = `color: #174ea6; font-size: 20px;`;

        const listTitleContainer = document.createElement('div');
        const listTitle = document.createElement('h3');
        listTitle.textContent = 'Registros de Ausentismo';
        listTitle.style.cssText = `font-size: 18px; font-weight: 600; margin: 0; color: #1E293B;`;

        const listSubtitle = document.createElement('p');
        listSubtitle.textContent = 'Consulta y filtra el histórico de incapacidades.';
        listSubtitle.style.cssText = `font-size: 14px; color: #64748B; margin: 4px 0 0 0;`;

        listTitleContainer.appendChild(listTitle);
        listTitleContainer.appendChild(listSubtitle);
        leftSection.appendChild(listIcon);
        leftSection.appendChild(listTitleContainer);

        // Botón Volver
        const backBtn = document.createElement('button');
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
        backBtn.style.cssText = `
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #dee2e6;
            background-color: #f8f9fa;
            color: #64748B;
            transition: all 0.2s;
            white-space: nowrap;
        `;
        backBtn.onmouseover = function() {
            this.style.backgroundColor = '#e2e8f0';
            this.style.color = '#174ea6';
            this.style.borderColor = '#174ea6';
        };
        backBtn.onmouseout = function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.color = '#64748B';
            this.style.borderColor = '#dee2e6';
        };
        backBtn.onclick = () => {
            this.currentView = 'main';
            this.render();
        };

        listHeader.appendChild(leftSection);
        listHeader.appendChild(backBtn);
        listContainer.appendChild(listHeader);

        // Barra de filtros
        const filtersBar = document.createElement('div');
        filtersBar.style.cssText = `
            padding: 20px 25px;
            border-bottom: 1px solid #dee2e6;
            background: #f8f9fa;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        `;

        filtersBar.innerHTML = `
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Buscar</label>
                <input type="text" id="searchFilter" placeholder="Nombre, Cédula..." 
                    style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
            </div>
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Año</label>
                <select id="yearFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Cargando años...</option>
                </select>
            </div>
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Mes</label>
                <select id="monthFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Todos</option>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
            </div>
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Tipo</label>
                <select id="typeFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Cargando tipos...</option>
                </select>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 10px;">
                <button id="applyFiltersBtn" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background-color: #174ea6; color: white; transition: all 0.2s;">
                    <i class="fas fa-filter"></i> Filtrar
                </button>
                <button id="clearFiltersBtn" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #dee2e6; background-color: #f8f9fa; color: #64748B; transition: all 0.2s;">
                    <i class="fas fa-times"></i> Limpiar
                </button>
            </div>
        `;

        listContainer.appendChild(filtersBar);

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'ausentismo-table-wrapper';
        tableWrapper.style.cssText = `
            overflow-x: auto;
            overflow-y: auto;
            max-height: calc(100vh - 400px);
            min-height: 400px;
            border-radius: 8px;
        `;

        // Agregar estilos para scrollbar personalizado
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            .ausentismo-table-wrapper::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }
            .ausentismo-table-wrapper::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 8px;
            }
            .ausentismo-table-wrapper::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 8px;
            }
            .ausentismo-table-wrapper::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
            .ausentismo-table {
                width: 100%;
                min-width: fit-content;
            }
        `;
        listContainer.appendChild(styleTag);

        const table = document.createElement('table');
        table.className = 'ausentismo-table';
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
        `;

        table.innerHTML = `
            <thead>
                <tr>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">No</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Nombre</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Cédula</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Cargo</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Empresa Usuaria</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Área/Dpto</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Género</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Mes</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">N° Días</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Clase</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Tipo</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Entidad</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Año</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Fecha Inicio</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Fecha Fin</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Código</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Descripción</th>
                </tr>
            </thead>
            <tbody id="ausentismoTableBody">
                <tr>
                    <td colspan="17" class="ks-loading-cell" style="padding: 16px;">
                        ${KairSkeleton.table(12, 17)}
                    </td>
                </tr>
            </tbody>
        `;

        tableWrapper.appendChild(table);
        listContainer.appendChild(tableWrapper);
        mainContent.appendChild(listContainer);
        scrollWrapper.appendChild(mainContent);
        container.appendChild(scrollWrapper);

        // Cargar datos
        this.loadAusentismoData(table);

        // Setup de eventos de filtros
        setTimeout(() => {
            const applyBtn = document.getElementById('applyFiltersBtn');
            const clearBtn = document.getElementById('clearFiltersBtn');

            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    this.applyFilters(table);
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    document.getElementById('searchFilter').value = '';
                    document.getElementById('yearFilter').value = '';
                    document.getElementById('monthFilter').value = '';
                    document.getElementById('typeFilter').value = '';
                    this.loadAusentismoData(table);
                    this.showNotification('Filtros limpiados', 'info');
                });
            }
        }, 0);
    }

    async loadAusentismoData(tableElement, notificationDiv) { // 📦459 — notificationDiv es legacy (DOM notification). Las notificaciones usan window.parent.updateNotifier vía showNotification().
        try {
            const result = await window.electronAPI.readAusentismoData(this.currentCompany);

            // 📦459 — Persistir estado del archivo (también usado por wizard seguimiento)
            if (result && result._missingFile) {
                this.ausentismoFileStatus = {
                    missing: true,
                    reason: result._missingFileReason,
                    expectedDir: result._expectedDir,
                    details: result._details
                };
            } else if (result && result.success) {
                this.ausentismoFileStatus = { missing: false };
            }

            if (result.success && result.rows && !result._missingFile) {
                console.log('[DEBUG] Headers del Excel:', result.headers);
                console.log('[DEBUG] Primera fila de datos:', result.rows[0]);
                
                // Log detallado de headers con índices
                console.log('[DEBUG] Estructura de columnas del Excel:');
                result.headers.forEach((header, i) => {
                    console.log(`  [${i}] ${header} → Valor: ${result.rows[0][i]}`);
                });

                this.currentAusentismoData = result.rows.map((row, index) => {
                    const rowObj = {};
                    
                    // Guardar por índice numérico para acceso directo por posición
                    row.forEach((value, i) => {
                        rowObj[String(i)] = value;
                    });
                    
                    // Guardar también por nombre de encabezado
                    result.headers.forEach((header, i) => {
                        const cleanHeader = header ? header.trim() : `col_${i}`;
                        rowObj[cleanHeader] = row[i];
                        // Guardar también en minúsculas para búsqueda flexible
                        rowObj[cleanHeader.toLowerCase().replace(/\s+/g, '_')] = row[i];
                    });
                    
                    rowObj.no = index + 1;
                    return rowObj;
                });

                // Debug: mostrar las primeras filas con todos sus campos
                console.log('[DEBUG] Primer registro procesado:', this.currentAusentismoData[0]);
                console.log('[DEBUG] Total registros:', this.currentAusentismoData.length);

                this.renderTable(tableElement, this.currentAusentismoData);
                
                // Actualizar filtros con datos reales
                this.populateDynamicFilters();
            } else if (result && result._missingFile) {
                // 📦459 — Modo degradado: banner amarillo + empty state con CTA
                this.renderTable(tableElement, []);
                this.showNotification(
                    `Archivo de ausentismo no disponible. ${this._getMissingFileMessage(result._missingFileReason, result._details).action}.`,
                    'warning'
                );
                // Inyectar banner arriba del contenedor de la tabla
                const tableContainer = tableElement.closest('.ausentismo-table-wrap, .table-container, section') || tableElement.parentElement;
                if (tableContainer) {
                    const oldBanner = tableContainer.querySelector('.km-missing-banner');
                    if (oldBanner) oldBanner.remove();
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = this._ausentismoMissingBannerHtml(
                        { reason: result._missingFileReason, expectedDir: result._expectedDir, details: result._details },
                        { variant: 'warning', retryMethod: 'loadAusentismoData' }
                    );
                    tableContainer.insertBefore(wrapper.firstElementChild, tableContainer.firstChild);
                }
            } else {
                this.renderTable(tableElement, []);
                this.showNotification('No hay registros disponibles', 'warning');
            }
        } catch (error) {
            console.error('Error loading ausentismo data:', error);
            this.renderTable(tableElement, []);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    /**
     * Llena los filtros dinámicos con datos reales del Excel
     */
    populateDynamicFilters() {
        if (!this.currentAusentismoData || this.currentAusentismoData.length === 0) {
            // Si no hay datos, dejar filtros en blanco
            const yearFilter = document.getElementById('yearFilter');
            const typeFilter = document.getElementById('typeFilter');
            if (yearFilter) yearFilter.innerHTML = '<option value="">Todos</option>';
            if (typeFilter) typeFilter.innerHTML = '<option value="">Todos</option>';
            return;
        }

        // 1. Filtro de AÑO - Extraer años únicos de la columna 14 (O) o de F. INICIO
        const yearFilter = document.getElementById('yearFilter');
        if (yearFilter) {
            const yearsSet = new Set();
            
            this.currentAusentismoData.forEach(row => {
                // Intentar obtener año de columna 14 (O) o AÑO
                let year = row['14'] || row.AÑO || row.ANO || '';
                
                // Si no hay año directo, extraer de F. INICIO (columna 15/P)
                if (!year || year === '-') {
                    const fechaInicio = row['15'] || row['F. INICIO'] || '';
                    if (fechaInicio && fechaInicio.length >= 4) {
                        const match = fechaInicio.match(/(19|20)\d{2}/);
                        if (match) {
                            year = match[0];
                        }
                    }
                }
                
                if (year && year !== '-') {
                    yearsSet.add(year);
                }
            });

            // Convertir a array y ordenar descendente
            const years = Array.from(yearsSet).sort((a, b) => b - a);
            
            // Llenar select
            yearFilter.innerHTML = '<option value="">Todos</option>' + 
                years.map(year => `<option value="${year}">${year}</option>`).join('');
            
            console.log('[DEBUG] Filtro de año actualizado:', years);
        }

        // 2. Filtro de TIPO (CLASE DE INCAPACIDAD) - Valores únicos
        const typeFilter = document.getElementById('typeFilter');
        if (typeFilter) {
            const typesSet = new Set();
            
            this.currentAusentismoData.forEach(row => {
                const clase = row['CLASE DE INCAPACIDAD'] || row['11'] || '';
                if (clase && clase !== '-') {
                    typesSet.add(clase.toUpperCase().trim());
                }
            });

            // Convertir a array y ordenar alfabéticamente
            const types = Array.from(typesSet).sort();
            
            // Llenar select
            typeFilter.innerHTML = '<option value="">Todos</option>' + 
                types.map(type => `<option value="${type}">${type}</option>`).join('');
            
            console.log('[DEBUG] Filtro de tipo actualizado:', types);
        }
    }

    applyFilters(tableElement, notificationDiv) { // 📦459 — notificationDiv es legacy. Las notificaciones van por updateNotifier.
        const search = document.getElementById('searchFilter').value.toLowerCase();
        const year = document.getElementById('yearFilter').value;
        const month = document.getElementById('monthFilter').value;
        const type = document.getElementById('typeFilter').value;

        if (!this.currentAusentismoData) {
            this.showNotification('No hay datos cargados', 'warning');
            return;
        }

        let filtered = this.currentAusentismoData.filter(row => {
            const nombre = (row.NOMBRE || row['2'] || '').toLowerCase();
            const cedula = (row.CEDULA || row['3'] || '').toLowerCase();

            // Búsqueda por nombre o cédula
            const matchesSearch = !search || nombre.includes(search) || cedula.includes(search);

            // Filtro por año - Usar columna 14 (O) o AÑO
            const rowYear = row['14'] || row.AÑO || row.ANO || '';
            const matchesYear = !year || rowYear === year;

            // Filtro por mes
            const matchesMonth = !month || {
                '1': 'ENERO', '2': 'FEBRERO', '3': 'MARZO', '4': 'ABRIL',
                '5': 'MAYO', '6': 'JUNIO', '7': 'JULIO', '8': 'AGOSTO',
                '9': 'SEPTIEMBRE', '10': 'OCTUBRE', '11': 'NOVIEMBRE', '12': 'DICIEMBRE'
            }[month] === (row.MES || row['9'] || '').toUpperCase();

            // Filtro por tipo (CLASE DE INCAPACIDAD) - Usar columna 11 (L)
            const rowType = (row['CLASE DE INCAPACIDAD'] || row['11'] || '').toUpperCase();
            const matchesType = !type || rowType === type;

            return matchesSearch && matchesYear && matchesMonth && matchesType;
        });

        this.renderTable(tableElement, filtered);
        this.showNotification(`${filtered.length} registros encontrados`, 'success');
    }

    renderTable(tableElement, data) {
        const tbody = tableElement.querySelector('#ausentismoTableBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="17" style="text-align: center; padding: 40px; color: #64748B;">
                        <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                        <p>No hay registros para mostrar</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map((row, index) => {
            const clase = row['CLASE DE INCAPACIDAD'] || 'EPS';
            const tipo = row['TIPO DE INCAPACIDAD'] || '-';
            let badgeColor = '#dbeafe';
            let badgeText = '#1d4ed8';
            if (clase === 'ARL') {
                badgeColor = '#fef3c7';
                badgeText = '#d97706';
            } else if (clase.includes('LICENCIA')) {
                badgeColor = '#d1fae5';
                badgeText = '#059669';
            }

            // Obtener valores de todas las columnas - Nombres exactos del Excel
            const no = row.no || index + 1;
            const nombre = row.NOMBRE || '-';
            const cedula = row.CEDULA || '-';
            const cargo = row.CARGO || '-';
            const empresaUsuaria = row['EMPRESA USUARIA'] || '-';

            // Buscar columna Área/Dpto con múltiples variaciones (igual que Descripción)
            // Según los headers reales del Excel: "ÁREA O DPTO"
            const areaDpto = row['ÁREA O DPTO'] || row['AREA O DPTO'] ||
                            row['AREA'] || row['ÁREA'] || row['DEPARTAMENTO'] ||
                            row.area_o_dpto || row.area || row.departamento ||
                            row['AREA/DPTO'] || row['ÁREA/DPTO'] || '-';

            const genero = row.GENERO || '-';
            const mes = row.MES || '-';
            const noDias = row['N° DIAS DE INCAPACIDAD'] || '0';
            const entidad = row.ENTIDAD || '-';

            // Nuevas columnas: Búsqueda por índice de columna específico
            // Índice 14 (Columna O): AÑO
            // Índice 15 (Columna P): F. INICIO
            // Índice 16 (Columna Q): F. FIN
            // Índice 17 (Columna R): CODIGO
            const anioDirecto = row['14'] || row.AÑO || row.ANO || '';
            const fechaInicio = row['15'] || row['F. INICIO'] || row['FECHA INICIO'] || row.fecha_inicio || '-';
            const fechaFin = row['16'] || row['F. FIN'] || row['FECHA FIN'] || row['FECHA FINALIZACION'] || row.fecha_fin || '-';
            const codigo = row['17'] || row.CODIGO || row['CÓDIGO'] || row.codigo || '-';

            // Usar año directo del Excel, o extraerlo de la fecha si está vacío
            let anio = anioDirecto && anioDirecto !== '-' ? anioDirecto : '-';
            if (anio === '-' && fechaInicio && fechaInicio !== '-' && fechaInicio.length >= 4) {
                // Fallback: extraer año de la fecha de inicio (para registros antiguos)
                const match = fechaInicio.match(/(19|20)\d{2}/);
                if (match) {
                    anio = match[0];
                }
            }
            
            // Según headers reales del Excel: "DESCRIPCION" (sin tilde en los datos procesados)
            const descripcion = row['DESCRIPCION'] || row['DESCRIPCIÓN'] || '-';

            return `
                <tr style="border-bottom: 1px solid #dee2e6; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='white'">
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${no}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 180px; overflow: hidden; text-overflow: ellipsis;" title="${nombre}">${nombre}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${cedula}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 120px; overflow: hidden; text-overflow: ellipsis;" title="${cargo}">${cargo}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${empresaUsuaria}">${empresaUsuaria}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 120px; overflow: hidden; text-overflow: ellipsis;" title="${areaDpto}">${areaDpto}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${genero}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${mes}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${noDias}</td>
                    <td style="padding: 12px 15px;">
                        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; background-color: ${badgeColor}; color: ${badgeText}; white-space: nowrap;">
                            ${clase}
                        </span>
                    </td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${tipo}">${tipo}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${entidad}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${anio}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${fechaInicio}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${fechaFin}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${codigo}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${descripcion}">${descripcion}</td>
                </tr>
            `;
        }).join('');
    }

    showNotification(message, type = 'success', elementId = 'notification-toast') {
        /* Buscar updateNotifier en padre (si estamos en iframe) o en window */
        var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (notifier && typeof notifier.show === 'function') {
            notifier.show({
                type: type,
                title: message,
                subtitle: '',
                autoClose: type === 'error' ? 6000 : type === 'warning' ? 4000 : 3000
            });
            return;
        }
        /* Fallback al DOM legacy si updateNotifier no está disponible */
        const notificationDiv = document.getElementById(elementId);
        if (!notificationDiv) return;

        notificationDiv.textContent = message;
        notificationDiv.style.borderLeftColor = type === 'error' ? '#dc3545' :
                                                type === 'warning' ? '#ffc107' : '#28a745';
        notificationDiv.style.transform = 'translateX(0)';

        setTimeout(() => {
            notificationDiv.style.transform = 'translateX(120%)';
        }, 3000);
    }

    renderEstadisticasView(container) {
        console.log('[DEBUG] renderEstadisticasView: Iniciando renderizado de dashboard de estadísticas.');
        container.innerHTML = '';

        // ================================================================
        // CSS KPI RIBBON — Patrón Canónico K+AIR (aislado via scope)
        // ================================================================
        if (!document.getElementById('kpi-stats-ribbon-css')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'kpi-stats-ribbon-css';
      styleEl.textContent = `
      .estadisticas-dashboard .k-stats-ribbon {
        display: flex;
        align-items: center;
        gap: 0;
        background: #ffffff;
        border: 1px solid #dee2e6;
        border-radius: 0.625rem;
        padding: 0;
        margin-bottom: 1.5rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        overflow: hidden;
      }
      .estadisticas-dashboard .k-stats-ribbon__item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        flex: 1;
        min-width: 0;
      }
      .estadisticas-dashboard .k-stats-ribbon__icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        flex-shrink: 0;
      }
      .estadisticas-dashboard .k-stats-ribbon__icon.primary { background: #e8f0fe; color: #174ea6; }
      .estadisticas-dashboard .k-stats-ribbon__icon.success { background: #d4edda; color: #28a745; }
      .estadisticas-dashboard .k-stats-ribbon__icon.warning { background: #fff3cd; color: #856404; }
      .estadisticas-dashboard .k-stats-ribbon__icon.muted { background: #f0f2f5; color: #6c757d; }
      .estadisticas-dashboard .k-stats-ribbon__data {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .estadisticas-dashboard .k-stats-ribbon__value {
        font-family: 'Lexend', sans-serif;
        font-size: 1.375rem;
        font-weight: 700;
        color: #1a1a2e;
        line-height: 1.2;
      }
      .estadisticas-dashboard .k-stats-ribbon__value--muted {
        font-size: 1rem;
        color: #6c757d;
      }
      .estadisticas-dashboard .k-stats-ribbon__label {
        font-size: 0.6875rem;
        color: #6c757d;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
      }
      .estadisticas-dashboard .k-stats-ribbon__divider {
        width: 1px;
        height: 36px;
        background: #e5e7eb;
        flex-shrink: 0;
      }
      .estadisticas-dashboard .k-section-card {
        background: #ffffff;
        border: 1px solid #dee2e6;
        border-radius: 0.625rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        margin-bottom: 1.5rem;
      }
      .estadisticas-dashboard .k-charts-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
        margin-bottom: 1.5rem;
      }
      .estadisticas-dashboard .k-chart-card {
        background: #ffffff;
        border: 1px solid #dee2e6;
        border-radius: 0.625rem;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
      }
      .estadisticas-dashboard .k-chart-card__title {
        margin: 0 0 1rem 0;
        font-size: 0.9375rem;
        font-weight: 600;
        color: #1E293B;
      }
      .estadisticas-dashboard .k-chart-card__body {
        position: relative;
        flex: 1;
        min-height: 260px;
      }
      .estadisticas-dashboard .k-filters-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 0.75rem;
        padding: 1.25rem 1.5rem;
      }
      .estadisticas-dashboard .k-filter-group {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1 1 140px;
      }
      .estadisticas-dashboard .k-filter-label {
        display: block;
        font-size: 0.6875rem;
        font-weight: 600;
        color: #64748B;
        margin-bottom: 0.375rem;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .estadisticas-dashboard .k-filter-select {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        color: #1E293B;
        background: #ffffff;
        transition: border-color 0.2s;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2364748B' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        padding-right: 2rem;
      }
      .estadisticas-dashboard .k-filter-select:focus {
        outline: none;
        border-color: #174ea6;
        box-shadow: 0 0 0 3px rgba(23,78,166,0.1);
      }
      .estadisticas-dashboard .k-filter-actions {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-shrink: 0;
      }
      @media (max-width: 992px) {
        .estadisticas-dashboard .k-charts-grid { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 768px) {
        .estadisticas-dashboard .k-stats-ribbon { flex-wrap: wrap; }
        .estadisticas-dashboard .k-stats-ribbon__item { flex: 1 1 45%; }
        .estadisticas-dashboard .k-stats-ribbon__divider { display: none; }
        .estadisticas-dashboard .k-charts-grid { grid-template-columns: 1fr; }
        .estadisticas-dashboard .k-filters-bar { flex-direction: column; }
        .estadisticas-dashboard .k-filter-group { flex: 1 1 100%; }
        .estadisticas-dashboard .k-filter-actions { width: 100%; }
        .estadisticas-dashboard .k-filter-actions button { flex: 1; }
      }
      `;
            document.head.appendChild(styleEl);
        }

        // ================================================================
        // 📦482 — CSS EXTENDED STATS (16 métricas, 3 tabs)
        // ================================================================
        if (!document.getElementById('extended-stats-css')) {
            const styleEl2 = document.createElement('style');
            styleEl2.id = 'extended-stats-css';
            styleEl2.textContent = `
      .extended-stats-container { margin-top: 1.5rem; }
      .extended-stats-container .es-loading { padding: 2rem; text-align: center; color: #6c757d; font-size: 0.9375rem; }
      .extended-stats-container .es-empty { padding: 2rem; text-align: center; color: #6c757d; font-size: 0.9375rem; }
      .es-tabs-header { background: #fff; border: 1px solid #dee2e6; border-radius: 0.625rem 0.625rem 0 0; padding: 1rem 1.25rem; border-bottom: none; }
      .es-tabs-title { margin: 0 0 0.875rem 0; font-size: 1.0625rem; font-weight: 600; color: #1a1a2e; display: flex; align-items: center; gap: 0.5rem; }
      .es-tabs-title i { color: #174ea6; }
      .es-tabs-badge { background: #e8f0fe; color: #174ea6; font-size: 0.75rem; font-weight: 600; padding: 0.1875rem 0.625rem; border-radius: 999px; margin-left: auto; }
      .es-tabs-nav { display: flex; gap: 0.375rem; flex-wrap: wrap; }
      .es-tab-btn { padding: 0.5rem 0.875rem; border: 1px solid #dee2e6; background: #f8f9fa; color: #495057; border-radius: 0.4375rem; font-size: 0.8125rem; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4375rem; transition: all 0.15s ease; }
      .es-tab-btn:hover { background: #e9ecef; border-color: #adb5bd; }
      .es-tab-btn.active { background: #174ea6; border-color: #174ea6; color: #fff; box-shadow: 0 1px 3px rgba(23,78,166,0.25); }
      .es-tabs-body { background: #fff; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 0.625rem 0.625rem; padding: 1.25rem; }
      .es-tab-panel { display: none; animation: esFadeIn 0.2s ease-out; }
      .es-tab-panel.active { display: block; }
      @keyframes esFadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }

      /* Tier 1 — KPI Regulatorios */
      .es-reg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.875rem; margin-bottom: 1.25rem; }
      .es-reg-card { display: flex; align-items: flex-start; gap: 0.875rem; padding: 1rem; background: #fafbfc; border: 1px solid #e9ecef; border-radius: 0.5rem; transition: border-color 0.15s ease; }
      .es-reg-card:hover { border-color: #174ea6; }
      .es-reg-card__icon { width: 44px; height: 44px; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; }
      .es-reg-card__icon.primary { background: #e8f0fe; color: #174ea6; }
      .es-reg-card__icon.warning { background: #fff3cd; color: #856404; }
      .es-reg-card__icon.danger { background: #f8d7da; color: #721c24; }
      .es-reg-card__icon.muted { background: #f0f2f5; color: #6c757d; }
      .es-reg-card__data { display: flex; flex-direction: column; min-width: 0; }
      .es-reg-card__label { font-size: 0.75rem; font-weight: 600; color: #6c757d; text-transform: uppercase; letter-spacing: 0.025em; margin-bottom: 0.1875rem; }
      .es-reg-card__value { font-size: 1.625rem; font-weight: 700; color: #1a1a2e; line-height: 1.15; margin-bottom: 0.25rem; }
      .es-reg-card__sub { font-size: 0.6875rem; color: #6c757d; line-height: 1.35; }

      /* Comparativa YoY */
      .es-yoy { background: #fafbfc; border: 1px solid #e9ecef; border-radius: 0.5rem; padding: 1rem 1.25rem; }
      .es-yoy__title { margin: 0 0 0.75rem 0; font-size: 0.9375rem; font-weight: 600; color: #1a1a2e; display: flex; align-items: center; gap: 0.5rem; }
      .es-yoy__years { font-size: 0.75rem; color: #174ea6; background: #e8f0fe; padding: 0.125rem 0.5rem; border-radius: 999px; font-weight: 600; }
      .es-yoy__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
      .es-yoy__cell { display: flex; flex-direction: column; gap: 0.125rem; }
      .es-yoy__label { font-size: 0.6875rem; color: #6c757d; font-weight: 500; }
      .es-yoy__current { font-size: 1.5rem; font-weight: 700; color: #1a1a2e; line-height: 1.2; }
      .es-yoy__prev { font-size: 0.75rem; color: #6c757d; }
      .es-var { font-size: 0.8125rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border-radius: 0.375rem; margin-top: 0.25rem; width: fit-content; }
      .es-var.up { background: #f8d7da; color: #721c24; }
      .es-var.down { background: #d4edda; color: #155724; }
      .es-var.neutral { background: #e9ecef; color: #6c757d; }
      .es-yoy__empty { margin: 0; padding: 0.5rem; font-size: 0.8125rem; color: #6c757d; text-align: center; }

      /* Tier 3 — Distribuciones */
      .es-dist-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 0.875rem; margin-bottom: 0.875rem; }
      .es-dist-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 0.875rem; margin-bottom: 0.875rem; }
      .es-dist-card { background: #fafbfc; border: 1px solid #e9ecef; border-radius: 0.5rem; padding: 1rem; }
      .es-dist-card__head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; padding-bottom: 0.625rem; border-bottom: 1px solid #e9ecef; }
      .es-dist-card__head i { color: #174ea6; font-size: 1rem; }
      .es-dist-card__head h4 { margin: 0; font-size: 0.875rem; font-weight: 600; color: #1a1a2e; flex: 1; }
      .es-dist-card__total { font-size: 0.6875rem; color: #6c757d; font-weight: 500; }
      .es-dist-card__body { display: flex; flex-direction: column; gap: 0.5rem; }
      .es-bar-row { display: grid; grid-template-columns: 130px 1fr 60px; align-items: center; gap: 0.625rem; }
      .es-bar-row__label { font-size: 0.8125rem; color: #1a1a2e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
      .es-bar-row__label i { color: #6c757d; margin-right: 0.1875rem; }
      .es-bar-track { height: 0.625rem; background: #e9ecef; border-radius: 999px; overflow: hidden; }
      .es-bar-fill { height: 100%; background: linear-gradient(90deg, #174ea6 0%, #4285f4 100%); border-radius: 999px; transition: width 0.3s ease; min-width: 2px; }
      .es-bar-fill--duration { background: linear-gradient(90deg, #6f42c1 0%, #d63384 100%); }
      .es-bar-fill--gender.es-bar-fill--femenino { background: linear-gradient(90deg, #d63384 0%, #f06292 100%); }
      .es-bar-fill--gender.es-bar-fill--masculino { background: linear-gradient(90deg, #174ea6 0%, #4285f4 100%); }
      .es-bar-fill--gender.es-bar-fill--otro { background: linear-gradient(90deg, #6c757d 0%, #adb5bd 100%); }
      .es-bar-row__count { font-size: 0.8125rem; font-weight: 600; color: #1a1a2e; text-align: right; }
      .es-bar-row__count small { font-weight: 400; color: #6c757d; }

      /* Heatmap */
      .es-dist-card--heatmap { margin-top: 0; }
      .es-heatmap-container { overflow-x: auto; }
      .es-heatmap-table { width: 100%; border-collapse: separate; border-spacing: 2px; font-size: 0.75rem; }
      .es-heatmap-th { font-weight: 600; color: #495057; padding: 0.375rem 0.25rem; text-align: center; background: #f8f9fa; border-radius: 0.25rem; font-size: 0.6875rem; }
      .es-heatmap-cell { text-align: center; padding: 0.5rem 0.25rem; border-radius: 0.25rem; font-weight: 600; min-width: 36px; transition: transform 0.15s ease; }
      .es-heatmap-cell:hover { transform: scale(1.05); box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1; position: relative; }
      .es-heatmap-legend { display: flex; align-items: center; gap: 0.25rem; justify-content: center; margin-top: 0.75rem; font-size: 0.6875rem; color: #6c757d; }
      .es-heatmap-legend__swatch { width: 18px; height: 12px; border-radius: 0.1875rem; }

      /* Tier 2 — Rankings */
      .es-rank-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.875rem; margin-bottom: 1.25rem; }
      .es-rank-summary__cell { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem; background: linear-gradient(135deg, #f8f9fa 0%, #e8f0fe 100%); border: 1px solid #d6e3fc; border-radius: 0.5rem; }
      .es-rank-summary__cell > i { font-size: 1.5rem; color: #174ea6; margin-top: 0.125rem; }
      .es-rank-summary__value { display: block; font-size: 1.75rem; font-weight: 700; color: #1a1a2e; line-height: 1.1; }
      .es-rank-summary__label { display: block; font-size: 0.8125rem; color: #174ea6; font-weight: 600; margin-top: 0.1875rem; }
      .es-rank-summary__sub { display: block; font-size: 0.6875rem; color: #6c757d; margin-top: 0.125rem; }
      .es-rank-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.875rem; }
      .es-rank-card { background: #fafbfc; border: 1px solid #e9ecef; border-radius: 0.5rem; padding: 1rem; overflow: hidden; }
      .es-rank-card--full { grid-column: 1 / -1; }
      .es-rank-card h4 { margin: 0 0 0.75rem 0; font-size: 0.875rem; font-weight: 600; color: #1a1a2e; display: flex; align-items: center; gap: 0.4375rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e9ecef; }
      .es-rank-card h4 i { color: #174ea6; }
      .es-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
      .es-table th { text-align: left; padding: 0.4375rem 0.625rem; background: #f1f3f5; color: #495057; font-weight: 600; font-size: 0.75rem; border-bottom: 1px solid #dee2e6; }
      .es-table td { padding: 0.5rem 0.625rem; border-bottom: 1px solid #f1f3f5; color: #1a1a2e; vertical-align: middle; }
      .es-table tbody tr:hover { background: #f8f9fa; }
      .es-td-idx { width: 36px; color: #6c757d; font-weight: 600; }
      .es-td-center { text-align: center; }
      .es-td-strong { font-weight: 700; color: #174ea6; }
      .es-td-muted { color: #6c757d; font-size: 0.75rem; }
      .es-trab-name { font-weight: 600; color: #1a1a2e; font-size: 0.8125rem; }
      .es-trab-meta { font-size: 0.6875rem; color: #6c757d; margin-top: 0.125rem; }
      .es-empty-row { text-align: center; color: #6c757d; padding: 1rem; font-size: 0.8125rem; margin: 0; }
      .es-badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; }
      .es-badge--danger { background: #f8d7da; color: #721c24; }
      .es-badge--warning { background: #fff3cd; color: #856404; }

      /* Responsive */
      @media (max-width: 768px) {
        .es-rank-grid { grid-template-columns: 1fr; }
        .es-bar-row { grid-template-columns: 90px 1fr 50px; }
        .es-tabs-nav { gap: 0.25rem; }
        .es-tab-btn { font-size: 0.75rem; padding: 0.4375rem 0.625rem; }
      }
      `;
            document.head.appendChild(styleEl2);
        }

        // Contenedor wrapper con scroll condicional
        const scrollWrapper = document.createElement('div');
        scrollWrapper.id = 'estadisticas-ausentismo-scroll-wrapper';
        scrollWrapper.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
        `;

        // Agregar FontAwesome dinámicamente si no está cargado
        if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
            const fontAwesomeLink = document.createElement('link');
            fontAwesomeLink.rel = 'stylesheet';
            fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            document.head.appendChild(fontAwesomeLink);
            console.log('[DEBUG] FontAwesome agregado dinámicamente');
        }

    // Contenedor principal — Full-width, fondo gris
    const mainContent = document.createElement('div');
    mainContent.className = 'estadisticas-dashboard';
    mainContent.style.cssText = `
      padding: 1.5rem;
      width: 100%;
      min-height: 100%;
      box-sizing: border-box;
      background: #f8f9fa;
    `;

    // 📦443 (2026-06-25) — Notificación toast ELIMINADA (sistema legacy).
    // Ahora todo va por window.parent.updateNotifier (estándar K+AIR).

    // ================================================================
    // 1. HEADER — Card independiente
    // ================================================================
    const headerCard = document.createElement('div');
    headerCard.className = 'k-section-card';
    headerCard.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.25rem 1.5rem;
    `;

    const leftSection = document.createElement('div');
    leftSection.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.75rem;
    `;

    const dashboardIcon = document.createElement('i');
    dashboardIcon.className = 'fas fa-chart-line';
    dashboardIcon.style.cssText = `color: #174ea6; font-size: 1.25rem;`;

    const dashboardTitleContainer = document.createElement('div');
    const dashboardTitle = document.createElement('h3');
    dashboardTitle.textContent = 'Estadísticas de Ausentismo';
    dashboardTitle.style.cssText = `font-size: 1.125rem; font-weight: 600; margin: 0; color: #1E293B;`;

    const dashboardSubtitle = document.createElement('p');
    dashboardSubtitle.textContent = 'Métricas y tendencias del ausentismo por causa médica.';
    dashboardSubtitle.style.cssText = `font-size: 0.8125rem; color: #64748B; margin: 0.25rem 0 0 0;`;

    dashboardTitleContainer.appendChild(dashboardTitle);
    dashboardTitleContainer.appendChild(dashboardSubtitle);
    leftSection.appendChild(dashboardIcon);
    leftSection.appendChild(dashboardTitleContainer);

    const backBtn = document.createElement('button');
    backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
    backBtn.style.cssText = `
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      border: 1px solid #dee2e6;
      background-color: #f8f9fa;
      color: #64748B;
      transition: all 0.2s;
      white-space: nowrap;
    `;
    backBtn.onmouseover = function() {
      this.style.backgroundColor = '#e2e8f0';
      this.style.color = '#174ea6';
      this.style.borderColor = '#174ea6';
    };
    backBtn.onmouseout = function() {
      this.style.backgroundColor = '#f8f9fa';
      this.style.color = '#64748B';
      this.style.borderColor = '#dee2e6';
    };
    backBtn.onclick = () => {
      this.currentView = 'main';
      this.render();
    };

    headerCard.appendChild(leftSection);
    headerCard.appendChild(backBtn);
    mainContent.appendChild(headerCard);

    // ================================================================
    // 2. KPI RIBBON — Card independiente
    // ================================================================
    const ribbon = document.createElement('div');
    ribbon.className = 'k-stats-ribbon';

    const createRibbonItem = (id, value, label, iconClass, colorClass) => {
      const item = document.createElement('div');
      item.className = 'k-stats-ribbon__item';

      const iconSpan = document.createElement('span');
      iconSpan.className = `k-stats-ribbon__icon ${colorClass}`;
      const iconI = document.createElement('i');
      iconI.className = `bi ${iconClass}`;
      iconSpan.appendChild(iconI);

      const dataDiv = document.createElement('div');
      dataDiv.className = 'k-stats-ribbon__data';

      const valueSpan = document.createElement('span');
      valueSpan.className = 'k-stats-ribbon__value';
      valueSpan.id = id;
      valueSpan.textContent = value;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'k-stats-ribbon__label';
      labelSpan.textContent = label;

      dataDiv.appendChild(valueSpan);
      dataDiv.appendChild(labelSpan);
      item.appendChild(iconSpan);
      item.appendChild(dataDiv);

      return item;
    };

    const divider = () => {
      const d = document.createElement('div');
      d.className = 'k-stats-ribbon__divider';
      return d;
    };

    ribbon.appendChild(createRibbonItem('metricTotalIncapacidades', '-', 'Total Incapacidades', 'bi-calendar-check', 'primary'));
    ribbon.appendChild(divider());
    ribbon.appendChild(createRibbonItem('metricTotalDias', '-', 'Días Perdidos', 'bi-calendar3', 'success'));
    ribbon.appendChild(divider());
    ribbon.appendChild(createRibbonItem('metricTotalEPS', '-', 'Enf. General', 'bi-hospital', 'warning'));
    ribbon.appendChild(divider());
    ribbon.appendChild(createRibbonItem('metricTotalARL', '-', 'Acc. Laborales', 'bi-exclamation-triangle', 'muted'));

    mainContent.appendChild(ribbon);

    // ================================================================
    // 3. FILTROS — Card independiente
    // ================================================================
    const filtersCard = document.createElement('div');
    filtersCard.className = 'k-section-card';

    const filtersBar = document.createElement('div');
    filtersBar.className = 'k-filters-bar';

    filtersBar.innerHTML = `
      <div class="k-filter-group">
        <label class="k-filter-label">Año</label>
        <select id="statsYearFilter" class="k-filter-select">
          <option value="">Cargando años...</option>
        </select>
      </div>
      <div class="k-filter-group">
        <label class="k-filter-label">Mes</label>
        <select id="statsMonthFilter" class="k-filter-select">
          <option value="">Cargando meses...</option>
        </select>
      </div>
      <div class="k-filter-group">
        <label class="k-filter-label">Género</label>
        <select id="statsGenderFilter" class="k-filter-select">
          <option value="">Todos</option>
          <option value="FEMENINO">Femenino</option>
          <option value="MASCULINO">Masculino</option>
        </select>
      </div>
      <div class="k-filter-group">
        <label class="k-filter-label">Clase</label>
        <select id="statsClassFilter" class="k-filter-select">
          <option value="">Cargando tipos...</option>
        </select>
      </div>
      <div class="k-filter-actions">
        <button id="applyStatsFiltersBtn" style="padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 500; cursor: pointer; border: none; background-color: #174ea6; color: white; transition: all 0.2s; white-space: nowrap;">
          <i class="fas fa-filter"></i> Filtrar
        </button>
        <button id="clearStatsFiltersBtn" style="padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 500; cursor: pointer; border: 1px solid #dee2e6; background-color: #f8f9fa; color: #64748B; transition: all 0.2s; white-space: nowrap;">
          <i class="fas fa-times"></i> Limpiar
        </button>
      </div>
    `;

    filtersCard.appendChild(filtersBar);
    mainContent.appendChild(filtersCard);

    // ================================================================
    // 4. GRÁFICOS — Grid de cards independientes
    // ================================================================
    const chartsGrid = document.createElement('div');
    chartsGrid.className = 'k-charts-grid';

    const chartConfigs = [
      { id: 'monthlyChart', title: 'Distribución Mensual' },
      { id: 'typeChart', title: 'Tipos de Incapacidad' },
      { id: 'genderChart', title: 'Distribución por Género' }
    ];

    chartConfigs.forEach(cfg => {
      const card = document.createElement('div');
      card.className = 'k-chart-card';

      const title = document.createElement('h4');
      title.className = 'k-chart-card__title';
      title.textContent = cfg.title;

      const body = document.createElement('div');
      body.className = 'k-chart-card__body';

      const canvas = document.createElement('canvas');
      canvas.id = cfg.id;
      body.appendChild(canvas);

      card.appendChild(title);
      card.appendChild(body);
      chartsGrid.appendChild(card);
    });

    mainContent.appendChild(chartsGrid);

    // ================================================================
    // 📦482 — STATS EXTENDIDAS (16 métricas) — Container con tabs
    // Tier 1: Indicadores regulatorios
    // Tier 2: Rankings y casos críticos
    // Tier 3: Distribuciones avanzadas
    // ================================================================
    const extendedStatsContainer = document.createElement('div');
    extendedStatsContainer.id = 'extendedStatsContainer';
    extendedStatsContainer.className = 'extended-stats-container';
    extendedStatsContainer.innerHTML = KairSkeleton.kpiStrip(4) + KairSkeleton.chartBars(12);
    mainContent.appendChild(extendedStatsContainer);

    scrollWrapper.appendChild(mainContent);
    container.appendChild(scrollWrapper);

        // Cargar datos y renderizar gráficos
        this.loadEstadisticasData();

        // Setup de eventos de filtros
        setTimeout(() => {
            const applyBtn = document.getElementById('applyStatsFiltersBtn');
            const clearBtn = document.getElementById('clearStatsFiltersBtn');

            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    this.applyStatsFilters();
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    document.getElementById('statsYearFilter').value = '';
                    document.getElementById('statsMonthFilter').value = '';
                    document.getElementById('statsGenderFilter').value = '';
                    document.getElementById('statsClassFilter').value = '';
                    this.loadEstadisticasData();
                    this.showNotification('Filtros limpiados', 'info');
                });
            }
        }, 0);
    }

    applyStatsFilters(notificationDiv) { // 📦459 — notificationDiv legacy, no se usa
        const year = document.getElementById('statsYearFilter').value;
        const month = document.getElementById('statsMonthFilter').value;
        const gender = document.getElementById('statsGenderFilter').value;
        const clase = document.getElementById('statsClassFilter').value;

        if (!this.currentAusentismoDataStats) {
            this.showNotification('No hay datos cargados', 'warning');
            return;
        }

        let filtered = this.currentAusentismoDataStats.filter(row => {
            const matchesYear = !year || (row.AÑO || '').includes(year);
            const matchesMonth = !month || (row.MES || '').toUpperCase() === month.toUpperCase();
            const matchesGender = !gender || (row.GENERO || '').toUpperCase() === gender.toUpperCase();
            const matchesClass = !clase || (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === clase.toUpperCase();

            return matchesYear && matchesMonth && matchesGender && matchesClass;
        });

        this.updateStatsMetrics(filtered);
        this.renderCharts(filtered);
        this.showNotification(`${filtered.length} registros filtrados`, 'success');
    }

    async loadEstadisticasData(notificationDiv) { // 📦459 — notificationDiv legacy. Se usa this.container como fallback para inyectar banner.
        try {
            console.log('[ESTADISTICAS] Cargando datos para empresa:', this.currentCompany);
            const result = await window.electronAPI.readAusentismoData(this.currentCompany);
            console.log('[ESTADISTICAS] Resultado:', result);

            // 📦459 — Persistir estado del archivo
            if (result && result._missingFile) {
                this.ausentismoFileStatus = {
                    missing: true,
                    reason: result._missingFileReason,
                    expectedDir: result._expectedDir,
                    details: result._details
                };
            } else if (result && result.success) {
                this.ausentismoFileStatus = { missing: false };
            }

            if (result.success && result.rows && !result._missingFile) {
                const data = result.rows.map(row => {
                    const rowObj = {};
                    result.headers.forEach((header, i) => {
                        rowObj[header ? header.trim() : `col_${i}`] = row[i];
                    });
                    return rowObj;
                });

                console.log('[ESTADISTICAS] Datos procesados:', data.length, 'filas');
                console.log('[ESTADISTICAS] Primera fila:', data[0]);

                // Guardar datos para filtros
                this.currentAusentismoDataStats = data;

                this.updateStatsMetrics(data);
                this.renderCharts(data);

                // 📦482 — Calcular 16 métricas extendidas (Tier 1+2+3)
                this.currentAusentismoStatsExtended = this._calcularEstadisticasExtendidas(data);
                // Re-renderizar vista para mostrar tabs (la primera vez)
                this._renderEstadisticasTabs();

                // Actualizar filtros dinámicos
                this.populateStatsFilters(data);
            } else if (result && result._missingFile) {
                // 📦459 — Modo degradado: banner amarillo + mensaje claro
                console.warn('[ESTADISTICAS] Archivo no disponible:', result._missingFileReason);
                this.showNotification(
                    `Archivo de ausentismo no disponible. ${this._getMissingFileMessage(result._missingFileReason, result._details).action}.`,
                    'warning'
                );
                // Inyectar banner — usar notificationDiv si está disponible, sino this.container
                const statsContainer = (notificationDiv && notificationDiv.closest)
                    ? notificationDiv.closest('section, .estadisticas-container, .tab-content') || notificationDiv.parentElement
                    : (this.container ? this.container.querySelector('.estadisticas-dashboard, .estadisticas-container') || this.container : null);
                if (statsContainer) {
                    const oldBanner = statsContainer.querySelector('.km-missing-banner');
                    if (oldBanner) oldBanner.remove();
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = this._ausentismoMissingBannerHtml(
                        { reason: result._missingFileReason, expectedDir: result._expectedDir, details: result._details },
                        { variant: 'warning', retryMethod: 'loadEstadisticasData' }
                    );
                    statsContainer.insertBefore(wrapper.firstElementChild, statsContainer.firstChild);
                }
                // Poblar filtros vacíos para que la UI no se rompa
                this.populateStatsFilters([]);
            } else {
                console.warn('[ESTADISTICAS] No hay datos:', result);
                this.showNotification('No hay datos para mostrar', 'warning');
            }
        } catch (error) {
            console.error('[ESTADISTICAS] Error loading data:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }

    /**
     * 📦482 — Calcula las 16 métricas extendidas (Tier 1+2+3).
     * A partir del array de filas crudo (objetos con headers como keys),
     * devuelve un objeto con: kpisBasicos, kpisRegulatorios, distribuciones,
     * rankings, casosCriticos, metadata.
     *
     * @param {Array<Object>} data - Filas del Excel de ausentismo
     * @returns {Object} Objeto con todas las métricas calculadas
     */
    _calcularEstadisticasExtendidas(data) {
        if (!data || data.length === 0) {
            return this._estructuraVaciaExtendida();
        }

        // ════════════════════════════════════════════════════════════════
        // HELPERS LOCALES
        // ════════════════════════════════════════════════════════════════
        const norm = s => (s == null ? '' : String(s).trim());
        const upper = s => norm(s).toUpperCase();
        const num = v => {
            if (v == null || v === '') return 0;
            const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
            return isNaN(n) ? 0 : n;
        };

        const getCol = (row, ...candidates) => {
            for (const c of candidates) {
                if (row[c] != null && row[c] !== '') return row[c];
            }
            return null;
        };

        // ════════════════════════════════════════════════════════════════
        // MÉTRICAS BASE (ya existentes, replicadas para no tocar código viejo)
        // ════════════════════════════════════════════════════════════════
        const totalFilas = data.length;
        const totalDias = data.reduce((s, r) => s + num(getCol(r, 'N° DIAS DE INCAPACIDAD', 'Nº DIAS DE INCAPACIDAD', 'N° DIAS', 'DIAS')), 0);
        const totalEPS = data.filter(r => upper(getCol(r, 'CLASE DE INCAPACIDAD')) === 'EPS').length;
        const totalARL = data.filter(r => upper(getCol(r, 'CLASE DE INCAPACIDAD')) === 'ARL').length;
        const totalLicencias = data.filter(r => upper(getCol(r, 'CLASE DE INCAPACIDAD')).includes('LICENCIA')).length;
        const femenino = data.filter(r => upper(getCol(r, 'GENERO')) === 'FEMENINO').length;
        const masculino = data.filter(r => upper(getCol(r, 'GENERO')) === 'MASCULINO').length;

        // ════════════════════════════════════════════════════════════════
        // TRABAJADORES ÚNICOS (cedula) — base para tasas
        // ════════════════════════════════════════════════════════════════
        const cedulasUnicas = new Set();
        data.forEach(r => {
            const c = norm(getCol(r, 'CEDULA', 'CÉDULA', '4', 'Columna1'));
            if (c) cedulasUnicas.add(c);
        });
        const totalTrabajadores = cedulasUnicas.size;

        // ════════════════════════════════════════════════════════════════
        // TIER 1 — INDICADORES REGULATORIOS (Decreto 1072/2015, Res. 0312/2019)
        // ════════════════════════════════════════════════════════════════
        // Tasa de Ausentismo = (días perdidos / días programados) × 100
        // Aproximación: 250 días laborables/año por trabajador
        const diasProgramados = totalTrabajadores * 250;
        const tasaAusentismo = diasProgramados > 0
            ? Math.round((totalDias / diasProgramados) * 100 * 10) / 10
            : 0;

        // Índice de Frecuencia (IF) = (# accidentes / # trabajadores) × 100
        const indiceFrecuencia = totalTrabajadores > 0
            ? Math.round((totalARL / totalTrabajadores) * 100 * 10) / 10
            : 0;

        // Índice de Severidad (IS) = (días perdidos / # trabajadores) × 100
        const indiceSeveridad = totalTrabajadores > 0
            ? Math.round((totalDias / totalTrabajadores) * 100 * 10) / 10
            : 0;

        // Tasa de Accidentalidad = (# AT / # trabajadores) × 100
        const tasaAccidentalidad = totalTrabajadores > 0
            ? Math.round((totalARL / totalTrabajadores) * 100 * 10) / 10
            : 0;

        // Comparativa YoY (vs año anterior)
        const aniosSet = new Set();
        data.forEach(r => {
            const a = norm(getCol(r, 'AÑO', 'ANO'));
            if (a && a !== '-') aniosSet.add(a);
        });
        const anios = Array.from(aniosSet).sort();
        const anioActual = anios[anios.length - 1];
        const anioAnterior = anios[anios.length - 2];
        let comparativaYoY = null;
        if (anioActual && anioAnterior) {
            const dataActual = data.filter(r => norm(getCol(r, 'AÑO', 'ANO')) === anioActual);
            const dataAnterior = data.filter(r => norm(getCol(r, 'AÑO', 'ANO')) === anioAnterior);
            const diasActual = dataActual.reduce((s, r) => s + num(getCol(r, 'N° DIAS DE INCAPACIDAD', 'DIAS')), 0);
            const diasAnterior = dataAnterior.reduce((s, r) => s + num(getCol(r, 'N° DIAS DE INCAPACIDAD', 'DIAS')), 0);
            const casosActual = dataActual.length;
            const casosAnterior = dataAnterior.length;
            comparativaYoY = {
                anioActual, anioAnterior,
                diasActual, diasAnterior,
                casosActual, casosAnterior,
                variacionDias: diasAnterior > 0 ? Math.round(((diasActual - diasAnterior) / diasAnterior) * 100 * 10) / 10 : 0,
                variacionCasos: casosAnterior > 0 ? Math.round(((casosActual - casosAnterior) / casosAnterior) * 100 * 10) / 10 : 0
            };
        }

        const kpisRegulatorios = {
            tasaAusentismo,
            indiceFrecuencia,
            indiceSeveridad,
            tasaAccidentalidad,
            comparativaYoY,
            diasProgramados,
            trabajadores: totalTrabajadores
        };

        // ════════════════════════════════════════════════════════════════
        // TIER 3 — DISTRIBUCIONES
        // ════════════════════════════════════════════════════════════════
        // Por Área
        const porArea = {};
        data.forEach(r => {
            const a = norm(getCol(r, 'ÁREA O DPTO', 'AREA O DPTO', 'DEPARTAMENTO', 'AREA'));
            if (a) porArea[a] = (porArea[a] || 0) + 1;
        });

        // Por Empresa Usuaria (cliente)
        const porEmpresaUsuaria = {};
        data.forEach(r => {
            const e = norm(getCol(r, 'EMPRESA USUARIA'));
            if (e) porEmpresaUsuaria[e] = (porEmpresaUsuaria[e] || 0) + 1;
        });

        // Por EPS
        const porEPS = {};
        data.forEach(r => {
            const e = norm(getCol(r, 'ENTIDAD', 'EPS'));
            if (e) porEPS[e] = (porEPS[e] || 0) + 1;
        });

        // Por Tipo de incapacidad (descripción del diagnóstico CIE-10)
        const porTipo = {};
        data.forEach(r => {
            const t = norm(getCol(r, 'TIPO DE INCAPACIDAD'));
            if (t) porTipo[t] = (porTipo[t] || 0) + 1;
        });

        // Por rango de duración (1-3, 4-7, 8-15, 16-30, 31+)
        const porRangoDuracion = { '1-3 días': 0, '4-7 días': 0, '8-15 días': 0, '16-30 días': 0, '31+ días': 0 };
        data.forEach(r => {
            const d = num(getCol(r, 'N° DIAS DE INCAPACIDAD', 'DIAS'));
            if (d <= 3) porRangoDuracion['1-3 días']++;
            else if (d <= 7) porRangoDuracion['4-7 días']++;
            else if (d <= 15) porRangoDuracion['8-15 días']++;
            else if (d <= 30) porRangoDuracion['16-30 días']++;
            else porRangoDuracion['31+ días']++;
        });

        // Distribución por género
        const porGenero = { Femenino: femenino, Masculino: masculino, Otro: totalFilas - femenino - masculino };

        // Heatmap día de semana vs mes (filas = días L-V, cols = meses)
        const heatmapDiaSemana = {
            labelsDias: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
            labelsMeses: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            data: Array.from({ length: 5 }, () => new Array(12).fill(0))
        };
        const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        data.forEach(r => {
            const mes = upper(getCol(r, 'MES'));
            const mi = monthNames.indexOf(mes);
            const fiStr = norm(getCol(r, 'F. INICIO'));
            if (mi >= 0 && fiStr) {
                let di = 0;
                try {
                    // Formato puede ser "7/2/24" o ISO
                    let fecha;
                    if (/^\d{4}-\d{2}-\d{2}/.test(fiStr)) {
                        fecha = new Date(fiStr);
                    } else {
                        const parts = fiStr.split('/');
                        if (parts.length === 3) {
                            fecha = new Date(parseInt(parts[2]) + 2000, parseInt(parts[1]) - 1, parseInt(parts[0]));
                        }
                    }
                    if (fecha && !isNaN(fecha.getTime())) {
                        const dow = fecha.getDay(); // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sab
                        di = dow >= 1 && dow <= 5 ? dow - 1 : -1;
                    }
                } catch (e) { /* ignore */ }
                if (di >= 0) heatmapDiaSemana.data[di][mi]++;
            }
        });

        // Top 5 áreas / empresa usuaria / EPS
        const top5 = map => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([k, v]) => ({ label: k, count: v }));
        const distribuciones = {
            porArea: top5(porArea),
            porAreaTotal: Object.keys(porArea).length,
            porEmpresaUsuaria: top5(porEmpresaUsuaria),
            porEmpresaUsuariaTotal: Object.keys(porEmpresaUsuaria).length,
            porEPS: top5(porEPS),
            porEPSTotal: Object.keys(porEPS).length,
            porTipo: top5(porTipo),
            porTipoTotal: Object.keys(porTipo).length,
            porRangoDuracion,
            porGenero,
            heatmapDiaSemana
        };

        // ════════════════════════════════════════════════════════════════
        // TIER 2 — RANKINGS Y CASOS CRÍTICOS
        // ════════════════════════════════════════════════════════════════
        // Por trabajador (cedula → stats agregadas)
        const porTrabajador = {};
        data.forEach(r => {
            const ced = norm(getCol(r, 'CEDULA', 'CÉDULA', 'Columna1'));
            const nombre = norm(getCol(r, 'NOMBRE'));
            if (!ced && !nombre) return;
            const key = ced || nombre;
            if (!porTrabajador[key]) {
                porTrabajador[key] = {
                    cedula: ced,
                    nombre: nombre,
                    cargo: norm(getCol(r, 'CARGO')),
                    area: norm(getCol(r, 'ÁREA O DPTO', 'AREA')),
                    genero: upper(getCol(r, 'GENERO')),
                    totalIncapacidades: 0,
                    totalDias: 0,
                    ultimaIncapacidad: ''
                };
            }
            porTrabajador[key].totalIncapacidades++;
            porTrabajador[key].totalDias += num(getCol(r, 'N° DIAS DE INCAPACIDAD', 'DIAS'));
            const fi = norm(getCol(r, 'F. INICIO'));
            if (fi && fi > porTrabajador[key].ultimaIncapacidad) porTrabajador[key].ultimaIncapacidad = fi;
        });

        const trabajadoresArr = Object.values(porTrabajador);

        // Top 10 por días perdidos
        const top10Dias = trabajadoresArr
            .sort((a, b) => b.totalDias - a.totalDias)
            .slice(0, 10);

        // Top 10 por cantidad de incapacidades
        const top10Casos = trabajadoresArr
            .sort((a, b) => b.totalIncapacidades - a.totalIncapacidades)
            .slice(0, 10);

        // Tasa de re-incidencia (% con >1 incapacidad)
        const reincidentes = trabajadoresArr.filter(t => t.totalIncapacidades > 1).length;
        const tasaReincidencia = totalTrabajadores > 0
            ? Math.round((reincidentes / totalTrabajadores) * 100 * 10) / 10
            : 0;

        // Top 10 diagnósticos CIE-10
        const cie10Map = {};
        data.forEach(r => {
            const codigo = norm(getCol(r, 'CODIGO'));
            const desc = norm(getCol(r, 'DESCRIPCION'));
            if (!codigo && !desc) return;
            const key = codigo || desc;
            if (!cie10Map[key]) cie10Map[key] = { codigo, descripcion: desc, count: 0, dias: 0 };
            cie10Map[key].count++;
            cie10Map[key].dias += num(getCol(r, 'N° DIAS DE INCAPACIDAD', 'DIAS'));
        });
        const top10CIE10 = Object.values(cie10Map)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const rankings = {
            top10Dias,
            top10Casos,
            top10CIE10,
            tasaReincidencia,
            totalReincidentes: reincidentes
        };

        // ════════════════════════════════════════════════════════════════
        // CASOS CRÍTICOS
        // ════════════════════════════════════════════════════════════════
        // Críticos = incapacidades >15 días (sin importar el tipo)
        const casosCriticosList = data
            .filter(r => num(getCol(r, 'N° DIAS DE INCAPACIDAD', 'DIAS')) > 15)
            .map(r => ({
                cedula: norm(getCol(r, 'CEDULA', 'Columna1')),
                nombre: norm(getCol(r, 'NOMBRE')),
                cargo: norm(getCol(r, 'CARGO')),
                dias: num(getCol(r, 'N° DIAS DE INCAPACIDAD', 'DIAS')),
                clase: upper(getCol(r, 'CLASE DE INCAPACIDAD')),
                tipo: norm(getCol(r, 'TIPO DE INCAPACIDAD')),
                diagnostico: norm(getCol(r, 'DESCRIPCION')),
                fechaInicio: norm(getCol(r, 'F. INICIO')),
                fechaFin: norm(getCol(r, 'F. FIN')),
                eps: norm(getCol(r, 'ENTIDAD'))
            }))
            .sort((a, b) => b.dias - a.dias);

        // Sospechosos de abuso: >5 incapacidades en el año de duración <3 días cada una
        const sospechososMap = {};
        data.forEach(r => {
            const dias = num(getCol(r, 'N° DIAS DE INCAPACIDAD', 'DIAS'));
            if (dias > 0 && dias < 3) {
                const ced = norm(getCol(r, 'CEDULA', 'Columna1'));
                if (ced) sospechososMap[ced] = (sospechososMap[ced] || 0) + 1;
            }
        });
        const sospechososAbuso = Object.entries(sospechososMap)
            .filter(([_, count]) => count > 5)
            .map(([ced, count]) => {
                const t = porTrabajador[ced] || {};
                return { cedula: ced, nombre: t.nombre || '(sin nombre)', count, cargo: t.cargo || '', area: t.area || '' };
            })
            .sort((a, b) => b.count - a.count);

        const casosCriticos = {
            activos: casosCriticosList,
            total: casosCriticosList.length,
            sospechososAbuso,
            totalSospechosos: sospechososAbuso.length
        };

        // ════════════════════════════════════════════════════════════════
        // METADATA
        // ════════════════════════════════════════════════════════════════
        const metadata = {
            totalFilas,
            totalDias,
            totalTrabajadores,
            totalARL,
            totalEPS,
            totalLicencias,
            femenino,
            masculino,
            otro: totalFilas - femenino - masculino,
            anios,
            anioActual,
            anioAnterior,
            fechaGeneracion: new Date().toISOString()
        };

        return {
            kpis: { totalIncapacidades: totalFilas, totalDias, totalEPS, totalARL, totalLicencias, femenino, masculino },
            kpisRegulatorios,
            distribuciones,
            rankings,
            casosCriticos,
            metadata
        };
    }

    _estructuraVaciaExtendida() {
        return {
            kpis: { totalIncapacidades: 0, totalDias: 0, totalEPS: 0, totalARL: 0, totalLicencias: 0, femenino: 0, masculino: 0 },
            kpisRegulatorios: {
                tasaAusentismo: 0, indiceFrecuencia: 0, indiceSeveridad: 0,
                tasaAccidentalidad: 0, comparativaYoY: null,
                diasProgramados: 0, trabajadores: 0
            },
            distribuciones: {
                porArea: [], porAreaTotal: 0, porEmpresaUsuaria: [], porEmpresaUsuariaTotal: 0,
                porEPS: [], porEPSTotal: 0, porTipo: [], porTipoTotal: 0,
                porRangoDuracion: { '1-3 días': 0, '4-7 días': 0, '8-15 días': 0, '16-30 días': 0, '31+ días': 0 },
                porGenero: { Femenino: 0, Masculino: 0, Otro: 0 },
                heatmapDiaSemana: {
                    labelsDias: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
                    labelsMeses: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                    data: Array.from({ length: 5 }, () => new Array(12).fill(0))
                }
            },
            rankings: { top10Dias: [], top10Casos: [], top10CIE10: [], tasaReincidencia: 0, totalReincidentes: 0 },
            casosCriticos: { activos: [], total: 0, sospechososAbuso: [], totalSospechosos: 0 },
            metadata: { totalFilas: 0, totalDias: 0, totalTrabajadores: 0, totalARL: 0, totalEPS: 0, totalLicencias: 0, femenino: 0, masculino: 0, otro: 0, anios: [], anioActual: null, anioAnterior: null }
        };
    }

    /**
     * 📦482 — Pinta los 3 tabs de estadísticas extendidas (Indicadores / Distribuciones / Ranking)
     * Lee de this.currentAusentismoStatsExtended y actualiza #extendedStatsContainer
     */
    _renderEstadisticasTabs() {
        const container = document.getElementById('extendedStatsContainer');
        if (!container) return;
        const stats = this.currentAusentismoStatsExtended;
        if (!stats) {
            container.innerHTML = `
              <div class="es-empty">
                <i class="bi bi-info-circle"></i> No hay datos suficientes para calcular estadísticas extendidas.
              </div>`;
            return;
        }

        const meta = stats.metadata;
        container.innerHTML = `
          <div class="es-tabs-header">
            <h3 class="es-tabs-title">
              <i class="bi bi-bar-chart-line-fill"></i>
              Estadísticas Extendidas
              <span class="es-tabs-badge">${meta.totalFilas} registros</span>
            </h3>
            <div class="es-tabs-nav">
              <button class="es-tab-btn active" data-es-tab="indicadores">
                <i class="bi bi-speedometer2"></i> Indicadores Regulatorios
              </button>
              <button class="es-tab-btn" data-es-tab="distribuciones">
                <i class="bi bi-pie-chart-fill"></i> Distribuciones
              </button>
              <button class="es-tab-btn" data-es-tab="ranking">
                <i class="bi bi-trophy-fill"></i> Ranking & Críticos
              </button>
            </div>
          </div>
          <div class="es-tabs-body">
            <div class="es-tab-panel active" data-es-panel="indicadores">${this._renderTabIndicadores(stats)}</div>
            <div class="es-tab-panel" data-es-panel="distribuciones">${this._renderTabDistribuciones(stats)}</div>
            <div class="es-tab-panel" data-es-panel="ranking">${this._renderTabRanking(stats)}</div>
          </div>
        `;

        // Bind tab switchers
        container.querySelectorAll('.es-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-es-tab');
                container.querySelectorAll('.es-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
                container.querySelectorAll('.es-tab-panel').forEach(p => {
                    p.classList.toggle('active', p.getAttribute('data-es-panel') === target);
                });
            });
        });

        // Pintar heatmap día-semana en el panel de Distribuciones
        this._renderHeatmapEnPanel(stats);
    }

    /** 📦482 — Tab 1: Indicadores Regulatorios (Tier 1) */
    _renderTabIndicadores(stats) {
        const k = stats.kpisRegulatorios;
        const cmp = k.comparativaYoY;
        const fmtVar = v => {
            if (v == null || isNaN(v)) return '<span class="es-var neutral">—</span>';
            const cls = v > 0 ? 'up' : (v < 0 ? 'down' : 'neutral');
            const icon = v > 0 ? 'bi-arrow-up' : (v < 0 ? 'bi-arrow-down' : 'bi-dash');
            const sign = v > 0 ? '+' : '';
            return `<span class="es-var ${cls}"><i class="bi ${icon}"></i> ${sign}${v}%</span>`;
        };
        return `
          <div class="es-reg-grid">
            <div class="es-reg-card">
              <div class="es-reg-card__icon primary"><i class="bi bi-percent"></i></div>
              <div class="es-reg-card__data">
                <span class="es-reg-card__label">Tasa de Ausentismo</span>
                <span class="es-reg-card__value">${k.tasaAusentismo}%</span>
                <span class="es-reg-card__sub">${k.diasProgramados.toLocaleString('es-CO')} días programados (${k.trabajadores} trab × 250)</span>
              </div>
            </div>
            <div class="es-reg-card">
              <div class="es-reg-card__icon warning"><i class="bi bi-exclamation-octagon"></i></div>
              <div class="es-reg-card__data">
                <span class="es-reg-card__label">Índice de Frecuencia (AT)</span>
                <span class="es-reg-card__value">${k.indiceFrecuencia}%</span>
                <span class="es-reg-card__sub">${k.indiceFrecuencia > 0 ? 'ARL sobre trabajadores' : 'Sin accidentes reportados'}</span>
              </div>
            </div>
            <div class="es-reg-card">
              <div class="es-reg-card__icon danger"><i class="bi bi-calendar-x"></i></div>
              <div class="es-reg-card__data">
                <span class="es-reg-card__label">Índice de Severidad</span>
                <span class="es-reg-card__value">${k.indiceSeveridad}%</span>
                <span class="es-reg-card__sub">Días perdidos / trabajadores × 100</span>
              </div>
            </div>
            <div class="es-reg-card">
              <div class="es-reg-card__icon muted"><i class="bi bi-shield-exclamation"></i></div>
              <div class="es-reg-card__data">
                <span class="es-reg-card__label">Tasa de Accidentalidad</span>
                <span class="es-reg-card__value">${k.tasaAccidentalidad}%</span>
                <span class="es-reg-card__sub">ARL como % de la plantilla</span>
              </div>
            </div>
          </div>
          ${cmp ? `
          <div class="es-yoy">
            <h4 class="es-yoy__title">
              <i class="bi bi-graph-up-arrow"></i> Comparativa año a año
              <span class="es-yoy__years">${cmp.anioAnterior} → ${cmp.anioActual}</span>
            </h4>
            <div class="es-yoy__grid">
              <div class="es-yoy__cell">
                <span class="es-yoy__label">Días perdidos</span>
                <span class="es-yoy__current">${cmp.diasActual.toLocaleString('es-CO')}</span>
                <span class="es-yoy__prev">vs ${cmp.diasAnterior.toLocaleString('es-CO')}</span>
                ${fmtVar(cmp.variacionDias)}
              </div>
              <div class="es-yoy__cell">
                <span class="es-yoy__label">Casos reportados</span>
                <span class="es-yoy__current">${cmp.casosActual.toLocaleString('es-CO')}</span>
                <span class="es-yoy__prev">vs ${cmp.casosAnterior.toLocaleString('es-CO')}</span>
                ${fmtVar(cmp.variacionCasos)}
              </div>
            </div>
          </div>` : `
          <div class="es-yoy">
            <p class="es-yoy__empty"><i class="bi bi-info-circle"></i> No hay datos de un año anterior para comparar.</p>
          </div>`}
        `;
    }

    /** 📦482 — Tab 2: Distribuciones (Tier 3) */
    _renderTabDistribuciones(stats) {
        const d = stats.distribuciones;
        const renderTopBar = (titulo, items, total, kind) => {
            if (!items || items.length === 0) return '';
            const max = Math.max(...items.map(i => i.count));
            const iconMap = {
                area: 'bi-diagram-3',
                empresa: 'bi-building',
                eps: 'bi-hospital',
                tipo: 'bi-clipboard2-pulse'
            };
            return `
              <div class="es-dist-card">
                <div class="es-dist-card__head">
                  <i class="bi ${iconMap[kind]}"></i>
                  <h4>${titulo}</h4>
                  <span class="es-dist-card__total">${total} ${total === 1 ? 'categoría' : 'categorías'}</span>
                </div>
                <div class="es-dist-card__body">
                  ${items.map(item => `
                    <div class="es-bar-row">
                      <span class="es-bar-row__label" title="${this._escapeHtml(item.label)}">${this._escapeHtml(item.label)}</span>
                      <div class="es-bar-track">
                        <div class="es-bar-fill" style="width: ${(item.count / max * 100).toFixed(1)}%;"></div>
                      </div>
                      <span class="es-bar-row__count">${item.count}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
        };
        const rango = d.porRangoDuracion;
        const rangoTotal = Object.values(rango).reduce((a, b) => a + b, 0);
        const generoTotal = d.porGenero.Femenino + d.porGenero.Masculino + d.porGenero.Otro;

        return `
          <div class="es-dist-grid">
            ${renderTopBar('Por Área / Departamento', d.porArea, d.porAreaTotal, 'area')}
            ${renderTopBar('Por Empresa Usuaria', d.porEmpresaUsuaria, d.porEmpresaUsuariaTotal, 'empresa')}
            ${renderTopBar('Por EPS / Entidad', d.porEPS, d.porEPSTotal, 'eps')}
            ${renderTopBar('Por Tipo de Incapacidad', d.porTipo, d.porTipoTotal, 'tipo')}
          </div>

          <div class="es-dist-grid-2">
            <div class="es-dist-card">
              <div class="es-dist-card__head">
                <i class="bi bi-stopwatch"></i>
                <h4>Por Rango de Duración</h4>
                <span class="es-dist-card__total">${rangoTotal} casos</span>
              </div>
              <div class="es-dist-card__body">
                ${Object.entries(rango).map(([k, v]) => {
                    const pct = rangoTotal > 0 ? (v / rangoTotal * 100).toFixed(1) : 0;
                    return `
                      <div class="es-bar-row">
                        <span class="es-bar-row__label">${k}</span>
                        <div class="es-bar-track">
                          <div class="es-bar-fill es-bar-fill--duration" style="width: ${pct}%;"></div>
                        </div>
                        <span class="es-bar-row__count">${v} <small>(${pct}%)</small></span>
                      </div>
                    `;
                }).join('')}
              </div>
            </div>
            <div class="es-dist-card">
              <div class="es-dist-card__head">
                <i class="bi bi-gender-ambiguous"></i>
                <h4>Por Género</h4>
                <span class="es-dist-card__total">${generoTotal} casos</span>
              </div>
              <div class="es-dist-card__body">
                ${['Femenino', 'Masculino', 'Otro'].map(g => {
                    const v = d.porGenero[g];
                    const pct = generoTotal > 0 ? (v / generoTotal * 100).toFixed(1) : 0;
                    const icon = g === 'Femenino' ? 'bi-gender-female' : (g === 'Masculino' ? 'bi-gender-male' : 'bi-gender-ambiguous');
                    return `
                      <div class="es-bar-row">
                        <span class="es-bar-row__label"><i class="bi ${icon}"></i> ${g}</span>
                        <div class="es-bar-track">
                          <div class="es-bar-fill es-bar-fill--gender es-bar-fill--${g.toLowerCase()}" style="width: ${pct}%;"></div>
                        </div>
                        <span class="es-bar-row__count">${v} <small>(${pct}%)</small></span>
                      </div>
                    `;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="es-dist-card es-dist-card--heatmap">
            <div class="es-dist-card__head">
              <i class="bi bi-grid-3x3"></i>
              <h4>Heatmap Día de Semana × Mes</h4>
              <span class="es-dist-card__total">${stats.metadata.totalFilas} registros</span>
            </div>
            <div class="es-heatmap-container" id="esHeatmapContainer"></div>
          </div>
        `;
    }

    /** 📦482 — Tab 3: Ranking & Casos Críticos (Tier 2) */
    _renderTabRanking(stats) {
        const r = stats.rankings;
        const cc = stats.casosCriticos;
        const renderTrabajadorRow = (t, idx) => `
          <tr>
            <td class="es-td-idx">${idx + 1}</td>
            <td>
              <div class="es-trab-name">${this._escapeHtml(t.nombre || '—')}</div>
              <div class="es-trab-meta">${this._escapeHtml(t.cargo || '')}${t.area ? ' · ' + this._escapeHtml(t.area) : ''}</div>
            </td>
            <td class="es-td-center">${t.totalIncapacidades}</td>
            <td class="es-td-center es-td-strong">${t.totalDias}</td>
            <td class="es-td-muted">${this._escapeHtml(t.ultimaIncapacidad || '—')}</td>
          </tr>`;
        const renderCIE10Row = (c, idx) => `
          <tr>
            <td class="es-td-idx">${idx + 1}</td>
            <td><code>${this._escapeHtml(c.codigo || '—')}</code></td>
            <td>${this._escapeHtml(c.descripcion || '—')}</td>
            <td class="es-td-center">${c.count}</td>
            <td class="es-td-center es-td-strong">${c.dias}</td>
          </tr>`;
        const renderCriticoRow = (c, idx) => `
          <tr>
            <td class="es-td-idx">${idx + 1}</td>
            <td>
              <div class="es-trab-name">${this._escapeHtml(c.nombre || '—')}</div>
              <div class="es-trab-meta">${this._escapeHtml(c.cargo || '')}${c.eps ? ' · ' + this._escapeHtml(c.eps) : ''}</div>
            </td>
            <td class="es-td-center"><span class="es-badge ${c.clase === 'ARL' ? 'es-badge--danger' : 'es-badge--warning'}">${c.clase || '—'}</span></td>
            <td>${this._escapeHtml(c.tipo || '—')}</td>
            <td class="es-td-strong">${c.dias} días</td>
            <td class="es-td-muted">${this._escapeHtml(c.fechaInicio || '—')}</td>
          </tr>`;

        return `
          <div class="es-rank-summary">
            <div class="es-rank-summary__cell">
              <i class="bi bi-arrow-repeat"></i>
              <div>
                <span class="es-rank-summary__value">${r.tasaReincidencia}%</span>
                <span class="es-rank-summary__label">Tasa de Re-incidencia</span>
                <span class="es-rank-summary__sub">${r.totalReincidentes} trabajadores con &gt;1 incapacidad</span>
              </div>
            </div>
            <div class="es-rank-summary__cell">
              <i class="bi bi-exclamation-diamond"></i>
              <div>
                <span class="es-rank-summary__value">${cc.total}</span>
                <span class="es-rank-summary__label">Casos Críticos</span>
                <span class="es-rank-summary__sub">Incapacidades &gt; 15 días</span>
              </div>
            </div>
            <div class="es-rank-summary__cell">
              <i class="bi bi-shield-exclamation"></i>
              <div>
                <span class="es-rank-summary__value">${cc.totalSospechosos}</span>
                <span class="es-rank-summary__label">Sospechosos de Abuso</span>
                <span class="es-rank-summary__sub">&gt; 5 incapacidades cortas en el periodo</span>
              </div>
            </div>
          </div>

          <div class="es-rank-grid">
            <div class="es-rank-card">
              <h4><i class="bi bi-calendar-week"></i> Top 10 — Más Días Perdidos</h4>
              ${r.top10Dias.length > 0 ? `
                <table class="es-table">
                  <thead><tr><th>#</th><th>Trabajador</th><th class="es-td-center">Casos</th><th class="es-td-center">Días</th><th>Última</th></tr></thead>
                  <tbody>${r.top10Dias.map(renderTrabajadorRow).join('')}</tbody>
                </table>
              ` : '<p class="es-empty-row">Sin datos.</p>'}
            </div>
            <div class="es-rank-card">
              <h4><i class="bi bi-list-ol"></i> Top 10 — Más Incapacidades</h4>
              ${r.top10Casos.length > 0 ? `
                <table class="es-table">
                  <thead><tr><th>#</th><th>Trabajador</th><th class="es-td-center">Casos</th><th class="es-td-center">Días</th><th>Última</th></tr></thead>
                  <tbody>${r.top10Casos.map(renderTrabajadorRow).join('')}</tbody>
                </table>
              ` : '<p class="es-empty-row">Sin datos.</p>'}
            </div>
            <div class="es-rank-card es-rank-card--full">
              <h4><i class="bi bi-clipboard2-pulse"></i> Top 10 — Diagnósticos CIE-10</h4>
              ${r.top10CIE10.length > 0 ? `
                <table class="es-table">
                  <thead><tr><th>#</th><th>Código</th><th>Descripción</th><th class="es-td-center">Casos</th><th class="es-td-center">Días</th></tr></thead>
                  <tbody>${r.top10CIE10.map(renderCIE10Row).join('')}</tbody>
                </table>
              ` : '<p class="es-empty-row">Sin datos.</p>'}
            </div>
            <div class="es-rank-card es-rank-card--full">
              <h4><i class="bi bi-exclamation-diamond-fill"></i> Casos Críticos (&gt; 15 días)</h4>
              ${cc.activos.length > 0 ? `
                <table class="es-table">
                  <thead><tr><th>#</th><th>Trabajador</th><th class="es-td-center">Clase</th><th>Tipo</th><th>Días</th><th>Inicio</th></tr></thead>
                  <tbody>${cc.activos.slice(0, 50).map(renderCriticoRow).join('')}</tbody>
                </table>
                ${cc.activos.length > 50 ? `<p class="es-empty-row">Mostrando 50 de ${cc.activos.length} casos críticos.</p>` : ''}
              ` : '<p class="es-empty-row">Sin casos críticos.</p>'}
            </div>
            <div class="es-rank-card es-rank-card--full">
              <h4><i class="bi bi-shield-exclamation"></i> Sospechosos de Abuso</h4>
              ${cc.sospechososAbuso.length > 0 ? `
                <table class="es-table">
                  <thead><tr><th>#</th><th>Trabajador</th><th>Cargo / Área</th><th class="es-td-center">Incap. cortas</th></tr></thead>
                  <tbody>${cc.sospechososAbuso.map((s, i) => `
                    <tr>
                      <td class="es-td-idx">${i + 1}</td>
                      <td><div class="es-trab-name">${this._escapeHtml(s.nombre)}</div><div class="es-trab-meta">${this._escapeHtml(s.cedula)}</div></td>
                      <td>${this._escapeHtml(s.cargo || '')}${s.area ? '<br><small>' + this._escapeHtml(s.area) + '</small>' : ''}</td>
                      <td class="es-td-center es-td-strong">${s.count}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              ` : '<p class="es-empty-row">Sin patrones de sospecha detectados.</p>'}
            </div>
          </div>
        `;
    }

    /** 📦482 — Pinta heatmap día-semana vs mes con HTML+CSS */
    _renderHeatmapEnPanel(stats) {
        const container = document.getElementById('esHeatmapContainer');
        if (!container) return;
        const h = stats.distribuciones.heatmapDiaSemana;
        const max = Math.max(1, ...h.data.flat());
        const cells = h.data.map((row, di) => row.map((v, mi) => {
            const intensity = v / max;
            const bg = v === 0
                ? '#f8f9fa'
                : `rgba(23, 78, 166, ${0.15 + intensity * 0.85})`;
            const fg = intensity > 0.5 ? '#fff' : '#1a1a2e';
            return `<td class="es-heatmap-cell" style="background:${bg};color:${fg};" title="${h.labelsDias[di]} ${h.labelsMeses[mi]}: ${v} casos">${v}</td>`;
        }).join('')).map((rowHtml, di) => `<tr><th class="es-heatmap-th">${h.labelsDias[di]}</th>${rowHtml}</tr>`).join('');
        container.innerHTML = `
          <table class="es-heatmap-table">
            <thead>
              <tr>
                <th></th>
                ${h.labelsMeses.map(m => `<th class="es-heatmap-th">${m}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${cells}</tbody>
          </table>
          <div class="es-heatmap-legend">
            <span>Menos</span>
            <span class="es-heatmap-legend__swatch" style="background:rgba(23, 78, 166, 0.15);"></span>
            <span class="es-heatmap-legend__swatch" style="background:rgba(23, 78, 166, 0.40);"></span>
            <span class="es-heatmap-legend__swatch" style="background:rgba(23, 78, 166, 0.70);"></span>
            <span class="es-heatmap-legend__swatch" style="background:rgba(23, 78, 166, 1.0);"></span>
            <span>Más</span>
          </div>
        `;
    }

    /** 📦482 — _escapeHtml() ya existe en línea ~6907 (helper global del componente). NO redeclarar. */

    /**
     * Llena los filtros de estadísticas con datos reales
     */
    populateStatsFilters(data) {
        if (!data || data.length === 0) {
            // Si no hay datos, dejar filtros en blanco
            const yearFilter = document.getElementById('statsYearFilter');
            const monthFilter = document.getElementById('statsMonthFilter');
            const classFilter = document.getElementById('statsClassFilter');
            if (yearFilter) yearFilter.innerHTML = '<option value="">Todos</option>';
            if (monthFilter) monthFilter.innerHTML = '<option value="">Todos</option>';
            if (classFilter) classFilter.innerHTML = '<option value="">Todos</option>';
            return;
        }

        // 1. Filtro de AÑO
        const yearFilter = document.getElementById('statsYearFilter');
        if (yearFilter) {
            const yearsSet = new Set();
            data.forEach(row => {
                let year = row.AÑO || row.ANO || row['14'] || '';
                if (!year || year === '-') {
                    const fechaInicio = row['F. INICIO'] || row['FECHA INICIO'] || row['15'] || '';
                    if (fechaInicio && fechaInicio.length >= 4) {
                        const match = fechaInicio.match(/(19|20)\d{2}/);
                        if (match) year = match[0];
                    }
                }
                if (year && year !== '-') yearsSet.add(year);
            });
            const years = Array.from(yearsSet).sort((a, b) => b - a);
            yearFilter.innerHTML = '<option value="">Todos</option>' + 
                years.map(year => `<option value="${year}">${year}</option>`).join('');
        }

        // 2. Filtro de MES
        const monthFilter = document.getElementById('statsMonthFilter');
        if (monthFilter) {
            const monthsSet = new Set();
            data.forEach(row => {
                const mes = row.MES || row['9'] || '';
                if (mes && mes !== '-') monthsSet.add(mes.toUpperCase());
            });
            const months = Array.from(monthsSet).sort();
            const monthNames = {
                'ENERO': 'Enero', 'FEBRERO': 'Febrero', 'MARZO': 'Marzo', 'ABRIL': 'Abril',
                'MAYO': 'Mayo', 'JUNIO': 'Junio', 'JULIO': 'Julio', 'AGOSTO': 'Agosto',
                'SEPTIEMBRE': 'Septiembre', 'OCTUBRE': 'Octubre', 'NOVIEMBRE': 'Noviembre', 'DICIEMBRE': 'Diciembre'
            };
            monthFilter.innerHTML = '<option value="">Todos</option>' + 
                months.map(m => `<option value="${m}">${monthNames[m] || m}</option>`).join('');
        }

        // 3. Filtro de CLASE
        const classFilter = document.getElementById('statsClassFilter');
        if (classFilter) {
            const classSet = new Set();
            data.forEach(row => {
                const clase = row['CLASE DE INCAPACIDAD'] || row['11'] || '';
                if (clase && clase !== '-') classSet.add(clase.toUpperCase().trim());
            });
            const classes = Array.from(classSet).sort();
            classFilter.innerHTML = '<option value="">Todos</option>' + 
                classes.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    }

    updateStatsMetrics(data) {
        // Calcular métricas
        const totalIncapacidades = data.length;
        const totalDias = data.reduce((sum, row) => {
            // Probar diferentes variaciones del nombre de columna
            const dias = parseInt(row['N° DIAS DE INCAPACIDAD']) || 
                        parseInt(row['Nº DIAS DE INCAPACIDAD']) || 
                        parseInt(row['N° DIAS']) || 
                        parseInt(row['DIAS']) || 0;
            return sum + dias;
        }, 0);
        const totalEPS = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === 'EPS').length;
        const totalARL = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === 'ARL').length;

        console.log('[ESTADISTICAS] Métricas calculadas:', { totalIncapacidades, totalDias, totalEPS, totalARL });

        // Actualizar tarjetas
        const metricIncap = document.getElementById('metricTotalIncapacidades');
        const metricDias = document.getElementById('metricTotalDias');
        const metricEPS = document.getElementById('metricTotalEPS');
        const metricARL = document.getElementById('metricTotalARL');
        
        if (metricIncap) metricIncap.textContent = totalIncapacidades.toLocaleString();
        if (metricDias) metricDias.textContent = totalDias.toLocaleString();
        if (metricEPS) metricEPS.textContent = totalEPS.toLocaleString();
        if (metricARL) metricARL.textContent = totalARL.toLocaleString();
    }

    renderCharts(data) {
        // Datos para gráfico mensual
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const monthlyData = new Array(12).fill(0);

        data.forEach(row => {
            const mes = row.MES ? monthNames.indexOf(row.MES.toUpperCase()) : -1;
            if (mes >= 0) {
                monthlyData[mes]++;
            }
        });

        // Datos para gráfico de tipos
        const epsCount = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === 'EPS').length;
        const arlCount = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === 'ARL').length;
        const licenciaCount = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase().includes('LICENCIA')).length;

        // Datos para gráfico de género
        const femeninoCount = data.filter(row => (row.GENERO || '').toUpperCase() === 'FEMENINO').length;
        const masculinoCount = data.filter(row => (row.GENERO || '').toUpperCase() === 'MASCULINO').length;
        const otroCount = data.length - femeninoCount - masculinoCount;

        // Renderizar gráfico de barras (Monthly)
        const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
        if (window.Chart) {
            // Destruir gráficos existentes si los hay
            const existingMonthlyChart = Chart.getChart('monthlyChart');
            if (existingMonthlyChart) {
                existingMonthlyChart.destroy();
            }

            new window.Chart(monthlyCtx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Incapacidades',
                        data: monthlyData,
                        backgroundColor: '#174ea6',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 }
                        }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            bottom: 10,
                            left: 10,
                            right: 10
                        }
                    }
                }
            });

            // Renderizar gráfico doughnut (Types)
            const typeCtx = document.getElementById('typeChart').getContext('2d');
            const existingTypeChart = Chart.getChart('typeChart');
            if (existingTypeChart) {
                existingTypeChart.destroy();
            }

            new window.Chart(typeCtx, {
                type: 'doughnut',
                data: {
                    labels: ['EPS', 'ARL', 'Licencias'],
                    datasets: [{
                        data: [epsCount, arlCount, licenciaCount],
                        backgroundColor: ['#174ea6', '#dc3545', '#ffc107'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });

            // Renderizar gráfico de género (Doughnut)
            const genderCtx = document.getElementById('genderChart').getContext('2d');
            const existingGenderChart = Chart.getChart('genderChart');
            if (existingGenderChart) {
                existingGenderChart.destroy();
            }

            new window.Chart(genderCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Femenino', 'Masculino', 'Otro'],
                    datasets: [{
                        data: [femeninoCount, masculinoCount, Math.max(0, otroCount)],
                        backgroundColor: ['#e91e63', '#2196f3', '#9e9e9e'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } else {
            console.warn('Chart.js no está disponible');
        }
    }

    async navigateToInitialPath() {
        try {
            const result = await window.electronAPI.findSubmodulePath(
                this.currentCompany,
                this.moduleName,
                this.submoduleName
            );
            if (result.success) {
                this.navigateToPath(result.path);
            } else {
                document.getElementById('search-results-col').innerHTML =
                    `<p>Error al encontrar la ruta inicial: ${result.error}</p>`;
            }
        } catch (error) {
            document.getElementById('search-results-col').innerHTML =
                `<p>Error crítico al buscar ruta: ${error.message}</p>`;
        }
    }

    async navigateToPath(path) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '<p>Cargando...</p>';
        try {
            const items = await window.electronAPI.readDirectory(path);
            this.currentPath = path;
            this.updateNavBar();
            this.displayItems(items);
        } catch (error) {
            resultsCol.innerHTML = `<p>Error al leer directorio: ${error.message}</p>`;
        }
    }

    updateNavBar() {
        const navBar = this.container.querySelector('.file-nav-bar');
        navBar.innerHTML = '';

        const upButton = document.createElement('button');
        upButton.innerHTML = '&#8679; Subir Nivel';
        upButton.className = 'btn btn-secondary btn-sm';
        upButton.disabled = this.pathHistory.length === 0;
        upButton.addEventListener('click', () => {
            if (this.pathHistory.length > 0) {
                const parentPath = this.pathHistory.pop();
                this.navigateToPath(parentPath);
            }
        });
        navBar.appendChild(upButton);

        const breadcrumb = document.createElement('span');
        breadcrumb.className = 'breadcrumb-display';
        breadcrumb.textContent = this.currentPath || 'Ruta no disponible';
        navBar.appendChild(breadcrumb);
    }

    displayItems(items) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '';
        const list = document.createElement('ul');
        list.className = 'search-results-list';

        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xlsx', '.xls'];
        const folders = items.filter(item => item.isDirectory);
        const files = items.filter(
            item => !item.isDirectory &&
            allowedExtensions.includes(item.name.slice(item.name.lastIndexOf('.')).toLowerCase())
        );

        folders.forEach(folder => {
            const li = document.createElement('li');
            li.textContent = `📁 ${folder.name}`;
            li.addEventListener('click', () => {
                this.pathHistory.push(this.currentPath);
                this.navigateToPath(folder.path);
            });
            list.appendChild(li);
        });

        files.forEach(file => {
            const li = document.createElement('li');
            const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
            let icon = '📄';
            if (ext === '.pdf') icon = '📕';
            else if (['.doc', '.docx'].includes(ext)) icon = '📘';
            else if (['.xlsx', '.xls'].includes(ext)) icon = '📊';

            li.innerHTML = `${icon} ${file.name}`;
            li.addEventListener('click', () => this.previewDocument(file.path));
            list.appendChild(li);
        });

        if (list.children.length === 0) {
            resultsCol.innerHTML = '<p>No hay archivos de ausentismo o carpetas para mostrar.</p>';
        } else {
            resultsCol.appendChild(list);
        }
    }

    async previewDocument(filePath) {
        const previewCol = document.getElementById('preview-col');
        const fileExtension = filePath.split('.').pop().toLowerCase();

        previewCol.innerHTML = '<div class="preview-placeholder">Cargando previsualización...</div>';

        if (fileExtension === 'pdf') {
            const safePath = filePath.replace(/\\/g, '/');
            previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${Date.now()}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else if (['doc', '.docx', 'xlsx', 'xls'].includes(fileExtension)) {
            try {
                const result = fileExtension.startsWith('doc')
                    ? await window.electronAPI.convertDocxToPdf(filePath)
                    : await window.electronAPI.convertExcelToPdf(filePath);

                if (result.success) {
                    const safePath = result.pdf_path.replace(/\\/g, '/');
                    previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${Date.now()}" width="100%" height="100%" style="border: none;"></iframe>`;
                } else {
                    const escapedPath = filePath.replace(/\\/g, '\\');
                    previewCol.innerHTML = `
                        <div class="preview-error">
                            <h3>Error de Conversión</h3>
                            <p>${result.error}</p>
                            <button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">
                                Abrir con aplicación externa
                            </button>
                        </div>`;
                }
            } catch (error) {
                const escapedPath = filePath.replace(/\\/g, '\\');
                previewCol.innerHTML = `
                    <div class="preview-error">
                        <h3>Error Inesperado</h3>
                        <p>${error.message}</p>
                        <button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">
                            Abrir con aplicación externa
                        </button>
                    </div>`;
            }
        } else {
            const escapedPath = filePath.replace(/\\/g, '\\');
            previewCol.innerHTML = `
                <div class="preview-error">
                    <h3>Previsualización no disponible</h3>
                    <p>La previsualización para archivos <strong>.${fileExtension}</strong> no está soportada.</p>
                    <button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">
                        Abrir con aplicación externa
                    </button>
                </div>`;
        }
    }

    async openDocument(filePath) {
        try {
            await window.electronAPI.openPath(filePath);
        } catch (error) {
            console.error('Error al abrir el documento:', error);
            this._notify('Error', 'No se pudo abrir el documento.', 'error', 5000);
        }
    }

    // Método para saber qué columnas son editables
    isEditableColumn(colIndex) {
        // Asumiendo que las columnas editables son:
        // Cédula (índice 3), Género (índice 8), Clase de incapacidad (índice 11),
        // Tipo de incapacidad (índice 12), F. inicio (índice 15), F. final (índice 16), Código (índice 17)
        const editableColumns = [3, 8, 11, 12, 15, 16, 17];
        return editableColumns.includes(colIndex);
    }

    // Método para convertir fila y columna a dirección de celda Excel (por ejemplo, A1, B2, etc.)
    getExcelCellAddress(row, col) {
        // Convertir columna a letra (A, B, C, ..., Z, AA, AB, etc.)
        let columnName = '';
        let n = col + 1; // ExcelJS usa base 1, pero nosotros usamos base 0
        while (n > 0) {
            n--;
            columnName = String.fromCharCode(65 + (n % 26)) + columnName;
            n = Math.floor(n / 26);
        }
        return columnName + row;
    }

    // Método para actualizar la tabla con nuevos datos
    updateTableWithNewData(newData) {
        // Aquí puedes actualizar la tabla con los nuevos datos
        // Por simplicidad, recargamos la vista
        this.renderVerAusentismoView(this.container);
    }

    async saveCellData(rowIndex, colIndex, newValue, filePath) {
        try {
            console.log(`Guardando cambios en fila ${rowIndex}, columna ${colIndex}...`);
            this._notify('Cambios guardados', `${newValue} en fila ${rowIndex}, columna ${colIndex}`, 'success');
        } catch (error) {
            console.error('Error al guardar cambios:', error);
            this._notify('Error al guardar', error.message, 'error', 6000);
        }
    }

    // =====================================================
    // NUEVA VISTA: Consulta de Trabajadores
    // Renderiza un iframe con la interfaz de consulta
    // Usa postMessage como proxy porque el iframe no tiene
    // acceso directo a electronAPI (contextIsolation: true)
    // =====================================================
    renderConsultaTrabajadoresView(container) {
        container.style.padding = '0';
        container.style.overflow = 'hidden';

        const iframe = document.createElement('iframe');
        iframe.src = 'modules/gestion-salud/ausentismo/consulta-trabajadores.html';
        iframe.style.cssText = 'width: 100%; height: 100%; border: none; display: block;';

        const self = this;

        const handleConsultaMessage = async (event) => {
            if (event.source !== iframe.contentWindow) return;
            const data = event.data;

            if (data.type === 'back-to-module-request') {
                this.currentView = 'main';
                this.render();
            }

            // Proxy: el iframe pide empresas → el padre consulta electronAPI
            if (data.type === 'ct-empresas-request') {
                try {
                    if (window.electronAPI && typeof window.electronAPI.obtenerEmpresasConBDPersonal === 'function') {
                        const result = await window.electronAPI.obtenerEmpresasConBDPersonal();
                        iframe.contentWindow.postMessage({
                            type: 'ct-empresas-response',
                            success: result && result.success,
                            empresas: result ? result.empresas : ['Tempoactiva', 'Temposum', 'Aseplus', 'ASEL']
                        }, '*');
                    } else {
                        iframe.contentWindow.postMessage({
                            type: 'ct-empresas-response',
                            success: true,
                            empresas: ['Tempoactiva', 'Temposum', 'Aseplus', 'ASEL']
                        }, '*');
                    }
                } catch (error) {
                    console.error('[consulta-trabajadores] Error obteniendo empresas:', error);
                    iframe.contentWindow.postMessage({
                        type: 'ct-empresas-response',
                        success: true,
                        empresas: ['Tempoactiva', 'Temposum', 'Aseplus', 'ASEL']
                    }, '*');
                }
            }

            // Proxy: el iframe pide búsqueda → el padre consulta electronAPI
		if (data.type === 'ct-search-request') {
			try {
                    if (window.electronAPI && typeof window.electronAPI.consultarTrabajadoresGlobal === 'function') {
                        const result = await window.electronAPI.consultarTrabajadoresGlobal({
                            cedula: data.cedula || '',
                            nombre: data.nombre || '',
                            empresa: data.empresa || 'all'
                        });
                        iframe.contentWindow.postMessage({
                            type: 'ct-search-response',
                            success: result && result.success,
                            data: result && result.success ? (result.data || []) : [],
                            error: result && !result.success ? result.error : null,
                            elapsed: data.elapsed || 0
                        }, '*');
                    } else {
                        iframe.contentWindow.postMessage({
                            type: 'ct-search-response',
                            success: false,
                            data: [],
                            error: { message: 'consultarTrabajadoresGlobal no disponible en electronAPI.' }
                        }, '*');
                    }
                } catch (error) {
                    console.error('[consulta-trabajadores] Error en búsqueda:', error);
                    iframe.contentWindow.postMessage({
                        type: 'ct-search-response',
                        success: false,
                        data: [],
                        error: { message: 'Error de conexión: ' + error.message }
                    }, '*');
                }
            }
        };

        window.addEventListener('message', handleConsultaMessage);

        if (this.iframeMessageCleanup) {
            this.iframeMessageCleanup();
        }
        this.iframeMessageCleanup = () => {
            window.removeEventListener('message', handleConsultaMessage);
        };

        iframe.onload = () => {
            try {
                iframe.contentWindow.postMessage({
                    type: 'SET_COMPANY_CONTEXT',
                    company: this.currentCompany
                }, '*');
            } catch (error) {
                console.error('[consulta-trabajadores] Error al enviar contexto al iframe:', error);
            }
        };

        container.appendChild(iframe);
    }

    createHeader(titleText, onBack) {
        const header = document.createElement('div');
        header.className = 'submodule-header';
        header.appendChild(this.createBackButton('&#8592; Volver', onBack));

        const title = document.createElement('h3');
        title.textContent = titleText;
        Object.assign(title.style, {
            flexGrow: '1',
            textAlign: 'center'
        });
        header.appendChild(title);

        return header;
    }

    createBackButton(text, onClick) {
        const button = document.createElement('button');
        button.className = 'btn btn-back';
        button.innerHTML = text;
        button.addEventListener('click', onClick);
        return button;
    }

    // 📦462 (2026-07-03) — Vistas nuevas del módulo de Seguimiento de Gestación.
    // Se renderizan como iframes para mantener el patrón existente del módulo
    // (cada vista es autocontenida y no comparte estado JS con el padre).

    /**
     * Renderiza la vista principal de Seguimiento de Gestación
     * (KPIs + filtros + tabla de gestantes).
     */
    renderSeguimientoGestacionView(container) {
        container.style.padding = '0';
        container.style.overflow = 'hidden';

        const iframe = document.createElement('iframe');
        iframe.src = 'modules/gestion-salud/ausentismo/gestacion-seguimiento-home.html';
        iframe.style.cssText = 'width: 100%; height: 100%; border: none; display: block;';

        const handleMessage = (event) => {
            if (event.source !== iframe.contentWindow) return;
            const data = event.data;
            if (data.type === 'ausentismo-home-action') {
                switch (data.action) {
                    case 'seguimiento-gestacion-antesala':
                        // 📦464 (2026-07-03) — Home ahora pide la ANTESALA en vez del wizard directo.
                        this.currentView = 'seguimiento-gestacion-antesala';
                        this._gestanteActualId = (data.payload && data.payload.gestanteId) || null;
                        this.render();
                        break;
                    case 'seguimiento-gestacion-mensual':
                        this.currentView = 'seguimiento-gestacion-mensual';
                        this._gestanteActualId = (data.payload && data.payload.gestanteId) || null;
                        this.render();
                        break;
                    case 'seguimiento-gestacion-reportes':
                        // 📦477 — Botón "Ver Reportes" desde la home de Gestación
                        this.currentView = 'seguimiento-gestacion-reportes';
                        this.render();
                        break;
                    case 'main':
                        this.currentView = 'main';
                        this.render();
                        break;
                }
            }
        };

        if (this.portalMessageCleanup) {
            this.portalMessageCleanup();
        }
        window.addEventListener('message', handleMessage);
        this.portalMessageCleanup = () => {
            window.removeEventListener('message', handleMessage);
        };

        iframe.onload = () => {
            try {
                // 📦466 (2026-07-03) — Expose electronAPI del renderer principal
                // al iframe para que pueda invocar IPC directo (gestacionCargarTodo, etc.).
                // Patrón idéntico a renderer.js línea 5547. Sin esto, las llamadas
                // `window.electronAPI.gestacionXxx(...)` fallan con "Cannot read
                // properties of undefined".
                if (iframe.contentWindow && window.electronAPI) {
                    iframe.contentWindow.electronAPI = window.electronAPI;
                }
                iframe.contentWindow.postMessage({
                    type: 'SET_COMPANY_CONTEXT',
                    company: this.currentCompany
                }, '*');
            } catch (error) {
                console.error('[seguimiento-gestacion] Error al enviar contexto al iframe:', error);
            }
        };

        container.appendChild(iframe);
    }

    /**
     * 📦464 (2026-07-03) — Renderiza la ANTESALA de seguimiento de gestación.
     * Vista resumen de la gestante (KPIs + datos básicos + próximos seguimientos
     * + historial) que se muestra ANTES del wizard mensual. Desde la antesala,
     * el botón "Iniciar ahora" o "Nuevo Seguimiento" navega a la vista mensual.
     *
     * Patrón idéntico a renderSeguimientoMensualView: iframe + postMessage
     * con SET_COMPANY_CONTEXT (company + gestanteId).
     */
    renderGestacionAntesalaView(container, gestanteId) {
        container.style.padding = '0';
        container.style.overflow = 'hidden';

        const iframe = document.createElement('iframe');
        const idParam = gestanteId ? '?id=' + encodeURIComponent(gestanteId) : '';
        iframe.src = 'modules/gestion-salud/ausentismo/gestacion-antesala.html' + idParam;
        iframe.style.cssText = 'width: 100%; height: 100%; border: none; display: block;';

        const handleMessage = (event) => {
            if (event.source !== iframe.contentWindow) return;
            const data = event.data;
            if (data.type === 'ausentismo-home-action') {
                switch (data.action) {
                    case 'seguimiento-gestacion-mensual':
                        // "Iniciar ahora" desde la antesala → wizard mensual
                        this.currentView = 'seguimiento-gestacion-mensual';
                        this._gestanteActualId = (data.payload && data.payload.gestanteId) || gestanteId;
                        this.render();
                        break;
                    case 'seguimiento-gestacion-reportes':
                        // 📦477 — Abrir Reportes desde cualquier sub-vista de Gestación
                        this.currentView = 'seguimiento-gestacion-reportes';
                        this.render();
                        break;
                    case 'seguimiento-gestacion':
                        // "Volver al listado" → home de seguimiento
                        this.currentView = 'seguimiento-gestacion';
                        this.render();
                        break;
                    case 'main':
                        this.currentView = 'main';
                        this.render();
                        break;
                }
            }
        };

        if (this.portalMessageCleanup) {
            this.portalMessageCleanup();
        }
        window.addEventListener('message', handleMessage);
        this.portalMessageCleanup = () => {
            window.removeEventListener('message', handleMessage);
        };

        iframe.onload = () => {
            try {
                if (iframe.contentWindow && window.electronAPI) {
                    iframe.contentWindow.electronAPI = window.electronAPI;
                }
                iframe.contentWindow.postMessage({
                    type: 'SET_COMPANY_CONTEXT',
                    company: this.currentCompany,
                    gestanteId: gestanteId
                }, '*');
            } catch (error) {
                console.error('[seguimiento-gestacion-antesala] Error al enviar contexto al iframe:', error);
            }
        };

        container.appendChild(iframe);
    }

    /**
     * Renderiza la vista de seguimiento mensual de una gestante específica.
     * Recibe el gestanteId por postMessage o por parámetro directo.
     */
    renderSeguimientoMensualView(container, gestanteId) {
        container.style.padding = '0';
        container.style.overflow = 'hidden';

        const iframe = document.createElement('iframe');
        // Pasamos el gestanteId por query string para que la vista
        // pueda leerlo incluso si llega antes del postMessage.
        const idParam = gestanteId ? '?id=' + encodeURIComponent(gestanteId) : '';
        iframe.src = 'modules/gestion-salud/ausentismo/gestacion-seguimiento-mensual.html' + idParam;
        iframe.style.cssText = 'width: 100%; height: 100%; border: none; display: block;';

        const handleMessage = (event) => {
            if (event.source !== iframe.contentWindow) return;
            const data = event.data;
            if (data.type === 'ausentismo-home-action') {
                switch (data.action) {
                    case 'seguimiento-gestacion':
                        this.currentView = 'seguimiento-gestacion';
                        this.render();
                        break;
                    case 'seguimiento-gestacion-reportes':
                        // 📦477 — Abrir Reportes desde el wizard mensual
                        this.currentView = 'seguimiento-gestacion-reportes';
                        this.render();
                        break;
                    case 'main':
                        this.currentView = 'main';
                        this.render();
                        break;
                }
            }
        };

        if (this.portalMessageCleanup) {
            this.portalMessageCleanup();
        }
        window.addEventListener('message', handleMessage);
        this.portalMessageCleanup = () => {
            window.removeEventListener('message', handleMessage);
        };

        iframe.onload = () => {
            try {
                // 📦466 (2026-07-03) — Expose electronAPI del renderer principal
                // al iframe (gestacion-seguimiento-mensual.html) para que pueda
                // invocar IPC directo (gestacionObtenerGestante, gestacionGuardarSeguimiento).
                // Patrón idéntico a renderer.js línea 5547.
                if (iframe.contentWindow && window.electronAPI) {
                    iframe.contentWindow.electronAPI = window.electronAPI;
                }
                iframe.contentWindow.postMessage({
                    type: 'SET_COMPANY_CONTEXT',
                    company: this.currentCompany,
                    gestanteId: gestanteId
                }, '*');
            } catch (error) {
                console.error('[seguimiento-gestacion-mensual] Error al enviar contexto al iframe:', error);
            }
        };

        container.appendChild(iframe);
    }

    /**
     * 📦477 — Renderiza la vista de Reportes de Seguimiento de Gestación
     * (gestacion-reportes.html). Patrón idéntico a renderGestacionAntesalaView:
     * iframe + postMessage + SET_COMPANY_CONTEXT.
     */
    renderGestacionReportesView(container) {
        container.style.padding = '0';
        container.style.overflow = 'hidden';

        const iframe = document.createElement('iframe');
        iframe.src = 'modules/gestion-salud/ausentismo/gestacion-reportes.html';
        iframe.style.cssText = 'width: 100%; height: 100%; border: none; display: block;';

        const handleMessage = (event) => {
            if (event.source !== iframe.contentWindow) return;
            const data = event.data;
            if (!data || data.type !== 'ausentismo-home-action') return;
            switch (data.action) {
                case 'seguimiento-gestacion':
                    this.currentView = 'seguimiento-gestacion';
                    this.render();
                    break;
                case 'main':
                    this.currentView = 'main';
                    this.render();
                    break;
                default:
                    // Otras acciones del iframe se ignoran aquí
                    break;
            }
        };

        if (this.portalMessageCleanup) this.portalMessageCleanup();
        window.addEventListener('message', handleMessage);
        this.portalMessageCleanup = () => window.removeEventListener('message', handleMessage);

        iframe.onload = () => {
            try {
                // Exponer IPC al iframe (gestacion-reportes.js usa
                // window.electronAPI.gestacionCalcularReporte y printInformeToPdf)
                if (iframe.contentWindow && window.electronAPI) {
                    iframe.contentWindow.electronAPI = window.electronAPI;
                }
                iframe.contentWindow.postMessage({
                    type: 'SET_COMPANY_CONTEXT',
                    company: this.currentCompany
                    // sin gestanteId: reportes trabaja sobre todas las gestantes
                }, '*');
            } catch (error) {
                console.error('[seguimiento-gestacion-reportes] Error al enviar contexto al iframe:', error);
            }
        };

        container.appendChild(iframe);
    }
}

// Exponer globalmente
window.MedicionAusentismoComponent = MedicionAusentismoComponent;
