// registrar-ausentismo.js - Componente para registrar ausentismo por causa médica

class RegistrarAusentismoComponent {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        console.log('Creando instancia de RegistrarAusentismoComponent');
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.logMessage = (msg, type) => console.log(`[${type}] ${msg}`); // Placeholder
    }

    render() {
        console.log('Renderizando RegistrarAusentismoComponent');
        this.container.innerHTML = '';
        window.currentRegistrarAusentismoComponent = this;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';

        // Encabezado
        const header = this.createHeader('Registrar Ausentismo', () => {
            if (this.onBack && typeof this.onBack === 'function') {
                this.onBack();
            }
        });
        mainContainer.appendChild(header);

        // Descripción
        const description = document.createElement('p');
        description.className = 'submodule-description';
        description.textContent = 'Este submódulo permite registrar nuevos casos de ausentismo por causa médica.';
        mainContainer.appendChild(description);

        // Área de estado para mostrar feedback al usuario
        const statusDiv = document.createElement('div');
        statusDiv.id = 'form-status';
        statusDiv.className = 'status-message';
        statusDiv.style.cssText = `
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 4px;
            font-weight: bold;
            text-align: center;
            display: none;
        `;
        mainContainer.appendChild(statusDiv);

        // Formulario de registro
        const formContainer = document.createElement('div');
        formContainer.className = 'registrar-ausentismo-form';

        // Título del formulario
        const formTitle = document.createElement('h3');
        formTitle.textContent = 'Formulario de Registro de Incapacidades';
        formContainer.appendChild(formTitle);

        // Crear formulario
        const form = document.createElement('form');
        form.id = 'registrar-ausentismo-form';
        
        form.innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label for="cedula">Cédula:</label>
                    <input type="text" id="cedula" name="cedula" required>
                </div>
                
                <div class="form-group">
                    <label for="nombre">Nombre Completo:</label>
                    <input type="text" id="nombre" name="nombre" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="cargo">Cargo:</label>
                    <input type="text" id="cargo" name="cargo">
                </div>
                
                <div class="form-group">
                    <label for="fechaInicio">Fecha de Inicio:</label>
                    <input type="date" id="fechaInicio" name="fechaInicio" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="fechaFin">Fecha de Finalización:</label>
                    <input type="date" id="fechaFin" name="fechaFin" required>
                </div>
                
                <div class="form-group">
                    <label for="diasIncapacidad">Días de Incapacidad:</label>
                    <input type="number" id="diasIncapacidad" name="diasIncapacidad" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="tipoIncapacidad">Tipo de Incapacidad:</label>
                    <select id="tipoIncapacidad" name="tipoIncapacidad" required>
                        <option value="">Seleccione...</option>
                        <option value="General">General</option>
                        <option value="Laboral">Laboral</option>
                        <option value="No Laboral">No Laboral</option>
                        <option value="Accidente de Trabajo">Accidente de Trabajo</option>
                        <option value="Enfermedad General">Enfermedad General</option>
                        <option value="Maternidad">Maternidad</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="claseIncapacidad">Clase de Incapacidad:</label>
                    <select id="claseIncapacidad" name="claseIncapacidad" required>
                        <option value="">Seleccione...</option>
                        <option value="Temporal">Temporal</option>
                        <option value="Permanente">Permanente</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group full-width">
                    <label for="diagnostico">Diagnóstico:</label>
                    <textarea id="diagnostico" name="diagnostico" rows="3" placeholder="Ingrese el diagnóstico médico"></textarea>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group full-width">
                    <label for="observaciones">Observaciones:</label>
                    <textarea id="observaciones" name="observaciones" rows="3" placeholder="Observaciones adicionales"></textarea>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn btn-primary" id="registrar-btn">Registrar Incapacidad</button>
                <button type="reset" class="btn btn-secondary" id="limpiar-btn">Limpiar Formulario</button>
            </div>
        `;
        
        formContainer.appendChild(form);
        
        // Añadir eventos al formulario
        const submitButton = document.getElementById('registrar-btn');
        submitButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSubmit(statusDiv);
        });
        
        const limpiarButton = document.getElementById('limpiar-btn');
        limpiarButton.addEventListener('click', () => {
            this.showStatus(statusDiv, 'Formulario limpiado.', 'info');
        });
        
        mainContainer.appendChild(formContainer);

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

    showStatus(statusDiv, message, type) {
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        
        // Remover clases anteriores
        statusDiv.classList.remove('status-success', 'status-error', 'status-warning', 'status-info');
        
        // Añadir clase según el tipo
        switch (type) {
            case 'success':
                statusDiv.classList.add('status-success');
                statusDiv.style.backgroundColor = '#d4edda';
                statusDiv.style.color = '#155724';
                break;
            case 'error':
                statusDiv.classList.add('status-error');
                statusDiv.style.backgroundColor = '#f8d7da';
                statusDiv.style.color = '#721c24';
                break;
            case 'warning':
                statusDiv.classList.add('status-warning');
                statusDiv.style.backgroundColor = '#fff3cd';
                statusDiv.style.color = '#856404';
                break;
            case 'info':
            default:
                statusDiv.classList.add('status-info');
                statusDiv.style.backgroundColor = '#d1ecf1';
                statusDiv.style.color = '#0c5460';
                break;
        }
        
        // Ocultar automáticamente después de 5 segundos
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }

    handleSubmit(statusDiv) {
        // Obtener los valores del formulario
        const formData = {
            cedula: document.getElementById('cedula').value.trim(),
            nombre: document.getElementById('nombre').value.trim(),
            cargo: document.getElementById('cargo').value.trim(),
            fechaInicio: document.getElementById('fechaInicio').value,
            fechaFin: document.getElementById('fechaFin').value,
            diasIncapacidad: document.getElementById('diasIncapacidad').value,
            tipoIncapacidad: document.getElementById('tipoIncapacidad').value,
            claseIncapacidad: document.getElementById('claseIncapacidad').value,
            diagnostico: document.getElementById('diagnostico').value.trim(),
            observaciones: document.getElementById('observaciones').value.trim(),
        };

        // Validar fechas
        if (new Date(formData.fechaInicio) > new Date(formData.fechaFin)) {
            this.showStatus(statusDiv, 'La fecha de inicio no puede ser posterior a la fecha de finalización.', 'error');
            return;
        }

        // Validar que los días de incapacidad coincidan con el cálculo entre fechas
        const startDate = new Date(formData.fechaInicio);
        const endDate = new Date(formData.fechaFin);
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 para incluir ambos días
        
        if (parseInt(formData.diasIncapacidad) !== daysDiff) {
            if (!confirm(`Los días de incapacidad (${formData.diasIncapacidad}) no coinciden con el cálculo entre fechas (${daysDiff}). ¿Desea continuar de todos modos?`)) {
                return;
            }
        }

        // Simular el registro de la incapacidad
        this.logMessage(`Registrando incapacidad para ${formData.nombre} (${formData.cedula})`, 'info');
        
        // Aquí iría la lógica para guardar los datos
        this.guardarIncapacidad(formData, statusDiv)
            .then(() => {
                this.showStatus(statusDiv, '¡Incapacidad registrada correctamente!', 'success');
                // Limpiar el formulario después de registrar
                document.getElementById('registrar-ausentismo-form').reset();
            })
            .catch(error => {
                console.error('Error al registrar incapacidad:', error);
                this.showStatus(statusDiv, `Error al registrar incapacidad: ${error.message}`, 'error');
            });
    }

    async guardarIncapacidad(datos, statusDiv) {
        // Simulación de guardado - en una implementación real esto llamaría a una API o al backend
        try {
            // Mostrar estado de carga
            this.showStatus(statusDiv, 'Registrando incapacidad...', 'info');
            
            // Simular una llamada al backend
            const result = await window.electronAPI.registrarAusentismo(
                this.currentCompany,
                datos
            );
            
            if (result && result.success) {
                this.logMessage('Incapacidad guardada exitosamente', 'success');
                return result;
            } else {
                throw new Error(result?.error || 'Error desconocido al guardar la incapacidad');
            }
        } catch (error) {
            this.logMessage(`Error al guardar incapacidad: ${error.message}`, 'error');
            throw error;
        }
    }
}

// Exponer globalmente
window.RegistrarAusentismoComponent = RegistrarAusentismoComponent;
console.log('RegistrarAusentismoComponent cargado y expuesto globalmente');