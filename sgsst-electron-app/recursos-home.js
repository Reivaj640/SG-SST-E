// recursos-home.js - Componente para el home del módulo "Recursos"

class RecursosHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;

        // NO intentar obtener la empresa aquí - lo haremos cuando se necesite
        this.currentCompany = null;

        // Variable para almacenar los datos del presupuesto actualizados
        this.budgetData = null;
    }

    getCurrentCompany() {
        // Intentar obtener la empresa actual de diferentes fuentes
        console.log('getCurrentCompany: Iniciando búsqueda de empresa actual...');

        // 1. Prioridad más alta: window.currentCompany (usado por renderer.js)
        if (window.currentCompany && window.currentCompany !== 'default_company') {
            console.log('getCurrentCompany: Usando window.currentCompany:', window.currentCompany);
            return window.currentCompany;
        }

        // 2. Intentar desde rendererState
        if (window.rendererState && window.rendererState.selectedCompany && window.rendererState.selectedCompany !== 'default_company') {
            console.log('getCurrentCompany: Usando window.rendererState.selectedCompany:', window.rendererState.selectedCompany);
            return window.rendererState.selectedCompany;
        }

        // 3. Intentar desde el estado del módulo actual
        if (window.currentModule && window.currentModule.company && window.currentModule.company !== 'default_company') {
            console.log('getCurrentCompany: Usando window.currentModule.company:', window.currentModule.company);
            return window.currentModule.company;
        }

        // 4. Intentar desde appState
        if (window.appState && window.appState.selectedCompany && window.appState.selectedCompany !== 'default_company') {
            console.log('getCurrentCompany: Usando window.appState.selectedCompany:', window.appState.selectedCompany);
            return window.appState.selectedCompany;
        }

        // 5. Intentar desde globalState
        if (window.globalState && window.globalState.currentCompany && window.globalState.currentCompany !== 'default_company') {
            console.log('getCurrentCompany: Usando window.globalState.currentCompany:', window.globalState.currentCompany);
            return window.globalState.currentCompany;
        }

        // 6. Intentar desde applicationState
        if (window.applicationState && window.applicationState.currentCompany && window.applicationState.currentCompany !== 'default_company') {
            console.log('getCurrentCompany: Usando window.applicationState.currentCompany:', window.applicationState.currentCompany);
            return window.applicationState.currentCompany;
        }

        // 7. Intentar desde globalApp
        if (window.globalApp && window.globalApp.currentCompany && window.globalApp.currentCompany !== 'default_company') {
            console.log('getCurrentCompany: Usando window.globalApp.currentCompany:', window.globalApp.currentCompany);
            return window.globalApp.currentCompany;
        }

        // 8. Intentar desde sessionStorage o localStorage
        try {
            const storedCompany = sessionStorage.getItem('currentCompany') || localStorage.getItem('currentCompany');
            if (storedCompany && storedCompany !== 'default_company' && storedCompany !== 'null') {
                console.log('getCurrentCompany: Usando stored company:', storedCompany);
                return storedCompany;
            }
        } catch (e) {
            console.warn('No se pudo acceder al sessionStorage/localStorage:', e);
        }

        // 9. Verificar si hay una empresa seleccionada en el DOM
        const companyNameElement = document.getElementById('company-name');
        if (companyNameElement && companyNameElement.textContent && companyNameElement.textContent !== 'Empresa') {
            const companyName = companyNameElement.textContent.trim();
            if (companyName && companyName !== 'default_company') {
                console.log('getCurrentCompany: Usando empresa del DOM (company-name):', companyName);
                return companyName;
            }
        }

        // 10. Si nada funciona, usar default_company
        console.warn('getCurrentCompany: No se encontró empresa válida, usando default_company');
        return 'default_company';
    }

    async render() {
        // Limpiar el contenedor para forzar la actualización de datos
        this.container.innerHTML = '';

        // IMPORTANTE: Obtener la empresa actual AQUÍ, no en el constructor
        this.currentCompany = this.getCurrentCompany();
        console.log('🏢 [RecursosHome.render] Empresa actual:', this.currentCompany);

        // Crear el contenedor principal
        const mainContainer = document.createElement('div');
        mainContainer.className = 'gestion-integral-home';

        // Crear el área principal (izquierda)
        const mainArea = document.createElement('div');
        mainArea.className = 'main-area';

        // Crear el panel lateral (derecha)
        const sidebarPanel = document.createElement('div');
        sidebarPanel.className = 'sidebar-panel';

        // Renderizar el área principal
        await this.renderMainArea(mainArea);

        // Renderizar el panel lateral
        await this.renderSidebarPanel(sidebarPanel);

        // Añadir las áreas al contenedor principal
        mainContainer.appendChild(mainArea);
        mainContainer.appendChild(sidebarPanel);

        this.container.appendChild(mainContainer);
    }

    async renderMainArea(container) {
        // Widgets con contadores específicos para Recursos
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';

        const widget1 = this.createWidget('Personal Asignado', '42', '↗ 2 nuevos este mes');
        const widget2 = this.createWidget('Capacitaciones', '18', '📅 3 programadas');
        const widget3 = this.createWidget('EPPs Entregados', '120', '📦 15 por entregar');

        // Obtener datos de presupuesto y crear el widget correspondiente
        const budgetWidget = await this.createBudgetWidget();

        widgetsContainer.appendChild(widget1);
        widgetsContainer.appendChild(widget2);
        widgetsContainer.appendChild(widget3);
        widgetsContainer.appendChild(budgetWidget);

        container.appendChild(widgetsContainer);

        // Gráfica (simulada)
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h3>Distribución de Personal</h3>
            <div class="chart-placeholder">
                <p>gráfica de pastel mostrando la distribución por áreas</p>
                <div class="chart-pie" style="width: 200px; height: 200px; border-radius: 50%; background: conic-gradient(#4CAF50 0% 40%, #2196F3 40% 60%, #FF9800 60% 80%, #F44336 80% 100%);"></div>
                <div class="chart-legend">
                    <div class="legend-item"><span class="legend-color" style="background-color: #4CAF50;"></span> Operaciones (40%)</div>
                    <div class="legend-item"><span class="legend-color" style="background-color: #2196F3;"></span> Administración (20%)</div>
                    <div class="legend-item"><span class="legend-color" style="background-color: #FF9800;"></span> Mantenimiento (20%)</div>
                    <div class="legend-item"><span class="legend-color" style="background-color: #F44336;"></span> Seguridad (20%)</div>
                </div>
            </div>
        `;
        container.appendChild(chartContainer);

        // Listado de submódulos
        const submodulesContainer = document.createElement('div');
        submodulesContainer.className = 'submodules-container';

        const submodulesHeader = document.createElement('h3');
        submodulesHeader.textContent = 'Submódulos';
        submodulesContainer.appendChild(submodulesHeader);

        const submodulesList = document.createElement('div');
        submodulesList.className = 'submodules-list';

        this.submodules.forEach(submodule => {
            const submoduleItem = this.renderSubmoduleItem(submodule);
            submodulesList.appendChild(submoduleItem);
        });

        submodulesContainer.appendChild(submodulesList);
        container.appendChild(submodulesContainer);
    }

    // Función para crear el widget de presupuesto con datos reales
    async createBudgetWidget() {
        try {
            console.log('💰 [createBudgetWidget] Iniciando creación de widget de presupuesto...');

            // CRÍTICO: Re-obtener la empresa actual por si acaso
            if (!this.currentCompany || this.currentCompany === 'default_company') {
                this.currentCompany = this.getCurrentCompany();
                console.log('💰 [createBudgetWidget] Re-obteniendo empresa actual:', this.currentCompany);
            }

            console.log('💰 [createBudgetWidget] Empresa a usar:', this.currentCompany);

            // Intentar usar datos previamente almacenados si existen
            if (this.budgetData && this.budgetData.company === this.currentCompany) {
                console.log('💰 [createBudgetWidget] Usando datos de presupuesto previamente almacenados:', this.budgetData);
                return this.createBudgetWidgetWithValues(
                    this.budgetData.totalPresupuesto,
                    this.budgetData.totalEjecutado,
                    this.budgetData.porcentajeCumplimiento,
                    this.budgetData.saldoDisponible
                );
            }

            // Mostrar un widget de carga mientras se obtienen los datos
            const loadingWidget = this.createBudgetWidgetLoading();

            // Verificar que electronAPI esté disponible
            if (!window.electronAPI || !window.electronAPI.getPresupuestoFiles) {
                console.error('💰 [createBudgetWidget] electronAPI no está disponible');
                return this.createBudgetWidgetWithError('API no disponible');
            }

            // Obtener los archivos de presupuesto
            console.log('💰 [createBudgetWidget] Solicitando archivos para empresa:', this.currentCompany);
            const result = await window.electronAPI.getPresupuestoFiles(this.currentCompany);
            console.log('💰 [createBudgetWidget] Resultado de getPresupuestoFiles:', result);

            if (!result.success) {
                console.error('💰 [createBudgetWidget] Error en getPresupuestoFiles:', result.error);
                return this.createBudgetWidgetWithError(`Error: ${result.error || 'Error desconocido'}`);
            }

            if (!result.files || result.files.length === 0) {
                console.warn('💰 [createBudgetWidget] No se encontraron archivos de presupuesto');
                return this.createBudgetWidgetWithError('No hay archivos de presupuesto');
            }

            console.log(`💰 [createBudgetWidget] Se encontraron ${result.files.length} archivos de presupuesto`);

            // Obtener el año actual
            const currentYear = new Date().getFullYear();
            console.log('💰 [createBudgetWidget] Año actual:', currentYear);

            // Buscar el archivo del año actual
            let currentYearFile = result.files.find(file =>
                file.name.includes(currentYear.toString())
            );

            // Si no se encuentra archivo para el año actual, buscar el más reciente
            if (!currentYearFile) {
                console.log('💰 [createBudgetWidget] No se encontró archivo para el año actual, buscando el más reciente...');

                const sortedFiles = result.files.sort((a, b) => {
                    const yearA = this.extractYearFromFileName(a.name);
                    const yearB = this.extractYearFromFileName(b.name);
                    return yearB - yearA;
                });

                currentYearFile = sortedFiles[0];
                console.log('💰 [createBudgetWidget] Archivo más reciente:', currentYearFile?.name);
            }

            if (!currentYearFile) {
                console.error('💰 [createBudgetWidget] No se encontró ningún archivo válido');
                return this.createBudgetWidgetWithError('No hay archivos válidos');
            }

            console.log('💰 [createBudgetWidget] Leyendo datos del archivo:', currentYearFile.path);

            // Leer los datos del presupuesto
            const budgetResult = await window.electronAPI.readPresupuestoData(currentYearFile.path);
            console.log('💰 [createBudgetWidget] Resultado de readPresupuestoData:', budgetResult);

            if (!budgetResult.success) {
                console.error('💰 [createBudgetWidget] Error al leer datos:', budgetResult.error);
                return this.createBudgetWidgetWithError(`Error: ${budgetResult.error}`);
            }

            console.log('💰 [createBudgetWidget] Datos procesados:', budgetResult.data.processedData.length, 'filas');

            // Calcular los valores de presupuesto
            const { totalPresupuesto, totalEjecutado, porcentajeCumplimiento, saldoDisponible } =
                this.calculateBudgetSummary(budgetResult.data.processedData);

            console.log('💰 [createBudgetWidget] Valores calculados:', {
                totalPresupuesto,
                totalEjecutado,
                porcentajeCumplimiento,
                saldoDisponible
            });

            // Validar que los valores sean números válidos
            const validTotalPresupuesto = typeof totalPresupuesto === 'number' && !isNaN(totalPresupuesto) ? totalPresupuesto : 0;
            const validTotalEjecutado = typeof totalEjecutado === 'number' && !isNaN(totalEjecutado) ? totalEjecutado : 0;
            const validPorcentajeCumplimiento = typeof porcentajeCumplimiento === 'number' && !isNaN(porcentajeCumplimiento) ? porcentajeCumplimiento : 0;
            const validSaldoDisponible = typeof saldoDisponible === 'number' && !isNaN(saldoDisponible) ? saldoDisponible : (validTotalPresupuesto - validTotalEjecutado);

            // Almacenar los datos para uso futuro
            this.budgetData = {
                company: this.currentCompany, // Guardar la empresa para validar cache
                totalPresupuesto: validTotalPresupuesto,
                totalEjecutado: validTotalEjecutado,
                porcentajeCumplimiento: validPorcentajeCumplimiento,
                saldoDisponible: validSaldoDisponible
            };

            // Crear el widget con los datos reales
            return this.createBudgetWidgetWithValues(
                validTotalPresupuesto,
                validTotalEjecutado,
                validPorcentajeCumplimiento,
                validSaldoDisponible
            );

        } catch (error) {
            console.error('💰 [createBudgetWidget] Error fatal:', error);
            console.error('Stack:', error.stack);
            return this.createBudgetWidgetWithError(`Error: ${error.message}`);
        }
    }

    // Función para crear un widget de carga
    createBudgetWidgetLoading() {
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.innerHTML = `
            <h4>Presupuesto</h4>
            <div class="widget-value">Cargando...</div>
            <div class="widget-description">
                <div class="budget-indicator">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: 0%; background-color: #e0e0e0;"></div>
                    </div>
                    <div class="progress-text" style="color: #9e9e9e;">
                        Cargando datos...
                    </div>
                </div>
                <div class="budget-details">
                    <div class="executed-amount">Cargando</div>
                    <div class="remaining-amount">Cargando</div>
                </div>
            </div>
        `;

        this.addBudgetWidgetStyles();
        return widget;
    }

    // Función para crear un widget de error
    createBudgetWidgetWithError(errorMessage) {
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.innerHTML = `
            <h4>Presupuesto</h4>
            <div class="widget-value">Error</div>
            <div class="widget-description">
                <div class="budget-indicator">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: 0%; background-color: #f44336;"></div>
                    </div>
                    <div class="progress-text" style="color: #f44336;">
                        Error al cargar
                    </div>
                </div>
                <div class="budget-details">
                    <div style="color: #f44336; text-align: center; width: 100%; font-size: 0.85em;">${errorMessage}</div>
                </div>
            </div>
        `;

        this.addBudgetWidgetStyles();
        return widget;
    }

    // Función auxiliar para agregar estilos (DRY)
    addBudgetWidgetStyles() {
        if (!document.querySelector('#budget-widget-styles')) {
            const style = document.createElement('style');
            style.id = 'budget-widget-styles';
            style.textContent = `
                .budget-indicator {
                    margin: 10px 0;
                }

                .progress-container {
                    width: 100%;
                    height: 10px;
                    background-color: #e0e0e0;
                    border-radius: 5px;
                    overflow: hidden;
                    margin-bottom: 5px;
                }

                .progress-bar {
                    height: 100%;
                    transition: width 0.3s ease;
                }

                .progress-text {
                    font-weight: bold;
                    font-size: 0.9em;
                    margin-bottom: 8px;
                }

                .budget-details {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85em;
                }

                .executed-amount {
                    color: #2e7d32;
                    font-weight: 500;
                }

                .remaining-amount {
                    color: #1976d2;
                    font-weight: 500;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Función auxiliar para crear el widget con valores específicos
    createBudgetWidgetWithValues(totalPresupuesto, totalEjecutado, porcentajeCumplimiento, saldoDisponible) {
        // Formatear los valores para mostrar
        const formattedTotal = this.formatCurrency(totalPresupuesto);
        const formattedEjecutado = this.formatCurrency(totalEjecutado);
        const formattedSaldo = this.formatCurrency(saldoDisponible);

        // Obtener el año actual
        const currentYear = new Date().getFullYear();

        // Determinar el color del porcentaje basado en el nivel de cumplimiento
        let cumplimientoColor = '#4CAF50'; // Verde para buen cumplimiento
        if (porcentajeCumplimiento < 50) {
            cumplimientoColor = '#f44336'; // Rojo para bajo cumplimiento
        } else if (porcentajeCumplimiento < 80) {
            cumplimientoColor = '#ff9800'; // Naranja para cumplimiento moderado
        }

        // Crear el widget con los datos reales
        const widget = document.createElement('div');
        widget.className = 'widget';

        widget.innerHTML = `
            <h4>Presupuesto ${currentYear}</h4>
            <div class="widget-value">${formattedTotal}</div>
            <div class="widget-description">
                <div class="budget-indicator">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${porcentajeCumplimiento}%; background-color: ${cumplimientoColor};"></div>
                    </div>
                    <div class="progress-text" style="color: ${cumplimientoColor};">
                        ${porcentajeCumplimiento.toFixed(2)}% Ejecutado
                    </div>
                </div>
                <div class="budget-details">
                    <div class="executed-amount">Ejecutado: ${formattedEjecutado}</div>
                    <div class="remaining-amount">Restante: ${formattedSaldo}</div>
                </div>
            </div>
        `;

        this.addBudgetWidgetStyles();
        return widget;
    }

    // Función auxiliar para extraer el año del nombre del archivo
    extractYearFromFileName(fileName) {
        const yearMatch = fileName.match(/(20\d{2})/);
        return yearMatch ? parseInt(yearMatch[1]) : 0;
    }

    // Función para calcular el resumen de presupuesto
    calculateBudgetSummary(processedData) {
        console.log('📊 [calculateBudgetSummary] Calculando resumen con', processedData.length, 'filas');

        // Buscar si ya existe una fila de totales
        const totalRow = processedData.find(item =>
            item.id && typeof item.id === 'string' && item.id.toUpperCase().includes('TOTAL AÑO')
        );

        if (totalRow) {
            console.log("📊 [calculateBudgetSummary] Fila de total encontrada, usando sus valores");
            const totalPresupuesto = this.parseFormattedNumber(totalRow.asignacion);
            const totalEjecutado = this.parseFormattedNumber(totalRow.ejecutado_acumulado);

            // Verificar que los valores no sean idénticos (lo que causaría 100% de ejecución)
            if (totalPresupuesto === totalEjecutado && totalPresupuesto !== 0) {
                console.warn("⚠️ [calculateBudgetSummary] Advertencia: totalPresupuesto y totalEjecutado son idénticos, lo que indica un posible problema de cálculo");
                console.log("Valores detectados:", { totalPresupuesto, totalEjecutado });

                // En lugar de usar los valores idénticos de la fila TOTAL AÑO, calcular manualmente
                // para evitar el 100% incorrecto
                console.log("📊 [calculateBudgetSummary] Calculando manualmente para evitar 100% incorrecto");

                let calculatedTotalPresupuesto = 0;
                let calculatedTotalEjecutado = 0;

                for (const item of processedData) {
                    // Excluir filas especiales como TOTAL AÑO
                    if (item.id && typeof item.id === 'string' && item.id.toUpperCase().includes('TOTAL')) {
                        continue;
                    }

                    const asignacionValue = this.parseFormattedNumber(item.asignacion);
                    const ejecutadoValue = this.parseFormattedNumber(item.ejecutado_acumulado);

                    if (typeof asignacionValue === 'number' && !isNaN(asignacionValue)) {
                        calculatedTotalPresupuesto += asignacionValue;
                    }
                    if (typeof ejecutadoValue === 'number' && !isNaN(ejecutadoValue)) {
                        calculatedTotalEjecutado += ejecutadoValue;
                    }
                }

                const porcentajeCumplimiento = calculatedTotalPresupuesto > 0 ? ((calculatedTotalEjecutado / calculatedTotalPresupuesto) * 100) : 0;
                const saldoDisponible = calculatedTotalPresupuesto - calculatedTotalEjecutado;

                console.log('📊 [calculateBudgetSummary] Resultados calculados manualmente:', {
                    totalPresupuesto: calculatedTotalPresupuesto,
                    totalEjecutado: calculatedTotalEjecutado,
                    porcentajeCumplimiento,
                    saldoDisponible
                });

                return {
                    totalPresupuesto: calculatedTotalPresupuesto,
                    totalEjecutado: calculatedTotalEjecutado,
                    porcentajeCumplimiento,
                    saldoDisponible
                };
            }

            const porcentajeCumplimiento = totalPresupuesto > 0 ? ((totalEjecutado / totalPresupuesto) * 100) : 0;
            const saldoDisponible = totalPresupuesto - totalEjecutado;

            console.log('📊 [calculateBudgetSummary] Resultados:', {
                totalPresupuesto,
                totalEjecutado,
                porcentajeCumplimiento,
                saldoDisponible
            });

            return {
                totalPresupuesto,
                totalEjecutado,
                porcentajeCumplimiento,
                saldoDisponible
            };
        }

        console.log("📊 [calculateBudgetSummary] No se encontró fila de total, calculando manualmente");

        let totalPresupuesto = 0;
        let totalEjecutado = 0;

        for (const item of processedData) {
            // Excluir filas especiales
            if (item.id && typeof item.id === 'string' && item.id.toUpperCase().includes('TOTAL')) {
                continue;
            }

            const asignacionValue = this.parseFormattedNumber(item.asignacion);
            const ejecutadoValue = this.parseFormattedNumber(item.ejecutado_acumulado);

            if (typeof asignacionValue === 'number' && !isNaN(asignacionValue)) {
                totalPresupuesto += asignacionValue;
            }
            if (typeof ejecutadoValue === 'number' && !isNaN(ejecutadoValue)) {
                totalEjecutado += ejecutadoValue;
            }
        }

        const porcentajeCumplimiento = totalPresupuesto > 0 ? ((totalEjecutado / totalPresupuesto) * 100) : 0;
        const saldoDisponible = totalPresupuesto - totalEjecutado;

        console.log('📊 [calculateBudgetSummary] Resultados calculados:', {
            totalPresupuesto,
            totalEjecutado,
            porcentajeCumplimiento,
            saldoDisponible
        });

        return {
            totalPresupuesto,
            totalEjecutado,
            porcentajeCumplimiento,
            saldoDisponible
        };
    }

    // Función para parsear números formateados
    parseFormattedNumber(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }

        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'string') {
            let cleanValue = value.toString()
                .replace(/\$/g, '')
                .replace(/\s/g, '')
                .replace(/,/g, '');

            if (cleanValue === '-' || cleanValue === '') {
                return 0;
            }

            const parsed = parseFloat(cleanValue);
            return isNaN(parsed) ? 0 : parsed;
        }

        return 0;
    }

    // Función para formatear moneda
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
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

    renderSubmoduleItem(name) {
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
        submoduleMeta.textContent = `Último acceso: ${this.getRandomLastAccess()} | Tiempo: ${this.getRandomTimeSpent()}`;
        submoduleInfo.appendChild(submoduleMeta);

        const button = document.createElement('button');
        button.className = 'btn btn-primary btn-ingresar';
        button.textContent = 'Ingresar';
        button.addEventListener('click', () => {
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
        // Panel lateral vacío por ahora
    }
}

// Hacer la clase disponible globalmente
window.RecursosHome = RecursosHome;