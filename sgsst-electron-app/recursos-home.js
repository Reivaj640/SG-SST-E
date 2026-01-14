// recursos-home.js - Componente para el home del módulo "Recursos"

class RecursosHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
        this.currentCompany = window.currentCompany || 'default_company'; // Asumiendo que hay una variable global con la empresa actual
    }

    async render() {
        // Limpiar el contenedor para forzar la actualización de datos
        this.container.innerHTML = '';

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
            // Obtener los archivos de presupuesto
            const result = await window.electronAPI.getPresupuestoFiles(this.currentCompany);

            if (result.success && result.files && result.files.length > 0) {
                // Obtener el año actual
                const currentYear = new Date().getFullYear();

                // Buscar el archivo del año actual en lugar de tomar el primero
                let currentYearFile = null;

                // Buscar archivo que contenga el año actual en su nombre
                for (const file of result.files) {
                    if (file.name.includes(currentYear.toString())) {
                        currentYearFile = file;
                        break;
                    }
                }

                // Si no se encuentra archivo para el año actual, buscar el más reciente
                if (!currentYearFile) {
                    // Ordenar archivos por año en orden descendente y tomar el primero
                    const sortedFiles = result.files.sort((a, b) => {
                        const yearA = this.extractYearFromFileName(a.name);
                        const yearB = this.extractYearFromFileName(b.name);
                        return yearB - yearA; // Mayor año primero
                    });

                    currentYearFile = sortedFiles[0];
                }

                if (currentYearFile) {
                    // Leer los datos del presupuesto
                    const budgetResult = await window.electronAPI.readPresupuestoData(currentYearFile.path);

                    if (budgetResult.success) {
                        // Calcular los valores de presupuesto
                        const { totalPresupuesto, totalEjecutado, porcentajeCumplimiento, saldoDisponible } =
                            this.calculateBudgetSummary(budgetResult.data.processedData);

                        // Formatear los valores para mostrar
                        const formattedTotal = this.formatCurrency(totalPresupuesto);
                        const formattedEjecutado = this.formatCurrency(totalEjecutado);
                        const formattedSaldo = this.formatCurrency(saldoDisponible);

                        // Crear el widget con los datos reales
                        const widget = document.createElement('div');
                        widget.className = 'widget';

                        // Determinar el color del porcentaje basado en el nivel de cumplimiento
                        let cumplimientoColor = '#4CAF50'; // Verde para buen cumplimiento
                        if (porcentajeCumplimiento < 50) {
                            cumplimientoColor = '#f44336'; // Rojo para bajo cumplimiento
                        } else if (porcentajeCumplimiento < 80) {
                            cumplimientoColor = '#ff9800'; // Naranja para cumplimiento moderado
                        }

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

                        // Añadir estilos CSS para el indicador de presupuesto
                        const style = document.createElement('style');
                        if (!document.querySelector('#budget-widget-styles')) {
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

                        return widget;
                    }
                }
            }
        } catch (error) {
            console.error('Error obteniendo datos de presupuesto:', error);
        }

        // Widget por defecto si no se pueden obtener los datos
        const widget = document.createElement('div');
        widget.className = 'widget';
        widget.innerHTML = `
            <h4>Presupuesto</h4>
            <div class="widget-value">$12,500</div>
            <div class="widget-description">
                <div class="budget-indicator">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: 65%; background-color: #4CAF50;"></div>
                    </div>
                    <div class="progress-text" style="color: #4CAF50;">
                        65% Ejecutado
                    </div>
                </div>
                <div class="budget-details">
                    <div class="executed-amount">Ejecutado: $8,125</div>
                    <div class="remaining-amount">Restante: $4,375</div>
                </div>
            </div>
        `;

        // Añadir estilos CSS para el indicador de presupuesto
        const style = document.createElement('style');
        if (!document.querySelector('#budget-widget-styles')) {
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

        return widget;
    }

    // Función auxiliar para extraer el año del nombre del archivo
    extractYearFromFileName(fileName) {
        // Buscar un patrón de año (20XX o 20XXX)
        const yearMatch = fileName.match(/(20\d{2})/);
        if (yearMatch) {
            return parseInt(yearMatch[1]);
        }
        // Si no se encuentra un año, devolver 0 para que este archivo se ordene al final
        return 0;
    }

    // Función para calcular el resumen de presupuesto
    calculateBudgetSummary(processedData) {
        let totalPresupuesto = 0;
        let totalEjecutado = 0;

        for (let i = 0; i < processedData.length; i++) {
            const item = processedData[i];

            // Excluir filas especiales como 'TOTAL AÑO' o variantes (puede haber diferencias en mayúsculas o espacios)
            if (item.id && typeof item.id === 'string') {
                const normalizedId = item.id.trim().toUpperCase();
                if (normalizedId === 'TOTAL AÑO' || normalizedId.includes('TOTAL AÑO')) {
                    continue;
                }
            }

            // Procesar asignación
            let asignacionValue = 0;
            if (typeof item.asignacion !== 'undefined' && item.asignacion !== null) {
                if (typeof item.asignacion === 'string') {
                    asignacionValue = this.parseFormattedNumber(item.asignacion);
                } else if (typeof item.asignacion === 'number') {
                    asignacionValue = item.asignacion;
                }
            }

            // Procesar ejecutado acumulado
            let ejecutadoValue = 0;
            if (typeof item.ejecutado_acumulado !== 'undefined' && item.ejecutado_acumulado !== null) {
                if (typeof item.ejecutado_acumulado === 'string') {
                    ejecutadoValue = this.parseFormattedNumber(item.ejecutado_acumulado);
                } else if (typeof item.ejecutado_acumulado === 'number') {
                    ejecutadoValue = item.ejecutado_acumulado;
                }
            }

            // Sumar a los totales
            if (typeof asignacionValue === 'number' && !isNaN(asignacionValue)) {
                totalPresupuesto += asignacionValue;
            }
            if (typeof ejecutadoValue === 'number' && !isNaN(ejecutadoValue)) {
                totalEjecutado += ejecutadoValue;
            }
        }

        // Calcular el % de cumplimiento
        const porcentajeCumplimiento = totalPresupuesto > 0 ? ((totalEjecutado / totalPresupuesto) * 100) : 0;

        // Calcular el saldo disponible
        const saldoDisponible = totalPresupuesto - totalEjecutado;

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
            // Remover signos de dólar, espacios y comas
            let cleanValue = value.toString()
                .replace(/\$/g, '')  // Eliminar signos de dólar
                .replace(/\s/g, '')  // Eliminar espacios
                .replace(/,/g, '');  // Eliminar comas

            // Manejar casos especiales como "$ -" o "-  " que representan ceros
            if (cleanValue.trim() === '-' || cleanValue.trim() === '-  ' || cleanValue.trim() === '') {
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
            // 'this.container' es la referencia correcta al .main-canvas que queremos reemplazar.
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
window.RecursosHome = RecursosHome;