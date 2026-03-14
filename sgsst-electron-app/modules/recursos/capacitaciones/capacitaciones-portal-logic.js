// capacitaciones-portal-logic.js - Componente para el submódulo "1.2.1 Programa de Capacitaciones Anual"
// Implementa diseño de portal de bienvenida moderno (antesala) similar a Plan de Trabajo

class CapacitacionesPortalComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
    }

    async render() {
        this.container.innerHTML = '';

        // Cargar el portal de bienvenida desde cap-home.html
        await this.loadPortalHome();
    }

    async loadPortalHome() {
        // Crear el contenedor del portal
        const portalContainer = document.createElement('div');
        portalContainer.id = 'cap-portal-container';
        this.container.appendChild(portalContainer);

        // Cargar el HTML del portal
        try {
            const response = await fetch(`./modules/recursos/capacitaciones/cap-home.html`);
            if (response.ok) {
                const html = await response.text();
                portalContainer.innerHTML = html;

                // Inicializar el JS del portal
                this.initPortalJS(portalContainer);
            } else {
                throw new Error('No se pudo cargar el portal');
            }
        } catch (error) {
            console.error('[CapacitacionesPortalComponent] Error cargando portal:', error);
            // Fallback al diseño original si falla la carga
            this.renderLegacyDesign();
        }
    }

    initPortalJS(portalContainer) {
        // Hacer referencia al contenedor del portal
        window.capPortalContainer = portalContainer;
        window.capPortalComponent = this;

        // Cargar el JS del portal dinámicamente
        const script = document.createElement('script');
        script.src = './modules/recursos/capacitaciones/cap-home.js';
        script.onload = () => {
            console.log('[CapacitacionesPortalComponent] cap-home.js cargado');
            // LLAMAR MANUALMENTE A initializePortal() DESPUÉS DE CARGAR
            console.log('[CapacitacionesPortalComponent] Llamando a initializePortal() manualmente...');
            if (typeof initializePortal === 'function') {
                console.log('[CapacitacionesPortalComponent] ✅ initializePortal encontrado, ejecutando...');
                initializePortal();
            } else {
                console.error('[CapacitacionesPortalComponent] ❌ initializePortal NO es una función');
            }
        };
        script.onerror = () => {
            console.error('[CapacitacionesPortalComponent] Error cargando cap-home.js');
            this.renderLegacyDesign();
        };
        document.body.appendChild(script);
    }

    /**
     * Método para entrar al viewer de capacitaciones (llamado desde cap-home.js)
     */
    async enterViewer() {
        // Limpiar el contenedor y cargar el viewer existente
        this.container.innerHTML = '';

        // Crear el componente CapacitacionesComponent
        const CapacitacionesComponentClass = window.CapacitacionesComponent;
        
        if (CapacitacionesComponentClass) {
            const component = new CapacitacionesComponentClass(
                this.container,
                this.companyName,
                this.moduleName,
                this.submoduleName,
                this.onBackToModuleHome
            );
            component.render();
        } else {
            // Fallback: cargar directamente la vista
            this.loadViewerFallback();
        }
    }

    /**
     * Fallback por si no está disponible el componente
     */
    loadViewerFallback() {
        // Crear iframe para el visualizador de documentos
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100vh';
        iframe.style.border = 'none';

        // Pasar parámetros a la nueva interfaz a través de la URL
        const viewerUrl = `./modules/recursos/capacitaciones/capacitaciones-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;

        this.container.appendChild(iframe);
    }

    /**
     * Método legacy (diseño original) como fallback
     */
    renderLegacyDesign() {
        this.container.innerHTML = '';

        const backButton = document.createElement('button');
        backButton.className = 'btn btn-back';
        backButton.innerHTML = '&#8592; Volver al Módulo';
        backButton.addEventListener('click', this.onBackToModuleHome);
        this.container.appendChild(backButton);

        const title = document.createElement('h3');
        title.textContent = this.submoduleName;
        title.style.textAlign = 'center';
        title.style.marginBottom = '20px';
        this.container.appendChild(title);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';

        const card1 = this.createModuleCard(
            'Ver Cronograma',
            'Visualizar y gestionar el cronograma de capacitaciones anual.',
            () => this.enterViewer()
        );
        cardsContainer.appendChild(card1);

        const card2 = this.createModuleCard(
            'Importar desde Excel',
            'Cargar el cronograma desde archivo Excel.',
            () => this.importFromExcel()
        );
        cardsContainer.appendChild(card2);

        const card3 = this.createModuleCard(
            'Exportar Cronograma',
            'Generar reporte del cronograma en diferentes formatos.',
            () => this.exportCronograma()
        );
        cardsContainer.appendChild(card3);

        const card4 = this.createModuleCard(
            'Matriz de Formación',
            'Gestionar la matriz de formación por cargos y áreas.',
            () => this.openMatrizFormacion()
        );
        cardsContainer.appendChild(card4);

        this.container.appendChild(cardsContainer);
    }

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'module-card';
        card.style.background = '#fff';
        card.style.border = '1px solid #dee2e6';
        card.style.borderRadius = '8px';
        card.style.padding = '20px';
        card.style.cursor = 'pointer';
        card.style.transition = 'all 0.3s ease';
        card.style.textAlign = 'left';

        card.innerHTML = `
            <h4 style="margin: 0 0 10px; color: #174ea6; font-family: 'Lexend', sans-serif;">${title}</h4>
            <p style="margin: 0; color: #6c757d; font-size: 14px;">${description}</p>
        `;

        card.onmouseenter = () => {
            card.style.borderColor = '#174ea6';
            card.style.boxShadow = '0 5px 15px rgba(23, 78, 166, 0.1)';
            card.style.transform = 'translateY(-2px)';
        };

        card.onmouseleave = () => {
            card.style.borderColor = '#dee2e6';
            card.style.boxShadow = 'none';
            card.style.transform = 'translateY(0)';
        };

        card.onclick = onClick;

        return card;
    }

    importFromExcel() {
        alert('Función: Importar desde Excel\n\nEsta acción abrirá un selector de archivos para cargar el cronograma de capacitaciones.');
    }

    exportCronograma() {
        alert('Función: Exportar Cronograma\n\nSe generará un archivo Excel/PDF con el cronograma de capacitaciones vigente.');
    }

    openMatrizFormacion() {
        alert('Función: Matriz de Formación\n\nEsta acción abrirá el módulo de gestión de matriz de formación.');
    }
}

// Exponer globalmente
window.CapacitacionesPortalComponent = CapacitacionesPortalComponent;
