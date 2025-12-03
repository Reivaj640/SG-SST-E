// recursos-home.js - Componente para el home del módulo "Recursos"

class RecursosHome {
    constructor(container, moduleName, submodules) {
        this.container = container;
        this.moduleName = moduleName;
        this.submodules = submodules;
    }

    async render() {
        // Si el contenedor ya tiene contenido, no hacer nada.
        if (this.container.hasChildNodes()) {
            console.warn('RecursosHome.render() llamado de nuevo, pero el contenido ya existe. Se ignora para prevenir re-renderizado.');
            return;
        }

        // this.container.innerHTML = ''; // ESTA LÍNEA CAUSABA EL ERROR
        
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
        // Widgets con contadores específicos para Recursos
        const widgetsContainer = document.createElement('div');
        widgetsContainer.className = 'widgets-container';
        
        const widget1 = this.createWidget('Personal Asignado', '42', '↗ 2 nuevos este mes');
        const widget2 = this.createWidget('Capacitaciones', '18', '📅 3 programadas');
        const widget3 = this.createWidget('EPPs Entregados', '120', '📦 15 por entregar');
        const widget4 = this.createWidget('Presupuesto', '$12,500', '📉 5% bajo lo presupuestado');
        
        widgetsContainer.appendChild(widget1);
        widgetsContainer.appendChild(widget2);
        widgetsContainer.appendChild(widget3);
        widgetsContainer.appendChild(widget4);
        
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