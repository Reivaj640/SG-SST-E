// inducciones.js - Componente para la vista de administración de inducciones

class InduccionesComponent {
    constructor(container, currentCompany, moduleName, submoduleName, backToModuleCallback) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.backToModuleCallback = backToModuleCallback;
        this.currentView = 'dashboard';
        this.currentYear = new Date().getFullYear();
        this.inducciones = [];
        this.empleados = [];
        this.filteredInducciones = [];
        this.excelFilePath = null;
        this.handleFileChange = null;
        this.availableSheets = []; // Para almacenar las hojas disponibles del Excel
    }

    render() {
        this.container.innerHTML = '';
        window.currentInduccionesComponent = this;

        // Agregar clase contenedora específica para evitar conflictos de estilos
        this.container.classList.add('inducciones-container', 'submodule-content', 'inducciones-viewer');

        // Cargar el HTML de la interfaz
        fetch('components/inducciones/inducciones.html')
            .then(response => response.text())
            .then(html => {
                this.container.innerHTML = html;

                // Asegurar que todos los elementos estén totalmente cargados antes de inicializar listeners
                setTimeout(() => {
                    // No modificar el header principal de la aplicación
                    // Solo inicializar los componentes del módulo de inducciones

                    // Escuchar eventos del sidebar para manejar la superposición
                    this.setupSidebarEventListener();

                    this.initializeEventListeners();
                    this.initializeComponent(); // Inicia el proceso de carga
                    this.initializeCharts();

                    // Definir y registrar el listener para cambios en el archivo
                    this.handleFileChange = () => {
                        this.showNotification('El archivo de inducciones ha cambiado. Recargando datos...', 'info');
                        this.loadDataForYear(this.currentYear);
                    };
                    window.electronAPI.onIpcMessage('inducciones-file-changed', this.handleFileChange);

                    // Mostrar la vista de dashboard por defecto
                    this.switchView('dashboard');
                }, 100);
            })
            .catch(error => {
                console.error('Error al cargar la interfaz de inducciones:', error);
                this.container.innerHTML = `<div class="alert alert-danger">Error al cargar la interfaz: ${error.message}</div>`;
            });
    }

    destroy() {
        // Detener la vigilancia del archivo
        if (this.excelFilePath) {
            window.electronAPI.send('stop-watching-inducciones');
        }
        // Limpiar el listener de IPC para evitar fugas de memoria
        if (this.handleFileChange) {
            window.electronAPI.removeIpcMessageListener('inducciones-file-changed', this.handleFileChange);
        }
        console.log('InduccionesComponent destruido y listeners limpiados.');
    }

    initializeEventListeners() {
        // Inicializar navegación entre páginas
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = link.getAttribute('data-page');
                this.switchView(pageId);
            });
        });

        // Inicializar pestañas
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabId = e.target.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });

        // Eventos de modales
        document.getElementById('add-employee-btn')?.addEventListener('click', () => this.showAddEmployeeModal());
        document.getElementById('add-induction-btn')?.addEventListener('click', () => this.showAddInductionModal());

        // Eventos de cierre de modales
        document.getElementById('closeEmployeeModal')?.addEventListener('click', () => this.closeModal('addEmployeeModal'));
        document.getElementById('closeInductionModal')?.addEventListener('click', () => this.closeModal('addInductionModal'));
        document.getElementById('cancelAddEmployee')?.addEventListener('click', () => this.closeModal('addEmployeeModal'));
        document.getElementById('cancelAddInduction')?.addEventListener('click', () => this.closeModal('addInductionModal'));

        // Eventos de guardado
        document.getElementById('saveEmployee')?.addEventListener('click', () => this.saveEmployee());
        document.getElementById('saveInduction')?.addEventListener('click', () => this.saveInduction());

        // Eventos de filtros
        document.getElementById('yearFilter')?.addEventListener('change', () => this.applyFilters());
        document.getElementById('applyFiltersBtn')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => this.clearFilters());

        // Inicializar eventos de búsqueda
        this.initializeSearchEvents();
    }

    switchView(viewId) {
        // Ocultar todas las vistas
        const viewPages = document.querySelectorAll('.page-content');
        viewPages.forEach(page => page.style.display = 'none');

        // Mostrar la vista solicitada
        const targetPage = document.getElementById(`${viewId}-page`);
        if (targetPage) {
            targetPage.style.display = 'block';
        }

        // Actualizar enlaces de navegación
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === viewId) {
                link.classList.add('active');
            }
        });

        this.currentView = viewId;

        // Actualizar contenido específico según la vista
        if (viewId === 'inductions') {
            this.renderInduccionesTable();
        } else if (viewId === 'employees') {
            this.renderEmployeesTable();
        } else if (viewId === 'dashboard') {
            this.updateDashboardStats();
        }
    }

    switchTab(tabId) {
        // Remover clase activa de botones y contenido
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Agregar clase activa al botón y contenido correspondiente
        const activeButton = document.querySelector(`[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(`${tabId}-tab`);

        if (activeButton) activeButton.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }

    async initializeComponent() {
        try {
            // Verificar que la API de Electron esté disponible
            if (!window.electronAPI) {
                throw new Error('La API de Electron no está disponible');
            }

            const submodulePathResult = await window.electronAPI.findSubmodulePath(this.currentCompany, this.moduleName, this.submoduleName);
            if (!submodulePathResult.success) throw new Error(submodulePathResult.error);
            const submodulePath = submodulePathResult.path;

            const filesResult = await window.electronAPI.readDirectory(submodulePath);
            if (!filesResult.success) throw new Error(filesResult.error);

            // Filtrar archivos Excel de inducciones que coincidan con el patrón específico
            const allExcelFiles = (filesResult.files || []).filter(item => {
                const fileName = (item.name || item.path || '').toLowerCase();
                // Excluir archivos temporales de Excel que comienzan con ~$
                const isTempFile = fileName.startsWith('~$');
                return !isTempFile && fileName.includes('act-fo-046') && (fileName.endsWith('.xlsx') || fileName.endsWith('.xls'));
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
                this.showNotification('No se encontraron archivos Excel de inducciones que coincidan con "ACT-FO-046".', 'info');
                // Si no se encuentran archivos, inicializar con datos de ejemplo
                this.inducciones = this.generateSampleInducciones();
                this.empleados = this.generateSampleEmployees();
                this.filteredInducciones = [...this.inducciones];
                this.updateDashboardStats();
                this.renderInduccionesTable();
                this.renderEmployeesTable();
                return;
            }

            // Tomar el primer archivo de la lista priorizada y filtrada
            this.excelFilePath = `${submodulePath}/${allExcelFiles[0]}`;
            console.log(`[DEBUG] Cargando archivo de inducciones para empresa ${this.currentCompany}: ${this.excelFilePath}`);

            // Iniciar la vigilancia del archivo
            window.electronAPI.send('start-watching-inducciones', this.excelFilePath);

            // Leer y procesar el archivo Excel de inducciones
            await this.loadInduccionesFromExcel();

            // Inicializar las inducciones filtradas con todas las inducciones (sin filtrar por defecto para la vista de registros)
            this.filteredInducciones = [...this.inducciones];

            // Actualizar el filtro de año con todos los años disponibles
            this.populateYearFilter();

            // Actualizar dashboard stats con todas las inducciones
            this.updateDashboardStats();

        } catch (error) {
            console.error('Error al inicializar el componente:', error);
            this.showNotification(`Error de inicialización: ${error.message}`, 'danger');

            // En caso de error, inicializar con datos de ejemplo
            this.inducciones = this.generateSampleInducciones();
            this.empleados = this.generateSampleEmployees();
            this.filteredInducciones = [...this.inducciones];
            this.updateDashboardStats();
            this.renderInduccionesTable();
            this.renderEmployeesTable();
        }
    }

    populateYearFilter() {
        const yearFilter = document.getElementById('yearFilter');
        if (!yearFilter) return;

        // Extraer años únicos de los datos de inducciones y ordenarlos
        const years = [...new Set(this.inducciones.map(i => i.year).filter(y => y))]
            .sort((a, b) => b - a);
        console.log('[DEBUG-Filtro] Años únicos encontrados para el filtro:', years);


        yearFilter.innerHTML = '<option value="">Todos los años</option>'; // Opción para mostrar todos

        if (years.length === 0) {
            this.applyFilters();
            return;
        }

        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearFilter.appendChild(option);
        });

        // Seleccionar el año más reciente por defecto si existen años
        if (years.length > 0) {
             this.currentYear = years[0];
             yearFilter.value = years[0];
        }
    }

    generateSampleInducciones() {
        // Datos de ejemplo para las inducciones
        return [
            { id: 1, fecha: '2024-08-05', empleadoId: 1, empleado: 'Javier Robles Fontalvo', cedula: '1044391066', cargo: 'Representante del SG-SST', puntuacion: '22 / 22', estado: 'approved', participantes: 1 },
            { id: 2, fecha: '2024-08-09', empleadoId: 2, empleado: 'Lilia Vásquez Muñoz', cedula: '1129566447', cargo: 'Coordinación Nómina', puntuacion: '22 / 22', estado: 'approved', participantes: 1 },
            { id: 3, fecha: '2024-08-14', empleadoId: 3, empleado: 'Jesus David Manjarres Díaz Granados', cedula: '1045748792', cargo: 'Técnico audiodivisual', puntuacion: '20 / 22', estado: 'approved', participantes: 1 },
            { id: 4, fecha: '2024-08-14', empleadoId: 4, empleado: 'Genisis María cantillo torres', cedula: '1002228922', cargo: 'Mesera', puntuacion: '18 / 22', estado: 'failed', participantes: 1 },
            { id: 5, fecha: '2024-07-30', empleadoId: 5, empleado: 'Jesus alberto polania de la hoz', cedula: '1234567890', cargo: 'Portero', puntuacion: '14 / 22', estado: 'failed', participantes: 1 },
            { id: 6, fecha: '2024-07-25', empleadoId: 6, empleado: 'Michel David Martínez Contreras', cedula: '0987654321', cargo: 'Panadero', puntuacion: '18 / 22', estado: 'failed', participantes: 1 },
            { id: 7, fecha: '2024-07-23', empleadoId: 7, empleado: 'Edilberto carlos olivares charris', cedula: '1122334455', cargo: 'Cocinero', puntuacion: '20 / 22', estado: 'approved', participantes: 1 },
            { id: 8, fecha: '2024-07-19', empleadoId: 8, empleado: 'Honatan Enrique Molina Reyes', cedula: '2233445566', cargo: 'Sub chef', puntuacion: '22 / 22', estado: 'approved', participantes: 1 },
            { id: 9, fecha: '2024-07-19', empleadoId: 9, empleado: 'Carolain', cedula: '3344556677', cargo: 'Operaria integral', puntuacion: '20 / 22', estado: 'approved', participantes: 1 }
        ];
    }

    generateSampleEmployees() {
        // Datos de ejemplo para los empleados
        return [
            { id: 1, nombre: 'Javier Robles Fontalvo', cedula: '1044391066', cargo: 'Representante del SG-SST', fechaNacimiento: '1987-11-06', edad: 37, genero: 'Hombre', estadoInduccion: 'approved' },
            { id: 2, nombre: 'Lilia Vásquez Muñoz', cedula: '1129566447', cargo: 'Coordinación Nómina', fechaNacimiento: '', edad: '-', genero: 'Mujer', estadoInduccion: 'approved' },
            { id: 3, nombre: 'Jesus David Manjarres Díaz Granados', cedula: '1045748792', cargo: 'Técnico audiodivisual', fechaNacimiento: '', edad: '-', genero: 'Hombre', estadoInduccion: 'approved' },
            { id: 4, nombre: 'Genisis María cantillo torres', cedula: '1002228922', cargo: 'Mesera', fechaNacimiento: '', edad: '-', genero: 'Mujer', estadoInduccion: 'failed' }
        ];
    }

    async loadDataForYear(year) {
        this.currentYear = year;
        // Cargar datos específicos del año si es necesario
        this.filteredInducciones = [...this.inducciones];
        this.renderInduccionesTable();
        this.updateDashboardStats();
    }

    applyFilters() {
        const selectedYear = document.getElementById('yearFilter').value;
        console.log(`[DEBUG-Filtro] applyFilters llamado. Año seleccionado: '${selectedYear}'`);

        let filteredData = [...this.inducciones];
        console.log(`[DEBUG-Filtro] Cantidad de registros antes de filtrar: ${filteredData.length}`);

        // Filtrar por año
        if (selectedYear) {
            filteredData = filteredData.filter(i => i.year == selectedYear);
        }

        console.log(`[DEBUG-Filtro] Cantidad de registros después de filtrar: ${filteredData.length}`);

        this.filteredInducciones = filteredData;
        this.renderInduccionesTable();
        this.updateDashboardStats();
    }

    clearFilters() {
        document.getElementById('yearFilter').value = '';
        this.applyFilters();
        this.showNotification('Filtros limpiados.', 'info');
    }

    updateDashboardStats() {
        // Actualizar estadísticas del dashboard
        const total = this.filteredInducciones.length;
        const aprobadas = this.filteredInducciones.filter(i => i.estado === 'approved').length;
        const reprobadas = this.filteredInducciones.filter(i => i.estado === 'failed').length;
        const participantes = this.filteredInducciones.reduce((sum, i) => sum + (parseInt(i.participantes) || 0), 0);
        const porcentaje = total > 0 ? Math.round((aprobadas / total) * 100) : 0;

        console.log('[DEBUG] updateDashboardStats called:');
        console.log(`[DEBUG] Total inducciones: ${total}`);
        console.log(`[DEBUG] Inducciones aprobadas: ${aprobadas}`);
        console.log(`[DEBUG] Inducciones reprobadas: ${reprobadas}`);
        console.log(`[DEBUG] Porcentaje de aprobación: ${porcentaje}%`);

        // Actualizar valores en las tarjetas de estadísticas
        const statCards = document.querySelectorAll('.dashboard-card');
        if (statCards.length >= 4) {
            // Actualizar Total Inducciones
            const totalCardValue = statCards[0].querySelector('.card-value');
            if (totalCardValue) totalCardValue.textContent = total;

            // Actualizar Aprobadas
            const approvedCardValue = statCards[1].querySelector('.card-value');
            if (approvedCardValue) approvedCardValue.textContent = aprobadas;

            // Actualizar Reprobadas
            const failedCardValue = statCards[2].querySelector('.card-value');
            if (failedCardValue) failedCardValue.textContent = reprobadas;

            // Actualizar Puntuación Promedio
            const avgScoreCardValue = statCards[3].querySelector('.card-value');
            if (avgScoreCardValue) {
                const avgScore = this.calculateAverageScore();
                avgScoreCardValue.textContent = avgScore.toFixed(1);
            }
        }

        // Actualizar descripciones
        const descriptions = statCards[0].querySelectorAll('.card-description');
        if (descriptions.length > 0) {
            descriptions[descriptions.length - 1].textContent = `${porcentaje}% de aprobación`;
        }

        // Actualizar tabla de inducciones recientes (siempre del mes en curso)
        this.renderRecentInduccionesTable();

        // Actualizar gráfica de inducciones mensuales para reflejar los filtros aplicados
        this.renderWeeklyChart();
    }

    calculateAverageScore() {
        // Calcular puntuación promedio
        const scores = this.filteredInducciones.map(i => {
            const parts = i.puntuacion.split(' / ');
            return parseFloat(parts[0]) || 0;
        }).filter(score => !isNaN(score));

        if (scores.length === 0) return 0;
        const sum = scores.reduce((acc, score) => acc + score, 0);
        return sum / scores.length;
    }

    renderInduccionesTable() {
        // Renderizar tabla de inducciones
        const tbody = document.querySelector('#inductions-page tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.filteredInducciones.forEach((induccion, index) => {
            // Calcular ID secuencial para mostrar en la tabla (comenzando desde 01)
            const displayId = String(index + 1).padStart(2, '0');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${displayId}</td>
                <td>${this.formatDate(induccion.fecha)}</td>
                <td>${induccion.empleado}</td>
                <td>${induccion.cedula}</td>
                <td>${induccion.cargo}</td>
                <td>${induccion.puntuacion}</td>
                <td><span class="status-badge ${induccion.estado === 'approved' ? 'status-approved' : 'status-failed'}">${induccion.estado === 'approved' ? 'Aprobado' : 'Reprobado'}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="window.currentInduccionesComponent.showInductionDetails(${induccion.id})">Ver Detalles</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.currentInduccionesComponent.editInduction(${induccion.id})">Editar</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.currentInduccionesComponent.deleteInduction(${induccion.id})">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Función para buscar inducciones por cédula o nombre
    searchInducciones(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            // Si no hay término de búsqueda, mostrar todas las inducciones
            this.filteredInducciones = [...this.inducciones];
        } else {
            const term = searchTerm.toLowerCase().trim();
            this.filteredInducciones = this.inducciones.filter(induccion => {
                // Buscar en el nombre del empleado o en la cédula
                return (
                    induccion.empleado.toLowerCase().includes(term) ||
                    induccion.cedula.includes(term)
                );
            });
        }

        // Actualizar la tabla con los resultados filtrados
        this.renderInduccionesTable();
    }

    // Función para inicializar los eventos del buscador
    initializeSearchEvents() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const clearSearchBtn = document.getElementById('clearSearchBtn');

        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    this.searchInducciones(searchInput.value);
                }
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    this.searchInducciones(searchInput.value);
                }
            });
        }

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.value = '';
                    this.searchInducciones('');
                }
            });
        }
    }

    renderRecentInduccionesTable() {
        const tbody = document.getElementById('recent-inductions-tbody');
        if (!tbody) return;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // Usamos this.filteredInducciones en lugar de this.inducciones para respetar los filtros aplicados
        // Primero intentamos filtrar por mes actual
        let recentInducciones = this.filteredInducciones.filter(i => {
            const inductionDate = new Date(i.fecha);
            return inductionDate.getFullYear() === currentYear && (inductionDate.getMonth() + 1) === currentMonth;
        });

        // Si no hay inducciones en el mes actual, mostramos las más recientes del conjunto filtrado
        if (recentInducciones.length === 0) {
            // Tomar las más recientes del conjunto filtrado
            recentInducciones = [...this.filteredInducciones]; // Copiar array para no modificar el original

            // Ordenar por fecha descendente y tomar las más recientes
            recentInducciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            recentInducciones = recentInducciones.slice(0, 10); // Tomar las 10 más recientes
        } else {
            // Si hay inducciones en el mes actual, ordenarlas por fecha
            recentInducciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }

        tbody.innerHTML = '';
        if (recentInducciones.length > 0) {
            recentInducciones.forEach(induccion => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${this.formatDate(induccion.fecha)}</td>
                    <td>${induccion.empleado}</td>
                    <td>${induccion.cargo}</td>
                    <td>${induccion.puntuacion}</td>
                    <td><span class="status-badge ${induccion.estado === 'approved' ? 'status-approved' : 'status-failed'}">${induccion.estado === 'approved' ? 'Aprobado' : 'Reprobado'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="window.currentInduccionesComponent.showInductionDetails(${induccion.id})">Ver Detalles</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            // Si no hay ninguna inducción, mostrar un mensaje
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="6" style="text-align: center; padding: 20px;">No hay inducciones registradas</td>
            `;
            tbody.appendChild(row);
        }
    }

    renderEmployeesTable() {
        // Renderizar tabla de empleados
        const tbody = document.querySelector('#employees-page tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.empleados.forEach(empleado => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${empleado.id}</td>
                <td>${empleado.nombre}</td>
                <td>${empleado.cedula}</td>
                <td>${empleado.cargo}</td>
                <td>${empleado.fechaNacimiento || '-'}</td>
                <td>${empleado.edad}</td>
                <td>${empleado.genero}</td>
                <td><span class="status-badge ${empleado.estadoInduccion === 'approved' ? 'status-approved' : 'status-failed'}">${empleado.estadoInduccion === 'approved' ? 'Aprobado' : 'Reprobado'}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="window.currentInduccionesComponent.viewEmployee(${empleado.id})">Ver</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="window.currentInduccionesComponent.editEmployee(${empleado.id})">Editar</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    formatDate(dateString) {
        // Formatear fecha al formato DD/MM/YYYY
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    showNotification(message, type = 'info') {
        // Mostrar notificación al usuario
        // En una implementación real, usarías un sistema de notificaciones
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    setupSidebarEventListener() {
        // Configurar evento de sidebar si es necesario
    }

    showAddEmployeeModal() {
        const modal = document.getElementById('addEmployeeModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    showAddInductionModal() {
        const modal = document.getElementById('addInductionModal');
        if (modal) {
            // Establecer fecha actual
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('inductionDate').value = today;
            modal.classList.add('active');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    saveEmployee() {
        // Guardar empleado
        const nombre = document.getElementById('employeeName').value;
        const cedula = document.getElementById('employeeId').value;
        const cargo = document.getElementById('employeePosition').value;
        const fechaNacimiento = document.getElementById('employeeBirthdate').value;
        const genero = document.getElementById('employeeGender').value;

        if (!nombre || !cedula) {
            this.showNotification('Nombre y cédula son obligatorios', 'danger');
            return;
        }

        // Crear nuevo empleado
        const nuevoEmpleado = {
            id: this.empleados.length + 1,
            nombre,
            cedula,
            cargo,
            fechaNacimiento,
            edad: fechaNacimiento ? new Date().getFullYear() - new Date(fechaNacimiento).getFullYear() : '-',
            genero,
            estadoInduccion: 'pending'
        };

        this.empleados.push(nuevoEmpleado);
        this.renderEmployeesTable();
        this.closeModal('addEmployeeModal');
        this.showNotification('Empleado guardado correctamente', 'success');

        // Limpiar formulario
        document.getElementById('employeeName').value = '';
        document.getElementById('employeeId').value = '';
        document.getElementById('employeePosition').value = '';
        document.getElementById('employeeBirthdate').value = '';
        document.getElementById('employeeGender').value = '';
    }

    saveInduction() {
        // Guardar inducción
        const empleadoId = document.getElementById('inductionEmployee').value;
        const fecha = document.getElementById('inductionDate').value;
        const lugar = document.getElementById('inductionLocation').value;
        const puntuacion = document.getElementById('inductionScore').value;
        const estado = document.getElementById('inductionStatus').value;

        if (!empleadoId || !fecha || !puntuacion) {
            this.showNotification('Empleado, fecha y puntuación son obligatorios', 'danger');
            return;
        }

        // Obtener nombre del empleado
        const empleado = this.empleados.find(e => e.id == empleadoId);
        if (!empleado) {
            this.showNotification('Empleado no encontrado', 'danger');
            return;
        }

        // Crear nueva inducción
        const nuevaInduccion = {
            id: this.inducciones.length + 1,
            fecha,
            empleadoId: parseInt(empleadoId),
            empleado: empleado.nombre,
            cedula: empleado.cedula,
            cargo: empleado.cargo,
            puntuacion: `${puntuacion} / 22`,
            estado: estado === 'Aprobo' ? 'approved' : 'failed',
            participantes: 1
        };

        this.inducciones.push(nuevaInduccion);
        this.filteredInducciones = [...this.inducciones];
        this.renderInduccionesTable();
        this.updateDashboardStats();
        this.closeModal('addInductionModal');
        this.showNotification('Inducción guardada correctamente', 'success');

        // Limpiar formulario
        document.getElementById('inductionEmployee').value = '';
        document.getElementById('inductionDate').value = '';
        document.getElementById('inductionLocation').value = 'Barranquilla';
        document.getElementById('inductionScore').value = '';
        document.getElementById('inductionStatus').value = 'Aprobo';
    }

    showInductionDetails(id) {
        // Mostrar detalles de la inducción
        const induccion = this.inducciones.find(i => i.id === id);
        if (induccion) {
            this.showNotification(`Detalles de la inducción ${id}: ${induccion.empleado}`, 'info');
        }
    }

    editInduction(id) {
        // Editar inducción
        this.showNotification(`Editar inducción con ID: ${id}`, 'info');
    }

    deleteInduction(id) {
        // Eliminar inducción
        if (confirm('¿Está seguro de eliminar esta inducción?')) {
            this.inducciones = this.inducciones.filter(i => i.id !== id);
            this.filteredInducciones = [...this.inducciones];
            this.renderInduccionesTable();
            this.updateDashboardStats();
            this.showNotification('Inducción eliminada correctamente', 'success');
        }
    }

    viewEmployee(id) {
        // Ver empleado
        const empleado = this.empleados.find(e => e.id === id);
        if (empleado) {
            this.showNotification(`Ver empleado: ${empleado.nombre}`, 'info');
        }
    }

    editEmployee(id) {
        // Editar empleado
        this.showNotification(`Editar empleado con ID: ${id}`, 'info');
    }

    initializeCharts() {
        // Inicializar gráficos si es necesario
        setTimeout(() => {
            this.renderWeeklyChart();
            this.renderPositionChart();
            this.renderApprovalRateChart();
            this.renderErrorRateChart();
        }, 200);
    }

    renderWeeklyChart() {
        // Renderizar gráfico mensual (renombrado de weekly a monthly pero manteniendo el ID del canvas)
        const canvas = document.getElementById('weeklyChart');
        if (canvas && typeof Chart !== 'undefined') {
            const ctx = canvas.getContext('2d');

            // Destruir instancia anterior si existe
            if (canvas.chartInstance) {
                canvas.chartInstance.destroy();
            }

            // Preparar datos mensuales para el año seleccionado
            const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

            // Contar inducciones por mes
            const induccionesRealizadas = Array(12).fill(0);
            const induccionesAprobadas = Array(12).fill(0);

            console.log(`[DEBUG-Gráfica] Total de registros en filteredInducciones: ${this.filteredInducciones.length}`);

            // Usar this.filteredInducciones para respetar los filtros aplicados
            this.filteredInducciones.forEach((induccion, index) => {
                console.log(`[DEBUG-Gráfica] Procesando inducción ${index + 1}: Fecha=${induccion.fecha}, Estado=${induccion.estado}`);

                const fecha = new Date(induccion.fecha);
                if (fecha && !isNaN(fecha.getTime())) {
                    const monthIndex = fecha.getMonth(); // 0 = Enero, 11 = Diciembre
                    console.log(`[DEBUG-Gráfica] Fecha válida: ${fecha}, Mes: ${months[monthIndex]} (${monthIndex})`);

                    // Incrementar contador de inducciones realizadas
                    induccionesRealizadas[monthIndex]++;
                    console.log(`[DEBUG-Gráfica] Inducciones realizadas en ${months[monthIndex]}: ${induccionesRealizadas[monthIndex]}`);

                    // Incrementar contador de inducciones aprobadas si aplica
                    if (induccion.estado === 'approved') {
                        induccionesAprobadas[monthIndex]++;
                        console.log(`[DEBUG-Gráfica] Inducciones aprobadas en ${months[monthIndex]}: ${induccionesAprobadas[monthIndex]}`);
                    }
                } else {
                    console.log(`[DEBUG-Gráfica] Fecha inválida para inducción: ${induccion.fecha}`);
                }
            });

            console.log(`[DEBUG-Gráfica] Datos finales - Realizadas: [${induccionesRealizadas.join(', ')}], Aprobadas: [${induccionesAprobadas.join(', ')}]`);

            canvas.chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Inducciones Realizadas',
                        data: induccionesRealizadas,
                        backgroundColor: 'rgba(26, 115, 232, 0.2)',
                        borderColor: 'rgba(26, 115, 232, 1)',
                        borderWidth: 2,
                        tension: 0.4
                    }, {
                        label: 'Inducciones Aprobadas',
                        data: induccionesAprobadas,
                        backgroundColor: 'rgba(15, 157, 88, 0.2)',
                        borderColor: 'rgba(15, 157, 88, 1)',
                        borderWidth: 2,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0 // Mostrar solo números enteros
                            }
                        }
                    }
                }
            });
        }
    }

    renderPositionChart() {
        // Renderizar gráfico por posición
        const canvas = document.getElementById('positionChart');
        if (canvas && typeof Chart !== 'undefined') {
            const ctx = canvas.getContext('2d');

            // Destruir instancia anterior si existe
            if (canvas.chartInstance) {
                canvas.chartInstance.destroy();
            }

            canvas.chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Supernumerario', 'Cocina', 'Otros'],
                    datasets: [{
                        data: [15, 8, 20],
                        backgroundColor: [
                            'rgba(26, 115, 232, 0.8)',
                            'rgba(15, 157, 88, 0.8)',
                            'rgba(244, 180, 0, 0.8)'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                        }
                    }
                }
            });
        }
    }

    renderApprovalRateChart() {
        // Renderizar gráfico de tasa de aprobación
        const canvas = document.getElementById('approvalRateChart');
        if (canvas && typeof Chart !== 'undefined') {
            const ctx = canvas.getContext('2d');

            // Destruir instancia anterior si existe
            if (canvas.chartInstance) {
                canvas.chartInstance.destroy();
            }

            canvas.chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Mayo', 'Junio', 'Julio', 'Agosto'],
                    datasets: [{
                        label: 'Tasa de Aprobación (%)',
                        data: [75, 82, 78, 85],
                        backgroundColor: 'rgba(26, 115, 232, 0.8)',
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }
    }

    renderErrorRateChart() {
        // Renderizar gráfico de tasa de error
        const canvas = document.getElementById('errorRateChart');
        if (canvas && typeof Chart !== 'undefined') {
            const ctx = canvas.getContext('2d');

            // Destruir instancia anterior si existe
            if (canvas.chartInstance) {
                canvas.chartInstance.destroy();
            }

            canvas.chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Pregunta 7', 'Pregunta 8', 'Pregunta 9', 'Pregunta 10', 'Pregunta 11'],
                    datasets: [{
                        label: 'Tasa de Error (%)',
                        data: [35, 28, 22, 18, 15],
                        backgroundColor: 'rgba(234, 67, 53, 0.8)',
                        borderWidth: 0
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }
    }

    // Función para cargar datos de inducciones desde el archivo Excel
    async loadInduccionesFromExcel() {
        try {
            // Verificar que el archivo exista
            if (!this.excelFilePath) {
                this.showNotification('No se encontró el archivo de inducciones.', 'warning');
                return;
            }

            console.log(`[DEBUG] Intentando leer archivo de inducciones: ${this.excelFilePath}`);

            // Intentar leer el archivo Excel
            // Usar una función genérica de Excel si no hay una específica para inducciones
            const result = await window.electronAPI.readExcelFile(this.excelFilePath);

            if (!result.success) {
                throw new Error(result.error || 'Error al leer el archivo Excel');
            }

            // Procesar los datos del Excel
            // Necesitamos usar una función que pueda leer los datos del Excel
            // Por ahora, intentaremos usar la función de inicialización de Excel genérica
            const initData = await window.electronAPI.initExcel({ filePath: this.excelFilePath });

            if (initData.success) {
                const { processedData, headers } = initData.data;

                // Parsear los datos del Excel a la estructura de inducciones
                this.inducciones = this.parseExcelDataToInducciones(processedData, headers);

                // Actualizar empleados basados en las inducciones
                this.empleados = this.extractEmployeesFromInducciones(this.inducciones);

                // Popular el filtro de año y aplicar el filtro inicial
                this.populateYearFilter();
                this.applyFilters();

                // Renderizar las tablas restantes
                this.renderEmployeesTable();

                this.showNotification(`Datos cargados exitosamente. ${this.inducciones.length} inducciones encontradas.`, 'success');
            } else {
                console.error('Error al inicializar datos del Excel:', initData.error);
                // Si falla, usar datos de ejemplo
                this.inducciones = this.generateSampleInducciones();
                this.empleados = this.generateSampleEmployees();
                this.populateYearFilter();
                this.applyFilters();
                this.renderEmployeesTable();
                this.showNotification('Error al leer el archivo Excel. Se están mostrando datos de ejemplo.', 'warning');
            }
        } catch (error) {
            console.error('Error al cargar datos desde Excel:', error);
            // Si falla completamente, usar datos de ejemplo
            this.inducciones = this.generateSampleInducciones();
            this.empleados = this.generateSampleEmployees();
            this.populateYearFilter();
            this.applyFilters();
            this.renderEmployeesTable();
            this.showNotification('Error al cargar datos desde el archivo Excel. Se están mostrando datos de ejemplo.', 'warning');
        }
    }

    // Función para extraer empleados únicos de las inducciones
    extractEmployeesFromInducciones(inducciones) {
        const uniqueEmployees = new Map();

        inducciones.forEach(induccion => {
            const key = induccion.cedula; // Usar cédula como clave única
            if (!uniqueEmployees.has(key)) {
                uniqueEmployees.set(key, {
                    id: uniqueEmployees.size + 1,
                    nombre: induccion.empleado,
                    cedula: induccion.cedula,
                    cargo: induccion.cargo,
                    fechaNacimiento: '', // No disponible en el archivo de inducciones
                    edad: '-', // No disponible en el archivo de inducciones
                    genero: '', // No disponible en el archivo de inducciones
                    estadoInduccion: induccion.estado
                });
            }
        });

        return Array.from(uniqueEmployees.values());
    }

    // Función para parsear datos de Excel de inducciones
    parseExcelDataToInducciones(processedData, headers) {
        const inducciones = [];

        console.log(`[DEBUG] Total de filas en processedData: ${processedData.length}`);
        console.log(`[DEBUG] Headers:`, headers);

        // Validar que hay datos para procesar
        if (!Array.isArray(processedData) || processedData.length === 0) {
            console.log('[DEBUG] processedData está vacío o no es un array');
            return inducciones;
        }

        // Comenzar a procesar desde la fila 2 (índice 1) asumiendo que los encabezados están en la fila 1 (índice 2)
        const startIndex = 1;

        console.log(`[DEBUG] Comenzando a procesar desde el índice: ${startIndex}`);

        // Los datos empiezan desde el índice 1 (fila 2 del Excel)
        const dataRows = processedData.slice(startIndex);

        console.log(`[DEBUG] Procesando ${dataRows.length} filas de datos desde índice ${startIndex}`);

        // El bucle ahora empieza en 0 porque dataRows[0] es la primera fila de datos real.
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];

            // Ajustar la comprobación de longitud a las columnas que se usarán (mínimo hasta la I, índice 8)
            if (!Array.isArray(row) || row.length < 9) {
                console.log(`[DEBUG] Fila ${i + startIndex + 1} no válida o sin suficientes columnas (longitud: ${row ? row.length : 'undefined'}):`, row);
                continue;
            }

            const getCellValue = (cell) => {
                if (cell === null || cell === undefined) return '';
                if (typeof cell === 'object' && cell.value !== undefined) return cell.value;
                if (typeof cell === 'object') return String(cell);
                return cell;
            };

            // Empleado (Columna G, índice 6)
            const empleadoRaw = getCellValue(row[6]);
            const empleado = String(empleadoRaw || '').trim();

            // Omitir filas vacías o de encabezado residual
            if (!empleado || empleado === 'Nombre del empleado' || empleado === '') {
                console.log(`[DEBUG] Fila ${i + startIndex + 1} sin nombre de empleado válido, saltando: '${empleado}'`);
                continue;
            }

            // Detener si es la fila de totalizadores
            if (typeof empleado === 'string' && empleado.toLowerCase().includes('total inducciones')) {
                console.log('[DEBUG] Encontrado "Total inducciones", deteniendo lectura');
                break;
            }

            // Año (Columna E, índice 4) - Confirmado por usuario
            const yearRaw = getCellValue(row[4]);
            const year = String(yearRaw || '').trim();
            console.log(`[DEBUG-Filtro] Fila ${i + startIndex + 1}: Leyendo año de columna E. Valor: '${year}'`);

            // Si el año está vacío, intentar extraerlo de la fecha
            let finalYear = year;
            if (!finalYear || finalYear === '') {
                // Extraer año de la fecha si está disponible
                const fechaValue = getCellValue(row[3]);
                if (fechaValue) {
                    const fechaStr = String(fechaValue);
                    const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
                    const match = fechaStr.match(dateRegex);
                    if (match) {
                        let yearFromFecha = match[3];
                        if (yearFromFecha.length === 2) {
                            yearFromFecha = `20${yearFromFecha}`; // Asumir siglo 21 para años de 2 colores
                        }
                        finalYear = yearFromFecha;
                    }
                }
            }

            // Cargo (Columna I, índice 8)
            const cargoRaw = getCellValue(row[8]);
            const cargo = String(cargoRaw || 'No especificado');

            // Cédula (Columna H, índice 7)
            const cedulaRaw = getCellValue(row[7]);
            const cedula = String(cedulaRaw || 'No especificada');

            // Fecha (Columna D, índice 3)
            let fecha = 'No especificada';
            const fechaValue = getCellValue(row[3]);

            if (fechaValue !== undefined && fechaValue !== null && fechaValue !== '') {
                if (typeof fechaValue === 'number') {
                    if (fechaValue >= 1) {
                        const utcDate = new Date((fechaValue - 25569) * 86400 * 1000);
                        const year = utcDate.getUTCFullYear();
                        const month = utcDate.getUTCMonth();
                        const day = utcDate.getUTCDate();
                        const localDate = new Date(year, month, day);
                        fecha = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
                    }
                } else {
                    let parsedDate;
                    const fechaStr = String(fechaValue);
                    parsedDate = new Date(fechaStr);
                    if (isNaN(parsedDate.getTime())) {
                        const parts = fechaStr.split('/');
                        if (parts.length === 3) {
                            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                            parsedDate = new Date(year, parts[1] - 1, parts[0]);
                        }
                    }

                    if (parsedDate && !isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 1900) {
                        const year = parsedDate.getFullYear();
                        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(parsedDate.getDate()).padStart(2, '0');
                        fecha = `${year}-${month}-${day}`;
                    } else {
                        console.log(`[DEBUG] Fecha no válida en fila ${i + startIndex + 1}: ${fechaValue}`);
                    }
                }
            }

            // Puntuación (Columna B, índice 1)
            const puntuacionValue = getCellValue(row[1]);
            const puntuacionNum = parseFloat(String(puntuacionValue).split('/')[0].trim());
            const puntuacion = `${!isNaN(puntuacionNum) ? Math.floor(puntuacionNum) : 0} / 22`;

            // Estado (Columna C, índice 2)
            const estadoRaw = getCellValue(row[2]);
            const estadoStr = String(estadoRaw || '');
            let estado = 'pending';
            if (estadoStr.toLowerCase().includes('aprob')) {
                estado = 'approved';
            } else if (estadoStr.toLowerCase().includes('reprob')) {
                estado = 'failed';
            }

            inducciones.push({
                id: inducciones.length + 1,
                rowIndex: i + startIndex + 1,
                empleado: empleado,
                cedula: cedula,
                cargo: cargo,
                fecha: fecha,
                year: finalYear,
                puntuacion: puntuacion,
                estado: estado,
                participantes: 1
            });
        }

        console.log(`[DEBUG] Total inducciones procesadas: ${inducciones.length}`);
        return inducciones;
    }
}
window.InduccionesComponent = InduccionesComponent;