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
                    this.loadCapacitacionesData();
                    this.initializeCharts();

                    // Mostrar la vista de dashboard por defecto
                    this.switchView('dashboard');
                }, 100);
            })
            .catch(error => {
                console.error('Error al cargar la interfaz de capacitaciones:', error);
                this.container.innerHTML = `<div class="alert alert-danger">Error al cargar la interfaz: ${error.message}</div>`;
            });
    }

    initializeEventListeners() {
        // Navegación entre vistas (el selector ahora es .top-nav .nav-link)
        const navLinks = document.querySelectorAll('.top-nav .nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const viewId = link.getAttribute('href').substring(1);
                this.switchView(viewId);
            });
        });

        // Selector de año
        const yearButtons = document.querySelectorAll('.year-selector .btn');
        yearButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                yearButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentYear = parseInt(btn.textContent);
                this.loadCapacitacionesData();
            });
        });

        // Botón flotante de agregar
        const floatingBtn = document.querySelector('.floating-action-btn');
        if (floatingBtn) {
            floatingBtn.addEventListener('click', () => this.showAddTrainingModal());
        }

        // Filtros
        const applyFiltersBtn = document.querySelector('#trainings-view .btn-primary-custom');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => this.applyFilters());
        }

        const clearFiltersBtn = document.querySelector('#trainings-view .btn-outline-secondary');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }

        // Guardar en modales
        const saveTrainingBtn = document.querySelector('#addTrainingModal .btn-primary-custom');
        if (saveTrainingBtn) {
            saveTrainingBtn.addEventListener('click', () => this.saveTraining());
        }

        const updateTrainingBtn = document.querySelector('#editTrainingModal .btn-primary-custom');
        if (updateTrainingBtn) {
            updateTrainingBtn.addEventListener('click', () => this.updateTraining());
        }
        
        const saveInstructorBtn = document.querySelector('#addInstructorModal .btn-primary-custom');
        if (saveInstructorBtn) {
            saveInstructorBtn.addEventListener('click', () => this.saveInstructor());
        }
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
        } else if (viewId === 'instructors') {
            this.renderInstructorsTable();
        } else if (viewId === 'calendar') {
            this.renderCalendar();
        }
    }

    async loadCapacitacionesData() {
        try {
            // Datos de ejemplo - en una implementación real, esto vendría de una API
            this.capacitaciones = [
                { id: 1, nombre: 'Capacitación Riesgos Asociados a la tarea', tipo: 'sst', fechaProgramada: '2025-01-15', instructor: 'Técnico', duracion: '2 Horas', estado: 'pending', participantes: 20 },
                { id: 2, nombre: 'Prevención de lesiones por movimientos repetitivos', tipo: 'sst', fechaProgramada: '2025-01-20', instructor: 'Técnico', duracion: '2 Horas', estado: 'pending', participantes: 15 },
                { id: 3, nombre: 'Uso adecuado y mantenimiento de EPP', tipo: 'sst', fechaProgramada: '2025-05-28', instructor: 'ARL', duracion: '2 Horas', estado: 'pending', participantes: 25 },
                { id: 4, nombre: 'Uso y abuso de alcohol, drogas y tabaquismo', tipo: 'pyp', fechaProgramada: '2025-01-10', instructor: 'Técnico', duracion: '2 Horas', estado: 'completed', participantes: 30 },
                { id: 5, nombre: 'Promoción y prevención del riesgo psicosocial', tipo: 'pyp', fechaProgramada: '2025-02-15', instructor: 'Técnico', duracion: '2 Horas', estado: 'completed', participantes: 18 },
                { id: 6, nombre: 'Prevención de caídas desde altura', tipo: 'sst', fechaProgramada: '2025-03-10', instructor: 'ARL - Olga Pinto', duracion: '2 Horas', estado: 'pending', participantes: 12 },
                { id: 7, nombre: 'Manejo defensivo', tipo: 'pyp', fechaProgramada: '2025-01-25', instructor: 'Técnico', duracion: '2 Horas', estado: 'completed', participantes: 22 },
                { id: 8, nombre: 'Primeros auxilios', tipo: 'pyp', fechaProgramada: '2025-02-28', instructor: 'Técnico', duracion: '4 Horas', estado: 'completed', participantes: 18 }
            ];

            this.filteredCapacitaciones = [...this.capacitaciones];
            this.updateDashboardStats();

            if (this.currentView === 'trainings') {
                this.renderTrainingsTable();
            }
        } catch (error) {
            console.error('Error al cargar datos de capacitaciones:', error);
            this.showNotification('Error al cargar datos de capacitaciones', 'danger');
        }
    }

    updateDashboardStats() {
        const total = this.filteredCapacitaciones.length;
        const completadas = this.filteredCapacitaciones.filter(c => c.estado === 'completed').length;
        const pendientes = this.filteredCapacitaciones.filter(c => c.estado === 'pending').length;
        const participantes = this.filteredCapacitaciones.reduce((sum, c) => sum + c.participantes, 0);
        const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

        // Actualizar valores en las tarjetas de estadísticas
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards.length >= 4) {
            // Actualizar estadística 1: Capacitaciones Programadas
            const statCard1 = statCards[0];  // card primaria
            const valueElement1 = statCard1.querySelector('.stat-value');
            if (valueElement1) valueElement1.textContent = total;

            // Actualizar progreso
            const progressBar1 = statCard1.querySelector('.progress-bar');
            if (progressBar1) progressBar1.style.width = `${porcentaje}%`;

            // Actualizar etiqueta de porcentaje
            const labelElements1 = statCard1.querySelectorAll('.stat-label');
            if (labelElements1.length > 0) {
                labelElements1[labelElements1.length - 1].textContent = `${porcentaje}% Completadas`;
            }

            // Actualizar estadística 2: Capacitaciones Realizadas
            const statCard2 = statCards[1];  // card de éxito
            if (statCard2) {
                const valueElement2 = statCard2.querySelector('.stat-value');
                if (valueElement2) valueElement2.textContent = completadas;
                const labelElements2 = statCard2.querySelectorAll('.stat-label');
                if (labelElements2.length > 0) {
                    labelElements2[labelElements2.length - 1].textContent = 'En el último año';
                }
            }

            // Actualizar estadística 3: Participantes
            const statCard3 = statCards[2];  // card de advertencia
            if (statCard3) {
                const valueElement3 = statCard3.querySelector('.stat-value');
                if (valueElement3) valueElement3.textContent = participantes;
                const labelElements3 = statCard3.querySelectorAll('.stat-label');
                if (labelElements3.length > 0) {
                    labelElements3[labelElements3.length - 1].textContent = 'Este mes';
                }
            }

            // Actualizar estadística 4: Pendientes
            const statCard4 = statCards[3];  // card de peligro
            if (statCard4) {
                const valueElement4 = statCard4.querySelector('.stat-value');
                if (valueElement4) valueElement4.textContent = pendientes;
                const labelElements4 = statCard4.querySelectorAll('.stat-label');
                if (labelElements4.length > 0) {
                    labelElements4[labelElements4.length - 1].textContent = 'Por realizar este mes';
                }
            }
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

        // Limitar número de filas para evitar desbordamiento
        const itemsToShow = this.filteredCapacitaciones.slice(0, 50); // Mostrar máximo 50 registros

        itemsToShow.forEach(cap => {
            const row = document.createElement('tr');

            // Determinar badge de tipo
            const tipoBadge = cap.tipo === 'sst'
                ? '<span class="badge bg-primary">SST</span>'
                : '<span class="badge bg-info">PYP</span>';

            // Determinar badge de estado
            const estadoBadge = cap.estado === 'completed'
                ? '<span class="badge bg-success">Completada</span>'
                : '<span class="badge bg-warning">Pendiente</span>';

            // Determinar acciones según estado
            const acciones = cap.estado === 'pending'
                ? this.getPendingActions(cap.id)
                : this.getCompletedActions(cap.id);

            // Crear la fila con todos los campos
            row.innerHTML = `
                <td>${cap.id}</td>
                <td>${cap.nombre}</td>
                <td>${tipoBadge}</td>
                <td>${this.formatDate(cap.fechaProgramada)}</td>
                <td>${cap.instructor}</td>
                <td>${cap.duracion}</td>
                <td>${estadoBadge}</td>
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
        // Eliminar listeners anteriores para evitar duplicados
        document.querySelectorAll('.edit-training').forEach(btn => {
            btn.removeEventListener('click', this.handleEditTraining);
            btn.addEventListener('click', (e) => this.editTraining(parseInt(e.currentTarget.dataset.id)));
        });

        document.querySelectorAll('.complete-training').forEach(btn => {
            btn.removeEventListener('click', this.handleCompleteTraining);
            btn.addEventListener('click', (e) => this.completeTraining(parseInt(e.currentTarget.dataset.id)));
        });

        document.querySelectorAll('.delete-training').forEach(btn => {
            btn.removeEventListener('click', this.handleDeleteTraining);
            btn.addEventListener('click', (e) => this.deleteTraining(parseInt(e.currentTarget.dataset.id)));
        });

        document.querySelectorAll('.view-training').forEach(btn => {
            btn.removeEventListener('click', this.handleViewTraining);
            btn.addEventListener('click', (e) => this.viewTraining(parseInt(e.currentTarget.dataset.id)));
        });

        document.querySelectorAll('.download-certificate').forEach(btn => {
            btn.removeEventListener('click', this.handleDownloadCertificate);
            btn.addEventListener('click', (e) => this.downloadCertificate(parseInt(e.currentTarget.dataset.id)));
        });
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
                labels: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'],
                datasets: [
                    {
                        label: 'Completadas',
                        data: [5, 7, 4, 8, 6, 9],
                        backgroundColor: 'rgba(32, 106, 93, 0.7)',
                        borderColor: 'rgba(32, 106, 93, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Programadas',
                        data: [6, 8, 5, 9, 7, 10],
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
        return new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
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
        const newTraining = {
            id: Math.max(...this.capacitaciones.map(c => c.id), 0) + 1,
            nombre: document.getElementById('trainingName').value,
            tipo: document.getElementById('trainingType').value,
            fechaProgramada: document.getElementById('trainingDate').value,
            instructor: document.getElementById('trainingInstructor').value,
            duracion: `${document.getElementById('trainingDuration').value} Horas`,
            participantes: parseInt(document.getElementById('trainingParticipants').value),
            estado: 'pending'
        };

        // Validar datos
        if (!newTraining.nombre || !newTraining.tipo || !newTraining.fechaProgramada) {
            this.showNotification('Por favor completa todos los campos obligatorios', 'warning');
            return;
        }

        this.capacitaciones.push(newTraining);
        this.filteredCapacitaciones = [...this.capacitaciones];

        // Cerrar modal
        const modalElement = document.getElementById('addTrainingModal');
        if (modalElement) {
            bootstrap.Modal.getInstance(modalElement)?.hide();
        }

        this.updateDashboardStats();
        this.renderTrainingsTable();
        this.showNotification('Capacitación guardada exitosamente', 'success');
    }

    async updateTraining() {
        const id = parseInt(document.getElementById('editTrainingName')?.getAttribute('data-id') || 0);
        if (!id) {
            console.error('No se pudo obtener el ID para la actualización');
            return;
        }

        const capIndex = this.capacitaciones.findIndex(c => c.id === id);
        if (capIndex === -1) {
            console.error(`No se encontró la capacitación con ID ${id}`);
            return;
        }

        // Actualizar datos
        this.capacitaciones[capIndex] = {
            ...this.capacitaciones[capIndex],
            nombre: document.getElementById('editTrainingName').value,
            tipo: document.getElementById('editTrainingType').value,
            fechaProgramada: document.getElementById('editTrainingDate').value,
            instructor: document.getElementById('editTrainingInstructor').value,
            duracion: `${document.getElementById('editTrainingDuration').value} Horas`,
            participantes: parseInt(document.getElementById('editTrainingParticipants').value),
        };

        this.filteredCapacitaciones = [...this.capacitaciones];

        // Cerrar modal
        const modalElement = document.getElementById('editTrainingModal');
        if (modalElement) {
            bootstrap.Modal.getInstance(modalElement)?.hide();
        }

        this.updateDashboardStats();
        this.renderTrainingsTable();
        this.showNotification('Capacitación actualizada exitosamente', 'success');
    }

    async completeTraining(id) {
        const capIndex = this.capacitaciones.findIndex(c => c.id === id);
        if (capIndex === -1) {
            console.error(`No se encontró la capacitación con ID ${id}`);
            return;
        }

        this.capacitaciones[capIndex].estado = 'completed';
        this.filteredCapacitaciones = [...this.capacitaciones];

        this.updateDashboardStats();
        this.renderTrainingsTable();
        this.showNotification('Capacitación marcada como completada', 'success');
    }

    async deleteTraining(id) {
        if (!confirm('¿Está seguro de que desea eliminar esta capacitación?')) return;

        this.capacitaciones = this.capacitaciones.filter(c => c.id !== id);
        this.filteredCapacitaciones = [...this.capacitaciones];

        this.updateDashboardStats();
        this.renderTrainingsTable();
        this.showNotification('Capacitación eliminada', 'info');
    }

    downloadCertificate(id) {
        this.showNotification(`Descargando certificado para la capacitación ${id}...`, 'info');
        // Lógica para descargar un PDF
    }

    applyFilters() {
        const typeFilter = document.getElementById('typeFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const monthFilter = document.getElementById('monthFilter')?.value || '';

        this.filteredCapacitaciones = this.capacitaciones.filter(cap => {
            const matchType = !typeFilter || cap.tipo === typeFilter;
            const matchStatus = !statusFilter || cap.estado === statusFilter;
            const matchMonth = !monthFilter || new Date(cap.fechaProgramada).getMonth() + 1 == monthFilter;
            return matchType && matchStatus && matchMonth;
        });

        this.renderTrainingsTable();
        this.showNotification('Filtros aplicados', 'success');
    }

    clearFilters() {
        if (document.getElementById('typeFilter')) document.getElementById('typeFilter').value = '';
        if (document.getElementById('statusFilter')) document.getElementById('statusFilter').value = '';
        if (document.getElementById('monthFilter')) document.getElementById('monthFilter').value = '';

        this.filteredCapacitaciones = [...this.capacitaciones];
        this.renderTrainingsTable();
        this.showNotification('Filtros limpiados', 'info');
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