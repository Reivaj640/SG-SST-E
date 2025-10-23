// registrar-ausentismo.js - Componente para el submódulo "Registrar Ausentismo"

class RegistrarAusentismoComponent {
  constructor(container, currentCompany, moduleName, submoduleName, onBack) {
    this.container = container;
    this.currentCompany = currentCompany;
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
    this.onBack = onBack;
    this.ausentismoFilePath = null; // Para guardar la ruta del archivo
    this.logMessage = (msg, type) => console.log(`[${type}] ${msg}`); // Placeholder
  }

  render() {
    this.container.innerHTML = '';
    window.currentRegistrarAusentismoComponent = this;

    const mainContainer = document.createElement('div');
    mainContainer.className = 'submodule-content';

    this.renderMainView(mainContainer);

    this.container.appendChild(mainContainer);
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

    // Contenedor para los datos de ausentismo
    const contentDiv = document.createElement('div');
    contentDiv.className = 'control-remisiones-content'; // Reutilizamos estilos
    contentDiv.style.padding = '20px';
    container.appendChild(contentDiv);

    // Renderizar el formulario de registro
    this.renderAusentismoForm(contentDiv);

    // Contenedor para la tabla de datos (inicialmente podría estar oculto o debajo)
    const dataContainer = document.createElement('div');
    container.appendChild(dataContainer);

    // Cargar y renderizar los datos
    this.loadAndRenderAusentismoData(dataContainer);
  }

  renderAusentismoForm(container) {
    const formContainer = document.createElement('div');
    formContainer.className = 'ausentismo-form-container';
    formContainer.innerHTML = `
      <h3 class="form-title">Registrar Nuevo Ausentismo</h3>
      <div class="form-grid">
        <div class="form-group">
          <label for="cedulaInput">Cédula del Empleado</label>
          <input type="text" id="cedulaInput" placeholder="Ingrese la cédula y presione Enter...">
        </div>
        <div class="form-group">
          <label for="nombreInput">Nombre Completo</label>
          <input type="text" id="nombreInput" disabled>
        </div>
        <div class="form-group">
          <label for="cargoInput">Cargo</label>
          <input type="text" id="cargoInput" disabled>
        </div>
        <div class="form-group">
          <label for="empresaUsuariaInput">Empresa Usuaria</label>
          <input type="text" id="empresaUsuariaInput" disabled>
        </div>
        <div class="form-group">
          <label for="areaInput">Área</label>
          <input type="text" id="areaInput" disabled>
        </div>
        <div class="form-group">
          <label for="generoInput">Género</label>
          <input type="text" id="generoInput" disabled>
        </div>
        <div class="form-group">
          <label for="tipoIncapacidad">Tipo de Incapacidad</label>
          <select id="tipoIncapacidad">
            <option value="">Seleccione...</option>
            <option value="EG">Enfermedad General</option>
            <option value="AT">Accidente de Trabajo</option>
            <option value="LM">Licencia de Maternidad</option>
            <option value="LP">Licencia de Paternidad</option>
          </select>
        </div>
        <div class="form-group">
          <label for="fechaInicio">Fecha de Inicio</label>
          <input type="date" id="fechaInicio">
        </div>
        <div class="form-group">
          <label for="fechaFin">Fecha de Fin</label>
          <input type="date" id="fechaFin">
        </div>
        <div class="form-group">
          <label for="diasIncapacidad">Días de Incapacidad</label>
          <input type="number" id="diasIncapacidad" placeholder="Cálculo automático" disabled>
        </div>
        <div class="form-group full-width">
          <label for="diagnostico">Diagnóstico (CIE-10)</label>
          <input type="text" id="diagnostico" placeholder="Ingrese código o descripción...">
        </div>
      </div>
      <div class="form-actions">
        <button id="guardarAusentismoBtn" class="btn btn-primary">Guardar Ausentismo</button>
      </div>
    `;
    container.appendChild(formContainer);

    // --- Integración del código del usuario ---
    const cedulaInput = formContainer.querySelector('#cedulaInput');
    cedulaInput.addEventListener('blur', async (event) => {
      const cedula = event.target.value.trim();
      const empresa = this.currentCompany; // Usamos la empresa actual del componente

      if (cedula) {
        try {
            const empleado = await window.electronAPI.buscarEmpleadoPorCedula(cedula, empresa);
            if (empleado) {
              formContainer.querySelector('#nombreInput').value = empleado.nombre || '';
              formContainer.querySelector('#cargoInput').value = empleado.cargo || '';
              formContainer.querySelector('#empresaUsuariaInput').value = empleado.empresa_usuaria || '';
              formContainer.querySelector('#areaInput').value = empleado.area || '';
              formContainer.querySelector('#generoInput').value = empleado.genero || '';
              // No tocar campos como "tipoIncapacidad", "diasIncapacidad", etc.
            } else {
              alert('Empleado no encontrado en la base de datos.');
              // Opcional: limpiar campos si no se encuentra el empleado
              formContainer.querySelector('#nombreInput').value = '';
              formContainer.querySelector('#cargoInput').value = '';
              formContainer.querySelector('#empresaUsuariaInput').value = '';
              formContainer.querySelector('#areaInput').value = '';
              formContainer.querySelector('#generoInput').value = '';
            }
        } catch (error) {
            console.error('Error al buscar empleado:', error);
            alert('Ocurrió un error al buscar el empleado. Revise la consola para más detalles.');
        }
      }
    });
    
    // Lógica para calcular días de incapacidad
    const fechaInicioInput = formContainer.querySelector('#fechaInicio');
    const fechaFinInput = formContainer.querySelector('#fechaFin');
    const diasIncapacidadInput = formContainer.querySelector('#diasIncapacidad');

    const calcularDias = () => {
        const inicio = fechaInicioInput.value;
        const fin = fechaFinInput.value;
        if (inicio && fin) {
            const fechaInicio = new Date(inicio);
            const fechaFin = new Date(fin);
            if (fechaFin >= fechaInicio) {
                const diffTime = Math.abs(fechaFin - fechaInicio);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir el día de inicio
                diasIncapacidadInput.value = diffDays;
            } else {
                diasIncapacidadInput.value = 'Fechas inválidas';
            }
        }
    };

    fechaInicioInput.addEventListener('change', calcularDias);
    fechaFinInput.addEventListener('change', calcularDias);

  }

  async loadAndRenderAusentismoData(contentDiv) {
    this.logMessage(`Cargando datos de ausentismo para ${this.currentCompany}...`, 'info');
    contentDiv.innerHTML = '<p style="text-align:center;">Cargando datos del archivo de ausentismo...</p>';

    try {
      const result = await window.electronAPI.readAusentismoData(this.currentCompany);

      if (result.success) {
        this.ausentismoFilePath = result.filePath; // Guardar la ruta del archivo
        contentDiv.innerHTML = ''; // Limpiar "Cargando..."

        // Botón para abrir el archivo
        const openFileButton = document.createElement('button');
        openFileButton.textContent = 'Abrir Archivo de Ausentismo';
        openFileButton.className = 'btn btn-primary';
        openFileButton.style.marginBottom = '15px';
        openFileButton.addEventListener('click', () => {
          if (this.ausentismoFilePath) {
            window.electronAPI.openPath(this.ausentismoFilePath);
          } else {
            alert('La ruta del archivo no está disponible.');
          }
        });
        contentDiv.appendChild(openFileButton);

        if (result.rows && result.rows.length > 0) {
          this.logMessage(`Encontrados ${result.rows.length} registros. Renderizando tabla.`, 'info');
          
          const tableContainer = document.createElement('div');
          tableContainer.style.maxHeight = '65vh';
          tableContainer.style.overflowY = 'auto';
          tableContainer.style.border = '1px solid #ddd';
          tableContainer.style.borderRadius = '4px';

          const table = document.createElement('table');
          table.className = 'data-table';

          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          if (result.headers && Array.isArray(result.headers)) {
            result.headers.forEach(headerText => {
              const th = document.createElement('th');
              th.textContent = headerText;
              headerRow.appendChild(th);
            });
          }
          thead.appendChild(headerRow);
          table.appendChild(thead);

          const tbody = document.createElement('tbody');
          result.rows.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            if (Array.isArray(row)) {
              row.forEach(cellData => {
                const td = document.createElement('td');
                td.textContent = cellData != null ? cellData.toString() : '';
                tr.appendChild(td);
              });
            }
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          tableContainer.appendChild(table);
          contentDiv.appendChild(tableContainer);

          const infoDiv = document.createElement('div');
          infoDiv.style.marginTop = '15px';
          infoDiv.style.fontSize = '14px';
          infoDiv.style.color = '#666';
          infoDiv.innerHTML = `
            <p><strong>Archivo:</strong> ${result.filePath}</p>
            <p><strong>Total de registros:</strong> ${result.rows.length}</p>
          `;
          contentDiv.appendChild(infoDiv);

        } else {
          this.logMessage('El archivo de ausentismo está vacío o no contiene registros.', 'warn');
          contentDiv.innerHTML += `
            <div style="text-align:center; padding:40px; color:#666;">
              <h3>📋 No se encontraron datos</h3>
              <p>El archivo de ausentismo está vacío o no contiene registros.</p>
            </div>
          `;
        }
      } else {
        this.logMessage(`Error al cargar el archivo: ${result.error}`, 'error');
        contentDiv.innerHTML = `
          <div style="text-align:center; padding:40px; color:#d32f2f;">
            <h3>❌ Error al cargar el archivo</h3>
            <p>${result.error}</p>
          </div>
        `;
      }
    } catch (error) {
      this.logMessage(`Error inesperado en la interfaz: ${error.message}`, 'error');
      contentDiv.innerHTML = `
        <div style="text-align:center; padding:40px; color:#d32f2f;">
          <h3>💥 Error inesperado</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  }
}

window.RegistrarAusentismoComponent = RegistrarAusentismoComponent;
