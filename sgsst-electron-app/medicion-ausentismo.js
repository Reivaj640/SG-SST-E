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
            default:
                this.renderMainView(this.container);
        }
    }

    renderMainView(container) {
        // Encabezado
        const header = document.createElement('div');
        header.className = 'submodule-header';

        const title = document.createElement('h2');
        title.textContent = this.submoduleName;
        header.appendChild(title);

        if (this.onBack && typeof this.onBack === 'function') {
            const backButton = document.createElement('button');
            backButton.className = 'btn';
            backButton.textContent = '← Volver';
            backButton.addEventListener('click', this.onBack);
            header.appendChild(backButton);
        }

        container.appendChild(header);

        // Descripción
        const description = document.createElement('p');
        description.className = 'submodule-description';
        description.textContent = 'Este submódulo permite gestionar la medición del ausentismo por causa médica.';
        container.appendChild(description);

        // Tarjetas de opciones
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'module-cards';

        cardsContainer.appendChild(
            this.createModuleCard(
                'Ver ausentismo',
                'Consulta las mediciones del ausentismo por causa médica ya realizadas.',
                () => this.handleViewAusentismo()
            )
        );

        cardsContainer.appendChild(
            this.createModuleCard(
                'Registrar Ausentismo',
                'Registra nuevos casos de ausentismo por causa médica.',
                () => this.handleRegistrarAusentismo()
            )
        );

        cardsContainer.appendChild(
            this.createModuleCard(
                'Seguimiento de Incapacidades',
                'Gestiona y sigue el estado de las incapacidades médicas de los empleados.',
                () => this.handleSeguimientoIncapacidades()
            )
        );

        container.appendChild(cardsContainer);

        // Notificaciones
        const notificationArea = document.createElement('div');
        notificationArea.className = 'notification-area';
        notificationArea.innerHTML = `
            <h3>Notificaciones recientes</h3>
            <div class="notification-item">
                <div class="notification-icon">ℹ️</div>
                <div class="notification-content">
                    <div class="notification-title">Nueva medición pendiente</div>
                    <div class="notification-message">Hay datos pendientes de actualización para el ausentismo del mes.</div>
                    <div class="notification-time">Hace 1 día</div>
                </div>
            </div>
            <div class="notification-item">
                <div class="notification-icon">✅</div>
                <div class="notification-content">
                    <div class="notification-title">Medición completada</div>
                    <div class="notification-message">La medición del ausentismo del mes pasado ha sido completada.</div>
                    <div class="notification-time">Hace 3 días</div>
                </div>
            </div>
        `;
        container.appendChild(notificationArea);
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
        // Limpiar el contenedor principal
        container.style.padding = '0'; // Eliminar padding para que la interfaz ocupe todo el ancho

        const header = this.createHeader('Seguimiento de Incapacidades', () => {
            this.currentView = 'main';
            container.style.padding = ''; // Restaurar padding al volver
            this.render();
        });
        container.appendChild(header);

        // Crear el contenedor para la interfaz de seguimiento de incapacidades
        const seguimientoLayout = document.createElement('div');
        seguimientoLayout.style.cssText = `
            display: flex;
            flex-direction: column;
            height: calc(100vh - 220px);
            width: 100%;
            max-width: none;
            overflow: hidden;
        `;

        // Crear iframe para cargar la interfaz de seguimiento de incapacidades
        const iframe = document.createElement('iframe');
        iframe.src = 'seguimiento-incapacidades.html';
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            max-width: none;
        `;

        // Manejar mensajes desde el iframe
        const handleIframeMessage = async (event) => {
            if (event.source !== iframe.contentWindow) return; // Asegurar que el mensaje viene del iframe correcto

            try {
                if (event.data.type === 'GET_AUSENTISMO_DATA') {
                    // Llamar a la API de Electron para obtener los datos de ausentismo
                    const result = await window.electronAPI.readAusentismoData(this.currentCompany);
                    // Enviar la respuesta de vuelta al iframe
                    iframe.contentWindow.postMessage({
                        type: 'AUSENTISMO_DATA_RESPONSE',
                        id: event.data.id, // Para emparejar la solicitud con la respuesta
                        data: result
                    }, '*');
                } else if (event.data.type === 'SAVE_FOLLOW_UP') {
                    // Llamar a la API de Electron para guardar el seguimiento
                    const result = await window.electronAPI.saveFollowUp(event.data.followUpData, this.currentCompany);
                    // Enviar la respuesta de vuelta al iframe
                    iframe.contentWindow.postMessage({
                        type: 'FOLLOW_UP_SAVE_RESPONSE',
                        id: event.data.id,
                        data: result
                    }, '*');
                } else if (event.data.type === 'EXPORT_INCAPACITY_DATA') {
                    // Llamar a la API de Electron para exportar datos
                    const result = await window.electronAPI.exportIncapacityData(this.currentCompany);
                    // Enviar la respuesta de vuelta al iframe
                    iframe.contentWindow.postMessage({
                        type: 'EXPORT_DATA_RESPONSE',
                        id: event.data.id,
                        data: result
                    }, '*');
                } else if (event.data.type === 'BUSCAR_EMPLEADO_CEDULA') {
                    // Llamar a la API de Electron para buscar empleado por cédula
                    const result = await window.electronAPI.buscarEmpleadoPorCedula(
                        event.data.cedula,
                        event.data.empresa
                    );
                    // Enviar la respuesta de vuelta al iframe
                    iframe.contentWindow.postMessage({
                        type: 'BUSCAR_EMPLEADO_RESPONSE',
                        id: event.data.id,
                        data: result
                    }, '*');
                } else if (event.data.type === 'BUSCAR_CIE10_DESCRIPCION') {
                    // Llamar a la API de Electron para buscar descripción CIE-10
                    const result = await window.electronAPI.buscarCie10Descripcion(
                        event.data.companyName,
                        event.data.cie10Code
                    );
                    // Enviar la respuesta de vuelta al iframe
                    iframe.contentWindow.postMessage({
                        type: 'BUSCAR_CIE10_RESPONSE',
                        id: event.data.id,
                        data: result
                    }, '*');
                } else if (event.data.type === 'PROCESAR_AUSENTISMO') {
                    // Llamar a la API de Electron para procesar ausentismo
                    const result = await window.electronAPI.procesarAusentismo(
                        event.data.empresa,
                        event.data.formData
                    );
                    // Enviar la respuesta de vuelta al iframe
                    iframe.contentWindow.postMessage({
                        type: 'PROCESAR_AUSENTISMO_RESPONSE',
                        id: event.data.id,
                        data: result
                    }, '*');
                } else if (event.data && event.data.type === 'LOAD_FOLLOW_UP_DATA' &&
                          (event.data.source === 'SEGUIMIENTO_INCAPACIDADES' ||
                           event.data.target === 'MEDICION_AUSENTISMO_CONTAINER')) {
                    // Llamar a la API de Electron para cargar datos de seguimiento
                    const companyName = event.data.companyName || this.currentCompany;
                    const result = await window.electronAPI.loadFollowUpData(companyName);
                    // Enviar la respuesta de vuelta al iframe
                    iframe.contentWindow.postMessage({
                        type: 'LOAD_FOLLOW_UP_DATA_RESPONSE',
                        id: event.data.id,
                        data: result
                    }, '*');
                }
            } catch (error) {
                console.error('Error procesando mensaje del iframe:', error);
                // Enviar error de vuelta al iframe
                iframe.contentWindow.postMessage({
                    type: 'ERROR_RESPONSE',
                    id: event.data.id,
                    error: error.message
                }, '*');
            }
        };

        // Agregar listener para mensajes desde el iframe
        window.addEventListener('message', handleIframeMessage);

        // Pasar contexto de empresa al iframe cuando cargue
        iframe.onload = () => {
            try {
                // Intentar pasar el contexto de la empresa al iframe
                iframe.contentWindow.postMessage({
                    type: 'SET_COMPANY_CONTEXT',
                    company: this.currentCompany
                }, '*');
            } catch (error) {
                console.error('Error al enviar contexto al iframe:', error);
            }
        };

        // Limpiar listener cuando el componente se desmonte
        const cleanup = () => {
            window.removeEventListener('message', handleIframeMessage);
        };

        // Si hay un cleanup anterior, ejecutarlo
        if (this.iframeMessageCleanup) {
            this.iframeMessageCleanup();
        }
        this.iframeMessageCleanup = cleanup;

        seguimientoLayout.appendChild(iframe);
        container.appendChild(seguimientoLayout);
    }

    async renderRegistrarAusentismoView(container) {
        console.log('[DEBUG] renderRegistrarAusentismoView: Iniciando renderizado del formulario.');
        const header = this.createHeader('Registrar Ausentismo', () => {
            this.currentView = 'main';
            this.render();
        });
        container.appendChild(header);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'control-remisiones-content';
        contentDiv.style.padding = '0px';
        container.appendChild(contentDiv);

        // Área de estado para mostrar feedback al usuario
        const statusDiv = document.createElement('div');
        statusDiv.id = 'form-status';
        statusDiv.style.cssText = `
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 4px;
            font-weight: bold;
            text-align: center;
            display: none;
        `;
        contentDiv.appendChild(statusDiv);

        // --- Creación del Formulario ---
        const form = document.createElement('div');
        form.className = 'registrar-ausentismo-form';
        form.innerHTML = `
            <h3>Formulario de Registro de Incapacidad</h3>

            <div class="form-row">
                <div class="form-group">
                    <label for="cedula-input">Cédula:</label>
                    <input type="text" id="cedula-input" class="form-control" placeholder="Ingrese la cédula del empleado">
                </div>
                <div class="form-group">
                    <label for="nombre-input">Nombre Completo:</label>
                    <input type="text" id="nombre-input" class="form-control" placeholder="Nombre del empleado" readonly>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="cargo-input">Cargo:</label>
                    <input type="text" id="cargo-input" class="form-control" placeholder="Cargo del empleado" readonly>
                </div>
                <div class="form-group">
                    <label for="departamento-input">Departamento:</label>
                    <input type="text" id="departamento-input" class="form-control" placeholder="Departamento" readonly>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="empresa-usuaria-input">Empresa Usuaria:</label>
                    <input type="text" id="empresa-usuaria-input" class="form-control" placeholder="Empresa donde presta el servicio" readonly>
                </div>
                <div class="form-group">
                    <label for="genero-select">Género:</label>
                    <select id="genero-select" class="form-control">
                        <option value="">Seleccione...</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="clase-incapacidad-select">Clase de Incapacidad:</label>
                    <select id="clase-incapacidad-select" class="form-control">
                        <option value="">Seleccione...</option>
                        <option value="EPS">EPS</option>
                        <option value="ARL">ARL</option>
                        <option value="EMPRESA">EMPRESA</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="tipo-incapacidad-select">Tipo de Incapacidad:</label>
                    <select id="tipo-incapacidad-select" class="form-control">
                        <option value="">Seleccione...</option>
                        <option value="ACCIDENTE DE TRANSITO">ACCIDENTE DE TRANSITO</option>
                        <option value="ACCIDENTE LABORAL">ACCIDENTE LABORAL</option>
                        <option value="ENFERMEDAD GENERAL">ENFERMEDAD GENERAL</option>
                        <option value="LICENCIA DE LUTO">LICENCIA DE LUTO</option>
                        <option value="LICENCIA DE MATERNIDAD">LICENCIA DE MATERNIDAD</option>
                        <option value="LICENCIA DE PATERNIDAD">LICENCIA DE PATERNIDAD</option>
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="entidad-input">Entidad (EPS/SURA):</label>
                    <input type="text" id="entidad-input" class="form-control" placeholder="Entidad de salud" readonly>
                </div>
                <div class="form-group">
                    <label for="fecha-inicio-input">Fecha de Inicio:</label>
                    <input type="date" id="fecha-inicio-input" class="form-control">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="fecha-fin-input">Fecha de Finalización:</label>
                    <input type="date" id="fecha-fin-input" class="form-control">
                </div>
                <div class="form-group">
                    <label for="codigo-input">Código Diagnóstico (CIE-10):</label>
                    <input type="text" id="codigo-input" class="form-control" placeholder="Ej: Z34.0">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group full-width">
                    <label for="descripcion-input">Descripción Diagnóstico:</label>
                    <input type="text" id="descripcion-input" class="form-control" placeholder="Descripción del diagnóstico">
                </div>
            </div>

            <div class="form-actions">
                <button type="button" id="registrar-btn" class="btn btn-primary">Registrar Incapacidad</button>
                <button type="button" id="limpiar-btn" class="btn btn-secondary">Limpiar Formulario</button>
            </div>
        `;
        contentDiv.appendChild(form);

        // --- Lógica de los Eventos ---

        // Usamos setTimeout para asegurarnos de que el DOM esté completamente renderizado
        setTimeout(() => {
            console.log('Event listeners setup started');
            console.log('Current company:', this.currentCompany);

            // 1. Autocompletar al salir del campo Cédula
            const cedulaInput = document.getElementById('cedula-input');
            if (cedulaInput) {
                console.log('Cédula input found, adding blur event listener');
                cedulaInput.addEventListener('blur', async () => {
                    console.log('Blur event triggered');
                    const cedula = cedulaInput.value.trim();
                    console.log('Cédula value:', cedula);

                    if (!cedula) {
                        console.log('Cédula is empty, skipping search');
                        return;
                    }

                    this.showStatus(statusDiv, 'Buscando empleado...', 'info');

                    try {
                        console.log('Calling buscarEmpleadoPorCedula with:', { cedula, empresa: this.currentCompany });
                        const result = await window.electronAPI.buscarEmpleadoPorCedula(cedula, this.currentCompany);
                        console.log('Search result:', result);

                        if (result && result.success) {
                            document.getElementById('nombre-input').value = result.datos.nombre || '';
                            document.getElementById('cargo-input').value = result.datos.cargo || '';
                            document.getElementById('departamento-input').value = result.datos.area || '';
                            document.getElementById('empresa-usuaria-input').value = result.datos.empresa_usuaria || '';
                            document.getElementById('entidad-input').value = result.datos.entidad || '';

                            // ¡Importante! Actualizar la empresa actual si el empleado pertenece a otra.
                            if (result.datos.empresa && this.currentCompany.toUpperCase() !== result.datos.empresa.toUpperCase()) {
                                console.log(`[CONTEXT SWITCH] La empresa cambió de ${this.currentCompany} a ${result.datos.empresa}`);
                                this.currentCompany = result.datos.empresa;
                                this.showStatus(statusDiv, `Empleado encontrado. Contexto de empresa actualizado a: ${this.currentCompany}`, 'success');
                            } else {
                                this.showStatus(statusDiv, 'Empleado encontrado.', 'success');
                            }
                        } else {
                            this.showStatus(statusDiv, 'Empleado no encontrado. Diligencie los datos manualmente.', 'warning');
                            // Limpiar campos autocompletados
                            document.getElementById('nombre-input').value = '';
                            document.getElementById('cargo-input').value = '';
                            document.getElementById('departamento-input').value = '';
                            document.getElementById('empresa-usuaria-input').value = '';
                            document.getElementById('entidad-input').value = '';
                        }
                    } catch (error) {
                        console.error('Error buscando empleado:', error);
                        this.showStatus(statusDiv, `Error al buscar empleado: ${error.message}`, 'error');
                    }
                });
            } else {
                console.error('No se encontró el campo de cédula (cedula-input)');
            }

            // 2. Autocompletar descripción de diagnóstico al salir del campo Código
            const codigoInput = document.getElementById('codigo-input');
            if (codigoInput) {
                console.log('Código input found, adding blur event listener');
                codigoInput.addEventListener('blur', async () => {
                    console.log('Blur event triggered on codigo-input');
                    const cie10Code = codigoInput.value.trim();
                    console.log('CIE-10 Code value:', cie10Code);

                    if (!cie10Code) {
                        console.log('CIE-10 Code is empty, skipping search');
                        return;
                    }

                    this.showStatus(statusDiv, 'Buscando descripción de diagnóstico...', 'info');

                    try {
                        console.log('Calling buscarCie10Descripcion with:', { companyName: this.currentCompany, cie10Code });
                        const result = await window.electronAPI.buscarCie10Descripcion(this.currentCompany, cie10Code);
                        console.log('Search result:', result);

                        if (result && result.success) {
                            document.getElementById('descripcion-input').value = result.datos.descripcion || '';
                            this.showStatus(statusDiv, 'Descripción de diagnóstico encontrada.', 'success');
                        } else {
                            this.showStatus(statusDiv, 'Descripción de diagnóstico no encontrada.', 'warning');
                            document.getElementById('descripcion-input').value = '';
                        }
                    } catch (error) {
                        console.error('Error buscando descripción de diagnóstico:', error);
                        this.showStatus(statusDiv, `Error al buscar descripción: ${error.message}`, 'error');
                    }
                });
            } else {
                console.error('No se encontró el campo de código de diagnóstico (codigo-input)');
            }

            // 3. Enviar formulario al hacer clic en "Registrar"
            const registrarBtn = document.getElementById('registrar-btn');
            if (registrarBtn) {
                registrarBtn.addEventListener('click', async () => {
                    const formData = this.getFormData();
                    if (!this.validateFormData(formData)) {
                        this.showStatus(statusDiv, 'Por favor, complete todos los campos obligatorios.', 'error');
                        return;
                    }

                    this.showStatus(statusDiv, 'Registrando incapacidad...', 'info');
                    this.disableForm(true);

                    try {
                        // Primero, necesitamos la ruta del archivo de ausentismo
                        const ausentismoResult = await window.electronAPI.readAusentismoData(this.currentCompany);
                        if (!ausentismoResult.success) {
                            throw new Error(ausentismoResult.error);
                        }
                        const filePath = ausentismoResult.filePath;

                        // Llamamos al nuevo método para agregar la incapacidad
                        const result = await window.electronAPI.procesarAusentismo(
                            this.currentCompany,   // empresa
                            formData               // json_datos (se convierte a string en preload.js)
                        );

                        if (result.success) {
                            this.showStatus(statusDiv, '¡Incapacidad registrada exitosamente!', 'success');
                            this.limpiarFormulario(); // Limpiar el formulario tras el éxito
                        } else {
                            throw new Error(result.error);
                        }
                    } catch (error) {
                        console.error('Error registrando incapacidad:', error);
                        this.showStatus(statusDiv, `Error al registrar: ${error.message}`, 'error');
                    } finally {
                        this.disableForm(false);
                    }
                });
            }

            // 3. Limpiar formulario
            const limpiarBtn = document.getElementById('limpiar-btn');
            if (limpiarBtn) {
                limpiarBtn.addEventListener('click', () => {
                    this.limpiarFormulario();
                    this.showStatus(statusDiv, 'Formulario limpiado.', 'info');
                });
            }
        }, 0); // Usamos 0ms para asegurar que se ejecute en el siguiente ciclo de eventos
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
        // Limpiar el contenedor principal
        container.innerHTML = '';
        container.style.padding = '0'; // Eliminar padding para que el dashboard ocupe todo el ancho

        const header = this.createHeader('Dashboard de Ausentismo', () => {
            this.currentView = 'main';
            container.style.padding = ''; // Restaurar padding al volver
            this.render();
        });
        container.appendChild(header);

        // Crear el contenedor principal para el layout del dashboard, imitando el patrón de otros módulos
        const dashboardLayout = document.createElement('div');
        // Asignamos los estilos directamente, inspirados en la clase .remisiones-layout
        Object.assign(dashboardLayout.style, {
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 220px)', // Valor ajustado para dar más espacio
            width: '100%', // Asegurar que ocupe todo el ancho disponible
            maxWidth: 'none' // Eliminar cualquier restricción de ancho máximo
        });

        const iframe = document.createElement('iframe');
        iframe.src = 'modules/gestion-salud/ausentismo/ver-ausentismo-dashboard.html';
        iframe.classList.add('dashboard-fullscreen'); // Añadir clase para asegurar ancho completo
        Object.assign(iframe.style, {
            width: '100%',
            height: '100%', // El iframe ocupa el 100% de su nuevo padre (dashboardLayout)
            border: 'none',
            maxWidth: 'none' // Eliminar cualquier restricción de ancho máximo
        });

        // Cuando el iframe cargue, leer los datos y enviárselos
        iframe.onload = async () => {
            try {
                console.log(`[Dashboard Host] Solicitando datos de ausentismo para ${this.currentCompany}`);
                const result = await window.electronAPI.readAusentismoData(this.currentCompany);

                if (result.success) {
                    console.log(`[Dashboard Host] Datos leídos correctamente. Filas encontradas: ${result.rows ? result.rows.length : 0}. Enviando al iframe...`);
                    iframe.contentWindow.postMessage({ headers: result.headers, rows: result.rows }, '*');
                } else {
                    console.error('[Dashboard Host] La API reportó un error al leer los datos:', result.error);
                    iframe.contentWindow.postMessage({ error: result.error }, '*');
                }


            } catch (error) {
                console.error('[Dashboard Host] Error crítico al intentar cargar datos para el dashboard:', error);
                iframe.contentWindow.postMessage({ error: error.message }, '*');
            }
        };

        // Añadir el iframe al contenedor del layout
        dashboardLayout.appendChild(iframe);

        // Añadir el layout principal al contenedor del componente
        container.appendChild(dashboardLayout);
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
