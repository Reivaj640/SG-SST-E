// investigacion-accidentes.js - Componente para el submódulo "3.2.2 Investigación de Accidentes, indicentes y Enfermedades"

class InvestigacionAccidentesComponent {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
    }

    render() {
        this.container.innerHTML = '';

        // Crear el contenedor principal
        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';

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

        mainContainer.appendChild(header);

        // Descripción
        const description = document.createElement('p');
        description.className = 'submodule-description';
        description.textContent = 'Este submódulo permite gestionar la investigación de accidentes, incidentes y enfermedades laborales.';
        mainContainer.appendChild(description);

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
        
        mainContainer.appendChild(cardsContainer);

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
                </div>
            </div>
        `;
        mainContainer.appendChild(notificationArea);

        this.container.appendChild(mainContainer);
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
        // Mostrar mensaje de funcionalidad en desarrollo
        alert('Funcionalidad "Realizar investigación" en desarrollo. Próximamente podrás iniciar nuevas investigaciones.');
    }

    handleComingSoon() {
        // Mostrar mensaje de funcionalidad próxima
        alert('Esta funcionalidad estará disponible próximamente.');
    }
}

// Hacer la clase disponible globalmente
window.InvestigacionAccidentesComponent = InvestigacionAccidentesComponent;