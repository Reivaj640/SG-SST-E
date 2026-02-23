// medicion-ausentismo.js - Componente para el submódulo "3.3.6 Medición del ausentismo por causa médica"

class MedicionAusentismoComponent {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.currentView = 'main'; // 'main', 'ver-ausentismo' o 'registrar-ausentismo'
        this.currentPath = null;
        this.pathHistory = [];
        this.ausentismoFilePath = null; // Para guardar la ruta del archivo
        this.logMessage = (msg, type) => console.log(`[${type}] ${msg}`); // Placeholder
        this.excelInitialized = false; // Para saber si ya inicializamos el gestor de Excel

        this.openDocument = this.openDocument.bind(this);
    }

    render() {
        // Ejecutar cleanup anterior si existe
        if (this.portalMessageCleanup) {
            this.portalMessageCleanup();
            this.portalMessageCleanup = null;
        }
        if (this.iframeMessageCleanup) {
            this.iframeMessageCleanup();
            this.iframeMessageCleanup = null;
        }

        this.container.innerHTML = '';
        // Añadir clase específica para identificar este módulo y permitir estilos específicos
        this.container.classList.add('medicion-ausentismo');
        window.currentMedicionAusentismoComponent = this;

        switch (this.currentView) {
            case 'main':
                this.renderMainView(this.container);
                break;
            case 'ver-ausentismo':
                this.renderVerAusentismoView(this.container);
                break;
            case 'registrar-ausentismo':
                this.renderRegistrarAusentismoView(this.container);
                break;
            case 'seguimiento-incapacidades':
                this.renderSeguimientoIncapacidadesView(this.container);
                break;
            case 'ver-estadisticas':
                this.renderEstadisticasView(this.container);
                break;
            default:
                this.renderMainView(this.container);
        }
    }

    renderMainView(container) {
        // Limpiar padding para que el portal ocupe todo el espacio
        container.style.padding = '0';
        container.style.overflow = 'hidden';

        // Crear iframe para cargar el portal de bienvenida
        const iframe = document.createElement('iframe');
        iframe.src = 'medicion-ausentismo-home.html';
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        `;

        // Manejar mensajes desde el iframe
        const handleIframeMessage = (event) => {
            if (event.source !== iframe.contentWindow) return;

            const data = event.data;
            
            if (data.type === 'back-to-module-request') {
                // Volver al módulo principal
                if (this.onBack && typeof this.onBack === 'function') {
                    this.onBack();
                }
            } else if (data.type === 'ausentismo-home-action') {
                // Manejar acciones del portal
                switch (data.action) {
                    case 'registrar-ausentismo':
                        this.currentView = 'registrar-ausentismo';
                        this.render();
                        break;
                    case 'ver-ausentismo':
                        this.currentView = 'ver-ausentismo';
                        this.render();
                        break;
                    case 'seguimiento-incapacidades':
                        this.currentView = 'seguimiento-incapacidades';
                        this.render();
                        break;
                    case 'ver-estadisticas':
                        this.currentView = 'ver-estadisticas';
                        this.render();
                        break;
                }
            }
        };

        // Agregar listener para mensajes desde el iframe
        window.addEventListener('message', handleIframeMessage);

        // Guardar cleanup para cuando se desmonte
        if (this.portalMessageCleanup) {
            this.portalMessageCleanup();
        }
        this.portalMessageCleanup = () => {
            window.removeEventListener('message', handleIframeMessage);
        };

        // Pasar contexto de empresa al iframe cuando cargue
        iframe.onload = () => {
            try {
                iframe.contentWindow.postMessage({
                    type: 'SET_COMPANY_CONTEXT',
                    company: this.currentCompany
                }, '*');
            } catch (error) {
                console.error('Error al enviar contexto al iframe:', error);
            }
        };

        container.appendChild(iframe);
    }

    createModuleCard(title, description, onClick) {
        const card = document.createElement('div');
        card.className = 'card module-card';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'card-header';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'card-icon-placeholder';
        headerDiv.appendChild(iconDiv);

        const cardTitle = document.createElement('h3');
        cardTitle.textContent = title;
        cardTitle.className = 'card-title';
        headerDiv.appendChild(cardTitle);

        card.appendChild(headerDiv);

        const cardDescription = document.createElement('p');
        cardDescription.textContent = description;
        cardDescription.className = 'card-description';
        card.appendChild(cardDescription);

        const cardButton = document.createElement('button');
        cardButton.className = 'btn btn-primary';
        cardButton.textContent = 'Abrir';
        cardButton.addEventListener('click', onClick);
        card.appendChild(cardButton);

        return card;
    }

    handleViewAusentismo() {
        this.currentView = 'ver-ausentismo';
        this.render();
    }

    handleRegistrarAusentismo() {
        console.log(' handleClick en tarjeta Registrar Ausentismo');
        // Verificar si el componente está disponible
        if (typeof window.RegistrarAusentismoComponent === 'undefined') {
            console.error('RegistrarAusentismoComponent no está definido');
            alert('Error: El componente de registro de ausentismo no está disponible.');
            return;
        }

        // Aquí debemos cargar el componente de RegistrarAusentismoComponent
        // pero primero necesitamos crear una nueva vista para esto
        this.currentView = 'registrar-ausentismo';
        console.log('Cambiando a vista registrar-ausentismo');
        this.render();
    }

    handleVerAusentismo() {
        this.currentView = 'ver-ausentismo';
        this.render();
    }

    handleComingSoon() {
        alert('Esta funcionalidad estará disponible próximamente.');
    }

    handleSeguimientoIncapacidades() {
        // Crear un iframe o contenedor para la nueva funcionalidad
        this.currentView = 'seguimiento-incapacidades';
        this.render();
    }

    async renderSeguimientoIncapacidadesView(container) {
        console.log('[DEBUG] renderSeguimientoIncapacidadesView: Iniciando renderizado de seguimiento moderno.');
        container.innerHTML = '';
        container.style.overflow = 'auto';

        // Guardar referencia global del componente
        window.medicAusentismoComponent = this;

        // Agregar FontAwesome dinámicamente si no está cargado
        if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
            const fontAwesomeLink = document.createElement('link');
            fontAwesomeLink.rel = 'stylesheet';
            fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            document.head.appendChild(fontAwesomeLink);
        }

        // Contenedor principal
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            width: 100%;
        `;

        // Header con botón volver
        const headerSection = document.createElement('div');
        headerSection.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
        `;

        const leftSection = document.createElement('div');
        leftSection.style.cssText = `display: flex; align-items: center; gap: 10px;`;

        const headerIcon = document.createElement('i');
        headerIcon.className = 'fas fa-user-injured';
        headerIcon.style.cssText = `color: #174ea6; font-size: 20px;`;

        const headerTitle = document.createElement('h3');
        headerTitle.textContent = 'Seguimiento de Incapacidades';
        headerTitle.style.cssText = `font-size: 18px; font-weight: 600; margin: 0; color: #1E293B;`;

        leftSection.appendChild(headerIcon);
        leftSection.appendChild(headerTitle);

        const backBtn = document.createElement('button');
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
        backBtn.style.cssText = `
            padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
            cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
            border: 1px solid #dee2e6; background-color: #f8f9fa; color: #64748B;
            transition: all 0.2s;
        `;
        backBtn.onmouseover = function() {
            this.style.backgroundColor = '#e2e8f0';
            this.style.color = '#174ea6';
            this.style.borderColor = '#174ea6';
        };
        backBtn.onmouseout = function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.color = '#64748B';
            this.style.borderColor = '#dee2e6';
        };
        backBtn.onclick = () => {
            this.currentView = 'main';
            this.render();
        };

        headerSection.appendChild(leftSection);
        headerSection.appendChild(backBtn);
        mainContent.appendChild(headerSection);

        // KPI Cards Grid
        const kpiGrid = document.createElement('div');
        kpiGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        `;

        const createKPICard = (icon, title, value, sub, color) => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: white; padding: 20px; border-radius: 12px;
                border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px;
            `;

            const iconDiv = document.createElement('div');
            iconDiv.style.cssText = `
                width: 50px; height: 50px; border-radius: 10px; display: flex;
                align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
                background: ${color.bg}; color: ${color.text};
            `;
            iconDiv.innerHTML = `<i class="${icon}"></i>`;

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = `flex: 1;`;

            const titleEl = document.createElement('h3');
            titleEl.textContent = title;
            titleEl.style.cssText = `font-size: 13px; color: #64748B; margin-bottom: 4px; text-transform: uppercase;`;

            const valueEl = document.createElement('div');
            valueEl.className = 'kpi-value';
            valueEl.textContent = value;
            valueEl.style.cssText = `font-size: 24px; font-weight: 700; color: #1E293B;`;

            const subEl = document.createElement('div');
            subEl.textContent = sub;
            subEl.style.cssText = `font-size: 12px; color: #64748B; margin-top: 2px;`;

            infoDiv.appendChild(titleEl);
            infoDiv.appendChild(valueEl);
            infoDiv.appendChild(subEl);
            card.appendChild(iconDiv);
            card.appendChild(infoDiv);

            return card;
        };

        // Crear las 4 tarjetas KPI
        kpiGrid.appendChild(createKPICard(
            'fas fa-spinner',
            'Casos Activos',
            this.kpiCasosActivos || '0',
            'En seguimiento actual',
            { bg: 'rgba(59, 130, 246, 0.1)', text: '#3B82F6' }
        ));

        kpiGrid.appendChild(createKPICard(
            'fas fa-hourglass-half',
            'Próximos a Vencer',
            this.kpiProximosVencer || '0',
            'Menos de 2 días',
            { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B' }
        ));

        kpiGrid.appendChild(createKPICard(
            'fas fa-file-exclamation',
            'Docs Pendientes',
            this.kpiDocsPendientes || '0',
            'Requieren escaneo',
            { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444' }
        ));

        kpiGrid.appendChild(createKPICard(
            'fas fa-check-circle',
            'Cerrados (Mes)',
            this.kpiCerradosMes || '0',
            'Altas exitosas',
            { bg: 'rgba(16, 185, 129, 0.1)', text: '#10B981' }
        ));

        mainContent.appendChild(kpiGrid);

        // Filters Container
        const filtersContainer = document.createElement('div');
        filtersContainer.style.cssText = `
            background: white; padding: 20px; border-radius: 12px;
            border: 1px solid #e2e8f0; margin-bottom: 20px;
            display: flex; flex-wrap: wrap; align-items: flex-end; gap: 15px;
        `;

        filtersContainer.innerHTML = `
            <div style="flex: 1; min-width: 180px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Buscar Paciente</label>
                <input type="text" id="seguimientoSearchInput" class="form-control" placeholder="Nombre o Cédula..." 
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
            </div>
            <div style="flex: 1; min-width: 180px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Estado</label>
                <select id="seguimientoEstadoFilter" class="form-control" 
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    <option value="En curso">En curso</option>
                    <option value="Próximo a vencer">Próximo a vencer</option>
                    <option value="Finalizado">Finalizado</option>
                </select>
            </div>
            <div style="flex: 1; min-width: 180px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Tipo</label>
                <select id="seguimientoTipoFilter" class="form-control" 
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    <option value="EPS">EPS</option>
                    <option value="ARL">ARL</option>
                </select>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <button id="seguimientoFilterBtn" class="btn btn-primary" 
                    style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: none; background-color: #174ea6; color: white;">
                    <i class="fas fa-filter"></i> Filtrar
                </button>
                <button id="seguimientoClearBtn" class="btn btn-outline" 
                    style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0; background: white; color: #1E293B;">
                    <i class="fas fa-times"></i> Limpiar
                </button>
            </div>
        `;

        mainContent.appendChild(filtersContainer);

        // Table Container
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = `
            background: white; border-radius: 12px;
            border: 1px solid #e2e8f0; overflow: hidden; overflow-x: auto;
        `;

        tableContainer.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; min-width: 1100px;">
                <thead>
                    <tr>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Empleado</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Tipo</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Periodo</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Avance</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Estado</th>
                        <th style="background: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="seguimientoTableBody">
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 40px; color: #64748B;">
                            <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
                            <p>Cargando seguimientos...</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        `;

        mainContent.appendChild(tableContainer);

        // Floating Action Button
        const fab = document.createElement('button');
        fab.className = 'fab-report';
        fab.style.cssText = `
            position: fixed; bottom: 30px; right: 30px; width: 56px; height: 56px;
            border-radius: 50%; background: linear-gradient(135deg, #174ea6, #2d5dc7);
            color: white; border: none; box-shadow: 0 4px 12px rgba(23, 78, 166, 0.4);
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 24px; transition: transform 0.2s; z-index: 50;
        `;
        fab.innerHTML = '<i class="fas fa-file-export"></i><span class="fab-tooltip" style="position: absolute; right: 65px; background: #333; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s;">Generar Informe</span>';
        fab.onmouseover = function() {
            this.style.transform = 'scale(1.1)';
            this.querySelector('.fab-tooltip').style.opacity = '1';
        };
        fab.onmouseout = function() {
            this.style.transform = 'scale(1)';
            this.querySelector('.fab-tooltip').style.opacity = '0';
        };
        fab.onclick = () => {
            this.openExportModal();
        };

        mainContent.appendChild(fab);
        container.appendChild(mainContent);

        // Crear modales
        this.createSeguimientoModals(container);

        // Cargar datos
        this.loadSeguimientoData();

        // Setup event listeners
        setTimeout(() => {
            const filterBtn = document.getElementById('seguimientoFilterBtn');
            const clearBtn = document.getElementById('seguimientoClearBtn');

            if (filterBtn) {
                filterBtn.addEventListener('click', () => {
                    this.applySeguimientoFilters();
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    document.getElementById('seguimientoSearchInput').value = '';
                    document.getElementById('seguimientoEstadoFilter').value = '';
                    document.getElementById('seguimientoTipoFilter').value = '';
                    this.loadSeguimientoData();
                    this.showNotification('Filtros limpiados', 'info');
                });
            }
        }, 0);
    }

    async loadSeguimientoData() {
        try {
            const result = await window.electronAPI.readAusentismoData(this.currentCompany);

            if (result.success && result.rows) {
                // Procesar datos para seguimiento
                const today = new Date();
                const currentMonth = today.toLocaleString('default', { month: 'long' }).toUpperCase();
                
                this.seguimientoData = result.rows.map(row => {
                    const rowObj = {};
                    result.headers.forEach((header, i) => {
                        rowObj[header ? header.trim() : `col_${i}`] = row[i];
                    });
                    return rowObj;
                }).filter(row => {
                    // Filtrar solo casos con fecha de fin futura o reciente (casos activos)
                    const fechaFin = row['F. FIN'] ? new Date(row['F. FIN']) : null;
                    if (!fechaFin) return false;
                    
                    // Incluir casos que aún no han terminado o terminaron este mes
                    const diffTime = fechaFin - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays >= -30; // Casos de los últimos 30 días
                });

                // Calcular KPIs
                this.calculateKPIs();

                // Renderizar tabla
                this.renderSeguimientoTable(this.seguimientoData);
            } else {
                this.renderSeguimientoTable([]);
            }
        } catch (error) {
            console.error('Error loading seguimiento data:', error);
            this.renderSeguimientoTable([]);
        }
    }

    calculateKPIs() {
        const today = new Date();
        const currentMonth = today.toLocaleString('default', { month: 'long' }).toUpperCase();
        let casosActivos = 0;
        let proximosVencer = 0;
        let docsPendientes = 0;
        let cerradosMes = 0;

        this.seguimientoData.forEach(row => {
            const fechaFin = row['F. FIN'] ? new Date(row['F. FIN']) : null;
            const fechaInicio = row['F. INICIO'] ? new Date(row['F. INICIO']) : null;
            
            if (!fechaFin || !fechaInicio) return;

            const diffTime = fechaFin - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Casos activos (fecha fin futura)
            if (diffDays >= 0) {
                casosActivos++;
                
                // Próximos a vencer (menos de 2 días)
                if (diffDays <= 2) {
                    proximosVencer++;
                }
            }

            // Casos cerrados este mes
            const finMonth = fechaFin.toLocaleString('default', { month: 'long' }).toUpperCase();
            const finYear = fechaFin.getFullYear();
            if (finMonth === currentMonth && finYear === today.getFullYear() && diffDays < 0) {
                cerradosMes++;
            }

            // Docs pendientes (simulado - en implementación real verificaría archivos adjuntos)
            if (!row['DESCRIPCION'] || row['DESCRIPCION'].trim() === '') {
                docsPendientes++;
            }
        });

        this.kpiCasosActivos = casosActivos;
        this.kpiProximosVencer = proximosVencer;
        this.kpiDocsPendientes = docsPendientes;
        this.kpiCerradosMes = cerradosMes;

        // Actualizar UI de KPIs
        const kpiElements = document.querySelectorAll('.kpi-value');
        if (kpiElements[0]) kpiElements[0].textContent = casosActivos;
        if (kpiElements[1]) kpiElements[1].textContent = proximosVencer;
        if (kpiElements[2]) kpiElements[2].textContent = docsPendientes;
        if (kpiElements[3]) kpiElements[3].textContent = cerradosMes;
    }

    renderSeguimientoTable(data) {
        const tbody = document.getElementById('seguimientoTableBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #64748B;">
                        <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                        <p>No hay seguimientos para mostrar</p>
                    </td>
                </tr>
            `;
            return;
        }

        const today = new Date();

        tbody.innerHTML = data.map((row, index) => {
            const nombre = row.NOMBRE || 'Sin nombre';
            const cedula = row.CEDULA || '';
            const tipo = row['CLASE DE INCAPACIDAD'] || 'EPS';
            const fechaInicio = row['F. INICIO'] ? new Date(row['F. INICIO']) : null;
            const fechaFin = row['F. FIN'] ? new Date(row['F. FIN']) : null;
            
            // Calcular días totales y transcurridos
            let diasTotales = 0;
            let diasTranscurridos = 0;
            let avance = 0;
            let estado = 'En curso';
            
            if (fechaInicio && fechaFin) {
                const totalTime = fechaFin - fechaInicio;
                diasTotales = Math.ceil(totalTime / (1000 * 60 * 60 * 24)) + 1;
                
                const currentTime = today - fechaInicio;
                diasTranscurridos = Math.max(0, Math.ceil(currentTime / (1000 * 60 * 60 * 24)) + 1);
                
                avance = Math.min(100, Math.round((diasTranscurridos / diasTotales) * 100));
                
                // Determinar estado
                const diffTime = fechaFin - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) {
                    estado = 'Finalizado';
                } else if (diffDays <= 2) {
                    estado = 'Próximo a vencer';
                } else {
                    estado = 'En curso';
                }
            }

            // Colores según estado
            let badgeClass = 'badge-active';
            let progressClass = '';
            if (estado === 'Próximo a vencer') {
                badgeClass = 'badge-pending';
                progressClass = 'warning';
            } else if (estado === 'Finalizado') {
                badgeClass = 'badge-finished';
                progressClass = 'success';
            }

            // Iniciales para avatar
            const initials = nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            // Formatear fechas
            const periodoStr = fechaInicio && fechaFin ? 
                `${fechaInicio.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'})} - ${fechaFin.toLocaleDateString('es-ES', {day: 'numeric', month: 'short'})}` : 
                'Sin fechas';

            return `
                <tr style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#F8FAFC'" onmouseout="this.style.backgroundColor='white'">
                    <td style="padding: 15px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: #F1F5F9; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #64748B; font-size: 14px;">${initials}</div>
                            <div>
                                <div style="font-weight: 500; color: #1E293B;">${nombre}</div>
                                <div style="font-size: 12px; color: #64748B;">CC: ${cedula}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 15px;">
                        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${tipo === 'ARL' ? '#FEF3C7' : '#DCFCE7'}; color: ${tipo === 'ARL' ? '#92400E' : '#166534'};">${tipo}</span>
                    </td>
                    <td style="padding: 15px;">
                        <div style="font-size: 13px; color: #1E293B;">${periodoStr}</div>
                        <div style="font-size: 11px; color: #64748B;">${diasTotales} Días Total</div>
                    </td>
                    <td style="padding: 15px;">
                        <div style="width: 100px;">
                            <div style="font-size: 11px; color: #64748B; margin-bottom: 2px; text-align: right;">${avance}% (${diasTranscurridos} días)</div>
                            <div style="width: 100%; height: 6px; background: #E2E8F0; border-radius: 3px; overflow: hidden;">
                                <div style="width: ${avance}%; height: 100%; background: ${progressClass === 'warning' ? '#F59E0B' : progressClass === 'success' ? '#10B981' : '#3B82F6'}; border-radius: 3px;"></div>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 15px;">
                        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${badgeClass === 'badge-active' ? '#DCFCE7' : badgeClass === 'badge-pending' ? '#FEF3C7' : '#F3F4F6'}; color: ${badgeClass === 'badge-active' ? '#166534' : badgeClass === 'badge-pending' ? '#92400E' : '#374151'};">${estado}</span>
                    </td>
                    <td style="padding: 15px;">
                        <div style="display: flex; gap: 5px;">
                            <button style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748B; transition: all 0.2s;" title="Ver Detalles" onclick="if(window.medicAusentismoComponent) window.medicAusentismoComponent.openDetailModal(${JSON.stringify(row).replace(/"/g, '&quot;')})">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748B; transition: all 0.2s;" title="Agregar Nota" onclick="console.log('Agregar nota:', '${nombre.replace(/'/g, "\\'")}');">
                                <i class="fas fa-sticky-note"></i>
                            </button>
                            <button style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748B; transition: all 0.2s;" title="Adjuntar Archivo" onclick="console.log('Adjuntar:', '${nombre.replace(/'/g, "\\'")}');">
                                <i class="fas fa-paperclip"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    applySeguimientoFilters() {
        const search = document.getElementById('seguimientoSearchInput').value.toLowerCase();
        const estado = document.getElementById('seguimientoEstadoFilter').value;
        const tipo = document.getElementById('seguimientoTipoFilter').value;

        if (!this.seguimientoData) {
            this.showNotification('No hay datos cargados', 'warning');
            return;
        }

        const today = new Date();
        let filtered = this.seguimientoData.filter(row => {
            const nombre = (row.NOMBRE || '').toLowerCase();
            const cedula = (row.CEDULA || '').toLowerCase();
            const matchesSearch = !search || nombre.includes(search) || cedula.includes(search);

            const rowTipo = row['CLASE DE INCAPACIDAD'] || '';
            const matchesTipo = !tipo || rowTipo.toUpperCase() === tipo.toUpperCase();

            let matchesEstado = true;
            if (estado) {
                const fechaFin = row['F. FIN'] ? new Date(row['F. FIN']) : null;
                if (fechaFin) {
                    const diffTime = fechaFin - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (estado === 'En curso') {
                        matchesEstado = diffDays > 2;
                    } else if (estado === 'Próximo a vencer') {
                        matchesEstado = diffDays >= 0 && diffDays <= 2;
                    } else if (estado === 'Finalizado') {
                        matchesEstado = diffDays < 0;
                    }
                }
            }

            return matchesSearch && matchesTipo && matchesEstado;
        });

        this.renderSeguimientoTable(filtered);
        this.showNotification(`${filtered.length} registros encontrados`, 'success');
    }

    createSeguimientoModals(container) {
        // Modal de Exportar
        const exportModal = document.createElement('div');
        exportModal.id = 'exportModal';
        exportModal.className = 'modal-backdrop';
        exportModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.6); z-index: 1000;
            display: none; justify-content: center; align-items: center;
            backdrop-filter: blur(2px);
        `;
        exportModal.innerHTML = `
            <div style="background: white; width: 90%; max-width: 500px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <div style="padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 16px; font-weight: 600;"><i class="fas fa-file-pdf" style="margin-right: 8px; color: #dc3545;"></i>Exportar Informes</div>
                    <button onclick="document.getElementById('exportModal').style.display='none'" style="background: none; border: none; font-size: 20px; color: #64748B; cursor: pointer;">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 15px; font-size: 14px; color: #64748B;">Seleccione el tipo de informe y formato:</p>
                    <div style="margin-bottom: 15px;">
                        <label style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 5px;">Tipo de Reporte</label>
                        <select id="exportReportType" style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                            <option>General de Incapacidades</option>
                            <option>Seguimiento Detallado</option>
                            <option>Casos Abiertos vs Cerrados</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 5px;">Formato</label>
                        <div style="display: flex; gap: 10px; margin-top: 5px;">
                            <div id="exportExcelOption" onclick="this.classList.toggle('selected')" style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;">
                                <i class="fas fa-file-excel" style="color: #10B981;"></i> Excel
                            </div>
                            <div id="exportPdfOption" onclick="this.classList.toggle('selected')" style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;">
                                <i class="fas fa-file-pdf" style="color: #dc3545;"></i> PDF
                            </div>
                        </div>
                    </div>
                </div>
                <div style="padding: 15px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="document.getElementById('exportModal').style.display='none'" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #e2e8f0; background: white; color: #1E293B;">Cancelar</button>
                    <button onclick="console.log('Exportando...'); document.getElementById('exportModal').style.display='none';" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background: #174ea6; color: white;"><i class="fas fa-download"></i> Generar</button>
                </div>
            </div>
        `;
        container.appendChild(exportModal);

        // Modal de Detalle
        const detailModal = document.createElement('div');
        detailModal.id = 'detailModal';
        detailModal.className = 'modal-backdrop';
        detailModal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.6); z-index: 1000;
            display: none; justify-content: center; align-items: center;
            backdrop-filter: blur(2px);
        `;
        detailModal.innerHTML = `
            <div style="background: white; width: 90%; max-width: 600px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <div style="padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 16px; font-weight: 600;">Detalle de Seguimiento</div>
                    <button onclick="document.getElementById('detailModal').style.display='none'" style="background: none; border: none; font-size: 20px; color: #64748B; cursor: pointer;">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div id="detailModalContent" style="margin-bottom: 20px;">
                        <!-- Contenido dinámico -->
                    </div>
                </div>
                <div style="padding: 15px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="document.getElementById('detailModal').style.display='none'" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #e2e8f0; background: white; color: #1E293B;">Cerrar</button>
                </div>
            </div>
        `;
        container.appendChild(detailModal);
    }

    openExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    openDetailModal(row) {
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('detailModalContent');
        
        if (modal && content && row) {
            const nombre = row.NOMBRE || 'Sin nombre';
            const cedula = row.CEDULA || '';
            const tipo = row['CLASE DE INCAPACIDAD'] || 'EPS';
            const fechaInicio = row['F. INICIO'] || 'N/A';
            const fechaFin = row['F. FIN'] || 'N/A';
            const diagnostico = row['DESCRIPCION'] || row['DESCRIPCIÓN'] || 'Sin descripción';
            
            content.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                    <div style="width: 50px; height: 50px; border-radius: 50%; background: #F1F5F9; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #64748B; font-size: 20px;">
                        ${nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div style="margin-left: 15px;">
                        <h3 style="font-size: 18px; margin: 0;">${nombre}</h3>
                        <div style="font-size: 13px; color: #64748B;">CC: ${cedula} | ${tipo}</div>
                    </div>
                </div>
                
                <div style="background: #F8FAFC; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <div style="font-size: 12px; color: #64748B;">Fecha Inicio</div>
                            <div style="font-weight: 500;">${fechaInicio}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #64748B;">Fecha Fin</div>
                            <div style="font-weight: 500;">${fechaFin}</div>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="font-size: 13px; font-weight: 500; margin-bottom: 5px;">Diagnóstico</div>
                    <div style="font-size: 14px; color: #1E293B;">${diagnostico}</div>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: #F8FAFC; border-radius: 8px;">
                    <label style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 5px;">Agregar Nota de Seguimiento</label>
                    <textarea style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; resize: vertical;" rows="2" placeholder="Ej: Verificar estado con EPS..."></textarea>
                </div>
            `;
            
            modal.style.display = 'flex';
        }
    }

    async renderRegistrarAusentismoView(container) {
        console.log('[DEBUG] renderRegistrarAusentismoView: Iniciando renderizado del formulario modernizado.');
        container.innerHTML = '';

        // Contenedor principal modernizado
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            width: 100%;
        `;

        // Notificación toast
        const notificationDiv = document.createElement('div');
        notificationDiv.id = 'notification-toast';
        notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: white;
            border-left: 4px solid #28a745;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border-radius: 4px;
            z-index: 2000;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            font-weight: 500;
            color: #1E293B;
        `;
        mainContent.appendChild(notificationDiv);

        // Contenedor del formulario
        const formContainer = document.createElement('div');
        formContainer.className = 'registrar-ausentismo-form';
        formContainer.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            border: 1px solid #dee2e6;
        `;

        // Header del formulario con botón volver
        const formHeader = document.createElement('div');
        formHeader.className = 'form-header-responsive';
        formHeader.style.cssText = `
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        `;
        
        const leftSection = document.createElement('div');
        leftSection.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const formIcon = document.createElement('i');
        formIcon.className = 'fas fa-plus-circle';
        formIcon.style.cssText = `color: #174ea6; font-size: 20px;`;
        
        const formTitleContainer = document.createElement('div');
        const formTitle = document.createElement('h3');
        formTitle.textContent = 'Formulario de Registro';
        formTitle.style.cssText = `font-size: 18px; font-weight: 600; margin: 0; color: #1E293B;`;
        
        const formSubtitle = document.createElement('p');
        formSubtitle.textContent = 'Ingrese los datos completos para registrar una nueva incapacidad.';
        formSubtitle.style.cssText = `font-size: 14px; color: #64748B; margin: 4px 0 0 0;`;
        
        formTitleContainer.appendChild(formTitle);
        formTitleContainer.appendChild(formSubtitle);
        leftSection.appendChild(formIcon);
        leftSection.appendChild(formTitleContainer);
        
        // Botón Volver
        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
        backBtn.style.cssText = `
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #dee2e6;
            background-color: #f8f9fa;
            color: #64748B;
            transition: all 0.2s;
            white-space: nowrap;
        `;
        backBtn.onmouseover = function() {
            this.style.backgroundColor = '#e2e8f0';
            this.style.color = '#174ea6';
            this.style.borderColor = '#174ea6';
        };
        backBtn.onmouseout = function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.color = '#64748B';
            this.style.borderColor = '#dee2e6';
        };
        backBtn.onclick = () => {
            this.currentView = 'main';
            this.render();
        };
        
        formHeader.appendChild(leftSection);
        formHeader.appendChild(backBtn);
        formContainer.appendChild(formHeader);

        // Área de estado (oculta por defecto)
        const statusDiv = document.createElement('div');
        statusDiv.id = 'form-status';
        statusDiv.style.cssText = `
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 8px;
            font-weight: 500;
            text-align: center;
            display: none;
        `;
        formContainer.appendChild(statusDiv);

        // Agregar estilos responsivos
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            .form-grid-responsive {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
            }
            .form-grid-responsive .full-width {
                grid-column: span 2;
            }
            @media (max-width: 768px) {
                .form-grid-responsive {
                    grid-template-columns: 1fr;
                }
                .form-grid-responsive .full-width {
                    grid-column: span 1;
                }
                .form-header-responsive {
                    flex-direction: column !important;
                    align-items: flex-start !important;
                }
                .form-header-responsive .back-btn {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        formContainer.appendChild(styleTag);

        // Formulario con grid layout responsivo
        const form = document.createElement('form');
        form.id = 'registrar-ausentismo-form';
        form.className = 'form-grid-responsive';

        form.innerHTML = `
            <div class="form-group-modern">
                <label for="cedula-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Cédula del Empleado</label>
                <input type="text" id="cedula-input" class="form-control-modern" placeholder="Ej: 12345678" 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="nombre-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Nombre Completo</label>
                <input type="text" id="nombre-input" class="form-control-modern" placeholder="Nombre completo" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="cargo-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Cargo</label>
                <input type="text" id="cargo-input" class="form-control-modern" placeholder="Cargo actual" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="departamento-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Departamento / Área</label>
                <input type="text" id="departamento-input" class="form-control-modern" placeholder="Departamento" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="empresa-usuaria-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Empresa Usuaria</label>
                <input type="text" id="empresa-usuaria-input" class="form-control-modern" placeholder="Empresa donde presta el servicio" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="genero-select" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Género</label>
                <select id="genero-select" class="form-control-modern" 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                </select>
            </div>

            <div class="form-group-modern">
                <label for="clase-incapacidad-select" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Clase de Incapacidad</label>
                <select id="clase-incapacidad-select" class="form-control-modern" required
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="EPS">EPS</option>
                    <option value="ARL">ARL</option>
                    <option value="EMPRESA">EMPRESA</option>
                </select>
            </div>

            <div class="form-group-modern">
                <label for="tipo-incapacidad-select" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Tipo de Incapacidad</label>
                <select id="tipo-incapacidad-select" class="form-control-modern" required
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="ACCIDENTE DE TRANSITO">ACCIDENTE DE TRANSITO</option>
                    <option value="ACCIDENTE LABORAL">ACCIDENTE LABORAL</option>
                    <option value="ENFERMEDAD GENERAL">ENFERMEDAD GENERAL</option>
                    <option value="LICENCIA DE LUTO">LICENCIA DE LUTO</option>
                    <option value="LICENCIA DE MATERNIDAD">LICENCIA DE MATERNIDAD</option>
                    <option value="LICENCIA DE PATERNIDAD">LICENCIA DE PATERNIDAD</option>
                    <option value="CALAMIDAD DOMÉSTICA">CALAMIDAD DOMÉSTICA</option>
                </select>
            </div>

            <div class="form-group-modern">
                <label for="entidad-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Entidad (EPS/ARL)</label>
                <input type="text" id="entidad-input" class="form-control-modern" placeholder="Entidad de salud" readonly
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #f8f9fa; cursor: not-allowed;"
                    onfocus="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="fecha-inicio-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Fecha de Inicio</label>
                <input type="date" id="fecha-inicio-input" class="form-control-modern" required
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="fecha-fin-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Fecha de Finalización</label>
                <input type="date" id="fecha-fin-input" class="form-control-modern" required
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="codigo-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Código Diagnóstico (CIE-10)</label>
                <input type="text" id="codigo-input" class="form-control-modern" placeholder="Ej: Z34.0"
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern full-width">
                <label for="descripcion-input" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Descripción Diagnóstico</label>
                <input type="text" id="descripcion-input" class="form-control-modern" placeholder="Descripción del diagnóstico"
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-actions-modern full-width" style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 15px; border-top: 1px solid #dee2e6; padding-top: 20px; flex-wrap: wrap;">
                <button type="button" id="limpiar-btn" class="btn btn-secondary-modern"
                    style="padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #dee2e6; background-color: #f8f9fa; color: #1E293B; transition: all 0.2s;"
                    onmouseover="this.style.backgroundColor='#e2e8f0'; this.style.transform='translateY(-1px)'"
                    onmouseout="this.style.backgroundColor='#f8f9fa'; this.style.transform='translateY(0)'">
                    <i class="fas fa-eraser"></i> Limpiar
                </button>
                <button type="button" id="registrar-btn" class="btn btn-primary-modern"
                    style="padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: none; background-color: #174ea6; color: white; transition: all 0.2s;"
                    onmouseover="this.style.backgroundColor='#185abd'; this.style.transform='translateY(-1px)'"
                    onmouseout="this.style.backgroundColor='#174ea6'; this.style.transform='translateY(0)'">
                    <i class="fas fa-save"></i> Registrar Incapacidad
                </button>
            </div>
        `;

        formContainer.appendChild(form);
        mainContent.appendChild(formContainer);
        container.appendChild(mainContent);

        // Setup de eventos
        setTimeout(() => {
            console.log('Event listeners setup started');
            console.log('Current company:', this.currentCompany);

            // 1. Autocompletar al salir del campo Cédula
            const cedulaInput = document.getElementById('cedula-input');
            if (cedulaInput) {
                console.log('Cédula input found, adding blur event listener');
                cedulaInput.addEventListener('blur', async () => {
                    const cedula = cedulaInput.value.trim();
                    if (!cedula) return;

                    this.showStatus(statusDiv, 'Buscando empleado...', 'info');

                    try {
                        const result = await window.electronAPI.buscarEmpleadoPorCedula(cedula, this.currentCompany);

                        if (result && result.success) {
                            document.getElementById('nombre-input').value = result.datos.nombre || '';
                            document.getElementById('cargo-input').value = result.datos.cargo || '';
                            document.getElementById('departamento-input').value = result.datos.area || '';
                            document.getElementById('empresa-usuaria-input').value = result.datos.empresa_usuaria || '';
                            document.getElementById('entidad-input').value = result.datos.entidad || '';

                            if (result.datos.empresa && this.currentCompany.toUpperCase() !== result.datos.empresa.toUpperCase()) {
                                this.currentCompany = result.datos.empresa;
                                this.showStatus(statusDiv, `Empleado encontrado. Contexto actualizado: ${this.currentCompany}`, 'success');
                            } else {
                                this.showStatus(statusDiv, 'Empleado encontrado.', 'success');
                            }
                        } else {
                            this.showStatus(statusDiv, 'Empleado no encontrado. Diligencie manualmente.', 'warning');
                            document.getElementById('nombre-input').value = '';
                            document.getElementById('cargo-input').value = '';
                            document.getElementById('departamento-input').value = '';
                            document.getElementById('empresa-usuaria-input').value = '';
                            document.getElementById('entidad-input').value = '';
                        }
                    } catch (error) {
                        console.error('Error buscando empleado:', error);
                        this.showStatus(statusDiv, `Error: ${error.message}`, 'error');
                    }
                });
            }

            // 2. Autocompletar descripción CIE-10
            const codigoInput = document.getElementById('codigo-input');
            if (codigoInput) {
                codigoInput.addEventListener('blur', async () => {
                    const cie10Code = codigoInput.value.trim();
                    if (!cie10Code) return;

                    this.showStatus(statusDiv, 'Buscando descripción...', 'info');

                    try {
                        const result = await window.electronAPI.buscarCie10Descripcion(this.currentCompany, cie10Code);

                        if (result && result.success) {
                            document.getElementById('descripcion-input').value = result.datos.descripcion || '';
                            this.showStatus(statusDiv, 'Descripción encontrada.', 'success');
                        } else {
                            this.showStatus(statusDiv, 'Descripción no encontrada.', 'warning');
                            document.getElementById('descripcion-input').value = '';
                        }
                    } catch (error) {
                        this.showStatus(statusDiv, `Error: ${error.message}`, 'error');
                    }
                });
            }

            // 3. Registrar incapacidad
            const registrarBtn = document.getElementById('registrar-btn');
            if (registrarBtn) {
                registrarBtn.addEventListener('click', async () => {
                    const formData = this.getFormData();
                    if (!this.validateFormData(formData)) {
                        this.showStatus(statusDiv, 'Complete campos obligatorios.', 'error');
                        return;
                    }

                    if (new Date(formData.fecha_inicio) > new Date(formData.fecha_finalizacion)) {
                        this.showStatus(statusDiv, 'Fecha inicio no puede ser posterior a fecha fin.', 'error');
                        return;
                    }

                    this.showNotification('Registrando incapacidad...', 'info');
                    this.disableForm(true);

                    try {
                        const ausentismoResult = await window.electronAPI.readAusentismoData(this.currentCompany);
                        if (!ausentismoResult.success) throw new Error(ausentismoResult.error);

                        const result = await window.electronAPI.procesarAusentismo(this.currentCompany, formData);

                        if (result.success) {
                            this.showNotification('¡Incapacidad registrada exitosamente!', 'success');
                            this.limpiarFormulario();
                            statusDiv.style.display = 'none';
                        } else {
                            throw new Error(result.error);
                        }
                    } catch (error) {
                        this.showNotification(`Error: ${error.message}`, 'error');
                    } finally {
                        this.disableForm(false);
                    }
                });
            }

            // 4. Limpiar formulario
            const limpiarBtn = document.getElementById('limpiar-btn');
            if (limpiarBtn) {
                limpiarBtn.addEventListener('click', () => {
                    this.limpiarFormulario();
                    statusDiv.style.display = 'none';
                    this.showNotification('Formulario limpiado.', 'info');
                });
            }
        }, 0);
    }

    // --- Funciones Auxiliares para el Formulario ---

    showStatus(statusDiv, message, type) {
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        statusDiv.className = 'status-message'; // Clase base

        switch (type) {
            case 'success':
                statusDiv.style.backgroundColor = '#d4edda';
                statusDiv.style.color = '#155724';
                break;
            case 'error':
                statusDiv.style.backgroundColor = '#f8d7da';
                statusDiv.style.color = '#721c24';
                break;
            case 'warning':
                statusDiv.style.backgroundColor = '#fff3cd';
                statusDiv.style.color = '#856404';
                break;
            case 'info':
            default:
                statusDiv.style.backgroundColor = '#d1ecf1';
                statusDiv.style.color = '#0c5460';
                break;
        }
    }

    showNotification(message, type = 'success') {
        const notificationDiv = document.getElementById('notification-toast');
        if (!notificationDiv) return;
        
        notificationDiv.textContent = message;
        notificationDiv.style.borderLeftColor = type === 'error' ? '#dc3545' : '#28a745';
        notificationDiv.style.transform = 'translateX(0)';

        setTimeout(() => {
            notificationDiv.style.transform = 'translateX(120%)';
        }, 3000);
    }

    disableForm(disabled) {
        const inputs = document.querySelectorAll('.registrar-ausentismo-form input, .registrar-ausentismo-form select, .registrar-ausentismo-form button');
        inputs.forEach(input => input.disabled = disabled);
    }

    getFormData() {
        return {
            cedula: document.getElementById('cedula-input').value.trim(),
            nombre: document.getElementById('nombre-input').value.trim(),
            cargo: document.getElementById('cargo-input').value.trim(),
            departamento: document.getElementById('departamento-input').value.trim(),
            clase_incapacidad: document.getElementById('clase-incapacidad-select').value,
            tipo_incapacidad: document.getElementById('tipo-incapacidad-select').value,
            fecha_inicio: document.getElementById('fecha-inicio-input').value,
            fecha_finalizacion: document.getElementById('fecha-fin-input').value,
            codigo: document.getElementById('codigo-input').value.trim(),
            descripcion: document.getElementById('descripcion-input').value.trim()
        };
    }

    validateFormData(data) {
        // Campos obligatorios
        const requiredFields = ['cedula', 'nombre', 'clase_incapacidad', 'tipo_incapacidad', 'fecha_inicio', 'fecha_finalizacion'];
        for (const field of requiredFields) {
            if (!data[field]) {
                return false;
            }
        }
        return true;
    }

    limpiarFormulario() {
    // Limpiar campos de entrada
    const inputs = document.querySelectorAll('.registrar-ausentismo-form input:not([type="button"])');
    inputs.forEach(input => input.value = '');

    // Limpiar selects
    const selects = document.querySelectorAll('.registrar-ausentismo-form select');
    selects.forEach(select => select.selectedIndex = 0);

    // Los campos readonly ya se limpian explícitamente
    document.getElementById('nombre-input').value = '';
    document.getElementById('cargo-input').value = '';
    document.getElementById('departamento-input').value = '';
    document.getElementById('empresa-usuaria-input').value = '';
    document.getElementById('entidad-input').value = '';
    }

    renderVerAusentismoView(container) {
        console.log('[DEBUG] renderVerAusentismoView: Iniciando renderizado de lista de registros.');
        container.innerHTML = '';

        // Contenedor principal modernizado
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            width: 100%;
        `;

        // Notificación toast
        const notificationDiv = document.createElement('div');
        notificationDiv.id = 'notification-toast-list';
        notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: white;
            border-left: 4px solid #28a745;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border-radius: 4px;
            z-index: 2000;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            font-weight: 500;
            color: #1E293B;
        `;
        mainContent.appendChild(notificationDiv);

        // Contenedor de la lista
        const listContainer = document.createElement('div');
        listContainer.className = 'ver-ausentismo-list';
        listContainer.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            border: 1px solid #dee2e6;
        `;

        // Header de la lista
        const listHeader = document.createElement('div');
        listHeader.style.cssText = `
            padding: 20px 25px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        `;

        const leftSection = document.createElement('div');
        leftSection.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        const listIcon = document.createElement('i');
        listIcon.className = 'fas fa-list-ul';
        listIcon.style.cssText = `color: #174ea6; font-size: 20px;`;

        const listTitleContainer = document.createElement('div');
        const listTitle = document.createElement('h3');
        listTitle.textContent = 'Registros de Ausentismo';
        listTitle.style.cssText = `font-size: 18px; font-weight: 600; margin: 0; color: #1E293B;`;

        const listSubtitle = document.createElement('p');
        listSubtitle.textContent = 'Consulta y filtra el histórico de incapacidades.';
        listSubtitle.style.cssText = `font-size: 14px; color: #64748B; margin: 4px 0 0 0;`;

        listTitleContainer.appendChild(listTitle);
        listTitleContainer.appendChild(listSubtitle);
        leftSection.appendChild(listIcon);
        leftSection.appendChild(listTitleContainer);

        // Botón Volver
        const backBtn = document.createElement('button');
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
        backBtn.style.cssText = `
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #dee2e6;
            background-color: #f8f9fa;
            color: #64748B;
            transition: all 0.2s;
            white-space: nowrap;
        `;
        backBtn.onmouseover = function() {
            this.style.backgroundColor = '#e2e8f0';
            this.style.color = '#174ea6';
            this.style.borderColor = '#174ea6';
        };
        backBtn.onmouseout = function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.color = '#64748B';
            this.style.borderColor = '#dee2e6';
        };
        backBtn.onclick = () => {
            this.currentView = 'main';
            this.render();
        };

        listHeader.appendChild(leftSection);
        listHeader.appendChild(backBtn);
        listContainer.appendChild(listHeader);

        // Barra de filtros
        const filtersBar = document.createElement('div');
        filtersBar.style.cssText = `
            padding: 20px 25px;
            border-bottom: 1px solid #dee2e6;
            background: #f8f9fa;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        `;

        filtersBar.innerHTML = `
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Buscar</label>
                <input type="text" id="searchFilter" placeholder="Nombre, Cédula..." 
                    style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
            </div>
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Año</label>
                <select id="yearFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Todos</option>
                    ${new Date().getFullYear()}
                    <option value="${new Date().getFullYear() - 1}">${new Date().getFullYear() - 1}</option>
                    <option value="${new Date().getFullYear() - 2}">${new Date().getFullYear() - 2}</option>
                </select>
            </div>
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Mes</label>
                <select id="monthFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Todos</option>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
            </div>
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Tipo</label>
                <select id="typeFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Todos</option>
                    <option value="EPS">EPS</option>
                    <option value="ARL">ARL</option>
                    <option value="EMPRESA">EMPRESA</option>
                </select>
            </div>
            <div style="display: flex; align-items: flex-end; gap: 10px;">
                <button id="applyFiltersBtn" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background-color: #174ea6; color: white; transition: all 0.2s;">
                    <i class="fas fa-filter"></i> Filtrar
                </button>
                <button id="clearFiltersBtn" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #dee2e6; background-color: #f8f9fa; color: #64748B; transition: all 0.2s;">
                    <i class="fas fa-times"></i> Limpiar
                </button>
            </div>
        `;

        listContainer.appendChild(filtersBar);

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'ausentismo-table-wrapper';
        tableWrapper.style.cssText = `
            overflow-x: auto;
            overflow-y: auto;
            max-height: calc(100vh - 400px);
            min-height: 400px;
            border-radius: 8px;
        `;

        // Agregar estilos para scrollbar personalizado
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            .ausentismo-table-wrapper::-webkit-scrollbar {
                width: 10px;
                height: 10px;
            }
            .ausentismo-table-wrapper::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 8px;
            }
            .ausentismo-table-wrapper::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 8px;
            }
            .ausentismo-table-wrapper::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
            .ausentismo-table {
                min-width: 1600px;
            }
            @media (max-width: 1400px) {
                .ausentismo-table {
                    min-width: 1400px;
                }
            }
        `;
        listContainer.appendChild(styleTag);

        const table = document.createElement('table');
        table.className = 'ausentismo-table';
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
        `;

        table.innerHTML = `
            <thead>
                <tr>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">No</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Nombre</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Cédula</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Cargo</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Empresa Usuaria</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Área/Dpto</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Género</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Mes</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">N° Días</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Clase</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Tipo</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Entidad</th>
                    <th style="background-color: #f1f5f9; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748B; position: sticky; top: 0; z-index: 5;">Descripción</th>
                </tr>
            </thead>
            <tbody id="ausentismoTableBody">
                <tr>
                    <td colspan="13" style="text-align: center; padding: 40px; color: #64748B;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
                        <p>Cargando registros...</p>
                    </td>
                </tr>
            </tbody>
        `;

        tableWrapper.appendChild(table);
        listContainer.appendChild(tableWrapper);
        mainContent.appendChild(listContainer);
        container.appendChild(mainContent);

        // Cargar datos
        this.loadAusentismoData(table, notificationDiv);

        // Setup de eventos de filtros
        setTimeout(() => {
            const applyBtn = document.getElementById('applyFiltersBtn');
            const clearBtn = document.getElementById('clearFiltersBtn');

            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    this.applyFilters(table, notificationDiv);
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    document.getElementById('searchFilter').value = '';
                    document.getElementById('yearFilter').value = '';
                    document.getElementById('monthFilter').value = '';
                    document.getElementById('typeFilter').value = '';
                    this.loadAusentismoData(table, notificationDiv);
                    this.showNotification('Filtros limpiados', 'info', 'notification-toast-list');
                });
            }
        }, 0);
    }

    async loadAusentismoData(tableElement, notificationDiv) {
        try {
            const result = await window.electronAPI.readAusentismoData(this.currentCompany);

            if (result.success && result.rows) {
                console.log('[DEBUG] Headers del Excel:', result.headers);
                console.log('[DEBUG] Primera fila de datos:', result.rows[0]);
                
                this.currentAusentismoData = result.rows.map((row, index) => {
                    const rowObj = {};
                    result.headers.forEach((header, i) => {
                        const cleanHeader = header ? header.trim() : `col_${i}`;
                        rowObj[cleanHeader] = row[i];
                        // Guardar también en minúsculas para búsqueda flexible
                        rowObj[cleanHeader.toLowerCase().replace(/\s+/g, '_')] = row[i];
                    });
                    rowObj.no = index + 1;
                    return rowObj;
                });
                
                // Debug: mostrar las primeras filas con todos sus campos
                console.log('[DEBUG] Primer registro procesado:', this.currentAusentismoData[0]);
                console.log('[DEBUG] Total registros:', this.currentAusentismoData.length);
                
                this.renderTable(tableElement, this.currentAusentismoData);
            } else {
                this.renderTable(tableElement, []);
                this.showNotification('No hay registros disponibles', 'warning', notificationDiv.id);
            }
        } catch (error) {
            console.error('Error loading ausentismo data:', error);
            this.renderTable(tableElement, []);
            this.showNotification(`Error: ${error.message}`, 'error', notificationDiv.id);
        }
    }

    applyFilters(tableElement, notificationDiv) {
        const search = document.getElementById('searchFilter').value.toLowerCase();
        const year = document.getElementById('yearFilter').value;
        const month = document.getElementById('monthFilter').value;
        const type = document.getElementById('typeFilter').value;

        if (!this.currentAusentismoData) {
            this.showNotification('No hay datos cargados', 'warning', notificationDiv.id);
            return;
        }

        let filtered = this.currentAusentismoData.filter(row => {
            const nombre = (row.NOMBRE || '').toLowerCase();
            const cedula = (row.CEDULA || '').toLowerCase();
            const matchesSearch = !search || nombre.includes(search) || cedula.includes(search);
            const matchesYear = !year || (row['FECHA INICIO'] || '').includes(year);
            const matchesMonth = !month || {
                '1': 'ENERO', '2': 'FEBRERO', '3': 'MARZO', '4': 'ABRIL',
                '5': 'MAYO', '6': 'JUNIO', '7': 'JULIO', '8': 'AGOSTO',
                '9': 'SEPTIEMBRE', '10': 'OCTUBRE', '11': 'NOVIEMBRE', '12': 'DICIEMBRE'
            }[month] === row.MES;
            const matchesType = !type || (row['CLASE DE INCAPACIDAD'] || '').toUpperCase().includes(type);

            return matchesSearch && matchesYear && matchesMonth && matchesType;
        });

        this.renderTable(tableElement, filtered);
        this.showNotification(`${filtered.length} registros encontrados`, 'success', notificationDiv.id);
    }

    renderTable(tableElement, data) {
        const tbody = tableElement.querySelector('#ausentismoTableBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="13" style="text-align: center; padding: 40px; color: #64748B;">
                        <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                        <p>No hay registros para mostrar</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map((row, index) => {
            const clase = row['CLASE DE INCAPACIDAD'] || 'EPS';
            const tipo = row['TIPO DE INCAPACIDAD'] || '-';
            let badgeColor = '#dbeafe';
            let badgeText = '#1d4ed8';
            if (clase === 'ARL') {
                badgeColor = '#fef3c7';
                badgeText = '#d97706';
            } else if (clase.includes('LICENCIA')) {
                badgeColor = '#d1fae5';
                badgeText = '#059669';
            }

            // Obtener valores de todas las columnas - Nombres exactos del Excel
            const no = row.no || index + 1;
            const nombre = row.NOMBRE || '-';
            const cedula = row.CEDULA || '-';
            const cargo = row.CARGO || '-';
            const empresaUsuaria = row['EMPRESA USUARIA'] || '-';
            
            // Buscar columna Área/Dpto con múltiples variaciones (igual que Descripción)
            // Según los headers reales del Excel: "ÁREA O DPTO"
            const areaDpto = row['ÁREA O DPTO'] || row['AREA O DPTO'] || 
                            row['AREA'] || row['ÁREA'] || row['DEPARTAMENTO'] || 
                            row.area_o_dpto || row.area || row.departamento || 
                            row['AREA/DPTO'] || row['ÁREA/DPTO'] || '-';
            
            const genero = row.GENERO || '-';
            const mes = row.MES || '-';
            const noDias = row['N° DIAS DE INCAPACIDAD'] || '0';
            const entidad = row.ENTIDAD || '-';
            // Según headers reales del Excel: "DESCRIPCION" (sin tilde en los datos procesados)
            const descripcion = row['DESCRIPCION'] || row['DESCRIPCIÓN'] || '-';

            return `
                <tr style="border-bottom: 1px solid #dee2e6; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8fafc'" onmouseout="this.style.backgroundColor='white'">
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${no}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 180px; overflow: hidden; text-overflow: ellipsis;" title="${nombre}">${nombre}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${cedula}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 120px; overflow: hidden; text-overflow: ellipsis;" title="${cargo}">${cargo}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${empresaUsuaria}">${empresaUsuaria}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 120px; overflow: hidden; text-overflow: ellipsis;" title="${areaDpto}">${areaDpto}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${genero}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${mes}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${noDias}</td>
                    <td style="padding: 12px 15px;">
                        <span style="padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; background-color: ${badgeColor}; color: ${badgeText}; white-space: nowrap;">
                            ${clase}
                        </span>
                    </td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${tipo}">${tipo}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; white-space: nowrap;">${entidad}</td>
                    <td style="padding: 12px 15px; font-size: 14px; color: #1E293B; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${descripcion}">${descripcion}</td>
                </tr>
            `;
        }).join('');
    }

    showNotification(message, type = 'success', elementId = 'notification-toast') {
        const notificationDiv = document.getElementById(elementId);
        if (!notificationDiv) return;

        notificationDiv.textContent = message;
        notificationDiv.style.borderLeftColor = type === 'error' ? '#dc3545' : 
                                                type === 'warning' ? '#ffc107' : '#28a745';
        notificationDiv.style.transform = 'translateX(0)';

        setTimeout(() => {
            notificationDiv.style.transform = 'translateX(120%)';
        }, 3000);
    }

    renderEstadisticasView(container) {
        console.log('[DEBUG] renderEstadisticasView: Iniciando renderizado de dashboard de estadísticas.');
        container.innerHTML = '';
        container.style.overflow = 'auto';

        // Agregar FontAwesome dinámicamente si no está cargado
        if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
            const fontAwesomeLink = document.createElement('link');
            fontAwesomeLink.rel = 'stylesheet';
            fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            document.head.appendChild(fontAwesomeLink);
            console.log('[DEBUG] FontAwesome agregado dinámicamente');
        }

        // Contenedor principal con altura controlada
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            width: 100%;
            max-height: calc(100vh - 100px);
            overflow-y: auto;
        `;

        // Notificación toast
        const notificationDiv = document.createElement('div');
        notificationDiv.id = 'notification-toast-stats';
        notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: white;
            border-left: 4px solid #28a745;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border-radius: 4px;
            z-index: 2000;
            transform: translateX(120%);
            transition: transform 0.3s ease;
            font-weight: 500;
            color: #1E293B;
        `;
        mainContent.appendChild(notificationDiv);

        // Contenedor del dashboard
        const dashboardContainer = document.createElement('div');
        dashboardContainer.className = 'estadisticas-dashboard';
        dashboardContainer.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            border: 1px solid #dee2e6;
        `;

        // Header del dashboard
        const dashboardHeader = document.createElement('div');
        dashboardHeader.style.cssText = `
            padding: 20px 25px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        `;

        const leftSection = document.createElement('div');
        leftSection.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        const dashboardIcon = document.createElement('i');
        dashboardIcon.className = 'fas fa-chart-line';
        dashboardIcon.style.cssText = `color: #174ea6; font-size: 20px;`;

        const dashboardTitleContainer = document.createElement('div');
        const dashboardTitle = document.createElement('h3');
        dashboardTitle.textContent = 'Estadísticas de Ausentismo';
        dashboardTitle.style.cssText = `font-size: 18px; font-weight: 600; margin: 0; color: #1E293B;`;

        const dashboardSubtitle = document.createElement('p');
        dashboardSubtitle.textContent = 'Métricas y tendencias del ausentismo por causa médica.';
        dashboardSubtitle.style.cssText = `font-size: 14px; color: #64748B; margin: 4px 0 0 0;`;

        dashboardTitleContainer.appendChild(dashboardTitle);
        dashboardTitleContainer.appendChild(dashboardSubtitle);
        leftSection.appendChild(dashboardIcon);
        leftSection.appendChild(dashboardTitleContainer);

        // Botón Volver
        const backBtn = document.createElement('button');
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Volver';
        backBtn.style.cssText = `
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #dee2e6;
            background-color: #f8f9fa;
            color: #64748B;
            transition: all 0.2s;
            white-space: nowrap;
        `;
        backBtn.onmouseover = function() {
            this.style.backgroundColor = '#e2e8f0';
            this.style.color = '#174ea6';
            this.style.borderColor = '#174ea6';
        };
        backBtn.onmouseout = function() {
            this.style.backgroundColor = '#f8f9fa';
            this.style.color = '#64748B';
            this.style.borderColor = '#dee2e6';
        };
        backBtn.onclick = () => {
            this.currentView = 'main';
            this.render();
        };

        dashboardHeader.appendChild(leftSection);
        dashboardHeader.appendChild(backBtn);
        dashboardContainer.appendChild(dashboardHeader);

        // Grid de métricas (4 tarjetas) - Diseño actualizado
        const metricsGrid = document.createElement('div');
        metricsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 20px;
            padding: 25px;
            border-bottom: 1px solid #dee2e6;
        `;

        // Función auxiliar para crear tarjetas
        const createMetricCard = (id, title, value, description, iconClass, borderColor) => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 20px;
                border-left: 4px solid ${borderColor};
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                min-height: 140px;
            `;

            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 12px;
            `;

            const titleSpan = document.createElement('span');
            titleSpan.textContent = title;
            titleSpan.style.cssText = `
                font-size: 12px;
                font-weight: 600;
                color: #64748B;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                line-height: 1.3;
                max-width: 70%;
            `;

            const icon = document.createElement('i');
            icon.className = iconClass;
            icon.style.cssText = `
                font-size: 22px;
                color: ${borderColor};
                opacity: 0.8;
                flex-shrink: 0;
            `;

            headerDiv.appendChild(titleSpan);
            headerDiv.appendChild(icon);

            const valueDiv = document.createElement('div');
            valueDiv.id = id;
            valueDiv.textContent = value;
            valueDiv.style.cssText = `
                font-size: 32px;
                font-weight: 700;
                color: #1E293B;
                margin-bottom: 4px;
                line-height: 1.2;
            `;

            const descDiv = document.createElement('div');
            descDiv.textContent = description;
            descDiv.style.cssText = `
                font-size: 12px;
                color: #64748B;
                line-height: 1.3;
            `;

            card.appendChild(headerDiv);
            card.appendChild(valueDiv);
            card.appendChild(descDiv);

            return card;
        };

        // Crear las 4 tarjetas
        metricsGrid.appendChild(createMetricCard(
            'metricTotalIncapacidades',
            'Total Incapacidades',
            '-',
            'Registros en el sistema',
            'fas fa-calendar-check',
            '#174ea6'
        ));

        metricsGrid.appendChild(createMetricCard(
            'metricTotalDias',
            'Días Perdidos',
            '-',
            'Días acumulados',
            'fas fa-calendar-day',
            '#28a745'
        ));

        metricsGrid.appendChild(createMetricCard(
            'metricTotalEPS',
            'Enfermedad General',
            '-',
            'Incapacidades EPS',
            'fas fa-hospital',
            '#ffc107'
        ));

        metricsGrid.appendChild(createMetricCard(
            'metricTotalARL',
            'Accidentes Laborales',
            '-',
            'Incapacidades ARL',
            'fas fa-hard-hat',
            '#dc3545'
        ));

        dashboardContainer.appendChild(metricsGrid);

        // Barra de filtros
        const filtersBar = document.createElement('div');
        filtersBar.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            padding: 20px 25px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            align-items: end;
        `;

        filtersBar.innerHTML = `
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Año</label>
                <select id="statsYearFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Todos</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                </select>
            </div>
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Mes</label>
                <select id="statsMonthFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Todos</option>
                    <option value="ENERO">Enero</option>
                    <option value="FEBRERO">Febrero</option>
                    <option value="MARZO">Marzo</option>
                    <option value="ABRIL">Abril</option>
                    <option value="MAYO">Mayo</option>
                    <option value="JUNIO">Junio</option>
                    <option value="JULIO">Julio</option>
                    <option value="AGOSTO">Agosto</option>
                    <option value="SEPTIEMBRE">Septiembre</option>
                    <option value="OCTUBRE">Octubre</option>
                    <option value="NOVIEMBRE">Noviembre</option>
                    <option value="DICIEMBRE">Diciembre</option>
                </select>
            </div>
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Género</label>
                <select id="statsGenderFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Todos</option>
                    <option value="MUJER">Mujer</option>
                    <option value="HOMBRE">Hombre</option>
                </select>
            </div>
            <div class="filter-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px;">Clase</label>
                <select id="statsClassFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px;">
                    <option value="">Todos</option>
                    <option value="EPS">EPS</option>
                    <option value="ARL">ARL</option>
                </select>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
                <button id="applyStatsFiltersBtn" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; background-color: #174ea6; color: white; transition: all 0.2s;">
                    <i class="fas fa-filter"></i> Filtrar
                </button>
                <button id="clearStatsFiltersBtn" style="padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #dee2e6; background-color: #f8f9fa; color: #64748B; transition: all 0.2s;">
                    <i class="fas fa-times"></i> Limpiar
                </button>
            </div>
        `;

        dashboardContainer.appendChild(filtersBar);

        // Contenedor de gráficos con altura controlada
        const chartsContainer = document.createElement('div');
        chartsContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            padding: 25px;
            max-height: 450px;
        `;

        chartsContainer.innerHTML = `
            <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; height: 380px; overflow: hidden;">
                <h4 style="margin: 0 0 15px 0; font-size: 16px; color: #1E293B;">Distribución Mensual</h4>
                <div style="position: relative; height: 310px; width: 100%;">
                    <canvas id="monthlyChart"></canvas>
                </div>
            </div>
            <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; height: 380px; overflow: hidden;">
                <h4 style="margin: 0 0 15px 0; font-size: 16px; color: #1E293B;">Tipos de Incapacidad</h4>
                <div style="position: relative; height: 310px; width: 100%;">
                    <canvas id="typeChart"></canvas>
                </div>
            </div>
            <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; height: 380px; overflow: hidden;">
                <h4 style="margin: 0 0 15px 0; font-size: 16px; color: #1E293B;">Distribución por Género</h4>
                <div style="position: relative; height: 310px; width: 100%;">
                    <canvas id="genderChart"></canvas>
                </div>
            </div>
        `;

        dashboardContainer.appendChild(chartsContainer);
        mainContent.appendChild(dashboardContainer);
        container.appendChild(mainContent);

        // Cargar datos y renderizar gráficos
        this.loadEstadisticasData(notificationDiv);

        // Setup de eventos de filtros
        setTimeout(() => {
            const applyBtn = document.getElementById('applyStatsFiltersBtn');
            const clearBtn = document.getElementById('clearStatsFiltersBtn');

            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    this.applyStatsFilters(notificationDiv);
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    document.getElementById('statsYearFilter').value = '';
                    document.getElementById('statsMonthFilter').value = '';
                    document.getElementById('statsGenderFilter').value = '';
                    document.getElementById('statsClassFilter').value = '';
                    this.loadEstadisticasData(notificationDiv);
                    this.showNotification('Filtros limpiados', 'info', notificationDiv.id);
                });
            }
        }, 0);
    }

    applyStatsFilters(notificationDiv) {
        const year = document.getElementById('statsYearFilter').value;
        const month = document.getElementById('statsMonthFilter').value;
        const gender = document.getElementById('statsGenderFilter').value;
        const clase = document.getElementById('statsClassFilter').value;

        if (!this.currentAusentismoDataStats) {
            this.showNotification('No hay datos cargados', 'warning', notificationDiv.id);
            return;
        }

        let filtered = this.currentAusentismoDataStats.filter(row => {
            const matchesYear = !year || (row.AÑO || '').includes(year);
            const matchesMonth = !month || (row.MES || '').toUpperCase() === month.toUpperCase();
            const matchesGender = !gender || (row.GENERO || '').toUpperCase() === gender.toUpperCase();
            const matchesClass = !clase || (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === clase.toUpperCase();

            return matchesYear && matchesMonth && matchesGender && matchesClass;
        });

        this.updateStatsMetrics(filtered);
        this.renderCharts(filtered);
        this.showNotification(`${filtered.length} registros filtrados`, 'success', notificationDiv.id);
    }

    async loadEstadisticasData(notificationDiv) {
        try {
            const result = await window.electronAPI.readAusentismoData(this.currentCompany);

            if (result.success && result.rows) {
                const data = result.rows.map(row => {
                    const rowObj = {};
                    result.headers.forEach((header, i) => {
                        rowObj[header ? header.trim() : `col_${i}`] = row[i];
                    });
                    return rowObj;
                });

                // Guardar datos para filtros
                this.currentAusentismoDataStats = data;

                this.updateStatsMetrics(data);
                this.renderCharts(data);
            } else {
                this.showNotification('No hay datos para mostrar', 'warning', notificationDiv.id);
            }
        } catch (error) {
            console.error('Error loading estadisticas data:', error);
            this.showNotification(`Error: ${error.message}`, 'error', notificationDiv.id);
        }
    }

    updateStatsMetrics(data) {
        // Calcular métricas
        const totalIncapacidades = data.length;
        const totalDias = data.reduce((sum, row) => sum + (parseInt(row['N° DIAS DE INCAPACIDAD']) || 0), 0);
        const totalEPS = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === 'EPS').length;
        const totalARL = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === 'ARL').length;

        // Actualizar tarjetas
        document.getElementById('metricTotalIncapacidades').textContent = totalIncapacidades.toLocaleString();
        document.getElementById('metricTotalDias').textContent = totalDias.toLocaleString();
        document.getElementById('metricTotalEPS').textContent = totalEPS.toLocaleString();
        document.getElementById('metricTotalARL').textContent = totalARL.toLocaleString();
    }

    renderCharts(data) {
        // Datos para gráfico mensual
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const monthlyData = new Array(12).fill(0);

        data.forEach(row => {
            const mes = row.MES ? monthNames.indexOf(row.MES.toUpperCase()) : -1;
            if (mes >= 0) {
                monthlyData[mes]++;
            }
        });

        // Datos para gráfico de tipos
        const epsCount = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === 'EPS').length;
        const arlCount = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase() === 'ARL').length;
        const licenciaCount = data.filter(row => (row['CLASE DE INCAPACIDAD'] || '').toUpperCase().includes('LICENCIA')).length;

        // Datos para gráfico de género
        const mujerCount = data.filter(row => (row.GENERO || '').toUpperCase() === 'MUJER').length;
        const hombreCount = data.filter(row => (row.GENERO || '').toUpperCase() === 'HOMBRE').length;
        const otroCount = data.length - mujerCount - hombreCount;

        // Renderizar gráfico de barras (Monthly)
        const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
        if (window.Chart) {
            // Destruir gráficos existentes si los hay
            const existingMonthlyChart = Chart.getChart('monthlyChart');
            if (existingMonthlyChart) {
                existingMonthlyChart.destroy();
            }

            new window.Chart(monthlyCtx, {
                type: 'bar',
                data: {
                    labels: months,
                    datasets: [{
                        label: 'Incapacidades',
                        data: monthlyData,
                        backgroundColor: '#174ea6',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1 }
                        }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            bottom: 10,
                            left: 10,
                            right: 10
                        }
                    }
                }
            });

            // Renderizar gráfico doughnut (Types)
            const typeCtx = document.getElementById('typeChart').getContext('2d');
            const existingTypeChart = Chart.getChart('typeChart');
            if (existingTypeChart) {
                existingTypeChart.destroy();
            }

            new window.Chart(typeCtx, {
                type: 'doughnut',
                data: {
                    labels: ['EPS', 'ARL', 'Licencias'],
                    datasets: [{
                        data: [epsCount, arlCount, licenciaCount],
                        backgroundColor: ['#174ea6', '#dc3545', '#ffc107'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });

            // Renderizar gráfico de género (Doughnut)
            const genderCtx = document.getElementById('genderChart').getContext('2d');
            const existingGenderChart = Chart.getChart('genderChart');
            if (existingGenderChart) {
                existingGenderChart.destroy();
            }

            new window.Chart(genderCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Mujer', 'Hombre', 'Otro'],
                    datasets: [{
                        data: [mujerCount, hombreCount, Math.max(0, otroCount)],
                        backgroundColor: ['#e91e63', '#2196f3', '#9e9e9e'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } else {
            console.warn('Chart.js no está disponible');
        }
    }

    async navigateToInitialPath() {
        try {
            const result = await window.electronAPI.findSubmodulePath(
                this.currentCompany,
                this.moduleName,
                this.submoduleName
            );
            if (result.success) {
                this.navigateToPath(result.path);
            } else {
                document.getElementById('search-results-col').innerHTML =
                    `<p>Error al encontrar la ruta inicial: ${result.error}</p>`;
            }
        } catch (error) {
            document.getElementById('search-results-col').innerHTML =
                `<p>Error crítico al buscar ruta: ${error.message}</p>`;
        }
    }

    async navigateToPath(path) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '<p>Cargando...</p>';
        try {
            const items = await window.electronAPI.readDirectory(path);
            this.currentPath = path;
            this.updateNavBar();
            this.displayItems(items);
        } catch (error) {
            resultsCol.innerHTML = `<p>Error al leer directorio: ${error.message}</p>`;
        }
    }

    updateNavBar() {
        const navBar = this.container.querySelector('.file-nav-bar');
        navBar.innerHTML = '';

        const upButton = document.createElement('button');
        upButton.innerHTML = '&#8679; Subir Nivel';
        upButton.className = 'btn btn-secondary btn-sm';
        upButton.disabled = this.pathHistory.length === 0;
        upButton.addEventListener('click', () => {
            if (this.pathHistory.length > 0) {
                const parentPath = this.pathHistory.pop();
                this.navigateToPath(parentPath);
            }
        });
        navBar.appendChild(upButton);

        const breadcrumb = document.createElement('span');
        breadcrumb.className = 'breadcrumb-display';
        breadcrumb.textContent = this.currentPath || 'Ruta no disponible';
        navBar.appendChild(breadcrumb);
    }

    displayItems(items) {
        const resultsCol = document.getElementById('search-results-col');
        resultsCol.innerHTML = '';
        const list = document.createElement('ul');
        list.className = 'search-results-list';

        const allowedExtensions = ['.pdf', '.doc', '.docx', '.xlsx', '.xls'];
        const folders = items.filter(item => item.isDirectory);
        const files = items.filter(
            item => !item.isDirectory &&
            allowedExtensions.includes(item.name.slice(item.name.lastIndexOf('.')).toLowerCase())
        );

        folders.forEach(folder => {
            const li = document.createElement('li');
            li.textContent = `📁 ${folder.name}`;
            li.addEventListener('click', () => {
                this.pathHistory.push(this.currentPath);
                this.navigateToPath(folder.path);
            });
            list.appendChild(li);
        });

        files.forEach(file => {
            const li = document.createElement('li');
            const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
            let icon = '📄';
            if (ext === '.pdf') icon = '📕';
            else if (['.doc', '.docx'].includes(ext)) icon = '📘';
            else if (['.xlsx', '.xls'].includes(ext)) icon = '📊';

            li.innerHTML = `${icon} ${file.name}`;
            li.addEventListener('click', () => this.previewDocument(file.path));
            list.appendChild(li);
        });

        if (list.children.length === 0) {
            resultsCol.innerHTML = '<p>No hay archivos de ausentismo o carpetas para mostrar.</p>';
        } else {
            resultsCol.appendChild(list);
        }
    }

    async previewDocument(filePath) {
        const previewCol = document.getElementById('preview-col');
        const fileExtension = filePath.split('.').pop().toLowerCase();

        previewCol.innerHTML = '<div class="preview-placeholder">Cargando previsualización...</div>';

        if (fileExtension === 'pdf') {
            const safePath = filePath.replace(/\\/g, '/');
            previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${Date.now()}" width="100%" height="100%" style="border: none;"></iframe>`;
        } else if (['doc', '.docx', 'xlsx', 'xls'].includes(fileExtension)) {
            try {
                const result = fileExtension.startsWith('doc')
                    ? await window.electronAPI.convertDocxToPdf(filePath)
                    : await window.electronAPI.convertExcelToPdf(filePath);

                if (result.success) {
                    const safePath = result.pdf_path.replace(/\\/g, '/');
                    previewCol.innerHTML = `<iframe src="file:///${safePath}?t=${Date.now()}" width="100%" height="100%" style="border: none;"></iframe>`;
                } else {
                    const escapedPath = filePath.replace(/\\/g, '\\');
                    previewCol.innerHTML = `
                        <div class="preview-error">
                            <h3>Error de Conversión</h3>
                            <p>${result.error}</p>
                            <button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">
                                Abrir con aplicación externa
                            </button>
                        </div>`;
                }
            } catch (error) {
                const escapedPath = filePath.replace(/\\/g, '\\');
                previewCol.innerHTML = `
                    <div class="preview-error">
                        <h3>Error Inesperado</h3>
                        <p>${error.message}</p>
                        <button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">
                            Abrir con aplicación externa
                        </button>
                    </div>`;
            }
        } else {
            const escapedPath = filePath.replace(/\\/g, '\\');
            previewCol.innerHTML = `
                <div class="preview-error">
                    <h3>Previsualización no disponible</h3>
                    <p>La previsualización para archivos <strong>.${fileExtension}</strong> no está soportada.</p>
                    <button class="btn btn-primary" onclick="window.currentMedicionAusentismoComponent.openDocument('${escapedPath}')">
                        Abrir con aplicación externa
                    </button>
                </div>`;
        }
    }

    async openDocument(filePath) {
        try {
            await window.electronAPI.openPath(filePath);
        } catch (error) {
            console.error('Error al abrir el documento:', error);
            alert('Error al abrir el documento.');
        }
    }

    // Método para saber qué columnas son editables
    isEditableColumn(colIndex) {
        // Asumiendo que las columnas editables son:
        // Cédula (índice 3), Género (índice 8), Clase de incapacidad (índice 11),
        // Tipo de incapacidad (índice 12), F. inicio (índice 15), F. final (índice 16), Código (índice 17)
        const editableColumns = [3, 8, 11, 12, 15, 16, 17];
        return editableColumns.includes(colIndex);
    }

    // Método para convertir fila y columna a dirección de celda Excel (por ejemplo, A1, B2, etc.)
    getExcelCellAddress(row, col) {
        // Convertir columna a letra (A, B, C, ..., Z, AA, AB, etc.)
        let columnName = '';
        let n = col + 1; // ExcelJS usa base 1, pero nosotros usamos base 0
        while (n > 0) {
            n--;
            columnName = String.fromCharCode(65 + (n % 26)) + columnName;
            n = Math.floor(n / 26);
        }
        return columnName + row;
    }

    // Método para actualizar la tabla con nuevos datos
    updateTableWithNewData(newData) {
        // Aquí puedes actualizar la tabla con los nuevos datos
        // Por simplicidad, recargamos la vista
        this.renderVerAusentismoView(this.container);
    }

    async saveCellData(rowIndex, colIndex, newValue, filePath) {
        try {
            console.log(`Guardando cambios en fila ${rowIndex}, columna ${colIndex}...`);
            alert(`Cambios guardados: ${newValue} en fila ${rowIndex}, columna ${colIndex}`);
        } catch (error) {
            console.error('Error al guardar cambios:', error);
            alert(`Error al guardar cambios: ${error.message}`);
        }
    }

    createHeader(titleText, onBack) {
        const header = document.createElement('div');
        header.className = 'submodule-header';
        header.appendChild(this.createBackButton('&#8592; Volver', onBack));

        const title = document.createElement('h3');
        title.textContent = titleText;
        Object.assign(title.style, {
            flexGrow: '1',
            textAlign: 'center'
        });
        header.appendChild(title);

        return header;
    }

    createBackButton(text, onClick) {
        const button = document.createElement('button');
        button.className = 'btn btn-back';
        button.innerHTML = text;
        button.addEventListener('click', onClick);
        return button;
    }
}

// Exponer globalmente
window.MedicionAusentismoComponent = MedicionAusentismoComponent;
