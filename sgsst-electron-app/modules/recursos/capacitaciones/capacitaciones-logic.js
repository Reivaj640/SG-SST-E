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
 this._modalInBody = null;
 this._confirmCallback = null;
 this._confirmModalInBody = null;
 this._isSaving = false;
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
    }

    initializeEventListeners() {
        // Navegación (Tabs)
    document.querySelectorAll('.kair-header__tab').forEach(item => {
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

        // Abrir modal en modo agregar
        const openAddModal = () => this.openModal('add');
        document.getElementById('btn-quick-add')?.addEventListener('click', openAddModal);
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

 this.setupConfirmModal();
    }

    switchView(viewId) {
    document.querySelectorAll('.kair-header__tab').forEach(el => {
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
  if (!modal) return;

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

  this._confirmCallback = onAccept || null;
  modal.classList.add('open');
  if (cancelBtn) cancelBtn.focus();
 }

 hideConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('open');
  this._confirmCallback = null;
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
            this.applyFilters();
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
        const total        = this.filteredCapacitaciones.length;
        const completed    = this.filteredCapacitaciones.filter(c => c.estado === 'completed').length;
        const pending      = this.filteredCapacitaciones.filter(c => c.estado === 'pending').length;
        const participants = this.filteredCapacitaciones.reduce((sum, c) => sum + (parseInt(c.participantes) || 0), 0);
        const progress     = total > 0 ? Math.round((completed / total) * 100) : 0;

        document.getElementById('stat-total').textContent         = total;
        document.getElementById('stat-completed').textContent     = completed;
        document.getElementById('stat-pending').textContent       = pending;
        document.getElementById('stat-participants').textContent  = participants;
        document.getElementById('stat-progress-text').textContent = `${progress}% Completitud`;
    }

    renderTable() {
        const tbody = document.getElementById('trainings-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.filteredCapacitaciones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--k-text-muted);">No se encontraron capacitaciones</td></tr>`;
            return;
        }

        this.filteredCapacitaciones.forEach(item => {
            const tr = document.createElement('tr');
            const badgeClass = item.estado === 'completed' ? 'k-badge-success' : 'k-badge-warning';
            const statusText = item.estado === 'completed' ? 'Completada' : 'Pendiente';
            const typeBadge  = item.tipo === 'sst' ? 'k-badge-primary' : 'k-badge-info';

            tr.innerHTML = `
                <td><strong>${item.nombre}</strong></td>
                <td><span class="k-badge ${typeBadge}">${item.tipo.toUpperCase()}</span></td>
			<td class="k-cell-date">${this.formatDate(item.fechaProgramada)}</td>
                <td>${item.instructor}</td>
                <td>${item.duracion}</td>
                <td><span class="k-badge ${badgeClass}">${statusText}</span></td>
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
        const duration     = document.getElementById('trainingDuration').value;
        const participants = parseInt(document.getElementById('trainingParticipants').value) || 0;

        if (!name || !newDate) {
            window.KAIRToast.show('Nombre y Fecha son obligatorios.', 'warning');
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
            duracion:      `${duration} Horas`,
            participantes: participants,
            estado:        'pending'
        };

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

    this.capacitaciones[index] = {
      ...this.capacitaciones[index],
      nombre: name,
      tipo: document.getElementById('trainingType').value,
      fechaProgramada: normalizedDate,
      instructor: document.getElementById('trainingInstructor').value,
      duracion: `${document.getElementById('trainingDuration').value} Horas`,
      participantes: parseInt(document.getElementById('trainingParticipants').value) || 0
    };

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
        const ctx = document.getElementById('trainingChart');
        if (!ctx) { console.warn('[CHART] Canvas no encontrado.'); return; }
        if (typeof Chart === 'undefined') { console.error('[CHART] Chart.js no cargado.'); return; }

        if (this.chartInstance) this.chartInstance.destroy();

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
                datasets: [
                    { label: 'Completadas', data: Array(12).fill(0), backgroundColor: '#174ea6', borderRadius: 4 },
                    { label: 'Programadas', data: Array(12).fill(0), backgroundColor: '#ffc107', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 200,
                scales: {
                    y: { beginAtZero: true, grid: { display: true, color: '#f0f0f0' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    updateCharts() {
        if (!this.chartInstance) return;

        const completedData = Array(12).fill(0);
        const pendingData   = Array(12).fill(0);

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

  // --- UTILIDADES ---

  formatDate(dateString) {
        if (!dateString || dateString === 'No especificada') return '-';
        const date = new Date(dateString.replace(/-/g, '/'));
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}

window.CapacitacionesComponent = CapacitacionesComponent;