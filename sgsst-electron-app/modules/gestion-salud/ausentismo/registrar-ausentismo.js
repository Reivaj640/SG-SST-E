// registrar-ausentismo.js - Componente para registrar ausentismo por causa médica

class RegistrarAusentismoComponent {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        console.log('Creando instancia de RegistrarAusentismoComponent');
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.logMessage = (msg, type) => console.log(`[${type}] ${msg}`);
        /* 📦443 (2026-06-25) — Loading tracker para spinners de carga de datos.
           Permite asociar un token de loading al toast de progreso para poder
           cerrarlo/actualizarlo cuando termina la operación asíncrona. */
        this._loadingToastId = null;
    }

    render() {
        console.log('Renderizando RegistrarAusentismoComponent');
        this.container.innerHTML = '';
        window.currentRegistrarAusentismoComponent = this;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';
        mainContainer.style.cssText = `
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        `;

        // Encabezado
        const header = this.createHeader('Registrar Ausentismo', () => {
            if (this.onBack && typeof this.onBack === 'function') {
                this.onBack();
            }
        });
        mainContainer.appendChild(header);

        // 📦443 (2026-06-25) — Sistema de notificaciones migrado a window.updateNotifier
        // (estándar del proyecto, mismo que 6.1.3). Ya no creamos un notificationDiv
        // propio: las notificaciones se gestionan vía window.updateNotifier.show()
        // con posición fija, animaciones consistentes y soporte para progress bar.

        // Contenedor del formulario modernizado
        const formContainer = document.createElement('div');
        formContainer.className = 'form-container-modern';
        formContainer.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            border: 1px solid #dee2e6;
            margin-top: 20px;
        `;

        // Header del formulario
        const formHeader = document.createElement('div');
        formHeader.className = 'form-header-modern';
        formHeader.style.cssText = `
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const formIcon = document.createElement('i');
        formIcon.className = 'fas fa-plus-circle';
        formIcon.style.cssText = `
            color: #174ea6;
            font-size: 20px;
        `;
        
        const formTitleContainer = document.createElement('div');
        const formTitle = document.createElement('h3');
        formTitle.textContent = 'Formulario de Registro';
        formTitle.style.cssText = `
            font-size: 18px;
            font-weight: 600;
            margin: 0;
            color: #1E293B;
        `;
        
        const formSubtitle = document.createElement('p');
        formSubtitle.textContent = 'Ingrese los datos completos para registrar una nueva incapacidad.';
        formSubtitle.style.cssText = `
            font-size: 14px;
            color: #64748B;
            margin: 4px 0 0 0;
        `;
        
        formTitleContainer.appendChild(formTitle);
        formTitleContainer.appendChild(formSubtitle);
        formHeader.appendChild(formIcon);
        formHeader.appendChild(formTitleContainer);
        formContainer.appendChild(formHeader);

        // Crear formulario
        const form = document.createElement('form');
        form.id = 'registrar-ausentismo-form';
        form.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
            gap: 20px;
        `;

        form.innerHTML = `
            <!-- Fila 1: Cédula y Nombre -->
            <div class="form-group-modern">
                <label for="cedula" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Cédula del Empleado</label>
                <input type="text" id="cedula" name="cedula" class="form-control-modern" placeholder="Ej: 12345678" required 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="nombre" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Nombre Completo</label>
                <input type="text" id="nombre" name="nombre" class="form-control-modern" placeholder="Nombre completo" required 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <!-- Fila 2: Cargo y Área -->
            <div class="form-group-modern">
                <label for="cargo" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Cargo</label>
                <input type="text" id="cargo" name="cargo" class="form-control-modern" placeholder="Cargo actual" 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="area" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Área / Departamento</label>
                <select id="area" name="area" class="form-control-modern" 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="Producción">Producción</option>
                    <option value="Administración">Administración</option>
                    <option value="Sistemas">Sistemas</option>
                    <option value="Recursos Humanos">Recursos Humanos</option>
                    <option value="Operaciones">Operaciones</option>
                    <option value="Logística">Logística</option>
                    <option value="Calidad">Calidad</option>
                    <option value="Seguridad">Seguridad</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Otros">Otros</option>
                </select>
            </div>

            <!-- Fila 3: Fechas -->
            <div class="form-group-modern">
                <label for="fechaInicio" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Fecha de Inicio</label>
                <input type="date" id="fechaInicio" name="fechaInicio" class="form-control-modern" required 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <div class="form-group-modern">
                <label for="fechaFin" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Fecha de Finalización</label>
                <input type="date" id="fechaFin" name="fechaFin" class="form-control-modern" required 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <!-- Fila 4: Tipo y Clase de Incapacidad -->
            <div class="form-group-modern">
                <label for="tipoIncapacidad" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Tipo de Incapacidad</label>
                <select id="tipoIncapacidad" name="tipoIncapacidad" class="form-control-modern" required 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="Enfermedad General">Enfermedad General</option>
                    <option value="Accidente de Trabajo">Accidente de Trabajo</option>
                    <option value="Enfermedad Laboral">Enfermedad Laboral</option>
                    <option value="Licencia de Maternidad">Licencia de Maternidad</option>
                    <option value="Licencia Paternidad">Licencia Paternidad</option>
                    <option value="Calamidad Doméstica">Calamidad Doméstica</option>
                    <option value="Vacaciones">Vacaciones</option>
                    <option value="Otros">Otros</option>
                </select>
            </div>

            <div class="form-group-modern">
                <label for="claseIncapacidad" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Clase de Incapacidad</label>
                <select id="claseIncapacidad" name="claseIncapacidad" class="form-control-modern" required 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="Temporal">Temporal</option>
                    <option value="Permanente Parcial">Permanente Parcial</option>
                    <option value="Permanente Total">Permanente Total</option>
                </select>
            </div>

            <!-- Fila 5: Entidad y Días -->
            <div class="form-group-modern">
                <label for="entidad" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Entidad (EPS/ARL)</label>
                <select id="entidad" name="entidad" class="form-control-modern" 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
                    <option value="">Seleccione...</option>
                    <option value="FAMISANAR">FAMISANAR</option>
                    <option value="SALUD TOTAL">SALUD TOTAL</option>
                    <option value="NUEVA E.P.S.">NUEVA E.P.S.</option>
                    <option value="SURA">SURA</option>
                    <option value="SANITAS">SANITAS</option>
                    <option value="BOLIVAR">BOLIVAR</option>
                    <option value="COLMÉDICAS">COLMÉDICAS</option>
                    <option value="OTRA">OTRA</option>
                </select>
            </div>

            <div class="form-group-modern">
                <label for="diasIncapacidad" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Días de Incapacidad</label>
                <input type="number" id="diasIncapacidad" name="diasIncapacidad" class="form-control-modern" placeholder="Ej: 5" min="1" required 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'">
            </div>

            <!-- Fila 6: Diagnóstico (ancho completo) -->
            <div class="form-group-modern" style="grid-column: span 2;">
                <label for="diagnostico" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Diagnóstico / Descripción</label>
                <textarea id="diagnostico" name="diagnostico" class="form-control-modern" rows="3" placeholder="Detalle del diagnóstico médico..." 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff; resize: vertical;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'"></textarea>
            </div>

            <!-- Fila 7: Observaciones (ancho completo) -->
            <div class="form-group-modern" style="grid-column: span 2;">
                <label for="observaciones" style="display: block; font-size: 13px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Observaciones Adicionales</label>
                <textarea id="observaciones" name="observaciones" class="form-control-modern" rows="3" placeholder="Información adicional relevante..." 
                    style="width: 100%; padding: 10px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; transition: all 0.2s; background-color: #fff; resize: vertical;"
                    onfocus="this.style.borderColor='#174ea6'; this.style.boxShadow='0 0 0 3px rgba(23, 78, 166, 0.1)'"
                    onblur="this.style.borderColor='#dee2e6'; this.style.boxShadow='none'"></textarea>
            </div>

            <!-- Acciones del formulario -->
            <div class="form-actions-modern" style="grid-column: span 2; margin-top: 10px; display: flex; justify-content: flex-end; gap: 15px; border-top: 1px solid #dee2e6; padding-top: 20px;">
                <button type="button" id="limpiar-btn" class="btn btn-secondary-modern" 
                    style="padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #dee2e6; background-color: #f8f9fa; color: #1E293B; transition: all 0.2s;"
                    onmouseover="this.style.backgroundColor='#e2e8f0'; this.style.transform='translateY(-1px)'"
                    onmouseout="this.style.backgroundColor='#f8f9fa'; this.style.transform='translateY(0)'">
                    <i class="fas fa-eraser"></i> Limpiar
                </button>
                <button type="submit" id="registrar-btn" class="btn btn-primary-modern" 
                    style="padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; border: none; background-color: #174ea6; color: white; transition: all 0.2s;"
                    onmouseover="this.style.backgroundColor='#185abd'; this.style.transform='translateY(-1px)'"
                    onmouseout="this.style.backgroundColor='#174ea6'; this.style.transform='translateY(0)'">
                    <i class="fas fa-save"></i> Registrar Incapacidad
                </button>
            </div>
        `;

        formContainer.appendChild(form);
        mainContainer.appendChild(formContainer);

        // Añadir eventos
        const submitButton = document.getElementById('registrar-btn');
        submitButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        const limpiarButton = document.getElementById('limpiar-btn');
        limpiarButton.addEventListener('click', () => {
            document.getElementById('registrar-ausentismo-form').reset();
            this.showNotification('Formulario limpiado.', '', 'info');
        });

        this.container.appendChild(mainContainer);
        console.log('Finalizado renderizado de RegistrarAusentismoComponent');
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

    /* 📦443 (2026-06-25) — showNotification migrado al estándar del proyecto.
       Usa window.updateNotifier.show() con API consistente:
       - type: 'success' | 'info' | 'warning' | 'error'
       - title: encabezado principal
       - subtitle: descripción secundaria (opcional)
       - autoClose: ms antes de cerrar (0 = no cierra, útil para loading)
       - progress: { percent: 0..100 } muestra barra de progreso
       API idéntica a la usada en 6.1.3 (revision-alta-direccion), 6.1.2 (auditoria-anual)
       y el resto de submódulos actualizados del proyecto.

       📦443 (2026-06-25) — Fix iframe: este componente se ejecuta dentro de un iframe,
       donde window.updateNotifier está en el documento PADRE. Usamos window.parent.updateNotifier
       con fallback a window.updateNotifier para que funcione tanto dentro como fuera del iframe. */
    showNotification(notificationDivOrTitle, message, type = 'success') {
        var title, subtitle;
        if (typeof notificationDivOrTitle === 'string') {
            title = notificationDivOrTitle;
            subtitle = message;
            type = type || 'success';
        } else {
            title = message || 'Notificación';
            subtitle = '';
            type = type || 'success';
        }
        var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (notifier && typeof notifier.show === 'function') {
            notifier.show({
                type: type,
                title: title,
                subtitle: subtitle,
                autoClose: type === 'error' ? 6000 : type === 'warning' ? 4000 : 3000
            });
        }
    }

    /* 📦443 — showLoadingToast: muestra un toast con progress bar que NO se cierra
       automáticamente. Retorna el id para poder cerrarlo/actualizarlo después. */
    showLoadingToast(title, subtitle) {
        var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (notifier && typeof notifier.show === 'function') {
            var id = notifier.show({
                type: 'info',
                title: title,
                subtitle: subtitle || '',
                autoClose: 0,
                progress: { percent: 0 }
            });
            this._loadingToastId = id;
            return id;
        }
        return null;
    }

    /* 📦443 — updateLoadingProgress: actualiza la barra de progreso del toast activo. */
    updateLoadingProgress(percent, subtitle) {
        var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (this._loadingToastId && notifier && typeof notifier.update === 'function') {
            notifier.update(this._loadingToastId, {
                progress: { percent: Math.max(0, Math.min(100, percent)) },
                subtitle: subtitle
            });
        }
    }

    /* 📦443 — hideLoadingToast: cierra el toast de loading activo. */
    hideLoadingToast() {
        var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (this._loadingToastId && notifier && typeof notifier.remove === 'function') {
            notifier.remove(this._loadingToastId);
            this._loadingToastId = null;
        }
    }

    handleSubmit() {
        // Obtener los valores del formulario
        const formData = {
            cedula: document.getElementById('cedula').value.trim(),
            nombre: document.getElementById('nombre').value.trim(),
            cargo: document.getElementById('cargo').value.trim(),
            area: document.getElementById('area').value.trim(),
            fechaInicio: document.getElementById('fechaInicio').value,
            fechaFin: document.getElementById('fechaFin').value,
            diasIncapacidad: document.getElementById('diasIncapacidad').value,
            tipoIncapacidad: document.getElementById('tipoIncapacidad').value,
            claseIncapacidad: document.getElementById('claseIncapacidad').value,
            entidad: document.getElementById('entidad').value.trim(),
            diagnostico: document.getElementById('diagnostico').value.trim(),
            observaciones: document.getElementById('observaciones').value.trim(),
        };

        // Validar campos requeridos
        if (!formData.cedula || !formData.nombre || !formData.fechaInicio || !formData.fechaFin) {
            this.showNotification('Por favor complete los campos obligatorios.', 'Complete los campos marcados con *', 'error');
            return;
        }

        // Validar fechas
        if (new Date(formData.fechaInicio) > new Date(formData.fechaFin)) {
            this.showNotification('Fechas inválidas', 'La fecha de inicio no puede ser posterior a la fecha de finalización', 'error');
            return;
        }

        // Calcular días automáticamente
        const startDate = new Date(formData.fechaInicio);
        const endDate = new Date(formData.fechaFin);
        const timeDiff = endDate.getTime() - startDate.getTime();
        const calculatedDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

        // Si los días no coinciden, sugerir el cálculo automático
        if (parseInt(formData.diasIncapacidad) !== calculatedDays) {
            if (!confirm(`Los días ingresados (${formData.diasIncapacidad}) difieren del cálculo automático (${calculatedDays} días). ¿Desea continuar con los días ingresados?`)) {
                document.getElementById('diasIncapacidad').value = calculatedDays;
                return;
            }
        }

        // Simular el registro de la incapacidad
        this.logMessage(`Registrando incapacidad para ${formData.nombre} (${formData.cedula})`, 'info');

        // 📦443 — Mostrar toast con progress bar mientras se guarda
        this.showLoadingToast('Registrando incapacidad', `Cédula ${formData.cedula} · ${formData.nombre}`);

        // Guardar incapacidad
        this.guardarIncapacidad(formData)
            .then(() => {
                this.hideLoadingToast();
                this.showNotification('¡Incapacidad registrada!', `${formData.nombre} · ${formData.diasIncapacidad} días`, 'success');
                document.getElementById('registrar-ausentismo-form').reset();
            })
            .catch(error => {
                this.hideLoadingToast();
                console.error('Error al registrar incapacidad:', error);
                this.showNotification('Error al guardar', error.message || 'Error desconocido', 'error');
            });
    }

    async guardarIncapacidad(datos) {
        // 📦443 — Animación de progreso simulada mientras se procesa
        this.updateLoadingProgress(15, 'Validando datos...');
        await new Promise(r => setTimeout(r, 120));

        this.updateLoadingProgress(40, 'Guardando en base de datos...');

        try {
            // Llamar al backend usando el contrato existente (procesarAusentismo)
            if (window.electronAPI && window.electronAPI.procesarAusentismo) {
                this.updateLoadingProgress(70, 'Procesando incapacidad...');
                const result = await window.electronAPI.procesarAusentismo(
                    this.currentCompany,
                    datos
                );

                this.updateLoadingProgress(100, 'Completado');

                if (result && result.success) {
                    this.logMessage('Incapacidad guardada exitosamente', 'success');
                    return result;
                } else {
                    throw new Error(result?.error?.message || 'Error desconocido al guardar');
                }
            } else {
                // Modo simulación si no hay backend disponible
                this.updateLoadingProgress(100, 'Modo simulación');
                this.logMessage('Modo simulación: incapacidad guardada', 'success');
                return { success: true, data: datos };
            }
        } catch (error) {
            this.updateLoadingProgress(100, 'Error');
            this.logMessage(`Error al guardar incapacidad: ${error.message}`, 'error');
            throw error;
        }
    }
}

// Exponer globalmente
window.RegistrarAusentismoComponent = RegistrarAusentismoComponent;
console.log('RegistrarAusentismoComponent cargado y expuesto globalmente');
