// comite-convivencia-logic.js - Componente para el submódulo "1.1.8 Conformación de Comite de Convivencia"
// UX/UI Pattern: Portal de Submódulo (K+AIR Standard)

class ComiteConvivenciaComponent {
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
    console.warn('[ComiteConvivenciaComponent] render() is deprecated. Use ComiteConvivenciaPortalComponent instead.');
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
        const viewerUrl = `modules/recursos/comite-convivencia/comite-convivencia-view.html?company=${encodeURIComponent(this.companyName)}&module=${encodeURIComponent(this.moduleName)}&submodule=${encodeURIComponent(this.submoduleName)}`;
        iframe.src = viewerUrl;
        this.container.appendChild(iframe);
    }

    handleIframeMessage(event) {
        if (!event.data || !event.data.type) return;
        if (event.data.type.endsWith('-request')) {
            const action = event.data.type.replace('-request', '');
            if (action === 'back-to-module') {
                window.removeEventListener('message', this.handleIframeMessage);
                this.render();
            } else {
                this.handleStandardRequest(event, this.getApiMap()[action]);
            }
        }
    }

    getApiMap() {
        return {
            'get-document-folders': 'getDocumentFolders',
            'get-documents-in-folder': 'getDocumentsInFolder',
            'get-pdf-preview': 'getPDFPreview',
            'get-word-preview': 'getWordPreview',
            'get-excel-preview': 'getExcelPreview',
            'download-document': 'downloadDocument'
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
                    fileName: result.fileName,
                    base64Data: result.base64Data,
                    error: result.error
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
        wrapper.className = 'convivencia-actas-container';
        wrapper.style.cssText = 'display:flex; flex-direction:column; height:100%; overflow:hidden;';

        const header = document.createElement('div');
        header.innerHTML = `
<div class="k-section-card" style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.25rem 1.5rem; margin-bottom:1.5rem; flex-shrink:0; flex-grow:0;">
  <div style="display:flex; align-items:center; gap:0.75rem;">
    <i class="fas fa-people-arrows" style="color:#174ea6; font-size:1.25rem;"></i>
    <div>
      <h3 style="font-size:1.125rem; font-weight:600; margin:0; color:#1E293B;">Generador de Actas Convivencia</h3>
      <p style="font-size:0.8125rem; color:#64748B; margin:0.25rem 0 0 0;">Formulario de creación de actas del comité de convivencia.</p>
    </div>
  </div>
  <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
    <span style="display:flex; align-items:center; gap:0.375rem; font-size:0.8125rem; color:#64748B;">
      <i class="fas fa-building" style="font-size:0.875rem;"></i>
      <span id="header-company-text">${this.currentCompany || '—'}</span>
    </span>
    <div style="width:1px; height:24px; background:#dee2e6;"></div>
    <button id="btn-back-portal" class="header-back-btn" title="Volver al Portal Comité de Convivencia">
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
.convivencia-actas-container .k-section-card {
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.05);
  overflow: hidden;
}

.convivencia-actas-container .header-back-btn {
  padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.8125rem;
  font-weight: 500; cursor: pointer; display: inline-flex; align-items: center;
  gap: 0.375rem; border: 1px solid #dee2e6; background-color: #f8f9fa;
  color: #6c757d; transition: all 0.2s; white-space: nowrap;
  font-family: 'Segoe UI', 'Roboto', sans-serif;
}
.convivencia-actas-container .header-back-btn:hover {
  background-color: #e2e8f0; color: #174ea6; border-color: #174ea6;
}
.convivencia-actas-container .header-back-btn:disabled {
  opacity: 0.3; cursor: not-allowed;
}
.convivencia-actas-container .header-back-btn:disabled:hover {
  background-color: #f8f9fa; color: #6c757d; border-color: #dee2e6;
}

.convivencia-actas-container .header-action--primary {
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0.5rem 1rem; font-size: 0.8125rem; font-weight: 500;
  color: #fff; background: #174ea6; border: 1px solid #174ea6;
  border-radius: 0.5rem; cursor: pointer; transition: background 0.15s ease;
  font-family: 'Segoe UI', 'Roboto', sans-serif; white-space: nowrap;
}
.convivencia-actas-container .header-action--primary:hover { background: #185abd; }
.convivencia-actas-container .header-action--primary:disabled { opacity: 0.6; cursor: not-allowed; }
.convivencia-actas-container .header-action--primary--loading {
  pointer-events: none; position: relative; color: transparent;
}
.convivencia-actas-container .header-action--primary--loading::after {
  content: ''; position: absolute; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: kair-spin 0.6s linear infinite;
  left: 50%; top: 50%; margin-left: -7px; margin-top: -7px;
}

.convivencia-actas-container .header-action--success {
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0.5rem 1rem; font-size: 0.8125rem; font-weight: 500;
  color: #fff; background: #28a745; border: 1px solid #28a745;
  border-radius: 0.5rem; cursor: pointer; transition: background 0.15s ease;
  font-family: 'Segoe UI', 'Roboto', sans-serif; white-space: nowrap;
}
.convivencia-actas-container .header-action--success:hover { background: #218838; }
.convivencia-actas-container .header-action--success:disabled { opacity: 0.6; cursor: not-allowed; }
.convivencia-actas-container .header-action--success--loading {
  pointer-events: none; position: relative; color: transparent;
}
.convivencia-actas-container .header-action--success--loading::after {
  content: ''; position: absolute; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: kair-spin 0.6s linear infinite;
  left: 50%; top: 50%; margin-left: -7px; margin-top: -7px;
}

@keyframes kair-spin { to { transform: rotate(360deg); } }

.convivencia-actas-container[data-theme="dark"] .k-section-card { background: var(--k-bg-card, #2d3748); border-color: var(--k-border, #4a5568); }
.convivencia-actas-container[data-theme="dark"] .header-back-btn { color: #adb5bd; border-color: var(--k-border, #4a5568); background-color: transparent; }
.convivencia-actas-container[data-theme="dark"] .header-back-btn:hover { background: rgba(77, 166, 255, 0.15); color: var(--k-primary, #4da6ff); }
.convivencia-actas-container[data-theme="dark"] .header-action--primary { background: var(--k-primary, #4da6ff); color: #1a1a2e; }
.convivencia-actas-container[data-theme="dark"] .header-action--primary:hover { background: var(--k-primary-hover, #6db8ff); }
.convivencia-actas-container[data-theme="dark"] .header-action--success { background: var(--k-success, #28a745); color: #1a1a2e; }
.convivencia-actas-container[data-theme="dark"] .header-action--success:hover { background: var(--k-success-hover, #34ce57); }

@media (max-width: 768px) {
    .convivencia-actas-container .k-section-card { flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem 1rem; }
    .convivencia-actas-container .k-section-card > div:last-child { width: 100%; justify-content: flex-end; }
}

:root { --primary-color: #206A5D; --primary-hover-color: #1A564B; --bg-color: #f8f9fa; --widget-bg-color: #ffffff; --border-color: #dee2e6; }
.acta-form-wrapper { font-family: 'Poppins', sans-serif; color: #212529; background: var(--bg-color); padding: 2rem 1.5rem; max-width: 1100px; margin: 0 auto; }
.acta-card { background: white; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.05); padding: 2rem; margin-bottom: 2rem; }
.acta-card-title { font-size: 1.5rem; font-weight: 600; margin-top: 0; margin-bottom: 1.5rem; color: #495057; border-bottom: 2px solid var(--primary-color); padding-bottom: 0.5rem; }
.acta-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
.acta-form-group { display: flex; flex-direction: column; }
.acta-form-group.full-width { grid-column: 1 / -1; }
.acta-form-group label { font-size: 0.9rem; font-weight: 500; color: #6c757d; margin-bottom: 0.5rem; }
.acta-form-group input, .acta-form-group textarea { padding: 0.5rem 0.75rem; border: 1px solid var(--border-color); border-radius: 4px; }
.acta-dynamic-item { background: #f8f9fa; border: 1px solid var(--border-color); border-radius: 6px; padding: 1.5rem; margin-bottom: 1rem; position: relative; }
.acta-btn-add { width: 100%; padding: 0.75rem; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
.acta-btn-remove { position: absolute; top: 10px; right: 10px; background: #dc3545; color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; }
`;
        wrapper.appendChild(style);

        editorContainer.innerHTML = `
            <div class="acta-form-wrapper">
                <section class="acta-card">
                    <h2 class="acta-card-title">Información de la Reunión</h2>
                    <div class="acta-form-grid">
                        <div class="acta-form-group"><label>N° de Acta</label><input type="number" id="acta-number" value="001"></div>
                        <div class="acta-form-group"><label>Fecha</label><input type="date" id="fecha" value="${new Date().toISOString().split('T')[0]}"></div>
                        <div class="acta-form-group"><label>Hora Inicio</label><input type="time" id="inicia" value="08:00"></div>
                        <div class="acta-form-group"><label>Hora Fin</label><input type="time" id="termina" value="09:00"></div>
                        <div class="acta-form-group full-width"><label>Tema</label><input type="text" id="topic" value="Reunión del Comité de Convivencia Laboral"></div>
                        <div class="acta-form-group full-width"><label>Lugar</label><input type="text" id="ciudad-lugar" value="Barranquilla, Oficinas"></div>
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
            div.innerHTML = `<div class="acta-form-group"><label>Temas Tratados</label><textarea class="in-tema" rows="4">${data.tema || ''}</textarea></div>
                <div class="acta-form-group"><label>Compromisos</label><textarea class="in-compromisos" rows="2">${data.compromisos || ''}</textarea></div>
                <div class="acta-form-grid" style="margin-top:10px;">
                    <div class="acta-form-group"><label>Fecha</label><input type="date" class="in-fecha" value="${data.fecha || ''}"></div>
                    <div class="acta-form-group"><label>Responsable</label><input type="text" class="in-responsable" value="${data.responsable || ''}"></div>
                </div><button class="acta-btn-remove">✕</button>`;
            div.querySelector('.acta-btn-remove').onclick = () => div.remove();
            return div;
        };

        const initialAgenda = [{ tema: 'Verificación del Quórum', duracion: '00:10 Minutos', lider: 'Representante del Comité' }, { tema: 'Saludos e inicio de reunión', duracion: '00:10 Minutos', lider: 'Representante del Comité' }, { tema: 'Programa de bienestar y Temas Varios', duracion: '00:30 Minutos', lider: 'Representante del Comité' }];
        const initialDesarrollo = [{ tema: 'Verificación del Quórum', compromisos: 'Ninguno', responsable: 'Presidente del Comité' }, { tema: 'Temas Varios: Se revisan la existencia de solicitudes...', compromisos: 'Solicitar a la profesional de la ARL...', responsable: 'Presidente del Comité' }];

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
 const result = await window.electronAPI.getConvivenciaAutoFillData(this.currentCompany);

 if (!result || !result.success || !result.data) {
 window.KAIRToast && window.KAIRToast.show('Error al obtener datos para autollenado', 'error');
 return;
 }

 const data = result.data;

 const actaNumberInput = document.getElementById('acta-number');
 const fechaInput = document.getElementById('fecha');
 const topicInput = document.getElementById('topic');

 if (actaNumberInput) actaNumberInput.value = data.nextActaNumber || 1;
 if (fechaInput) fechaInput.value = data.suggestedDate || new Date().toISOString().split('T')[0];
 if (topicInput) topicInput.value = `Reunión del Comité de Convivencia - ${data.targetMonth || ''} ${data.targetYear || ''}`;

 const agendaList = document.getElementById('agenda-list');
 if (agendaList && data.agenda && data.agenda.length > 0) {
 agendaList.innerHTML = '';
 data.agenda.forEach(item => {
 agendaList.appendChild(this._createAgendaItem(item));
 });
 }

 const desarrolloList = document.getElementById('desarrollo-list');
 if (desarrolloList && data.desarrollo && data.desarrollo.length > 0) {
 desarrolloList.innerHTML = '';
 data.desarrollo.forEach(item => {
 desarrolloList.appendChild(this._createDesarrolloItem(item));
 });
 }

 let toastMsg = `Acta N°${data.nextActaNumber} — ${data.targetMonth} ${data.targetYear} autollenada`;
 if (data.warnings && data.warnings.length > 0) {
 toastMsg += ` (${data.warnings.length} aviso(s))`;
 window.KAIRToast && window.KAIRToast.show(toastMsg, 'warning');
 } else {
 window.KAIRToast && window.KAIRToast.show(toastMsg, 'success');
 }

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
      btn.classList.add('header-action--success--loading');
      btn.disabled = true;
    }
    const data = {
 actaNumber: document.getElementById('acta-number').value,
 fecha: document.getElementById('fecha').value,
 inicia: document.getElementById('inicia').value,
 termina: document.getElementById('termina').value,
 topic: document.getElementById('topic').value,
 lugar: document.getElementById('ciudad-lugar').value,
 agendaItems: [],
 desarrolloItems: []
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
 const saveInfo = await window.electronAPI.getConvivenciaSavePath(this.currentCompany, fechaYear, fechaMonth);
 const defaultPath = (saveInfo && saveInfo.success && saveInfo.data) ? saveInfo.data.defaultPath : `GI-FO-029 ACTA DE REUNION CONVIVENCIA ${fechaMonth}.xlsx`;
 const savePath = await window.electronAPI.showSaveDialog({ title: 'Guardar Acta de Convivencia', defaultPath, filters: [{ name: 'Archivos de Excel', extensions: ['xlsx'] }] });
 if (!savePath) return;
 const result = await window.electronAPI.generateConvivenciaActa(changes, savePath);
 if (result.success) window.KAIRToast && window.KAIRToast.show('Acta generada exitosamente', 'success', { subtitle: result.documentPath });
 else window.KAIRToast && window.KAIRToast.show('Error al generar acta', 'error', { subtitle: result.error });
    } catch (error) { window.KAIRToast && window.KAIRToast.show('Error inesperado', 'error', { subtitle: error.message }); }
    finally {
      if (btn) {
        btn.classList.remove('header-action--success--loading');
        btn.disabled = false;
      }
    }
  }

    prepareExcelChanges(data) {
        const changes = [];
        changes.push({ row: 6, col: 4, value: data.actaNumber }, { row: 7, col: 4, value: data.topic }, { row: 9, col: 4, value: data.fecha }, { row: 10, col: 4, value: data.lugar }, { row: 11, col: 4, value: data.inicia }, { row: 12, col: 6, value: data.termina });
        let row = 26;
        data.agendaItems.forEach(item => {
            changes.push({ row: row, col: 3, value: item.tema }, { row: row, col: 5, value: item.duracion }, { row: row, col: 6, value: item.lider });
            row++;
        });
        row += 4;
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

window.ComiteConvivenciaComponent = ComiteConvivenciaComponent;