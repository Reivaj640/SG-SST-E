// plan-trabajo-logic.js - Componente para el submódulo "2.4.1 Plan de Trabajo Anual"
// Ahora con diseño de portal de bienvenida moderno

class PlanTrabajoComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
    }

    async render() {
        this.container.innerHTML = '';

        // Cargar el portal de bienvenida desde plan-home.html
        await this.loadPortalHome();
    }

    async loadPortalHome() {
        // Crear el contenedor del portal
        const portalContainer = document.createElement('div');
        portalContainer.id = 'plan-portal-container';
        this.container.appendChild(portalContainer);

        // Cargar el HTML del portal
        try {
            const response = await fetch(`./modules/gestion-integral/plan-trabajo/plan-home.html`);
            if (response.ok) {
                const html = await response.text();
                portalContainer.innerHTML = html;

                // Inicializar el JS del portal
                this.initPortalJS(portalContainer);
            } else {
                throw new Error('No se pudo cargar el portal');
            }
        } catch (error) {
            console.error('[PlanTrabajoComponent] Error cargando portal:', error);
            // Fallback al diseño original si falla la carga
            this.renderLegacyDesign();
        }
    }

  initPortalJS(portalContainer) {
    // Hacer referencia al contenedor del portal
    window.planPortalContainer = portalContainer;
    window.planPortalComponent = this;

    // Cargar el JS del portal dinámicamente
    const script = document.createElement('script');
    script.src = './modules/gestion-integral/plan-trabajo/plan-home.js';
    script.onload = () => {
      console.log('[PlanTrabajoComponent] plan-home.js cargado');
    };
    script.onerror = () => {
      console.error('[PlanTrabajoComponent] Error cargando plan-home.js');
      this.renderLegacyDesign();
    };
    document.body.appendChild(script);
    this.portalScript = script;
  }

    /**
     * Método para entrar al cronograma (llamado desde plan-home.js)
     */
  async enterCronograma() {
    this.container.innerHTML = '';

    window.planPortalComponent = this;

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';

    const viewerUrl = `./modules/gestion-integral/plan-trabajo/plan-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
    iframe.src = viewerUrl;

    this.container.appendChild(iframe);
  }

  async goBackToHome() {
    window.planPortalComponent = this;
    this.container.innerHTML = '';
    await this.loadPortalHome();
  }

  goBackToModuleHome() {
    this.destroy();
    if (this.onBackToModuleHome) {
      this.onBackToModuleHome();
    }
  }

  destroy() {
    if (window.planPortalComponent === this) {
      window.planPortalComponent = null;
    }
    if (window.planPortalContainer) {
      window.planPortalContainer = null;
    }
    if (this.portalScript && this.portalScript.parentNode === document.body) {
      document.body.removeChild(this.portalScript);
      this.portalScript = null;
    }
    this.container.innerHTML = '';
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
            'Ver Plan de Trabajo',
            'Visualizar, gestionar y actualizar el plan de trabajo anual.',
            () => this.enterCronograma()
        );
        cardsContainer.appendChild(card1);

        const card2 = this.createModuleCard(
            'Importar desde Excel',
            'Cargar actividades desde archivo Excel al sistema.',
            () => this.importFromExcel()
        );
        cardsContainer.appendChild(card2);

        const card3 = this.createModuleCard(
            'Exportar Plan',
            'Generar reporte del plan de trabajo en diferentes formatos.',
            () => this.exportPlan()
        );
        cardsContainer.appendChild(card3);

        const card4 = this.createModuleCard(
            'Configurar Periodo',
            'Administrar años y periodos del plan de trabajo.',
            () => this.configurePeriod()
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
        alert('Función: Importar desde Excel\n\nEsta acción abrirá un selector de archivos para cargar un nuevo plan de trabajo.');
    }

    exportPlan() {
        alert('Función: Exportar Plan\n\nSe generará un archivo Excel/PDF con el plan de trabajo vigente.');
    }

    configurePeriod() {
        alert('Función: Configurar Período\n\nEsta acción abrirá las opciones para configurar años y períodos.');
    }
}

// Exponer globalmente
window.PlanTrabajoComponent = PlanTrabajoComponent;
