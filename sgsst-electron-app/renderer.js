// renderer.js - Lógica del proceso de renderizado de Electron

// --- Constantes y Configuración ---
// Módulos principales donde se debe mostrar el calendario
const MODULES_WITH_CALENDAR = [
    "Gestión Integral", "Recursos", "Gestión de la Salud",
    "Gestión de Peligros y Riesgos", "Gestión de Amenazas",
    "Verificación", "Mejoramiento"
];

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

const COMPANY_LOGOS = {
  "Tempoactiva": "assets/Tempoactiva.png",
  "Temposum": "assets/Temposum.png",
  "Aseplus": "assets/Aseplus.png",
  "Asel": "assets/Asel.png"
};

// --- Estado de la Aplicación ---
let currentCompany = null;
let currentModule = null;
let currentSubmodule = null; // ✅ NUEVA VARIABLE
let logBuffer = []; // Búfer para almacenar los logs
let currentCalendarInstance = null; // Para mantener una referencia a la instancia del calendario

// --- Funciones para controlar el Calendario ---

/**
 * Crea y muestra el calendario dentro de un contenedor específico.
 * @param {HTMLElement} parentContainer - El elemento donde se insertará el calendario.
 */
/**
 * Crea (si no existe) y muestra el contenedor del calendario dentro de un contenedor específico.
 * @param {HTMLElement} parentContainer - El elemento donde se insertará o mostrará el calendario.
 */
/**
 * Crea (si no existe) y muestra el contenedor del calendario dentro de un contenedor específico.
 * @param {HTMLElement} parentContainer - El elemento donde se insertará o mostrará el calendario.
 */
function showCalendarInModule(parentContainer) {
    console.log(`🔍 [showCalendarInModule] === INICIO DE FUNCIÓN ===`);
    console.log(`🔍 [showCalendarInModule] currentSubmodule: "${currentSubmodule}"`);
    console.log(`🔍 [showCalendarInModule] currentModule: "${currentModule}"`);
    
    // ✅ VALIDACIÓN: No mostrar calendario si estamos en un submódulo
    if (currentSubmodule) {
        console.log(`❌ [showCalendarInModule] CANCELANDO: No se creará calendario porque estamos en submódulo: "${currentSubmodule}"`);
        return;
    }
    
    // Verificar si el módulo actual requiere calendario
    if (!currentModule || !MODULES_WITH_CALENDAR.includes(currentModule)) {
        console.log(`❌ [showCalendarInModule] CANCELANDO: Módulo "${currentModule}" no requiere calendario`);
        return;
    }
    
    console.log(`✅ [showCalendarInModule] PROCEDIENDO: Creando calendario para módulo "${currentModule}"`);
    console.log(`🔹 [showCalendarInModule] parentContainer:`, parentContainer);

    // Resto de la lógica del calendario...
    let calendarContainer = parentContainer.querySelector(':scope > .module-calendar-container');
    console.log(`🔹 [showCalendarInModule] Contenedor existente encontrado:`, calendarContainer);

    if (!calendarContainer) {
        console.log(`🔹 [showCalendarInModule] Creando contenedor del calendario por primera vez.`);
        calendarContainer = document.createElement('div');
        calendarContainer.className = 'module-calendar-container';
        console.log(`🔹 [showCalendarInModule] Nuevo contenedor creado:`, calendarContainer);
        parentContainer.appendChild(calendarContainer);
        lastCalendarContainer = calendarContainer; // ✅ Guardar referencia directa
        console.log(`🔹 [showCalendarInModule] Nuevo contenedor añadido al DOM.`);

        try {
            console.log(`🔹 [showCalendarInModule] Intentando inicializar Vanilla Calendar...`);
            if (window.VanillaCalendarPro) {
                console.log(`🔹 [showCalendarInModule] window.VanillaCalendarPro encontrado.`);
                const { Calendar } = window.VanillaCalendarPro;
                if (currentCalendarInstance) {
                    console.warn(`🔸 [showCalendarInModule] Advertencia: Instancia de calendario ya existente, limpiando referencia.`);
                    currentCalendarInstance = null;
                }
                console.log(`🔹 [showCalendarInModule] Creando nueva instancia de calendario...`);
                const calendar = new Calendar(calendarContainer, {});
                console.log(`🔹 [showCalendarInModule] Llamando a calendar.init()...`);
                calendar.init();
                console.log(`✅ [showCalendarInModule] Vanilla Calendar inicializado correctamente dentro del módulo.`);
                currentCalendarInstance = calendar;
                console.log(`🔹 [showCalendarInModule] Referencia a instancia guardada.`);
            } else {
                console.error(`❌ [showCalendarInModule] Error: Vanilla Calendar Pro script NO CARGADO.`);
                calendarContainer.innerHTML = '<p style="color:red;">Error: Calendario no disponible.</p>';
            }
        } catch (e) {
            console.error(`❌ [showCalendarInModule] Error al inicializar Vanilla Calendar:`, e);
            if (calendarContainer) {
                calendarContainer.innerHTML = `<p style="color:red;">Error cargando el calendario: ${e.message}</p>`;
            }
        }
    } else {
        console.log(`🔹 [showCalendarInModule] Contenedor del calendario ya existe, mostrándolo.`);
        calendarContainer.classList.remove('hidden');
        console.log(`✅ [showCalendarInModule] Clase .hidden removida, calendario debería ser visible.`);
    }
    console.log(`🔹 [showCalendarInModule] === FIN DE FUNCIÓN ===`);
}

/**
 * Oculta y destruye el calendario si está presente dentro del contenedor principal del módulo.
 * @param {HTMLElement} contextElement - Un elemento dentro del contexto del módulo para encontrar el main-canvas.
 */
function hideCalendar() {
    console.log('🔸 [hideCalendar] Intentando ocultar y destruir cualquier calendario existente.');

    let hidden = false;
    // 1. Intentar eliminar usando la referencia directa (método más fiable)
    if (lastCalendarContainer && lastCalendarContainer.parentElement) {
        lastCalendarContainer.remove();
        lastCalendarContainer = null;
        hidden = true;
        console.log('✅ [hideCalendar] Calendario eliminado usando referencia directa.');
    }

    // 2. Como fallback, buscar en el DOM (método anterior)
    const calendarContainers = document.querySelectorAll('.module-calendar-container, .vc-vanilla');
    if (calendarContainers.length > 0) {
        calendarContainers.forEach(container => {
            const parentContainer = container.closest('.module-calendar-container') || container;
            parentContainer.remove();
            hidden = true;
            console.log('✅ [hideCalendar] Contenedor de calendario encontrado y eliminado desde el DOM:', parentContainer);
        });
    }

    if (!hidden) {
        console.log('ℹ️ [hideCalendar] No se encontraron contenedores de calendario para eliminar.');
    }

    // Limpiar la referencia global de la instancia del calendario para estar seguros
    if (currentCalendarInstance) {
        currentCalendarInstance = null;
        console.log('🔹 [hideCalendar] Referencia global de la instancia del calendario limpiada.');
    }
}

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
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM fully loaded and parsed.');

  // Cargar y mostrar la versión de la aplicación
  try {
    const version = await window.electronAPI.getAppVersion();
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
      versionElement.innerText = `v${version}`;
    }
  } catch (error) {
    console.error('Error al obtener la versión de la app:', error);
  }

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

    // --- Lógica para Auto Updater ---
    window.electronAPI.onUpdateAvailable(() => {
      logMessage('Nueva actualización disponible. Descargando en segundo plano.', 'INFO');
      // Opcional: Muestra una notificación no intrusiva en tu UI.
      // Por ejemplo, usando tu función de alerta personalizada:
      showCustomAlert('Hay una nueva actualización disponible y se está descargando.');
    });

    window.electronAPI.onUpdateDownloaded(() => {
      logMessage('Actualización lista para instalar.', 'INFO');
      // Usar confirm() es simple, pero una ventana modal personalizada sería mejor UX.
      const userResponse = confirm('¡Actualización descargada! ¿Desea reiniciar la aplicación ahora para instalarla?');
      if (userResponse) {
        window.electronAPI.restartApp();
      }
    });

  } else {
    console.error('API de logging no disponible en window.electronAPI');
  }

  if (!contentArea || !sidebarMenu) {
    console.error("No se pudieron encontrar elementos críticos del DOM.");
    return;
  }

  // Botón de configuraciones
  const configButton = document.getElementById('config-button');
  if (configButton) {
    console.log('Found config button, attaching event listener.');
    configButton.addEventListener('click', function(event) {
      console.log('Config button clicked.');
      event.preventDefault(); // Prevenir comportamiento por defecto
      showSettingsPage(); // Esta función debe estar definida en renderer.js
    });
  } else {
    console.error('Config button NOT found in DOM.');
  }

  // Botón de chat LLM
  const llmButton = document.getElementById('llm-button');
  if (llmButton) {
    console.log('Found LLM button, attaching event listener.');
    llmButton.addEventListener('click', function(event) {
      console.log('LLM button clicked.');
      event.preventDefault(); // Prevenir comportamiento por defecto
      showLLMChatPage(); // Esta función debe estar definida en renderer.js
    });
  } else {
    console.error('LLM button NOT found in DOM.');
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
        // ✅ NUEVA VALIDACIÓN: No cambiar módulo si estamos en submódulo
        if (currentSubmodule && currentModule !== item.name) {
          console.log(`ℹ️ Ignorando click en "${item.name}" porque estamos en submódulo: "${currentSubmodule}"`);
          return;
        }
        
        setActiveSidebarButton(button);
        showModuleContent(item.name);
      } else {
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
  // ✅ LIMPIAR ESTADO
  currentSubmodule = null;
  // ✅ Pasar contentArea a hideCalendar
  hideCalendar(contentArea);
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
  companyNameElement.textContent = ''; // Clear the text
  companyNameElement.style.display = 'none'; // Hide the element

  const logoPath = COMPANY_LOGOS[companyName];
  if (logoPath) {
    companyLogoElement.src = logoPath;
    companyLogoElement.style.display = 'block';
    companyLogoPlaceholder.style.display = 'none';
  } else {
    companyLogoElement.style.display = 'none';
    companyLogoPlaceholder.style.display = 'flex';
  }

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
    companyLogoPlaceholder.style.display = 'none';
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
  // ✅ LIMPIAR ESTADO
  currentSubmodule = null;
  // ✅ Pasar contentArea a hideCalendar
  hideCalendar(contentArea);
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
  // ✅ SOLUCIÓN TEMPORAL: No cambiar módulo si estamos en un submódulo
    if (currentSubmodule) {
        console.warn(`🚨 [showModuleContent] BLOQUEANDO cambio de módulo porque estamos en submódulo: "${currentSubmodule}"`);
        return;
    }

  currentModule = moduleName;
  // ✅ LIMPIAR ESTADO: Al cambiar de módulo, ya no estamos en un submódulo
  currentSubmodule = null;
  console.log(`🔍 [showModuleContent] currentModule actualizado a: ${currentModule}`);
  
  // Verificar que contentArea exista
  if (!contentArea) {
    console.error('contentArea is not defined');
    return;
  }
  
  contentArea.innerHTML = ''; // Limpiar contenido anterior

  // Crear el contenedor principal del canvas
  const mainCanvas = document.createElement('div');

  // **LA CORRECCIÓN:**
  // 1. Añadir el contenedor al DOM ANTES de llenarlo.
  contentArea.appendChild(mainCanvas);

  // 2. Llenar el contenedor (que ya está en el DOM).
  const submodules = RESOURCES_SUBMODULES[moduleName];
  
  if (submodules && submodules.length > 0) {
    // Mostrar directamente el home del módulo, que asignará la clase a mainCanvas
    showModuleHome(mainCanvas, moduleName);
  } else {
    // Mostrar contenido genérico si no hay submódulos definidos
    mainCanvas.className = 'main-canvas'; // Asignar clase aquí si no se va a showModuleHome
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
    // Limpiar el contenedores
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
    // Mostrar el contenido del primer submódulo por defecto
    if (submodules.length > 0) {
        showSubmoduleContent(container, moduleName, submodules[0]);
    }
}

let lastCalendarContainer = null;

function showModuleHome(container, moduleName) { // 'container' ya es el <div class="main-canvas"> creado en showModuleContent
    console.log(`🔹 [showModuleHome] Iniciando para módulo: ${moduleName}`);
    if (!container) {
        console.error('❌ [showModuleHome] Container es null');
        return;
    }

    // 1. Limpiar estado y DOM del contenedor proporcionado
    // ✅ Pasar el 'container' a hideCalendar para que busque específicamente ahí
    hideCalendar(container);
    container.innerHTML = ''; // Limpiar el contenido del main-canvas proporcionado
    container.className = 'main-canvas'; // Asegurar que tenga la clase correcta

    // 2. Crear el contenedor para el contenido del módulo DENTRO del 'container' (main-canvas)
    const moduleContentContainer = document.createElement('div');
    moduleContentContainer.className = 'module-content-area';
    container.appendChild(moduleContentContainer); // moduleContentContainer es hijo directo de main-canvas

    // 3. ✅ VALIDACIÓN MEJORADA: Solo mostrar calendario si NO estamos en un submódulo
    if (MODULES_WITH_CALENDAR.includes(moduleName) && !currentSubmodule) {
        console.log(`✅ [showModuleHome] Mostrando calendario para: ${moduleName} (no hay submódulo activo)`);
        showCalendarInModule(container);
    } else if (currentSubmodule) {
        console.log(`ℹ️ [showModuleHome] NO se mostrará calendario para: ${moduleName} porque estamos en submódulo: ${currentSubmodule}`);
    } else {
        console.log(`ℹ️ [showModuleHome] NO se mostrará calendario para: ${moduleName} (módulo no requiere calendario)`);
    }

    // 4. Renderizar el contenido del módulo DENTRO del 'moduleContentContainer'
    const submodules = RESOURCES_SUBMODULES[moduleName];
    if (!submodules || submodules.length === 0) {
        const noSubmodulesMessage = document.createElement('p');
        noSubmodulesMessage.textContent = 'No hay submódulos disponibles para este módulo.';
        moduleContentContainer.appendChild(noSubmodulesMessage);
        return;
    }

    // 5. Llamar a las funciones de renderizado para el contenido del módulo
    // (Este código permanece igual, solo se asegura de usar moduleContentContainer)
    if (moduleName === "Gestión Integral") {
        if (window.GestionIntegralHome) {
            const gestionIntegralHome = new window.GestionIntegralHome(moduleContentContainer, moduleName, submodules);
            gestionIntegralHome.render();
        } else {
            console.error('GestionIntegralHome component not found');
            showGenericModuleHome(moduleContentContainer, moduleName, submodules);
        }
    } else if (moduleName === "Recursos") {
        if (window.RecursosHome) {
            const recursosHome = new window.RecursosHome(moduleContentContainer, moduleName, submodules);
            recursosHome.render();
        } else {
            console.error('RecursosHome component not found');
            showGenericModuleHome(moduleContentContainer, moduleName, submodules);
        }
    } else if (moduleName === "Gestión de la Salud") {
        if (window.GestionSaludHome) {
            const gestionSaludHome = new window.GestionSaludHome(moduleContentContainer, moduleName, submodules);
            gestionSaludHome.render();
        } else {
            console.error('GestionSaludHome component not found');
            showGenericModuleHome(moduleContentContainer, moduleName, submodules);
        }
    } else if (moduleName === "Gestión de Peligros y Riesgos") {
        if (window.GestionPeligrosHome) {
            const gestionPeligrosHome = new window.GestionPeligrosHome(moduleContentContainer, moduleName, submodules);
            gestionPeligrosHome.render();
        } else {
            console.error('GestionPeligrosHome component not found');
            showGenericModuleHome(moduleContentContainer, moduleName, submodules);
        }
    } else if (moduleName === "Gestión de Amenazas") {
        if (window.GestionAmenazasHome) {
            const gestionAmenazasHome = new window.GestionAmenazasHome(moduleContentContainer, moduleName, submodules);
            gestionAmenazasHome.render();
        } else {
            console.error('GestionAmenazasHome component not found');
            showGenericModuleHome(moduleContentContainer, moduleName, submodules);
        }
    } else if (moduleName === "Verificación") {
        if (window.VerificacionHome) {
            const verificacionHome = new window.VerificacionHome(moduleContentContainer, moduleName, submodules);
            verificacionHome.render();
        } else {
            console.error('VerificacionHome component not found');
            showGenericModuleHome(moduleContentContainer, moduleName, submodules);
        }
    } else if (moduleName === "Mejoramiento") {
        if (window.MejoramientoHome) {
            const mejoramientoHome = new window.MejoramientoHome(moduleContentContainer, moduleName, submodules);
            mejoramientoHome.render();
        } else {
            console.error('MejoramientoHome component not found');
            showGenericModuleHome(moduleContentContainer, moduleName, submodules);
        }
    } else {
        showGenericModuleHome(moduleContentContainer, moduleName, submodules);
    }
}

// Para otros módulos, usar el componente base
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

// Para otros módulos, usar el componente base
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
  // ✅ ACTUALIZAR ESTADO: Establecer que estamos en un submódulo
  currentSubmodule = submoduleName;

  // Inspeccionar el DOM antes de limpiar
  console.log('🔍 [showSubmoduleContent] Inspeccionando DOM antes de limpiar:', container.innerHTML);
  console.log(`🔍 [showSubmoduleContent] currentModule es: ${currentModule}`);
  console.log(`🔍 [showSubmoduleContent] currentSubmodule es: ${currentSubmodule}`); // ✅ NUEVO LOG

  hideCalendar(); // No necesita argumento con la nueva implementación
  console.log(`🔹 Mostrando contenido para el submódulo: ${submoduleName}`);

  // ✅ Verificar que container no sea null
  if (!container) {
    console.error('❌ Container es null, no se puede mostrar el contenido del submódulo');
    return;
  }

  // ✅ Limpiar contenido anterior
  container.innerHTML = '';

  // ✅ Crear contenedor principal del submódulo
  const submoduleContentDiv = document.createElement('div');
  submoduleContentDiv.className = 'submodule-content';

  try {
    // --- Callback genérico para volver al módulo limpiando el estado ---
    const backToModuleCallback = () => {
        currentSubmodule = null; // Limpiar estado
        showModuleContent(moduleName);
    };

    // --- Callback SEGURO para componentes que se portan mal ---
    const safeBackToModuleCallback = () => {
        console.warn('[safeBackToModuleCallback] Se ha llamado al callback de retorno. Limpiando estado y mostrando home del módulo.');
        currentSubmodule = null;
        showModuleContent(moduleName);
    };

    // ------------------ Submódulos con componentes especiales ------------------ //
    if (submoduleName === "1.1.1 Responsable del SG") {
      if (window.ResponsableSgComponent) {
        const responsableSgComponent = new window.ResponsableSgComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
        );
        responsableSgComponent.render();
      } else {
        console.error('❌ ResponsableSgComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }
    } else if (submoduleName === "1.1.6 Conformación de Copasst") {
      if (window.CopasstComponent) {
        const copasstComponent = new window.CopasstComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          backToModuleCallback
        );
        copasstComponent.render();
      } else {
        console.error('❌ CopasstComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "1.1.8 Conformación de Comite de Convivencia") {
      if (window.ComiteConvivenciaComponent) {
        const convivenciaComponent = new window.ComiteConvivenciaComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          backToModuleCallback
        );
        convivenciaComponent.render();
      } else {
        console.error('❌ ComiteConvivenciaComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "1.2.3 Curso Virtual 50 Horas") {
      if (window.Curso50HorasComponent) {
        const cursoComponent = new window.Curso50HorasComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          backToModuleCallback
        );
        cursoComponent.render();
      } else {
        console.error('❌ Curso50HorasComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "3.1.6 Restricciones y recomendaciones médicas") {
      if (window.RestriccionesMedicasComponent) {
        const restriccionesComponent = new window.RestriccionesMedicasComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          logMessage,
          backToModuleCallback
        );
        restriccionesComponent.render();
      } else {
        console.error('❌ RestriccionesMedicasComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "3.1.4 Evaluaciones médicas") {
      console.log("📄 Cargando submódulo: Evaluaciones médicas");
      if (window.EvaluacionesMedicasComponent) {
        const evaluacionesComponent = new window.EvaluacionesMedicasComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          backToModuleCallback
        );
        evaluacionesComponent.render();
      } else {
        console.error('❌ EvaluacionesMedicasComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "3.1.6.1 Control de Remisiones") {
      showControlRemisionesContent(submoduleContentDiv);

    } else if (submoduleName === "3.2.1 Reporte de los accidentes de trabajo") {
      if (window.ReportesAccidentesComponent) {
        const reportesComponent = new window.ReportesAccidentesComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          backToModuleCallback
        );
        reportesComponent.render();
      } else {
        console.error('❌ ReportesAccidentesComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }
    } else if (submoduleName === "3.2.2 Investigación de Accidentes, indicentes y Enfermedades") {
      showInvestigacionAccidentesContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);

    } else if (submoduleName === "1.1.3 Asignación de Recursos") {
      showAsignacionRecursosContent(submoduleContentDiv);

    } else {
      // ------------------ Submódulos genéricos ------------------ //
      showGenericSubmoduleContent(submoduleContentDiv, moduleName, submoduleName);
    }

  } catch (error) {
    console.error('⚠️ Error al renderizar el submódulo:', error);
    showErrorMessage(submoduleContentDiv, submoduleName, error.message);
  }

  // ✅ Agregar contenido al contenedor principal
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
    // ✅ Limpiar todo antes de cargar submódulo
    container.innerHTML = '';

    // ✅ Ocultar calendario si existe
    const calendar = container.querySelector('.vc');
    if (calendar) {
      calendar.remove();
      console.log('🗑️ Calendario eliminado antes de cargar submódulo.');
    }

    // Mostrar mensaje de carga
    container.innerHTML = '<p>Buscando contenido del submódulo...</p>';

    // Resto de tu código para buscar el submódulo...
    const submodulePathResult = await window.electronAPI.findSubmodulePath(currentCompany, moduleName, submoduleName);
    
    if (!submodulePathResult.success) {
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

function showSettingsPage() {
  // ✅ Pasar contentArea a hideCalendar
  hideCalendar(contentArea);
  console.log('Showing settings page...');
  // Verificar que contentArea exista
  if (!contentArea) {
    console.error('contentArea is not defined or accessible in showSettingsPage.');
    // Intentar encontrarlo nuevamente si es necesario
    contentArea = document.getElementById('content-area');
    if (!contentArea) {
      console.error('Critical: content-area element still not found.');
      // Mostrar mensaje de error en la UI
      if (document.body) {
        document.body.innerHTML = '<h1>Error: No se puede cargar la página de configuración</h1>';
      }
      return;
    }
  }
  
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
  // ✅ Pasar contentArea a hideCalendar
  hideCalendar(contentArea);
  console.log('Showing LLM chat page...');
  // Verificar que contentArea exista
  if (!contentArea) {
    console.error('contentArea is not defined or accessible in showLLMChatPage.');
    // Intentar encontrarlo nuevamente si es necesario
    contentArea = document.getElementById('content-area');
    if (!contentArea) {
      console.error('Critical: content-area element still not found.');
      // Mostrar mensaje de error en la UI
      if (document.body) {
        document.body.innerHTML = '<h1>Error: No se puede cargar la página de chat</h1>';
      }
      return;
    }
  }
  
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


