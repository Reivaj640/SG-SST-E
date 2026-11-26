// copasst-logic.js - Componente para el submódulo "1.1.6 Conformación de Copasst"
// UX/UI Pattern: Portal de Submódulo (K+AIR Standard)

class CopasstComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModuleHome) {
        this.container = container;
        this.currentCompany = companyName;
        this.companyName = companyName;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBackToModuleHome = onBackToModuleHome;
        
        this.handleIframeMessage = this.handleIframeMessage.bind(this);
    }

  render() {
    console.warn('[CopasstComponent] render() is deprecated. Use CopasstPortalComponent instead.');
    if (this.onBackToModuleHome) this.onBackToModuleHome();
  }

    // --- MÉTODOS DE FUNCIONALIDAD (SIN CAMBIOS EN LÓGICA INTERNA) ---

    showVerActasPage() {
        this.container.innerHTML = '';
        window.addEventListener('message', this.handleIframeMessage);
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        const viewerUrl = `modules/recursos/copasst/copasst-view.html?v=COPASST-20261014-v4-dark890&company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;
        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.type) return;

        // 📦608-fix15 — El iframe nos pide abrir el modal full-screen de file-viewer.
        if (event.data.type === 'open-file-viewer-modal') {
            const filePath = event.data.filePath;
            if (!filePath) return;
            if (window.kairFV && typeof window.kairFV.openWithFileViewerFromPath === 'function') {
                window.kairFV.openWithFileViewerFromPath(filePath);
            } else {
                console.warn('[CopasstLogic] kairFV.openWithFileViewerFromPath no disponible');
            }
            return;
        }

        if (event.data.type.endsWith('-request')) {
            const action = event.data.type.replace('-request', '');
            if (action === 'back-to-module') {
                window.removeEventListener('message', this.handleIframeMessage);
                this.render();
            } else {
                const apiMap = this.getApiMap();
                const apiName = apiMap[action];
                if (apiName) {
                    window.KairDocPreview.handleRequest(event, apiName);
                }
            }
        }
    }

  getApiMap() {
    return {
      'get-document-folders': 'getDocumentFolders',
      'get-documents-in-folder': 'getDocumentsInFolder',
      'get-folder-contents': 'getFolderContents',
      'get-pdf-preview': 'getPDFPreview',
      'get-word-preview': 'getWordPreview',
      'get-excel-preview': 'getExcelPreview',
      'download-document': 'downloadDocument',
      'upload-document': 'uploadDocument',
      'delete-document': 'deleteDocument',
      'delete-folder': 'deleteFolder',
      'create-folder': 'createFolder',
      'open-file': 'openFile'
    };
  }

    async handleStandardRequest(event, apiFunctionName) {
        const { requestId, payload } = event.data;
        try {
            const apiArgs = (payload && payload.filePath) ? payload.filePath : payload;
            const result = await window.electronAPI[apiFunctionName](apiArgs);
            event.source.postMessage({
                type: `${event.data.type.replace('-request', '')}-response`,
                requestId,
      payload: {
        success: result.success,
        data: result.data || result,
        files: result.files,
        folders: result.folders,
        basePath: result.basePath,
        path: result.path,
        fileName: result.fileName,
        base64Data: result.base64Data,
        error: result.error,
        code: result.code
      }
            }, '*');
        } catch (error) {
            event.source.postMessage({
                type: `${event.data.type.replace('-request', '')}-response`,
                requestId,
                payload: { success: false, error: error.message }
            }, '*');
        }
    }

    showRealizarActasInterface() {
        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'copasst-actas-container';
        wrapper.style.cssText = 'display:flex; flex-direction:column; height:100%; overflow:hidden;';

        const header = document.createElement('div');
        header.innerHTML = `
<!-- HEADER PREMIUM — sin tarjeta, breadcrumb + título (patrón aprobado) -->
<div class="pres-header" style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:0.35rem 0.2rem 1.2rem; flex-shrink:0; flex-wrap:wrap;">
  <div style="display:flex; align-items:center; gap:0.9rem; min-width:0;">
    <div class="pres-header__icon" style="width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
      <i class="fas fa-file-signature"></i>
    </div>
    <div>
      <div class="pres-header__crumb" style="font-size:11px; color:var(--kair-faint,#aab1bd); margin-bottom:3px;">Recursos<span style="padding:0 4px;">/</span>COPASST</div>
      <h1 style="margin:0; font:800 clamp(17px,1.7vw,23px)/1.15 var(--kair-font-display,'Segoe UI'); letter-spacing:-0.03em; color:var(--kair-ink,#14213d);">Generador de Actas COPASST</h1>
      <p style="font-size:0.8125rem; color:var(--kair-muted,#748096); margin:2px 0 0 0;">Formulario de creación de actas del comité SG-SST.</p>
    </div>
  </div>
  <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
    <span style="display:inline-flex; align-items:center; gap:0.4rem; font-size:0.8rem; font-weight:600; color:var(--kair-muted,#748096); background:var(--kair-soft,#f3f6f6); border-radius:999px; padding:0.35rem 0.8rem; max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
      <i class="fas fa-building" style="font-size:0.875rem;"></i>
      <span id="header-company-text">${this.currentCompany || '—'}</span>
    </span>
    <button id="btn-back-portal" class="header-back-btn" title="Volver al Portal COPASST">
      <i class="fas fa-arrow-left"></i> Volver
    </button>
    <button id="btn-auto-fill-header" class="header-action--primary" title="Autollenado inteligente del acta">
      <i class="fas fa-magic"></i> Autollenado
    </button>
    <button id="btn-export-excel-header" class="header-action--success" title="Guardar acta en Excel">
      <i class="fas fa-save"></i> Guardar
    </button>
  </div>
</div>
`;
        wrapper.appendChild(header);

        const editorContainer = document.createElement('div');
        editorContainer.className = 'acta-editor-container';
        editorContainer.style.cssText = 'flex:1; overflow-y:auto;';

        const style = document.createElement('style');
        style.textContent = `
/* ═══ PREMIUM v1 (2026-09-15) — Header y formulario con acabado premium ═══ */
.copasst-actas-container .pres-header__icon {
  background: #e3ecfb; color: var(--kair-blue, #2057b8);
}
.copasst-actas-container .pres-header .header-back-btn {
  padding: 0.55rem 1rem; border-radius: 10px; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;
  border: 1px solid var(--kair-line, #e8ebee); background: var(--kair-card, #ffffff);
  color: #536177; transition: all 0.18s; white-space: nowrap;
  font-family: var(--kair-font-ui, 'Segoe UI', 'Roboto', sans-serif);
}
.copasst-actas-container .pres-header .header-back-btn:hover {
  background: var(--kair-soft, #f3f6f6); color: var(--kair-blue, #2057b8);
}
.copasst-actas-container .pres-header .header-back-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.copasst-actas-container .pres-header .header-action--primary {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.55rem 1.05rem; font-size: 0.8125rem; font-weight: 700;
  color: #fff; background: var(--kair-blue, #2057b8); border: 0;
  border-radius: 10px; cursor: pointer; transition: all 0.18s;
  box-shadow: 0 8px 18px rgba(32, 87, 184, 0.15);
  font-family: var(--kair-font-ui, 'Segoe UI', 'Roboto', sans-serif); white-space: nowrap;
}
.copasst-actas-container .pres-header .header-action--primary:hover { background: #1a4ba0; }
.copasst-actas-container .pres-header .header-action--primary:disabled { opacity: 0.6; cursor: not-allowed; }
.copasst-actas-container .pres-header .header-action--primary--loading {
  pointer-events: none; position: relative; color: transparent;
}
.copasst-actas-container .pres-header .header-action--primary--loading::after {
  content: ''; position: absolute; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: kair-spin 0.6s linear infinite;
  left: 50%; top: 50%; margin-left: -7px; margin-top: -7px;
}

.copasst-actas-container .pres-header .header-action--success {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.55rem 1.05rem; font-size: 0.8125rem; font-weight: 700;
  color: #fff; background: var(--kair-mint, #1bb888); border: 0;
  border-radius: 10px; cursor: pointer; transition: all 0.18s;
  font-family: var(--kair-font-ui, 'Segoe UI', 'Roboto', sans-serif); white-space: nowrap;
}
.copasst-actas-container .pres-header .header-action--success:hover { background: #159b74; }
.copasst-actas-container .pres-header .header-action--success:disabled { opacity: 0.6; cursor: not-allowed; }

@keyframes kair-spin { to { transform: rotate(360deg); } }

/* ─── Formulario del acta — acabado premium ─── */
.copasst-actas-container { --primary-color: var(--kair-blue, #2057b8); --primary-hover-color: #1a4ba0; --bg-color: var(--kair-canvas, #fbfcfb); --widget-bg-color: var(--kair-card, #ffffff); --border-color: var(--kair-line, #e8ebee); }
.copasst-actas-container .acta-form-wrapper { font-family: var(--kair-font-ui, 'Segoe UI', 'Roboto', sans-serif); color: var(--kair-ink, #14213d); background: var(--bg-color); padding: 0.35rem 0.2rem 2rem; max-width: 1100px; margin: 0 auto; }
.copasst-actas-container .acta-card { background: var(--kair-card, #ffffff); border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 2px 7px rgba(37, 56, 82, 0.05); padding: clamp(18px, 2vw, 28px); margin-bottom: clamp(14px, 1.6vw, 22px); }
.copasst-actas-container .acta-card-title { font: 700 clamp(15px, 1.4vw, 19px) var(--kair-font-display, 'Segoe UI'); letter-spacing: -0.03em; margin-top: 0; margin-bottom: 1.25rem; color: var(--kair-ink, #14213d); border-bottom: 0; padding-bottom: 0; display: flex; align-items: center; gap: 0.6rem; }
.copasst-actas-container .acta-card-title::before { content: ''; width: 4px; height: 18px; border-radius: 4px; background: var(--kair-blue, #2057b8); flex-shrink: 0; }
.copasst-actas-container .acta-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.25rem; }
.copasst-actas-container .acta-form-group { display: flex; flex-direction: column; }
.copasst-actas-container .acta-form-group.full-width { grid-column: 1 / -1; }
.copasst-actas-container .acta-form-group label { font-size: 0.8125rem; font-weight: 600; color: var(--kair-muted, #748096); margin-bottom: 0.45rem; }
.copasst-actas-container .acta-form-group input,
.copasst-actas-container .acta-form-group textarea {
  padding: 0.55rem 0.75rem; border: 1px solid var(--border-color); border-radius: 10px;
  font-family: inherit; font-size: 0.875rem; color: var(--kair-ink, #14213d);
  background: var(--kair-card, #ffffff); transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.copasst-actas-container .acta-form-group input:focus,
.copasst-actas-container .acta-form-group textarea:focus {
  outline: none; border-color: var(--kair-blue, #2057b8);
  box-shadow: 0 0 0 3px rgba(32, 87, 184, 0.10);
}
.copasst-actas-container .acta-dynamic-item { background: var(--kair-soft, #f3f6f6); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; position: relative; }
.copasst-actas-container .acta-btn-add { width: 100%; padding: 0.75rem; background: var(--kair-card, #ffffff); color: var(--kair-blue, #2057b8); border: 1px dashed #c8d7ef; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.18s; }
.copasst-actas-container .acta-btn-add:hover { background: #eef4fd; border-color: var(--kair-blue, #2057b8); }
.copasst-actas-container .acta-btn-remove { position: absolute; top: 10px; right: 10px; background: var(--kair-red, #da5563); color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; transition: all 0.15s; }
.copasst-actas-container .acta-btn-remove:hover { transform: scale(1.08); }

@media (max-width: 768px) {
    .copasst-actas-container .pres-header { padding-bottom: 0.75rem; }
}

/* ------------------------------------------------------------------
   MODO OSCURO -- Generador de Actas COPASST
   ------------------------------------------------------------------
   El bloque que este reemplaza jamas se ejecuto. Sus 13 selectores
   pedian .copasst-actas-container[data-theme="dark"], pero el atributo
   nunca se pone en ese elemento: vive en el <html>. Ademas solo
   contemplaba "dark", asi que el modo manual (dark-legacy) se habria
   quedado claro igual.

   El formulario NO es un iframe -- lo inyecta copasst-logic.js en el
   DOM del shell -- asi que alcanza con leer el atributo de arriba. El
   operador ^= cubre los dos modos oscuros en una sola regla.

   La superficie ya no se declara aca: .acta-card, los input y
   .acta-btn-add leen --kair-card, que en oscuro vale #384151 / #292929.
   Antes eran "white" fijo, y su texto leia --kair-ink (#e9ecef): texto
   casi blanco sobre blanco, justo lo que se veia en la pantalla.

   CONTRASTE MEDIDO (WCAG 1.4.3), dark / dark-legacy:
     --kair-card   sobre --kair-ink   7.5:1 / 8.9:1
     --kair-card   sobre --kair-muted 4.9:1 / 5.6:1
     --kair-blue-soft sobre --kair-blue-text 5.8:1 / 7.3:1
     --kair-blue   sobre #0b1f33 (texto del boton) 6.5:1 / 8.4:1
     --kair-mint   sobre #0a2a1c (texto del boton) 8.3:1 / 10.6:1
     --kair-red-soft sobre --kair-red-text    5.5:1 / 5.5:1
   ------------------------------------------------------------------ */

/* El wrapper deja ver el fondo del shell en vez de pintar una banda
   mas oscura encima: el shell ya aporta --bg-color del tema. */
[data-theme^="dark"] .copasst-actas-container .acta-form-wrapper { background: transparent; }

[data-theme^="dark"] .copasst-actas-container .pres-header__icon {
  background: var(--kair-blue-soft); color: var(--kair-blue-text);
}
[data-theme^="dark"] .copasst-actas-container .pres-header .header-back-btn {
  color: var(--kair-ink); border-color: var(--kair-line);
}
[data-theme^="dark"] .copasst-actas-container .pres-header .header-back-btn:hover {
  color: var(--kair-blue-text);
}

/* Los botones de acento fillings cambian a texto oscuro en oscuro:
   --kair-blue sube a #5da2ff y el blanco encima daba 2.56:1;
   --kair-mint sube a #4ade9e y daba 1.75:1. Los dos estaban por
   debajo del 4.5:1 que pide WCAG 1.4.3. */
[data-theme^="dark"] .copasst-actas-container .pres-header .header-action--primary {
  color: #0b1f33; box-shadow: none;
}
[data-theme^="dark"] .copasst-actas-container .pres-header .header-action--primary:hover {
  background: var(--kair-blue-text); color: #06121f;
}
[data-theme^="dark"] .copasst-actas-container .pres-header .header-action--success {
  color: #0a2a1c;
}
[data-theme^="dark"] .copasst-actas-container .pres-header .header-action--success:hover {
  background: var(--kair-green-text); color: #04160e;
}

/* "+ Agregar tema" es texto normal (0.85rem/700), asi que pide 4.5:1 y no
   3:1. Con --kair-blue (#5da2ff en oscuro) daba 3.95:1 sobre la tarjeta
   #384151. --kair-blue-text es el mismo tono, un paso mas claro:
   5.02:1 en dark y 8.08:1 en dark-legacy. */
[data-theme^="dark"] .copasst-actas-container .acta-btn-add {
  color: var(--kair-blue-text);
}

/* El halo del focus era rgba(32,87,184,.10): un azul tan apagado que en
   oscuro no se distinguia de la tarjeta. */
[data-theme^="dark"] .copasst-actas-container .acta-form-group input:focus,
[data-theme^="dark"] .copasst-actas-container .acta-form-group textarea:focus {
  box-shadow: 0 0 0 3px rgba(93, 162, 255, 0.30);
}

[data-theme^="dark"] .copasst-actas-container .acta-btn-add:hover {  background: var(--kair-blue-soft); border-color: var(--kair-blue);
}

/* El boton de quitar es texto, no un componente de 3:1: la X sobre
   --kair-red daba 2.6:1 con el blanco. Pasa a su propio tinte. */
[data-theme^="dark"] .copasst-actas-container .acta-btn-remove {
  background: var(--kair-red-soft); color: var(--kair-red-text);
}

/* ═══════════════════════════════════════════════════════════════════════
   📦1104 — Desplegables de FECHA y HORA del Generador de Actas.
   Mismo lenguaje visual que el Formulario de Registro de ausentismo
   (📦1101): boton con borde, chevron que gira, menu PROPIO (no el del
   sistema operativo) y calendario propio. El <input> nativo queda
   OCULTO como fuente de verdad: handleExportExcel y prepareExcelChanges
   siguen leyendo los mismos IDs (fecha, inicia, termina).
   ═══════════════════════════════════════════════════════════════════════ */
.copasst-actas-container .cop-dd { position: relative; display: block; width: 100%; }
.copasst-actas-container .cop-dd__native { display: none; }

.copasst-actas-container .cop-dd__toggle {
  display: flex; align-items: center; gap: 0.5rem; width: 100%;
  padding: 0.55rem 0.75rem;
  background: var(--kair-card, #ffffff);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  font-family: var(--kair-font-ui, 'Segoe UI', 'Roboto', sans-serif);
  font-size: 0.875rem; font-weight: 500;
  color: var(--kair-ink, #14213d);
  text-align: left; cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.copasst-actas-container .cop-dd__toggle:hover:not(:disabled) { border-color: var(--kair-blue, #2057b8); }
.copasst-actas-container .cop-dd--open .cop-dd__toggle {
  border-color: var(--kair-blue, #2057b8);
  box-shadow: 0 0 0 3px rgba(32, 87, 184, 0.10);
}
.copasst-actas-container .cop-dd__value {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.copasst-actas-container .cop-dd__icon {
  width: 16px; height: 16px; flex-shrink: 0;
  color: var(--kair-muted, #748096);
}
.copasst-actas-container .cop-dd__chevron {
  width: 16px; height: 16px; flex-shrink: 0;
  color: var(--kair-muted, #748096);
  transition: transform 0.15s ease;
}
.copasst-actas-container .cop-dd--open .cop-dd__chevron { transform: rotate(180deg); }

.copasst-actas-container .cop-dd__menu {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  min-width: 100%;
  max-width: 300px;
  background: var(--kair-card, #ffffff);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--kair-shadow-soft, 0 8px 18px rgba(32, 87, 184, 0.15));
  padding: 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  z-index: 100;
}
/* El atributo hidden debe ganarle al display:flex de arriba */
.copasst-actas-container .cop-dd__menu[hidden] { display: none; }
/* El editor tiene scroll: si el menu no cabe hacia abajo, se abre hacia arriba */
.copasst-actas-container .cop-dd__menu--up { top: auto; bottom: calc(100% + 0.375rem); }

/* Las casillas de hora */
.copasst-actas-container .cop-dd__option {
  display: flex; align-items: center; justify-content: center;
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 0.3rem 0.25rem;
  font-family: var(--kair-font-ui, 'Segoe UI', 'Roboto', sans-serif);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--kair-ink, #14213d);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.copasst-actas-container .cop-dd__option:hover:not(:disabled) { background: var(--kair-blue-soft, #eaf1fb); }
.copasst-actas-container .cop-dd__option:focus-visible { outline: 2px solid var(--kair-blue, #2057b8); outline-offset: -2px; }
.copasst-actas-container .cop-dd__option--active {
  background: var(--kair-blue-soft, #eaf1fb);
  color: var(--kair-blue, #2057b8);
  font-weight: 700;
}
/* 📦1104 — La hora de FIN no puede ser anterior a la de INICIO: esas
   casillas quedan deshabilitadas (un acta no puede terminar antes de
   empezar) */
.copasst-actas-container .cop-dd__option:disabled { opacity: 0.35; cursor: not-allowed; }

/* Rejilla de horarios: 4 columnas x 24 filas (pasos de 15 minutos) */
.copasst-actas-container .cop-dd--hora .cop-dd__menu { width: 272px; min-width: 272px; max-width: 272px; padding: 0.5rem; }
.copasst-actas-container .cop-horas {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px;
  max-height: 288px; overflow-y: auto;
}

/* Calendario propio de la fecha */
.copasst-actas-container .cop-dd--fecha .cop-dd__menu { width: 272px; min-width: 272px; max-width: 272px; padding: 0.5rem; }
.copasst-actas-container .cop-cal__head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 4px; padding: 2px 4px 6px;
}
.copasst-actas-container .cop-cal__label {
  font-size: 0.8125rem; font-weight: 700; color: var(--kair-ink, #14213d);
}
.copasst-actas-container .cop-cal__nav {
  width: 28px; height: 28px;
  border: none; background: transparent;
  border-radius: 8px;
  font-size: 16px; line-height: 1;
  color: var(--kair-muted, #748096);
  cursor: pointer;
}
.copasst-actas-container .cop-cal__nav:hover { background: var(--kair-soft, #f3f6f6); }
.copasst-actas-container .cop-cal__week,
.copasst-actas-container .cop-cal__grid {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;
}
.copasst-actas-container .cop-cal__week span {
  font-size: 10px; font-weight: 700; color: var(--kair-faint, #aab1bd);
  text-align: center; text-transform: uppercase;
  padding-bottom: 2px;
}
.copasst-actas-container .cop-cal__day {
  height: 30px;
  border: none; background: transparent;
  border-radius: 8px;
  font-family: var(--kair-font-ui, 'Segoe UI', 'Roboto', sans-serif);
  font-size: 12.5px;
  color: var(--kair-ink, #14213d);
  cursor: pointer;
}
.copasst-actas-container .cop-cal__day:hover { background: var(--kair-soft, #f3f6f6); }
.copasst-actas-container .cop-cal__day--out { opacity: 0.45; }
.copasst-actas-container .cop-cal__day--today {
  box-shadow: inset 0 0 0 1px var(--kair-blue, #2057b8);
  color: var(--kair-blue, #2057b8);
  font-weight: 700;
}
.copasst-actas-container .cop-cal__day--sel {
  background: var(--kair-blue, #2057b8);
  color: #fff;
  font-weight: 700;
}
.copasst-actas-container .cop-cal__day--sel:hover { background: var(--kair-blue, #2057b8); }
.copasst-actas-container .cop-cal__foot {
  display: flex; justify-content: space-between; gap: 6px;
  border-top: 1px solid var(--border-color);
  margin-top: 4px; padding-top: 6px;
}
.copasst-actas-container .cop-cal__btn {
  flex: 1;
  border: 1px solid var(--border-color); background: transparent;
  border-radius: 8px;
  padding: 5px 8px;
  font-family: var(--kair-font-ui, 'Segoe UI', 'Roboto', sans-serif);
  font-size: 12px; font-weight: 600;
  color: var(--kair-muted, #748096);
  cursor: pointer;
}
.copasst-actas-container .cop-cal__btn:hover { background: var(--kair-soft, #f3f6f6); }

/* 📦1104 — Modo oscuro: los tokens ya viran solos (--kair-card, --kair-ink,
   --kair-line, --kair-blue-soft), asi que solo hay que arreglar los dos
   colores que NO son token: el texto del dia elegido (blanco sobre azul
   claro no se lee) y la sombra del menu. */
[data-theme^="dark"] .copasst-actas-container .cop-cal__day--sel { color: #0b1f33; }
[data-theme^="dark"] .copasst-actas-container .cop-dd__menu {
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
}
`;
        wrapper.appendChild(style);

        editorContainer.innerHTML = `
            <div class="acta-form-wrapper">
                <section class="acta-card">
                    <h2 class="acta-card-title">Información de la Reunión</h2>
                    <div class="acta-form-grid">
                        <div class="acta-form-group"><label>N° de Acta</label><input type="number" id="acta-number" value="108"></div>
                        <div class="acta-form-group"><label for="fecha">Fecha</label><div class="cop-dd cop-dd--fecha" data-cop-dd="fecha"><button type="button" class="cop-dd__toggle" aria-haspopup="dialog" aria-expanded="false"><svg class="cop-dd__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span class="cop-dd__value">Seleccione...</span><svg class="cop-dd__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button><div class="cop-dd__menu cop-cal" hidden></div></div><input type="date" id="fecha" class="cop-dd__native" value="${new Date().toISOString().split('T')[0]}"></div>
                        <div class="acta-form-group"><label for="inicia">Hora Inicio</label><div class="cop-dd cop-dd--hora" data-cop-dd="inicia"><button type="button" class="cop-dd__toggle" aria-haspopup="listbox" aria-expanded="false"><svg class="cop-dd__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg><span class="cop-dd__value">Seleccione...</span><svg class="cop-dd__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button><div class="cop-dd__menu" hidden></div></div><input type="time" id="inicia" class="cop-dd__native" value="08:00"></div>
                        <div class="acta-form-group"><label for="termina">Hora Fin</label><div class="cop-dd cop-dd--hora" data-cop-dd="termina"><button type="button" class="cop-dd__toggle" aria-haspopup="listbox" aria-expanded="false"><svg class="cop-dd__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg><span class="cop-dd__value">Seleccione...</span><svg class="cop-dd__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button><div class="cop-dd__menu" hidden></div></div><input type="time" id="termina" class="cop-dd__native" value="09:00"></div>
                        <div class="acta-form-group full-width"><label>Tema</label><input type="text" id="topic" value="Reunión del COPASST"></div>
                        <div class="acta-form-group full-width"><label>Lugar</label><input type="text" id="ciudad-lugar" value="Barranquilla, Oficinas Tempoactiva"></div>
                    </div>
                </section>
                <section class="acta-card">
                    <h2 class="acta-card-title">Agenda de la Reunión</h2>
                    <div id="agenda-list"></div>
                    <button class="acta-btn-add" id="add-agenda-btn">+ Agregar tema</button>
                </section>
                <section class="acta-card">
                    <h2 class="acta-card-title">Desarrollo y Compromisos</h2>
                    <div id="desarrollo-list"></div>
      <button class="acta-btn-add" id="add-desarrollo-btn">+ Agregar punto tratado</button>
      </section>
      </div>
        `;
        wrapper.appendChild(editorContainer);
        this.container.appendChild(wrapper);

        document.getElementById('btn-back-portal').onclick = () => this.render();
  document.getElementById('btn-auto-fill-header').onclick = () => this.handleAutoFill();

        const agendaList = document.getElementById('agenda-list');
        const desarrolloList = document.getElementById('desarrollo-list');

        const createAgendaItem = (data = {}) => {
            const div = document.createElement('div');
            div.className = 'acta-dynamic-item';
            div.innerHTML = `<div class="acta-form-grid">
                <div class="acta-form-group" style="grid-column: span 2"><label>Tema</label><input type="text" class="in-tema" value="${data.tema || ''}"></div>
                <div class="acta-form-group"><label>Duración</label><input type="text" class="in-duracion" value="${data.duracion || ''}"></div>
                <div class="acta-form-group"><label>Líder</label><input type="text" class="in-lider" value="${data.lider || ''}"></div>
            </div><button class="acta-btn-remove">✕</button>`;
            div.querySelector('.acta-btn-remove').onclick = () => div.remove();
            return div;
        };

const createDesarrolloItem = (data = {}) => {
const div = document.createElement('div');
div.className = 'acta-dynamic-item';
const temaValue = data.tema || '';
const temaRows = temaValue.includes('\n') ? Math.max(9, temaValue.split('\n').length + 2) : 9;
div.innerHTML = `<div class="acta-form-group"><label>Temas Tratados</label><textarea class="in-tema" rows="${temaRows}">${temaValue}</textarea></div>
<div class="acta-form-group"><label>Compromisos</label><textarea class="in-compromisos" rows="5">${data.compromisos || ''}</textarea></div>
<div class="acta-form-grid" style="margin-top:10px;">
<div class="acta-form-group"><label>Fecha</label><input type="date" class="in-fecha" value="${data.fecha || ''}"></div>
<div class="acta-form-group"><label>Responsable</label><input type="text" class="in-responsable" value="${data.responsable || ''}"></div>
</div><button class="acta-btn-remove">✕</button>`;
div.querySelector('.acta-btn-remove').onclick = () => div.remove();
return div;
};

        const initialAgenda = [{ tema: 'Revisión del acta anterior N° 107', duracion: '00:10 Minutos', lider: 'Representante del Copasst' }, { tema: 'Revisión de Accidentes del Mes de Diciembre', duracion: '00:10 Minutos', lider: 'Representante del Copasst' }, { tema: 'Revisión Avance del Plan de Trabajo Anual', duracion: '00:30 Minutos', lider: 'Representante del Copasst' }];
        const initialDesarrollo = [{ tema: 'Revisión del Acta Anterior, se continúan realizando las inspecciones programadas y están acorde, se continua desarrollando las actividades contempladas en el plan de trabajo anual.', compromisos: 'Ninguno', responsable: 'Miembros del Copasst' }, { tema: 'En el mes de [MES] [AÑO], No se presentaron accidentes laborales.', compromisos: 'Ninguno', responsable: 'Miembros del Copasst' }, { tema: 'Actividades del Plan de Trabajo ejecutadas en [MES]: [lista]. Observación: Pendientes por ejecutar: N actividades.', compromisos: 'Seguimiento actividades pendientes', responsable: 'Responsable del SG-SST' }, { tema: 'Se revisa el buzón de sugerencias y no se encuentran sugerencias.', compromisos: 'Ninguno', responsable: 'Representante del Copasst' }];

        initialAgenda.forEach(d => agendaList.appendChild(createAgendaItem(d)));
        initialDesarrollo.forEach(d => desarrolloList.appendChild(createDesarrolloItem(d)));
        document.getElementById('add-agenda-btn').onclick = () => agendaList.appendChild(createAgendaItem());
        document.getElementById('add-desarrollo-btn').onclick = () => desarrolloList.appendChild(createDesarrolloItem());
        // 📦1104 — Los 3 desplegables de fecha y hora se arman al final,
        // cuando el formulario ya esta en el DOM.
        this._initCopasstPickers();
      document.getElementById('btn-export-excel-header').onclick = () => this.handleExportExcel();
    }

    // ═════════════════════════════════════════════════════════════════
    // 📦1104 — Desplegables de FECHA y HORA del Generador de Actas.
    // Mismo lenguaje visual que el Formulario de Registro de ausentismo
    // (📦1101): el <input> nativo queda OCULTO como fuente de verdad y todo
    // lo que existia (handleExportExcel, prepareExcelChanges) sigue leyendo
    // los mismos IDs: fecha, inicia, termina.
    // ═════════════════════════════════════════════════════════════════

    /** Grilla del mes: 42 celdas (6 filas × 7 días), semana arrancando en
     *  lunes, con las celdas del mes vecino marcadas inMonth=false.
     *  Pura (sin this, sin DOM): por eso el test la ejecuta de verdad. */
    _buildMonthGrid(year, month) {
        const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const bisiesto = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        const diasDelMes = (month === 1 && bisiesto) ? 29 : DIAS_MES[month];
        const aIso = function (f) {
            const mm = String(f.getMonth() + 1).padStart(2, '0');
            const dd = String(f.getDate()).padStart(2, '0');
            return f.getFullYear() + '-' + mm + '-' + dd;
        };
        const offset = (new Date(year, month, 1).getDay() + 6) % 7;
        const celdas = [];
        for (let i = offset; i >= 1; i--) {
            const f = new Date(year, month, 1 - i);
            celdas.push({ iso: aIso(f), day: f.getDate(), inMonth: false });
        }
        for (let d = 1; d <= diasDelMes; d++) {
            celdas.push({ iso: aIso(new Date(year, month, d)), day: d, inMonth: true });
        }
        let siguiente = 1;
        while (celdas.length < 42) {
            celdas.push({ iso: aIso(new Date(year, month + 1, siguiente)), day: siguiente, inMonth: false });
            siguiente++;
        }
        return celdas;
    }

    /** Los horarios del dia en pasos de 15 minutos: 96 casillas (24 horas × 4).
     *  Pura (sin this, sin DOM): por eso el test la ejecuta de verdad. */
    _buildTimeSlots() {
        const slots = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                slots.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'));
            }
        }
        return slots;
    }

    /** Convierte los 3 campos nativos en desplegables. Se llama al final del
     *  setup del formulario. */
    _initCopasstPickers() {
        const self = this;
        const cont = document.querySelector('.copasst-actas-container');
        if (!cont) return;
        const dds = cont.querySelectorAll('.cop-dd');
        if (!dds.length) return;

        // Listeners globales de documento: se reemplazan en cada render para
        // no acumularlos (el modulo se vuelve a montar en cada visita)
        if (this._copDocClick) {
            document.removeEventListener('click', this._copDocClick);
            document.removeEventListener('keydown', this._copDocKey);
        }
        this._copDocClick = function (ev) {
            // Un clic DENTRO de un desplegable nunca lo cierra. Se revisa el
            // camino completo del evento (composedPath) y no solo el destino:
            // al repintar el menu (innerHTML) el boton pulsado queda
            // DESCONECTADO del documento.
            const dentro = (ev.composedPath ? ev.composedPath() : []).some(function (n) {
                return n && n.classList && n.classList.contains('cop-dd');
            }) || (ev.target && ev.target.closest && !!ev.target.closest('.cop-dd'));
            if (!dentro) self._cerrarTodosCop();
        };
        this._copDocKey = function (ev) {
            if (ev.key === 'Escape') self._cerrarTodosCop();
        };
        document.addEventListener('click', this._copDocClick);
        document.addEventListener('keydown', this._copDocKey);

        dds.forEach(dd => {
            const native = document.getElementById(dd.getAttribute('data-cop-dd'));
            const toggle = dd.querySelector('.cop-dd__toggle');
            const menu = dd.querySelector('.cop-dd__menu');
            if (!native || !toggle || !menu) return;
            const esFecha = native.type === 'date';
            const esHora = native.type === 'time';

            if (esFecha) {
                // Calendario: un solo listener delegado en el menu (sobrevive
                // a los repintados de _pintarCalendarioCop, que usa innerHTML)
                menu.addEventListener('click', function (ev) {
                    // Un clic dentro del calendario JAMAS debe cerrar el menu.
                    ev.stopPropagation();
                    const acc = ev.target.closest ? ev.target.closest('[data-cop-accion]') : null;
                    if (!acc) return;
                    const tipo = acc.getAttribute('data-cop-accion');
                    if (tipo === 'mes') {
                        const delta = parseInt(acc.getAttribute('data-cop-delta'), 10) || 0;
                        const vista = (dd.getAttribute('data-cop-view') || '').split('-');
                        const base = new Date(parseInt(vista[0], 10), parseInt(vista[1], 10) + delta, 1);
                        dd.setAttribute('data-cop-view', base.getFullYear() + '-' + base.getMonth());
                        self._pintarCalendarioCop(dd);
                    } else if (tipo === 'dia') {
                        const iso = acc.getAttribute('data-iso') || '';
                        native.value = iso;
                        // La vista queda en el mes del dia elegido: al reabrir
                        // el calendario se ve el mes donde esta la fecha.
                        const p = iso.split('-');
                        if (p.length === 3) dd.setAttribute('data-cop-view', p[0] + '-' + (parseInt(p[1], 10) - 1));
                        native.dispatchEvent(new Event('change', { bubbles: true }));
                        self._actualizarLabelCop(dd);
                        self._cerrarCop(dd);
                    } else if (tipo === 'hoy') {
                        const h = new Date();
                        native.value = h.getFullYear() + '-' +
                            String(h.getMonth() + 1).padStart(2, '0') + '-' +
                            String(h.getDate()).padStart(2, '0');
                        dd.setAttribute('data-cop-view', h.getFullYear() + '-' + h.getMonth());
                        native.dispatchEvent(new Event('change', { bubbles: true }));
                        self._actualizarLabelCop(dd);
                        self._cerrarCop(dd);
                    } else if (tipo === 'limpiar') {
                        native.value = '';
                        dd.removeAttribute('data-cop-view');
                        native.dispatchEvent(new Event('change', { bubbles: true }));
                        self._actualizarLabelCop(dd);
                        self._cerrarCop(dd);
                    }
                });
            } else if (esHora) {
                // Casillas de hora: un solo listener delegado en el menu
                menu.addEventListener('click', function (ev) {
                    ev.stopPropagation();
                    const acc = ev.target.closest ? ev.target.closest('[data-cop-accion]') : null;
                    if (!acc) return;
                    if (acc.getAttribute('data-cop-accion') !== 'hora') return;
                    const valor = acc.getAttribute('data-value') || '';
                    native.value = valor;
                    native.dispatchEvent(new Event('change', { bubbles: true }));
                    // 📦1104 — Si se movio la hora de INICIO y la de FIN quedo
                    // antes, el acta quedaria con una duracion negativa: la
                    // de FIN sigue a la de INICIO.
                    if (dd.getAttribute('data-cop-dd') === 'inicia') {
                        const termina = document.getElementById('termina');
                        if (termina && termina.value && termina.value < valor) {
                            termina.value = valor;
                            termina.dispatchEvent(new Event('change', { bubbles: true }));
                            const ddFin = cont.querySelector('.cop-dd[data-cop-dd="termina"]');
                            if (ddFin) self._actualizarLabelCop(ddFin);
                        }
                    }
                    self._actualizarLabelCop(dd);
                    self._cerrarCop(dd);
                });
            }

            toggle.addEventListener('click', function () {
                if (toggle.disabled) return;
                const abierto = !menu.hidden;
                self._cerrarTodosCop();
                if (!abierto) self._abrirCop(dd);
            });

            // El rotulo del campo tambien abre el desplegable
            const rotulo = cont.querySelector('label[for="' + native.id + '"]');
            if (rotulo) {
                rotulo.addEventListener('click', function (ev) {
                    if (toggle.disabled) return;
                    ev.preventDefault();
                    // Sin esto el clic burbujea a documento y el listener de
                    // "clic fuera" cierra el menu que acaba de abrirse
                    ev.stopPropagation();
                    const abierto = !menu.hidden;
                    self._cerrarTodosCop();
                    if (!abierto) self._abrirCop(dd);
                });
            }

            self._actualizarLabelCop(dd);
        });
    }

    _abrirCop(dd) {
        const menu = dd.querySelector('.cop-dd__menu');
        const toggle = dd.querySelector('.cop-dd__toggle');
        if (!menu || !toggle || !menu.hidden) return;
        if (dd.classList.contains('cop-dd--fecha')) {
            this._pintarCalendarioCop(dd);
        } else if (dd.classList.contains('cop-dd--hora')) {
            // 📦1104 — La hora de FIN no puede ser anterior a la de INICIO:
            // esas casillas quedan deshabilitadas.
            const esTermina = dd.getAttribute('data-cop-dd') === 'termina';
            const inicio = esTermina ? document.getElementById('inicia') : null;
            this._pintarHorasCop(dd, inicio && inicio.value ? inicio.value : null);
        }
        this._actualizarLabelCop(dd);
        menu.hidden = false;
        dd.classList.add('cop-dd--open');
        toggle.setAttribute('aria-expanded', 'true');
        // 📦1104 — Ya con medidas: la rejilla se centra en la hora actual
        if (dd.classList.contains('cop-dd--hora')) this._centrarHorasCop(dd);

        // El editor tiene scroll: si el menu no cabe hacia abajo se abre
        // hacia arriba; y si se pasa del borde derecho se ancla a la derecha
        const tRect = toggle.getBoundingClientRect();
        const mAlto = menu.offsetHeight;
        const scroller = dd.closest('.acta-editor-container');
        const sRect = scroller ? scroller.getBoundingClientRect() : null;
        const limiteAbajo = Math.min(sRect ? sRect.bottom : window.innerHeight, window.innerHeight);
        const limiteArriba = Math.max(sRect ? sRect.top : 0, 0);
        const cabeAbajo = (limiteAbajo - tRect.bottom) >= (mAlto + 8);
        const cabeArriba = (tRect.top - limiteArriba) >= (mAlto + 8);
        if (!cabeAbajo && cabeArriba) menu.classList.add('cop-dd__menu--up');
        else menu.classList.remove('cop-dd__menu--up');

        menu.style.left = '';
        menu.style.right = '';
        const limiteDerecha = Math.min(sRect ? sRect.right : window.innerWidth, window.innerWidth);
        if (tRect.left + menu.offsetWidth > limiteDerecha - 8) {
            menu.style.left = 'auto';
            menu.style.right = '0';
        }
    }

    _cerrarCop(dd) {
        const menu = dd.querySelector('.cop-dd__menu');
        const toggle = dd.querySelector('.cop-dd__toggle');
        if (menu) menu.hidden = true;
        dd.classList.remove('cop-dd--open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    _cerrarTodosCop() {
        const cont = document.querySelector('.copasst-actas-container');
        if (!cont) return;
        cont.querySelectorAll('.cop-dd').forEach(dd => this._cerrarCop(dd));
    }

    /** Escribe en el boton lo que vale el campo oculto (o "Seleccione..."
     *  si esta vacio) y marca en el menu la opcion elegida. */
    _actualizarLabelCop(dd) {
        const native = document.getElementById(dd.getAttribute('data-cop-dd'));
        const valor = dd.querySelector('.cop-dd__value');
        if (!native || !valor) return;
        let texto = '';
        if (native.type === 'date') {
            const p = (native.value || '').split('-');
            if (p.length === 3) texto = p[2] + '/' + p[1] + '/' + p[0];
        } else if (native.value) {
            // La hora se muestra en 24 h: es exactamente lo que va al Excel
            texto = native.value;
        }
        valor.textContent = texto || 'Seleccione...';
        dd.querySelectorAll('.cop-dd__option').forEach(op => {
            const activa = op.getAttribute('data-value') === (native.value || '');
            op.classList.toggle('cop-dd__option--active', activa);
        });
    }

    /** Re-sincroniza las etiquetas de los tres desplegables. Se llama cuando
     *  un valor cambia FUERA del desplegable (el autollenado cambia la fecha):
     *  sin esto el boton mostraria una fecha y el Excel llevaria otra. */
    _syncCopasstPickers() {
        const cont = document.querySelector('.copasst-actas-container');
        if (!cont) return;
        cont.querySelectorAll('.cop-dd').forEach(dd => this._actualizarLabelCop(dd));
    }

    /** Pinta el calendario del menu de la fecha: mes en curso, navegacion
     *  con chevrons, dia de hoy marcado y el dia elegido en azul. */
    _pintarCalendarioCop(dd) {
        const native = document.getElementById(dd.getAttribute('data-cop-dd'));
        const menu = dd.querySelector('.cop-dd__menu');
        if (!native || !menu) return;
        const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const hoy = new Date();
        const vista = (dd.getAttribute('data-cop-view') || '').split('-');
        let y = parseInt(vista[0], 10);
        let m = parseInt(vista[1], 10);
        if (isNaN(y) || isNaN(m)) {
            if (native.value) {
                const p = native.value.split('-');
                y = parseInt(p[0], 10);
                m = parseInt(p[1], 10) - 1;
            } else {
                y = hoy.getFullYear();
                m = hoy.getMonth();
            }
            dd.setAttribute('data-cop-view', y + '-' + m);
        }
        const isoHoy = hoy.getFullYear() + '-' +
            String(hoy.getMonth() + 1).padStart(2, '0') + '-' +
            String(hoy.getDate()).padStart(2, '0');
        const celdas = this._buildMonthGrid(y, m);
        let dias = '';
        celdas.forEach(c => {
            const clases = ['cop-cal__day'];
            if (!c.inMonth) clases.push('cop-cal__day--out');
            if (c.iso === native.value) clases.push('cop-cal__day--sel');
            if (c.iso === isoHoy) clases.push('cop-cal__day--today');
            dias += '<button type="button" class="' + clases.join(' ') +
                '" data-cop-accion="dia" data-iso="' + c.iso + '">' + c.day + '</button>';
        });
        menu.innerHTML =
            '<div class="cop-cal__head">' +
                '<button type="button" class="cop-cal__nav" data-cop-accion="mes" data-cop-delta="-1" aria-label="Mes anterior">&#8249;</button>' +
                '<span class="cop-cal__label">' + MESES[m] + ' ' + y + '</span>' +
                '<button type="button" class="cop-cal__nav" data-cop-accion="mes" data-cop-delta="1" aria-label="Mes siguiente">&#8250;</button>' +
            '</div>' +
            '<div class="cop-cal__week"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>' +
            '<div class="cop-cal__grid">' + dias + '</div>' +
            '<div class="cop-cal__foot">' +
                '<button type="button" class="cop-cal__btn" data-cop-accion="limpiar">Limpiar</button>' +
                '<button type="button" class="cop-cal__btn" data-cop-accion="hoy">Hoy</button>' +
            '</div>';
    }

    /** Pinta la rejilla de horarios del menu de una hora. Las casillas
     *  anteriores al limite (la hora de INICIO, en el caso de la hora de FIN)
     *  quedan deshabilitadas. El valor actual SIEMPRE queda alcanzable,
     *  aunque no caiga en la grilla de 15 minutos. */
    _pintarHorasCop(dd, limiteInferior) {
        const native = document.getElementById(dd.getAttribute('data-cop-dd'));
        const menu = dd.querySelector('.cop-dd__menu');
        if (!native || !menu) return;
        let slots = this._buildTimeSlots();
        if (native.value && slots.indexOf(native.value) === -1) {
            slots = [native.value].concat(slots);
        }
        let html = '<div class="cop-horas">';
        slots.forEach(s => {
            const bloqueada = !!(limiteInferior && s < limiteInferior);
            html += '<button type="button" class="cop-dd__option"' +
                ' data-cop-accion="hora" data-value="' + s + '"' +
                (bloqueada ? ' disabled' : '') + '>' + s + '</button>';
        });
        html += '</div>';
        menu.innerHTML = html;
    }

    /** 📦1104 — La rejilla de horarios arranca mostrando la hora que ya
     *  tiene el campo. Va DESPUES de abrir el menu: mientras esta oculto
     *  (display:none) no tiene medidas, y el scroll no aplicaba. */
    _centrarHorasCop(dd) {
        const menu = dd.querySelector('.cop-dd__menu');
        if (!menu) return;
        const grid = menu.querySelector('.cop-horas');
        const activa = grid ? grid.querySelector('.cop-dd__option--active') : null;
        if (!grid || !activa) return;
        grid.scrollTop = Math.max(0, (activa.offsetTop - grid.offsetTop) - (grid.clientHeight / 2) + (activa.offsetHeight / 2));
    }

    async handleAutoFill() {
    const btn = document.getElementById('btn-auto-fill-header');
    if (!btn) return;

    btn.classList.add('header-action--primary--loading');
    btn.disabled = true;

    try {
      const result = await window.electronAPI.getCopasstAutoFillData(this.currentCompany);

      if (!result || !result.success || !result.data) {
        // 📦824 FIX — Este helper NUNCA fue definido: la llamada reventaba con
        // "this._showAutoFillToast is not a function". El `finally` de abajo sí
        // liberaba el botón, pero el usuario se quedaba sin saber qué pasó.
        // Se usa el mismo toast que el resto del archivo (ver
        // generateCopasstActa más abajo).
        window.KAIRToast && window.KAIRToast.show('Error al obtener datos para autollenado', 'error');
        return;
      }

      const data = result.data;

      // Llenar sección: Información de la Reunión
      const actaNumberInput = document.getElementById('acta-number');
      const fechaInput = document.getElementById('fecha');
      const topicInput = document.getElementById('topic');

      if (actaNumberInput) actaNumberInput.value = data.nextActaNumber || 1;
      if (fechaInput) fechaInput.value = data.suggestedDate || new Date().toISOString().split('T')[0];
      // 📦1104 — El autollenado cambia la fecha FUERA del desplegable: sin
      // esto el boton mostraria la fecha vieja y el Excel llevaria la nueva.
      if (typeof this._syncCopasstPickers === 'function') this._syncCopasstPickers();
      if (topicInput) topicInput.value = `Reunión del COPASST - ${data.targetMonth || ''} ${data.targetYear || ''}`;

      // Llenar agenda: limpiar existente y agregar los items
      const agendaList = document.getElementById('agenda-list');
      if (agendaList && data.agenda && data.agenda.length > 0) {
        agendaList.innerHTML = '';
        data.agenda.forEach(item => {
          agendaList.appendChild(this._createAgendaItem(item));
        });
      }

      // Llenar desarrollo: limpiar existente y agregar los items
      const desarrolloList = document.getElementById('desarrollo-list');
      if (desarrolloList && data.desarrollo && data.desarrollo.length > 0) {
        desarrolloList.innerHTML = '';
        data.desarrollo.forEach(item => {
          desarrolloList.appendChild(this._createDesarrolloItem(item));
        });
      }

      // Mostrar toast de éxito
      let toastMsg = `Acta N°${data.nextActaNumber} — ${data.targetMonth} ${data.targetYear} autollenada`;
if (data.warnings && data.warnings.length > 0) {
				toastMsg += ` (${data.warnings.length} aviso(s))`;
				window.KAIRToast && window.KAIRToast.show(toastMsg, 'warning');
			} else {
				window.KAIRToast && window.KAIRToast.show(toastMsg, 'success');
			}

			// Scroll al inicio del formulario
			const editorContainer = this.container.querySelector('.acta-editor-container');
			if (editorContainer) editorContainer.scrollTo({ top: 0, behavior: 'smooth' });

		} catch (error) {
			window.KAIRToast && window.KAIRToast.show(`Error: ${error.message}`, 'error');
    } finally {
      btn.classList.remove('header-action--primary--loading');
      btn.disabled = false;
    }
  }

  _createAgendaItem(data = {}) {
    const div = document.createElement('div');
    div.className = 'acta-dynamic-item';
    div.innerHTML = `<div class="acta-form-grid">
      <div class="acta-form-group" style="grid-column: span 2"><label>Tema</label><input type="text" class="in-tema" value="${data.tema || ''}"></div>
      <div class="acta-form-group"><label>Duración</label><input type="text" class="in-duracion" value="${data.duracion || ''}"></div>
      <div class="acta-form-group"><label>Líder</label><input type="text" class="in-lider" value="${data.lider || ''}"></div>
    </div><button class="acta-btn-remove">✕</button>`;
    div.querySelector('.acta-btn-remove').onclick = () => div.remove();
    return div;
  }

_createDesarrolloItem(data = {}) {
    const div = document.createElement('div');
    div.className = 'acta-dynamic-item';
    const temaValue = data.tema || '';
    const temaRows = temaValue.includes('\n') ? Math.max(9, temaValue.split('\n').length + 2) : 9;
    div.innerHTML = `<div class="acta-form-group"><label>Temas Tratados</label><textarea class="in-tema" rows="${temaRows}">${temaValue}</textarea></div>
<div class="acta-form-group"><label>Compromisos</label><textarea class="in-compromisos" rows="5">${data.compromisos || ''}</textarea></div>
<div class="acta-form-grid" style="margin-top:10px;">
<div class="acta-form-group"><label>Fecha</label><input type="date" class="in-fecha" value="${data.fecha || ''}"></div>
<div class="acta-form-group"><label>Responsable</label><input type="text" class="in-responsable" value="${data.responsable || ''}"></div>
</div><button class="acta-btn-remove">✕</button>`;
    div.querySelector('.acta-btn-remove').onclick = () => div.remove();
return div;
	}

  async handleExportExcel() {
    const btn = document.getElementById('btn-export-excel-header');
    if (btn) {
      btn.classList.add('kair-header__action--success--loading');
      btn.disabled = true;
    }
    const data = {
            actaNumber: document.getElementById('acta-number').value,
            fecha: document.getElementById('fecha').value,
            inicia: document.getElementById('inicia').value,
            termina: document.getElementById('termina').value,
            topic: document.getElementById('topic').value,
            lugar: document.getElementById('ciudad-lugar').value,
            agendaItems: [], desarrolloItems: []
        };
        document.querySelectorAll('#agenda-list .acta-dynamic-item').forEach(item => {
            data.agendaItems.push({ tema: item.querySelector('.in-tema').value, duracion: item.querySelector('.in-duracion').value, lider: item.querySelector('.in-lider').value });
        });
        document.querySelectorAll('#desarrollo-list .acta-dynamic-item').forEach(item => {
            data.desarrolloItems.push({ tema: item.querySelector('.in-tema').value, compromisos: item.querySelector('.in-compromisos').value, fecha: item.querySelector('.in-fecha').value, responsable: item.querySelector('.in-responsable').value });
        });
    const changes = this.prepareExcelChanges(data);
    try {
const fechaParts = data.fecha ? data.fecha.split('-') : null;
const fechaYear = fechaParts ? parseInt(fechaParts[0], 10) : new Date().getFullYear();
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const fechaMonth = fechaParts ? MESES[parseInt(fechaParts[1], 10) - 1] : MESES[new Date().getMonth()];
      const saveInfo = await window.electronAPI.getCopasstSavePath(this.currentCompany, fechaYear, fechaMonth, data.actaNumber);
      const defaultPath = (saveInfo && saveInfo.success && saveInfo.data) ? saveInfo.data.defaultPath : `ACT-FO-029 Acta de Reunión Copasst ${fechaMonth}.xlsx`;
      const savePath = await window.electronAPI.showSaveDialog({ title: 'Guardar Acta de COPASST', defaultPath, filters: [{ name: 'Archivos de Excel', extensions: ['xlsx'] }] });
            if (!savePath) return;
            const result = await window.electronAPI.generateCopasstActa(changes, savePath);
if (result.success) window.KAIRToast&&window.KAIRToast.show('Acta generada exitosamente', 'success', { subtitle: result.documentPath });
			else window.KAIRToast&&window.KAIRToast.show('Error al generar acta', 'error', { subtitle: result.error });
    } catch (error) { window.KAIRToast&&window.KAIRToast.show('Error inesperado', 'error', { subtitle: error.message }); }
    finally {
      if (btn) {
        btn.classList.remove('kair-header__action--success--loading');
        btn.disabled = false;
      }
    }
  }

  prepareExcelChanges(data) {
    const changes = [];
    changes.push({ row: 4, col: 2, value: data.actaNumber }, { row: 5, col: 2, value: data.topic }, { row: 7, col: 2, value: data.fecha }, { row: 8, col: 2, value: data.lugar }, { row: 9, col: 2, value: data.inicia }, { row: 10, col: 2, value: data.termina });
    let row = 26;
    data.agendaItems.forEach(item => {
      changes.push({ row: row, col: 2, value: item.tema }, { row: row, col: 5, value: item.duracion }, { row: row, col: 7, value: item.lider });
      row++;
    });
    row += 5;
    data.desarrolloItems.forEach((item, idx) => {
      changes.push({ row: row, col: 1, value: idx + 1 }, { row: row, col: 2, value: item.tema }, { row: row, col: 4, value: item.compromisos }, { row: row, col: 6, value: item.fecha }, { row: row, col: 7, value: item.responsable });
      row++;
    });
    return changes;
  }

    updateHeaderContext() {
        const companyText = document.getElementById('header-company-text');
        if (companyText) {
            companyText.textContent = this.currentCompany || '—';
        }
    }

  destroy() {
    window.removeEventListener('message', this.handleIframeMessage);
    this.container.innerHTML = '';
  }
}

window.CopasstComponent = CopasstComponent;

