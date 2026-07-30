// capacitaciones.js - Componente para la vista de administración de capacitaciones

class CapacitacionesComponent {
    constructor(container, currentCompany, moduleName, submoduleName, backToModuleCallback) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.backToModuleCallback = backToModuleCallback;
        this.currentView = 'dashboard';
        this.currentYear = new Date().getFullYear();
        this.capacitaciones = [];
        this.filteredCapacitaciones = [];
        this.excelFilePath = null;
        this.handleFileChange = null;
        this.availableSheets = [];
        this.chartInstance = null;
    this.typeChartInstance = null;
 this._modalInBody = null;
 this._confirmCallback = null;
 this._confirmModalInBody = null;
 this._isSaving = false;
 this._evidenciaCap = null;
 this._evidenciaFiles = [];
 this._evidenciasCache = new Map();
 this._evidenciaUploading = false;
 // Ubicaciones (NO viene del Excel, solo de la app) — persistidas en localStorage
 this._ubicaciones = this._loadUbicaciones();
 // 🆕 Horas (mismo patrón que ubicaciones) — persistidas en localStorage
 this._horas = this._loadHoras();
 // 📦 Fase 2 — Exponer el mapa de horas al global para que el adapter del
 // calendario (kair-calendar-adapter.js) pueda incluirlo como sidecar en
 // cada llamada a api.capacitaciones.getEvents. Mismo patrón que
 // `window.currentCapacitacionesComponent` (línea 81) y `window.kairDocPreview`.
 // Mantenemos un getter para que cambios en this._horas se reflejen en el
 // adapter sin re-asignar manualmente el global.
 Object.defineProperty(window, 'kairCapHoras', {
     get: () => this._horas,
     configurable: true
 });
    }

    /**
     * Carga el mapa {nombreCapacitacion: ubicacion} desde localStorage.
     * La key es estable: el nombre de la capacitación es único por hoja del Excel.
     */
    _loadUbicaciones() {
        try {
            const raw = localStorage.getItem('kair-cap-ubicaciones');
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            console.warn('[CAP] Error cargando ubicaciones de localStorage:', e);
            return {};
        }
    }

    /**
     * Persiste el mapa de ubicaciones en localStorage.
     */
    _saveUbicaciones() {
        try {
            localStorage.setItem('kair-cap-ubicaciones', JSON.stringify(this._ubicaciones || {}));
        } catch (e) {
            console.warn('[CAP] Error guardando ubicaciones en localStorage:', e);
        }
    }

    /**
     * Devuelve la ubicación guardada para una capacitación (por nombre).
     */
    _getUbicacion(nombre) {
        if (!nombre) return '';
        return (this._ubicaciones && this._ubicaciones[nombre]) || '';
    }

    /**
     * Guarda la ubicación de una capacitación (por nombre).
     */
    _setUbicacion(nombre, ubicacion) {
        if (!nombre) return;
        const val = (ubicacion || '').trim();
        if (val) {
            this._ubicaciones[nombre] = val;
        } else {
            delete this._ubicaciones[nombre];
        }
        this._saveUbicaciones();
    }

    // ════════════════════════════════════════════════════════════════════
    // 🆕 HORAS (Fase 1) — Mismo patrón que ubicaciones
    // Mapa {nombreCapacitacion: 'HH:MM'} persistido en localStorage.
    // ════════════════════════════════════════════════════════════════════
    _loadHoras() {
        try {
            const raw = localStorage.getItem('kair-cap-horas');
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (e) {
            console.warn('[CAP] Error cargando horas de localStorage:', e);
            return {};
        }
    }

    _saveHoras() {
        try {
            localStorage.setItem('kair-cap-horas', JSON.stringify(this._horas || {}));
        } catch (e) {
            console.warn('[CAP] Error guardando horas en localStorage:', e);
        }
    }

    _getHora(nombre) {
        if (!nombre) return '';
        return (this._horas && this._horas[nombre]) || '';
    }

    _setHora(nombre, hora) {
        if (!nombre) return;
        const val = (hora || '').trim();
        if (val) {
            this._horas[nombre] = val;
        } else {
            delete this._horas[nombre];
        }
        this._saveHoras();
    }

    // ════════════════════════════════════════════════════════════════════
    // 📦 Fase 3 — CONFLICT DETECTION
    // Detecta solapamientos de horario entre capacitaciones del mismo
    // día/empresa. No compara entre empresas (scope='all' puede mostrar
    // eventos simultáneos de distintas empresas, eso NO es conflicto).
    // ════════════════════════════════════════════════════════════════════
    _horaToMinutes(hora) {
        if (!hora || !/^\d{2}:\d{2}$/.test(hora)) return null;
        const [h, m] = hora.split(':').map(Number);
        return h * 60 + m;
    }

    /**
     * Devuelve array de capacitaciones (excluyendo excludeId) que se
     * solapan con la fecha+hora+duración dadas. Las que no tienen
     * `hora` no se cuentan (backward compat con legacy data).
     */
    _detectConflicts(fecha, hora, duracionHoras, excludeId = null) {
        if (!fecha || !hora) return [];
        const startMin = this._horaToMinutes(hora);
        if (startMin === null) return [];
        const durH = parseFloat(duracionHoras) || 0;
        const endMin = startMin + Math.round(durH * 60);

        return this.capacitaciones.filter(c => {
            if (excludeId && c.id === excludeId) return false;
            if (c.fechaProgramada !== fecha) return false;
            if (!c.hora) return false;
            const cStart = this._horaToMinutes(c.hora);
            if (cStart === null) return false;
            const cEnd = cStart + Math.round((parseFloat(c.duracion) || 0) * 60);
            // Solapan si los rangos [start, end) se cruzan
            return startMin < cEnd && cStart < endMin;
        });
    }

    /**
     * Devuelve las capacitaciones que NO tienen hora persistida.
     * Es la fuente del banner "X sin hora" que se muestra al cargar.
     */
    _getCapacitacionesSinHora() {
        return this.capacitaciones.filter(c => !c.hora);
    }

    render() {
        this.container.innerHTML = '';
        window.currentCapacitacionesComponent = this;
        this.container.classList.add('capacitaciones-container');

        fetch('./modules/recursos/capacitaciones/capacitaciones-view.html')
            .then(response => response.text())
            .then(html => {
                this.container.innerHTML = html;
                setTimeout(() => {
                    this.updateHeaderContext();
                    this.initializeEventListeners();
                    this.initializeComponent();
                    this.initializeCharts();

                    this.handleFileChange = () => {
                        if (this._isSaving) return;
                        window.KAIRToast.show('Archivo modificado externamente. Recargando...', 'info');
                        this.loadDataForYear(this.currentYear);
                    };
                    window.electronAPI.onIpcMessage('capacitaciones-file-changed', this.handleFileChange);

                    this.switchView('dashboard');

                    // ✏️ NUEVO — mover modal a document.body para garantizar
                    // position:fixed real contra el viewport, independiente de
                    // cualquier transform/will-change en ancestros del renderer.
                    this._mountModalToBody();
                }, 100);
            })
            .catch(error => {
                console.error('Error al cargar la interfaz:', error);
                this.container.innerHTML = `<div class="alert alert-danger">Error crítico: ${error.message}</div>`;
            });
    }

    // ✏️ NUEVO — monta el modal en document.body y copia las variables CSS del scope
    _mountModalToBody() {
        const modal = document.getElementById('trainingModal');
        if (!modal) {
            console.warn('[CapacitacionesComponent] Modal #trainingModal no encontrado.');
            return;
        }

        // Copiar variables CSS del contenedor scopeado al modal
        // para que funcionen correctamente fuera de .capacitaciones-container
        const computed = getComputedStyle(this.container);
        const cssVars = [
            '--k-primary', '--k-primary-hover', '--k-primary-light',
            '--k-success', '--k-success-light',
            '--k-warning', '--k-warning-light',
            '--k-danger',  '--k-danger-light',
            '--k-info',    '--k-info-light',
            '--k-bg-app',  '--k-bg-card', '--k-border',
            '--k-text-main', '--k-text-muted',
            '--k-radius-md', '--k-radius-lg',
            '--k-shadow-sm', '--k-shadow-md',
            '--k-font-family'
        ];

        cssVars.forEach(varName => {
            const value = computed.getPropertyValue(varName).trim();
            if (value) modal.style.setProperty(varName, value);
        });

 this._modalInBody = modal;
  document.body.appendChild(modal);

  const confirmModal = document.getElementById('confirmModal');
  if (confirmModal) {
   cssVars.forEach(varName => {
    const value = computed.getPropertyValue(varName).trim();
    if (value) confirmModal.style.setProperty(varName, value);
   });
   this._confirmModalInBody = confirmModal;
   document.body.appendChild(confirmModal);
  }

        console.log('[CapacitacionesComponent] Modal montado en document.body.');
    }

  updateHeaderContext() {
    const companyText = document.getElementById('header-company-text');
    if (companyText) {
      companyText.textContent = this.currentCompany || '—';
    }
  }

  updateTabBadge() {
    const badge = document.getElementById('badge-trainings');
    if (!badge) return;
    const pending = this.capacitaciones.filter(c => c.status === 'pending').length;
    if (pending > 0) {
      badge.textContent = pending;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

    destroy() {
        if (this.excelFilePath) {
            window.electronAPI.send('stop-watching-capacitaciones');
        }
        if (this.handleFileChange) {
            window.electronAPI.removeIpcMessageListener('capacitaciones-file-changed', this.handleFileChange);
        }
  if (this.chartInstance) {
    this.chartInstance.destroy();
  }
  if (this.typeChartInstance) {
    this.typeChartInstance.destroy();
  }
        // ✏️ NUEVO — remover modal del body al destruir el componente
        // evita que quede huérfano en el DOM si el usuario navega a otro módulo
 if (this._modalInBody && this._modalInBody.parentNode === document.body) {
  document.body.removeChild(this._modalInBody);
  this._modalInBody = null;
 }
 if (this._confirmModalInBody && this._confirmModalInBody.parentNode === document.body) {
  document.body.removeChild(this._confirmModalInBody);
  this._confirmModalInBody = null;
 }
 // Evidencias: cerrar modal y limpiar cache
 const evModal = document.getElementById('evidenciaModal');
 if (evModal && evModal.parentNode === document.body) {
   document.body.removeChild(evModal);
 }
 this._evidenciaCap = null;
 this._evidenciaFiles = [];
 this._evidenciasCache = new Map();
    }

    initializeEventListeners() {
        // Navegación (Tabs)
    document.querySelectorAll('.capacitaciones-tab').forEach(item => {
      item.addEventListener('click', () => {
        this.switchView(item.getAttribute('data-view'));
      });
    });

        // Botón Volver
        const backBtn = document.getElementById('btn-back-module');
        if (backBtn && this.backToModuleCallback) {
            backBtn.addEventListener('click', this.backToModuleCallback);
        }

        // Filtros
        const yearFilter = document.getElementById('yearFilter');
        if (yearFilter) {
            yearFilter.addEventListener('change', (e) => this.loadDataForYear(parseInt(e.target.value)));
        }
        ['typeFilter', 'statusFilter', 'monthFilter'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.applyFilters());
        });
        document.getElementById('btn-clear-filters')?.addEventListener('click', () => this.clearFilters());

  // Botones de Acción del Dashboard
  document.getElementById('btn-create-period')?.addEventListener('click', () => this.createNewPeriod());
  document.getElementById('btn-create-period-header')?.addEventListener('click', () => this.createNewPeriod());

  // Abrir modal en modo agregar
  const openAddModal = () => this.openModal('add');
  document.getElementById('btn-add-training')?.addEventListener('click', openAddModal);

 document.getElementById('btn-export-excel')?.addEventListener('click', () => this.exportToExcel());

 // Cerrar modales (funciona para el overlay único)
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = btn.closest('.k-modal-overlay');
                if (modal) modal.classList.remove('open');
            });
        });

        // Guardar (crea o actualiza según el estado del modal)
        document.getElementById('btn-save-training')?.addEventListener('click', () => this.saveTraining());

 this.setupEvidenciaModal();

 this.setupConfirmModal();
    }

    switchView(viewId) {
    document.querySelectorAll('.capacitaciones-tab').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-view') === viewId);
    });
        document.querySelectorAll('.k-view-section').forEach(el => el.classList.remove('active'));

        const targetSection = document.getElementById(`view-${viewId}`);
        if (targetSection) targetSection.classList.add('active');
        this.currentView = viewId;

        if (viewId === 'trainings') {
            this.renderTable();
        } else if (viewId === 'dashboard') {
            this.renderRecentList();
            setTimeout(() => this.updateCharts(), 50);
        }
    }

    openModal(type, id = null) {
        const modal        = document.getElementById('trainingModal');
        const modalTitle   = document.getElementById('modal-title');
        const modalIcon    = document.getElementById('modal-icon');
        const saveBtn      = document.getElementById('btn-save-training');
        const hiddenId     = document.getElementById('training-id');
        const form         = document.getElementById('trainingForm');

        if (!modal) return;

        if (type === 'add') {
            modalTitle.childNodes[modalTitle.childNodes.length - 1].textContent = ' Nueva Capacitación';
            modalIcon.className = 'bi bi-plus-circle';
            saveBtn.innerHTML   = '<i class="bi bi-check-lg"></i> Guardar';

            form.reset();
            hiddenId.value = '';

            const dateInput = document.getElementById('trainingDate');
            if (dateInput) dateInput.valueAsDate = new Date();

        } else if (type === 'edit') {
            const cap = this.capacitaciones.find(c => c.id === id);
            if (!cap) return;

            modalTitle.childNodes[modalTitle.childNodes.length - 1].textContent = ' Editar Capacitación';
            modalIcon.className = 'bi bi-pencil-square';
            saveBtn.innerHTML   = '<i class="bi bi-check-lg"></i> Actualizar';

            hiddenId.value = id;

            document.getElementById('trainingName').value         = cap.nombre;
            document.getElementById('trainingType').value         = cap.tipo;
            document.getElementById('trainingDate').value         = cap.fechaProgramada;
            document.getElementById('trainingDuration').value     = parseFloat(cap.duracion) || 2;
            document.getElementById('trainingInstructor').value   = cap.instructor;
            document.getElementById('trainingUbicacion').value   = cap.ubicacion || '';
            document.getElementById('trainingHora').value        = cap.hora      || '09:00';
            document.getElementById('trainingParticipants').value = cap.participantes || 0;
        }

        modal.classList.add('open');
    }

 closeModals() {
  document.querySelectorAll('.k-modal-overlay').forEach(el => el.classList.remove('open'));
 }

 setupConfirmModal() {
  const btnAccept = document.getElementById('btn-confirm-accept');
  const btnCancel = document.getElementById('btn-confirm-cancel');
  const confirmModal = document.getElementById('confirmModal');

  if (btnAccept) btnAccept.addEventListener('click', () => this.acceptConfirm());
  if (btnCancel) btnCancel.addEventListener('click', () => this.hideConfirmModal());
  if (confirmModal) {
   confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) this.hideConfirmModal();
   });
  }
  document.addEventListener('keydown', (e) => {
   if (e.key === 'Escape' && confirmModal?.classList.contains('open')) {
    this.hideConfirmModal();
   }
  });
 }

 showConfirmModal({ title, message, warning, acceptLabel, acceptIcon, onAccept }) {
  const modal = document.getElementById('confirmModal');
  if (!modal) return Promise.resolve(false);

  const titleEl = document.getElementById('confirm-title');
  const iconEl = document.getElementById('confirm-icon');
  const msgEl = document.getElementById('confirm-message');
  const warnEl = document.getElementById('confirm-warning');
  const labelEl = document.getElementById('confirm-accept-label');
  const acceptBtn = document.getElementById('btn-confirm-accept');
  const cancelBtn = document.getElementById('btn-confirm-cancel');

  if (title) titleEl.childNodes[titleEl.childNodes.length - 1].textContent = ` ${title}`;
  if (acceptIcon) iconEl.className = `bi ${acceptIcon}`;
  if (message) msgEl.textContent = message;
  if (warning) {
   warnEl.textContent = warning;
   warnEl.style.display = '';
  } else {
   warnEl.style.display = 'none';
  }
  if (acceptLabel) labelEl.textContent = acceptLabel;
  if (acceptIcon && acceptBtn) {
   const iconInBtn = acceptBtn.querySelector('i');
   if (iconInBtn) iconInBtn.className = `bi ${acceptIcon}`;
  }

  // 📦 Fase 3 — Devuelve Promise<boolean> (true=acepta, false=cancela)
  return new Promise((resolve) => {
      this._confirmCallback = () => {
          if (onAccept) onAccept();
          resolve(true);
      };
      this._confirmCancelCallback = () => resolve(false);
      modal.classList.add('open');
      if (cancelBtn) cancelBtn.focus();
  });
 }

 hideConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('open');
  // 📦 Fase 3 — Resolver la promise pendiente con false
  if (this._confirmCancelCallback) {
      this._confirmCancelCallback();
  }
  this._confirmCallback = null;
  this._confirmCancelCallback = null;
 }

 acceptConfirm() {
  const cb = this._confirmCallback;
  this.hideConfirmModal();
  if (cb) cb();
 }

    // --- LÓGICA DE DATOS ---

    async initializeComponent() {
        try {
            const submodulePathResult = await window.electronAPI.findSubmodulePath(
                this.currentCompany, this.moduleName, this.submoduleName
            );
            if (!submodulePathResult.success) throw new Error(submodulePathResult.error);
            const submodulePath = submodulePathResult.path;

            const filesResult = await window.electronAPI.readDirectory(submodulePath);
            if (!filesResult.success) throw new Error(filesResult.error);

            const allFiles = filesResult.files || [];

            const cronogramaFiles = allFiles.filter(item => {
                const name = (item.name || item.path || '').toLowerCase();
                return name.includes('cronograma') &&
                       (name.endsWith('.xlsx') || name.endsWith('.xls')) &&
                       !name.startsWith('~$');
            });

            console.log(`📋 [CapacitacionesLogic] Archivos con "cronograma": ${cronogramaFiles.length}`);

            const allExcelFiles = cronogramaFiles.length > 0
                ? cronogramaFiles.map(item => item.name || item.path)
                : allFiles.filter(item => {
                    const fileName = (item.name || item.path || '').toLowerCase();
                    return fileName.includes('act-fo-005') &&
                           (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) &&
                           !fileName.startsWith('~$');
                }).map(item => item.name || item.path);

            allExcelFiles.sort((a, b) => {
                const aX = a.toLowerCase().endsWith('.xlsx');
                const bX = b.toLowerCase().endsWith('.xlsx');
                if (aX && !bX) return -1;
                if (!aX && bX) return 1;
                return a.localeCompare(b);
            });

            if (allExcelFiles.length === 0) {
                window.KAIRToast.show('No se encontró archivo de capacitaciones.', 'info');
                return;
            }

            this.excelFilePath = `${submodulePath}/${allExcelFiles[0]}`;
            console.log(`✅ [CapacitacionesLogic] Archivo seleccionado: ${allExcelFiles[0]}`);

            window.electronAPI.send('start-watching-capacitaciones', this.excelFilePath);
            await this._populateYearFilterFromSheets();

        } catch (error) {
            console.error('Error init:', error);
            window.KAIRToast.show(`Error: ${error.message}`, 'danger');
        }
    }

    async _populateYearFilterFromSheets() {
        const yearFilter = document.getElementById('yearFilter');
        if (!yearFilter) return;

        const sheetsResult = await window.electronAPI.getCapacitacionesSheets(this.excelFilePath);
        if (!sheetsResult.success) {
            window.KAIRToast.show('Error al leer hojas del Excel.', 'warning');
            return;
        }

        this.availableSheets = sheetsResult.sheets.filter(s => s && typeof s === 'string');

        const years = [...new Set(
            this.availableSheets
                .map(s => { const m = s.match(/\d{4}/); return m ? parseInt(m[0]) : null; })
                .filter(y => y !== null && !isNaN(y))
        )].sort((a, b) => b - a);

        yearFilter.innerHTML = '';

        if (years.length === 0) {
            yearFilter.innerHTML = '<option value="">Sin años</option>';
            this.capacitaciones = [];
            this.applyFilters();
            return;
        }

        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearFilter.appendChild(option);
        });

        const currentYear = new Date().getFullYear();
        this.currentYear  = years.includes(currentYear) ? currentYear : years[0];
        yearFilter.value  = this.currentYear;

        if (this.currentYear) await this.loadDataForYear(this.currentYear);
    }

    async loadDataForYear(year) {
        this.currentYear = year;

        let sheetName = this.availableSheets.find(s =>
            s.trim().toLowerCase().includes('matriz cap.') && s.includes(year.toString())
        ) || this.availableSheets.find(s => s.includes(year.toString()));

        if (!sheetName) {
            window.KAIRToast.show(`No hay hoja para el año ${year}.`, 'warning');
            this.capacitaciones = [];
            this.applyFilters();
            return;
        }

        try {
            const excelResult = await window.electronAPI.initExcel({ filePath: this.excelFilePath, sheetName });
            if (!excelResult.success) throw new Error(excelResult.error);

            const { processedData, headers } = excelResult.data;
            this.capacitaciones = this.parseExcelDataToCapacitaciones(processedData, headers);
            // Enriquecer cada capacitación con su ubicación persistida en localStorage
            // (NO viene del Excel, es metadata local de la app)
            this.capacitaciones.forEach(cap => {
                if (cap && cap.nombre) {
                    cap.ubicacion = this._getUbicacion(cap.nombre);
                    cap.hora = this._getHora(cap.nombre);
                }
            });
            this.applyFilters();

            // 📦 Fase 3 — Banner de "capacitaciones sin hora" (legacy data).
            // Solo se muestra UNA VEZ al cargar el año. Es no-bloqueante.
            const sinHora = this._getCapacitacionesSinHora();
            if (sinHora.length > 0) {
                window.KAIRToast.show(
                    `${sinHora.length} capacitación(es) sin hora asignada. Editá cada una para que se vean correctamente en el calendario.`,
                    'warning',
                    { duration: 8000 }
                );
            }

            // Cargar el cache de evidencias en background (no bloquea la UI)
            this._loadAllEvidenciaCounts().then(() => {
              if (this.currentView === 'trainings') this.renderTable();
            }).catch(err => {
              console.warn('[EVIDENCIA] No se pudo pre-cargar cache de evidencias:', err);
            });

            window.KAIRToast.show(`Datos del ${year} cargados.`, 'success');

        } catch (error) {
            console.error('Error loadData:', error);
            window.KAIRToast.show(`Error al cargar: ${error.message}`, 'danger');
            this.capacitaciones = [];
            this.applyFilters();
        }
    }

    async auditExcelContent(year) {
        this.currentYear = year;

        let sheetName = this.availableSheets.find(s =>
            s.trim().toLowerCase().includes('matriz cap.') && s.includes(year.toString())
        ) || this.availableSheets.find(s => s.includes(year.toString()));

        if (!sheetName) {
            window.KAIRToast.show(`No hay hoja para el año ${year}.`, 'warning');
            return;
        }

        try {
            console.log('🔍 [AUDIT] Iniciando auditoría del Excel...');
            const auditResult = await window.electronAPI.auditExcelContent({
                filePath: this.excelFilePath,
                sheetName
            });

            if (!auditResult.success) throw new Error(auditResult.error);

            const { audit } = auditResult;
            console.group('📊 RESUMEN DE AUDITORÍA');
            console.log('Archivo:', audit.filePath);
            console.log('Hoja:', audit.sheetName);
            console.log('Total filas:', audit.totalRows);
            console.log('Fila de encabezados (índice):', audit.headerRowIndex);
            console.table(audit.sampleRows.slice(0, 5).map((row, idx) => ({
                'Fila': idx + 1, 'A': row[0], 'B': row[1], 'C': row[2],
                'D': row[3], 'G': row[6], 'H': row[7], 'I': row[8]
            })));
            console.groupEnd();

            window.KAIRToast.show('Auditoría completada. Revisa la consola (F12).', 'info');
            return audit;

        } catch (error) {
            console.error('❌ [AUDIT] Error en auditoría:', error);
            window.KAIRToast.show(`Error en auditoría: ${error.message}`, 'danger');
            return null;
        }
    }

    parseExcelDataToCapacitaciones(processedData, headers) {
        const capacitaciones = [];
        const dataRows = processedData.slice(5);

        let colNombre = 1, colFecha = 3, colEstado = 8, colInstructor = 6, colDuracion = 7;

        for (let i = 0; i < Math.min(5, processedData.length); i++) {
            const row = processedData[i];
            if (!Array.isArray(row)) continue;
            for (let j = 0; j < row.length; j++) {
                const cell = String(row[j] || '').toLowerCase();
                if (cell.includes('nombre') || cell.includes('capacitación')) colNombre = j;
                if (cell.includes('fecha') || cell.includes('programada') || cell.includes('date')) colFecha = j;
                if (cell.includes('estado') || cell.includes('indicador') || cell.includes('status')) colEstado = j;
                if (cell.includes('instructor') || cell.includes('facilitador') || cell.includes('trainer')) colInstructor = j;
                if (cell.includes('duración') || cell.includes('horas') || cell.includes('duration')) colDuracion = j;
            }
        }

        console.log(`📊 [CapacitacionesLogic] Columnas detectadas: Nombre=${colNombre}, Fecha=${colFecha}, Estado=${colEstado}, Instructor=${colInstructor}, Duracion=${colDuracion}`);

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!Array.isArray(row) || row.length < Math.max(colNombre, colFecha, colEstado)) continue;

            const getCellValue = (cell) => {
                if (cell === null || cell === undefined) return '';
                if (typeof cell === 'object' && cell.value !== undefined) return cell.value;
                return String(cell);
            };

            const nombre = String(getCellValue(row[colNombre]) || '').trim();
            if (!nombre || nombre.length < 3) continue;
            if (nombre.toLowerCase().includes('nombre de la') || nombre.toLowerCase().includes('contenido de la')) continue;
            if (nombre.toLowerCase().includes('total capacitaciones')) break;

            const tipoRaw = String(getCellValue(row[colNombre + 1] || row[2]) || 'sst');
            const tipo = tipoRaw.toLowerCase().includes('pyp') ? 'pyp' : 'sst';

            let fechaProgramada = 'No especificada';
            let fechaValue = getCellValue(row[colFecha]);

            if (!fechaValue || fechaValue === '') {
                for (let offset = -2; offset <= 2; offset++) {
                    const testCol = colFecha + offset;
                    if (testCol >= 0 && testCol < row.length) {
                        const testValue = getCellValue(row[testCol]);
                        if (testValue && testValue !== '') {
                            fechaValue = testValue;
                            colFecha = testCol;
                            break;
                        }
                    }
                }
            }

      if (fechaValue) {
        if (typeof fechaValue === 'number' && fechaValue >= 1) {
          const utcDate = new Date((fechaValue - 25569) * 86400 * 1000);
          const localDate = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
          fechaProgramada = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
        } else {
          const fechaStr = String(fechaValue).trim();
          let parsedDate = null;

          const dmyMatch = fechaStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmyMatch) {
            parsedDate = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
          }

          const isoMatch = fechaStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
          if (!parsedDate && isoMatch) {
            parsedDate = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
          }

          if (!parsedDate) {
            parsedDate = new Date(fechaStr);
          }

          if (parsedDate && !isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 1900) {
            fechaProgramada = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
          }
        }
      }

            const instructor  = String(getCellValue(row[colInstructor]) || 'No especificado');
            const duracionNum = parseFloat(String(getCellValue(row[colDuracion])));
            const duracion    = !isNaN(duracionNum) ? `${Math.floor(duracionNum)} Horas` : '0 Horas';

            const estadoRaw = getCellValue(row[colEstado]);
            const estadoStr = String(estadoRaw || '').toLowerCase().trim();
            const estado    = (
                estadoStr.includes('ejecutado') || estadoStr.includes('completado') ||
                estadoStr.includes('realizado') || estadoStr === '1' ||
                estadoStr === '3' || estadoStr === '4' ||
                estadoStr === '100' || estadoStr.includes('si') || estadoStr.includes('sí')
            ) ? 'completed' : 'pending';

            capacitaciones.push({
                id: capacitaciones.length + 1,
                rowIndex: i + 6,
                nombre, tipo, fechaProgramada, instructor, duracion, estado,
                participantes: 0
            });
        }

        console.log(`✅ [CapacitacionesLogic] ${capacitaciones.length} capacitaciones parseadas`);
        return capacitaciones;
    }

    applyFilters() {
        const typeFilter   = document.getElementById('typeFilter')?.value   || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const monthFilter  = document.getElementById('monthFilter')?.value  || '';

        let filtered = this.capacitaciones;
        if (typeFilter)   filtered = filtered.filter(c => c.tipo === typeFilter);
        if (statusFilter) filtered = filtered.filter(c => c.estado === statusFilter);
        if (monthFilter)  filtered = filtered.filter(c => {
            const f = new Date(c.fechaProgramada);
            return !isNaN(f.getTime()) && (f.getMonth() + 1) == monthFilter;
        });

    this.filteredCapacitaciones = filtered;
    this.updateDashboardStats();
    this.updateTabBadge();
    if (this.currentView === 'trainings') this.renderTable();
        this.renderRecentList();
        this.updateCharts();
    }

    clearFilters() {
        ['typeFilter', 'statusFilter', 'monthFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.applyFilters();
        window.KAIRToast.show('Filtros reseteados', 'info');
    }

    // --- RENDERIZADO UI ---

  updateDashboardStats() {
    const total = this.filteredCapacitaciones.length;
    const completed = this.filteredCapacitaciones.filter(c => c.estado === 'completed').length;
    const pending = this.filteredCapacitaciones.filter(c => c.estado === 'pending').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-completed').textContent = completed;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-participants').textContent = 'N/D';
    const progressEl = document.getElementById('stat-progress-text');
    if (progressEl) progressEl.textContent = `${progress}%`;
  }

    renderTable() {
        const tbody = document.getElementById('trainings-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.filteredCapacitaciones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--k-text-muted);">No se encontraron capacitaciones</td></tr>`;
            return;
        }

        this.filteredCapacitaciones.forEach(item => {
            const tr = document.createElement('tr');
            const badgeClass = item.estado === 'completed' ? 'k-badge-success' : 'k-badge-warning';
            const statusText = item.estado === 'completed' ? 'Completada' : 'Pendiente';
            const typeBadge  = item.tipo === 'sst' ? 'k-badge-primary' : 'k-badge-info';
            const evCount    = this._evidenciasCache.get(item.id) || 0;
            const hasEv      = evCount > 0;
            const evTooltip  = hasEv ? `${evCount} archivo${evCount === 1 ? '' : 's'} de evidencia` : 'Sin evidencia';

            // 📦 Fase 3 — Detectar conflicto de horario (mismo día + solapamiento)
            const conflicts = this._detectConflicts(
                item.fechaProgramada, item.hora,
                parseFloat(String(item.duracion || '').replace(/[^\d.]/g, '')) || 0,
                item.id  // excluir a sí mismo
            );
            const hasConflict = conflicts.length > 0;
            if (hasConflict) tr.classList.add('k-row-conflict');
            const conflictTitle = hasConflict
                ? `Conflicto con: ${conflicts.map(c => `"${c.nombre}" (${c.hora})`).join(', ')}`
                : '';

            tr.innerHTML = `
                <td><strong${hasConflict ? ` title="${conflictTitle}"` : ''}>${item.nombre}</strong></td>
                <td><span class="k-badge ${typeBadge}">${item.tipo.toUpperCase()}</span></td>
			<td class="k-cell-date">${this.formatDate(item.fechaProgramada)}</td>
                <td>${item.instructor}</td>
                <td>${item.ubicacion || ''}</td>
                <td>${item.duracion}</td>
                <td>${item.hora || '—'}</td>
                <td><span class="k-badge ${badgeClass}">${statusText}</span></td>
                <td class="text-center">
                  <button class="k-evidencia-btn ${hasEv ? 'has-files' : ''}"
                          data-id="${item.id}"
                          title="${evTooltip}"
                          aria-label="${evTooltip}">
                    <i class="bi bi-paperclip"></i>
                    ${hasEv ? `<span class="k-evidencia-btn-count">${evCount}</span>` : ''}
                  </button>
                </td>
			<td class="text-right k-cell-actions"><div class="k-cell-actions__inner">
          <button class="k-btn k-btn-outline k-btn-icon edit-btn" data-id="${item.id}" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          ${item.estado === 'pending' ? `
          <button class="k-btn k-btn-outline k-btn-icon complete-btn"
            style="color:var(--k-success);border-color:var(--k-success);"
            data-id="${item.id}" title="Marcar como Realizada">
            <i class="bi bi-check-lg"></i>
          </button>` : `
          <button class="k-btn k-btn-outline k-btn-icon revert-btn"
            style="color:var(--k-warning,#ffc107);border-color:var(--k-warning,#ffc107);"
            data-id="${item.id}" title="Revertir a Pendiente">
            <i class="bi bi-arrow-counterclockwise"></i>
          </button>`}
          <button class="k-btn k-btn-outline k-btn-icon delete-btn"
            style="color:var(--k-danger);border-color:var(--k-danger);"
            data-id="${item.id}" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        </td>
            `;
            tbody.appendChild(tr);
        });

    tbody.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', () => this.openModal('edit', parseInt(btn.dataset.id)))
    );
    tbody.querySelectorAll('.complete-btn').forEach(btn =>
      btn.addEventListener('click', () => this.completeTraining(parseInt(btn.dataset.id)))
    );
    tbody.querySelectorAll('.revert-btn').forEach(btn =>
      btn.addEventListener('click', () => this.revertTraining(parseInt(btn.dataset.id)))
    );
    tbody.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', () => this.deleteTraining(parseInt(btn.dataset.id)))
    );
    tbody.querySelectorAll('.k-evidencia-btn').forEach(btn =>
      btn.addEventListener('click', () => this.openEvidenciaModal(parseInt(btn.dataset.id)))
    );
    }

    renderRecentList() {
        const container = document.getElementById('recent-list');
        if (!container) return;

        const upcoming = this.filteredCapacitaciones
            .filter(d => d.estado === 'pending')
            .sort((a, b) => new Date(a.fechaProgramada) - new Date(b.fechaProgramada))
            .slice(0, 3);

        container.innerHTML = '';

        if (upcoming.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--k-text-muted);">No hay capacitaciones próximas</div>';
            return;
        }

        upcoming.forEach(item => {
            const div = document.createElement('div');
            div.className = 'k-recent-item';
            div.innerHTML = `
                <div>
                    <div class="k-recent-item-title">${item.nombre}</div>
                    <div class="k-recent-item-meta"><i class="bi bi-calendar3 me-1"></i>${this.formatDate(item.fechaProgramada)}</div>
                </div>
                <span class="k-badge k-badge-warning">Programada</span>
            `;
            container.appendChild(div);
        });
    }

    // --- ACCIONES DE ESCRITURA EN EXCEL ---

    async createNewPeriod() {
        if (!this.excelFilePath) {
            window.KAIRToast.show('Error: No hay archivo cargado.', 'warning');
            return;
        }

        const nextYear  = Math.max(...this.availableSheets.map(s => {
            const m = s.match(/\d{4}/);
            return m ? parseInt(m[0]) : 0;
        })) + 1;

 const baseSheet = this.availableSheets.find(s => s.includes((nextYear - 1).toString())) || this.availableSheets[0];

  this.showConfirmModal({
   title: 'Crear Nuevo Periodo',
   message: `¿Crear periodo ${nextYear} duplicando la hoja "${baseSheet}"?`,
   warning: 'Se creará una nueva hoja en el archivo Excel.',
   acceptLabel: 'Crear Periodo',
   acceptIcon: 'bi-calendar-plus',
   onAccept: async () => {
    window.KAIRToast.show(`Creando periodo ${nextYear}...`, 'info');
    try {
     const result = await window.electronAPI.duplicateCapacitacionesSheet({
      filePath: this.excelFilePath,
      currentSheetName: baseSheet,
      newYear: nextYear
     });

     if (!result?.success) throw new Error(result?.error || 'Error desconocido');

     window.KAIRToast.show(`Periodo ${nextYear} creado.`, 'success');

     const sheetsResult = await window.electronAPI.getCapacitacionesSheets(this.excelFilePath);
     if (sheetsResult.success) {
      this.availableSheets = sheetsResult.sheets.filter(s => typeof s === 'string');
      await this._populateYearFilterFromSheets();
      const yearFilter = document.getElementById('yearFilter');
      if (yearFilter) {
       yearFilter.value = nextYear;
       yearFilter.dispatchEvent(new Event('change'));
      }
     }
    } catch (error) {
     console.error('Error creating period:', error);
     window.KAIRToast.show(`Error: ${error.message}`, 'danger');
    }
   }
  });
  return;
    }

    async saveTraining() {
        const hiddenId = document.getElementById('training-id').value;

        // Routing: si hay ID guardado → actualizar; si no → crear
        if (hiddenId) {
            await this.updateTraining();
            return;
        }

        const name         = document.getElementById('trainingName').value.trim();
        const newDate      = document.getElementById('trainingDate').value;
        const type         = document.getElementById('trainingType').value;
        const instructor   = document.getElementById('trainingInstructor').value;
        const ubicacion    = document.getElementById('trainingUbicacion').value;
        const hora         = document.getElementById('trainingHora').value;
        const duration     = document.getElementById('trainingDuration').value;
        const participants = parseInt(document.getElementById('trainingParticipants').value) || 0;

        if (!name || !newDate) {
            window.KAIRToast.show('Nombre y Fecha son obligatorios.', 'warning');
            return;
        }
        if (!hora) {
            window.KAIRToast.show('La hora es obligatoria.', 'warning');
            return;
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
            window.KAIRToast.show('Formato de hora inválido (HH:MM).', 'warning');
            return;
        }
        if (hora < '06:00' || hora > '20:00') {
            window.KAIRToast.show('La hora debe estar entre 06:00 y 20:00.', 'warning');
            return;
        }

        let fechaProgramada = 'No especificada';
        const parsedDate    = new Date(newDate.replace(/-/g, '/'));
        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 1900) {
            fechaProgramada = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
        } else {
            window.KAIRToast.show('La fecha ingresada no es válida.', 'warning');
            return;
        }

        const newTraining = {
            id:            this.capacitaciones.length > 0 ? Math.max(...this.capacitaciones.map(c => c.id)) + 1 : 1,
            rowIndex:      this.capacitaciones.length > 0 ? Math.max(...this.capacitaciones.map(c => c.rowIndex)) + 1 : 6,
            nombre:        name,
            tipo:          type,
            fechaProgramada,
            instructor,
            ubicacion:     ubicacion,
            hora:          hora,
            duracion:      `${duration} Horas`,
            participantes: participants,
            estado:        'pending'
        };

        this._setUbicacion(name, ubicacion);
        this._setHora(name, hora);

        // 📦 Fase 3 — Detectar conflictos ANTES de persistir. Si hay solapamiento,
        // mostrar modal de confirmación. Si el user cancela, abortamos el guardado.
        const conflicts = this._detectConflicts(fechaProgramada, hora, parseFloat(duration) || 2);
        if (conflicts.length > 0) {
            const names = conflicts.map(c => `"${c.nombre}" (${c.hora})`).join(', ');
            const proceed = await this.showConfirmModal({
                title: 'Conflicto de horario',
                message: `Esta capacitación se solapa con: ${names}`,
                warning: '¿Deseás guardarla de todas formas?',
                acceptLabel: 'Guardar igual',
                acceptIcon: 'bi-exclamation-triangle',
            });
            if (!proceed) return;  // user canceló
        }

        this.capacitaciones.push(newTraining);
        this.closeModals();
        await this._saveDataToExcel();
        this.applyFilters();
        window.KAIRToast.show('Capacitación creada.', 'success');
    }

    async updateTraining() {
        const id    = parseInt(document.getElementById('training-id').value);
        if (!id) return;

        const index = this.capacitaciones.findIndex(c => c.id === id);
        if (index === -1) return;

        const name = document.getElementById('trainingName').value.trim();
        const date = document.getElementById('trainingDate').value;

        if (!name || !date) {
            window.KAIRToast.show('Nombre y Fecha son obligatorios.', 'warning');
            return;
        }

    const p = new Date(date.replace(/-/g, '/'));
    const normalizedDate = (!isNaN(p.getTime()) && p.getFullYear() >= 1900)
      ? `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`
      : date;

    const oldNombre = this.capacitaciones[index].nombre;
    const newUbicacion = document.getElementById('trainingUbicacion').value;
    const newHora      = document.getElementById('trainingHora').value;
    this.capacitaciones[index] = {
      ...this.capacitaciones[index],
      nombre: name,
      tipo: document.getElementById('trainingType').value,
      fechaProgramada: normalizedDate,
      instructor: document.getElementById('trainingInstructor').value,
      ubicacion: newUbicacion,
      hora: newHora,
      duracion: `${document.getElementById('trainingDuration').value} Horas`,
      participantes: parseInt(document.getElementById('trainingParticipants').value) || 0
    };
    // Si el nombre cambió, la key de la ubicación y hora también — migrar el valor
    if (oldNombre && oldNombre !== name) {
        this._setUbicacion(oldNombre, '');   // borrar la key vieja
        this._setHora(oldNombre, '');
    }
    this._setUbicacion(name, newUbicacion);   // guardar con la key nueva
    this._setHora(name, newHora);

    // 📦 Fase 3 — Detectar conflictos al editar (excluyendo esta misma capacitación)
    const conflictsUpdate = this._detectConflicts(
        normalizedDate, newHora,
        parseFloat(document.getElementById('trainingDuration').value) || 2,
        id
    );
    if (conflictsUpdate.length > 0) {
        const namesUpdate = conflictsUpdate.map(c => `"${c.nombre}" (${c.hora})`).join(', ');
        const proceedUpdate = await this.showConfirmModal({
            title: 'Conflicto de horario',
            message: `Esta capacitación se solapa con: ${namesUpdate}`,
            warning: '¿Deseás guardar los cambios de todas formas?',
            acceptLabel: 'Guardar igual',
            acceptIcon: 'bi-exclamation-triangle',
        });
        if (!proceedUpdate) return;  // user canceló
    }

        this.closeModals();
        await this._saveDataToExcel();
        this.applyFilters();
        window.KAIRToast.show('Capacitación actualizada.', 'success');
    }

    async completeTraining(id) {
        const index = this.capacitaciones.findIndex(c => c.id === id);
        if (index === -1) return;
        this.capacitaciones[index].estado = 'completed';
        await this._saveDataToExcel();
        this.applyFilters();
        window.KAIRToast.show('¡Capacitación completada!', 'success');
    }

  async revertTraining(id) {
    const index = this.capacitaciones.findIndex(c => c.id === id);
    if (index === -1) return;
    this.capacitaciones[index].estado = 'pending';
    await this._saveDataToExcel();
    this.applyFilters();
    window.KAIRToast.show('Capacitación revertida a Pendiente.', 'warning');
  }

 async deleteTraining(id) {
  const index = this.capacitaciones.findIndex(c => c.id === id);
  if (index === -1) return;
  const cap = this.capacitaciones[index];
  this.showConfirmModal({
   title: 'Eliminar Capacitación',
   message: `¿Eliminar la capacitación "${cap.nombre}"?`,
   warning: 'Esta acción no se puede deshacer.',
   acceptLabel: 'Eliminar',
   acceptIcon: 'bi-trash',
   onAccept: async () => {
    this.capacitaciones.splice(index, 1);
    this._setUbicacion(cap.nombre, '');  // limpiar ubicación persistida
    this._setHora(cap.nombre, '');       // limpiar hora persistida
    await this._saveDataToExcel();
    this.applyFilters();
    window.KAIRToast.show('Capacitación eliminada', 'success', { subtitle: `"${cap.nombre}" eliminada del registro` });
   }
  });
  return;
 }

    async _saveDataToExcel() {
        if (!this.excelFilePath) return;
        const sheetName = this.availableSheets.find(s => s.includes(this.currentYear.toString()));
        if (!sheetName) return;

        this._isSaving = true;
        try {
            const sorted = [...this.capacitaciones].sort((a, b) => a.rowIndex - b.rowIndex);
            window.KAIRToast.show('Guardando cambios en Excel...', 'info');

            const result = await window.electronAPI.updateCapacitacionesExcel({
                filePath: this.excelFilePath,
                capacitacionesData: sorted,
                sheetName,
                clearBeforeSave: true,
                startRow: 6
            });

            if (!result.success) throw new Error(result.error);

            await this.loadDataForYear(this.currentYear);
            window.KAIRToast.show('Guardado exitoso.', 'success');

        } catch (error) {
            console.error('Save error:', error);
            window.KAIRToast.show(`Error al guardar: ${error.message}`, 'danger');
        } finally {
            this._isSaving = false;
        }
    }

    exportToExcel() {
        window.KAIRToast.show('Exportando archivo... (Simulado)', 'info');
    }

  // --- GRÁFICOS ---

  initializeCharts() {
    const isDark = this.container.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#adb5bd' : '#6c757d';
    const gridColor = isDark ? '#3a3a4a' : '#f0f0f0';

    this.initializeTypeChart(isDark, textColor);
    this.initializeBarChart(isDark, textColor, gridColor);
  }

  initializeBarChart(isDark, textColor, gridColor) {
    const ctx = document.getElementById('trainingChart');
    if (!ctx) { console.warn('[CHART] trainingChart canvas no encontrado.'); return; }
    if (typeof Chart === 'undefined') { console.error('[CHART] Chart.js no cargado.'); return; }

    if (this.chartInstance) this.chartInstance.destroy();

    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
        datasets: [
          { label: 'Completadas', data: Array(12).fill(0), backgroundColor: '#174ea6', borderRadius: 4 },
          { label: 'Pendientes', data: Array(12).fill(0), backgroundColor: '#ffc107', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 200,
        scales: {
          y: { beginAtZero: true, grid: { display: true, color: gridColor }, ticks: { color: textColor } },
          x: { grid: { display: false }, ticks: { color: textColor } }
        },
        plugins: { legend: { position: 'bottom', labels: { color: textColor } } }
      }
    });
  }

  initializeTypeChart(isDark, textColor) {
    const ctx = document.getElementById('typeChart');
    if (!ctx) { console.warn('[CHART] typeChart canvas no encontrado.'); return; }
    if (typeof Chart === 'undefined') { console.error('[CHART] Chart.js no cargado.'); return; }

    if (this.typeChartInstance) this.typeChartInstance.destroy();

    const sstColor = '#174ea6';
    const pypColor = '#17a2b8';

    this.typeChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['SST', 'PYP'],
        datasets: [{
          data: [0, 0],
          backgroundColor: [sstColor, pypColor],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, padding: 16, usePointStyle: true, pointStyleWidth: 10 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.parsed;
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return ` ${context.label}: ${value} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  updateCharts() {
    if (this.chartInstance) {
      const completedData = Array(12).fill(0);
      const pendingData = Array(12).fill(0);

      this.filteredCapacitaciones.forEach(cap => {
        const date = new Date(cap.fechaProgramada);
        if (!isNaN(date.getTime())) {
          const month = date.getMonth();
          if (cap.estado === 'completed') completedData[month]++;
          else pendingData[month]++;
        }
      });

      this.chartInstance.data.datasets[0].data = completedData;
      this.chartInstance.data.datasets[1].data = pendingData;
      this.chartInstance.update();
    }

    this.updateTypeChart();
  }

  updateTypeChart() {
    if (!this.typeChartInstance) return;

    const sstCount = this.filteredCapacitaciones.filter(c => c.tipo === 'sst').length;
    const pypCount = this.filteredCapacitaciones.filter(c => c.tipo === 'pyp').length;

    this.typeChartInstance.data.datasets[0].data = [sstCount, pypCount];
        this.typeChartInstance.update();
    }

  // --- UTILIDADES ---

  // ===== GESTIÓN DE EVIDENCIAS =====

  setupEvidenciaModal() {
    // Cerrar modal
    document.querySelectorAll('[data-close-evidencia]').forEach(btn => {
      btn.addEventListener('click', () => this.closeEvidenciaModal());
    });

    // Click fuera del overlay cierra
    const overlay = document.getElementById('evidenciaModal');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeEvidenciaModal();
      });
    }

    // Esc cierra
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('evidenciaModal');
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
        this.closeEvidenciaModal();
      }
    });

    // File input change
    const fileInput = document.getElementById('evidenciaFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0 && this._evidenciaCap) {
          this._uploadEvidenciaFiles(this._evidenciaCap, files);
        }
        e.target.value = '';
      });
    }

    // Drag & drop
    const dropzone = document.getElementById('evidenciaDropzone');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('is-dragging');
        });
      });

      ['dragleave', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('is-dragging');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length > 0 && this._evidenciaCap) {
          this._uploadEvidenciaFiles(this._evidenciaCap, files);
        }
      });
    }
  }

  /**
   * Ruta de la carpeta del submódulo (donde está el Excel y donde vivirá
   * la carpeta de evidencias como hermana). Devuelve null si todavía no
   * hay archivo de Excel cargado.
   */
  _getEvidenciaSubmodulePath() {
    if (!this.excelFilePath) return null;
    const sep = this.excelFilePath.includes('\\') ? '\\' : '/';
    const lastSep = this.excelFilePath.lastIndexOf(sep);
    if (lastSep === -1) return null;
    return this.excelFilePath.substring(0, lastSep);
  }

  /**
   * Genera un nombre de carpeta estable para una capacitación:
   * cap-<id>-<slug-del-nombre>
   */
  _getCapFolderName(cap) {
    const slug = this._slugify(cap.nombre || `cap-${cap.id}`);
    return `cap-${cap.id}-${slug}`.substring(0, 60);
  }

  /**
   * Construye la ruta completa de la carpeta de evidencia de una cap
   * SIN crearla en disco. Usar _ensureEvidenciaFolders() antes de subir.
   */
  _getEvidenciaFolder(cap) {
    const submodule = this._getEvidenciaSubmodulePath();
    if (!submodule) return null;
    const sep = submodule.includes('\\') ? '\\' : '/';
    return submodule + sep + 'evidencias-capacitaciones' + sep + this._getCapFolderName(cap);
  }

  /**
   * Crea (si no existe) la carpeta `evidencias-capacitaciones/` y dentro la
   * carpeta de la cap. Devuelve la ruta final. Es idempotente: si las
   * carpetas ya existen, el backend responde success:true sin error.
   */
  async _ensureEvidenciaFolders(cap) {
    const submodule = this._getEvidenciaSubmodulePath();
    if (!submodule) throw new Error('No hay ruta del submódulo cargada');

    const submoduleFwd = submodule.replace(/\\/g, '/');

    // Nivel 1: evidencias-capacitaciones
    const baseResult = await window.electronAPI.createProviderFolder(
      submoduleFwd, 'evidencias-capacitaciones'
    );
    if (!baseResult || !baseResult.success) {
      throw new Error(`No se pudo crear carpeta base de evidencias: ${baseResult?.error || 'unknown'}`);
    }

    const basePath = (baseResult.path || '').replace(/\\/g, '/');

    // Nivel 2: evidencias-capacitaciones/<cap-X-...>
    const capResult = await window.electronAPI.createProviderFolder(
      basePath, this._getCapFolderName(cap)
    );
    if (!capResult || !capResult.success) {
      throw new Error(`No se pudo crear carpeta de la capacitación: ${capResult?.error || 'unknown'}`);
    }

    return capResult.path;
  }

  /**
   * Normaliza un string para usar como nombre de carpeta:
   * lowercase, sin acentos, sin caracteres especiales, kebab-case, max 40 chars.
   */
  _slugify(text) {
    return (text || '')
      .toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40) || 'cap';
  }

  _evidenciaIconClass(fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'is-pdf bi-file-earmark-pdf-fill';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'is-image bi-file-earmark-image';
    if (['doc', 'docx'].includes(ext)) return 'is-doc bi-file-earmark-word-fill';
    return 'bi-file-earmark';
  }

  _formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = bytes;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return v.toFixed(v < 10 && i > 0 ? 1 : 0) + ' ' + units[i];
  }

  /**
   * Cuenta archivos para TODAS las capacitaciones del año actual.
   * Cachea los resultados en this._evidenciasCache (id → count).
   * Si una carpeta no existe, cuenta 0.
   */
  async _loadAllEvidenciaCounts() {
    this._evidenciasCache = new Map();

    if (!this.excelFilePath) return;

    const submodule = this._getEvidenciaSubmodulePath();
    if (!submodule) return;

    const base = submodule + (submodule.includes('\\') ? '\\' : '/') + 'evidencias-capacitaciones';
    const sep = base.includes('\\') ? '\\' : '/';

    for (const cap of this.capacitaciones) {
      const folderName = this._getCapFolderName(cap);
      const folderPath = base + sep + folderName;

      try {
        const result = await window.electronAPI.listProviderFiles(folderPath);
        if (result && result.success && Array.isArray(result.files)) {
          this._evidenciasCache.set(cap.id, result.files.length);
        } else {
          this._evidenciasCache.set(cap.id, 0);
        }
      } catch (e) {
        this._evidenciasCache.set(cap.id, 0);
      }
    }
  }

  async openEvidenciaModal(capId) {
    const cap = this.capacitaciones.find(c => c.id === capId);
    if (!cap) {
      window.KAIRToast.show('Capacitación no encontrada', 'warning');
      return;
    }
    if (!this.excelFilePath) {
      window.KAIRToast.show('No hay archivo de Excel cargado', 'warning');
      return;
    }

    this._evidenciaCap = cap;
    this._evidenciaFiles = [];

    const modal = document.getElementById('evidenciaModal');
    const nameEl = document.getElementById('evidencia-cap-name');
    const countEl = document.getElementById('evidenciaCount');
    const listEl = document.getElementById('evidenciaList');

    if (!modal || !nameEl || !listEl) return;

    nameEl.textContent = cap.nombre;
    if (countEl) countEl.textContent = '...';

    listEl.innerHTML = `
      <div class="k-evidencia-empty">
        <i class="bi bi-hourglass-split"></i>
        Cargando archivos…
      </div>
    `;

    // Mover el modal al body para escapar de scope CSS (igual que trainingModal)
    if (modal.parentNode !== document.body) {
      const computed = getComputedStyle(this.container);
      const cssVars = [
        '--k-primary', '--k-primary-hover', '--k-primary-light',
        '--k-success', '--k-success-light',
        '--k-warning', '--k-warning-light',
        '--k-danger',  '--k-danger-light',
        '--k-info',    '--k-info-light',
        '--k-bg-app',  '--k-bg-card', '--k-border',
        '--k-text-main', '--k-text-muted',
        '--k-radius-md', '--k-radius-lg'
      ];
      cssVars.forEach(v => {
        const val = computed.getPropertyValue(v).trim();
        if (val) modal.style.setProperty(v, val);
      });
      document.body.appendChild(modal);
    }

    modal.classList.add('open');

    await this._loadEvidenciaFiles(cap);
  }

  closeEvidenciaModal() {
    const modal = document.getElementById('evidenciaModal');
    if (modal) modal.classList.remove('open');
    this._evidenciaCap = null;
    this._evidenciaFiles = [];
  }

  async _loadEvidenciaFiles(cap) {
    const folder = this._getEvidenciaFolder(cap);
    const listEl = document.getElementById('evidenciaList');
    const countEl = document.getElementById('evidenciaCount');
    if (!folder || !listEl) return;

    try {
      const result = await window.electronAPI.listProviderFiles(folder);
      const files = (result && result.success) ? result.files : [];

      this._evidenciaFiles = files;
      this._evidenciasCache.set(cap.id, files.length);

      if (countEl) countEl.textContent = files.length;

      if (files.length === 0) {
        listEl.innerHTML = `
          <div class="k-evidencia-empty">
            <i class="bi bi-inbox"></i>
            No hay archivos cargados todavía. Arrastrá un PDF o hacé clic en la zona de arriba.
          </div>
        `;
      } else {
        listEl.innerHTML = '';
        files.forEach(file => listEl.appendChild(this._renderEvidenciaItem(file, cap)));
      }

      // Si la tabla está visible, refrescar el badge
      if (this.currentView === 'trainings') this.renderTable();
    } catch (error) {
      console.error('[EVIDENCIA] Error listando archivos:', error);
      listEl.innerHTML = `
        <div class="k-evidencia-empty">
          <i class="bi bi-exclamation-triangle"></i>
          Error al listar los archivos.
        </div>
      `;
    }
  }

  _renderEvidenciaItem(file, cap) {
    const div = document.createElement('div');
    div.className = 'k-evidencia-item';

    const iconClass = this._evidenciaIconClass(file.name);
    const [cls, iconName] = iconClass.split(' ');

    const safeName = file.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const size = this._formatBytes(file.size);
    const modified = file.modified ? new Date(file.modified).toLocaleString('es-ES') : '';

    div.innerHTML = `
      <div class="k-evidencia-item-icon ${cls}">
        <i class="bi ${iconName}"></i>
      </div>
      <div class="k-evidencia-item-info">
        <div class="k-evidencia-item-name" title="${safeName}">${safeName}</div>
        <div class="k-evidencia-item-meta">${size}${modified ? ' · ' + modified : ''}</div>
      </div>
      <div class="k-evidencia-item-actions">
        <button class="k-btn k-btn-outline k-btn-icon ev-open-btn"
                data-name="${safeName.replace(/"/g, '&quot;')}"
                title="Abrir archivo">
          <i class="bi bi-box-arrow-up-right"></i>
        </button>
        <button class="k-btn k-btn-outline k-btn-icon ev-delete-btn"
                style="color:var(--k-danger);border-color:var(--k-danger);"
                data-name="${safeName.replace(/"/g, '&quot;')}"
                title="Eliminar archivo (a papelera)">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;

    div.querySelector('.ev-open-btn').addEventListener('click', () => {
      this._openEvidenciaFile(cap, file.name);
    });

    div.querySelector('.ev-delete-btn').addEventListener('click', () => {
      this._confirmDeleteEvidencia(cap, file.name);
    });

    return div;
  }

  _confirmDeleteEvidencia(cap, fileName) {
    this.showConfirmModal({
      title: 'Eliminar evidencia',
      message: `¿Eliminar "${fileName}"?`,
      warning: 'El archivo se moverá a la Papelera de Reciclaje de Windows (recuperable).',
      acceptLabel: 'Eliminar',
      acceptIcon: 'bi-trash',
      onAccept: () => this._removeEvidenciaFile(cap, fileName)
    });
  }

  async _uploadEvidenciaFiles(cap, files) {
    if (this._evidenciaUploading) {
      window.KAIRToast.show('Hay una subida en curso, esperá unos segundos', 'warning');
      return;
    }

    // Validar tipos MIME / extensiones
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx', 'webp', 'bmp'];
    const validFiles = files.filter(f => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      return allowedExts.includes(ext);
    });

    if (validFiles.length === 0) {
      window.KAIRToast.show('Ningún archivo tiene un formato permitido', 'warning');
      return;
    }
    if (validFiles.length !== files.length) {
      window.KAIRToast.show(`${files.length - validFiles.length} archivo(s) ignorado(s) por formato`, 'info');
    }

    let folder;
    try {
      // ✏️ FIX: el backend `copy-file-to-provider-folder` NO crea carpetas,
      // solo escribe. Hay que asegurar la existencia de la ruta primero.
      folder = await this._ensureEvidenciaFolders(cap);
    } catch (err) {
      console.error('[EVIDENCIA] Error creando carpetas:', err);
      window.KAIRToast.show(`No se pudo preparar la carpeta: ${err.message}`, 'danger');
      return;
    }

    if (!folder) {
      window.KAIRToast.show('No se pudo determinar la carpeta de evidencias', 'danger');
      return;
    }

    this._evidenciaUploading = true;
    const total = validFiles.length;
    let success = 0;
    let errors = 0;

    window.KAIRToast.show(`Subiendo ${total} archivo(s)…`, 'info');

    try {
      for (let i = 0; i < total; i++) {
        const file = validFiles[i];
        try {
          // Asegurar unicidad del nombre
          const finalName = await this._ensureUniqueName(folder, file.name);

          // Convertir a base64 (sin prefijo data:...)
          const base64 = await this._fileToBase64(file);

          const res = await window.electronAPI.copyFileToProviderFolder(
            base64, folder, finalName, file.type || ''
          );

          if (res && res.success) success++;
          else {
            errors++;
            console.error('[EVIDENCIA] Backend rechazó el archivo', file.name, res?.error);
          }
        } catch (err) {
          console.error('[EVIDENCIA] Error subiendo', file.name, err);
          errors++;
        }
      }

      if (success > 0) {
        window.KAIRToast.show(`${success} archivo(s) subido(s)${errors ? `, ${errors} con error` : ''}`, success === total ? 'success' : 'warning');
      } else if (errors > 0) {
        window.KAIRToast.show('No se pudo subir ningún archivo', 'danger');
      }

      await this._loadEvidenciaFiles(cap);
    } finally {
      this._evidenciaUploading = false;
    }
  }

  /**
   * Si ya existe `name` en `folder`, devuelve `name (2).ext`, `name (3).ext`, etc.
   */
  async _ensureUniqueName(folder, name) {
    try {
      const res = await window.electronAPI.listProviderFiles(folder);
      const existing = (res && res.success) ? new Set((res.files || []).map(f => f.name)) : new Set();
      if (!existing.has(name)) return name;

      const lastDot = name.lastIndexOf('.');
      const base = lastDot > 0 ? name.substring(0, lastDot) : name;
      const ext  = lastDot > 0 ? name.substring(lastDot) : '';

      let counter = 2;
      let candidate = `${base} (${counter})${ext}`;
      while (existing.has(candidate) && counter < 1000) {
        counter++;
        candidate = `${base} (${counter})${ext}`;
      }
      return candidate;
    } catch (e) {
      return name;
    }
  }

  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      // Mismo patrón que evaluacion-proveedores: arrayBuffer → bytes → btoa
      // (más robusto con archivos grandes que FileReader.readAsDataURL)
      file.arrayBuffer()
        .then(arrayBuffer => {
          try {
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            resolve(btoa(binary));
          } catch (err) {
            reject(err);
          }
        })
        .catch(reject);
    });
  }

  async _removeEvidenciaFile(cap, fileName) {
    const folder = this._getEvidenciaFolder(cap);
    if (!folder) return;

    const sep = folder.includes('\\') ? '\\' : '/';
    const fullPath = folder + sep + fileName;

    window.KAIRToast.show('Eliminando archivo…', 'info');

    try {
      // Reusar delete-document del main (usa shell.trashItem, amigable con Google Drive)
      const res = await window.electronAPI.deleteDocument(fullPath);
      if (res && res.success) {
        window.KAIRToast.show(`"${fileName}" movido a papelera`, 'success');
        await this._loadEvidenciaFiles(cap);
      } else {
        window.KAIRToast.show(`Error al eliminar: ${res?.error || 'desconocido'}`, 'danger');
      }
    } catch (err) {
      console.error('[EVIDENCIA] Error eliminando', fileName, err);
      window.KAIRToast.show('Error inesperado al eliminar', 'danger');
    }
  }

  async _openEvidenciaFile(cap, fileName) {
    const folder = this._getEvidenciaFolder(cap);
    if (!folder) return;
    const sep = folder.includes('\\') ? '\\' : '/';
    const fullPath = folder + sep + fileName;

    try {
      const res = await window.electronAPI.openFile(fullPath);
      if (res && !res.success) {
        window.KAIRToast.show(`No se pudo abrir: ${res.error || 'desconocido'}`, 'danger');
      }
    } catch (err) {
      console.error('[EVIDENCIA] Error abriendo', fileName, err);
      window.KAIRToast.show('Error al abrir el archivo', 'danger');
    }
  }

  // ===== FIN GESTIÓN DE EVIDENCIAS =====

  formatDate(dateString) {
        if (!dateString || dateString === 'No especificada') return '-';
        const date = new Date(dateString.replace(/-/g, '/'));
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}

window.CapacitacionesComponent = CapacitacionesComponent;