/**
 * ============================================================================
 * archivo-retencion.js — Componente wrapper para Submódulo 2.5.1
 * Archivo y Retención Documental del SG-SST
 * ============================================================================
 *
 * Crea un iframe que carga index.html del módulo y actúa como puente
 * entre el renderer del iframe y el proceso principal vía electronAPI.
 *
 * Patrón: postMessage bidireccional (iframe ↔ wrapper ↔ electronAPI)
 * ============================================================================
 */

class ArchivoRetencionComponent {
  constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
    this.onBackToModuleHome = onBackToModuleHome;

    // Binding para el handler de mensajes
    this.handleParentMessage = this.handleParentMessage.bind(this);

    // Estado del iframe
    this.iframe = null;
    this.isReady = false;
    this.isDestroyed = false;

    // Protección contra bucles infinitos
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.maxRequestsPerSecond = 5;

    console.log('[ArchivoRetencionComponent] ✅ Instancia creada');
  }

  render() {
    if (this.isDestroyed) {
      console.warn('[ArchivoRetencionComponent] ⚠️ No se puede renderizar: componente destruido');
      return;
    }

    console.log('[ArchivoRetencionComponent] 🔄 Renderizando iframe...');

    try {
      this.container.innerHTML = '';

      this.iframe = document.createElement('iframe');
      this.iframe.id = 'archivo-retencion-iframe';
      this.iframe.style.cssText = 'width: 100%; height: 100%; border: none;';

      const viewerUrl = `modules/gestion-integral/archivo-retencion/index.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
      this.iframe.src = viewerUrl;

      console.log('[ArchivoRetencionComponent] 📄 iframe creado con URL:', viewerUrl.substring(0, 100) + '...');

      window.addEventListener('message', this.handleParentMessage);
      this.container.appendChild(this.iframe);

      console.log('[ArchivoRetencionComponent] ✅ iframe insertado en el DOM');
    } catch (error) {
      console.error('[ArchivoRetencionComponent] ❌ Error en render():', error.message);
    }
  }

  handleParentMessage(event) {
    if (this.isDestroyed) return;
    if (!event.data || !event.data.type) return;

    // Protección contra bucle infinito
    const now = Date.now();
    if (now - this.lastRequestTime < 1000 / this.maxRequestsPerSecond) {
      this.requestCount++;
      if (this.requestCount > 10) {
        console.warn('[ArchivoRetencionComponent] ⚠️ Bucle infinito detectado, ignorando mensajes');
        return;
      }
    } else {
      this.requestCount = 0;
    }
    this.lastRequestTime = now;

    const { type, payload, requestId } = event.data;

    switch (type) {
      case 'iframe-ready':
        this.isReady = true;
        console.log('[ArchivoRetencionComponent] ✅ iframe listo');
        break;

      case 'get-excel-path-request':
        this.handleGetExcelPath(payload, requestId);
        break;

      case 'leer-todos-request':
        this.handleLeerTodos(payload, requestId);
        break;

      case 'guardar-request':
        this.handleGuardar(payload, requestId);
        break;

      case 'crear-request':
        this.handleCrear(payload, requestId);
        break;

      case 'actualizar-request':
        this.handleActualizar(payload, requestId);
        break;

      case 'eliminar-request':
        this.handleEliminar(payload, requestId);
        break;

      case 'get-archivo-retencion-stats-request':
        this.handleGetStats(payload, requestId);
        break;

      case 'back-to-module-request':
        if (this.onBackToModuleHome) {
          this.onBackToModuleHome();
        }
        break;

      default:
        break;
    }
  }

  // ── Métodos de respuesta al iframe ──────────────────────────────────────

  sendResponse(type, requestId, payload) {
    if (this.isDestroyed || !this.iframe || !this.iframe.contentWindow) return;
    try {
      this.iframe.contentWindow.postMessage({
        type: `${type}-response`,
        requestId,
        payload
      }, '*');
    } catch (e) {
      console.error('[ArchivoRetencionComponent] ❌ Error enviando respuesta:', e.message);
    }
  }

  async handleGetExcelPath(payload, requestId) {
    try {
      if (window.electronAPI && window.electronAPI.archivoRetencion) {
        const result = await window.electronAPI.archivoRetencion.getExcelPath(this.companyName);
        this.sendResponse('get-excel-path', requestId, result);
      } else {
        throw new Error('electronAPI.archivoRetencion no disponible');
      }
    } catch (error) {
      this.sendResponse('get-excel-path', requestId, { success: false, error: error.message });
    }
  }

  async handleLeerTodos(payload, requestId) {
    try {
      if (window.electronAPI && window.electronAPI.archivoRetencion) {
        const result = await window.electronAPI.archivoRetencion.leerTodos(this.companyName);
        this.sendResponse('leer-todos', requestId, result);
      } else {
        throw new Error('electronAPI.archivoRetencion no disponible');
      }
    } catch (error) {
      this.sendResponse('leer-todos', requestId, { success: false, error: error.message });
    }
  }

  async handleGuardar(payload, requestId) {
    try {
      if (window.electronAPI && window.electronAPI.archivoRetencion) {
        const result = await window.electronAPI.archivoRetencion.guardar(this.companyName, payload);
        this.sendResponse('guardar', requestId, result);
      } else {
        throw new Error('electronAPI.archivoRetencion no disponible');
      }
    } catch (error) {
      this.sendResponse('guardar', requestId, { success: false, error: error.message });
    }
  }

  async handleCrear(payload, requestId) {
    try {
      if (window.electronAPI && window.electronAPI.archivoRetencion) {
        const result = await window.electronAPI.archivoRetencion.crear(this.companyName, payload);
        this.sendResponse('crear', requestId, result);
      } else {
        throw new Error('electronAPI.archivoRetencion no disponible');
      }
    } catch (error) {
      this.sendResponse('crear', requestId, { success: false, error: error.message });
    }
  }

  async handleActualizar(payload, requestId) {
    try {
      if (window.electronAPI && window.electronAPI.archivoRetencion) {
        const result = await window.electronAPI.archivoRetencion.actualizar(this.companyName, payload);
        this.sendResponse('actualizar', requestId, result);
      } else {
        throw new Error('electronAPI.archivoRetencion no disponible');
      }
    } catch (error) {
      this.sendResponse('actualizar', requestId, { success: false, error: error.message });
    }
  }

  async handleEliminar(payload, requestId) {
    try {
      if (window.electronAPI && window.electronAPI.archivoRetencion) {
        const result = await window.electronAPI.archivoRetencion.eliminar(this.companyName, payload);
        this.sendResponse('eliminar', requestId, result);
      } else {
        throw new Error('electronAPI.archivoRetencion no disponible');
      }
    } catch (error) {
      this.sendResponse('eliminar', requestId, { success: false, error: error.message });
    }
  }

  async handleGetStats(payload, requestId) {
    try {
      if (window.electronAPI && window.electronAPI.archivoRetencion) {
        const result = await window.electronAPI.archivoRetencion.getStats(this.companyName);
        this.sendResponse('get-archivo-retencion-stats', requestId, result);
      } else {
        throw new Error('electronAPI.archivoRetencion no disponible');
      }
    } catch (error) {
      this.sendResponse('get-archivo-retencion-stats', requestId, { success: false, error: error.message });
    }
  }

  /**
   * Abre el dashboard de métricas de gestión documental
   */
  openDashboard() {
    this.container.innerHTML = '';

    // Botón volver
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-back';
    backBtn.innerHTML = '&#8592; Volver';
    backBtn.style.cssText = 'margin-bottom:1rem;cursor:pointer;padding:0.5rem 1rem;border:1px solid var(--k-border);border-radius:var(--k-radius-md);background:var(--k-bg-card);color:var(--k-text-dark);';
    backBtn.addEventListener('click', () => {
      if (this.onBackToModuleHome) this.onBackToModuleHome();
    });
    this.container.appendChild(backBtn);

    // Iframe del dashboard
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:calc(100vh - 60px);border:none;';
    iframe.src = `modules/gestion-integral/archivo-retencion/archivo-retencion-dashboard.html?company=${encodeURIComponent(this.companyName)}`;
    this.container.appendChild(iframe);
  }

  // ── Destrucción ─────────────────────────────────────────────────────────

  destroy() {
    console.log('[ArchivoRetencionComponent] 🗑️ Destruyendo componente...');
    this.isDestroyed = true;

    try {
      window.removeEventListener('message', this.handleParentMessage);
    } catch (e) {}

    if (this.iframe) {
      try {
        this.iframe.remove();
      } catch (e) {}
      this.iframe = null;
    }

    console.log('[ArchivoRetencionComponent] ✅ Componente destruido');
  }
}

// Exportar globalmente
window.ArchivoRetencionComponent = ArchivoRetencionComponent;
