// ver-ausentismo.js - Componente para el submódulo "Ver Ausentismo"

class VerAusentismoComponent {
  constructor(container, currentCompany, moduleName, submoduleName, onBack) {
    this.container = container;
    this.currentCompany = currentCompany;
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
    this.onBack = onBack;
    this.ausentismoFilePath = null; // Para guardar la ruta del archivo
    this.logMessage = (msg, type) => console.log(`[${type}] ${msg}`); // Placeholder
    this.originalRows = []; // Para guardar los datos originales de la tabla
  }

  render() {
    this.container.innerHTML = '';
    window.currentVerAusentismoComponent = this;

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

    // Cargar y renderizar los datos
    this.loadAndRenderAusentismoData(contentDiv);
  }

  async loadAndRenderAusentismoData(contentDiv) {
    this.logMessage(`Cargando datos de ausentismo para ${this.currentCompany}...`, 'info');
    contentDiv.innerHTML = '<p style="text-align:center;">Cargando datos del archivo de ausentismo...</p>';

    try {
      const result = await window.electronAPI.readAusentismoData(this.currentCompany);

      if (result.success) {
        this.ausentismoFilePath = result.filePath; // Guardar la ruta del archivo
        this.originalRows = result.rows; // Guardar los datos originales
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
            // [📦453 2026-07-01] Migrado de alert() nativo a window.updateNotifier
            // (sistema de notificaciones estandar 6.1.3 — feedback no bloqueante).
            var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
            if (notifier && typeof notifier.show === 'function') {
              notifier.show({
                type: 'warning',
                title: 'Ruta no disponible',
                subtitle: 'No se encontro la ruta del archivo de ausentismo. Verifica que el archivo este sincronizado.',
                autoClose: 5000
              });
            } else {
              alert('La ruta del archivo no está disponible.');
            }
          }
        });
        contentDiv.appendChild(openFileButton);

        // Filtros de búsqueda
        const filterDiv = document.createElement('div');
        filterDiv.className = 'filter-controls';
        filterDiv.innerHTML = `
          <input type="text" id="cedulaFilter" placeholder="Filtrar por Cédula...">
          <input type="text" id="nombreFilter" placeholder="Filtrar por Nombre...">
          <button id="applyFilterBtn" class="btn">Aplicar Filtro</button>
          <button id="clearFilterBtn" class="btn">Limpiar Filtro</button>
        `;
        contentDiv.appendChild(filterDiv);

        const cedulaFilterInput = filterDiv.querySelector('#cedulaFilter');
        const nombreFilterInput = filterDiv.querySelector('#nombreFilter');
        const applyFilterBtn = filterDiv.querySelector('#applyFilterBtn');
        const clearFilterBtn = filterDiv.querySelector('#clearFilterBtn');

        const applyFilter = () => {
          const cedulaFilter = cedulaFilterInput.value.toLowerCase();
          const nombreFilter = nombreFilterInput.value.toLowerCase();
          this.renderTable(contentDiv, result.headers, this.originalRows, cedulaFilter, nombreFilter);
        };

        applyFilterBtn.addEventListener('click', applyFilter);
        clearFilterBtn.addEventListener('click', () => {
          cedulaFilterInput.value = '';
          nombreFilterInput.value = '';
          applyFilter();
        });

        this.renderTable(contentDiv, result.headers, this.originalRows, '', '');

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

  renderTable(contentDiv, headers, rows, cedulaFilter, nombreFilter) {
    // Eliminar tabla existente si la hay
    const existingTableContainer = contentDiv.querySelector('.table-container');
    if (existingTableContainer) {
      existingTableContainer.remove();
    }

    const filteredRows = rows.filter(row => {
      const cedula = (row[3] || '').toString().toLowerCase(); // Asumiendo que la cédula está en la columna 3
      const nombre = (row[4] || '').toString().toLowerCase(); // Asumiendo que el nombre está en la columna 4
      
      const cedulaMatch = cedulaFilter === '' || cedula.includes(cedulaFilter);
      const nombreMatch = nombreFilter === '' || nombre.includes(nombreFilter);

      return cedulaMatch && nombreMatch;
    });

    if (filteredRows.length > 0) {
      this.logMessage(`Encontrados ${filteredRows.length} registros filtrados. Renderizando tabla.`, 'info');
      
      const tableContainer = document.createElement('div');
      tableContainer.className = 'table-container'; // Añadir clase para fácil selección
      tableContainer.style.maxHeight = '65vh';
      tableContainer.style.overflowY = 'auto';
      tableContainer.style.border = '1px solid #ddd';
      tableContainer.style.borderRadius = '4px';

      const table = document.createElement('table');
      table.className = 'data-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      if (headers && Array.isArray(headers)) {
        headers.forEach(headerText => {
          const th = document.createElement('th');
          th.textContent = headerText;
          headerRow.appendChild(th);
        });
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      filteredRows.forEach((row, rowIndex) => {
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
        <p><strong>Archivo:</strong> ${this.ausentismoFilePath}</p>
        <p><strong>Total de registros:</strong> ${filteredRows.length} (de ${rows.length} originales)</p>
      `;
      contentDiv.appendChild(infoDiv);

    } else {
      this.logMessage('No se encontraron registros que coincidan con los filtros.', 'warn');
      contentDiv.innerHTML += `
        <div style="text-align:center; padding:40px; color:#666;">
          <h3>📋 No se encontraron datos</h3>
          <p>No hay registros de ausentismo que coincidan con los criterios de búsqueda.</p>
        </div>
      `;
    }
  }
}

window.VerAusentismoComponent = VerAusentismoComponent;
