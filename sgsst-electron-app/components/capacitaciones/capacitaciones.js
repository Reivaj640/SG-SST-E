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
        this.instructores = [];
        this.filteredCapacitaciones = [];
        this.excelFilePath = null;
        this.handleFileChange = null;
        this.availableSheets = []; // Para almacenar las hojas disponibles del Excel
    }

    render() {
        this.container.innerHTML = '';
        window.currentCapacitacionesComponent = this;

        // Agregar clase contenedora específica para evitar conflictos de estilos
        this.container.classList.add('capacitaciones-container');

        // Cargar el HTML de la interfaz
        fetch('components/capacitaciones/capacitaciones.html')
            .then(response => response.text())
            .then(html => {
                this.container.innerHTML = html;

                // Asegurar que todos los elementos estén totalmente cargados antes de inicializar listeners
                setTimeout(() => {
                    this.initializeEventListeners();
                    this.initializeComponent(); // Inicia el proceso de carga
                    this.initializeCharts();

                    // Definir y registrar el listener para cambios en el archivo
                    this.handleFileChange = () => {
                        this.showNotification('El archivo de capacitaciones ha cambiado. Recargando datos...', 'info');
                        this.loadDataForYear(this.currentYear);
                    };
                    window.electronAPI.onIpcMessage('capacitaciones-file-changed', this.handleFileChange);

                    // Mostrar la vista de dashboard por defecto
                    this.switchView('dashboard');
                }, 100);
            })
            .catch(error => {
                console.error('Error al cargar la interfaz de capacitaciones:', error);
                this.container.innerHTML = `<div class="alert alert-danger">Error al cargar la interfaz: ${error.message}</div>`;
            });
    }

    destroy() {
        // Detener la vigilancia del archivo
        if (this.excelFilePath) {
            window.electronAPI.send('stop-watching-capacitaciones');
        }
        // Limpiar el listener de IPC para evitar fugas de memoria
        if (this.handleFileChange) {
            window.electronAPI.removeIpcMessageListener('capacitaciones-file-changed', this.handleFileChange);
        }
        console.log('CapacitacionesComponent destruido y listeners limpiados.');
    }

    initializeEventListeners() {
        document.querySelectorAll('.top-nav .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView(link.getAttribute('href').substring(1));
            });
        });

        document.getElementById('yearFilter')?.addEventListener('change', (e) => {
            this.loadDataForYear(parseInt(e.target.value));
        });

        document.querySelector('.floating-action-btn')?.addEventListener('click', () => this.showAddTrainingModal());
        document.querySelector('#trainings-view .btn-primary-custom')?.addEventListener('click', () => this.applyFilters());
        document.querySelector('#trainings-view .btn-outline-secondary')?.addEventListener('click', () => this.clearFilters());
        document.querySelector('#addTrainingModal .btn-primary-custom')?.addEventListener('click', () => this.saveTraining());
        document.querySelector('#editTrainingModal .btn-primary-custom')?.addEventListener('click', () => this.updateTraining());
        // document.querySelector('#addInstructorModal .btn-primary-custom')?.addEventListener('click', () => this.saveInstructor());
    }

    switchView(viewId) {
        // Ocultar todas las vistas
        const viewSections = document.querySelectorAll('.view-section');
        viewSections.forEach(section => section.classList.remove('active'));

        // Mostrar la vista solicitada
        const targetSection = document.getElementById(`${viewId}-view`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Actualizar enlaces de navegación
        const navLinks = document.querySelectorAll('.top-nav .nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${viewId}`) {
                link.classList.add('active');
            }
        });

        this.currentView = viewId;

        // Actualizar contenido específico según la vista
        if (viewId === 'trainings') {
            this.renderTrainingsTable();
        }
    }

    async initializeComponent() {
        try {
            const submodulePathResult = await window.electronAPI.findSubmodulePath(this.currentCompany, this.moduleName, this.submoduleName);
            if (!submodulePathResult.success) throw new Error(submodulePathResult.error);
            const submodulePath = submodulePathResult.path;

            const filesResult = await window.electronAPI.readDirectory(submodulePath);
            if (!filesResult.success) throw new Error(filesResult.error);

            // Filtrar archivos Excel de capacitaciones que coincidan con el patrón específico
            const allExcelFiles = (filesResult.files || []).filter(item => {
                const fileName = (item.name || item.path || '').toLowerCase();
                return fileName.includes('act-fo-005') && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls'));
            }).map(item => item.name || item.path);

            // Ordenar para priorizar archivos .xlsx
            allExcelFiles.sort((a, b) => {
                const aIsXlsx = a.toLowerCase().endsWith('.xlsx');
                const bIsXlsx = b.toLowerCase().endsWith('.xlsx');

                if (aIsXlsx && !bIsXlsx) return -1; // a (.xlsx) va antes que b (.xls)
                if (!aIsXlsx && bIsXlsx) return 1;  // b (.xlsx) va antes que a (.xls)
                return a.localeCompare(b);          // Mantener orden alfabético para el mismo tipo
            });

            if (allExcelFiles.length === 0) {
                this.showNotification('No se encontraron archivos Excel de capacitaciones que coincidan con "ACT-FO-005".', 'info');
                return;
            }

            // Tomar el primer archivo de la lista priorizada y filtrada
            this.excelFilePath = `${submodulePath}/${allExcelFiles[0]}`;
            console.log(`[DEBUG] Cargando archivo de capacitaciones para empresa ${this.currentCompany}: ${this.excelFilePath}`);

            window.electronAPI.send('start-watching-capacitaciones', this.excelFilePath);

            await this._populateYearFilterFromSheets();

        } catch (error) {
            console.error('Error al inicializar el componente:', error);
            this.showNotification(`Error de inicialización: ${error.message}`, 'danger');
        }
    }

    async _populateYearFilterFromSheets() {
        const yearFilter = document.getElementById('yearFilter');
        if (!yearFilter) return;

        const sheetsResult = await window.electronAPI.getCapacitacionesSheets(this.excelFilePath);
        if (!sheetsResult.success) {
            this.showNotification('No se pudieron leer las hojas del archivo Excel.', 'warning');
            return;
        }

        this.availableSheets = sheetsResult.sheets;
        const years = [...new Set(this.availableSheets
            .map(sheetName => {
                const match = sheetName.match(/\d{4}/);
                return match ? parseInt(match[0]) : null;
            })
            .filter(y => y !== null && !isNaN(y))
        )].sort((a, b) => b - a);

        yearFilter.innerHTML = '';
        if (years.length === 0) {
            yearFilter.innerHTML = '<option value="">No hay años disponibles</option>';
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

        // Seleccionar el año actual o el más reciente por defecto
        const currentYear = new Date().getFullYear();
        if (years.includes(currentYear)) {
            yearFilter.value = currentYear;
            this.currentYear = currentYear;
        } else if (years.length > 0) {
            this.currentYear = years[0]; // Seleccionar el más reciente si no está el actual
            yearFilter.value = years[0];
        } else {
            this.currentYear = null; // No hay años disponibles
        }

        // Cargar datos para el año seleccionado por defecto
        if (this.currentYear) {
            await this.loadDataForYear(this.currentYear);
        } else {
            this.capacitaciones = [];
            this.applyFilters();
        }
    }

    async loadDataForYear(year) {
        this.currentYear = year;

        // Buscar hoja específica para el año, buscando patrones específicos como "Matriz Cap. 2025"
        let sheetName = null;

        // Primero intentar buscar exactamente "Matriz Cap. [año]"
        sheetName = this.availableSheets.find(s =>
            s.trim().toLowerCase().includes(`matriz cap.`) &&
            s.includes(year.toString())
        );

        // Si no se encuentra con el patrón específico, buscar cualquier hoja que contenga el año
        if (!sheetName) {
            sheetName = this.availableSheets.find(s => s.includes(year.toString()));
        }

        // Si aún no se encuentra, buscar con guiones o guiones bajos
        if (!sheetName) {
            sheetName = this.availableSheets.find(s =>
                s.toLowerCase().includes(year.toString()) &&
                (s.includes('-') || s.includes('_'))
            );
        }

        if (!sheetName) {
            this.showNotification(`No se encontró una hoja para el año ${year}.`, 'warning');
            this.capacitaciones = [];
            this.applyFilters();
            return;
        }

        try {
            const excelResult = await window.electronAPI.initExcel({ filePath: this.excelFilePath, sheetName });
            if (!excelResult.success) throw new Error(excelResult.error);

            const { processedData, headers, sheetName: loadedSheetName } = excelResult.data; // Recibir el sheetName real
            if (!processedData) throw new Error('La hoja de Excel seleccionada no contiene datos válidos.');

            // Limpiar datos existentes antes de cargar nuevos
            this.capacitaciones = [];

            // Cargar nuevos datos
            this.capacitaciones = this.parseExcelDataToCapacitaciones(processedData, headers);
            this.applyFilters();
            this.showNotification(`Datos cargados para el año ${year} desde la hoja '${loadedSheetName}'.`, 'success');
        } catch (error) {
             console.error(`Error al cargar datos para el año ${year}:`, error);
            this.showNotification(`Error al cargar datos para ${year}: ${error.message}`, 'danger');
            this.capacitaciones = [];
            this.applyFilters();
        }
    }

    applyFilters() {
        const typeFilterValue = document.getElementById('typeFilter')?.value || '';
        const statusFilterValue = document.getElementById('statusFilter')?.value || '';
        const monthFilterValue = document.getElementById('monthFilter')?.value || '';

        let filteredData = this.capacitaciones; // Inicia con los datos del año ya cargado

        if (typeFilterValue) {
            filteredData = filteredData.filter(cap => cap.tipo === typeFilterValue);
        }
        if (statusFilterValue) {
            filteredData = filteredData.filter(cap => cap.estado === statusFilterValue);
        }
        if (monthFilterValue) {
            filteredData = filteredData.filter(cap => {
                const fecha = new Date(cap.fechaProgramada);
                return !isNaN(fecha.getTime()) && (fecha.getMonth() + 1) == monthFilterValue;
            });
        }

        this.filteredCapacitaciones = filteredData;
        this.renderTrainingsTable();
        this.updateDashboardStats(); // Actualiza stats y gráficos basados en la nueva data filtrada
    }

    clearFilters() {
        document.getElementById('typeFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('monthFilter').value = '';
        // El filtro de año no se limpia, se mantiene el seleccionado. Para limpiarlo, el usuario debe seleccionar otro año.
        this.applyFilters();
        this.showNotification('Filtros secundarios limpiados.', 'info');
    }

    // Función para mapear los datos del Excel al formato esperado por la interfaz
    parseExcelDataToCapacitaciones(processedData, headers) {
        const capacitaciones = [];
        // Los datos empiezan desde la fila 6 del Excel (índice 6 del array)
        const dataRows = processedData.slice(5);

        console.log(`[DEBUG] Procesando ${dataRows.length} filas de datos desde índice 6`);

        // El bucle ahora empieza en 0 porque dataRows[0] es la primera fila de datos real.
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];

            // Ajustar la comprobación de longitud a las columnas que se usarán (máximo índice es 8)
            if (!Array.isArray(row) || row.length < 9) {
                console.log(`[DEBUG] Fila ${i+7} no válida o sin suficientes columnas (longitud: ${row ? row.length : 'undefined'}):`, row);
                continue;
            }

            const getCellValue = (cell) => {
                if (cell === null || cell === undefined) return '';
                if (typeof cell === 'object' && cell.value !== undefined) return cell.value;
                if (typeof cell === 'object') return String(cell);
                return cell;
            };

            // Nombre (Columna B, índice 1)
            const nombreRaw = getCellValue(row[1]);
            const nombre = String(nombreRaw || '').trim();

            // Omitir filas vacías o de encabezado residual
            if (!nombre || nombre === 'Nombre de la capacitación' || nombre === '') {
                console.log(`[DEBUG] Fila ${i+7} sin nombre de capacitación válido, saltando`);
                continue;
            }

            // Detener si es la fila de totalizadores
            if (typeof nombre === 'string' && nombre.toLowerCase().includes('total capacitaciones programadas')) {
                console.log('[DEBUG] Encontrado "Total capacitaciones programadas", deteniendo lectura');
                break;
            }

            // Tipo (Columna C, índice 2)
            const tipoRaw = getCellValue(row[2]);
            const tipoRawStr = String(tipoRaw || 'sst');
            let tipo = 'sst';
            if (tipoRawStr.toLowerCase().includes('pyp')) {
                tipo = 'pyp';
            }

            // Fecha Programada (Columna D, índice 3)
            let fechaProgramada = 'No especificada';
            const fechaValue = getCellValue(row[3]);

            // Mejorar el manejo de fechas para evitar desfase de zona horaria
            if (fechaValue !== undefined && fechaValue !== null && fechaValue !== '') {
                let parsedDate;
                if (typeof fechaValue === 'number') {
                    // Manejar fechas de Excel (números)
                    // Ignorar fechas que son menores a 1 (que resultarían en años anteriores a 1900)
                    if (fechaValue >= 1) {
                        // Convertir el número serial de Excel a fecha JavaScript
                        // Usamos UTC para evitar problemas de zona horaria
                        const utcDate = new Date((fechaValue - 25569) * 86400 * 1000);
                        // Crear una fecha local a partir de los componentes UTC para asegurar la representación del día correcto en la zona horaria local
                        const year = utcDate.getUTCFullYear();
                        const month = utcDate.getUTCMonth(); // getUTCMonth es 0-indexado
                        const day = utcDate.getUTCDate();
                        const localDate = new Date(year, month, day); // Esto crea una fecha local con esos componentes
                        fechaProgramada = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                    }
                } else {
                    const fechaStr = String(fechaValue);
                    // Intentar diferentes formatos de fecha
                    parsedDate = new Date(fechaStr);
                    if (isNaN(parsedDate.getTime())) {
                        // Intentar formato DD/MM/YYYY
                        const parts = fechaStr.split('/');
                        if (parts.length === 3) {
                            parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
                        }
                    }

                    // Verificar si la fecha es válida y no es una fecha por defecto de Excel
                    if (parsedDate && !isNaN(parsedDate.getTime()) &&
                        parsedDate.getFullYear() >= 1900 &&
                        !(parsedDate.getFullYear() === 1900 && parsedDate.getMonth() === 0 && parsedDate.getDate() === 1)) {
                        // Formatear la fecha en formato YYYY-MM-DD sin conversión de zona horaria
                        const year = parsedDate.getFullYear();
                        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(parsedDate.getDate()).padStart(2, '0');
                        fechaProgramada = `${year}-${month}-${day}`;
                    } else {
                        console.log(`[DEBUG] Fecha no válida en fila ${i+7}: ${fechaValue}`);
                    }
                }
            }

            // Instructor (Columna G, índice 6)
            const instructorRaw = getCellValue(row[6]);
            const instructor = String(instructorRaw || 'No especificado');

            // Duración (Columna H, índice 7)
            const duracionValue = getCellValue(row[7]);
            const duracionNum = parseFloat(String(duracionValue));
            const duracion = `${!isNaN(duracionNum) ? Math.floor(duracionNum) : 0} Horas`;

            // Estado (Columna I, índice 8)
            const estadoRaw = getCellValue(row[8]);
            const estadoStr = String(estadoRaw || '');
            let estado = 'pending';
            if (estadoStr.toLowerCase().includes('ejecutado') ||
                estadoStr.toLowerCase().includes('completado') ||
                estadoStr.toLowerCase().includes('finalizado') ||
                estadoStr.toLowerCase().includes('realizado')) {
                estado = 'completed';
            } else if (estadoStr.toLowerCase().includes('pendiente') ||
                      estadoStr.toLowerCase().includes('programado') ||
                      estadoStr.toLowerCase().includes('planificado')) {
                estado = 'pending';
            }

            console.log(`[DEBUG] Capacitación creada: ${nombre}, tipo: ${tipo}, fecha: ${fechaProgramada}, instructor: ${instructor}, duración: ${duracion}, estado: ${estado}`);

            capacitaciones.push({
                id: capacitaciones.length + 1,
                rowIndex: i + 6, // Mantener el índice original de la fila en Excel (0-indexed + 6 offset)
                nombre: nombre,
                tipo: tipo,
                fechaProgramada: fechaProgramada,
                instructor: instructor,
                duracion: duracion,
                estado: estado,
                participantes: 0
            });
        }

        console.log(`[DEBUG] Total capacitaciones procesadas: ${capacitaciones.length}`);
        return capacitaciones;
    }

    updateDashboardStats() {
        // this.filteredCapacitaciones ya contiene los datos filtrados por el año actual y otros filtros
        const total = this.filteredCapacitaciones.length;
        const completadas = this.filteredCapacitaciones.filter(c => c.estado === 'completed').length;
        const pendientes = this.filteredCapacitaciones.filter(c => c.estado === 'pending').length;
        const participantes = this.filteredCapacitaciones.reduce((sum, c) => sum + (parseInt(c.participantes) || 0), 0);
        const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

        // Actualizar valores en las tarjetas de estadísticas
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards.length >= 4) {
            const statCard1 = statCards[0];
            const valueElement1 = statCard1.querySelector('.stat-value');
            if (valueElement1) valueElement1.textContent = total;
            const progressBar1 = statCard1.querySelector('.progress-bar');
            if (progressBar1) progressBar1.style.width = `${porcentaje}%`;
            const labelElements1 = statCard1.querySelectorAll('.stat-label');
            if (labelElements1.length > 0) {
                labelElements1[labelElements1.length - 1].textContent = `${porcentaje}% Completadas`;
            }

            const statCard2 = statCards[1];
            if (statCard2) {
                const valueElement2 = statCard2.querySelector('.stat-value');
                if (valueElement2) valueElement2.textContent = completadas;
            }

            const statCard3 = statCards[2];
             if (statCard3) {
                const valueElement3 = statCard3.querySelector('.stat-value');
                if (valueElement3) valueElement3.textContent = participantes;
            }

            const statCard4 = statCards[3];
            if (statCard4) {
                const valueElement4 = statCard4.querySelector('.stat-value');
                if (valueElement4) valueElement4.textContent = pendientes;
            }
        }

        this.updateCharts();
        this.updateTrainingLists();
    }

    updateTrainingLists() {
        const recentListContainer = document.getElementById('recent-trainings-list');
        const upcomingListContainer = document.getElementById('upcoming-trainings-list');

        if (!recentListContainer || !upcomingListContainer) return;

        // Limpiar solo los items dinámicos, manteniendo el H3
        recentListContainer.querySelectorAll('.training-item').forEach(item => item.remove());
        upcomingListContainer.querySelectorAll('.training-item').forEach(item => item.remove());

        const now = new Date();
        const validTrainings = this.filteredCapacitaciones.filter(c => !isNaN(new Date(c.fechaProgramada).getTime()));

        // Capacitaciones Recientes (últimas 3 completadas)
        const recentTrainings = validTrainings
            .filter(c => c.estado === 'completed' && new Date(c.fechaProgramada) <= now)
            .sort((a, b) => new Date(b.fechaProgramada) - new Date(a.fechaProgramada))
            .slice(0, 3);

        if (recentTrainings.length > 0) {
            recentTrainings.forEach(cap => {
                const item = document.createElement('div');
                item.className = 'training-item';
                item.innerHTML = `
                    <div class="training-info">
                        <div class="training-title">${cap.nombre}</div>
                        <div class="training-meta">${this.formatDate(cap.fechaProgramada)}</div>
                    </div>
                    <div class="training-status status-completed">Completada</div>`;
                recentListContainer.appendChild(item);
            });
        } else {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'training-item';
            emptyItem.innerHTML = '<div class="training-info"><p class="text-muted">No hay capacitaciones completadas recientemente.</p></div>';
            recentListContainer.appendChild(emptyItem);
        }

        // Próximas Capacitaciones (próximas 3 pendientes)
        const upcomingTrainings = validTrainings
            .filter(c => c.estado === 'pending' && new Date(c.fechaProgramada) >= now)
            .sort((a, b) => new Date(a.fechaProgramada) - new Date(b.fechaProgramada))
            .slice(0, 3);

        if (upcomingTrainings.length > 0) {
            upcomingTrainings.forEach(cap => {
                const item = document.createElement('div');
                item.className = 'training-item';
                item.innerHTML = `
                    <div class="training-info">
                        <div class="training-title">${cap.nombre}</div>
                        <div class="training-meta">${this.formatDate(cap.fechaProgramada)}</div>
                    </div>
                    <div class="training-status status-pending">Programada</div>`;
                upcomingListContainer.appendChild(item);
            });
        } else {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'training-item';
            emptyItem.innerHTML = '<div class="training-info"><p class="text-muted">No hay capacitaciones próximas.</p></div>';
            upcomingListContainer.appendChild(emptyItem);
        }
    }

    renderTrainingsTable() {
        const tableBody = document.querySelector('#trainings-view tbody');
        if (!tableBody) {
            console.error('No se encontró el tbody para la tabla de capacitaciones');
            return;
        }

        // Limpiar contenido anterior
        tableBody.innerHTML = '';

        if (this.filteredCapacitaciones.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">No se encontraron capacitaciones con los filtros seleccionados.</td></tr>';
            return;
        }

        // Mostrar todos los registros sin límite
        this.filteredCapacitaciones.forEach(cap => {
            const row = document.createElement('tr');

            // Determinar badge de tipo
            const tipoBadge = cap.tipo === 'sst'
                ? '<span class="badge bg-primary" style="height: fit-content;">SST</span>'
                : '<span class="badge bg-info" style="height: fit-content;">PYP</span>';

            // Determinar badge de estado
            const estadoBadge = cap.estado === 'completed'
                ? '<span class="badge bg-success" style="height: fit-content;">Completada</span>'
                : '<span class="badge bg-warning" style="height: fit-content;">Pendiente</span>';

            // Determinar acciones según estado
            const acciones = cap.estado === 'pending'
                ? this.getPendingActions(cap.id)
                : this.getCompletedActions(cap.id);

            // Crear la fila con todos los campos
            row.innerHTML = `
                <td>${cap.id}</td>
                <td>${cap.nombre}</td>
                <td class="col-tipo">${tipoBadge}</td>
                <td>${this.formatDate(cap.fechaProgramada)}</td>
                <td>${cap.instructor}</td>
                <td>${cap.duracion}</td>
                <td class="col-estado">${estadoBadge}</td>
                <td>${acciones}</td>
            `;

            tableBody.appendChild(row);
        });

        this.attachTableActionListeners();
    }

    getPendingActions(id) {
        return `
            <div class="btn-group" role="group">
                <button type="button" class="btn btn-sm btn-outline-primary edit-training" data-id="${id}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-success complete-training" data-id="${id}">
                    <i class="bi bi-check-circle"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger delete-training" data-id="${id}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>`;
    }

    getCompletedActions(id) {
        return `
            <div class="btn-group" role="group">
                <button type="button" class="btn btn-sm btn-outline-primary view-training" data-id="${id}">
                    <i class="bi bi-eye"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary download-certificate" data-id="${id}">
                    <i class="bi bi-download"></i>
                </button>
            </div>`;
    }

    attachTableActionListeners() {
        document.querySelectorAll('.edit-training').forEach(btn => btn.addEventListener('click', (e) => this.editTraining(parseInt(e.currentTarget.dataset.id))));
        document.querySelectorAll('.complete-training').forEach(btn => btn.addEventListener('click', (e) => this.completeTraining(parseInt(e.currentTarget.dataset.id))));
        document.querySelectorAll('.delete-training').forEach(btn => btn.addEventListener('click', (e) => this.deleteTraining(parseInt(e.currentTarget.dataset.id))));
        document.querySelectorAll('.view-training').forEach(btn => btn.addEventListener('click', (e) => this.viewTraining(parseInt(e.currentTarget.dataset.id))));
    }

    updateCharts() {
        const ctx = document.getElementById('trainingChart');
        if (!ctx || !ctx.chartInstance) return;

        console.log('[DEBUG] Iniciando updateCharts');
        console.log('[DEBUG] filteredCapacitaciones length:', this.filteredCapacitaciones.length);

        // Etiquetas para los 12 meses del año + una categoría "Sin Fecha"
        const labels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Sin Fecha'];

        // Arrays para almacenar datos de completadas y programadas por mes (0-11) + sin fecha (12)
        const completadasData = Array(13).fill(0);
        const programadasData = Array(13).fill(0);

        console.log('[DEBUG] Procesando capacitaciones para gráfica:');

        // Use filteredCapacitaciones instead of capacitaciones to match the table data
        this.filteredCapacitaciones.forEach((cap, index) => {
            const fecha = new Date(cap.fechaProgramada);
            console.log(`[DEBUG] Capacitación ${index + 1}:`, cap.nombre, 'Fecha:', cap.fechaProgramada, 'Estado:', cap.estado);

            let dataIndex;

            if (isNaN(fecha.getTime()) || cap.fechaProgramada === 'No especificada') {
                console.log(`[DEBUG] Fecha inválida para: ${cap.nombre}, asignando a 'Sin Fecha'`);
                dataIndex = 12; // Índice para "Sin Fecha"
            } else {
                // Obtener el mes de la capacitación (0-indexed: 0=Enero, 11=Diciembre)
                dataIndex = fecha.getMonth();
                console.log(`[DEBUG] Mes de capacitación ${cap.nombre}: ${dataIndex} (${labels[dataIndex]})`);
            }

            // Contar según estado y mes/fecha
            if (cap.estado === 'completed') {
                completadasData[dataIndex]++;
                console.log(`[DEBUG] Incrementando completadasData[${dataIndex}] = ${completadasData[dataIndex]}`);
            } else if (cap.estado === 'pending') {
                programadasData[dataIndex]++;
                console.log(`[DEBUG] Incrementando programadasData[${dataIndex}] = ${programadasData[dataIndex]}`);
            }
        });

        console.log('[DEBUG] Datos finales para gráfica - Completadas:', completadasData, 'Programadas:', programadasData);

        ctx.chartInstance.data.labels = labels;
        ctx.chartInstance.data.datasets[0].data = completadasData;
        ctx.chartInstance.data.datasets[1].data = programadasData;

        // Forzar actualización del gráfico
        ctx.chartInstance.update('active');

        console.log('[DEBUG] Gráfica actualizada');
    }

    initializeCharts() {
        const ctx = document.getElementById('trainingChart');
        if (!ctx) {
            console.error('No se encontró el canvas para el gráfico de capacitaciones');
            return;
        }

        // Destruir instancia existente si la hay
        if (ctx.chartInstance) {
            ctx.chartInstance.destroy();
        }

        if (typeof Chart === 'undefined') {
            console.error('Chart.js no está disponible');
            return;
        }

        // Crear nuevo gráfico
        ctx.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [], // Se llenará dinámicamente
                datasets: [
                    {
                        label: 'Completadas',
                        data: [], // Se llenará dinámicamente
                        backgroundColor: 'rgba(32, 106, 93, 0.7)',
                        borderColor: 'rgba(32, 106, 93, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Programadas',
                        data: [], // Se llenará dinámicamente
                        backgroundColor: 'rgba(255, 193, 7, 0.7)',
                        borderColor: 'rgba(255, 193, 7, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    formatDate(dateString) {
        if (!dateString || dateString === 'No especificada') {
            return 'No especificada';
        }
        // Reemplazar guiones con slashes para asegurar que se interprete como fecha local y no UTC.
        // new Date('2025-12-21') -> UTC
        // new Date('2025/12/21') -> Local
        const localDate = new Date(dateString.replace(/-/g, '/'));
        return localDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    showAddTrainingModal() {
        const modalElement = document.getElementById('addTrainingModal');
        if (!modalElement) {
            console.error('No se encontró el modal de agregar capacitación');
            return;
        }

        const modal = new bootstrap.Modal(modalElement);
        document.querySelector('#addTrainingModal form')?.reset();
        modal.show();
    }

    editTraining(id) {
        const cap = this.capacitaciones.find(c => c.id === id);
        if (!cap) {
            console.error(`No se encontró la capacitación con ID ${id}`);
            return;
        }

        // Llenar el formulario de edición con los datos existentes
        const modalElement = document.getElementById('editTrainingModal');
        if (modalElement) {
            document.getElementById('editTrainingName')?.setAttribute('data-id', id);
            document.getElementById('editTrainingName').value = cap.nombre;
            document.getElementById('editTrainingType').value = cap.tipo;
            document.getElementById('editTrainingDate').value = cap.fechaProgramada;
            document.getElementById('editTrainingInstructor').value = cap.instructor;
            document.getElementById('editTrainingDuration').value = cap.duracion.replace(' Horas', '');
            document.getElementById('editTrainingParticipants').value = cap.participantes;

            // Eliminar aria-hidden antes de mostrar el modal para evitar problemas de accesibilidad
            modalElement.removeAttribute('aria-hidden');
            modalElement.setAttribute('aria-modal', 'true');

            const modalInstance = new bootstrap.Modal(modalElement);
            modalInstance.show();
        }
    }

    viewTraining(id) {
        const cap = this.capacitaciones.find(c => c.id === id);
        if (!cap) {
            console.error(`No se encontró la capacitación con ID ${id}`);
            return;
        }

        // Llenar el modal de vista con los datos de 'cap'
        const modalElement = document.getElementById('viewTrainingModal');
        if (modalElement) {
            // Actualizar contenido del modal
            const modalContent = modalElement.querySelector('.modal-body');
            if (modalContent) {
                modalContent.innerHTML = `
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <h6>Nombre de la Capacitación</h6>
                            <p>${cap.nombre}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Tipo</h6>
                            <p><span class="badge bg-${cap.tipo === 'sst' ? 'primary' : 'info'}">${cap.tipo.toUpperCase()}</span></p>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <h6>Fecha de Realización</h6>
                            <p>${this.formatDate(cap.fechaProgramada)}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Instructor</h6>
                            <p>${cap.instructor}</p>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <h6>Duración</h6>
                            <p>${cap.duracion}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Participantes</h6>
                            <p>${cap.participantes}</p>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-md-12">
                            <h6>Estado</h6>
                            <p><span class="badge bg-${cap.estado === 'completed' ? 'success' : 'warning'}">${cap.estado === 'completed' ? 'Completada' : 'Pendiente'}</span></p>
                        </div>
                    </div>
                `;
            }

            const modalInstance = new bootstrap.Modal(modalElement);
            modalInstance.show();
        }
    }

    async saveTraining() {
        // Validar la fecha antes de guardar
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

        const newTraining = {
            id: this.capacitaciones.length > 0 ? Math.max(...this.capacitaciones.map(c => c.id)) + 1 : 1,
            rowIndex: this.capacitaciones.length > 0 ? Math.max(...this.capacitaciones.map(c => c.rowIndex)) + 1 : 6,
            nombre: document.getElementById('trainingName').value,
            tipo: document.getElementById('trainingType').value,
            fechaProgramada: fechaProgramada,
            instructor: document.getElementById('trainingInstructor').value,
            duracion: `${document.getElementById('trainingDuration').value} Horas`,
            participantes: parseInt(document.getElementById('trainingParticipants').value) || 0,
            estado: 'pending'
        };

        if (!newTraining.nombre || !newTraining.tipo) {
            this.showNotification('Por favor completa los campos obligatorios.', 'warning');
            return;
        }

        this.capacitaciones.push(newTraining);

        const modalElement = document.getElementById('addTrainingModal');
        if(modalElement) {
            bootstrap.Modal.getInstance(modalElement)?.hide();
        }

        // Guardar cambios en Excel
        await this._saveDataToExcel();

        // Actualizar vista
        this.applyFilters();
        this.showNotification('Capacitación guardada.', 'success');
    }

    async updateTraining() {
        const id = parseInt(document.getElementById('editTrainingName')?.getAttribute('data-id') || 0);
        if (!id) return;

        const capIndex = this.capacitaciones.findIndex(c => c.id === id);
        if (capIndex === -1) {
            this.showNotification('No se encontró la capacitación para actualizar.', 'danger');
            return;
        }

        // Validar la fecha antes de actualizar
        const newDate = document.getElementById('editTrainingDate').value;
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

        // Actualizar solo los campos editables manteniendo el ID original y rowIndex
        this.capacitaciones[capIndex] = {
            ...this.capacitaciones[capIndex],
            nombre: document.getElementById('editTrainingName').value,
            tipo: document.getElementById('editTrainingType').value,
            fechaProgramada: fechaProgramada,
            instructor: document.getElementById('editTrainingInstructor').value,
            duracion: `${document.getElementById('editTrainingDuration').value} Horas`,
            participantes: parseInt(document.getElementById('editTrainingParticipants').value) || 0,
        };

        const modalElement = document.getElementById('editTrainingModal');
        if(modalElement) {
            bootstrap.Modal.getInstance(modalElement)?.hide();
        }

        // Guardar cambios en Excel
        await this._saveDataToExcel();

        // Actualizar vista
        this.applyFilters();
        this.showNotification('Capacitación actualizada.', 'success');
    }

    async completeTraining(id) {
        const capIndex = this.capacitaciones.findIndex(c => c.id === id);
        if (capIndex === -1) return;

        this.capacitaciones[capIndex].estado = 'completed';

        // Guardar cambios en Excel
        await this._saveDataToExcel();

        // Actualizar vista
        this.applyFilters();
        this.showNotification('Capacitación marcada como completada.', 'success');
    }

    async deleteTraining(id) {
        if (!confirm('¿Está seguro de que desea eliminar esta capacitación?')) return;

        this.capacitaciones = this.capacitaciones.filter(c => c.id !== id);

        // Guardar cambios en Excel
        await this._saveDataToExcel();

        // Actualizar vista
        this.applyFilters();
        this.showNotification('Capacitación eliminada.', 'info');
    }

    downloadCertificate(id) {
        this.showNotification(`Descargando certificado para la capacitación ${id}...`, 'info');
        // Lógica para descargar un PDF
    }

    applyFilters() {
        const typeFilterValue = document.getElementById('typeFilter')?.value || '';
        const statusFilterValue = document.getElementById('statusFilter')?.value || '';
        const monthFilterValue = document.getElementById('monthFilter')?.value || '';

        // this.capacitaciones ya está filtrado por año (por loadDataForYear)
        let filteredData = this.capacitaciones;

        if (typeFilterValue) {
            filteredData = filteredData.filter(cap => cap.tipo === typeFilterValue);
        }
        if (statusFilterValue) {
            filteredData = filteredData.filter(cap => cap.estado === statusFilterValue);
        }
        if (monthFilterValue) {
            filteredData = filteredData.filter(cap => {
                const fecha = new Date(cap.fechaProgramada);
                return !isNaN(fecha.getTime()) && (fecha.getMonth() + 1) == monthFilterValue;
            });
        }

        this.filteredCapacitaciones = filteredData;
        this.renderTrainingsTable();
        this.updateDashboardStats(); // Actualiza stats y gráficos basados en la nueva data filtrada
    }

    clearFilters() {
        document.getElementById('typeFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('monthFilter').value = '';
        this.applyFilters(); // Vuelve a aplicar filtros sin el año para actualizar
        this.showNotification('Filtros secundarios limpiados.', 'info');
    }

    exportToExcel() {
        this.showNotification('Exportando a Excel...', 'info');
        // Lógica para exportar
        // window.electronAPI.exportToExcel(this.filteredCapacitaciones);
    }

    exportToPdf() {
        this.showNotification('Exportando a PDF...', 'info');
        // Lógica para exportar
        // window.electronAPI.exportToPdf(this.filteredCapacitaciones);
    }

    renderInstructorsTable() {
        console.log("Renderizando tabla de instructores (placeholder)");
        // Lógica para renderizar instructores
    }

    renderCalendar() {
        console.log("Renderizando calendario (placeholder)");
        // Lógica para renderizar calendario
    }

    async _saveDataToExcel() {
        if (!this.excelFilePath) {
            this.showNotification('Ruta de archivo no encontrada.', 'danger');
            return;
        }

        const sheetName = this.availableSheets.find(s => s.includes(this.currentYear.toString()));
        if (!sheetName) {
            this.showNotification(`No se encontró la hoja para el año ${this.currentYear} para guardar.`, 'danger');
            return;
        }

        try {
            // Ordenar las capacitaciones por rowIndex para mantener el orden original en Excel
            const sortedCapacitaciones = [...this.capacitaciones].sort((a, b) => a.rowIndex - b.rowIndex);

            // Filtrar las capacitaciones para asegurarse de que no haya entradas inválidas
            const validCapacitaciones = sortedCapacitaciones.filter(cap => {
                return cap &&
                       typeof cap === 'object' &&
                       cap.nombre !== undefined &&
                       cap.nombre !== null &&
                       cap.nombre !== '' &&
                       typeof cap.nombre === 'string';
            });

            // Comprobar si hay elementos inválidos antes de guardar
            const invalidCount = sortedCapacitaciones.length - validCapacitaciones.length;
            if (invalidCount > 0) {
                console.warn(`[DEBUG] Filtrados ${invalidCount} elementos inválidos antes de guardar`);
                console.log(`[DEBUG] Total capacitaciones antes de filtrar: ${sortedCapacitaciones.length}`);
                console.log(`[DEBUG] Total capacitaciones después de filtrar: ${validCapacitaciones.length}`);
            }

            // Asegurar que todas las filas anteriores se borren antes de escribir los nuevos datos
            this.showNotification('Guardando cambios en Excel...', 'info');

            // Enviar los datos al proceso principal para guardar en Excel
            const result = await window.electronAPI.updateCapacitacionesExcel({
                filePath: this.excelFilePath,
                capacitacionesData: validCapacitaciones,
                sheetName: sheetName,
                clearBeforeSave: true,  // Asegurar que se limpie antes de guardar
                startRow: 6  // Especificar que los datos empiezan en la fila 6
            });

            if (!result.success) throw new Error(result.error);

            // Recargar los datos para asegurar sincronización
            await this.loadDataForYear(this.currentYear);

            this.showNotification('Cambios guardados en Excel.', 'success');
        } catch (error) {
            console.error('Error al guardar en Excel:', error);
            this.showNotification(`Error al guardar: ${error.message}`, 'danger');
        }
    }

    saveInstructor() {
        console.log("Guardando instructor (placeholder)");
        // Lógica para guardar instructor
    }

    showNotification(message, type = 'info') {
        // Eliminar notificaciones anteriores si existen
        const existingAlerts = document.querySelectorAll('.alert-notification');
        existingAlerts.forEach(alert => alert.remove());

        // Crear nuevo elemento de notificación
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-notification position-fixed`;
        alertDiv.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 500px;
        `;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        document.body.appendChild(alertDiv);

        // Eliminar automáticamente después de 5 segundos
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}

window.CapacitacionesComponent = CapacitacionesComponent;