// renderer.js - Lógica del proceso de renderizado de Electron

// --- Constantes y Configuración ---
// Definir los botones de la barra lateral según la estructura de tu aplicación Python
const SIDEBAR_BUTTONS = [
  { name: "Recursos", icon: "kpi.png" },
  { name: "Gestión Integral", icon: "gestion.png" },
  { name: "Gestión de la Salud", icon: "medico.png" },
  { name: "Gestión de Peligros y Riesgos", icon: "identificar.png" },
  { name: "Gestión de Amenazas", icon: "amenaza.png" },
  { name: "Verificación", icon: "seguro-de-salud.png" },
  { name: "Mejoramiento", icon: "ventas.png" },
  { name: "Salir", icon: "superacion-personal.png" }
];

// Submódulos para cada sección principal
// Este objeto estructura el contenido que aparece en InternalPage
const RESOURCES_SUBMODULES = {
  "Recursos": [
    "1.1.1 Responsable del SG",
    "1.1.2 Roles y Responsabilidades",
    "1.1.3 Asignación de Recursos",
    "1.1.4 Afiliación al SSSI",
    "1.1.5 Trabajo de alto riesgo",
    "1.1.6 Conformación de Copasst",
    "1.1.7 Capacitación al Copasst",
    "1.1.8 Conformación de Comite de Convivencia",
    "1.2.1 Programa de capacitación Anual",
    "1.2.2 Inducción y Reinducción",
    "1.2.3 Curso Virtual 50 Horas",
    "1.2.4 Manual de SST para Proveedores y Contratistas",
  ],
  "Gestión Integral": [
    "2.1.1 Politica del SG-SST",
    "2.2.1 Objetivos SST",
    "2.3.1 Evaluación inicial del SG-SST",
    "2.4.1 Plan de Trabajo Anual",
    "2.5.1 Archivo y retención documental del SG-SST",
    "2.6.1 Rendición de cuentas",
    "2.7.1 Matriz de requisitos legales",
    "2.8.1 Mecanismos de comunicaciones",
    "2.9.1 Identificación y evaluación para la adquisición de bienes y servicios",
    "2.10.1 Evaluación y seleción de proveedores y contratistas",
    "2.11.1 Gestión del Cambio",
    "2.12.1 Equipos y Herramientas",
    "2.13.1 Elementos de Protección Personal",
  ],
  "Gestión de la Salud": [
    "3.1.1 Descripción Sociodemografica y diagnostico de condiciones de salud",
    "3.1.2 Actividades de medicina y preventiva y promoción de la salud",
    "3.1.3 Perfil de cargo y profesiograma",
    "3.1.4 Evaluaciones médicas",
    "3.1.5 Custodia medica ocupacional",
    "3.1.6 Restricciones y recomendaciones médicas",
    "3.1.7 Estilos de vida Saludables",
    "3.1.8 Servicios de Higiene",
    "3.1.9 Manejo de Residuos",
    "3.2.1 Reporte de los accidentes de trabajo",
    "3.2.2 Investigación de Accidentes, indicentes y Enfermedades",
    "3.2.3 Registro y analisis estadistico de indicentes, accidentes de trabajo y enfermedades",
    "3.3.1 Frecuencia de la accidentalidad",
    "3.3.2 Severidad de la accidentalidad",
    "3.3.3 Proporción de accidentes de trabajo mortales",
    "3.3.4 Medición de la prevalencia de enfermedades laborales",
    "3.3.5 Medición de la incidencia de enfermedades laborales",
    "3.3.6 Medición del ausentismo por causa médica",
  ],
  "Gestión de Peligros y Riesgos": [
    "4.1.1 Metodologia IPEVR",
    "4.1.2 Identificación de Peligros",
    "4.1.3 Identificación de Sustancias Químicas carcinogénas o con toxicidad",
    "4.1.4 Mediciones ambientales",
    "4.2.1 Mediciones de Prevención y Control frente a Peligros, Riesgos Identificados",
    "4.2.2 Aplicación de las medidas de prevención y control por parte de los trabajadores",
    "4.2.3 Evaluación de procedimientos, instructivos internos de seguridad y salud en el trabajo",
    "4.2.4 Realización de inspecciones sistematicas a las instalaciones, maquinas o equipos",
    "4.2.5 Mantenimiento periodico de equipos, instalaciones herramientas",
    "4.2.6 Entrega de EPP",   
  ],
  "Gestión de Amenazas": [
    "5.1.1 Plan de Prevención de Emergencias",
    "5.1.2 Examenes Medicos Brigadista",
  ],
  "Verificación": [
    "6.1.1 Definición de indicadores",
    "6.1.2 Auditoria Anual",
    "6.1.3 Revisión de la alta Dirección",
    "6.1.4 Planificación de la Auditoria",
  ],
  "Mejoramiento": [
    "7.1.1 Acciones Preventivas y Correctivas",
    "7.1.2 Acciones de Mejora conforme a revisiones de la alta gerencia",
    "7.1.3 Acciones de Mejora con base en investigaciones de AT y EL",
    "7.1.4 Elaboración de Planes de Mejoramiento de medidas y acciones correctivas por autoridades y ARL",
  ]
};

// Botones de selección de empresa
const COMPANY_BUTTONS = ["Tempoactiva", "Temposum", "Aseplus", "Asel"];

// --- Estado de la Aplicación ---
let currentCompany = null;
let currentModule = null;
let logBuffer = []; // Búfer para almacenar los logs

// --- Función de Logging Centralizada ---
function logMessage(message, level = 'INFO') {
  const timestamp = new Date().toLocaleTimeString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}`;
  
  // Guardar siempre en el búfer
  logBuffer.push(formattedMessage);

  // Si el área de logs está visible, actualizarla en tiempo real
  const logTextarea = document.querySelector('.log-area textarea');
  if (logTextarea) {
    logTextarea.value = logBuffer.join('\n');
    logTextarea.scrollTop = logTextarea.scrollHeight; // Auto-scroll al final
  }
}

// --- Elementos del DOM ---
let contentArea;
let sidebarMenu;
let companyNameElement;
let companyLogoElement;
let companyLogoPlaceholder;

// --- Inicialización ---
// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed.');

  // Obtener referencias a los elementos del DOM
  contentArea = document.getElementById('content-area');
  sidebarMenu = document.getElementById('sidebar-menu');
  companyNameElement = document.getElementById('company-name');
  companyLogoElement = document.getElementById('company-logo');
  companyLogoPlaceholder = document.getElementById('company-logo-placeholder');

  console.log('DOM elements found:', { contentArea, sidebarMenu, companyNameElement, companyLogoElement, companyLogoPlaceholder });

  // Escuchar eventos de log desde el proceso principal
  if (window.electronAPI && window.electronAPI.onIpcMessage) {
    window.electronAPI.onIpcMessage('log-message', (message, level) => {
      logMessage(message, level);
    });
    logMessage('Renderer: Conectado al sistema de logs del proceso principal.', 'DEBUG');
  } else {
    console.error('API de logging no disponible en window.electronAPI');
  }

  if (!contentArea || !sidebarMenu) {
    console.error("No se pudieron encontrar elementos críticos del DOM.");
    return;
  }

  initializeApp();
});

// Variable para mantener el botón activo del sidebar
let activeSidebarButton = null;

function initializeApp() {
  console.log('Initializing app...');
  // Crear los botones del menú lateral
  createSidebarButtons();
  // Mostrar la página de inicio por defecto
  showHomePage();
}

// --- Funciones de Navegación y UI ---

function createSidebarButtons() {
  console.log('Creating sidebar buttons...');
  // Limpiar el menú existente
  sidebarMenu.innerHTML = '';
  console.log('Cleared sidebar menu');
  
  SIDEBAR_BUTTONS.forEach((item, index) => {
    console.log(`Creating button ${index} for ${item.name}`);
    const li = document.createElement('li');
    li.className = 'sidebar-menu-item';
    
    const button = document.createElement('button');
    button.className = 'sidebar-menu-button';
    button.textContent = item.name;
    
    button.addEventListener('click', () => {
      if (item.name === "Salir") {
        handleLogout();
      } else if (currentCompany) {
        // Si hay una empresa seleccionada, mostrar el contenido del módulo
        setActiveSidebarButton(button);
        showModuleContent(item.name);
      } else {
        // Si no hay empresa, mostrar una alerta personalizada
        showCustomAlert("Por favor, selecciona una empresa antes de ingresar a un módulo.");
      }
    });

    // Crear elemento de imagen para el icono
    const iconImg = document.createElement('img');
    iconImg.src = `assets/${item.icon}`;
    iconImg.alt = item.name;
    iconImg.className = 'sidebar-icon';
    button.prepend(iconImg);

    li.appendChild(button);
    sidebarMenu.appendChild(li);
    console.log(`Added button ${index} to sidebar`);
  });
  
  console.log('Sidebar buttons created.');
}

function setActiveSidebarButton(buttonElement) {
  // Quitar la clase 'active' del botón anterior
  if (window.activeSidebarButton) {
    window.activeSidebarButton.classList.remove('active');
  }
  
  // Agregar la clase 'active' al nuevo botón
  buttonElement.classList.add('active');
  window.activeSidebarButton = buttonElement;
}

function showHomePage() {
  console.log('Showing home page...');
  // Limpiar el área de contenido
  contentArea.innerHTML = '';

  const homePageDiv = document.createElement('div');
  homePageDiv.id = 'home-page';
  console.log('Created homePageDiv:', homePageDiv);

  // Placeholder para la imagen de bienvenida
  // En una implementación completa, se cargaría una imagen real
  const welcomePlaceholder = document.createElement('div');
  welcomePlaceholder.id = 'welcome-placeholder';
  welcomePlaceholder.textContent = '¡Bienvenido al SG-SST! Selecciona una empresa para comenzar.';
  homePageDiv.appendChild(welcomePlaceholder);

  // Contenedor para los botones de selección de empresa
  const companySelectionDiv = document.createElement('div');
  companySelectionDiv.id = 'company-selection';

  COMPANY_BUTTONS.forEach(companyName => {
    const button = document.createElement('button');
    button.className = 'company-select-button';
    button.textContent = companyName;
    button.addEventListener('click', () => selectCompany(companyName, button));
    companySelectionDiv.appendChild(button);
  });

  homePageDiv.appendChild(companySelectionDiv);
  contentArea.appendChild(homePageDiv);
  console.log('Added home page to contentArea');
}

function selectCompany(companyName, buttonElement) {
  console.log(`Selecting company: ${companyName}`);
  currentCompany = companyName;
  
  // Actualizar UI: nombre de la empresa y logo en la barra lateral
  companyNameElement.textContent = companyName;
  
  // Mostrar el logo real o el placeholder
  // companyLogoElement.src = `./assets/${companyName}.png`; // Ruta al logo
  // companyLogoElement.style.display = 'block';
  companyLogoPlaceholder.style.display = 'none'; // Ocultar placeholder si se quisiera mostrar imagen
  
  // Actualizar estado visual de los botones de empresa
  document.querySelectorAll('.company-select-button').forEach(btn => {
    btn.classList.remove('selected');
  });
  buttonElement.classList.add('selected');

  // Aquí se podría notificar al proceso principal para que inicie
  // el backend Python asociado a esta empresa.
  console.log(`Empresa seleccionada: ${companyName}`);
  // Después de seleccionar empresa, mostrar el home de la empresa
  showCompanyHomePage();
}

function handleLogout() {
  console.log('Handling logout...');
  currentCompany = null;
  currentModule = null;
  
  // Resetear UI
  if (companyNameElement) {
    companyNameElement.textContent = 'Empresa';
  }
  if (companyLogoElement) {
    companyLogoElement.style.display = 'none';
  }
  if (companyLogoPlaceholder) {
    companyLogoPlaceholder.style.display = 'flex';
  }
  
  document.querySelectorAll('.company-select-button').forEach(btn => {
    btn.classList.remove('selected');
  });
  
  // Limpiar el contenido y volver a la página de inicio
  showHomePage();
  
  // Desactivar botón de sidebar
  if (window.activeSidebarButton) {
    window.activeSidebarButton.classList.remove('active');
    window.activeSidebarButton = null;
  }
  
  console.log('Usuario desconectado.');
}

function showCompanyHomePage() {
  console.log(`Showing home page for company: ${currentCompany}`);
  contentArea.innerHTML = '';

  // Crear el contenedor principal del canvas
  const mainCanvas = document.createElement('div');
  mainCanvas.className = 'main-canvas';

  // Contenido del home de la empresa
  const companyHomeDiv = document.createElement('div');
  companyHomeDiv.className = 'company-home-content';
  
  // Título con el nombre de la empresa
  const title = document.createElement('h2');
  title.textContent = `Bienvenido a ${currentCompany}`;
  title.className = 'company-home-title';
  companyHomeDiv.appendChild(title);
  
  // Sección de métricas clave (inspirada en pantalla.png)
  const metricsSection = document.createElement('div');
  metricsSection.className = 'metrics-section';
  metricsSection.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-icon-placeholder"></div>
        <div class="metric-info">
          <div class="metric-value">8</div>
          <div class="metric-label">Módulos</div>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-icon-placeholder"></div>
        <div class="metric-info">
          <div class="metric-value">24</div>
          <div class="metric-label">Submódulos</div>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-icon-placeholder"></div>
        <div class="metric-info">
          <div class="metric-value">15</div>
          <div class="metric-label">Documentos</div>
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-icon-placeholder"></div>
        <div class="metric-info">
          <div class="metric-value">98%</div>
          <div class="metric-label">Completado</div>
        </div>
      </div>
    </div>
  `;
  companyHomeDiv.appendChild(metricsSection);
  
  // Mensaje de bienvenida
  const welcomeText = document.createElement('p');
  welcomeText.textContent = `Estás trabajando con los documentos de la empresa ${currentCompany}. Selecciona un módulo del menú lateral para comenzar a gestionar los aspectos del Sistema de Gestión de Seguridad y Salud en el Trabajo.`;
  welcomeText.className = 'company-home-text';
  companyHomeDiv.appendChild(welcomeText);
  
  // Información de módulos disponibles
  const modulesInfo = document.createElement('div');
  modulesInfo.className = 'modules-info';
  modulesInfo.innerHTML = `
    <h3>Módulos Disponibles</h3>
    <p>Puedes acceder a los siguientes módulos principales:</p>
    <ul>
      <li><strong>Recursos</strong>: Gestión de recursos humanos y materiales.</li>
      <li><strong>Gestión Integral</strong>: Políticas, objetivos y planificación general.</li>
      <li><strong>Gestión de la Salud</strong>: Programas de medicina, seguridad y salud ocupacional.</li>
      <li><strong>Gestión de Peligros y Riesgos</strong>: Identificación y control de peligros.</li>
      <li><strong>Gestión de Amenazas</strong>: Planes de emergencia y respuesta a desastres.</li>
      <li><strong>Verificación</strong>: Auditorías y revisiones del sistema.</li>
      <li><strong>Mejoramiento</strong>: Acciones correctivas y planes de mejora.</li>
    </ul>
  `;
  companyHomeDiv.appendChild(modulesInfo);
  
  mainCanvas.appendChild(companyHomeDiv);
  contentArea.appendChild(mainCanvas);
}

function showModuleContent(moduleName) {
  console.log(`Showing content for module: ${moduleName}`);
  currentModule = moduleName;
  
  // Verificar que contentArea exista
  if (!contentArea) {
    console.error('contentArea is not defined');
    return;
  }
  
  contentArea.innerHTML = ''; // Limpiar contenido anterior

  // Crear el contenedor principal del canvas
  const mainCanvas = document.createElement('div');
  mainCanvas.className = 'main-canvas';

  // Verificar si el módulo tiene submódulos definidos
  const submodules = RESOURCES_SUBMODULES[moduleName];
  
  if (submodules && submodules.length > 0) {
    // Mostrar directamente el home del módulo
    showModuleHome(mainCanvas, moduleName);
  } else {
    // Mostrar contenido genérico si no hay submódulos definidos
    const moduleDiv = document.createElement('div');
    moduleDiv.className = 'module-content';
    
    const title = document.createElement('h2');
    title.textContent = `Módulo: ${moduleName}`;
    moduleDiv.appendChild(title);
    
    const info = document.createElement('p');
    info.textContent = `Contenido del módulo "${moduleName}" se cargará aquí.`;
    moduleDiv.appendChild(info);
    
    // Placeholder para funcionalidades futuras
    const placeholderCard = document.createElement('div');
    placeholderCard.className = 'card';
    placeholderCard.innerHTML = `
      <h3>Funcionalidad en Desarrollo</h3>
      <p>Esta sección está en construcción.</p>
    `;
    moduleDiv.appendChild(placeholderCard);
    
    mainCanvas.appendChild(moduleDiv);
  }
  
  contentArea.appendChild(mainCanvas);
}

function showModuleWelcomeScreen(container, moduleName) {
  // Contenedor para la pantalla de bienvenida
  const welcomeContainer = document.createElement('div');
  welcomeContainer.className = 'module-welcome-content';
  
  // Título
  const title = document.createElement('h2');
  title.textContent = `Bienvenido al módulo: ${moduleName}`;
  welcomeContainer.appendChild(title);
  
  // Mensaje de bienvenida
  const welcomeText = document.createElement('p');
  welcomeText.textContent = `Has seleccionado el módulo '${moduleName}'. Este módulo contiene herramientas y recursos para gestionar eficazmente los aspectos relacionados con ${moduleName.toLowerCase()} en tu organización. Explora las diferentes secciones utilizando el menú desplegable para acceder a funcionalidades específicas.`;
  welcomeText.className = 'module-welcome-text';
  welcomeContainer.appendChild(welcomeText);
  
  // Botón para continuar al módulo
  const continueButton = document.createElement('button');
  continueButton.className = 'btn btn-primary';
  continueButton.textContent = 'Continuar al módulo';
  continueButton.addEventListener('click', () => {
    showModuleHome(container, moduleName);
  });
  welcomeContainer.appendChild(continueButton);
  
  container.appendChild(welcomeContainer);
}

function showSubmoduleSelectorAndContent(container, moduleName) {
  // Limpiar el contenedor
  container.innerHTML = '';
  
  // Obtener los submódulos para este módulo
  const submodules = RESOURCES_SUBMODULES[moduleName];
  
  if (!submodules || submodules.length === 0) {
    const noSubmodulesMessage = document.createElement('p');
    noSubmodulesMessage.textContent = 'No hay submódulos disponibles para este módulo.';
    container.appendChild(noSubmodulesMessage);
    return;
  }
  
  // Crear el selector de submódulos
  const selectorFrame = document.createElement('div');
  selectorFrame.className = 'submodule-selector-frame';
  
  const label = document.createElement('label');
  label.textContent = 'Seleccionar submódulo:';
  label.htmlFor = 'submodule-select';
  selectorFrame.appendChild(label);
  
  const selectElement = document.createElement('select');
  selectElement.id = 'submodule-select';
  selectElement.className = 'submodule-select';
  
  submodules.forEach(submoduleName => {
    const option = document.createElement('option');
    option.value = submoduleName;
    option.textContent = submoduleName;
    selectElement.appendChild(option);
  });
  
  // Establecer el primer submódulo como seleccionado por defecto
  if (submodules.length > 0) {
    selectElement.value = submodules[0];
  }
  
  // Añadir evento para cambiar el contenido cuando se seleccione un submódulo
  selectElement.addEventListener('change', (event) => {
    const selectedSubmodule = event.target.value;
    showSubmoduleContent(container, moduleName, selectedSubmodule);
  });
  
  selectorFrame.appendChild(selectElement);
  container.appendChild(selectorFrame);
  
  // Crear el área de contenido para el submódulo
  const contentCanvas = document.createElement('div');
  contentCanvas.className = 'submodule-content-canvas';
  contentCanvas.id = 'submodule-content-canvas';
  container.appendChild(contentCanvas);
  
  // Mostrar el contenido del primer submódulo por defecto
  if (submodules.length > 0) {
    showSubmoduleContent(contentCanvas, moduleName, submodules[0]);
  }
}

function showModuleHome(container, moduleName) {
  console.log(`Showing home for module: ${moduleName}`);
  
  // Verificar que container no sea null
  if (!container) {
    console.error('Container is null in showModuleHome');
    return;
  }
  
  // Limpiar el contenedor
  container.innerHTML = '';
  
  // Obtener los submódulos para este módulo
  const submodules = RESOURCES_SUBMODULES[moduleName];
  
  if (!submodules || submodules.length === 0) {
    const noSubmodulesMessage = document.createElement('p');
    noSubmodulesMessage.textContent = 'No hay submódulos disponibles para este módulo.';
    container.appendChild(noSubmodulesMessage);
    return;
  }

  // Para "Gestión Integral", usar directamente showGenericModuleHome
  if (moduleName === "Gestión Integral") {
    showGenericModuleHome(container, moduleName, submodules);
    return;
  }

// Verificar si es un módulo con home personalizado
  try {
    // Este bloque ahora está vacío pero es necesario para la estructura
    // Puedes agregar un comentario o dejarlo vacío
  } catch (error) {
    console.error('Error rendering module home:', error);
    showGenericModuleHome(container, moduleName, submodules);
  }

  // Ahora puedes usar las condiciones normales
  if (moduleName === "Gestión Integral") {
    showGenericModuleHome(container, moduleName, submodules);
    return;
  } else if (moduleName === "Recursos") {
    // Crear una instancia del componente personalizado y renderizarlo
    if (window.RecursosHome) {
      const recursosHome = new window.RecursosHome(container, moduleName, submodules);
      recursosHome.render();
    } else {
      console.error('RecursosHome component not found');
      showGenericModuleHome(container, moduleName, submodules);
    }
    return;
  } else if (moduleName === "Gestión de la Salud") {
    // Crear una instancia del componente personalizado y renderizarlo
    if (window.GestionSaludHome) {
      const gestionSaludHome = new window.GestionSaludHome(container, moduleName, submodules);
      gestionSaludHome.render();
    } else {
      console.error('GestionSaludHome component not found');
      showGenericModuleHome(container, moduleName, submodules);
    }
    return;
  } else if (moduleName === "Gestión de Peligros y Riesgos") {
    // Crear una instancia del componente personalizado y renderizarlo
    if (window.GestionPeligrosHome) {
      const gestionPeligrosHome = new window.GestionPeligrosHome(container, moduleName, submodules);
      gestionPeligrosHome.render();
    } else {
      console.error('GestionPeligrosHome component not found');
      showGenericModuleHome(container, moduleName, submodules);
    }
    return;
  } else if (moduleName === "Gestión de Amenazas") {
    // Crear una instancia del componente personalizado y renderizarlo
    if (window.GestionAmenazasHome) {
      const gestionAmenazasHome = new window.GestionAmenazasHome(container, moduleName, submodules);
      gestionAmenazasHome.render();
    } else {
      console.error('GestionAmenazasHome component not found');
      showGenericModuleHome(container, moduleName, submodules);
    }
    return;
  } else if (moduleName === "Verificación") {
    // Crear una instancia del componente personalizado y renderizarlo
    if (window.VerificacionHome) {
      const verificacionHome = new window.VerificacionHome(container, moduleName, submodules);
      verificacionHome.render();
    } else {
      console.error('VerificacionHome component not found');
      showGenericModuleHome(container, moduleName, submodules);
    }
    return;
  } else if (moduleName === "Mejoramiento") {
    // Crear una instancia del componente personalizado y renderizarlo
    if (window.MejoramientoHome) {
      const mejoramientoHome = new window.MejoramientoHome(container, moduleName, submodules);
      mejoramientoHome.render();
    } else {
      console.error('MejoramientoHome component not found');
      showGenericModuleHome(container, moduleName, submodules);
    }
    return;
  }
}

// Para otros módulos, usar el componente base
if (window.ModuleHomeBase) {
  const moduleHomeBase = new window.ModuleHomeBase(container, moduleName, submodules);
  moduleHomeBase.render();
} else {
  console.error('ModuleHomeBase component not found');
  showGenericModuleHome(container, moduleName, submodules);
}

function showGenericModuleHome(container, moduleName, submodules) {
  console.log(`Showing generic home for module: ${moduleName}`);
  
  // Verificar que container no sea null
  if (!container) {
    console.error('Container is null in showGenericModuleHome');
    return;
  }
  
  // Limpiar el contenedor
  container.innerHTML = '';
  
  const title = document.createElement('h2');
  title.textContent = `Módulo: ${moduleName}`;
  container.appendChild(title);
  
  const info = document.createElement('p');
  info.textContent = `Contenido del módulo "${moduleName}" se cargará aquí.`;
  container.appendChild(info);
  
  // Crear tarjetas para los submódulos
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'module-cards';
  
  submodules.forEach(submoduleName => {
    const card = document.createElement('div');
    card.className = 'card module-card';
    
    const cardTitle = document.createElement('h3');
    cardTitle.className = 'card-title';
    cardTitle.textContent = submoduleName;
    card.appendChild(cardTitle);
    
    const cardDescription = document.createElement('p');
    cardDescription.className = 'card-description';
    cardDescription.textContent = `Contenido para el submódulo "${submoduleName}".`;
    card.appendChild(cardDescription);
    
    const cardButton = document.createElement('button');
    cardButton.className = 'btn btn-primary';
    cardButton.textContent = 'Abrir';
    cardButton.addEventListener('click', () => {
      showSubmoduleContent(container, moduleName, submoduleName);
    });
    card.appendChild(cardButton);
    
    cardsContainer.appendChild(card);
  });
  
  container.appendChild(cardsContainer);
}

function showSubmoduleContent(container, moduleName, submoduleName) {
  console.log(`Showing content for submodule: ${submoduleName}`);
  
  // Verificar que container no sea null
  if (!container) {
    console.error('Container is null, cannot show submodule content');
    return;
  }
  
  container.innerHTML = ''; // Limpiar contenido anterior

  // Crear el contenedor principal del contenido del submódulo
  const submoduleContentDiv = document.createElement('div');
  submoduleContentDiv.className = 'submodule-content';
  
  try {
    // Verificar si es un submódulo especial con funcionalidad específica
    if (submoduleName === "3.1.6 Restricciones y recomendaciones médicas") {
      // Crear una instancia del componente y renderizarlo
      if (window.RestriccionesMedicasComponent) {
        const restriccionesComponent = new window.RestriccionesMedicasComponent(
          submoduleContentDiv, 
          currentCompany, 
          moduleName, 
          submoduleName,
          logMessage, // Pasar la función de log
          () => {
            // Verificar que container.parentElement exista antes de usarlo
            if (container.parentElement) {
              showModuleHome(container.parentElement, moduleName);
            } else {
              showModuleHome(container, moduleName);
            }
          } // Callback para volver al home del módulo
        );
        restriccionesComponent.render();
      } else {
        console.error('RestriccionesMedicasComponent not found');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }
    } else if (submoduleName === "3.1.4 Evaluaciones médicas") {
      console.log("Cargando submódulo: 3.1.4 Evaluaciones médicas");
      // Crear una instancia del nuevo componente y renderizarlo
      if (window.EvaluacionesMedicasComponent) {
        console.log("Componente EvaluacionesMedicasComponent encontrado");
        const evaluacionesComponent = new window.EvaluacionesMedicasComponent(
          submoduleContentDiv, 
          currentCompany, 
          moduleName, 
          submoduleName,
          () => {
            // Verificar que container.parentElement exista antes de usarlo
            if (container.parentElement) {
              showModuleHome(container.parentElement, moduleName);
            } else {
              showModuleHome(container, moduleName);
            }
          } // Callback para volver al home del módulo
        );
        evaluacionesComponent.render();
      } else {
        console.error('EvaluacionesMedicasComponent not found');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }
    } else if (submoduleName === "3.1.6.1 Control de Remisiones") {
      showControlRemisionesContent(submoduleContentDiv);
    } else if (submoduleName === "3.2.2 Investigación de Accidentes, indicentes y Enfermedades") {
      showInvestigacionAccidentesContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);
    } else if (submoduleName === "1.1.3 Asignación de Recursos") {
      showAsignacionRecursosContent(submoduleContentDiv);
    } else if (submoduleName === "1.1.1 Responsable del SG") {
      // Crear una instancia del componente y renderizarlo
      if (window.ResponsableSgComponent) {
        const responsableSgComponent = new window.ResponsableSgComponent(
          submoduleContentDiv, 
          currentCompany, 
          moduleName, 
          submoduleName,
          () => {
            // Verificar que container.parentElement exista antes de usarlo
            if (container.parentElement) {
              showModuleHome(container.parentElement, moduleName);
            } else {
              showModuleHome(container, moduleName);
            }
          } // Callback para volver al home del módulo
        );
        responsableSgComponent.render();
      } else {
        console.error('ResponsableSgComponent not found');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }
    } else {
      // Para otros submódulos, buscar la ruta y mostrar contenido o mensaje
      showGenericSubmoduleContent(submoduleContentDiv, moduleName, submoduleName);
    }
  } catch (error) {
    console.error('Error rendering submodule content:', error);
    showErrorMessage(submoduleContentDiv, submoduleName, error.message);
  }
  
  container.appendChild(submoduleContentDiv);
}

function showDevelopmentMessage(container, submoduleName) {
  container.innerHTML = `
    <div class="development-message">
      <h3>Funcionalidad en Desarrollo</h3>
      <p>La funcionalidad para el submódulo "${submoduleName}" se implementará en el futuro.</p>
    </div>
  `;
}

function showErrorMessage(container, submoduleName, errorMessage) {
  container.innerHTML = `
    <div class="development-message">
      <h3>Error al cargar el submódulo</h3>
      <p>No se pudo cargar el contenido del submódulo "${submoduleName}".</p>
      <p>Error: ${errorMessage}</p>
    </div>
  `;
}

async function showGenericSubmoduleContent(container, moduleName, submoduleName) {
  try {
    // Mostrar mensaje de carga
    container.innerHTML = '<p>Buscando contenido del submódulo...</p>';
    
    // Verificar que window.electronAPI exista
    if (!window.electronAPI || !window.electronAPI.findSubmodulePath) {
      throw new Error('Electron API not available');
    }
    
    // Encontrar la ruta del submódulo
    const submodulePathResult = await window.electronAPI.findSubmodulePath(currentCompany, moduleName, submoduleName);
    
    if (!submodulePathResult.success) {
      // Si no se encuentra la ruta, mostrar mensaje de desarrollo
      container.innerHTML = `
        <div class="development-message">
          <h3>Funcionalidad en Desarrollo</h3>
          <p>La funcionalidad para el submódulo "${submoduleName}" se implementará en el futuro.</p>
          <p>Error: ${submodulePathResult.error}</p>
        </div>
      `;
      return;
    }
    
    const submodulePath = submodulePathResult.path;
    console.log('Submodule path:', submodulePath);
    
    // Mostrar información del submódulo y la ruta encontrada
    container.innerHTML = `
      <div class="submodule-info">
        <h3>Submódulo: ${submoduleName}</h3>
        <p>Ruta encontrada: ${submodulePath}</p>
        <div class="development-message">
          <h4>Contenido del submódulo</h4>
          <p>Esta sección está en construcción. Aquí se mostrará el contenido específico del submódulo.</p>
          <button class="btn" onclick="window.open('${submodulePath}')">Abrir Carpeta</button>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error al cargar el contenido del submódulo:', error);
    container.innerHTML = `
      <div class="development-message">
        <h3>Error al cargar el submódulo</h3>
        <p>No se pudo cargar el contenido del submódulo "${submoduleName}".</p>
        <p>Error: ${error.message}</p>
      </div>
    `;
  }
}

// Funciones para mostrar contenido específico de submódulos
function showRestriccionesMedicasContent(container) {
  // Este código ya no se usa porque ahora usamos el componente RestriccionesMedicasComponent
  // pero lo dejamos por si acaso necesitamos referenciarlo
  console.warn("showRestriccionesMedicasContent is deprecated. Using RestriccionesMedicasComponent instead.");
}

function showEnviarRemisionContent(container) {
  // Este código ya no se usa porque ahora usamos el componente RestriccionesMedicasComponent
  // pero lo dejamos por si acaso necesitamos referenciarlo
  console.warn("showEnviarRemisionContent is deprecated. Using RestriccionesMedicasComponent instead.");
}

function showControlRemisionesContent(container) {
  // Crear un título para esta sección
  const title = document.createElement('h3');
  title.textContent = 'Control de Remisiones';
  container.appendChild(title);
  
  // Placeholder para la tabla de control de remisiones
  const tablePlaceholder = document.createElement('div');
  tablePlaceholder.className = 'control-remisiones-table';
  tablePlaceholder.innerHTML = `
    <p>Tabla de control de remisiones se cargará aquí.</p>
    <p>Esta funcionalidad se conectará al backend Python para obtener los datos.</p>
    <button class="btn">Refrescar</button>
  `;
  container.appendChild(tablePlaceholder);
}

function showAsignacionRecursosContent(container) {
  // Crear tarjetas para las opciones del submódulo
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'module-cards';
  
  // Tarjeta 1: Mostrar Presupuesto
  const card1 = createModuleCard(
    'Mostrar Presupuesto',
    'Visualiza el presupuesto actual del SG-SST.',
    () => alert('Funcionalidad "Mostrar Presupuesto" en desarrollo.')
  );
  cardsContainer.appendChild(card1);
  
  // Tarjeta 2: Editar Presupuesto
  const card2 = createModuleCard(
    'Editar Presupuesto',
    'Modifica o actualiza las partidas del presupuesto.',
    () => alert('Funcionalidad "Editar Presupuesto" en desarrollo.')
  );
  cardsContainer.appendChild(card2);
  
  // Tarjeta 3: Próxima Función
  const card3 = createModuleCard(
    'Próxima Función',
    'Una nueva funcionalidad estará disponible aquí pronto.',
    () => alert('Próxima función en desarrollo.')
  );
  cardsContainer.appendChild(card3);
  
  container.appendChild(cardsContainer);
}

function showInvestigacionAccidentesContent(container, currentCompany, moduleName, submoduleName) {
  // Crear una instancia del componente y renderizarlo
  if (typeof window.InvestigacionAccidentesComponent === 'function') {
    try {
      const investigacionComponent = new window.InvestigacionAccidentesComponent(
        container, 
        currentCompany, 
        moduleName, 
        submoduleName,
        () => {
          // Callback para volver al home del módulo
          const mainCanvas = document.querySelector('.main-canvas');
          if (mainCanvas && mainCanvas.parentElement) {
            showModuleHome(mainCanvas.parentElement, moduleName);
          } else {
            showModuleHome(container, moduleName);
          }
        }
      );
      investigacionComponent.render();
    } catch (error) {
      console.error('Error al crear/renderizar InvestigacionAccidentesComponent:', error);
      showDevelopmentMessage(container, submoduleName);
    }
  } else {
    console.error('InvestigacionAccidentesComponent no está disponible o no es una función');
    showDevelopmentMessage(container, submoduleName);
  }
}

// Función auxiliar para crear tarjetas de módulo
function createModuleCard(title, description, onClick) {
  const card = document.createElement('div');
  card.className = 'card module-card';
  
  // Contenedor para el ícono y el título
  const headerDiv = document.createElement('div');
  headerDiv.className = 'card-header';
  
  // Placeholder para el ícono
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

// --- Event Listeners para los botones del header ---
document.addEventListener('DOMContentLoaded', () => {
  // Botón de configuraciones
  const configButton = document.getElementById('config-button');
  if (configButton) {
    configButton.addEventListener('click', showSettingsPage);
  }
  
  // Botón de chat LLM
  const llmButton = document.getElementById('llm-button');
  if (llmButton) {
    llmButton.addEventListener('click', showLLMChatPage);
  }
});

function showSettingsPage() {
  console.log('Showing settings page...');
  contentArea.innerHTML = ''; // Limpiar contenido anterior

  // Crear el contenedor principal del canvas
  const mainCanvas = document.createElement('div');
  mainCanvas.className = 'main-canvas';

  const settingsDiv = document.createElement('div');
  settingsDiv.className = 'settings-content';
  
  const title = document.createElement('h2');
  title.textContent = 'Panel de Configuraciones';
  settingsDiv.appendChild(title);
  
  // Botón para volver al inicio
  const backButton = document.createElement('button');
  backButton.className = 'btn';
  backButton.textContent = '< Volver al Inicio';
  backButton.addEventListener('click', showHomePage);
  settingsDiv.appendChild(backButton);
  
  // Crear tarjetas de configuración
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'settings-cards';
  
  // Tarjeta para vincular empresas
  const pathCard = createSettingsCard(
    'Vincular Empresas', 
    'Conecta las carpetas de cada empresa para el análisis.',
    showPathLinkingPage
  );
  cardsContainer.appendChild(pathCard);
  
  // Tarjeta para ajustes de chat
  const chatCard = createSettingsCard(
    'Ajustes de Chat', 
    'Configura el comportamiento y la apariencia del asistente LLM.',
    showChatSettingsPage
  );
  cardsContainer.appendChild(chatCard);
  
  // Tarjeta para ajustes de usuario
  const userCard = createSettingsCard(
    'Ajustes de Usuario', 
    'Gestiona la información y preferencias del usuario.',
    showUserSettingsPage
  );
  cardsContainer.appendChild(userCard);
  
  settingsDiv.appendChild(cardsContainer);
  mainCanvas.appendChild(settingsDiv);
  contentArea.appendChild(mainCanvas);
}

function createSettingsCard(title, description, onClick) {
  const card = document.createElement('div');
  card.className = 'card settings-card';
  
  const cardTitle = document.createElement('h3');
  cardTitle.textContent = title;
  cardTitle.className = 'card-title';
  card.appendChild(cardTitle);
  
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

function showPathLinkingPage() {
  // Verificar que contentArea exista
  if (!contentArea) {
    console.error('contentArea is not defined');
    return;
  }
  
  contentArea.innerHTML = '';
  
  const mainCanvas = document.createElement('div');
  mainCanvas.className = 'main-canvas';
  
  const pathLinkingDiv = document.createElement('div');
  pathLinkingDiv.className = 'path-linking-content';
  
  // Botón para volver
  const backButton = document.createElement('button');
  backButton.className = 'btn';
  backButton.textContent = '< Volver';
  backButton.addEventListener('click', showSettingsPage);
  pathLinkingDiv.appendChild(backButton);
  
  const title = document.createElement('h2');
  title.textContent = 'Vincular Rutas de Archivos por Empresa';
  pathLinkingDiv.appendChild(title);
  
  // Crear filas para cada empresa
  COMPANY_BUTTONS.forEach(companyName => {
    const companyRow = document.createElement('div');
    companyRow.className = 'company-row';
    
    const label = document.createElement('label');
    label.textContent = companyName;
    companyRow.appendChild(label);
    
    const pathInput = document.createElement('input');
    pathInput.type = 'text';
    pathInput.placeholder = 'No se ha seleccionado ninguna ruta...';
    pathInput.disabled = true;
    pathInput.id = `path-input-${companyName}`;
    companyRow.appendChild(pathInput);
    
    const selectButton = document.createElement('button');
    selectButton.className = 'btn';
    selectButton.textContent = 'Seleccionar Ruta...';
    selectButton.addEventListener('click', async () => {
      try {
        // Verificar que window.electronAPI exista
        if (!window.electronAPI || !window.electronAPI.selectDirectory) {
          throw new Error('Electron API not available');
        }
        
        const selectedPath = await window.electronAPI.selectDirectory();
        if (selectedPath) {
          pathInput.value = selectedPath;
          // Habilitar el botón de cargar
          loadButton.disabled = false;
        }
      } catch (error) {
        console.error('Error selecting directory:', error);
        alert('Error al seleccionar el directorio.');
      }
    });
    companyRow.appendChild(selectButton);
    
    const loadButton = document.createElement('button');
    loadButton.className = 'btn';
    loadButton.textContent = 'Cargar Vínculo';
    loadButton.disabled = true;

    loadButton.addEventListener('click', async () => {
      const path = pathInput.value;
      if (!path) {
        alert('Por favor, seleccione una ruta primero.');
        return;
      }
      
      // Get the textarea element right when it's needed.
      const logTextarea = document.querySelector('.log-area textarea');

      try {
        loadButton.textContent = 'Mapeando...';
        loadButton.disabled = true;
        if (logTextarea) {
          logTextarea.value = `Iniciando mapeo para ${companyName} en la ruta ${path}...
`;
        }
        
        // Verificar que window.electronAPI exista
        if (!window.electronAPI || !window.electronAPI.mapDirectory) {
          throw new Error('Electron API not available');
        }
        
        const result = await window.electronAPI.mapDirectory(path);
        
        if (logTextarea) {
          logTextarea.value += `Resultado del proceso Python:
${result.log}

`;

          if (result.structure && result.structure.structure) {
            logTextarea.value += '--- Estructura Mapeada ---';
            logTextarea.value += formatStructureForLog(result.structure.structure);
          } else {
            logTextarea.value += 'No se pudo mostrar la estructura mapeada.';
          }
        }

        const checkmark = document.getElementById(`checkmark-${companyName}`);
        if (checkmark) {
          checkmark.style.display = 'inline';
        }
        
        // Verificar que window.electronAPI exista
        if (!window.electronAPI || !window.electronAPI.loadConfig || !window.electronAPI.saveConfig) {
          throw new Error('Electron API not available');
        }
        
        const config = await window.electronAPI.loadConfig();
        if (!config.companyPaths) {
          config.companyPaths = {};
        }
        config.companyPaths[companyName] = {
          root: path,
          structure: result.structure
        };
        await window.electronAPI.saveConfig(config);
        
        if (logTextarea) {
          logTextarea.value += `
--- Proceso Finalizado ---
Ruta para ${companyName} guardada exitosamente.
`;
        }
        alert(`Ruta para ${companyName} guardada exitosamente.`);

      } catch (error) {
        console.error('Error mapping directory:', error);
        if (logTextarea) {
            logTextarea.value += `
--- ERROR ---
Error al mapear el directorio: ${error.message}`;
        }
        alert(`Error al mapear el directorio: ${error.message}`);
      } finally {
        loadButton.textContent = 'Cargar Vínculo';
        loadButton.disabled = false;
      }
    });
    companyRow.appendChild(loadButton);
    
    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';
    checkmark.textContent = '✔';
    checkmark.style.display = 'none';
    checkmark.id = `checkmark-${companyName}`;
    companyRow.appendChild(checkmark);
    
    pathLinkingDiv.appendChild(companyRow);
  });
  
  // Área de registro
  const logArea = document.createElement('div');
  logArea.className = 'log-area';
  logArea.innerHTML = '<h3>Registro de Actividad</h3><textarea disabled></textarea>';
  pathLinkingDiv.appendChild(logArea);

  // Poblar el área de log con el búfer existente
  const logTextarea = logArea.querySelector('textarea');
  logTextarea.value = logBuffer.join('\n');
  logTextarea.scrollTop = logTextarea.scrollHeight;
  
  // Botón para asegurar configuración
  const saveButton = document.createElement('button');
  saveButton.className = 'btn btn-primary';
  saveButton.textContent = 'Asegurar Configuración';
  saveButton.addEventListener('click', async () => {
    try {
      // Verificar que todas las empresas tengan una ruta
      let allMapped = true;
      for (const companyName of COMPANY_BUTTONS) {
        const pathInput = document.getElementById(`path-input-${companyName}`);
        if (!pathInput || !pathInput.value) {
          allMapped = false;
          break;
        }
      }
      
      if (!allMapped) {
        alert('Por favor, asegúrese de que todas las empresas tengan una ruta de archivo vinculada y cargada.');
        return;
      }
      
      alert('Configuración guardada exitosamente.');
      
      // Deshabilitar botones después de guardar
      COMPANY_BUTTONS.forEach(companyName => {
        const selectButton = document.querySelector(`.company-row button:nth-child(3)`); // Ajustar selector si es necesario
        const loadButton = document.querySelector(`.company-row button:nth-child(4)`); // Ajustar selector si es necesario
        if (selectButton) selectButton.disabled = true;
        if (loadButton) loadButton.disabled = true;
      });
      saveButton.disabled = true;
      
      // Volver al menú de configuraciones
      showSettingsPage();
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error al guardar la configuración.');
    }
  });
  pathLinkingDiv.appendChild(saveButton);
  
  mainCanvas.appendChild(pathLinkingDiv);
  contentArea.appendChild(mainCanvas);
  
  // Cargar configuraciones existentes
  loadExistingPaths();
}

async function loadExistingPaths() {
  try {
    // Verificar que window.electronAPI exista
    if (!window.electronAPI || !window.electronAPI.loadConfig) {
      console.error('Electron API not available');
      return;
    }
    
    const config = await window.electronAPI.loadConfig();
    if (config.companyPaths) {
      for (const companyName in config.companyPaths) {
        const pathInput = document.getElementById(`path-input-${companyName}`);
        const checkmark = document.getElementById(`checkmark-${companyName}`);
        if (pathInput && checkmark) {
          pathInput.value = config.companyPaths[companyName].root;
          checkmark.style.display = 'inline';
        }
      }
    }
  } catch (error) {
    console.error('Error loading existing paths:', error);
  }
}

function showChatSettingsPage() {
  contentArea.innerHTML = '';
  
  const mainCanvas = document.createElement('div');
  mainCanvas.className = 'main-canvas';
  
  const chatSettingsDiv = document.createElement('div');
  chatSettingsDiv.className = 'chat-settings-content';
  
  // Botón para volver
  const backButton = document.createElement('button');
  backButton.className = 'btn';
  backButton.textContent = '< Volver';
  backButton.addEventListener('click', showSettingsPage);
  chatSettingsDiv.appendChild(backButton);
  
  const title = document.createElement('h2');
  title.textContent = 'Ajustes de Chat';
  chatSettingsDiv.appendChild(title);
  
  const placeholder = document.createElement('p');
  placeholder.textContent = 'Esta sección estará disponible próximamente.';
  chatSettingsDiv.appendChild(placeholder);
  
  mainCanvas.appendChild(chatSettingsDiv);
  contentArea.appendChild(mainCanvas);
}

function showUserSettingsPage() {
  contentArea.innerHTML = '';
  
  const mainCanvas = document.createElement('div');
  mainCanvas.className = 'main-canvas';
  
  const userSettingsDiv = document.createElement('div');
  userSettingsDiv.className = 'user-settings-content';
  
  // Botón para volver
  const backButton = document.createElement('button');
  backButton.className = 'btn';
  backButton.textContent = '< Volver';
  backButton.addEventListener('click', showSettingsPage);
  userSettingsDiv.appendChild(backButton);
  
  const title = document.createElement('h2');
  title.textContent = 'Ajustes de Usuario';
  userSettingsDiv.appendChild(title);
  
  const placeholder = document.createElement('p');
  placeholder.textContent = 'Esta sección estará disponible próximamente.';
  userSettingsDiv.appendChild(placeholder);
  
  mainCanvas.appendChild(userSettingsDiv);
  contentArea.appendChild(mainCanvas);
}

// --- Funciones para Chat LLM ---
function showLLMChatPage() {
  console.log('Showing LLM chat page...');
  contentArea.innerHTML = ''; // Limpiar contenido anterior

  // Crear el contenedor principal del canvas
  const mainCanvas = document.createElement('div');
  mainCanvas.className = 'main-canvas';

  const chatDiv = document.createElement('div');
  chatDiv.className = 'llm-chat-content';
  
  const title = document.createElement('h2');
  title.textContent = 'Asistente LLM';
  chatDiv.appendChild(title);
  
  // Área de historial del chat
  const chatHistory = document.createElement('div');
  chatHistory.className = 'chat-history';
  chatHistory.innerHTML = '<p>Bienvenido al asistente LLM. ¿En qué puedo ayudarte?</p>';
  chatDiv.appendChild(chatHistory);
  
  // Área de entrada de usuario
  const inputArea = document.createElement('div');
  inputArea.className = 'chat-input-area';
  
  const userInput = document.createElement('input');
  userInput.type = 'text';
  userInput.placeholder = 'Escribe tu pregunta...';
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage(userInput.value, chatHistory);
      userInput.value = '';
    }
  });
  inputArea.appendChild(userInput);
  
  const sendButton = document.createElement('button');
  sendButton.className = 'btn';
  sendButton.textContent = 'Enviar';
  sendButton.addEventListener('click', () => {
    sendMessage(userInput.value, chatHistory);
    userInput.value = '';
  });
  inputArea.appendChild(sendButton);
  
  chatDiv.appendChild(inputArea);
  mainCanvas.appendChild(chatDiv);
  contentArea.appendChild(mainCanvas);
}

function sendMessage(message, chatHistory) {
  if (!message.trim()) return;
  
  // Agregar mensaje del usuario
  const userMessage = document.createElement('div');
  userMessage.className = 'user-message';
  userMessage.textContent = message;
  chatHistory.appendChild(userMessage);
  
  // Simular respuesta del asistente
  setTimeout(() => {
    const botMessage = document.createElement('div');
    botMessage.className = 'bot-message';
    botMessage.textContent = `Entendido. Has dicho: "${message}". Esta es una respuesta simulada del asistente LLM.`;
    chatHistory.appendChild(botMessage);
    
    // Desplazar hacia abajo
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }, 1000);
  
  // Desplazar hacia abajo
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

// --- Funciones para Diálogo Personalizado ---
function showCustomAlert(message) {
  const overlay = document.getElementById('custom-alert-overlay');
  const messageEl = document.getElementById('custom-alert-message');
  const closeBtn = document.getElementById('custom-alert-close');

  if (!overlay || !messageEl || !closeBtn) {
    console.error('Custom alert elements not found!');
    // Fallback to native alert
    alert(message);
    return;
  }

  messageEl.textContent = message;
  overlay.style.display = 'flex';

  const closeModal = () => {
    overlay.style.display = 'none';
  };

  closeBtn.onclick = closeModal;

  overlay.onclick = (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  };
}

// --- Función para formatear la estructura del directorio para el log ---
function formatStructureForLog(node, indent = '') {
    let logString = '';
    if (node && node.name) {
        logString += `${indent}[DIR] ${node.name}\n`;
        
        if (node.subdirectories) {
            for (const dirName in node.subdirectories) {
                logString += formatStructureForLog(node.subdirectories[dirName], indent + '  ');
            }
        }
        
        if (node.files) {
            for (const file of node.files) {
                logString += `${indent}  - [FILE] ${file.name} (${file.size} bytes)\n`;
            }
        }
    }
    return logString;
}