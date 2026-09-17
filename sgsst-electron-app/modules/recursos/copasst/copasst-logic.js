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
        const viewerUrl = `modules/recursos/copasst/copasst-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
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
    <div class="pres-header__icon" style="width:44px; height:44px; border-radius:12px; background:#e3ecfb; color:var(--kair-blue,#2057b8); display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
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
.copasst-actas-container .pres-header .header-back-btn {
  padding: 0.55rem 1rem; border-radius: 10px; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;
  border: 1px solid var(--kair-line, #e8ebee); background: #fff;
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
:root { --primary-color: var(--kair-blue, #2057b8); --primary-hover-color: #1a4ba0; --bg-color: var(--kair-canvas, #fbfcfb); --widget-bg-color: #ffffff; --border-color: var(--kair-line, #e8ebee); }
.acta-form-wrapper { font-family: var(--kair-font-ui, 'Segoe UI', 'Roboto', sans-serif); color: var(--kair-ink, #14213d); background: var(--bg-color); padding: 0.35rem 0.2rem 2rem; max-width: 1100px; margin: 0 auto; }
.acta-card { background: white; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 2px 7px rgba(37, 56, 82, 0.05); padding: clamp(18px, 2vw, 28px); margin-bottom: clamp(14px, 1.6vw, 22px); }
.acta-card-title { font: 700 clamp(15px, 1.4vw, 19px) var(--kair-font-display, 'Segoe UI'); letter-spacing: -0.03em; margin-top: 0; margin-bottom: 1.25rem; color: var(--kair-ink, #14213d); border-bottom: 0; padding-bottom: 0; display: flex; align-items: center; gap: 0.6rem; }
.acta-card-title::before { content: ''; width: 4px; height: 18px; border-radius: 4px; background: var(--kair-blue, #2057b8); flex-shrink: 0; }
.acta-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.25rem; }
.acta-form-group { display: flex; flex-direction: column; }
.acta-form-group.full-width { grid-column: 1 / -1; }
.acta-form-group label { font-size: 0.8125rem; font-weight: 600; color: var(--kair-muted, #748096); margin-bottom: 0.45rem; }
.acta-form-group input, .acta-form-group textarea {
  padding: 0.55rem 0.75rem; border: 1px solid var(--border-color); border-radius: 10px;
  font-family: inherit; font-size: 0.875rem; color: var(--kair-ink, #14213d);
  background: #fff; transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.acta-form-group input:focus, .acta-form-group textarea:focus {
  outline: none; border-color: var(--kair-blue, #2057b8);
  box-shadow: 0 0 0 3px rgba(32, 87, 184, 0.10);
}
.acta-dynamic-item { background: var(--kair-soft, #f3f6f6); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; position: relative; }
.acta-btn-add { width: 100%; padding: 0.75rem; background: #fff; color: var(--kair-blue, #2057b8); border: 1px dashed #c8d7ef; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 0.85rem; transition: all 0.18s; }
.acta-btn-add:hover { background: #eef4fd; border-color: var(--kair-blue, #2057b8); }
.acta-btn-remove { position: absolute; top: 10px; right: 10px; background: var(--kair-red, #da5563); color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; transition: all 0.15s; }
.acta-btn-remove:hover { transform: scale(1.08); }

@media (max-width: 768px) {
    .copasst-actas-container .pres-header { padding-bottom: 0.75rem; }
}

/* Modo oscuro — compatibilidad heredada */
.copasst-actas-container[data-theme="dark"] .pres-header h1 { color: #e2e8f0; }
.copasst-actas-container[data-theme="dark"] .pres-header__crumb { color: #8791a1; }
.copasst-actas-container[data-theme="dark"] .pres-header p { color: #a0aec0; }
.copasst-actas-container[data-theme="dark"] .pres-header .header-back-btn { color: #adb5bd; border-color: #4a5568; background: transparent; }
.copasst-actas-container[data-theme="dark"] .pres-header .header-back-btn:hover { background: rgba(77, 166, 255, 0.15); color: #4da6ff; }
.copasst-actas-container[data-theme="dark"] .acta-form-wrapper { background: transparent; }
.copasst-actas-container[data-theme="dark"] .acta-card { background: #2d3748; border-color: #4a5568; }
.copasst-actas-container[data-theme="dark"] .acta-card-title { color: #e2e8f0; }
.copasst-actas-container[data-theme="dark"] .acta-form-group label { color: #a0aec0; }
.copasst-actas-container[data-theme="dark"] .acta-form-group input,
.copasst-actas-container[data-theme="dark"] .acta-form-group textarea { background: #1a202c; border-color: #4a5568; color: #e2e8f0; }
.copasst-actas-container[data-theme="dark"] .acta-dynamic-item { background: #1a202c; border-color: #4a5568; }
.copasst-actas-container[data-theme="dark"] .acta-btn-add { background: transparent; color: #4da6ff; border-color: #4a5568; }
`;
        wrapper.appendChild(style);

        editorContainer.innerHTML = `
            <div class="acta-form-wrapper">
                <section class="acta-card">
                    <h2 class="acta-card-title">Información de la Reunión</h2>
                    <div class="acta-form-grid">
                        <div class="acta-form-group"><label>N° de Acta</label><input type="number" id="acta-number" value="108"></div>
                        <div class="acta-form-group"><label>Fecha</label><input type="date" id="fecha" value="${new Date().toISOString().split('T')[0]}"></div>
                        <div class="acta-form-group"><label>Hora Inicio</label><input type="time" id="inicia" value="08:00"></div>
                        <div class="acta-form-group"><label>Hora Fin</label><input type="time" id="termina" value="09:00"></div>
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
      document.getElementById('btn-export-excel-header').onclick = () => this.handleExportExcel();
    }

    async handleAutoFill() {
    const btn = document.getElementById('btn-auto-fill-header');
    if (!btn) return;

    btn.classList.add('header-action--primary--loading');
    btn.disabled = true;

    try {
      const result = await window.electronAPI.getCopasstAutoFillData(this.currentCompany);

      if (!result || !result.success || !result.data) {
        this._showAutoFillToast('Error al obtener datos para autollenado', 'error');
        return;
      }

      const data = result.data;

      // Llenar sección: Información de la Reunión
      const actaNumberInput = document.getElementById('acta-number');
      const fechaInput = document.getElementById('fecha');
      const topicInput = document.getElementById('topic');

      if (actaNumberInput) actaNumberInput.value = data.nextActaNumber || 1;
      if (fechaInput) fechaInput.value = data.suggestedDate || new Date().toISOString().split('T')[0];
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

