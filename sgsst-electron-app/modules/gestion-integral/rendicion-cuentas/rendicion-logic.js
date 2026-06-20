/**
 * Lógica del submódulo de Rendición de Cuentas
 *
 * Este archivo contiene la lógica de negocio para la rendición de cuentas
 */

class RendicionCuentasComponent {
  constructor(container, company, module, submodule, backCallback) {
    this.container = container;
    this.company = company;
    this.module = module;
    this.submodule = submodule;
    this.backCallback = backCallback;
    this.name = 'Rendición de Cuentas';
    this.description = 'Sistema de rendición de cuentas para el SG-SST';
    this.version = '1.0.0';
  }

  /**
   * Inicializa el componente
   */
  async initialize() {
    console.log('Inicializando componente de Rendición de Cuentas');
    // Aquí se podría inicializar cualquier configuración necesaria
    return true;
  }

  /**
   * Renderiza el componente en el contenedor
   */
  async render() {
    // Cargar el portal de bienvenida desde rendicion-home.html
    await this.loadPortalHome();
  }

  /**
   * Carga el portal de bienvenida (interfaz de antesala)
   */
  async loadPortalHome() {
    // Limpiar contenedor
    this.container.innerHTML = '';

    // Crear el contenedor del portal
    const portalContainer = document.createElement('div');
    portalContainer.id = 'rendicion-portal-container';
    this.container.appendChild(portalContainer);

    // Cargar el HTML del portal
    try {
      const response = await fetch(`./modules/gestion-integral/rendicion-cuentas/rendicion-home.html`);
      if (response.ok) {
        const html = await response.text();
        portalContainer.innerHTML = html;

        // Inicializar el JS del portal
        this.initPortalJS(portalContainer);
      } else {
        throw new Error('No se pudo cargar el portal');
      }
    } catch (error) {
      console.error('[RendicionCuentasComponent] Error cargando portal:', error);
      // Fallback al diseño original si falla la carga
      this.renderLegacyDesign();
    }
  }

  /**
   * Inicializa el JS del portal dinámicamente
   */
  initPortalJS(portalContainer) {
    // Hacer referencia al contenedor del portal y al componente
    window.rendicionPortalContainer = portalContainer;
    window.rendicionPortalComponent = this;
    // El callback de retorno al módulo principal
    window.rendicionModuleBackCallback = this.backCallback;

    // Cargar el JS del portal dinámicamente
    const script = document.createElement('script');
    script.src = './modules/gestion-integral/rendicion-cuentas/rendicion-home.js';
    script.onload = () => {
      console.log('[RendicionCuentasComponent] rendicion-home.js cargado');
    };
    script.onerror = () => {
      console.error('[RendicionCuentasComponent] Error cargando rendicion-home.js');
      this.renderLegacyDesign();
    };
    document.body.appendChild(script);
  }

  /**
   * Método para entrar a la rendición de cuentas (llamado desde rendicion-home.js)
   */
  async enterRendicion() {
    console.log('[RendicionCuentasComponent] Entrando a rendición de cuentas');
    
    // Limpiar el contenedor
    this.container.innerHTML = '';

    // Crear contenedor para el contenido
    const viewerContainer = document.createElement('div');
    viewerContainer.style.width = '100%';
    viewerContainer.style.height = '100%';
    viewerContainer.style.overflow = 'auto';
    this.container.appendChild(viewerContainer);

    try {
      // Cargar el HTML directamente
      const response = await fetch(`./modules/gestion-integral/rendicion-cuentas/rendicion-cuentas.html`);
      if (response.ok) {
        const html = await response.text();
        
        // Parsear el HTML para extraer el contenido del body
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extraer estilos del head
        const styles = doc.head.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach(style => {
          viewerContainer.appendChild(style.cloneNode(true));
        });
        
        // Extraer scripts del head
        const headScripts = doc.head.querySelectorAll('script');
        headScripts.forEach(script => {
          const newScript = document.createElement('script');
          if (script.src) {
            newScript.src = script.src;
          } else {
            newScript.textContent = script.textContent;
          }
          document.body.appendChild(newScript);
        });
        
        // Insertar el contenido del body
        viewerContainer.innerHTML += doc.body.innerHTML;
        
        // Configurar el botón de volver para que retorne al portal
        // Usar un intervalo para asegurar que el elemento esté disponible
        const setupBackButton = () => {
          const backBtn = document.getElementById('backToModuleBtn');
          if (backBtn) {
            // Remover cualquier listener previo
            backBtn.onclick = null;
            // Agregar nuevo listener
            backBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Rendicion Viewer] Botón volver clickeado');
              this.backToPortal();
            };
            console.log('[Rendicion Viewer] Botón de volver configurado correctamente');
          } else {
            // Reintentar después de 100ms
            setTimeout(setupBackButton, 100);
          }
        };
        
        // Intentar configurar el botón inmediatamente y luego de 200ms
        setupBackButton();
        setTimeout(setupBackButton, 200);
        
        // Cargar scripts del body
        const bodyScripts = doc.body.querySelectorAll('script');
        bodyScripts.forEach(script => {
          const newScript = document.createElement('script');
          if (script.src) {
            newScript.src = script.src;
          } else {
            newScript.textContent = script.textContent;
          }
          viewerContainer.appendChild(newScript);
        });
        
      } else {
        throw new Error('No se pudo cargar el viewer');
      }
    } catch (error) {
      console.error('[RendicionCuentasComponent] Error cargando viewer:', error);
      // Fallback: mostrar mensaje de error
      viewerContainer.innerHTML = `
        <div style="padding: 2rem; text-align: center;">
          <h3>Error al cargar el formulario de rendición de cuentas</h3>
          <p>${error.message}</p>
          <button onclick="window.rendicionPortalComponent.backToPortal()" 
                  style="padding: 10px 20px; margin-top: 1rem; cursor: pointer;">
            Volver al Portal
          </button>
        </div>
      `;
    }
  }

  /**
   * Método para retornar al portal desde el viewer (llamado desde rendicion-viewer.js)
   */
  async backToPortal() {
    console.log('[RendicionCuentasComponent] Retornando al portal');
    await this.loadPortalHome();
  }

  /**
   * Método legacy (diseño original) como fallback
   */
  renderLegacyDesign() {
    console.log('[RendicionCuentasComponent] Usando diseño legacy como fallback');
    
    this.container.innerHTML = '';

    const backButton = document.createElement('button');
    backButton.className = 'btn btn-back';
    backButton.innerHTML = '&#8592; Volver al Módulo';
    backButton.addEventListener('click', this.backCallback);
    this.container.appendChild(backButton);

    const title = document.createElement('h3');
    title.textContent = this.submoduleName;
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    this.container.appendChild(title);

    // Fallback: cargar el viewer directamente
    if (typeof window !== 'undefined' && window.rendicionViewer) {
      window.rendicionViewer.render(this.container, {
        company: this.company,
        module: this.module,
        submodule: this.submodule
      }, this.backCallback);
    }
  }

  /**
   * Obtiene los datos de rendición de cuentas
   * @param {Object} params - Parámetros para obtener los datos
   * @returns {Object} - Datos de rendición de cuentas
   */
  async getData(params = {}) {
    // Simulación de obtención de datos
    const sampleData = {
      general: {
        companyName: this.company || 'TEMPOACTIVA EST S.A.S.',
        nit: '900511178-1',
        period: params.period || '2024',
        legalRepresentative: 'Freedy Enrique Torrez Madariaga',
        sstResponsible: 'Javier Robles Fontalvo',
        legalBasis: 'Decreto 1072/2015, Res. 0312/2019, Res. 2341/2021'
      },
      team: {
        coordinator: '',
        vigilator: ''
      },
      status: {
        compliance: '91%',
        workers: 154
      },
      standards: [
        { id: 1, name: 'Política del SG-SST', status: 'Sí', compliance: '100%', observations: '-' },
        { id: 2, name: 'Gestión de Riesgos', status: 'Sí', compliance: '95%', observations: '-' },
        { id: 3, name: 'Planificación y Programas', status: 'Parcial', compliance: '75%', observations: 'Falta actualizar PTA' },
        { id: 10, name: 'Auditoría y Revisión', status: 'Parcial', compliance: '70%', observations: 'Pendiente auditoría interna' }
      ],
      indicators: {
        accidentRate: '1.8%',
        absenteeismRate: '0.8%',
        trainingExecuted: '92%'
      },
      legalMatrix: [
        { requirement: 'Política SG-SST', norm: 'D.1072/15', complies: 'Sí' },
        { requirement: 'Plan Anual', norm: 'D.1072/15', complies: 'Sí' },
        { requirement: 'Riesgo Psicosocial', norm: 'Res. 2646/08', complies: 'Parcial' }
      ],
      findings: {
        nonConformity: 'NC-001: Auditoría interna no programada para el periodo 2024.',
        criticalRisks: 'R-001: Caídas en mismo nivel (En proceso de señalización).'
      },
      incidents: [
        { id: 'AT-001', date: '15/03/2024', worker: '[Nombre 1]', injury: 'Corte superficial', daysLost: 2, investigation: 'Completada' },
        { id: 'AT-002', date: '22/06/2024', worker: '[Nombre 2]', injury: 'Esguince tobillo', daysLost: 5, investigation: 'Completada' }
      ],
      improvementPlan: [
        { action: 'Auditoría Interna SG-SST', type: 'Correctiva', responsible: 'Coordinador SST', dates: '15/01/2025 - 28/02/2025', status: 'Programada', progress: '0%' },
        { action: 'Aplicación Batería Psicosocial', type: 'Preventiva', responsible: 'ARL', dates: '01/02/2025 - 31/03/2025', status: 'Programada', progress: '0%' }
      ],
      conclusions: {
        summary: 'El Sistema de Gestión ha mantenido un nivel de cumplimiento del 91%. Se redujo la tasa de accidentalidad en un 28% respecto al año anterior. Se identifica la necesidad de programar la auditoría interna para el primer trimestre de 2025.',
        decisions: [
          'Aprobar presupuesto para auditoría interna SG-SST',
          'Contratar servicio de batería de riesgo psicosocial'
        ]
      },
      signatures: {
        legalRep: 'Freedy Enrique Torrez Madariaga',
        sstResponsible: 'Javier Robles Fontalvo'
      }
    };

    return sampleData;
  }

  /**
   * Guarda los datos de rendición de cuentas
   * @param {Object} data - Datos a guardar
   * @returns {Boolean} - Indica si se guardó correctamente
   */
  async saveData(data) {
    console.log('Guardando datos de rendición de cuentas:', data);
    // Aquí iría la lógica real para guardar los datos
    return true;
  }

  /**
   * Genera el informe final de rendición de cuentas
   * @param {Object} params - Parámetros para generar el informe
   * @returns {Object} - Resultado de la generación del informe
   */
  async generateReport(params = {}) {
    console.log('Generando informe de rendición de cuentas');
    // Aquí iría la lógica real para generar el informe
    return {
      success: true,
      reportPath: '/path/to/generated/report.pdf',
      message: 'Informe generado exitosamente'
    };
  }
}

// Registrar el componente globalmente para que el renderer.js pueda acceder a él
if (typeof window !== 'undefined') {
  window.RendicionCuentasComponent = RendicionCuentasComponent;

  // También registrar una instancia por si acaso
  window.rendicionCuentasInstance = new RendicionCuentasComponent();
}