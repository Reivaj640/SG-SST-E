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
                <i class="bi bi-heart-pulse me-2"></i>
                <div>
                    <div>Gestión de la Salud</div>
                    <span style="font-size: 0.75rem; font-weight: 400; color: var(--k-text-muted);">
                        ${this.currentCompany}
                    </span>
                </div>
            </div>
            <div>
                <button class="k-btn-ingresar"><i class="bi bi-gear"></i> Configuración</button>
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
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 1.5rem;
            }

            /* Widget Base */
            .widget {
                background: var(--k-bg-card);
                border: 1px solid var(--k-border);
                border-radius: var(--k-radius-lg);
                padding: 1.25rem;
                display: flex;
                flex-direction: column;
                position: relative;
                box-shadow: var(--k-shadow-sm);
                transition: transform 0.2s ease;
                min-height: 140px;
            }
            .widget:hover {
                transform: translateY(-3px);
                box-shadow: var(--k-shadow-md);
            }
            .widget h4 {
                margin: 0 0 0.5rem 0;
                font-size: 0.8rem;
                color: var(--k-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
            }
            .widget-value {
                font-size: 1.8rem;
                font-weight: 700;
                color: var(--k-text-main);
                margin-bottom: 0.5rem;
            }
            .widget-description {
                font-size: 0.85rem;
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

        const widget1 = this.createWidget('Exámenes Médicos', '128', '📅 15 pendientes');
        const widget2 = this.createWidget('Accidentes Reportados', '3', '📉 2 menos que el mes pasado');
        const widget3 = this.createWidget('Remisiones', '7', '↗ 1 nueva hoy');
        const widget4 = this.createWidget('Inducción de Personal', '24', '👥 5 por inducir');

        // Nueva tarjeta de seguimientos médicos
        const seguimientosWidget = this.createSeguimientosWidget();

        widgetsContainer.appendChild(widget1);
        widgetsContainer.appendChild(widget2);
        widgetsContainer.appendChild(widget3);
        widgetsContainer.appendChild(widget4);
        widgetsContainer.appendChild(seguimientosWidget);

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
}

// Hacer la clase disponible globalmente
window.GestionSaludHome = GestionSaludHome;