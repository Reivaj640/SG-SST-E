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
                    <div class="progress-container" id="budget-progress-container-loading">
                        <div id="budget-progress-bar-loading" style="height: 20px;"></div>
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

        // Inicializar la barra de progreso de jQuery UI si jQuery está disponible
        if (typeof $ !== 'undefined' && typeof $.fn.progressbar !== 'undefined') {
            // Usar setTimeout para asegurar que el elemento esté en el DOM
            setTimeout(() => {
                const $progressBar = $('#budget-progress-bar-loading');
                if ($progressBar.length && !$progressBar.hasClass('ui-progressbar')) {
                    $progressBar.progressbar({
                        value: 0,
                        max: 100
                    });
                }
            }, 100);
        }

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
                    <div class="progress-container" id="budget-progress-container-error">
                        <div id="budget-progress-bar-error" style="height: 20px;"></div>
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

        // Inicializar la barra de progreso de jQuery UI si jQuery está disponible
        if (typeof $ !== 'undefined' && typeof $.fn.progressbar !== 'undefined') {
            // Usar setTimeout para asegurar que el elemento esté en el DOM
            setTimeout(() => {
                const $progressBar = $('#budget-progress-bar-error');
                if ($progressBar.length && !$progressBar.hasClass('ui-progressbar')) {
                    $progressBar.progressbar({
                        value: 0,
                        max: 100,
                        classes: {
                            "ui-progressbar": "ui-corner-all",
                            "ui-progressbar-value": "ui-corner-left error-progress"
                        }
                    });
                }
            }, 100);
        }

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

                .budget-indicator .progress-container {
                    width: 100%;
                    height: 20px;
                    margin-bottom: 5px;
                    display: flex;
                    align-items: center;
                }

                /* Estilos específicos para la barra de progreso de jQuery UI */
                .ui-progressbar {
                    height: 100% !important;
                    border-radius: 10px !important;
                    background: #e0e0e0 !important;
                    overflow: hidden !important;
                    border: none !important;
                }

                .ui-progressbar-value {
                    border: none !important;
                    border-radius: 10px !important;
                    margin: 0 !important;
                    height: 100% !important;
                    transition: width 0.5s ease-in-out !important;
                }

                .ui-progressbar .ui-progressbar-value {
                    background: #4CAF50 !important;
                }

                .error-progress {
                    background: #f44336 !important;
                }

                /* Asegurar que la barra de progreso tenga un tamaño adecuado */
                #budget-progress-bar,
                #budget-progress-bar-loading,
                #budget-progress-bar-error {
                    width: 95% !important;
                    height: 20px !important;
                    margin: 0 auto !important; /* Centrar horizontalmente */
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

        // Limitar el porcentaje al máximo de 100% para evitar barras que sobresalgan
        const limitedPorcentaje = Math.min(porcentajeCumplimiento, 100);

        // Determinar el color del porcentaje basado en el nivel de cumplimiento
        let cumplimientoColor = '#4CAF50'; // Verde para buen cumplimiento
        if (limitedPorcentaje < 50) {
            cumplimientoColor = '#f44336'; // Rojo para bajo cumplimiento
        } else if (limitedPorcentaje < 80) {
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
                    <div class="progress-container" id="budget-progress-container">
                        <div id="budget-progress-bar" style="height: 20px;"></div>
                    </div>
                    <div class="progress-text" id="budget-progress-text" style="color: ${cumplimientoColor};">
                        0.00% Ejecutado
                    </div>
                </div>
                <div class="budget-details">
                    <div class="executed-amount">Ejecutado: ${formattedEjecutado}</div>
                    <div class="remaining-amount">Restante: ${formattedSaldo}</div>
                </div>
            </div>
        `;

        // Añadir funcionalidad para actualizar la barra de progreso dinámicamente usando jQuery UI
        const updateProgressBar = (newPorcentaje, newTotal, newEjecutado, newSaldo) => {
            // Limitar el porcentaje al máximo de 100%
            const limitedNewPorcentaje = Math.min(newPorcentaje, 100);

            // Verificar que jQuery esté disponible
            if (typeof $ !== 'undefined' && typeof $.fn.progressbar !== 'undefined') {
                // Esperar a que el elemento esté completamente renderizado
                setTimeout(() => {
                    const $progressBar = $('#budget-progress-bar');

                    // Si aún no está inicializado, inicialízalo
                    if (!$progressBar.hasClass('ui-progressbar')) {
                        $progressBar.progressbar({
                            value: 0, // Empezar en 0 y luego animar
                            max: 100
                        });
                    }

                    // Actualizar el valor con animación
                    $progressBar.progressbar('value', limitedNewPorcentaje);
                }, 100);
            } else {
                // Fallback a la implementación anterior si jQuery UI no está disponible
                const progressBar = widget.querySelector('#budget-progress-bar');
                const progressText = widget.querySelector('#budget-progress-text');

                if (!progressBar || !progressText) {
                    console.error('⚠️ [updateProgressBar] No se encontraron los elementos de la barra de progreso');
                    return;
                }

                // Actualizar el ancho de la barra de progreso
                progressBar.style.width = `${limitedNewPorcentaje}%`;
                progressBar.style.backgroundColor = '#4CAF50'; // Color verde por defecto
                progressText.style.color = '#4CAF50';
                progressText.textContent = `${limitedNewPorcentaje.toFixed(2)}% Ejecutado`;
            }

            // Determinar el color del porcentaje basado en el nuevo nivel de cumplimiento
            let newColor = '#4CAF50'; // Verde para buen cumplimiento
            if (limitedNewPorcentaje < 50) {
                newColor = '#f44336'; // Rojo para bajo cumplimiento
            } else if (limitedNewPorcentaje < 80) {
                newColor = '#ff9800'; // Naranja para cumplimiento moderado
            }

            // Actualizar el color del texto
            const progressText = widget.querySelector('#budget-progress-text');
            if (progressText) {
                progressText.style.color = newColor;
                progressText.textContent = `${limitedNewPorcentaje.toFixed(2)}% Ejecutado`;
            }

            // Actualizar también los valores mostrados
            const valueElement = widget.querySelector('.widget-value');
            const executedElement = widget.querySelector('.executed-amount');
            const remainingElement = widget.querySelector('.remaining-amount');

            if (valueElement) valueElement.textContent = this.formatCurrency(newTotal);
            if (executedElement) executedElement.textContent = `Ejecutado: ${this.formatCurrency(newEjecutado)}`;
            if (remainingElement) remainingElement.textContent = `Restante: ${this.formatCurrency(newSaldo)}`;

            console.log(`📊 [updateProgressBar] Barra actualizada: ${limitedNewPorcentaje}% (Total: ${newTotal}, Ejecutado: ${newEjecutado}, Saldo: ${newSaldo})`);
        };

        // Forzar la actualización visual con animación para que se vea el progreso
        // Asegurar que el elemento esté en el DOM antes de inicializar jQuery UI
        setTimeout(() => {
            // Agregar el widget al DOM antes de intentar inicializar jQuery UI
            if (widget.parentNode) {
                updateProgressBar(limitedPorcentaje, totalPresupuesto, totalEjecutado, saldoDisponible);
            } else {
                // Si aún no está en el DOM, esperar un poco más
                setTimeout(() => {
                    updateProgressBar(limitedPorcentaje, totalPresupuesto, totalEjecutado, saldoDisponible);
                }, 100);
            }
        }, 100); // Aumentar el tiempo para asegurar renderizado

        // Añadir MutationObserver para detectar cambios en los datos y actualizar automáticamente
        // Esto permitirá que la barra se actualice si los datos cambian externamente
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-budget-update') {
                    const newData = JSON.parse(mutation.target.getAttribute('data-budget-update'));
                    if (newData && newData.totalPresupuesto !== undefined) {
                        updateProgressBar(
                            newData.porcentajeCumplimiento,
                            newData.totalPresupuesto,
                            newData.totalEjecutado,
                            newData.saldoDisponible
                        );
                    }
                }
            });
        });

        // Configurar el observador para futuras actualizaciones si es necesario
        // observer.observe(widget, { attributes: true, attributeFilter: ['data-budget-update'] });

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

        // Mostrar información detallada de todas las filas para análisis
        console.log('📊 [calculateBudgetSummary] Datos procesados completos:', processedData);

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

                // Contadores para análisis
                let rowsProcessed = 0;
                let rowsExcluded = 0;
                let identicalRowsCount = 0; // Contador para filas con valores idénticos

                for (const item of processedData) {
                    // Mostrar cada fila para análisis
                    console.log(`🔍 [calculateBudgetSummary] Procesando fila: ID=${item.id}, Asignación=${item.asignacion}, Ejecutado=${item.ejecutado_acumulado}`);

                    // Excluir filas especiales como TOTAL AÑO u otras filas de totales
                    if (item.id && typeof item.id === 'string' && item.id.toUpperCase().includes('TOTAL')) {
                        console.log(`🚫 [calculateBudgetSummary] Excluyendo fila TOTAL: ${item.id}`);
                        rowsExcluded++;
                        continue;
                    }

                    const asignacionValue = this.parseFormattedNumber(item.asignacion);
                    const ejecutadoValue = this.parseFormattedNumber(item.ejecutado_acumulado);

                    console.log(`📈 [calculateBudgetSummary] Valores parseados - Asignación: ${asignacionValue}, Ejecutado: ${ejecutadoValue}`);

                    // Verificar si los valores son idénticos (esto podría indicar filas de totales parciales)
                    if (asignacionValue === ejecutadoValue && asignacionValue !== 0) {
                        console.warn(`⚠️ [calculateBudgetSummary] Fila con valores idénticos detectada: ID=${item.id}, Asignación=${asignacionValue}, Ejecutado=${ejecutadoValue}`);
                        identicalRowsCount++;

                        // Distinguir entre filas que son probablemente totales parciales (como filas vacías o con IDs como "TOTAL ANALITICO")
                        // y filas que son entradas reales del presupuesto
                        const isLikelySubtotal = item.id && typeof item.id === 'string' &&
                            (item.id.toUpperCase().includes('TOTAL') ||
                             item.id.toUpperCase().includes('SUBTOTAL') ||
                             item.id.toUpperCase().includes('ANALISIS') ||
                             item.detalle && typeof item.detalle === 'string' &&
                             (item.detalle.toUpperCase().includes('TOTAL') ||
                              item.detalle.toUpperCase().includes('SUBTOTAL') ||
                              item.detalle.toUpperCase().includes('ANALISIS')));

                        if (isLikelySubtotal) {
                            console.log(`⏭️ [calculateBudgetSummary] Excluyendo fila de subtotal: ID=${item.id}`);
                            continue; // Excluir esta fila si es un subtotal
                        }
                    }

                    if (typeof asignacionValue === 'number' && !isNaN(asignacionValue)) {
                        calculatedTotalPresupuesto += asignacionValue;
                    }
                    if (typeof ejecutadoValue === 'number' && !isNaN(ejecutadoValue)) {
                        calculatedTotalEjecutado += ejecutadoValue;
                    }

                    rowsProcessed++;
                }

                console.log(`📊 [calculateBudgetSummary] Filas procesadas: ${rowsProcessed}, Filas excluidas: ${rowsExcluded}, Filas con valores idénticos: ${identicalRowsCount}`);
                console.log(`📊 [calculateBudgetSummary] Sumas calculadas - Presupuesto: ${calculatedTotalPresupuesto}, Ejecutado: ${calculatedTotalEjecutado}`);

                // Calcular el porcentaje basado en los valores reales
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

        // Contadores para análisis
        let rowsProcessed = 0;
        let rowsExcluded = 0;
        let identicalRowsCount = 0; // Contador para filas con valores idénticos

        for (const item of processedData) {
            // Mostrar cada fila para análisis
            console.log(`🔍 [calculateBudgetSummary] Procesando fila: ID=${item.id}, Asignación=${item.asignacion}, Ejecutado=${item.ejecutado_acumulado}`);

            // Excluir filas especiales
            if (item.id && typeof item.id === 'string' && item.id.toUpperCase().includes('TOTAL')) {
                console.log(`🚫 [calculateBudgetSummary] Excluyendo fila TOTAL: ${item.id}`);
                rowsExcluded++;
                continue;
            }

            const asignacionValue = this.parseFormattedNumber(item.asignacion);
            const ejecutadoValue = this.parseFormattedNumber(item.ejecutado_acumulado);

            console.log(`📈 [calculateBudgetSummary] Valores parseados - Asignación: ${asignacionValue}, Ejecutado: ${ejecutadoValue}`);

            // Verificar si los valores son idénticos (esto podría indicar filas de totales parciales)
            if (asignacionValue === ejecutadoValue && asignacionValue !== 0) {
                console.warn(`⚠️ [calculateBudgetSummary] Fila con valores idénticos detectada: ID=${item.id}, Asignación=${asignacionValue}, Ejecutado=${ejecutadoValue}`);
                identicalRowsCount++;

                // Distinguir entre filas que son probablemente totales parciales y filas que son entradas reales del presupuesto
                const isLikelySubtotal = item.id && typeof item.id === 'string' &&
                    (item.id.toUpperCase().includes('TOTAL') ||
                     item.id.toUpperCase().includes('SUBTOTAL') ||
                     item.id.toUpperCase().includes('ANALISIS') ||
                     item.detalle && typeof item.detalle === 'string' &&
                     (item.detalle.toUpperCase().includes('TOTAL') ||
                      item.detalle.toUpperCase().includes('SUBTOTAL') ||
                      item.detalle.toUpperCase().includes('ANALISIS')));

                if (isLikelySubtotal) {
                    console.log(`⏭️ [calculateBudgetSummary] Excluyendo fila de subtotal: ID=${item.id}`);
                    continue; // Excluir esta fila si es un subtotal
                }
            }

            if (typeof asignacionValue === 'number' && !isNaN(asignacionValue)) {
                totalPresupuesto += asignacionValue;
            }
            if (typeof ejecutadoValue === 'number' && !isNaN(ejecutadoValue)) {
                totalEjecutado += ejecutadoValue;
            }

            rowsProcessed++;
        }

        console.log(`📊 [calculateBudgetSummary] Filas procesadas: ${rowsProcessed}, Filas excluidas: ${rowsExcluded}, Filas con valores idénticos: ${identicalRowsCount}`);
        console.log(`📊 [calculateBudgetSummary] Sumas calculadas - Presupuesto: ${totalPresupuesto}, Ejecutado: ${totalEjecutado}`);

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