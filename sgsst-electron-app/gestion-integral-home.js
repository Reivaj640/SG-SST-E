// gestion-integral-home.js - Componente para el home del módulo "Gestión Integral"

class GestionIntegralHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
    }

    async render() {
        this.container.innerHTML = '';
        
        const mainContainer = document.createElement('div');
        mainContainer.className = 'gestion-integral-home';
        
        const mainArea = document.createElement('div');
        mainArea.className = 'main-area';
        
        const sidebarPanel = document.createElement('div');
        sidebarPanel.className = 'sidebar-panel';
        
        this.renderMainArea(mainArea);
        await this.renderSidebarPanel(sidebarPanel);
        
        mainContainer.appendChild(mainArea);
        mainContainer.appendChild(sidebarPanel);
        
        this.container.appendChild(mainContainer);
    }
    
    renderMainArea(container) {
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';
        
        const widget1 = this.createWidget('Tareas Pendientes', '12', '🔥 3 urgentes');
        const widget2 = this.createWidget('Documentos por Vencer', '5', '📅 1 esta semana');
        const widget3 = this.createWidget('Cumplimiento General', '85%', '📈 2% más que el mes pasado');
        const widget4 = this.createWidget('Comunicados Recientes', '3', '🆕 1 nuevo hoy');
        
        widgetsContainer.appendChild(widget1);
        widgetsContainer.appendChild(widget2);
        widgetsContainer.appendChild(widget3);
        widgetsContainer.appendChild(widget4);
        
        container.appendChild(widgetsContainer);
        
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h3>Avance del Plan Anual</h3>
            <div class="chart-placeholder">
                <p>gráfica de dona mostrando el progreso</p>
                <div class="chart-donut" style="width: 200px; height: 200px; border-radius: 50%; background: conic-gradient(#4CAF50 0% 85%, #E0E0E0 85% 100%);">
                    <div class="chart-donut-hole">85%</div>
                </div>
            </div>
        `;
        container.appendChild(chartContainer);
        
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
window.GestionIntegralHome = GestionIntegralHome;