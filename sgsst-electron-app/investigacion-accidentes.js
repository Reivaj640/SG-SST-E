// investigacion-accidentes.js - Componente para el submódulo "3.2.2 Investigación de Accidentes, indicentes y Enfermedades"

class InvestigacionAccidentesComponent {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.currentView = 'main'; // 'main' o 'realizar-investigacion'
    }

    render() {
        this.container.innerHTML = '';

        // Crear el contenedor principal
        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';

        if (this.currentView === 'main') {
            this.renderMainView(mainContainer);
        } else if (this.currentView === 'realizar-investigacion') {
            this.renderRealizarInvestigacionView(mainContainer);
        }

        this.container.appendChild(mainContainer);
    }

    renderMainView(container) {
        // Encabezado
        const header = document.createElement('div');
        header.className = 'submodule-header';
        
        const title = document.createElement('h2');
        title.textContent = this.submoduleName;
        header.appendChild(title);

        if (this.onBack && typeof this.onBack === 'function') {
            const backButton = document.createElement('button');
            backButton.className = 'btn';
            backButton.textContent = '← Volver';
            backButton.addEventListener('click', this.onBack);
            header.appendChild(backButton);
        }

        container.appendChild(header);

        // Descripción
        const description = document.createElement('p');
        description.className = 'submodule-description';
        description.textContent = 'Este submódulo permite gestionar la investigación de accidentes, incidentes y enfermedades laborales.';
        container.appendChild(description);

        // Crear tarjetas para las opciones del submódulo
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';
        
        // Tarjeta 1: Ver investigación
        const card1 = this.createModuleCard(
            'Ver investigación',
            'Consulta las investigaciones de accidentes, incidentes y enfermedades ya realizadas.',
            () => this.handleViewInvestigation()
        );
        cardsContainer.appendChild(card1);
        
        // Tarjeta 2: Realizar investigación
        const card2 = this.createModuleCard(
            'Realizar investigación',
            'Inicia una nueva investigación de accidentes, incidentes o enfermedades.',
            () => this.handlePerformInvestigation()
        );
        cardsContainer.appendChild(card2);
        
        // Tarjeta 3: Próximo a implementar
        const card3 = this.createModuleCard(
            'Próximo a implementar',
            'Nuevas funcionalidades estarán disponibles próximamente.',
            () => this.handleComingSoon()
        );
        cardsContainer.appendChild(card3);
        
        container.appendChild(cardsContainer);

        // Área de notificaciones
        const notificationArea = document.createElement('div');
        notificationArea.className = 'notification-area';
        notificationArea.innerHTML = `
            <h3>Notificaciones recientes</h3>
            <div class="notification-item">
                <div class="notification-icon">ℹ️</div>
                <div class="notification-content">
                    <div class="notification-title">Nueva investigación pendiente</div>
                    <div class="notification-message">Hay 2 investigaciones pendientes de accidentes menores.</div>
                    <div class="notification-time">Hace 2 horas</div>
                </div>
            </div>
            <div class="notification-item">
                <div class="notification-icon">✅</div>
                <div class="notification-content">
                    <div class="notification-title">Investigación completada</div>
                    <div class="notification-message">La investigación del incidente del 15/08/2025 ha sido completada.</div>
                    <div class="notification-time">Hace 1 día</div>
                </div>
            </div>
        `;
        container.appendChild(notificationArea);
    }

    renderRealizarInvestigacionView(container) {
        // Crear una instancia del nuevo componente de investigación de accidente
        if (typeof window.InvestigacionAccidenteComponent === 'function') {
            try {
                const investigacionAccidenteComponent = new window.InvestigacionAccidenteComponent(
                    container,
                    this.currentCompany,
                    this.moduleName,
                    this.submoduleName,
                    () => {
                        this.currentView = 'main';
                        this.render();
                    }
                );
                investigacionAccidenteComponent.render();
            } catch (error) {
                console.error('Error al crear/renderizar InvestigacionAccidenteComponent:', error);
                this.renderFallbackView(container);
            }
        } else {
            // Fallback si el componente no está disponible
            this.renderFallbackView(container);
        }
    }

    renderFallbackView(container) {
        const header = document.createElement('div');
        header.className = 'submodule-header';
        
        const title = document.createElement('h2');
        title.textContent = 'Realizar Investigación';
        header.appendChild(title);

        const backButton = document.createElement('button');
        backButton.className = 'btn';
        backButton.textContent = '← Volver';
        backButton.addEventListener('click', () => {
            this.currentView = 'main';
            this.render();
        });
        header.appendChild(backButton);

        container.appendChild(header);

        const message = document.createElement('p');
        message.textContent = 'La funcionalidad de investigación de accidentes está en desarrollo.';
        container.appendChild(message);
    }

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';
        
        // Contenedor para el ícono y el título
        const headerDiv = document.createElement('div');
        headerDiv.className = 'card-header';
        
        // Placeholder para el ícono
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

    handleViewInvestigation() {
        // Mostrar mensaje de funcionalidad en desarrollo
        alert('Funcionalidad "Ver investigación" en desarrollo. Próximamente podrás consultar las investigaciones realizadas.');
    }

    handlePerformInvestigation() {
        // Cambiar a la vista de realizar investigación
        this.currentView = 'realizar-investigacion';
        this.render();
    }

    handleComingSoon() {
        // Mostrar mensaje de funcionalidad próxima
        alert('Esta funcionalidad estará disponible próximamente.');
    }

    handleSubmitInvestigacion(form) {
        // Obtener los valores del formulario
        const tipoInvestigacion = form.querySelector('#tipo-investigacion').value;
        const fechaOcurrencia = form.querySelector('#fecha-ocurrencia').value;
        const descripcion = form.querySelector('#descripcion').value;
        const departamento = form.querySelector('#departamento').value;
        const trabajador = form.querySelector('#trabajador').value;
        
        // Validar campos requeridos
        if (!tipoInvestigacion || !fechaOcurrencia || !descripcion || !departamento) {
            alert('Por favor complete todos los campos marcados con *');
            return;
        }
        
        // Mostrar mensaje de confirmación
        alert(`Investigación iniciada correctamente:\n\nTipo: ${tipoInvestigacion}\nFecha: ${fechaOcurrencia}\nDepartamento: ${departamento}\n\nLa investigación se ha registrado en el sistema y está lista para ser procesada.`);
        
        // Volver a la vista principal
        this.currentView = 'main';
        this.render();
    }
}

// Hacer la clase disponible globalmente
window.InvestigacionAccidentesComponent = InvestigacionAccidentesComponent;