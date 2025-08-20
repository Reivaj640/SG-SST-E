// evaluaciones-medicas.js

class EvaluacionesMedicasComponent {
  constructor(container, company, module, submodule, onBack) {
    this.container = container;
    this.company = company;
    this.module = module;
    this.submodule = submodule;
    this.onBack = onBack;
    this.body = null; // Para mantener una referencia al cuerpo del componente
  }

  render() {
    this.container.innerHTML = '';
    const submoduleContent = document.createElement('div');
    submoduleContent.className = 'submodule-content';

    const header = document.createElement('div');
    header.className = 'submodule-header';
    const title = document.createElement('h2');
    title.textContent = this.submodule;
    const backButton = document.createElement('button');
    backButton.className = 'btn btn-secondary';
    backButton.textContent = '‹ Volver';
    backButton.addEventListener('click', () => this.onBack && this.onBack());
    header.appendChild(title);
    header.appendChild(backButton);
    submoduleContent.appendChild(header);

    this.body = document.createElement('div');
    this.body.className = 'submodule-body';
    submoduleContent.appendChild(this.body);

    this.container.appendChild(submoduleContent);
    this.showInitialOptions();
  }

  showInitialOptions() {
    this.body.innerHTML = ''; // Limpiar cuerpo
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'module-cards';

    const card1 = this.createCard(
      'Ver Evaluaciones Realizadas',
      'Visualizar los certificados y evaluaciones médicas ocupacionales.',
      () => this.showEvaluacionesList()
    );
    cardsContainer.appendChild(card1);

    const card2 = this.createCard(
      'Cargar Nueva Evaluación',
      'Funcionalidad para cargar un nuevo documento (en desarrollo).',
      () => showCustomAlert('Esta funcionalidad estará disponible próximamente.')
    );
    cardsContainer.appendChild(card2);

    this.body.appendChild(cardsContainer);
  }

  async showEvaluacionesList() {
    this.body.innerHTML = ''; // Limpiar para mostrar la lista

    const backButton = document.createElement('button');
    backButton.className = 'btn btn-secondary mb-3';
    backButton.textContent = '‹ Volver a Opciones';
    backButton.addEventListener('click', () => this.showInitialOptions());
    this.body.appendChild(backButton);

    const title = document.createElement('h3');
    title.textContent = 'Listado de Evaluaciones Médicas';
    this.body.appendChild(title);

    const listContainer = document.createElement('div');
    listContainer.className = 'table-responsive';
    this.body.appendChild(listContainer);

    await this.loadEvaluacionesData(listContainer);
  }

  async loadEvaluacionesData(container) {
    container.innerHTML = '<p>Buscando archivos de evaluaciones...</p>';
    try {
      const result = await window.electronAPI.findSubmodulePath(this.company, this.module, this.submodule);
      if (!result.success) {
        throw new Error(result.error);
      }

      const files = await window.electronAPI.readDirectory(result.path); // Corregido: listFilesInDirectory -> readDirectory
      if (files && files.length > 0) {
        this.renderEvaluacionesTable(files, container);
      } else {
        container.innerHTML = '<p>No se encontraron archivos de evaluaciones en el directorio configurado.</p>';
      }
    } catch (error) {
      console.error('Error al cargar datos de evaluaciones:', error);
      container.innerHTML = `<p class="text-danger">Error al cargar archivos: ${error.message}</p>`;
    }
  }

  renderEvaluacionesTable(files, container) {
    container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'table table-striped table-hover';

    table.innerHTML = `
      <thead>
        <tr>
          <th>Nombre del Archivo</th>
          <th>Fecha de Modificación</th>
          <th>Tamaño</th>
          <th>Acción</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');
    files.forEach(file => {
      const row = document.createElement('tr');
      const fileSize = (file.size / 1024).toFixed(2) + ' KB';
      const modDate = new Date(file.mtime).toLocaleString();

      row.innerHTML = `
        <td>${file.name}</td>
        <td>${modDate}</td>
        <td>${fileSize}</td>
        <td><button class="btn btn-primary btn-sm">Abrir</button></td>
      `;

      row.querySelector('button').addEventListener('click', () => {
        window.electronAPI.openFile(file.path);
      });

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  }

  createCard(title, description, onClick) {
    const card = document.createElement('div');
    card.className = 'card module-card';
    card.innerHTML = `
      <div class="card-body">
        <h5 class="card-title">${title}</h5>
        <p class="card-text">${description}</p>
        <button class="btn btn-primary">Acceder</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', onClick);
    return card;
  }
}

// Asignar la clase al objeto window para que sea accesible globalmente
window.EvaluacionesMedicasComponent = EvaluacionesMedicasComponent;