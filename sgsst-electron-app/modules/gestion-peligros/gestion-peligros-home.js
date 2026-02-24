// gestion-peligros-home.js - Componente para el home del módulo "Gestión de Peligros y Riesgos"

class GestionPeligrosHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
    }

    async render() {
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
        this.renderMainArea(mainArea);
        
        // Renderizar el panel lateral
        await this.renderSidebarPanel(sidebarPanel);
        
        // Añadir las áreas al contenedor principal
        mainContainer.appendChild(mainArea);
        mainContainer.appendChild(sidebarPanel);
        
        this.container.appendChild(mainContainer);
    }
    
    renderMainArea(container) {
        // Widgets con contadores específicos para Gestión de Peligros y Riesgos
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';
        
        const widget1 = this.createWidget('Inspecciones Realizadas', '24', '📅 3 esta semana');
        const widget2 = this.createWidget('Identificaciones de Peligros', '15', '🆕 2 nuevas hoy');
        const widget3 = this.createWidget('Evaluaciones de Riesgos', '8', '📉 1 mitigado');
        const widget4 = this.createWidget('Incidentes Reportados', '5', '🔔 1 crítico');
        
        widgetsContainer.appendChild(widget1);
        widgetsContainer.appendChild(widget2);
        widgetsContainer.appendChild(widget3);
        widgetsContainer.appendChild(widget4);
        
        container.appendChild(widgetsContainer);
        
        // Gráfica (simulada)
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h3>Tipos de Peligros Identificados</h3>
            <div class="chart-placeholder">
                <p>gráfica de barras mostrando la distribución por tipo de peligro</p>
                <div class="chart-bars">
                    <div class="chart-bar" style="height: 80%; background-color: #4CAF50;"></div>
                    <div class="chart-bar" style="height: 60%; background-color: #2196F3;"></div>
                    <div class="chart-bar" style="height: 40%; background-color: #FF9800;"></div>
                    <div class="chart-bar" style="height: 70%; background-color: #F44336;"></div>
                    <div class="chart-bar" style="height: 50%; background-color: #9C27B0;"></div>
                </div>
                <div class="chart-labels">
                    <span>Físicos</span>
                    <span>Químicos</span>
                    <span>Biológicos</span>
                    <span>Ergonómicos</span>
                    <span>Psicosociales</span>
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
            showSubmoduleContent(document.querySelector('.main-canvas'), this.moduleName, name);
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
window.GestionPeligrosHome = GestionPeligrosHome;