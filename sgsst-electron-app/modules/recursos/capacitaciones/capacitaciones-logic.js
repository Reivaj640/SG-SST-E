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
    }

    render() {
        this.container.innerHTML = '';
        window.currentCapacitacionesComponent = this;

        // Agregar clase contenedora específica (aunque el CSS lo maneja, por si acaso)
        this.container.classList.add('capacitaciones-container');

        // Cargar el HTML de la interfaz
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
                        this.showNotification('Archivo modificado externamente. Recargando...', 'info');
                        this.loadDataForYear(this.currentYear);
                    };
                    window.electronAPI.onIpcMessage('capacitaciones-file-changed', this.handleFileChange);

                    this.switchView('dashboard');
                }, 100);
            })
            .catch(error => {
                console.error('Error al cargar la interfaz:', error);
                this.container.innerHTML = `<div class="alert alert-danger">Error crítico: ${error.message}</div>`;
            });
    }

    updateHeaderContext() {
        const headerContext = document.getElementById('header-context-text');
        if (headerContext) {
            headerContext.textContent = `${this.currentCompany} / Recursos / Capacitaciones`;
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
    }

    initializeEventListeners() {
        // Navegación (Tabs)
        const navItems = document.querySelectorAll('.k-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const view = item.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Botón Volver
        const backBtn = document.getElementById('btn-back-module');
        if (backBtn && this.backToModuleCallback) {
            backBtn.addEventListener('click', this.backToModuleCallback);
        }

        // Filtros
        const yearFilter = document.getElementById('yearFilter');
        if(yearFilter) yearFilter.addEventListener('change', (e) => this.loadDataForYear(parseInt(e.target.value)));

        ['typeFilter', 'statusFilter', 'monthFilter'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', () => this.applyFilters());
        });
        
        document.getElementById('btn-clear-filters')?.addEventListener('click', () => this.clearFilters());

        // Botones de Acción
        document.getElementById('btn-create-period')?.addEventListener('click', () => this.createNewPeriod());
        
        // Modal Agregar
        const openAddModal = () => this.openModal('add');
        document.getElementById('btn-quick-add')?.addEventListener('click', openAddModal);
        document.getElementById('btn-add-training')?.addEventListener('click', openAddModal);
        
        document.getElementById('btn-export-excel')?.addEventListener('click', () => this.exportToExcel());

        // Modales (Cerrar)
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const modal = btn.closest('.k-modal-overlay');
                if (modal) modal.classList.remove('open');
            });
        });

        // Guardar / Actualizar
        document.getElementById('btn-save-training')?.addEventListener('click', () => this.saveTraining());
        document.getElementById('btn-update-training')?.addEventListener('click', () => this.updateTraining());
    }

    switchView(viewId) {
        // Actualizar Tabs
        document.querySelectorAll('.k-nav-item').forEach(el => {
            if (el.getAttribute('data-view') === viewId) el.classList.add('active');
            else el.classList.remove('active');
        });

        // Actualizar Secciones
        document.querySelectorAll('.k-view-section').forEach(el => el.classList.remove('active'));
        const targetSection = document.getElementById(`view-${viewId}`);
        if (targetSection) targetSection.classList.add('active');
        
        this.currentView = viewId;

        // Renderizado específico y redibujado de gráficos si es necesario
        if (viewId === 'trainings') {
            this.renderTable();
        } else if (viewId === 'dashboard') {
            this.renderRecentList();
            // Pequeño delay para asegurar que el canvas es visible antes de redibujar
            setTimeout(() => this.updateCharts(), 50); 
        }
    }

    openModal(type, id = null) {
        if (type === 'add') {
            const form = document.getElementById('trainingForm');
            if(form) form.reset();
            // Fecha por defecto hoy
            const dateInput = document.getElementById('trainingDate');
            if(dateInput) dateInput.valueAsDate = new Date();
            
            document.getElementById('addTrainingModal').classList.add('open');
        } else if (type === 'edit') {
            const cap = this.capacitaciones.find(c => c.id === id);
            if (!cap) return;

            // Llenar datos
            const nameInput = document.getElementById('editTrainingNameInput');
            // Usamos el hidden input para guardar el ID, manteniendo compatibilidad
            const hiddenId = document.getElementById('editTrainingName');
            if(hiddenId) hiddenId.setAttribute('data-id', id);
            
            if(nameInput) nameInput.value = cap.nombre;
            document.getElementById('editTrainingType').value = cap.tipo;
            document.getElementById('editTrainingDate').value = cap.fechaProgramada;
            
            // Parsear duración (eliminar " Horas")
            const durationVal = parseFloat(cap.duracion) || 2;
            document.getElementById('editTrainingDuration').value = durationVal;
            
            document.getElementById('editTrainingInstructor').value = cap.instructor;
            document.getElementById('editTrainingParticipants').value = cap.participantes || 0;

            document.getElementById('editTrainingModal').classList.add('open');
        }
    }

    closeModals() {
        document.querySelectorAll('.k-modal-overlay').forEach(el => el.classList.remove('open'));
    }

    // --- LÓGICA DE DATOS ---

    async initializeComponent() {
        try {
            const submodulePathResult = await window.electronAPI.findSubmodulePath(this.currentCompany, this.moduleName, this.submoduleName);
            if (!submodulePathResult.success) throw new Error(submodulePathResult.error);
            const submodulePath = submodulePathResult.path;

            const filesResult = await window.electronAPI.readDirectory(submodulePath);
            if (!filesResult.success) throw new Error(filesResult.error);

            // Filtrar archivos Excel de capacitaciones
            const allExcelFiles = (filesResult.files || []).filter(item => {
                const fileName = (item.name || item.path || '').toLowerCase();
                return fileName.includes('act-fo-005') &&
                       (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) &&
                       !fileName.startsWith('~$');
            }).map(item => item.name || item.path);

            // Ordenar: .xlsx preferido
            allExcelFiles.sort((a, b) => {
                const aIsXlsx = a.toLowerCase().endsWith('.xlsx');
                const bIsXlsx = b.toLowerCase().endsWith('.xlsx');
                if (aIsXlsx && !bIsXlsx) return -1;
                if (!aIsXlsx && bIsXlsx) return 1;
                return a.localeCompare(b);
            });

            if (allExcelFiles.length === 0) {
                this.showNotification('No se encontró archivo "ACT-FO-005".', 'info');
                return;
            }

            this.excelFilePath = `${submodulePath}/${allExcelFiles[0]}`;
            window.electronAPI.send('start-watching-capacitaciones', this.excelFilePath);
            await this._populateYearFilterFromSheets();

        } catch (error) {
            console.error('Error init:', error);
            this.showNotification(`Error: ${error.message}`, 'danger');
        }
    }

    async _populateYearFilterFromSheets() {
        const yearFilter = document.getElementById('yearFilter');
        if (!yearFilter) return;

        const sheetsResult = await window.electronAPI.getCapacitacionesSheets(this.excelFilePath);
        if (!sheetsResult.success) {
            this.showNotification('Error al leer hojas del Excel.', 'warning');
            return;
        }

        this.availableSheets = sheetsResult.sheets.filter(sheet => sheet && typeof sheet === 'string');

        // Extraer años de los nombres de hojas
        const years = [...new Set(this.availableSheets
            .map(sheetName => {
                const match = sheetName.match(/\d{4}/);
                return match ? parseInt(match[0]) : null;
            })
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

        // Seleccionar año actual o el más reciente
        const currentYear = new Date().getFullYear();
        if (years.includes(currentYear)) {
            yearFilter.value = currentYear;
            this.currentYear = currentYear;
        } else {
            this.currentYear = years[0];
            yearFilter.value = years[0];
        }

        if (this.currentYear) {
            await this.loadDataForYear(this.currentYear);
        }
    }

    async loadDataForYear(year) {
        this.currentYear = year;

        // Lógica robusta para encontrar la hoja
        let sheetName = this.availableSheets.find(s =>
            s.trim().toLowerCase().includes(`matriz cap.`) && s.includes(year.toString())
        ) || this.availableSheets.find(s => s.includes(year.toString()));

        if (!sheetName) {
            this.showNotification(`No hay hoja para el año ${year}.`, 'warning');
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
            this.showNotification(`Datos del ${year} cargados.`, 'success');
        } catch (error) {
             console.error('Error loadData:', error);
            this.showNotification(`Error al cargar: ${error.message}`, 'danger');
            this.capacitaciones = [];
            this.applyFilters();
        }
    }

    // 📊 MÉTODO DE AUDITORÍA QUIRÚRGICA - Para depurar contenido de Excel
    async auditExcelContent(year) {
        this.currentYear = year;

        let sheetName = this.availableSheets.find(s =>
            s.trim().toLowerCase().includes(`matriz cap.`) && s.includes(year.toString())
        ) || this.availableSheets.find(s => s.includes(year.toString()));

        if (!sheetName) {
            this.showNotification(`No hay hoja para el año ${year}.`, 'warning');
            return;
        }

        try {
            console.log('🔍 [AUDIT] Iniciando auditoría del Excel...');
            const auditResult = await window.electronAPI.auditExcelContent({
                filePath: this.excelFilePath,
                sheetName: sheetName
            });

            if (!auditResult.success) {
                throw new Error(auditResult.error);
            }

            const { audit } = auditResult;
            console.log('✅ [AUDIT] Auditoría completada:', audit);

            // Mostrar resumen en consola
            console.group('📊 RESUMEN DE AUDITORÍA');
            console.log('Archivo:', audit.filePath);
            console.log('Hoja:', audit.sheetName);
            console.log('Total filas:', audit.totalRows);
            console.log('Fila de encabezados (índice):', audit.headerRowIndex);
            console.log('Muestra de filas (primeras 5):');
            console.table(audit.sampleRows.slice(0, 5).map((row, idx) => {
                return {
                    'Fila': idx + 1,
                    'A': row[0],
                    'B': row[1],
                    'C': row[2],
                    'D': row[3],
                    'G': row[6],
                    'H': row[7],
                    'I': row[8]
                };
            }));
            console.groupEnd();

            this.showNotification('Auditoría completada. Revisa la consola (F12) para ver los detalles.', 'info');
            return audit;

        } catch (error) {
            console.error('❌ [AUDIT] Error en auditoría:', error);
            this.showNotification(`Error en auditoría: ${error.message}`, 'danger');
            return null;
        }
    }

    parseExcelDataToCapacitaciones(processedData, headers) {
        const capacitaciones = [];
        const dataRows = processedData.slice(5); // Datos empiezan en fila 6 (índice 5)

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (!Array.isArray(row) || row.length < 9) continue;

            const getCellValue = (cell) => {
                if (cell === null || cell === undefined) return '';
                if (typeof cell === 'object' && cell.value !== undefined) return cell.value;
                return String(cell);
            };

            const nombreRaw = getCellValue(row[1]);
            const nombre = String(nombreRaw || '').trim();

            if (!nombre || nombre === 'Nombre de la capacitación' || nombre === '') continue;
            if (nombre.toLowerCase().includes('total capacitaciones')) break;

            const tipoRaw = String(getCellValue(row[2]) || 'sst');
            let tipo = tipoRaw.toLowerCase().includes('pyp') ? 'pyp' : 'sst';

            // Fecha
            let fechaProgramada = 'No especificada';
            const fechaValue = getCellValue(row[3]);
            if (fechaValue) {
                if (typeof fechaValue === 'number' && fechaValue >= 1) {
                    const utcDate = new Date((fechaValue - 25569) * 86400 * 1000);
                    const localDate = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
                    fechaProgramada = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                } else {
                    const fechaStr = String(fechaValue);
                    let parsedDate = new Date(fechaStr);
                    if (isNaN(parsedDate.getTime())) {
                        const parts = fechaStr.split('/');
                        if (parts.length === 3) parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 1900) {
                        fechaProgramada = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
                    }
                }
            }

            const instructor = String(getCellValue(row[6]) || 'No especificado');
            const duracionNum = parseFloat(String(getCellValue(row[7])));
            const duracion = !isNaN(duracionNum) ? `${Math.floor(duracionNum)} Horas` : '0 Horas';

            const estadoStr = String(getCellValue(row[8]) || '');
            let estado = (estadoStr.toLowerCase().includes('ejecutado') || estadoStr.toLowerCase().includes('completado')) ? 'completed' : 'pending';

            capacitaciones.push({
                id: capacitaciones.length + 1,
                rowIndex: i + 6,
                nombre, tipo, fechaProgramada, instructor, duracion, estado,
                participantes: 0 
            });
        }
        return capacitaciones;
    }

    applyFilters() {
        const typeFilter = document.getElementById('typeFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const monthFilter = document.getElementById('monthFilter')?.value || '';

        let filtered = this.capacitaciones;

        if (typeFilter) filtered = filtered.filter(cap => cap.tipo === typeFilter);
        if (statusFilter) filtered = filtered.filter(cap => cap.estado === statusFilter);
        if (monthFilter) {
            filtered = filtered.filter(cap => {
                const fecha = new Date(cap.fechaProgramada);
                return !isNaN(fecha.getTime()) && (fecha.getMonth() + 1) == monthFilter;
            });
        }

        this.filteredCapacitaciones = filtered;
        
        // Actualizar todas las secciones dependientes de datos
        this.updateDashboardStats();
        if (this.currentView === 'trainings') this.renderTable();
        this.renderRecentList(); 
        this.updateCharts();
    }

    clearFilters() {
        if(document.getElementById('typeFilter')) document.getElementById('typeFilter').value = '';
        if(document.getElementById('statusFilter')) document.getElementById('statusFilter').value = '';
        if(document.getElementById('monthFilter')) document.getElementById('monthFilter').value = '';
        this.applyFilters();
        this.showNotification('Filtros reseteados', 'info');
    }

    // --- RENDERIZADO UI ---

    updateDashboardStats() {
        const total = this.filteredCapacitaciones.length;
        const completed = this.filteredCapacitaciones.filter(c => c.estado === 'completed').length;
        const pending = this.filteredCapacitaciones.filter(c => c.estado === 'pending').length;
        const participants = this.filteredCapacitaciones.reduce((sum, c) => sum + (parseInt(c.participantes) || 0), 0);
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-completed').textContent = completed;
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-participants').textContent = participants;
        document.getElementById('stat-progress-text').textContent = `${progress}% Completitud`;
    }

    renderTable() {
        const tbody = document.getElementById('trainings-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.filteredCapacitaciones.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--k-text-muted);">No se encontraron capacitaciones</td></tr>`;
            return;
        }

        this.filteredCapacitaciones.forEach(item => {
            const tr = document.createElement('tr');
            const badgeClass = item.estado === 'completed' ? 'k-badge-success' : 'k-badge-warning';
            const statusText = item.estado === 'completed' ? 'Completada' : 'Pendiente';
            const typeBadge = item.tipo === 'sst' ? 'k-badge-primary' : 'k-badge-info';
            
            tr.innerHTML = `
                <td><strong>${item.nombre}</strong></td>
                <td><span class="k-badge ${typeBadge}">${item.tipo.toUpperCase()}</span></td>
                <td>${this.formatDate(item.fechaProgramada)}</td>
                <td>${item.instructor}</td>
                <td>${item.duracion}</td>
                <td><span class="k-badge ${badgeClass}">${statusText}</span></td>
                <td class="text-right">
                    <button class="k-btn k-btn-outline k-btn-icon edit-btn" data-id="${item.id}" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    ${item.estado === 'pending' ? `
                    <button class="k-btn k-btn-outline k-btn-icon complete-btn" style="color: var(--k-success); border-color: var(--k-success);" data-id="${item.id}" title="Marcar como Realizada">
                        <i class="bi bi-check-lg"></i>
                    </button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Eventos de tabla
        tbody.querySelectorAll('.edit-btn').forEach(btn => 
            btn.addEventListener('click', (e) => this.openModal('edit', parseInt(btn.dataset.id)))
        );
        tbody.querySelectorAll('.complete-btn').forEach(btn => 
            btn.addEventListener('click', (e) => this.completeTraining(parseInt(btn.dataset.id)))
        );
    }

    renderRecentList() {
        const container = document.getElementById('recent-list');
        if (!container) return;

        // Mostrar próximas pendientes
        const upcoming = this.filteredCapacitaciones
            .filter(d => d.estado === 'pending')
            .sort((a, b) => new Date(a.fechaProgramada) - new Date(b.fechaProgramada))
            .slice(0, 3); 

        container.innerHTML = '';
        
        if (upcoming.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding: 1rem; color: var(--k-text-muted);">No hay capacitaciones próximas</div>';
            return;
        }

        upcoming.forEach(item => {
            const div = document.createElement('div');
            div.className = 'k-recent-item';
            div.innerHTML = `
                <div>
                    <div style="font-weight: 600; font-size: 0.9rem;">${item.nombre}</div>
                    <div style="font-size: 0.8rem; color: var(--k-text-muted);"><i class="bi bi-calendar3 me-1"></i> ${this.formatDate(item.fechaProgramada)}</div>
                </div>
                <span class="k-badge k-badge-warning">Programada</span>
            `;
            container.appendChild(div);
        });
    }

    // --- ACCIONES DE ESCRITURA EN EXCEL ---

    async createNewPeriod() {
        if (!this.excelFilePath) {
            this.showNotification('Error: No hay archivo cargado.', 'warning');
            return;
        }
        
        // Calcular siguiente año disponible
        const nextYear = Math.max(...this.availableSheets.map(s => {
            const m = s.match(/\d{4}/);
            return m ? parseInt(m[0]) : 0;
        })) + 1;
        
        const baseSheet = this.availableSheets.find(s => s.includes((nextYear - 1).toString())) || this.availableSheets[0];

        if (!confirm(`¿Crear periodo ${nextYear} duplicando la hoja "${baseSheet}"?`)) return;

        this.showNotification(`Creando periodo ${nextYear}...`, 'info');

        try {
            const result = await window.electronAPI.duplicateCapacitacionesSheet({
                filePath: this.excelFilePath,
                currentSheetName: baseSheet,
                newYear: nextYear
            });

            if (!result || !result.success) throw new Error(result.error || 'Error desconocido');

            this.showNotification(`Periodo ${nextYear} creado.`, 'success');
            
            // Recargar
            const sheetsResult = await window.electronAPI.getCapacitacionesSheets(this.excelFilePath);
            if (sheetsResult.success) {
                this.availableSheets = sheetsResult.sheets.filter(s => typeof s === 'string');
                await this._populateYearFilterFromSheets();
                // Ir al nuevo año
                const yearFilter = document.getElementById('yearFilter');
                if (yearFilter) {
                    yearFilter.value = nextYear;
                    yearFilter.dispatchEvent(new Event('change'));
                }
            }

        } catch (error) {
            console.error('Error creating period:', error);
            this.showNotification(`Error: ${error.message}`, 'danger');
        }
    }

    async saveTraining() {
        const name = document.getElementById('trainingName').value;
        const type = document.getElementById('trainingType').value;
        const instructor = document.getElementById('trainingInstructor').value;
        const duration = document.getElementById('trainingDuration').value;

        // Validar la fecha antes de guardar (Restaurado del backup)
        const newDate = document.getElementById('trainingDate').value;
        let fechaProgramada = 'No especificada';

        if (newDate && newDate !== '') {
            const parsedDate = new Date(newDate.replace(/-/g, '/'));
            if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 1900) {
                const year = parsedDate.getFullYear();
                const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const day = String(parsedDate.getDate()).padStart(2, '0');
                fechaProgramada = `${year}-${month}-${day}`;
            } else {
                this.showNotification('La fecha ingresada no es válida.', 'warning');
                return;
            }
        }

        if (!name || !newDate) {
            this.showNotification('Nombre y Fecha son obligatorios.', 'warning');
            return;
        }

        const newTraining = {
            id: this.capacitaciones.length > 0 ? Math.max(...this.capacitaciones.map(c => c.id)) + 1 : 1,
            rowIndex: this.capacitaciones.length > 0 ? Math.max(...this.capacitaciones.map(c => c.rowIndex)) + 1 : 6,
            nombre: name,
            tipo: type,
            fechaProgramada: fechaProgramada, 
            instructor: instructor,
            duracion: `${duration} Horas`,
            participantes: 0,
            estado: 'pending'
        };

        this.capacitaciones.push(newTraining);
        this.closeModals();
        await this._saveDataToExcel();
        this.applyFilters();
        this.showNotification('Capacitación creada.', 'success');
    }

    async updateTraining() {
        const id = parseInt(document.getElementById('editTrainingName').getAttribute('data-id'));
        if (!id) return;

        const index = this.capacitaciones.findIndex(c => c.id === id);
        if (index === -1) return;

        const nameInput = document.getElementById('editTrainingNameInput');
        if (!nameInput.value || !document.getElementById('editTrainingDate').value) {
            this.showNotification('Nombre y Fecha son obligatorios.', 'warning');
            return;
        }

        this.capacitaciones[index] = {
            ...this.capacitaciones[index],
            nombre: nameInput.value,
            tipo: document.getElementById('editTrainingType').value,
            fechaProgramada: document.getElementById('editTrainingDate').value,
            instructor: document.getElementById('editTrainingInstructor').value,
            duracion: `${document.getElementById('editTrainingDuration').value} Horas`,
            participantes: parseInt(document.getElementById('editTrainingParticipants').value) || 0
        };

        this.closeModals();
        await this._saveDataToExcel();
        this.applyFilters();
        this.showNotification('Capacitación actualizada.', 'success');
    }

    async completeTraining(id) {
        const index = this.capacitaciones.findIndex(c => c.id === id);
        if (index === -1) return;

        this.capacitaciones[index].estado = 'completed';
        await this._saveDataToExcel();
        this.applyFilters();
        this.showNotification('¡Capacitación completada!', 'success');
    }

    async _saveDataToExcel() {
        if (!this.excelFilePath) return;
        
        const sheetName = this.availableSheets.find(s => s.includes(this.currentYear.toString()));
        if (!sheetName) return;

        try {
            const sorted = [...this.capacitaciones].sort((a, b) => a.rowIndex - b.rowIndex);
            
            this.showNotification('Guardando cambios en Excel...', 'info');

            const result = await window.electronAPI.updateCapacitacionesExcel({
                filePath: this.excelFilePath,
                capacitacionesData: sorted,
                sheetName: sheetName,
                clearBeforeSave: true,
                startRow: 6
            });

            if (!result.success) throw new Error(result.error);
            
            // Recargar para sincronizar
            await this.loadDataForYear(this.currentYear);
            this.showNotification('Guardado exitoso.', 'success');

        } catch (error) {
            console.error('Save error:', error);
            this.showNotification(`Error al guardar: ${error.message}`, 'danger');
        }
    }

    exportToExcel() {
        this.showNotification('Exportando archivo... (Simulado)', 'info');
    }

    // --- GRÁFICOS (Chart.js) ---
    
    initializeCharts() {
        const ctx = document.getElementById('trainingChart');
        if (!ctx) {
            console.warn('[DEBUG CHART] Canvas #trainingChart no encontrado en el DOM.');
            return;
        }
        
        if (typeof Chart === 'undefined') {
            console.error('[DEBUG CHART] Librería Chart.js no está cargada.');
            return;
        }

        // Logs de diagnóstico de dimensiones
        const parent = ctx.parentElement;
        console.log(`[DEBUG CHART] Inicializando gráfico. Dimensiones del padre (.k-chart-body): ${parent.clientWidth}px x ${parent.clientHeight}px`);
        console.log(`[DEBUG CHART] Dimensiones actuales del Canvas: ${ctx.width}px x ${ctx.height}px`);

        // Destruir instancia previa si existe para evitar superposiciones o fugas de memoria
        if (this.chartInstance) {
            console.log('[DEBUG CHART] Destruyendo instancia previa del gráfico.');
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                datasets: [
                    {
                        label: 'Completadas',
                        data: Array(12).fill(0),
                        backgroundColor: '#174ea6', // var(--k-primary)
                        borderRadius: 4
                    },
                    {
                        label: 'Programadas',
                        data: Array(12).fill(0),
                        backgroundColor: '#ffc107', // var(--k-warning)
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 200, // Debounce para evitar cálculos excesivos durante el redimensionado
                onResize: (chart, size) => {
                    console.log(`[DEBUG CHART] Redimensionamiento detectado: ${size.width}px x ${size.height}px`);
                },
                scales: {
                    y: { beginAtZero: true, grid: { display: true, color: '#f0f0f0' } },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
        
        console.log('[DEBUG CHART] Gráfico inicializado correctamente.');
    }

    updateCharts() {
        if (!this.chartInstance) return;

        const completedData = Array(12).fill(0);
        const pendingData = Array(12).fill(0);

        this.filteredCapacitaciones.forEach(cap => {
            const date = new Date(cap.fechaProgramada);
            if (!isNaN(date.getTime())) {
                const month = date.getMonth(); // 0-11
                if (cap.estado === 'completed') completedData[month]++;
                else pendingData[month]++;
            }
        });

        this.chartInstance.data.datasets[0].data = completedData;
        this.chartInstance.data.datasets[1].data = pendingData;
        this.chartInstance.update();
    }

    // --- UTILIDADES ---

    showNotification(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'k-toast';
        
        let color = 'var(--k-primary)';
        let iconClass = 'bi-info-circle-fill';
        
        if (type === 'success') { color = 'var(--k-success)'; iconClass = 'bi-check-circle-fill'; }
        if (type === 'danger') { color = 'var(--k-danger)'; iconClass = 'bi-exclamation-circle-fill'; }
        if (type === 'warning') { color = 'var(--k-warning)'; iconClass = 'bi-exclamation-triangle-fill'; }

        toast.style.borderLeftColor = color;
        toast.innerHTML = `
            <i class="bi ${iconClass}" style="color: ${color}; font-size: 1.2rem; margin-right: 10px;"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    formatDate(dateString) {
        if (!dateString || dateString === 'No especificada') return '-';
        const date = new Date(dateString.replace(/-/g, '/')); 
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}

window.CapacitacionesComponent = CapacitacionesComponent;