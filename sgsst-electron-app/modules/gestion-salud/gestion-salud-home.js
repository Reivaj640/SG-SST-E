// gestion-salud-home.js - Componente para el home del módulo "Gestión de la Salud"

class GestionSaludHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        this.currentCompany = null;
    }

    getCurrentCompany() {
        if (window.currentCompany && window.currentCompany !== 'default_company') return window.currentCompany;
        if (window.rendererState && window.rendererState.selectedCompany) return window.rendererState.selectedCompany;
        if (window.currentModule && window.currentModule.company) return window.currentModule.company;
        const domCompany = document.getElementById('company-name');
        if (domCompany && domCompany.textContent && domCompany.textContent !== 'Empresa') return domCompany.textContent.trim();
        return 'default_company';
    }

    async render() {
        this.container.innerHTML = '';
        this.currentCompany = this.getCurrentCompany();

        // 1. Inyectar Estilos K+AIR
        this.injectStyles();

        // 2. Layout
        const layout = document.createElement('div');
        layout.className = 'k-app-layout';
        layout.style.height = '100%';

        // Header
        const header = document.createElement('header');
        header.className = 'k-module-header';
        header.innerHTML = `
            <div class="k-module-title">
                <i class="bi bi-heart-pulse me-2" style="color: #212529;"></i>
                <div>
                    <div style="color: #212529; font-weight: 600;">Módulo Gestión de la Salud</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: #6c757d;">
                        ${this.currentCompany} / Gestión de la Salud
                    </span>
                </div>
            </div>
        `;
        layout.appendChild(header);

        // Contenedor Principal
        const contentContainer = document.createElement('div');
        contentContainer.className = 'gestion-salud-home';
        contentContainer.id = 'app-container';

        // Área Principal
        const mainArea = document.createElement('div');
        mainArea.className = 'main-area';
        mainArea.style.flex = '1';

        // Renderizar contenido
        this.renderMainArea(mainArea);

        contentContainer.appendChild(mainArea);
        layout.appendChild(contentContainer);
        this.container.appendChild(layout);
    }

    injectStyles() {
        const styleId = 'k-air-gestion-salud-styles-v1';
        const oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* =========================================
               1. SISTEMA VISUAL K+AIR (OFICIAL) - GESTIÓN DE LA SALUD
               ========================================= */
            .gestion-salud-home {
                --k-primary: #174ea6;
                --k-primary-hover: #185abd;
                --k-primary-light: rgba(23, 78, 166, 0.1);
                --k-success: #28a745;
                --k-success-light: rgba(40, 167, 69, 0.1);
                --k-warning: #ffc107;
                --k-warning-light: rgba(255, 193, 7, 0.1);
                --k-danger: #dc3545;
                --k-danger-light: rgba(220, 53, 69, 0.1);
                --k-info: #17a2b8;
                --k-info-light: rgba(23, 162, 184, 0.1);
                --k-bg-app: #f8f9fa;
                --k-bg-card: #ffffff;
                --k-border: #dee2e6;
                --k-font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
                --k-text-main: #212529;
                --k-text-muted: #6c757d;
                --k-radius-md: 0.375rem;
                --k-radius-lg: 0.5rem;
                --k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.05);
                --k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.08);
                --k-header-height: 60px;

                font-family: var(--k-font-family);
                color: var(--k-text-main);
                background-color: var(--k-bg-app);
                height: 100%;
                display: flex;
                flex-direction: column;
                padding: 1.5rem;
                overflow: hidden;
            }

            /* Header & Botones */
            .k-module-header {
                background-color: var(--k-bg-card);
                border-bottom: 1px solid var(--k-border);
                padding: 0 1.5rem;
                height: var(--k-header-height);
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-shrink: 0;
            }

            .k-module-title {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--k-primary);
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .k-btn-ingresar {
                background-color: var(--k-bg-card);
                border: 1px solid var(--k-border);
                color: var(--k-text-main);
                padding: 0.5rem 1rem;
                border-radius: var(--k-radius-md);
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .k-btn-ingresar:hover {
                background-color: var(--k-primary-light);
                border-color: var(--k-primary);
                color: var(--k-primary);
            }

            /* Main Layout */
            .main-area {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                overflow-y: auto;
                padding-right: 0.5rem;
                width: 100%;
            }

            /* Grid de Widgets */
            .widgets-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 1rem;
            }

            /* Widget Base */
            .widget {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1rem;
                display: flex;
                flex-direction: column;
                position: relative;
                box-shadow: var(--k-shadow-sm);
                transition: transform 0.2s ease;
                min-height: 120px;
            }
            .widget:hover {
                transform: translateY(-3px);
                box-shadow: var(--k-shadow-md);
            }
            .widget h4 {
                margin: 0 0 0.5rem 0;
                font-size: 0.65rem;
                color: var(--k-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
            }
            .widget-value {
                font-size: 1.4rem;
                font-weight: 700;
                color: var(--k-text-main);
                margin-bottom: 0.5rem;
            }
            .widget-description {
                font-size: 0.65rem;
                color: var(--k-text-muted);
            }

            /* Secciones de Gráficos y Listas */
            .chart-container {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.5rem;
                box-shadow: var(--k-shadow-sm);
                min-height: 280px;
                display: flex;
                flex-direction: column;
            }
            .chart-container h3 {
                margin-top: 0;
                margin-bottom: 1rem;
                font-size: 1.1rem;
                color: var(--k-text-main);
            }

            .chart-lines {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .chart-lines svg {
                max-width: 100%;
                height: auto;
            }
            .chart-labels {
                display: flex;
                justify-content: space-between;
                width: 100%;
                margin-top: 0.5rem;
                font-size: 0.75rem;
                color: var(--k-text-muted);
            }
            .chart-placeholder p {
                color: var(--k-text-muted);
                font-size: 0.9rem;
                margin-bottom: 1rem;
            }

            .submodules-container {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.5rem;
                box-shadow: var(--k-shadow-sm);
            }
            .submodules-container h3 {
                margin-top: 0;
                margin-bottom: 1rem;
                font-size: 1.1rem;
                color: var(--k-text-main);
                padding-bottom: 1rem;
                border-bottom: 1px solid var(--k-border);
            }
            .submodules-list {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 1rem;
            }
            .submodule-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem;
                background-color: #fcfcfc;
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-md);
                transition: all 0.2s ease;
            }
            .submodule-item:hover {
                background-color: var(--k-primary-light);
                border-color: var(--k-primary);
                transform: translateX(5px);
            }
            .submodule-info { flex: 1; margin-right: 1rem; }
            .submodule-name { font-weight: 600; color: var(--k-text-main); font-size: 0.95rem; }
            .submodule-meta { font-size: 0.8rem; color: var(--k-text-muted); margin-top: 0.2rem; }
            .btn-ingresar {
                background-color: var(--k-primary);
                color: white;
                border: none;
                padding: 0.5rem 1.25rem;
                border-radius: var(--k-radius-md);
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
                white-space: nowrap;
            }
            .btn-ingresar:hover { background-color: var(--k-primary-hover); }

            /* Widget Ausentismo - Estilos budget-card */
            .kb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
            .kb-title { font-size: 0.65rem; font-weight: 600; color: var(--k-text-muted); text-transform: uppercase; }
            .kb-badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 1rem; color: white; }
            .bg-success { background-color: var(--k-success) !important; }
            .bg-warning { background-color: var(--k-warning) !important; }
            .bg-danger { background-color: var(--k-danger) !important; }
            .kb-amount { font-size: 1.4rem; font-weight: 700; color: var(--k-text-main); margin-bottom: 0.75rem; }
            .kb-progress-track { width: 100%; height: 10px; background-color: #e9ecef; border-radius: 5px; overflow: hidden; margin-bottom: 0.5rem; }
            .kb-progress-bar { height: 100%; width: 0%; border-radius: 5px; background-color: var(--k-primary); transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
            .kb-footer { display: flex; justify-content: space-between; font-size: 0.6rem; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--k-border); }
            .kb-label { color: var(--k-text-muted); font-weight: 500; font-size: 0.6rem; }
            .kb-value { font-weight: 600; }
            .kb-exec { color: var(--k-success); }
            .kb-rem { color: var(--k-primary); }
            .ausentismo-toggles { display: flex; gap: 6px; margin-top: 8px; margin-bottom: 10px; }
            .ausentismo-toggle { flex: 1; padding: 5px 8px; font-size: 0.72rem; border: 1px solid var(--k-border); border-radius: 6px; cursor: pointer; font-weight: 500; font-family: inherit; transition: all 0.2s; }

            /* =========================================
               TEMA OSCURO (MODO SYSTEM/DARK)
               ========================================= */
            [data-theme="dark"] .gestion-salud-home {
                --k-primary: #4da6ff;
                --k-primary-hover: #66b3ff;
                --k-primary-light: rgba(77, 166, 255, 0.15);
                --k-success: #5cb85c;
                --k-success-light: rgba(92, 184, 92, 0.15);
                --k-warning: #f0ad4e;
                --k-warning-light: rgba(240, 173, 78, 0.15);
                --k-danger: #d9534f;
                --k-danger-light: rgba(217, 83, 79, 0.15);
                --k-bg-app: #1a202c;
                --k-bg-card: #2d3748;
                --k-border: #4a5568;
                --k-text-main: #e9ecef;
                --k-text-muted: #adb5bd;
                --k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.3);
                --k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.4);
            }

            /* =========================================
               TEMA OSCURO (DARK-LEGACY - PALETA NEGRO/GRIS)
               ========================================= */
            [data-theme="dark-legacy"] .gestion-salud-home {
                --k-primary: #9e9e9e;
                --k-primary-hover: #bdbdbd;
                --k-primary-light: rgba(158, 158, 158, 0.15);
                --k-success: #4caf50;
                --k-success-light: rgba(76, 175, 80, 0.15);
                --k-warning: #ff9800;
                --k-warning-light: rgba(255, 152, 0, 0.15);
                --k-danger: #f44336;
                --k-danger-light: rgba(244, 67, 54, 0.15);
                --k-bg-app: #121212;
                --k-bg-card: #1e1e1e;
                --k-border: #404040;
                --k-text-main: #e0e0e0;
                --k-text-muted: #a0a0a0;
                --k-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.6);
                --k-shadow-md: 0 0.5rem 1rem rgba(0, 0, 0, 0.8);
            }
        `;
        document.head.appendChild(style);
    }

    renderMainArea(container) {
        // Widgets con contadores específicos para Gestión de la Salud
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        const widget1 = this.createExamenesWidget();
        const accidentesWidget = this.createAccidentesWidget();
        const widget3 = this.createWidget('Remisiones', '7', '↗ 1 nueva hoy');

        // Nueva tarjeta de seguimientos médicos
        const seguimientosWidget = this.createSeguimientosWidget();

        // Nueva tarjeta de ausentismo
        const ausentismoWidget = this.createAusentismoWidget();

        widgetsContainer.appendChild(widget1);
        widgetsContainer.appendChild(accidentesWidget);
        widgetsContainer.appendChild(widget3);
        widgetsContainer.appendChild(seguimientosWidget);
        widgetsContainer.appendChild(ausentismoWidget);

        container.appendChild(widgetsContainer);
        
        // Gráfica (simulada)
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h3>Índice de Accidentabilidad</h3>
            <div class="chart-placeholder">
                <p>gráfica de líneas mostrando la tendencia mensual</p>
                <div class="chart-lines">
                    <svg width="100%" height="150">
                        <polyline points="10,140 40,120 70,100 100,110 130,80 160,90 190,70" 
                                  fill="none" stroke="#4CAF50" stroke-width="2"></polyline>
                        <polyline points="10,130 40,110 70,90 100,100 130,70 160,80 190,60" 
                                  fill="none" stroke="#2196F3" stroke-width="2" stroke-dasharray="5,5"></polyline>
                    </svg>
                    <div class="chart-labels">
                        <span>Ene</span>
                        <span>Feb</span>
                        <span>Mar</span>
                        <span>Abr</span>
                        <span>May</span>
                        <span>Jun</span>
                        <span>Jul</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(chartContainer);
        
        // Listado de submódulos
        const submodulesContainer = document.createElement('div');
        submodulesContainer.className = 'submodules-container';
        
        const submodulesTitle = document.createElement('h3');
        submodulesTitle.textContent = 'Submódulos';
        submodulesContainer.appendChild(submodulesTitle);
        
        const submodulesList = document.createElement('div');
        submodulesList.className = 'submodules-list';
        
        this.submodules.forEach(submodule => {
            const submoduleItem = this.renderSubmoduleItem(submodule);
            submodulesList.appendChild(submoduleItem);
        });
        
        submodulesContainer.appendChild(submodulesList);
        container.appendChild(submodulesContainer);
    }
    
    createWidget(title, value, description) {
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.innerHTML = `
            <h4>${title}</h4>
            <div class="widget-value">${value}</div>
            <div class="widget-description">${description}</div>
        `;
        return widget;
    }

    // Función para crear el widget de seguimientos médicos
    createSeguimientosWidget() {
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.id = 'seguimientos-widget'; // Añadimos un ID para actualizarlo dinámicamente

        // Inicialmente mostramos valores por defecto
        widget.innerHTML = `
            <h4>Seguimientos Médicos</h4>
            <div class="widget-value">Cargando...</div>
            <div class="widget-description">Iniciando...</div>
        `;

        // Cargar los datos reales
        this.cargarDatosSeguimientos(widget);

        return widget;
    }

    // Función para cargar los datos reales de seguimientos
    async cargarDatosSeguimientos(widget) {
        try {
            // Para esta funcionalidad, vamos a usar la API existente de ausentismo
            // para obtener los datos de seguimientos desde el archivo externo
            if (window.electronAPI && typeof window.electronAPI.loadFollowUpData === 'function') {
                // Obtener la empresa actual del contexto global
                // Primero intentamos encontrar la empresa desde diferentes posibles fuentes
                let currentCompany = null;

                // Intentar obtener la empresa desde diferentes fuentes comunes
                if (window.currentCompany) {
                    currentCompany = window.currentCompany;
                } else if (window.selectedCompany) {
                    currentCompany = window.selectedCompany;
                } else if (typeof getCurrentCompany === 'function') {
                    currentCompany = getCurrentCompany();
                } else if (document.querySelector('#company-name')) {
                    currentCompany = document.querySelector('#company-name').textContent.trim();
                } else if (window.location && window.location.href) {
                    // Extraer empresa del URL si está presente
                    const urlParams = new URLSearchParams(window.location.search);
                    currentCompany = urlParams.get('company') || urlParams.get('empresa');
                }

                // Si no se encontró empresa, usar una por defecto
                if (!currentCompany) {
                    currentCompany = 'Tempoactiva';
                }

                // Primero obtener los datos de seguimientos
                const followUpResult = await window.electronAPI.loadFollowUpData(currentCompany);

                // Luego obtener los datos de ausentismo para complementar
                const ausentismoResult = await window.electronAPI.readAusentismoData(currentCompany);

                let totalPendientes = 0;
                let totalRealizados = 0;

                // Procesar datos de seguimientos - considerando casos individuales > 15 días O suma de casos > 15 días por empleado/año
                if (followUpResult.success && followUpResult.followUps) {
                    // Agrupar casos de ausentismo por empleado para verificar sumas
                    const casosPorEmpleado = {};
                    if (ausentismoResult.success && ausentismoResult.rows && ausentismoResult.rows.length > 0) {
                        const headers = ausentismoResult.headers;
                        const cedulaIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('cedula'));
                        const diasIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('dias'));
                        const fechaInicioIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('f. inicio'));
                        const annoIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('año'));

                        const currentYear = new Date().getFullYear();

                        if (cedulaIndex !== -1) {
                            for (const row of ausentismoResult.rows) {
                                if (row[cedulaIndex] && diasIndex !== -1) {
                                    const cedula = row[cedulaIndex].toString().replace(/,/g, '').replace(/\./g, '').replace(/\s/g, '');

                                    // Verificar si es del año actual
                                    let esDelAnnoActual = false;
                                    if (annoIndex !== -1 && row[annoIndex]) {
                                        const annoCelda = row[annoIndex].toString();
                                        if (annoCelda.trim() === currentYear.toString()) {
                                            esDelAnnoActual = true;
                                        } else {
                                            const annoNumero = parseInt(annoCelda);
                                            if (!isNaN(annoNumero) && annoNumero === currentYear) {
                                                esDelAnnoActual = true;
                                            }
                                        }
                                    } else if (fechaInicioIndex !== -1 && row[fechaInicioIndex]) {
                                        const fechaInicio = row[fechaInicioIndex];
                                        let fechaInicioParseada = null;

                                        if (typeof fechaInicio === 'string') {
                                            if (fechaInicio.includes('-')) {
                                                fechaInicioParseada = new Date(fechaInicio);
                                            } else if (fechaInicio.includes('/')) {
                                                const partes = fechaInicio.split('/');
                                                if (partes.length === 3) {
                                                    let [part1, part2, yearPart] = partes;
                                                    if (yearPart.length === 2) {
                                                        yearPart = '20' + yearPart;
                                                    }
                                                    const fecha1 = new Date(`${part1}/${part2}/${yearPart}`);
                                                    const fecha2 = new Date(`${part2}/${part1}/${yearPart}`);

                                                    if (!isNaN(fecha1.getTime())) {
                                                        fechaInicioParseada = fecha1;
                                                    } else if (!isNaN(fecha2.getTime())) {
                                                        fechaInicioParseada = fecha2;
                                                    }
                                                }
                                            }
                                        } else if (fechaInicio instanceof Date) {
                                            fechaInicioParseada = fechaInicio;
                                        }

                                        if (fechaInicioParseada && !isNaN(fechaInicioParseada.getTime())) {
                                            if (fechaInicioParseada.getFullYear() === currentYear) {
                                                esDelAnnoActual = true;
                                            }
                                        }
                                    }

                                    if (esDelAnnoActual && cedula) {
                                        if (!casosPorEmpleado[cedula]) {
                                            casosPorEmpleado[cedula] = [];
                                        }

                                        let diasNum = 0;
                                        if (diasIndex !== -1 && row[diasIndex] !== null && row[diasIndex] !== undefined) {
                                            const diasStr = row[diasIndex].toString();
                                            diasNum = parseInt(diasStr.replace(/,/g, ''));
                                            if (isNaN(diasNum)) diasNum = 0;
                                        }

                                        casosPorEmpleado[cedula].push({
                                            dias: diasNum,
                                            fechaInicio: row[fechaInicioIndex] || null
                                        });
                                    }
                                }
                            }
                        }
                    }

                    // Procesar cada empleado que tiene seguimiento
                    for (const empId in followUpResult.followUps) {
                        const followUps = followUpResult.followUps[empId];
                        if (followUps && followUps.length > 0) {
                            // Tomar el estado más reciente de cada empleado (el último registro)
                            const sortedFollowUps = [...followUps].sort((a, b) => {
                                const dateA = new Date(a["Fecha Seguimiento"] || 0);
                                const dateB = new Date(b["Fecha Seguimiento"] || 0);
                                return dateB - dateA; // Orden descendente, más reciente primero
                            });

                            const latestFollowUp = sortedFollowUps[0];
                            const estado = latestFollowUp["Estado Caso"];

                            // Verificar si el empleado tiene casos que sumen más de 15 días en el año actual
                            let empleadoTieneMasDe15Dias = false;
                            if (casosPorEmpleado[empId]) {
                                // Sumar todos los días para este empleado en el año actual
                                const totalDiasEmpleado = casosPorEmpleado[empId].reduce((sum, caso) => sum + caso.dias, 0);
                                if (totalDiasEmpleado > 15) {
                                    empleadoTieneMasDe15Dias = true;
                                } else {
                                    // También verificar si algún caso individual tiene más de 15 días
                                    const casoIndividualMayor15 = casosPorEmpleado[empId].some(caso => caso.dias > 15);
                                    if (casoIndividualMayor15) {
                                        empleadoTieneMasDe15Dias = true;
                                    }
                                }
                            }

                            // Solo procesar si el empleado tiene casos que suman más de 15 días
                            if (empleadoTieneMasDe15Dias) {
                                // console.log(`[DEBUG] Procesando empleado con seguimiento: ${empId}, Último estado: ${estado}, Total días > 15`);

                                if (estado && estado.toLowerCase() === 'recovered') {
                                    totalRealizados++;
                                    // console.log(`[DEBUG] Caso contado como realizado: ${estado}`);
                                } else if (estado) {
                                    // Considerar como pendiente/activo cualquier estado que no sea recovered
                                    totalPendientes++;
                                    // console.log(`[DEBUG] Caso contado como pendiente: ${estado}`);
                                } else {
                                    // console.log(`[DEBUG] Caso sin estado definido, contado como pendiente`);
                                    totalPendientes++; // Por seguridad, contamos sin estado como pendiente
                                }
                            } else {
                                // console.log(`[DEBUG] Empleado ${empId} tiene seguimiento pero casos <= 15 días en total, ignorado`);
                            }
                        }
                    }
                }

                // Si también tenemos datos de ausentismo, verificar si hay casos sin seguimiento del año en curso y con más de 15 días
                if (ausentismoResult.success && ausentismoResult.rows && ausentismoResult.rows.length > 0) {
                    // Encontrar índices de columnas importantes
                    const headers = ausentismoResult.headers;
                    const cedulaIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('cedula'));
                    const fechaInicioIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('f. inicio'));
                    const fechaFinIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('f. fin'));
                    const diasIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('dias'));
                    const annoIndex = headers.findIndex(h => h && h.toString().toLowerCase().includes('año'));

                    const currentYear = new Date().getFullYear();

                    if (cedulaIndex !== -1) {
                        // Contar casos del archivo principal que no tienen registro en el archivo de seguimientos Y que son del año en curso y con más de 15 días
                        let casosSinSeguimiento = 0;
                        for (const row of ausentismoResult.rows) {
                            if (row[cedulaIndex]) {
                                const cedula = row[cedulaIndex].toString().replace(/,/g, '').replace(/\./g, '').replace(/\s/g, '');

                                // Verificar si es del año en curso
                                let esDelAnnoActual = false;

                                // Comprobar por año
                                if (annoIndex !== -1 && row[annoIndex]) {
                                    const annoCelda = row[annoIndex].toString();
                                    if (annoCelda.trim() === currentYear.toString()) {
                                        esDelAnnoActual = true;
                                    } else {
                                        // A veces el año puede ser un número decimal (por ejemplo 2025.0)
                                        const annoNumero = parseInt(annoCelda);
                                        if (!isNaN(annoNumero) && annoNumero === currentYear) {
                                            esDelAnnoActual = true;
                                        }
                                    }
                                }

                                // Si no está en columna AÑO, comprobar por fecha de inicio
                                if (!esDelAnnoActual && fechaInicioIndex !== -1 && row[fechaInicioIndex]) {
                                    const fechaInicio = row[fechaInicioIndex];
                                    let fechaInicioParseada = null;

                                    if (typeof fechaInicio === 'string') {
                                        if (fechaInicio.includes('-')) {
                                            fechaInicioParseada = new Date(fechaInicio);
                                        } else if (fechaInicio.includes('/')) {
                                            const partes = fechaInicio.split('/');
                                            if (partes.length === 3) {
                                                let [part1, part2, yearPart] = partes;
                                                if (yearPart.length === 2) {
                                                    yearPart = '20' + yearPart;  // Asumir siglo 21
                                                }
                                                // Intentar ambos formatos MM/DD/YYYY y DD/MM/YYYY
                                                const fecha1 = new Date(`${part1}/${part2}/${yearPart}`);
                                                const fecha2 = new Date(`${part2}/${part1}/${yearPart}`);

                                                if (!isNaN(fecha1.getTime())) {
                                                    fechaInicioParseada = fecha1;
                                                } else if (!isNaN(fecha2.getTime())) {
                                                    fechaInicioParseada = fecha2;
                                                }
                                            }
                                        } else {
                                            // Intentar parsear como número (formato Excel de fecha serial)
                                            const fechaNum = parseFloat(fechaInicio);
                                            if (!isNaN(fechaNum) && fechaNum > 1) {
                                                const excelDate = new Date((fechaNum - 25569) * 86400 * 1000);
                                                fechaInicioParseada = excelDate;
                                            }
                                        }
                                    } else if (fechaInicio instanceof Date) {
                                        fechaInicioParseada = fechaInicio;
                                    }

                                    if (fechaInicioParseada && !isNaN(fechaInicioParseada.getTime())) {
                                        if (fechaInicioParseada.getFullYear() === currentYear) {
                                            esDelAnnoActual = true;
                                        }
                                    }
                                }

                                // Verificar si tiene más de 15 días de incapacidad
                                let tieneMasDe15Dias = false;
                                if (diasIndex !== -1 && row[diasIndex] !== null && row[diasIndex] !== undefined) {
                                    const diasStr = row[diasIndex].toString();
                                    const diasNum = parseInt(diasStr.replace(/,/g, '')); // Eliminar posibles comas
                                    if (!isNaN(diasNum) && diasNum > 15) {
                                        tieneMasDe15Dias = true;
                                    }
                                }

                                // Si la cédula no está en followUpResult.followUps y es del año actual y tiene más de 15 días, es un caso sin seguimiento
                                if (cedula && !followUpResult.followUps?.[cedula] && esDelAnnoActual && tieneMasDe15Dias) {
                                    // Este caso está en el archivo principal, es del año actual, tiene más de 15 días, pero no tiene registro de seguimiento
                                    // Lo contamos como pendiente (activo) ya que no sabemos su estado actual
                                    casosSinSeguimiento++;
                                    console.log(`[DEBUG] Caso sin seguimiento del año actual con más de 15 días encontrado: ${cedula}, Días: ${row[diasIndex]}`);
                                } else if (cedula && !followUpResult.followUps?.[cedula] && esDelAnnoActual) {
                                    // Caso sin seguimiento del año actual pero con <=15 días, ignorado
                                } else if (cedula && !followUpResult.followUps?.[cedula]) {
                                    // Caso sin seguimiento pero de otro año o con <=15 días, ignorado
                                }
                            }
                        }
                        totalPendientes += casosSinSeguimiento;
                    }
                }

                console.log(`[DEBUG] Total pendientes (desde archivos principales y de seguimiento): ${totalPendientes}, Total realizados (desde archivos de seguimiento): ${totalRealizados}`);

                // Actualizar el widget con los datos reales
                this.actualizarWidgetSeguimientos(widget, totalPendientes, totalRealizados);
            } else {
                // Si la API no está disponible, mostrar valores por defecto
                this.actualizarWidgetSeguimientos(widget, 0, 0);
            }
        } catch (error) {
            console.error('Error al cargar datos de seguimientos:', error);
            // En caso de error, mostrar mensaje de error pero sin romper el UI
            this.actualizarWidgetSeguimientos(widget, 0, 0, 'Error al cargar datos');
        }
    }

    // Función para actualizar el widget con los datos reales
    actualizarWidgetSeguimientos(widget, pendientes, realizados, error = null) {
        if (error) {
            widget.innerHTML = `
                <h4>Seguimientos Médicos</h4>
                <div class="widget-value">Err</div>
                <div class="widget-description">${error}</div>
            `;
        } else {
            widget.innerHTML = `
                <h4>Seguimientos Médicos</h4>
                <div class="widget-value">${pendientes}</div>
                <div class="widget-description">📅 ${realizados} realizados</div>
            `;
        }
    }
    
    renderSubmoduleItem(name) {
        // Generar datos simulados para el submódulo
        const lastAccess = this.getRandomLastAccess();
        const timeSpent = this.getRandomTimeSpent();

        const submoduleItem = document.createElement('div');
        submoduleItem.className = 'submodule-item';

        const submoduleInfo = document.createElement('div');
        submoduleInfo.className = 'submodule-info';

        const submoduleName = document.createElement('div');
        submoduleName.className = 'submodule-name';
        submoduleName.textContent = name;
        submoduleInfo.appendChild(submoduleName);

        const submoduleMeta = document.createElement('div');
        submoduleMeta.className = 'submodule-meta';
        submoduleMeta.textContent = `Último acceso: ${lastAccess} | Tiempo: ${timeSpent}`;
        submoduleInfo.appendChild(submoduleMeta);

        const button = document.createElement('button');
        button.className = 'btn btn-primary btn-ingresar';
        button.textContent = 'Ingresar';
        button.addEventListener('click', () => {
            console.log('[GESTION-SALUD-HOME] Click en submódulo:', name);
            console.log('[GESTION-SALUD-HOME] this.container:', this.container);
            console.log('[GESTION-SALUD-HOME] this.moduleName:', this.moduleName);
            console.log('[GESTION-SALUD-HOME] typeof showSubmoduleContent:', typeof showSubmoduleContent);
            showSubmoduleContent(this.container, this.moduleName, name);
        });

        submoduleItem.appendChild(submoduleInfo);
        submoduleItem.appendChild(button);
        
        return submoduleItem;
    }
    
    getRandomLastAccess() {
        const days = ['Hace 1 día', 'Hace 2 días', 'Hace 3 días', 'Hace 1 semana', 'Hace 2 semanas'];
        return days[Math.floor(Math.random() * days.length)];
    }
    
    getRandomTimeSpent() {
        const times = ['5 min', '15 min', '30 min', '1 hora', '2 horas'];
        return times[Math.floor(Math.random() * times.length)];
    }
    
    async renderSidebarPanel(container) {
    }

    /**
     * Widget de Ausentismo Médico con toggle Año/Mes
     */
    createAusentismoWidget() {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        widget.id = 'ausentismo-widget';

        let currentMode = 'year';
        let cachedData = null;

        widget.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Ausentismo Médico</span>
                <span class="kb-badge bg-success" id="ausentismo-badge">—</span>
            </div>
            <div class="ausentismo-toggles">
                <button class="ausentismo-toggle" data-mode="year" style="background:var(--k-primary);color:white;">Año</button>
                <button class="ausentismo-toggle" data-mode="month" style="background:var(--k-bg-card);color:var(--k-text-muted);">Mes</button>
            </div>
            <div class="kb-amount" style="text-align:center;">
                <span class="ausentismo-value">—</span>
            </div>
            <div class="ausentismo-desc" style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:8px;">
                Registro y seguimiento de casos de ausentismo
            </div>
            <div class="kb-footer">
                <div>
                    <div class="kb-label">Total Año</div>
                    <div class="kb-value kb-exec ausentismo-total-year">—</div>
                </div>
                <div style="text-align:right;">
                    <div class="kb-label">Mes Actual</div>
                    <div class="kb-value kb-rem ausentismo-total-month">—</div>
                </div>
            </div>
        `;

        async function actualizarDatos() {
            const valueEl = widget.querySelector('.ausentismo-value');
            const badgeEl = widget.querySelector('#ausentismo-badge');
            const descEl = widget.querySelector('.ausentismo-desc');

            valueEl.textContent = '...';
            badgeEl.textContent = '...';

            try {
                let company = window.currentCompany || 'Tempoactiva';
                if (!company) company = 'Tempoactiva';

                const result = await window.electronAPI.getAusentismoStats(company, currentMode);

                if (result && result.success) {
                    cachedData = result.data;
                    const totalVal = currentMode === 'year' ? cachedData.total : cachedData.mesActual;
                    valueEl.textContent = totalVal;

                    if (currentMode === 'year') {
                        badgeEl.textContent = `${cachedData.year}`;
                        badgeEl.className = 'kb-badge bg-success';
                        descEl.textContent = `Incapacidades registradas en ${cachedData.year}`;
                    } else {
                        badgeEl.textContent = `${cachedData.mes}`;
                        badgeEl.className = 'kb-badge bg-warning';
                        descEl.textContent = `Incapacidades en ${cachedData.mes} ${cachedData.year}`;
                    }

                    // Actualizar footer siempre
                    const yearEl = widget.querySelector('.ausentismo-total-year');
                    const monthEl = widget.querySelector('.ausentismo-total-month');
                    if (yearEl) yearEl.textContent = cachedData.total;
                    if (monthEl) monthEl.textContent = cachedData.mesActual;
                } else {
                    valueEl.textContent = '0';
                    badgeEl.textContent = '—';
                    descEl.textContent = (result && result.error) ? result.error : 'Sin datos disponibles';
                }
            } catch (error) {
                console.error('[ausentismo-widget] Error:', error);
                valueEl.textContent = '0';
                badgeEl.textContent = '—';
                descEl.textContent = 'Error al cargar datos';
            }
        }

        // Deferir configuración de toggles hasta que el widget esté en el DOM
        setTimeout(() => {
            const toggleBtns = widget.querySelectorAll('.ausentismo-toggle');
            toggleBtns.forEach(btn => {
                btn.addEventListener('click', function () {
                    const mode = this.getAttribute('data-mode');
                    if (mode === currentMode) return;

                    currentMode = mode;

                    toggleBtns.forEach(b => {
                        b.style.background = 'var(--k-bg-card)';
                        b.style.color = 'var(--k-text-muted)';
                    });
                    this.style.background = 'var(--k-primary)';
                    this.style.color = 'white';

                    console.log(`[AUS-WIDGET] Toggle cambiado a: ${currentMode}`);
                    actualizarDatos();
                });
            });
        }, 100);

        actualizarDatos();
        return widget;
    }

    /**
     * Widget de Exámenes Médicos con toggle Año/Mes
     */
    createExamenesWidget() {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        widget.id = 'examenes-widget';

        let currentMode = 'year';
        let cachedData = null;

        widget.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Exámenes Médicos</span>
                <span class="kb-badge bg-success" id="examenes-badge">—</span>
            </div>
            <div class="ausentismo-toggles">
                <button class="ausentismo-toggle exam-toggle" data-mode="year" style="background:var(--k-primary);color:white;">Año</button>
                <button class="ausentismo-toggle exam-toggle" data-mode="month" style="background:var(--k-bg-card);color:var(--k-text-muted);">Mes</button>
            </div>
            <div class="kb-amount" style="text-align:center;">
                <span class="examenes-value">—</span>
            </div>
            <div class="examenes-desc" style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:8px;">
                Evaluaciones médicas ocupacionales
            </div>
            <div class="kb-footer">
                <div>
                    <div class="kb-label">Total Año</div>
                    <div class="kb-value kb-exec examenes-total-year">—</div>
                </div>
                <div style="text-align:right;">
                    <div class="kb-label">Mes Actual</div>
                    <div class="kb-value kb-rem examenes-total-month">—</div>
                </div>
            </div>
        `;

        async function actualizarDatos() {
            const valueEl = widget.querySelector('.examenes-value');
            const badgeEl = widget.querySelector('#examenes-badge');
            const descEl = widget.querySelector('.examenes-desc');

            valueEl.textContent = '...';
            badgeEl.textContent = '...';

            try {
                const company = window.currentCompany || 'default_company';
                const result = await window.electronAPI.getExamenesStats(company);

                if (result && result.success) {
                    cachedData = result.data;
                    const displayVal = currentMode === 'year' ? cachedData.totalYear : cachedData.mesActual;
                    valueEl.textContent = displayVal;

                    if (currentMode === 'year') {
                        badgeEl.textContent = `${cachedData.year}`;
                        badgeEl.className = 'kb-badge bg-success';
                        descEl.textContent = `Evaluaciones médicas en ${cachedData.year}`;
                    } else {
                        badgeEl.textContent = `${cachedData.mes}`;
                        badgeEl.className = 'kb-badge bg-warning';
                        descEl.textContent = `Evaluaciones en ${cachedData.mes} ${cachedData.year}`;
                    }

                    const yearEl = widget.querySelector('.examenes-total-year');
                    const monthEl = widget.querySelector('.examenes-total-month');
                    if (yearEl) yearEl.textContent = cachedData.totalYear;
                    if (monthEl) monthEl.textContent = cachedData.mesActual;
                } else {
                    valueEl.textContent = '0';
                    badgeEl.textContent = '—';
                    descEl.textContent = (result && result.error) ? result.error : 'Sin datos disponibles';
                }
            } catch (error) {
                console.error('[examenes-widget] Error:', error);
                valueEl.textContent = '0';
                badgeEl.textContent = '—';
                descEl.textContent = 'Error al cargar datos';
            }
        }

        setTimeout(() => {
            const toggleBtns = widget.querySelectorAll('.exam-toggle');
            toggleBtns.forEach(btn => {
                btn.addEventListener('click', function () {
                    const mode = this.getAttribute('data-mode');
                    if (mode === currentMode) return;

                    currentMode = mode;
                    toggleBtns.forEach(b => {
                        b.style.background = 'var(--k-bg-card)';
                        b.style.color = 'var(--k-text-muted)';
                    });
                    this.style.background = 'var(--k-primary)';
                    this.style.color = 'white';

                    if (!cachedData) { actualizarDatos(); return; }

                    const valueEl = widget.querySelector('.examenes-value');
                    const badgeEl = widget.querySelector('#examenes-badge');
                    const descEl = widget.querySelector('.examenes-desc');

                    const displayVal = currentMode === 'year' ? cachedData.totalYear : cachedData.mesActual;
                    valueEl.textContent = displayVal;

                    if (currentMode === 'year') {
                        badgeEl.textContent = `${cachedData.year}`;
                        badgeEl.className = 'kb-badge bg-success';
                        descEl.textContent = `Evaluaciones médicas en ${cachedData.year}`;
                    } else {
                        badgeEl.textContent = `${cachedData.mes}`;
                        badgeEl.className = 'kb-badge bg-warning';
                        descEl.textContent = `Evaluaciones en ${cachedData.mes} ${cachedData.year}`;
                    }
                });
            });
        }, 100);

        actualizarDatos();
        return widget;
    }

    /**
     * Widget de Accidentes Reportados FURAT con toggle Año/Mes
     */
    createAccidentesWidget() {
        const widget = document.createElement('div');
        widget.className = 'widget k-budget-card';
        widget.id = 'accidentes-widget';

        let currentMode = 'year';
        let cachedData = null;

        widget.innerHTML = `
            <div class="kb-header">
                <span class="kb-title">Accidentes Reportados</span>
                <span class="kb-badge bg-danger" id="accidentes-badge">—</span>
            </div>
            <div class="ausentismo-toggles">
                <button class="ausentismo-toggle acc-toggle" data-mode="year" style="background:var(--k-primary);color:white;">Año</button>
                <button class="ausentismo-toggle acc-toggle" data-mode="month" style="background:var(--k-bg-card);color:var(--k-text-muted);">Mes</button>
            </div>
            <div class="kb-amount" style="text-align:center;">
                <span class="accidentes-value">—</span>
            </div>
            <div class="accidentes-desc" style="font-size:0.72rem;color:var(--k-text-muted);text-align:center;margin-bottom:8px;">
                Reportes FURAT registrados
            </div>
            <div class="kb-footer">
                <div>
                    <div class="kb-label">Total Año</div>
                    <div class="kb-value kb-exec accidentes-total-year">—</div>
                </div>
                <div style="text-align:right;">
                    <div class="kb-label">Mes Actual</div>
                    <div class="kb-value kb-rem accidentes-total-month">—</div>
                </div>
            </div>
        `;

        async function actualizarDatos() {
            const valueEl = widget.querySelector('.accidentes-value');
            const badgeEl = widget.querySelector('#accidentes-badge');
            const descEl = widget.querySelector('.accidentes-desc');

            valueEl.textContent = '...';
            badgeEl.textContent = '...';

            try {
                const company = window.currentCompany || 'default_company';
                const result = await window.electronAPI.getAccidentesStats(company);

                if (result && result.success) {
                    cachedData = result.data;
                    const displayVal = currentMode === 'year' ? cachedData.totalYear : cachedData.mesActual;
                    valueEl.textContent = displayVal;

                    if (currentMode === 'year') {
                        badgeEl.textContent = `${cachedData.year}`;
                        badgeEl.className = 'kb-badge bg-danger';
                        descEl.textContent = `Reportes FURAT en ${cachedData.year}`;
                    } else {
                        badgeEl.textContent = `${cachedData.mes}`;
                        badgeEl.className = 'kb-badge bg-warning';
                        descEl.textContent = `Reportes en ${cachedData.mes} ${cachedData.year}`;
                    }

                    const yearEl = widget.querySelector('.accidentes-total-year');
                    const monthEl = widget.querySelector('.accidentes-total-month');
                    if (yearEl) yearEl.textContent = cachedData.totalYear;
                    if (monthEl) monthEl.textContent = cachedData.mesActual;
                } else {
                    valueEl.textContent = '0';
                    badgeEl.textContent = '—';
                    descEl.textContent = (result && result.error) ? result.error : 'Sin datos disponibles';
                }
            } catch (error) {
                console.error('[accidentes-widget] Error:', error);
                valueEl.textContent = '0';
                badgeEl.textContent = '—';
                descEl.textContent = 'Error al cargar datos';
            }
        }

        setTimeout(() => {
            const toggleBtns = widget.querySelectorAll('.acc-toggle');
            toggleBtns.forEach(btn => {
                btn.addEventListener('click', function () {
                    const mode = this.getAttribute('data-mode');
                    if (mode === currentMode) return;

                    currentMode = mode;
                    toggleBtns.forEach(b => {
                        b.style.background = 'var(--k-bg-card)';
                        b.style.color = 'var(--k-text-muted)';
                    });
                    this.style.background = 'var(--k-primary)';
                    this.style.color = 'white';

                    if (!cachedData) { actualizarDatos(); return; }

                    const valueEl = widget.querySelector('.accidentes-value');
                    const badgeEl = widget.querySelector('#accidentes-badge');
                    const descEl = widget.querySelector('.accidentes-desc');

                    const displayVal = currentMode === 'year' ? cachedData.totalYear : cachedData.mesActual;
                    valueEl.textContent = displayVal;

                    if (currentMode === 'year') {
                        badgeEl.textContent = `${cachedData.year}`;
                        badgeEl.className = 'kb-badge bg-danger';
                        descEl.textContent = `Reportes FURAT en ${cachedData.year}`;
                    } else {
                        badgeEl.textContent = `${cachedData.mes}`;
                        badgeEl.className = 'kb-badge bg-warning';
                        descEl.textContent = `Reportes en ${cachedData.mes} ${cachedData.year}`;
                    }
                });
            });
        }, 100);

        actualizarDatos();
        return widget;
    }
}

// Hacer la clase disponible globalmente
window.GestionSaludHome = GestionSaludHome;