// recursos-home.js - Componente para el home del módulo "Recursos"

class RecursosHome {
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
        button.className = 'btn btn-primary';
        button.textContent = 'Ingresar';
        button.addEventListener('click', () => {
            // 'this.container' es la referencia correcta al .main-canvas que queremos reemplazar.
            showSubmoduleContent(this.container, this.moduleName, name);
        });

        submoduleItem.appendChild(submoduleInfo);
        submoduleItem.appendChild(button);
        
        return submoduleItem;
    }
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
        // Calendario de Outlook (simulado)
        const calendarWidget = document.createElement('div');
        calendarWidget.className = 'calendar-widget';
        calendarWidget.innerHTML = `
            <h3>Mi Calendario</h3>
            <div class="calendar-header">
                <button class="btn-icon">←</button>
                <span class="calendar-title">18 de Agosto, 2025</span>
                <button class="btn-icon">→</button>
            </div>
            <div class="calendar-events">
                <div class="event">
                    <div class="event-time">09:00 - 10:00</div>
                    <div class="event-title">Reunión de Planificación</div>
                    <div class="event-location">Sala de Juntas A</div>
                </div>
                <div class="event">
                    <div class="event-time">11:30 - 12:30</div>
                    <div class="event-title">Auditoría de Proveedores</div>
                    <div class="event-location">Oficina Virtual</div>
                </div>
                <div class="event">
                    <div class="event-time">15:00 - 16:00</div>
                    <div class="event-title">Evaluación de Riesgos</div>
                    <div class="event-location">Área de Producción</div>
                </div>
            </div>
        `;
        container.appendChild(calendarWidget);
        
        // Notas personales (simuladas)
        const notesWidget = document.createElement('div');
        notesWidget.className = 'notes-widget';
        notesWidget.innerHTML = `
            <h3>Mis Notas</h3>
            <div class="notes-list">
                <div class="note">
                    <div class="note-title">Actualizar matriz legal</div>
                    <div class="note-content">Revisar nuevas normativas para el sector.</div>
                </div>
                <div class="note">
                    <div class="note-title">Capacitación de nuevo personal</div>
                    <div class="note-content">Programar inducción para los 5 nuevos operarios.</div>
                </div>
                <div class="note">
                    <div class="note-title">Revisión de EPPs</div>
                    <div class="note-content">Verificar stock y solicitar reposición si es necesario.</div>
                </div>
            </div>
            <button class="btn" style="width: 100%;">+ Añadir Nota</button>
        `;
        container.appendChild(notesWidget);
    }
}

// Hacer la clase disponible globalmente
window.RecursosHome = RecursosHome;