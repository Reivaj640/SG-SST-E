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
        iframe.src = 'modules/gestion-salud/ausentismo/medicion-ausentismo-home.html';
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

        const currentYear = new Date().getFullYear();
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        filtersContainer.innerHTML = `
            <div style="flex: 2; min-width: 200px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Buscar Paciente</label>
                <input type="text" id="seguimientoSearchInput" class="form-control" placeholder="Nombre o Cédula..."
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
            </div>
            <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Estado</label>
                <select id="seguimientoEstadoFilter" class="form-control"
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    <option value="En curso">En curso</option>
                    <option value="Próximo a vencer">Próximo a vencer</option>
                    <option value="Finalizado">Finalizado</option>
                </select>
            </div>
            <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Tipo</label>
                <select id="seguimientoTipoFilter" class="form-control"
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    <option value="EPS">EPS</option>
                    <option value="ARL">ARL</option>
                </select>
            </div>
            <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Año</label>
                <select id="seguimientoYearFilter" class="form-control"
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    <!-- Los años se llenarán dinámicamente después de cargar los datos -->
                </select>
            </div>
            <div style="flex: 1; min-width: 150px;">
                <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Mes</label>
                <select id="seguimientoMonthFilter" class="form-control"
                    style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: #fff;">
                    <option value="">Todos</option>
                    ${months.map((month, index) => `<option value="${index}">${month}</option>`).join('')}
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
                    document.getElementById('seguimientoYearFilter').value = '';
                    document.getElementById('seguimientoMonthFilter').value = '';
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

                console.log('[DEBUG loadSeguimientoData] Total de filas leídas:', result.rows.length);

                // Convertir filas a objetos
                const allRecords = result.rows.map(row => {
                    const rowObj = {};
                    result.headers.forEach((header, i) => {
                        rowObj[header ? header.trim() : `col_${i}`] = row[i];
                    });
                    return rowObj;
                });

                console.log('[DEBUG loadSeguimientoData] Primer registro:', allRecords[0]);

                // AGRUPAR incapacidades por empleado (cedula)
                const empleadosMap = new Map();
                
                allRecords.forEach(record => {
                    const cedula = record['CEDULA'] || record['cedula'];
                    if (!cedula) return;
                    
                    // Limpiar y parsear días de incapacidad
                    let diasIncapacidad = 0;
                    const diasRaw = record['N° DIAS DE INCAPACIDAD'] || record['n°_dias_de_incapacidad'] || record['N° DIAS'] || '0';
                    
                    // Convertir string a número (manejar formatos como "1", "1,000", etc.)
                    if (typeof diasRaw === 'string') {
                        diasIncapacidad = parseInt(diasRaw.replace(/,/g, '').replace(/\./g, '').trim()) || 0;
                    } else if (typeof diasRaw === 'number') {
                        diasIncapacidad = Math.floor(diasRaw);
                    }
                    
                    const fechaFin = record['F. FIN'] || record['f._fin'] || record['F. FIN'] || null;
                    const fechaInicio = record['F. INICIO'] || record['f._inicio'] || record['F. INICIO'] || null;
                    
                    if (!empleadosMap.has(cedula)) {
                        empleadosMap.set(cedula, {
                            cedula: cedula,
                            nombre: record['NOMBRE'] || record['nombre'] || '',
                            cargo: record['CARGO'] || record['cargo'] || '',
                            departamento: record['ÁREA O DPTO'] || record['area_o_dpto'] || '',
                            empresaUsuaria: record['EMPRESA USUARIA'] || record['empresa_usuaria'] || '',
                            genero: record['GENERO'] || record['genero'] || '',
                            incapacidades: []
                        });
                    }
                    
                    empleadosMap.get(cedula).incapacidades.push({
                        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
                        fechaFin: fechaFin ? new Date(fechaFin) : null,
                        diasIncapacidad: diasIncapacidad,
                        record
                    });
                });

                console.log('[DEBUG loadSeguimientoData] Total de empleados únicos:', empleadosMap.size);
                
                // LOG DETALLADO: Mostrar TODAS las incapacidades de cada empleado
                console.log('========== DETALLE DE EMPLEADOS ==========');
                empleadosMap.forEach((empleado, cedula) => {
                    console.log(`\n[EMPLEADO] ${empleado.nombre} (CC: ${cedula})`);
                    console.log(`  Total incapacidades: ${empleado.incapacidades.length}`);
                    empleado.incapacidades.forEach((inc, idx) => {
                        const fechaIniStr = inc.fechaInicio ? inc.fechaInicio.toLocaleDateString() : 'N/A';
                        const fechaFinStr = inc.fechaFin ? inc.fechaFin.toLocaleDateString() : 'N/A';
                        console.log(`    [${idx}] ${fechaIniStr} a ${fechaFinStr} = ${inc.diasIncapacidad} días`);
                    });
                });
                console.log('==========================================');
                
                console.log('[DEBUG loadSeguimientoData] Empleados agrupados:', Array.from(empleadosMap.entries()).map(([cedula, emp]) => ({
                    cedula,
                    nombre: emp.nombre,
                    totalIncapacidades: emp.incapacidades.length,
                    totalDias: emp.incapacidades.reduce((sum, inc) => sum + inc.diasIncapacidad, 0),
                    incapacidades: emp.incapacidades.map(inc => ({
                        dias: inc.diasIncapacidad,
                        inicio: inc.fechaInicio,
                        fin: inc.fechaFin
                    }))
                })).slice(0, 5)); // Mostrar solo primeros 5

                // FILTRAR empleados que cumplen las condiciones
                this.seguimientoData = Array.from(empleadosMap.values()).filter(empleado => {
                    // Ordenar incapacidades por fecha de inicio
                    empleado.incapacidades.sort((a, b) => {
                        if (!a.fechaInicio) return 1;
                        if (!b.fechaInicio) return -1;
                        return a.fechaInicio - b.fechaInicio;
                    });

                    // Condición 1: Alguna incapacidad individual >= 10 días
                    const tieneIncapacidadLarga = empleado.incapacidades.some(inc => {
                        return inc.diasIncapacidad >= 10;
                    });
                    
                    if (tieneIncapacidadLarga) {
                        console.log('[DEBUG FILTRO] Empleado cumple Condición 1 (incapacidad >= 10 días):', empleado.nombre, 'Cédula:', empleado.cedula);
                        // Log de qué incapacidades cumplen >= 10 días
                        empleado.incapacidades.forEach((inc, idx) => {
                            if (inc.diasIncapacidad >= 10) {
                                const fechaStr = inc.fechaInicio ? inc.fechaInicio.toLocaleDateString() : 'N/A';
                                console.log(`  → Incapacidad [${idx}]: ${fechaStr} = ${inc.diasIncapacidad} días (CUMPLE >= 10)`);
                            }
                        });
                        return true;
                    }

                    // Condición 2: Suma de incapacidades >= 10 días Y gap entre incapacidades <= 3 días
                    const totalDias = empleado.incapacidades.reduce((sum, inc) => sum + inc.diasIncapacidad, 0);
                    
                    if (totalDias >= 10) {
                        // Verificar que el gap entre incapacidades consecutivas sea <= 3 días
                        let gapValido = true;
                        
                        for (let i = 1; i < empleado.incapacidades.length; i++) {
                            const incAnterior = empleado.incapacidades[i - 1];
                            const incActual = empleado.incapacidades[i];
                            
                            if (!incAnterior.fechaFin || !incActual.fechaInicio) {
                                gapValido = false;
                                break;
                            }
                            
                            // Calcular gap entre el fin de la anterior y el inicio de la actual
                            const gapDias = Math.ceil((incActual.fechaInicio - incAnterior.fechaFin) / (1000 * 60 * 60 * 24));
                            
                            // Si el gap es mayor a 3 días, no cumple la condición
                            if (gapDias > 3) {
                                gapValido = false;
                                break;
                            }
                        }
                        
                        if (gapValido && empleado.incapacidades.length > 1) {
                            console.log('[DEBUG FILTRO] Empleado cumple Condición 2 (suma >= 10 y gaps <= 3):', empleado.nombre, 'Cédula:', empleado.cedula, 'Total días:', totalDias);
                            return true;
                        } else {
                            console.log('[DEBUG FILTRO] Empleado NO cumple Condición 2 (gaps > 3):', empleado.nombre, 'Cédula:', empleado.cedula, 'Total días:', totalDias);
                        }
                    }

                    return false;
                });

                console.log('[DEBUG loadSeguimientoData] Total de empleados que cumplen filtros:', this.seguimientoData.length);
                console.log('[DEBUG loadSeguimientoData] Empleados filtrados:', this.seguimientoData.map(emp => ({
                    nombre: emp.nombre,
                    cedula: emp.cedula,
                    totalIncapacidades: emp.incapacidades.length,
                    totalDias: emp.incapacidades.reduce((sum, inc) => sum + inc.diasIncapacidad, 0),
                    ultimaIncapacidad: emp.incapacidades.length > 0 ? {
                        fechaInicio: emp.incapacidades[emp.incapacidades.length - 1].fechaInicio,
                        dias: emp.incapacidades[emp.incapacidades.length - 1].diasIncapacidad
                    } : null
                })));

                // Verificar si hay datos antes de renderizar
                if (this.seguimientoData.length === 0) {
                    console.warn('[DEBUG loadSeguimientoData] ⚠️ ADVERTENCIA: No hay empleados que cumplan las condiciones!');
                    console.log('[DEBUG loadSeguimientoData] Revisar datos de ejemplo:', Array.from(empleadosMap.values()).slice(0, 3).map(emp => ({
                        nombre: emp.nombre,
                        incapacidades: emp.incapacidades.map(inc => ({
                            dias: inc.diasIncapacidad,
                            inicio: inc.fechaInicio,
                            fin: inc.fechaFin
                        }))
                    })));
                } else {
                    console.log('[DEBUG loadSeguimientoData] ✅ Hay', this.seguimientoData.length, 'empleados para mostrar en la tabla');
                }

                // Llenar el filtro de años con todos los años únicos de los datos
                this.llenarFiltroAnios(empleadosMap);

                // Calcular KPIs
                this.calculateKPIs();

                console.log('[DEBUG loadSeguimientoData] Renderizando tabla con', this.seguimientoData.length, 'empleados');

                // Renderizar tabla
                this.renderSeguimientoTable(this.seguimientoData);
            } else {
                console.log('[DEBUG loadSeguimientoData] No hay datos o error en result');
                this.renderSeguimientoTable([]);
            }
        } catch (error) {
            console.error('[DEBUG loadSeguimientoData] Error loading seguimiento data:', error);
            this.renderSeguimientoTable([]);
        }
    }

    /**
     * Llena el dropdown de años con todos los años únicos presentes en los datos
     * @param {Map} empleadosMap - Mapa de empleados con sus incapacidades
     */
    llenarFiltroAnios(empleadosMap) {
        const yearSelect = document.getElementById('seguimientoYearFilter');
        if (!yearSelect) return;

        // Extraer todos los años únicos de las incapacidades
        const yearsSet = new Set();
        empleadosMap.forEach(empleado => {
            empleado.incapacidades.forEach(inc => {
                if (inc.fechaInicio) {
                    yearsSet.add(inc.fechaInicio.getFullYear());
                }
            });
        });

        // Convertir a array y ordenar descendente (año más reciente primero)
        const yearsArray = Array.from(yearsSet).sort((a, b) => b - a);

        console.log('[DEBUG llenarFiltroAnios] Años encontrados:', yearsArray);

        // Llenar el select
        yearSelect.innerHTML = '<option value="">Todos</option>' + 
            yearsArray.map(year => `<option value="${year}">${year}</option>`).join('');
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
        console.log('[DEBUG renderSeguimientoTable] Iniciando renderizado con', data.length, 'empleados');
        
        const tbody = document.getElementById('seguimientoTableBody');
        
        console.log('[DEBUG renderSeguimientoTable] tbody encontrado:', tbody ? '✅ SÍ' : '❌ NO');
        
        if (!tbody) {
            console.error('[DEBUG renderSeguimientoTable] ERROR: Elemento seguimientoTableBody no encontrado en el DOM!');
            console.log('[DEBUG renderSeguimientoTable] Elementos en el DOM:', document.querySelectorAll('*').length);
            console.log('[DEBUG renderSeguimientoTable] Buscando por ID alternativo...');
            
            // Intentar buscar con otros selectores
            const alternativeTbody = document.querySelector('#seguimientoTableBody, tbody[id*="seguimiento"], tbody');
            console.log('[DEBUG renderSeguimientoTable] tbody alternativo encontrado:', alternativeTbody ? '✅ SÍ' : '❌ NO');
            
            if (alternativeTbody) {
                console.log('[DEBUG renderSeguimientoTable] Usando tbody alternativo');
                this.renderSeguimientoTableWithBody(alternativeTbody, data);
            }
            return;
        }

        this.renderSeguimientoTableWithBody(tbody, data);
    }

    renderSeguimientoTableWithBody(tbody, data) {
        console.log('[DEBUG renderSeguimientoTableWithBody] Renderizando', data.length, 'empleados en la tabla');

        if (!data || data.length === 0) {
            console.log('[DEBUG renderSeguimientoTableWithBody] No hay datos para mostrar');
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
        console.log('[DEBUG renderSeguimientoTableWithBody] Fecha hoy:', today);
        console.log('[DEBUG renderSeguimientoTableWithBody] Primer empleado:', data[0]);

        tbody.innerHTML = data.map((empleado, index) => {
            // Estructura de datos agrupados: {nombre, cedula, incapacidades: [...], cargo, departamento, etc.}
            const nombre = empleado.nombre || 'Sin nombre';
            const cedula = empleado.cedula || '';

            // IDENTIFICAR la incapacidad PRINCIPAL que activa el seguimiento
            // Las incapacidades ya están ordenadas por fecha de inicio (ascendente) en loadSeguimientoData
            
            // Primero, buscar incapacidades >= 10 días (Condición 1)
            const incapacidadesLargas = empleado.incapacidades.filter(inc => inc.diasIncapacidad >= 10);
            
            let incapacidadPrincipal = null;
            
            if (incapacidadesLargas.length > 0) {
                // Condición 1: Tomar la incapacidad >= 10 días MÁS RECIENTE
                incapacidadPrincipal = incapacidadesLargas[incapacidadesLargas.length - 1];
            } else if (empleado.incapacidades.length > 1) {
                // Condición 2: Secuencia de incapacidades que suman >= 10 días con gaps <= 3 días
                // Tomar la última incapacidad de la secuencia (la más reciente)
                incapacidadPrincipal = empleado.incapacidades[empleado.incapacidades.length - 1];
            } else {
                // Caso fallback: tomar la única incapacidad disponible
                incapacidadPrincipal = empleado.incapacidades.length > 0
                    ? empleado.incapacidades[empleado.incapacidades.length - 1]
                    : null;
            }

            // Obtener tipo de la incapacidad principal (o default EPS)
            const tipo = incapacidadPrincipal?.record?.['CLASE DE INCAPACIDAD'] ||
                        incapacidadPrincipal?.record?.['clase_de_incapacidad'] || 'EPS';

            // Usar fechas de la incapacidad PRINCIPAL (la que activa el seguimiento)
            const fechaInicio = incapacidadPrincipal?.fechaInicio || null;
            const fechaFin = incapacidadPrincipal?.fechaFin || null;
            const diasIncapacidad = incapacidadPrincipal?.diasIncapacidad || 0;

            // Calcular días transcurridos desde el inicio de la incapacidad más reciente
            let diasTranscurridos = 0;
            let avance = 0;
            let estado = 'En curso';

            if (fechaInicio && fechaFin) {
                const totalTime = fechaFin - fechaInicio;
                const diasTotales = Math.ceil(totalTime / (1000 * 60 * 60 * 24)) + 1;

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
                        <div style="font-size: 11px; color: #64748B;">${diasIncapacidad} Días</div>
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
                            <button style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748B; transition: all 0.2s;" title="Ver Detalles" onclick="if(window.medicAusentismoComponent) window.medicAusentismoComponent.openDetailModal(${JSON.stringify(empleado).replace(/"/g, '&quot;')})">
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
        const year = document.getElementById('seguimientoYearFilter').value;
        const month = document.getElementById('seguimientoMonthFilter').value;

        if (!this.seguimientoData) {
            this.showNotification('No hay datos cargados', 'warning');
            return;
        }

        const today = new Date();
        let filtered = this.seguimientoData.filter(empleado => {
            const nombre = (empleado.nombre || '').toLowerCase();
            const cedula = (empleado.cedula || '').toLowerCase();
            const matchesSearch = !search || nombre.includes(search) || cedula.includes(search);

            // Obtener tipo de la incapacidad más reciente
            const incapacidadReciente = empleado.incapacidades && empleado.incapacidades.length > 0
                ? empleado.incapacidades[empleado.incapacidades.length - 1]
                : null;
            const rowTipo = incapacidadReciente?.record?.['CLASE DE INCAPACIDAD'] ||
                           incapacidadReciente?.record?.['clase_de_incapacidad'] || '';
            const matchesTipo = !tipo || rowTipo.toUpperCase() === tipo.toUpperCase();

            // Filtro por año (verificar si alguna incapacidad es del año seleccionado)
            let matchesYear = true;
            if (year) {
                matchesYear = empleado.incapacidades.some(inc => {
                    return inc.fechaInicio && inc.fechaInicio.getFullYear() === parseInt(year);
                });
            }

            // Filtro por mes (verificar si alguna incapacidad inicia en el mes seleccionado)
            let matchesMonth = true;
            if (month !== '') {
                matchesMonth = empleado.incapacidades.some(inc => {
                    return inc.fechaInicio && inc.fechaInicio.getMonth() === parseInt(month);
                });
            }

            let matchesEstado = true;
            if (estado) {
                const fechaFin = incapacidadReciente?.fechaFin || null;
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

            return matchesSearch && matchesTipo && matchesYear && matchesMonth && matchesEstado;
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
            <div style="background: white; width: 90%; max-width: 700px; max-height: 85vh; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); overflow: hidden; display: flex; flex-direction: column;">
                <div style="padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                    <div style="font-size: 16px; font-weight: 600;">Detalle de Seguimiento</div>
                    <button onclick="document.getElementById('detailModal').style.display='none'" style="background: none; border: none; font-size: 20px; color: #64748B; cursor: pointer;">&times;</button>
                </div>
                <div id="detailModalContent" style="margin-bottom: 20px; overflow-y: auto; padding: 20px; max-height: calc(85vh - 140px);">
                    <!-- Contenido dinámico -->
                </div>
                <div style="padding: 15px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
                    <button onclick="document.getElementById('detailModal').style.display='none'" style="padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid #e2e8f0; background: white; color: #1E293B;">Cerrar</button>
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

    openDetailModal(empleado) {
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('detailModalContent');

        if (!modal || !content || !empleado) return;

        const nombre = empleado.nombre || 'Sin nombre';
        const cedula = empleado.cedula || '';
        const incapacidades = empleado.incapacidades || [];

        if (incapacidades.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: #64748B; padding: 40px;">No hay incapacidades registradas</p>';
            modal.style.display = 'flex';
            return;
        }

        // Ordenar incapacidades por fecha de inicio
        const incapacidadesOrdenadas = [...incapacidades].sort((a, b) => {
            if (!a.fechaInicio) return 1;
            if (!b.fechaInicio) return -1;
            return a.fechaInicio - b.fechaInicio;
        });

        // Identificar incapacidades >= 10 días (las que activan el seguimiento por Condición 1)
        const incapacidadesLargas = incapacidadesOrdenadas.filter(inc => inc.diasIncapacidad >= 10);
        
        // Determinar tipo de caso
        const esCondicion1 = incapacidadesLargas.length > 0;
        const esCondicion2 = !esCondicion1 && incapacidadesOrdenadas.length > 1;

        // Calcular total de días
        const totalDias = incapacidadesOrdenadas.reduce((sum, inc) => sum + inc.diasIncapacidad, 0);

        // Construir HTML según el tipo de caso
        if (esCondicion1) {
            // CASO 1: Mostrar incapacidades >= 10 días
            content.innerHTML = this.renderCondicion1Detalle(nombre, cedula, incapacidadesLargas, totalDias);
        } else if (esCondicion2) {
            // CASO 2: Mostrar secuencia de incapacidades que suman >= 10 días
            content.innerHTML = this.renderCondicion2Detalle(nombre, cedula, incapacidadesOrdenadas, totalDias);
        } else {
            // CASO ESPECIAL: Solo una incapacidad < 10 días (no debería llegar aquí)
            content.innerHTML = this.renderCondicion1Detalle(nombre, cedula, incapacidadesOrdenadas, totalDias);
        }

        modal.style.display = 'flex';
    }

    renderCondicion1Detalle(nombre, cedula, incapacidadesLargas, totalDias) {
        const today = new Date();

        // DEBUG: Ver incapacidades antes de ordenar
        console.log('[DEBUG renderCondicion1Detalle] incapacidadesLargas antes de ordenar:', incapacidadesLargas.map(inc => ({
            fechaInicio: inc.fechaInicio,
            fechaInicioType: typeof inc.fechaInicio,
            fechaFin: inc.fechaFin,
            dias: inc.diasIncapacidad
        })));

        // Ordenar incapacidades de MÁS RECIENTE a MÁS ANTIGUA para mostrar primero la actual
        const incapacidadesOrdenadas = [...incapacidadesLargas].sort((a, b) => {
            // Convertir strings ISO a objetos Date si es necesario
            let dateA = a.fechaInicio;
            let dateB = b.fechaInicio;

            if (typeof dateA === 'string') {
                dateA = new Date(dateA);
            }
            if (typeof dateB === 'string') {
                dateB = new Date(dateB);
            }

            // Validar que las fechas sean objetos Date válidos
            const validA = dateA instanceof Date && !isNaN(dateA.getTime());
            const validB = dateB instanceof Date && !isNaN(dateB.getTime());

            if (!validA) dateA = null;
            if (!validB) dateB = null;

            if (!dateB && !dateA) return 0;
            if (!dateB) return -1;
            if (!dateA) return 1;

            const diff = dateB - dateA;
            console.log(`[DEBUG sort] Comparando ${dateB.toLocaleDateString()} vs ${dateA.toLocaleDateString()} = ${diff}`);
            return diff;
        });

        // DEBUG: Ver incapacidades después de ordenar
        console.log('[DEBUG renderCondicion1Detalle] incapacidadesOrdenadas después de ordenar:', incapacidadesOrdenadas.map(inc => ({
            fechaInicio: inc.fechaInicio,
            fechaInicioType: typeof inc.fechaInicio,
            fechaFin: inc.fechaFin,
            dias: inc.diasIncapacidad
        })));
        
        return `
            <!-- Encabezado del empleado -->
            <div style="display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
                <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #174ea6, #2d5dc7); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 22px; flex-shrink: 0;">
                    ${nombre.split(' ').map(n => n[0]).filter(c => c).join('').substring(0, 2).toUpperCase()}
                </div>
                <div style="margin-left: 15px; flex: 1;">
                    <h3 style="font-size: 18px; margin: 0; color: #1E293B; font-weight: 600;">${nombre}</h3>
                    <div style="font-size: 14px; color: #64748B; margin-top: 4px;">CC: ${cedula}</div>
                </div>
                <div style="background: #FEF3C7; color: #92400E; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                    ⚠️ Incapacidad >= 10 días
                </div>
            </div>

            <!-- Lista de incapacidades >= 10 días (ordenadas de más reciente a más antigua) -->
            <div style="margin-bottom: 20px;">
                <h4 style="font-size: 14px; font-weight: 600; color: #1E293B; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-exclamation-triangle" style="color: #F59E0B;"></i>
                    INCAPACIDAD(ES) QUE ACTIVA(N) SEGUIMIENTO
                </h4>
                ${incapacidadesOrdenadas.map((inc, index) => {
                    // Validar y formatear fechas
                    let fechaInicio = 'N/A';
                    let fechaFin = 'N/A';
                    
                    if (inc.fechaInicio) {
                        try {
                            const fechaIni = inc.fechaInicio instanceof Date ? inc.fechaInicio : new Date(inc.fechaInicio);
                            if (!isNaN(fechaIni.getTime())) {
                                fechaInicio = fechaIni.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                            }
                        } catch (e) {
                            console.warn('Error al formatear fechaInicio:', e);
                        }
                    }
                    
                    if (inc.fechaFin) {
                        try {
                            const fechaFi = inc.fechaFin instanceof Date ? inc.fechaFin : new Date(inc.fechaFin);
                            if (!isNaN(fechaFi.getTime())) {
                                fechaFin = fechaFi.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                            }
                        } catch (e) {
                            console.warn('Error al formatear fechaFin:', e);
                        }
                    }
                    
                    const codigo = inc.record?.['CODIGO'] || inc.record?.['CÓDIGO'] || inc.record?.['codigo'] || 'N/A';
                    const diagnostico = inc.record?.['DESCRIPCION'] || inc.record?.['DESCRIPCIÓN'] || inc.record?.['descripcion'] || 'Sin descripción';
                    const tipo = inc.record?.['CLASE DE INCAPACIDAD'] || inc.record?.['clase_de_incapacidad'] || 'EPS';
                    
                    // Calcular estado
                    let estado = 'Finalizado';
                    let estadoColor = '#64748B';
                    
                    if (inc.fechaFin) {
                        try {
                            const fechaFi = inc.fechaFin instanceof Date ? inc.fechaFin : new Date(inc.fechaFin);
                            if (!isNaN(fechaFi.getTime())) {
                                const diffTime = fechaFi - today;
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                
                                if (diffDays < 0) {
                                    estado = 'Finalizado';
                                    estadoColor = '#64748B';
                                } else if (diffDays <= 2) {
                                    estado = 'Próximo a vencer';
                                    estadoColor = '#F59E0B';
                                } else {
                                    estado = 'En curso';
                                    estadoColor = '#10B981';
                                }
                            }
                        } catch (e) {
                            console.warn('Error al calcular estado:', e);
                        }
                    }

                    return `
                        <div style="background: ${index === 0 ? '#FEF3C7' : '#F8FAFC'}; border: ${index === 0 ? '2px solid #F59E0B' : '1px solid #e2e8f0'}; border-radius: 8px; padding: 15px; margin-bottom: 12px; transition: all 0.2s;">
                            ${index === 0 ? '<div style="font-size: 11px; font-weight: 700; color: #92400E; margin-bottom: 8px; text-transform: uppercase;">🔹 PRINCIPAL (Más reciente >= 10 días)</div>' : ''}
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Fecha Inicio</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 14px;">📅 ${fechaInicio}</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Fecha Fin</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 14px;">📅 ${fechaFin}</div>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Días</div>
                                    <div style="font-weight: 700; color: #174ea6; font-size: 16px;">📊 ${inc.diasIncapacidad} días</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Tipo</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 14px;">
                                        <span style="padding: 2px 8px; border-radius: 12px; background: ${tipo === 'ARL' ? '#FEF3C7' : tipo === 'EMPRESA' ? '#DCFCE7' : '#DBEAFE'}; color: ${tipo === 'ARL' ? '#92400E' : tipo === 'EMPRESA' ? '#166534' : '#1E40AF'}; font-size: 12px;">
                                            ${tipo}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Estado</div>
                                    <div style="font-weight: 600; color: ${estadoColor}; font-size: 13px;">● ${estado}</div>
                                </div>
                            </div>
                            <div style="background: white; border-radius: 6px; padding: 12px; border: 1px solid #e2e8f0;">
                                <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 6px;">🏷️ Código Diagnóstico</div>
                                <div style="font-weight: 700; color: #1E293B; font-size: 15px; margin-bottom: 8px;">${codigo}</div>
                                <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">📝 Descripción</div>
                                <div style="color: #475569; font-size: 14px; line-height: 1.5;">${diagnostico}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Resumen -->
            <div style="background: #F1F5F9; border-radius: 8px; padding: 12px 15px; margin-bottom: 20px;">
                <div style="font-size: 13px; color: #475569;">
                    <strong>Total días en incapacidades >= 10:</strong> ${totalDias} días
                </div>
            </div>

            <!-- Nota de seguimiento -->
            ${this.renderNotaSeguimientoSection(cedula)}
        `;
    }

    renderCondicion2Detalle(nombre, cedula, incapacidades, totalDias) {
        const today = new Date();

        return `
            <!-- Encabezado del empleado -->
            <div style="display: flex; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;">
                <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #10B981, #059669); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 22px; flex-shrink: 0;">
                    ${nombre.split(' ').map(n => n[0]).filter(c => c).join('').substring(0, 2).toUpperCase()}
                </div>
                <div style="margin-left: 15px; flex: 1;">
                    <h3 style="font-size: 18px; margin: 0; color: #1E293B; font-weight: 600;">${nombre}</h3>
                    <div style="font-size: 14px; color: #64748B; margin-top: 4px;">CC: ${cedula}</div>
                </div>
                <div style="background: #DCFCE7; color: #166534; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                    🔗 Suma >= 10 días
                </div>
            </div>

            <!-- Secuencia de incapacidades -->
            <div style="margin-bottom: 20px;">
                <h4 style="font-size: 14px; font-weight: 600; color: #1E293B; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-link" style="color: #10B981;"></i>
                    SECUENCIA DE INCAPACIDADES (Gaps <= 3 días)
                </h4>
                ${incapacidades.map((inc, index) => {
                    const fechaInicio = inc.fechaInicio ? inc.fechaInicio.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
                    const fechaFin = inc.fechaFin ? inc.fechaFin.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
                    const codigo = inc.record?.['CODIGO'] || inc.record?.['CÓDIGO'] || inc.record?.['codigo'] || 'N/A';
                    const diagnostico = inc.record?.['DESCRIPCION'] || inc.record?.['DESCRIPCIÓN'] || inc.record?.['descripcion'] || 'Sin descripción';
                    const tipo = inc.record?.['CLASE DE INCAPACIDAD'] || inc.record?.['clase_de_incapacidad'] || 'EPS';
                    
                    // Calcular gap con la incapacidad anterior
                    let gapHTML = '';
                    if (index > 0) {
                        const incAnterior = incapacidades[index - 1];
                        if (incAnterior.fechaFin && inc.fechaInicio) {
                            const gapDias = Math.ceil((inc.fechaInicio - incAnterior.fechaFin) / (1000 * 60 * 60 * 24));
                            const gapColor = gapDias <= 3 ? '#10B981' : '#F59E0B';
                            gapHTML = `
                                <div style="font-size: 11px; color: ${gapColor}; margin-top: 6px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <i class="fas fa-hourglass-half"></i>
                                    Gap: ${gapDias} día${gapDias !== 1 ? 's' : ''} desde la anterior
                                </div>
                            `;
                        }
                    }

                    return `
                        <div style="background: #F8FAFC; border-left: 4px solid ${index === 0 ? '#10B981' : '#94A3B8'}; border-radius: 8px; padding: 15px; margin-bottom: 12px; position: relative;">
                            <div style="position: absolute; top: 10px; right: 10px; background: ${index === 0 ? '#10B981' : '#94A3B8'}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
                                ${index + 1}
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Fecha Inicio</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 14px;">📅 ${fechaInicio}</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Fecha Fin</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 14px;">📅 ${fechaFin}</div>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Días</div>
                                    <div style="font-weight: 700; color: #174ea6; font-size: 16px;">📊 ${inc.diasIncapacidad} días</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Tipo</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 14px;">
                                        <span style="padding: 2px 8px; border-radius: 12px; background: ${tipo === 'ARL' ? '#FEF3C7' : tipo === 'EMPRESA' ? '#DCFCE7' : '#DBEAFE'}; color: ${tipo === 'ARL' ? '#92400E' : tipo === 'EMPRESA' ? '#166534' : '#1E40AF'}; font-size: 12px;">
                                            ${tipo}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Código</div>
                                    <div style="font-weight: 600; color: #1E293B; font-size: 13px;">🏷️ ${codigo}</div>
                                </div>
                            </div>
                            <div style="background: white; border-radius: 6px; padding: 10px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                                <div style="font-size: 11px; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">📝 Diagnóstico</div>
                                <div style="color: #475569; font-size: 13px; line-height: 1.4;">${diagnostico}</div>
                            </div>
                            ${gapHTML}
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Resumen -->
            <div style="background: linear-gradient(135deg, #10B981, #059669); border-radius: 8px; padding: 15px; margin-bottom: 20px; color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">TOTAL ACUMULADO</div>
                        <div style="font-size: 24px; font-weight: 700;">${totalDias} días</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">INCAPACIDADES</div>
                        <div style="font-size: 24px; font-weight: 700;">${incapacidades.length}</div>
                    </div>
                </div>
            </div>

            <!-- Nota de seguimiento -->
            ${this.renderNotaSeguimientoSection(cedula)}
        `;
    }

    renderNotaSeguimientoSection(cedula, nombreEmpleado) {
        // Nota: En una implementación real, las notas se guardarían en backend/archivo
        // Aquí simulamos la funcionalidad
        const nombreParam = nombreEmpleado ? nombreEmpleado.replace(/'/g, "\\'") : '';
        
        return `
            <div style="border-top: 2px solid #e2e8f0; padding-top: 20px;">
                <h4 style="font-size: 14px; font-weight: 600; color: #1E293B; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-folder-open" style="color: #174ea6;"></i>
                    SEGUIMIENTO DEL CASO
                </h4>
                <div style="display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap;">
                    <button onclick="window.medicAusentismoComponent.abrirSeguimiento('${cedula.replace(/'/g, "\\'")}', '${nombreParam}')" 
                        style="padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; background: linear-gradient(135deg, #174ea6, #2d5dc7); color: white; display: flex; align-items: center; gap: 8px; transition: all 0.2s;"
                        onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 6px -1px rgba(23, 78, 166, 0.3)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        <i class="fas fa-folder-open"></i> Abrir Seguimiento
                    </button>
                </div>
            </div>
        `;
    }

    guardarNota(cedula) {
        const textarea = document.getElementById(`notaSeguimiento_${cedula.replace(/[^a-zA-Z0-9]/g, '_')}`);
        if (!textarea) return;

        const nota = textarea.value.trim();
        if (!nota) {
            this.showNotification('Por favor escribe una nota', 'warning');
            return;
        }

        // En una implementación real, aquí se guardaría en backend/archivo
        // Por ahora, simulamos el guardado
        console.log(`[NOTA GUARDADA] Cédula: ${cedula}, Nota: ${nota}`);

        // Simular guardado exitoso
        this.showNotification('Nota guardada exitosamente', 'success');

        // Cerrar modal después de guardar
        setTimeout(() => {
            document.getElementById('detailModal').style.display = 'none';
        }, 1000);
    }

    abrirSeguimiento(cedula, nombreEmpleado) {
        // Cerrar el modal de detalles primero
        document.getElementById('detailModal').style.display = 'none';
        
        // Cambiar a la vista de seguimiento
        this.currentView = 'seguimiento-incapacidades';
        this.render();
        
        // Mostrar notificación
        this.showNotification(`Abriendo seguimiento para: ${nombreEmpleado}`, 'info');
        
        // TODO: En el futuro, aquí se abrirá la interfaz de seguimiento detallado
        console.log(`[ABRIR SEGUIMIENTO] Cédula: ${cedula}, Nombre: ${nombreEmpleado}`);
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

                            // ✅ VALIDACIÓN: Verificar si el empleado pertenece a la empresa seleccionada
                            const empresaSeleccionada = this.currentCompany.toUpperCase();
                            const empresaEmpleado = (result.datos.empresa || '').toUpperCase();
                            
                            if (empresaEmpleado && empresaSeleccionada !== empresaEmpleado) {
                                // ⚠️ ALERTA: El empleado pertenece a otra empresa - Mostrar modal personalizado
                                this.showEmpresaMismatchModal(
                                    result.datos.nombre,
                                    result.datos.empresa,
                                    this.currentCompany,
                                    () => {
                                        // Usuario confirmó - continuar con el registro
                                        this.showStatus(statusDiv, 'Empleado encontrado. Puede continuar con el registro.', 'success');
                                    },
                                    () => {
                                        // Usuario canceló - limpiar formulario
                                        this.showStatus(statusDiv, 'Búsqueda cancelada. Empleado no pertenece a esta empresa.', 'warning');
                                        document.getElementById('nombre-input').value = '';
                                        document.getElementById('cargo-input').value = '';
                                        document.getElementById('departamento-input').value = '';
                                        document.getElementById('empresa-usuaria-input').value = '';
                                        document.getElementById('entidad-input').value = '';
                                    }
                                );
                            } else {
                                // ✅ Empleado de la misma empresa
                                this.showStatus(statusDiv, 'Empleado encontrado. Puede continuar con el registro.', 'success');
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

            // 3. Autocompletar código y descripción CIE-10 para LICENCIA DE LUTO
            const tipoIncapacidadSelect = document.getElementById('tipo-incapacidad-select');
            if (tipoIncapacidadSelect) {
                tipoIncapacidadSelect.addEventListener('change', async () => {
                    const tipoIncapacidad = tipoIncapacidadSelect.value;
                    const codigoInput = document.getElementById('codigo-input');
                    const descripcionInput = document.getElementById('descripcion-input');

                    // Si es LICENCIA DE LUTO, autocompletar código y descripción
                    if (tipoIncapacidad === 'LICENCIA DE LUTO') {
                        codigoInput.value = 'Z63.4';
                        descripcionInput.value = 'Luto';
                        this.showStatus(statusDiv, 'Código CIE-10 autocompletado para Licencia de Luto.', 'info');
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

    /**
     * Muestra mensaje de estado moderno con icono y animación
     * @param {HTMLElement} statusDiv - Elemento contenedor del estado
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo de estado: 'success', 'error', 'warning', 'info'
     */
    showStatus(statusDiv, message, type) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'status-message';
        
        // Definir configuración por tipo
        const config = {
            success: {
                icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
                bg: '#F0FDF4',
                border: '#86EFAC',
                text: '#166534',
                iconBg: '#DCFCE7'
            },
            error: {
                icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
                bg: '#FEF2F2',
                border: '#FCA5A5',
                text: '#991B1B',
                iconBg: '#FEE2E2'
            },
            warning: {
                icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
                bg: '#FFFBEB',
                border: '#FCD34D',
                text: '#92400E',
                iconBg: '#FEF3C7'
            },
            info: {
                icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
                bg: '#EFF6FF',
                border: '#93C5FD',
                text: '#1E40AF',
                iconBg: '#DBEAFE'
            }
        };

        const currentConfig = config[type] || config.info;

        // Aplicar estilos modernos
        statusDiv.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 18px;
            background: ${currentConfig.bg};
            border: 1px solid ${currentConfig.border};
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
            color: ${currentConfig.text};
            animation: slideDown 0.3s ease-out;
            margin-bottom: 20px;
        `;

        // Contenido con icono
        statusDiv.innerHTML = `
            <div style="
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: ${currentConfig.iconBg};
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                color: ${currentConfig.text};
            ">
                ${currentConfig.icon}
            </div>
            <span style="flex: 1;">${message}</span>
        `;

        // Agregar animación si no existe
        if (!document.getElementById('status-animations')) {
            const style = document.createElement('style');
            style.id = 'status-animations';
            style.textContent = `
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
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
            empresa_usuaria: document.getElementById('empresa-usuaria-input').value.trim(),
            genero: document.getElementById('genero-select').value,
            entidad: document.getElementById('entidad-input').value.trim(),
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

    /**
     * Muestra modal personalizado de advertencia por empresa diferente
     * @param {string} nombreEmpleado - Nombre del empleado encontrado
     * @param {string} empresaEmpleado - Empresa a la que pertenece el empleado
     * @param {string} empresaSeleccionada - Empresa actualmente seleccionada en la UI
     * @param {Function} onConfirm - Callback cuando el usuario confirma
     * @param {Function} onCancel - Callback cuando el usuario cancela
     */
    showEmpresaMismatchModal(nombreEmpleado, empresaEmpleado, empresaSeleccionada, onConfirm, onCancel) {
        // Crear overlay del modal
        const overlay = document.createElement('div');
        overlay.id = 'empresa-mismatch-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            animation: fadeIn 0.2s ease-out;
        `;

        // Crear modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            max-width: 500px;
            width: 90%;
            overflow: hidden;
            animation: slideUp 0.3s ease-out;
        `;

        // Header del modal
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px 24px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        // Icono de advertencia
        const iconContainer = document.createElement('div');
        iconContainer.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #FEF3C7;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        `;
        iconContainer.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400E" stroke-width="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
        `;

        // Título
        const title = document.createElement('h3');
        title.textContent = '⚠️ Empresa Diferente';
        title.style.cssText = `
            font-size: 16px;
            font-weight: 600;
            color: #1E293B;
            margin: 0;
        `;

        header.appendChild(iconContainer);
        header.appendChild(title);

        // Cuerpo del modal
        const body = document.createElement('div');
        body.style.cssText = `
            padding: 24px;
        `;

        // Mensaje
        const message = document.createElement('div');
        message.style.cssText = `
            font-size: 14px;
            color: #64748B;
            line-height: 1.6;
            margin-bottom: 16px;
        `;
        message.innerHTML = `
            El empleado <strong style="color: #1E293B;">${nombreEmpleado}</strong> pertenece a la empresa 
            <strong style="color: #174ea6;">${empresaEmpleado}</strong>, pero usted está registrado en 
            <strong style="color: #174ea6;">${empresaSeleccionada}</strong>.
        `;

        // Nota informativa
        const note = document.createElement('div');
        note.style.cssText = `
            background: #F8FAFC;
            border-left: 3px solid #174ea6;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 13px;
            color: #475569;
        `;
        note.innerHTML = `
            <strong>Nota:</strong> Los datos se guardarán en el archivo de 
            <strong>${empresaSeleccionada}</strong>. Asegúrese de que esta sea la empresa correcta 
            antes de continuar.
        `;

        body.appendChild(message);
        body.appendChild(note);

        // Footer con botones
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 16px 24px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: #F8FAFC;
        `;

        // Botón Cancelar
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid #dee2e6;
            background: white;
            color: #64748B;
            transition: all 0.2s;
        `;
        cancelBtn.onmouseover = function() {
            this.style.backgroundColor = '#f1f5f9';
            this.style.borderColor = '#cbd5e1';
        };
        cancelBtn.onmouseout = function() {
            this.style.backgroundColor = 'white';
            this.style.borderColor = '#dee2e6';
        };
        cancelBtn.onclick = () => {
            overlay.remove();
            if (onCancel) onCancel();
        };

        // Botón Confirmar
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Continuar';
        confirmBtn.style.cssText = `
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            background: #174ea6;
            color: white;
            transition: all 0.2s;
        `;
        confirmBtn.onmouseover = function() {
            this.style.backgroundColor = '#185abd';
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 4px 6px -1px rgba(23, 78, 166, 0.3)';
        };
        confirmBtn.onmouseout = function() {
            this.style.backgroundColor = '#174ea6';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        };
        confirmBtn.onclick = () => {
            overlay.remove();
            if (onConfirm) onConfirm();
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        // Ensamblar modal
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);

        // Agregar al documento
        document.body.appendChild(overlay);

        // Agregar animaciones CSS dinámicamente
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);

        // Enfocar botón de confirmar por defecto
        setTimeout(() => confirmBtn.focus(), 100);
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
