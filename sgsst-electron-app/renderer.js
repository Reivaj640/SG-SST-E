// renderer.js - Lógica del proceso de renderizado de Electron

// --- Constantes y Configuración ---
// Módulos principales donde se debe mostrar el calendario
const MODULES_WITH_CALENDAR = [
    "Gestión Integral", "Recursos", "Gestión de la Salud",
    "Gestión de Peligros y Riesgos", "Gestión de Amenazas",
    "Verificación", "Mejoramiento"
];

// Definir los botones de la barra lateral según la estructura de tu aplicación Python
// Cada módulo incluye `subtitle` (línea descriptiva debajo del título) e `iconBg`
// (color de fondo de la caja del icono, en formato hex) para el rediseño tipo card.
const SIDEBAR_BUTTONS = [
  { name: "Recursos",                         icon: "kpi.png",                 subtitle: "Capacitación, Roles",     iconBg: "#EEF2FF" },
  { name: "Gestión Integral",                 icon: "gestion.png",             subtitle: "Política, Planes",        iconBg: "#F0FDF4" },
  { name: "Gestión de la Salud",              icon: "medico.png",              subtitle: "Ausentismo, AT, EL",      iconBg: "#FEF2F2" },
  { name: "Gestión de Peligros y Riesgos",    icon: "identificar.png",         subtitle: "IPERC, Controles",        iconBg: "#FFF7ED" },
  { name: "Gestión de Amenazas",              icon: "amenaza.png",             subtitle: "Emergencias",             iconBg: "#FFFBEB" },
  { name: "Verificación",                     icon: "seguro-de-salud.png",     subtitle: "Auditorías",              iconBg: "#EFF6FF" },
  { name: "Mejoramiento",                     icon: "ventas.png",              subtitle: "Acciones Correctivas",    iconBg: "#F5F3FF" },
  { name: "Salir",                            icon: "superacion-personal.png", subtitle: "Cerrar sesión",           iconBg: "#F3F4F6" }
];

// Submódulos para cada sección principal
// Este objeto estructura el contenido que aparece en InternalPage
const ALL_SUBMODULES = {
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
    "2.10.1 Evaluación y selección de proveedores y contratistas",
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
    /* F21.49 (2026-06-21) — Mejoramiento ahora SOLO tiene 7.1.1.
       7.1.2 / 7.1.3 / 7.1.4 quedan integrados en el módulo único 7.1.1
       (Matriz de Control Operacional GI-FO-014).
       Por lo tanto la normativa legal ya no los activa como submódulos separados. */
    "7.1.1 Acciones Preventivas y Correctivas",
  ]
};

function normalizeTextKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeRoleKey(roleName) {
  const key = normalizeTextKey(roleName);
  if (key === 'responsable sst') return 'sst';
  return key;
}

const SUBMODULE_PERMISSION_MAP_UI = new Map([
  ['1.1.1 responsable del sg', 'recursos.responsable-sg'],
  ['1.1.2 roles y responsabilidades', 'recursos.roles-responsabilidades'],
  ['1.1.3 asignacion de recursos', 'recursos.presupuesto'],
  ['1.1.4 afiliacion al sssi', 'recursos.afiliacion'],
  ['1.1.5 trabajo de alto riesgo', 'recursos.trabajo-alto-riesgo'],
  ['1.1.6 conformacion de copasst', 'recursos.copasst'],
  ['1.1.7 capacitacion al copasst', 'recursos.capacitacion-copasst'],
  ['1.1.8 conformacion de comite de convivencia', 'recursos.comite-convivencia'],
  ['1.2.1 programa de capacitacion anual', 'recursos.capacitaciones'],
  ['1.2.2 induccion y reinduccion', 'recursos.inducciones'],
  ['1.2.3 curso virtual 50 horas', 'recursos.curso-virtual'],
  ['1.2.4 manual de sst para proveedores y contratistas', 'recursos.manual-proveedores'],
  ['2.1.1 politica del sg-sst', 'gestion-integral.politica'],
  ['2.2.1 objetivos sst', 'gestion-integral.objetivos'],
  ['2.3.1 evaluacion inicial del sg-sst', 'gestion-integral.plan-trabajo'],
  ['2.4.1 plan de trabajo anual', 'gestion-integral.plan-trabajo'],
  ['2.5.1 archivo y retencion documental del sg-sst', 'gestion-integral.archivo-retencion'],
  ['2.6.1 rendicion de cuentas', 'gestion-integral.rendicion'],
  ['2.7.1 matriz de requisitos legales', 'gestion-integral.plan-trabajo'],
  ['2.8.1 mecanismos de comunicaciones', 'gestion-integral.plan-trabajo'],
  ['2.9.1 identificacion y evaluacion para la adquisicion de bienes y servicios', 'gestion-integral.plan-trabajo'],
  ['2.10.1 evaluacion y seleccion de proveedores y contratistas', 'gestion-integral.plan-trabajo'],
  ['2.11.1 gestion del cambio', 'gestion-integral.plan-trabajo'],
  ['2.12.1 equipos y herramientas', 'gestion-integral.plan-trabajo'],
  ['2.13.1 elementos de proteccion personal', 'gestion-integral.plan-trabajo'],
  ['3.1.1 descripcion sociodemografica y diagnostico de condiciones de salud', 'salud.sociodemografica'],
  ['3.1.2 actividades de medicina y preventiva y promocion de la salud', 'salud.sociodemografica'],
  ['3.1.3 perfil de cargo y profesiograma', 'salud.sociodemografica'],
  ['3.1.4 evaluaciones medicas', 'salud.evaluaciones-medicas'],
  ['3.1.5 custodia medica ocupacional', 'salud.sociodemografica'],
  ['3.1.6 restricciones y recomendaciones medicas', 'salud.restricciones-medicas'],
  ['3.1.7 estilos de vida saludables', 'salud.sociodemografica'],
  ['3.1.8 servicios de higiene', 'salud.sociodemografica'],
  ['3.1.9 manejo de residuos', 'salud.sociodemografica'],
  ['3.2.1 reporte de los accidentes de trabajo', 'salud.reportes-accidentes'],
  ['3.2.2 investigacion de accidentes, indicentes y enfermedades', 'salud.investigacion-accidentes'],
  ['3.2.3 registro y analisis estadistico de indicentes, accidentes de trabajo y enfermedades', 'salud.registro-estadistico'],
  ['3.3.1 frecuencia de la accidentalidad', 'salud.sociodemografica'],
  ['3.3.2 severidad de la accidentalidad', 'salud.sociodemografica'],
  ['3.3.3 proporcion de accidentes de trabajo mortales', 'salud.sociodemografica'],
  ['3.3.4 medicion de la prevalencia de enfermedades laborales', 'salud.sociodemografica'],
  ['3.3.5 medicion de la incidencia de enfermedades laborales', 'salud.sociodemografica'],
  ['3.3.6 medicion del ausentismo por causa medica', 'salud.ausentismo'],
  ['4.1.1 metodologia ipevr', 'gestion-peligros.general'],
  ['4.1.2 identificacion de peligros', 'gestion-peligros.general'],
  ['4.1.3 identificacion de sustancias quimicas carcinogenas o con toxicidad', 'gestion-peligros.general'],
  ['4.1.4 mediciones ambientales', 'gestion-peligros.general'],
  ['4.2.1 mediciones de prevencion y control frente a peligros, riesgos identificados', 'gestion-peligros.general'],
  ['4.2.2 aplicacion de las medidas de prevencion y control por parte de los trabajadores', 'gestion-peligros.general'],
  ['4.2.3 evaluacion de procedimientos, instructivos internos de seguridad y salud en el trabajo', 'gestion-peligros.general'],
  ['4.2.4 realizacion de inspecciones sistematicas a las instalaciones, maquinas o equipos', 'gestion-peligros.general'],
  ['4.2.5 mantenimiento periodico de equipos, instalaciones herramientas', 'gestion-peligros.general'],
  ['4.2.6 entrega de epp', 'gestion-peligros.general'],
  ['5.1.1 plan de prevencion de emergencias', 'gestion-amenazas.general'],
  ['5.1.2 examenes medicos brigadista', 'gestion-amenazas.general'],
  ['6.1.1 definicion de indicadores', 'verificacion.general'],
  ['6.1.2 auditoria anual', 'verificacion.general'],
  ['6.1.3 revision de la alta direccion', 'verificacion.general'],
  ['6.1.4 planificacion de la auditoria', 'verificacion.general'],
  ['7.1.1 acciones preventivas y correctivas', 'mejoramiento.general'],
  /* F21.49 (2026-06-21) — 7.1.2 / 7.1.3 / 7.1.4 ya no son submódulos activos de Mejoramiento */
]);

function getResourceForSubmodule(moduleName, submoduleName) {
  const key = normalizeTextKey(submoduleName);
  const mapped = SUBMODULE_PERMISSION_MAP_UI.get(key);
  if (mapped) return mapped;
  const moduleKey = normalizeTextKey(moduleName);
  if (moduleKey.includes('peligros')) return 'gestion-peligros.general';
  if (moduleKey.includes('amenazas')) return 'gestion-amenazas.general';
  if (moduleKey.includes('verificacion')) return 'verificacion.general';
  if (moduleKey.includes('mejoramiento')) return 'mejoramiento.general';
  return null;
}

const ROLE_UI_RULES = {
  administrador: { allowAll: true },
  'administrador del sistema': { allowAll: true },
  sst: { allowAll: true },
  gerencia: {
    allow: ['gestion-integral.*', 'verificacion.*', 'mejoramiento.*']
  },
  'recursos humanos': {
    allow: [
      'recursos.afiliacion',
      'recursos.capacitaciones',
      'recursos.inducciones',
      'salud.evaluaciones-medicas',
      'salud.restricciones-medicas',
      'salud.ausentismo'
    ]
  }
};

function roleAllowsResource(roleName, resource) {
  const roleKey = normalizeRoleKey(roleName);
  const rule = ROLE_UI_RULES[roleKey];
  if (!rule) return false;
  if (rule.allowAll) return true;
  const allow = rule.allow || [];
  return allow.some(pattern => {
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return resource.startsWith(prefix + '.');
    }
    return resource === pattern;
  });
}

function isSubmoduleAllowed(roleName, moduleName, submoduleName) {
  const resource = getResourceForSubmodule(moduleName, submoduleName);
  if (!resource) return false;
  return roleAllowsResource(roleName, resource);
}

function filterModulesByPermissions(modules, roleName) {
  const roleKey = normalizeRoleKey(roleName);
  if (ROLE_UI_RULES[roleKey] && ROLE_UI_RULES[roleKey].allowAll) return modules;
  const filtered = {};
  for (const [moduleName, submodules] of Object.entries(modules)) {
    const allowedSubs = submodules.filter(sub => isSubmoduleAllowed(roleName, moduleName, sub));
    if (allowedSubs.length > 0) {
      filtered[moduleName] = allowedSubs;
    }
  }
  return filtered;
}

// Botones de selección de empresa
const COMPANY_BUTTONS = ["Tempoactiva", "Temposum", "Aseplus", "Asel"];

const COMPANY_LOGOS = {
  "Tempoactiva": "assets/Tempoactiva.png",
  "Temposum": "assets/Temposum.png",
  "Aseplus": "assets/Aseplus.png",
  "Asel": "assets/Asel.png"
};

// --- Sistema Normativo ---
let normativaData = null;

// Cargar la normativa desde el archivo JSON
async function cargarNormativa() {
  try {
    // Usar la API de Electron para cargar el archivo JSON
    normativaData = await window.electronAPI.loadNormativa();
    console.log('Normativa cargada correctamente:', normativaData);
  } catch (error) {
    console.error('Error al cargar la normativa:', error);
    // En caso de error, usar una estructura vacía o valores por defecto
    normativaData = {
      escenarios: {}
    };
  }
}

// Función para determinar el escenario normativo basado en los datos de la empresa
function determinarEscenarioNormativo(empresa) {
  const { employees: numeroTrabajadores, risk: nivelRiesgo, isAgropecuaria = false } = empresa.stats || {};

  // Validar entradas
  if (typeof numeroTrabajadores !== 'number' || !nivelRiesgo) {
    console.warn('Datos insuficientes para determinar escenario normativo:', empresa);
    return 'COMPLETO_CAP_III'; // Escenario por defecto
  }

  // Verificar que normativaData esté disponible
  if (!normativaData || !normativaData.escenarios) {
    console.warn('Normativa no disponible o con formato incorrecto:', normativaData);
    return 'COMPLETO_CAP_III'; // Escenario por defecto
  }

  // Buscar escenario en la normativa
  for (const [nombreEscenario, escenario] of Object.entries(normativaData.escenarios)) {
    const { condiciones } = escenario;

    // Verificar condiciones de trabajadores
    const cumpleTrabajadores =
      (!condiciones.trabajadores_min || numeroTrabajadores >= condiciones.trabajadores_min) &&
      (!condiciones.trabajadores_max || numeroTrabajadores <= condiciones.trabajadores_max);

    // Verificar condiciones de riesgo
    const cumpleRiesgo = !condiciones.riesgo || condiciones.riesgo.includes(nivelRiesgo);

    // Verificar si aplica a empresas agropecuarias
    const aplicaAgropecuaria = !condiciones.es_agropecuaria || condiciones.es_agropecuaria === isAgropecuaria;

    // Verificar condiciones adicionales
    let cumpleAdicional = true;
    if (condiciones.aplica_si) {
      // Lógica para condiciones complejas
      cumpleAdicional = evaluarCondicionAdicional(condiciones.aplica_si, numeroTrabajadores, nivelRiesgo, isAgropecuaria);
    }

    if (cumpleTrabajadores && cumpleRiesgo && aplicaAgropecuaria && cumpleAdicional) {
      console.log(`Escenario determinado para ${empresa.nombre}: ${nombreEscenario}`);
      return nombreEscenario;
    }
  }

  // Si no se encuentra un escenario específico, usar uno por defecto
  console.warn(`No se encontró un escenario específico para la empresa: ${empresa.nombre}. Trabajadores: ${numeroTrabajadores}, Riesgo: ${nivelRiesgo}, Agropecuaria: ${isAgropecuaria}`);
  return 'COMPLETO_CAP_III'; // Escenario por defecto más completo
}

// Función auxiliar para evaluar condiciones adicionales complejas
function evaluarCondicionAdicional(condiciones, numeroTrabajadores, nivelRiesgo, isAgropecuaria) {
  // Evaluar cada condición en el array
  for (const cond of condiciones) {
    if (cond.includes('trabajadores > 50')) {
      if (numeroTrabajadores > 50) return true;
    } else if (cond.includes('trabajadores <= 50 y riesgo in [IV,V]')) {
      if (numeroTrabajadores <= 50 && ['IV', 'V'].includes(nivelRiesgo)) {
        return true;
      }
    } else if (cond.includes('es_agropecuaria')) {
      if (isAgropecuaria) return true;
    }
  }
  return false;
}

// Función para filtrar módulos y submódulos según el escenario normativo
function filtrarModulosPorNormativa(escenario) {
  if (!normativaData || !escenario || !normativaData.escenarios[escenario]) {
    console.warn('No se encontró escenario normativo válido:', escenario);
    // Devolver todos los módulos si no hay normativa
    return ALL_SUBMODULES;
  }

  const reglas = normativaData.escenarios[escenario];
  const { modulos, submodulos } = reglas;

  // Filtrar módulos activos
  const modulosActivos = modulos.activar || [];
  const modulosDesactivados = modulos.desactivar || [];

  // Filtrar submódulos activos
  const submodulosActivos = submodulos.activar || [];
  const submodulosDesactivados = submodulos.desactivar || [];

  // Crear objeto con módulos filtrados
  const modulosFiltrados = {};

  for (const [moduloNombre, submodulosArray] of Object.entries(ALL_SUBMODULES)) {
    // Extraer número del módulo del nombre (por ejemplo, "Recursos" -> 1, "Gestión Integral" -> 2, etc.)
    let moduloNumero = null;

    // Mapeo de nombres de módulos a números
    const moduloNombresANumeros = {
      "Recursos": 1,
      "Gestión Integral": 2,
      "Gestión de la Salud": 3,
      "Gestión de Peligros y Riesgos": 4,
      "Gestión de Amenazas": 5,
      "Verificación": 6,
      "Mejoramiento": 7
    };

    // Buscar el número correspondiente al nombre del módulo
    if (moduloNombresANumeros[moduloNombre]) {
      moduloNumero = moduloNombresANumeros[moduloNombre];
    } else {
      // Si no se encuentra un mapeo directo, intentar con una búsqueda parcial
      for (const [nombre, num] of Object.entries(moduloNombresANumeros)) {
        if (moduloNombre.includes(nombre) || moduloNombre.startsWith(nombre.split(' ')[0])) {
          moduloNumero = num;
          break;
        }
      }
    }

    // Si no se encontró un número de módulo, asumir que no está activo
    if (moduloNumero === null) {
      continue;
    }

    const moduloActivo = modulosActivos.includes(moduloNumero) && !modulosDesactivados.includes(moduloNumero);

    if (moduloActivo) {
      // Filtrar submódulos para este módulo
      const submodulosFiltrados = submodulosArray.filter(submodulo => {
        // Extraer código del submódulo (ej. "1.1.1" de "1.1.1 Responsable del SG")
        const codigoSubmodulo = submodulo.split(' ')[0];

        // Verificar si está en la lista de activos o desactivados
        const activo = submodulosActivos.some(pattern => {
          if (pattern === '*') return true; // Activar todos
          if (pattern.endsWith('*')) {
            // Patrón de wildcard (ej. "3.3.*")
            const prefix = pattern.slice(0, -1);
            return codigoSubmodulo.startsWith(prefix);
          }
          return pattern === codigoSubmodulo;
        });

        const desactivado = submodulosDesactivados.some(pattern => {
          if (pattern === '*') return true; // Desactivar todos
          if (pattern.endsWith('*')) {
            // Patrón de wildcard (ej. "3.3.*")
            const prefix = pattern.slice(0, -1);
            return codigoSubmodulo.startsWith(prefix);
          }
          return pattern === codigoSubmodulo;
        });

        // El submódulo está activo si está en activos y no en desactivados
        return activo && !desactivado;
      });

      // Solo agregar el módulo si tiene submódulos activos
      if (submodulosFiltrados.length > 0) {
        modulosFiltrados[moduloNombre] = submodulosFiltrados;
      }
    }
  }

  return modulosFiltrados;
}

// --- Estado de la Aplicación ---
let currentCompany = null;
let currentModule = null;
let currentSubmodule = null; // ✅ NUEVA VARIABLE
// --- Auth & Sesión ---
let authToken = null;
let currentUser = null;
let assignedCompanies = [];
let companyRoleByKey = {};
const AUTH_TOKEN_KEY = 'kair-auth-token';
const LOG_BUFFER_MAX_SIZE = 500; // Límite para evitar memory leak en sesiones largas
let logBuffer = []; // Búfer para almacenar los logs
let logTextareaCached = null; // Cache del textarea para evitar querySelector en cada log
let currentCalendarInstance = null; // Para mantener una referencia a la instancia del calendario
let currentActiveComponent = null; // Para mantener una referencia al componente activo y poder destruirlo adecuadamente

// 📦507 — Cuando el usuario actualiza el programa anual de inspecciones
// (cambia una P/C, agrega actividad, etc.) el bridge emite
// 'inspeccion:programa:actualizado'. Si el calendario está visible lo
// recargamos para que muestre los cambios sin tener que cerrarlo y abrirlo.
if (window.electronAPI && window.electronAPI.inspeccionPrograma && typeof window.electronAPI.inspeccionPrograma.onProgramaActualizado === 'function') {
  window.electronAPI.inspeccionPrograma.onProgramaActualizado(function (payload) {
    if (currentCalendarInstance && typeof currentCalendarInstance.refresh === 'function') {
      console.log('[INSP-CAL][PROGRAMA_ACTUALIZADO] Recargando calendario...', payload);
      currentCalendarInstance.refresh();
    }
  });
}

// 📦509 — Mismo patrón para mantenimiento: cuando el usuario cambia una celda
// MPP/MPE/MPC en el cronograma, el bridge emite 'mantenimiento:programa:actualizado'.
// El calendario recarga si está visible. Log: [MANT-CAL][PROGRAMA_ACTUALIZADO].
if (window.electronAPI && window.electronAPI.mantenimiento && typeof window.electronAPI.mantenimiento.onProgramaActualizado === 'function') {
  window.electronAPI.mantenimiento.onProgramaActualizado(function (payload) {
    if (currentCalendarInstance && typeof currentCalendarInstance.refresh === 'function') {
      console.log('[MANT-CAL][PROGRAMA_ACTUALIZADO] Recargando calendario...', payload);
      currentCalendarInstance.refresh();
    }
  });
}

// Variable para almacenar los submódulos filtrados por normativa
let RESOURCES_SUBMODULES = ALL_SUBMODULES;

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
        // Mensaje eliminado: No se encontraron contenedores de calendario para eliminar.
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

  // Guardar en búfer con eviction FIFO para evitar memory leak
  logBuffer.push(formattedMessage);
  if (logBuffer.length > LOG_BUFFER_MAX_SIZE) {
    logBuffer.splice(0, logBuffer.length - LOG_BUFFER_MAX_SIZE);
  }

  // Solo actualizar el DOM si el textarea ya fue cacheado Y está visible.
  // Evita querySelector + re-render completo en cada log cuando el panel no está abierto.
  if (!logTextareaCached) {
    logTextareaCached = document.querySelector('.log-area textarea');
  }
  if (logTextareaCached && logTextareaCached.offsetParent !== null) {
    logTextareaCached.value = logBuffer.join('\n');
    logTextareaCached.scrollTop = logTextareaCached.scrollHeight;
  }
}

// --- Elementos del DOM ---
let contentArea;
let sidebarMenu;
let companyNameElement;
let companyLogoElement;
let companyLogoPlaceholder;
let companyHomeButton;
let headerCompanyNameElement;
let headerCompanyLabel;

// Función para aplicar el tema globalmente
async function applyGlobalTheme() {
  let savedTheme = 'system';

  try {
    if (window.electronAPI && window.electronAPI.getThemePreference) {
      const result = await window.electronAPI.getThemePreference();
      savedTheme = result.theme || 'system';
      console.log('[Theme] Preferencia cargada desde config.json:', savedTheme);
    } else {
      savedTheme = localStorage.getItem('kair-theme-preference') || 'system';
      console.log('[Theme] Preferencia cargada desde localStorage:', savedTheme);
    }
  } catch (e) {
    console.warn('[Theme] Error cargando preferencia, usando fallback:', e);
    savedTheme = localStorage.getItem('kair-theme-preference') || 'system';
  }

  console.log('[Theme] Aplicando tema con preferencia:', savedTheme);

  // Aplicar tema según la preferencia guardada (NO según el tema efectivo)
  if (savedTheme === 'dark') {
    // Tema Oscuro (Paleta Negro/Gris) - siempre usa dark-legacy
    document.documentElement.setAttribute('data-theme', 'dark-legacy');
    console.log('[Theme] Tema aplicado: dark-legacy');
  } else if (savedTheme === 'system') {
    // Tema Sistema - usa 'dark' o ninguno según el sistema
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      console.log('[Theme] Tema aplicado: dark (system)');
    } else {
      document.documentElement.removeAttribute('data-theme');
      console.log('[Theme] Tema aplicado: light (system)');
    }
  } else {
    // Tema Claro - siempre sin atributo
    document.documentElement.removeAttribute('data-theme');
    console.log('[Theme] Tema aplicado: light');
  }

  // Sincronizar localStorage con la preferencia
  localStorage.setItem('kair-theme-preference', savedTheme);

  // Retornar el tema efectivo (para referencia)
  const effectiveTheme = savedTheme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : savedTheme;
  
  console.log('[Theme] Tema efectivo:', effectiveTheme);
  return effectiveTheme;
}

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

  // Aplicar el tema global al cargar la aplicación
  await applyGlobalTheme();
  
// Escuchar cambios de tema del sistema
  if (window.electronAPI && window.electronAPI.onSystemThemeChanged) {
    window.electronAPI.onSystemThemeChanged(async (systemTheme) => {
      console.log('[Renderer] System theme changed:', systemTheme);
      const savedTheme = localStorage.getItem('kair-theme-preference') || 'system';
      if (savedTheme === 'system') {
        if (systemTheme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
        console.log('[Renderer] Tema del sistema aplicado:', systemTheme);
      } else if (savedTheme === 'dark') {
        // Mantener tema Oscuro independientemente del sistema
        if (systemTheme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark-legacy');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
        console.log('[Renderer] Tema Oscuro (dark-legacy) mantenido');
      }
    });
  }

  // Obtener referencias a los elementos del DOM
  contentArea = document.getElementById('content-area');
  sidebarMenu = document.getElementById('sidebar-menu');
  companyNameElement = document.getElementById('company-name');
  companyLogoElement = document.getElementById('company-logo');
  companyLogoPlaceholder = document.getElementById('company-logo-placeholder');
  companyHomeButton = document.getElementById('company-home-button');
  headerCompanyNameElement = document.getElementById('header-company-name');
  headerCompanyLabel = document.getElementById('header-company-label');

  console.log('DOM elements found:', { contentArea, sidebarMenu, companyNameElement, companyLogoElement, companyLogoPlaceholder, companyHomeButton });

  // 📦563/572 — Bandeja Integrada (Correo + Calendario) — entry point ÚNICO
  // (reemplaza al calendar-button retirado en 📦572).
  // Click en el botón → abre un iframe fullscreen con renderer/bandeja-integrada/index.html.
  // Click en "Volver" del iframe → envía postMessage('bandeja-integrada-back') y el iframe se cierra.
  const bandejaIntegradaButton = document.getElementById('bandeja-integrada-button');
  let bandejaIntegradaFrame = null;

  // F4/573 — Badge de alertas (KairAlerts) ahora apunta al #bandeja-integrada-badge
  // (antes apuntaba al #kair-cal-badge del calendar-button retirado en 📦572).
  // Se suscribe a onCountChange y actualiza el badge del botón de Bandeja Integrada.
  function updateBandejaIntegradaBadge(count) {
    var badge = document.getElementById('bandeja-integrada-badge');
    if (!badge) return;
    if (count <= 0) {
      badge.hidden = true;
      badge.textContent = '0';
      badge.setAttribute('aria-label', 'Sin eventos pendientes');
    } else if (count >= 100) {
      badge.hidden = false;
      badge.textContent = '99+';
      badge.setAttribute('aria-label', 'Más de 99 eventos pendientes');
    } else {
      badge.hidden = false;
      badge.textContent = String(count);
      badge.setAttribute('aria-label', count + ' evento' + (count === 1 ? '' : 's') + ' pendiente' + (count === 1 ? '' : 's'));
    }
  }

  // F4-fix — Handler del badge: al hacer click, abre el popover de "Pendientes"
  // (mismo patrón que el calendario viejo). Usa stopPropagation para que el
  // click NO se propague al botón padre (que abriría el iframe de Bandeja Integrada).
  function onBandejaIntegradaBadgeClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    showBandejaIntegradaPendientesPopover();
  }

  // F4-fix — Popover de pendientes (idéntico patrón al de KairAlerts en el
  // calendario viejo: lista de eventos vencidos o que vencen hoy, con
  // categoría color, días vencidos, botón "Ver detalle" y "Abrir calendario
  // completo" abajo).
  // F4-fix: colorMap a nivel de módulo (accesible desde el handler de Ver detalle)
  var BANDEJA_INTEGRADA_COLOR_MAP = {
    plan: '#174ea6', capacitacion: '#28a745', auditoria: '#b8860b',
    actualizacion: '#6c757d', formacion: '#185abd', critico: '#dc3545',
    rapido: '#0d6efd', gestacion: '#d63384',
    mantenimiento_programado: '#fd7e14', inspeccion: '#198754',
    recordatorio_copasst: '#dc3545', recordatorio_convivencia: '#0891b2',
    recordatorio_presupuesto: '#10b981', recordatorio_afiliacion: '#f59e0b',
    recordatorio_inducciones: '#6366f1'
  };

  function showBandejaIntegradaPendientesPopover() {
    // Cerrar si ya está abierto
    var existing = document.getElementById('bandeja-integrada-pendientes-popover');
    if (existing) { existing.remove(); return; }

    // Obtener pendientes del API de KairAlerts
    var pending = (window.KairAlerts && window.KairAlerts.getPendingEvents)
      ? window.KairAlerts.getPendingEvents()
      : [];

    var pop = document.createElement('div');
    pop.id = 'bandeja-integrada-pendientes-popover';
    pop.className = 'kair-pendientes-popover';
    pop.innerHTML = `
      <div class="kair-pendientes-popover__header">
        <span>Pendientes <span class="kair-pendientes-popover__count">${pending.length}</span></span>
        <button class="kair-pendientes-popover__close" data-action="close" aria-label="Cerrar">×</button>
      </div>
      <div class="kair-pendientes-popover__list" id="bandeja-pendientes-list"></div>
      <div class="kair-pendientes-popover__footer">
        <button class="kair-pendientes-popover__btn" data-action="open">Abrir calendario completo</button>
      </div>
    `;
    document.body.appendChild(pop);

    // Posicionar cerca del botón de Bandeja Integrada
    var btn = document.getElementById('bandeja-integrada-button');
    if (btn) {
      var rect = btn.getBoundingClientRect();
      pop.style.position = 'fixed';
      pop.style.top = (rect.bottom + 8) + 'px';
      pop.style.right = (window.innerWidth - rect.right) + 'px';
      pop.style.zIndex = '250000';
    }

    // Renderizar items
    var list = pop.querySelector('#bandeja-pendientes-list');
    if (pending.length === 0) {
      list.innerHTML = '<div class="kair-pendientes-popover__empty">No hay eventos pendientes 🎉</div>';
    } else {
      pending.forEach(function (ev) {
        var item = document.createElement('div');
        item.className = 'kair-pendientes-popover__item';
        // Categoría color
        // F4-fix: usar BANDEJA_INTEGRADA_COLOR_MAP (declarado a nivel de módulo)
        var color = BANDEJA_INTEGRADA_COLOR_MAP[ev.type || ev.category] || '#6c757d';
        var catLabel = (ev.type || ev.category || '').toUpperCase();
        var dateStr = ev.date || '';
        // Calcular días vencidos
        var diasVencidos = '';
        if (dateStr) {
          var d = new Date(dateStr + 'T00:00:00');
          var hoy = new Date(); hoy.setHours(0,0,0,0);
          var diff = Math.floor((hoy - d) / 86400000);
          if (diff === 0) diasVencidos = 'Vence hoy';
          else if (diff > 0) diasVencidos = 'Vencida · hace ' + diff + ' días';
          else diasVencidos = 'En ' + (-diff) + ' días';
        }
        item.innerHTML = `
          <div class="kair-pendientes-popover__item-header">
            <span class="kair-pendientes-popover__cat" style="color:${color};">${catLabel}</span>
            <span class="kair-pendientes-popover__dias">${diasVencidos}</span>
          </div>
          <div class="kair-pendientes-popover__title">${(ev.title || '(sin título)').replace(/</g, '&lt;')}</div>
          <div class="kair-pendientes-popover__meta">${dateStr}</div>
          <div class="kair-pendientes-popover__actions">
            <button class="kair-pendientes-popover__btn kair-pendientes-popover__btn--primary" data-action="open-event" data-event-id="${ev.id || ''}">Ver detalle</button>
          </div>
        `;
        list.appendChild(item);
      });
    }

    // Handlers
    pop.querySelector("[data-action='close']").addEventListener('click', function () { pop.remove(); });
    pop.querySelector("[data-action='open']").addEventListener('click', function () { pop.remove(); showBandejaIntegrada(); });
    pop.querySelectorAll("[data-action='open-event']").forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        // F4-fix: stopPropagation para que el click NO cierre el popover por el
        // listener de "click fuera" antes de que el modal se abra
        if (e) { e.preventDefault(); e.stopPropagation(); }
        var eventId = btn.getAttribute('data-event-id');
        // F4-fix: abrir modal de detalle con la info del evento seleccionado
        var ev = pending.find(function (x) { return x.id === eventId; });
        if (ev) {
          pop.remove();
          try {
            // F4-fix: usar BANDEJA_INTEGRADA_COLOR_MAP (definido a nivel de módulo)
            openBandejaIntegradaEventDetailModal(ev, BANDEJA_INTEGRADA_COLOR_MAP);
          } catch (err) {
            console.error('[BandejaIntegrada] Error abriendo modal de detalle:', err);
            // Fallback: alert nativo para que al menos se vea algo
            alert('Detalle del evento:\n\n' +
              'Tipo: ' + (ev.type || ev.category || '—') + '\n' +
              'Título: ' + (ev.title || '(sin título)') + '\n' +
              'Fecha: ' + (ev.date || '—'));
          }
        } else {
          console.warn('[BandejaIntegrada] No se encontró evento con id=' + eventId);
          pop.remove();
        }
      });
    });
    // Cerrar al hacer click fuera
    setTimeout(function () {
      var onOutsideClick = function (ev) {
        if (!pop.contains(ev.target) && ev.target.id !== 'bandeja-integrada-badge') {
          pop.remove();
          document.removeEventListener('click', onOutsideClick);
        }
      };
      document.addEventListener('click', onOutsideClick);
    }, 0);
  }

  // F4-fix — Modal de detalle de un evento desde el popover de pendientes
  // (en el main app, NO en el iframe). Muestra la info del evento + acciones.
  function openBandejaIntegradaEventDetailModal(ev, colorMap) {
    console.log('[BandejaIntegrada] Abriendo modal de detalle:', {
      id: ev && ev.id,
      type: ev && (ev.type || ev.category),
      title: ev && ev.title,
      date: ev && ev.date,
      hasColorMap: !!colorMap,
      colorMapKeys: colorMap ? Object.keys(colorMap).length : 0
    });
    var existing = document.getElementById('bandeja-integrada-event-detail-modal');
    if (existing) existing.remove();

    var color = (colorMap && colorMap[ev.type || ev.category]) || '#6c757d';
    var catLabel = (ev.type || ev.category || '').toUpperCase();
    var dateStr = ev.date || '—';
    var timeStr = (ev.start || '') + (ev.end ? ' - ' + ev.end : '');
    var locationStr = ev.location || '';
    var titleStr = ev.title || '(sin título)';

    // Días vencidos
    var diasVencidos = '';
    if (ev.date) {
      var d = new Date(ev.date + 'T00:00:00');
      var hoy = new Date(); hoy.setHours(0,0,0,0);
      var diff = Math.floor((hoy - d) / 86400000);
      if (diff === 0) diasVencidos = 'Vence hoy';
      else if (diff > 0) diasVencidos = 'Vencida · hace ' + diff + ' días';
      else diasVencidos = 'En ' + (-diff) + ' días';
    }

    var modal = document.createElement('div');
    modal.id = 'bandeja-integrada-event-detail-modal';
    modal.className = 'kair-event-modal-overlay';
    modal.innerHTML = `
      <div class="kair-event-modal">
        <div class="kair-event-modal__header" style="border-bottom: 1px solid #e5e7eb; background: #f8fafc;">
          <span class="kair-pendientes-popover__cat" style="color:${color}; font-size: 0.75rem;">${catLabel}</span>
          <button class="kair-event-modal__close" data-action="close" aria-label="Cerrar">×</button>
        </div>
        <div class="kair-event-modal__body">
          <h2 class="kair-event-modal__title">${(titleStr).replace(/</g, '&lt;')}</h2>
          <div class="kair-event-modal__meta">
            <div class="kair-event-modal__meta-row">
              <strong>Fecha:</strong> ${dateStr} ${timeStr ? '· ' + timeStr : ''}
            </div>
            ${diasVencidos ? '<div class="kair-event-modal__meta-row" style="color:#dc3545;"><strong>Estado:</strong> ' + diasVencidos + '</div>' : ''}
            ${locationStr ? '<div class="kair-event-modal__meta-row"><strong>Ubicación:</strong> ' + locationStr.replace(/</g, '&lt;') + '</div>' : ''}
            ${ev.attendees && ev.attendees.length ? '<div class="kair-event-modal__meta-row"><strong>Asistentes:</strong> ' + ev.attendees.length + '</div>' : ''}
            ${ev.description || ev.notes ? '<div class="kair-event-modal__meta-row" style="flex-direction:column;align-items:stretch;"><strong>Notas:</strong><div class="kair-event-modal__description">' + (ev.description || ev.notes).replace(/</g, '&lt;') + '</div></div>' : ''}
          </div>
        </div>
        <div class="kair-event-modal__actions">
          <button class="kair-event-modal__btn kair-event-modal__btn--secondary" data-action="open-calendar">Ir al calendario</button>
          <button class="kair-event-modal__btn kair-event-modal__btn--primary" data-action="mark-done">Marcar cumplido</button>
          <button class="kair-event-modal__btn kair-event-modal__btn--secondary" data-action="close">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';

    var closeModal = function () { modal.remove(); };
    modal.querySelector("[data-action='close']").addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    modal.querySelector("[data-action='open-calendar']").addEventListener('click', function () {
      closeModal();
      showBandejaIntegrada();
    });
    modal.querySelector("[data-action='mark-done']").addEventListener('click', function () {
      // Marcar como cumplido via electronAPI
      if (window.electronAPI && window.electronAPI.eventosCumplidos && ev.id) {
        window.electronAPI.eventosCumplidos.marcar({
          evento_id: ev.id,
          empresaId: (window.currentCompany && window.currentCompany !== 'default_company') ? window.currentCompany : null
        }).then(function (r) {
          if (r && r.success) {
            toast && toast('Marcado como cumplido', titleStr, 'success');
            closeModal();
            // Refrescar KAirAlerts para que el badge se actualice
            if (window.KairAlerts && window.KairAlerts.refresh) window.KairAlerts.refresh();
          } else {
            toast && toast('No se pudo marcar', (r && r.error) || 'Error', 'error');
          }
        });
      } else {
        toast && toast('Marcar cumplido', 'API no disponible', 'info');
        closeModal();
      }
    });
  }

  // Wire-up del badge (separado del handler del botón)
  var bandejaIntegradaBadge = document.getElementById('bandeja-integrada-badge');
  if (bandejaIntegradaBadge) {
    bandejaIntegradaBadge.addEventListener('click', onBandejaIntegradaBadgeClick);
    // Estilo: cursor pointer para indicar que es clickable
    bandejaIntegradaBadge.style.cursor = 'pointer';
  }
  if (typeof window.KairAlerts !== 'undefined' && window.KairAlerts.onCountChange) {
    window.KairAlerts.onCountChange(updateBandejaIntegradaBadge);
  } else {
    // F4 — KairAlerts puede no estar listo aún. Reintentar cuando lo esté.
    var _kairAlertsWait = setInterval(function() {
      if (typeof window.KairAlerts !== 'undefined' && window.KairAlerts.onCountChange) {
        window.KairAlerts.onCountChange(updateBandejaIntegradaBadge);
        clearInterval(_kairAlertsWait);
      }
    }, 500);
  }

  // F4-fix — Toggle del botón Bandeja Integrada: si está abierto, lo cierra.
  // Si está cerrado, lo abre. El botón está en el header de la app principal
  // (visible siempre), así que el user puede usarlo como toggle.
  function toggleBandejaIntegrada() {
    if (bandejaIntegradaFrame && bandejaIntegradaFrame.style.display !== 'none') {
      hideBandejaIntegrada();
    } else {
      showBandejaIntegrada();
    }
  }

  function showBandejaIntegrada() {
    if (bandejaIntegradaFrame) {
      bandejaIntegradaFrame.style.display = 'flex';
      return;
    }
    bandejaIntegradaFrame = document.createElement('iframe');
    bandejaIntegradaFrame.id = 'bandeja-integrada-frame';
    bandejaIntegradaFrame.src = 'renderer/bandeja-integrada/index.html?v=669';
    // F4-fix — Usar el alto REAL del header de la app principal (no un valor fijo)
    // para que el iframe arranque justo donde termina el header, sin solaparlo.
    var mainHeader = document.getElementById('app-header');
    var headerHeight = mainHeader ? Math.max(mainHeader.getBoundingClientRect().height, 40) : 48;
    bandejaIntegradaFrame.style.cssText = [
      'position: fixed',
      'top: ' + headerHeight + 'px',
      'left: 0',
      'width: 100vw',
      'height: calc(100vh - ' + headerHeight + 'px)',
      'border: 0',
      // F1.5-fix2: el #app-header de la app principal tiene z-index 100000
      // con isolation:isolate. El iframe necesita estar por encima de eso,
      // y también por encima de .kair-cal-modal-overlay (200000) por si
      // hay un modal del calendario viejo abierto. Usamos 200001.
      'z-index: 200001',
      'background: #fff',
      'display: block'
    ].join(';');
    document.body.appendChild(bandejaIntegradaFrame);
    logMessage('Bandeja Integrada abierta (iframe creado). Header height: ' + headerHeight + 'px', 'INFO');
  }

  function hideBandejaIntegrada() {
    if (bandejaIntegradaFrame) {
      bandejaIntegradaFrame.style.display = 'none';
      logMessage('Bandeja Integrada cerrada (iframe oculto).', 'INFO');
    }
  }

  // Listener dedicado para mensajes del iframe de Bandeja Integrada.
  // Usa su propio listener (separado del de Iframe Communication Logic de abajo)
  // para que el "back" funcione aunque el iframe genérico tenga filtros.
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'bandeja-integrada-back') {
      hideBandejaIntegrada();
    }
    // F4-fix — El iframe pide abrir Configuración (cuando el user hace click en
    // el indicador Gmail del header, para ir al switch de conectar/desconectar).
    else if (event.data.type === 'bandeja-integrada-open-config') {
      hideBandejaIntegrada();
      // Abrir Configuración. Si el section es "empresas", navegar a esa tab
      if (event.data.section && typeof showSettingsPage === 'function') {
        showSettingsPage(event.data.section);
      } else if (typeof showSettingsPage === 'function') {
        showSettingsPage();
      }
    }
  });

  if (bandejaIntegradaButton) {
    // F4-fix — Toggle: click abre o cierra (como cualquier app de bandeja).
    // Antes solo abría — para cerrar había que hacer click en el botón de
    // "Volver" dentro del iframe (que ahora está oculto porque el header
    // interno del iframe está display:none).
    bandejaIntegradaButton.addEventListener('click', toggleBandejaIntegrada);
  } else {
    console.warn('[BandejaIntegrada] Botón #bandeja-integrada-button no encontrado en el DOM.');
  }

  // --- BEGIN: Iframe Communication Logic ---
  window.addEventListener('message', async (event) => {
      // IMPORTANT: Validate the origin for security
      // For file:// protocol, origin is 'file://'. We also check if the source is a contentWindow of an iframe within our app.
      if (event.origin !== 'file://' || !event.source) {
          return;
      }

      const { type, payload, requestId } = event.data;

      // --- FIX: Guard Clause ---
      // If the message doesn't have a 'type', it's for a different listener (e.g., PresupuestoGestionComponent).
      // This prevents the renderer from trying to handle messages with an 'action' property.
      if (!type) {
        return;
      }

      // Delegar mensajes de EMO al componente evaluaciones-medicas-logic.js
      // El componente ya tiene listeners para estos mensajes
      if (type === 'emo-get-dashboard-data-request' || type === 'emo-get-library-data-request') {
        console.log(`[RENDERER] Delegando mensaje EMO al componente: ${type} - NO procesando en renderer, permitiendo propagación`);
        return; // IMPORTANTE: Este return permite que el evento se propague al componente
      }

      console.log('RENDERER: Message received from iframe:', { type, payload, requestId });

      // Find the iframe that sent the message
      const iframes = document.querySelectorAll('iframe');
      let sourceIframe = null;
      for (const iframe of iframes) {
          if (iframe.contentWindow === event.source) {
              sourceIframe = iframe;
              break;
          }
      }

      // Allow messages from the window itself (for directly injected modules)
      const isFromSelf = event.source === window;

      // DEBUG: Log para verificar el origen del mensaje
      const allIframes = Array.from(iframes).map(iframe => ({
          id: iframe.id,
          src: iframe.src,
          contentWindow: iframe.contentWindow === event.source
      }));
      if (type === 'open-onlyoffice-editor-request') {
          console.log('[DEBUG] Iframes encontrados:', allIframes);
          console.log('[DEBUG] event.source === window:', event.source === window);
      }

      if (!sourceIframe && !isFromSelf) {
          console.warn('RENDERER: Message received from an unknown source. Ignoring.', { type, eventSource: event.source });
          // Intentar enviar a window.parent como fallback
          try {
              if (window.parent && window.parent !== window) {
                  console.log('[DEBUG] Intentando enviar respuesta a window.parent');
                  window.parent.postMessage({
                      type: responseType,
                      payload: { success: false, error: 'Source not found' },
                      requestId: requestId
                  }, '*');
              }
          } catch (e) {
              console.error('[DEBUG] Error enviando a window.parent:', e);
          }
          return;
      }

      // Determine where to send the response back
      const targetWindow = sourceIframe ? sourceIframe.contentWindow : (isFromSelf ? window : null);

      if (!targetWindow) {
          console.error('RENDERER: Could not determine target window for response.');
          return;
      }

      let apiCallFunction;
      let apiCallArgs;
      let responseType = type.replace('-request', '-response');

      // Función auxiliar para decodificar rutas que pueden estar codificadas múltiples veces
      function decodePathMultipleTimes(str) {
          let decoded = str;
          let prev = '';
          while (decoded !== prev) {
              prev = decoded;
              try {
                  decoded = decodeURIComponent(decoded);
              } catch (e) {
                  break;
              }
          }
          return decoded;
      }

      try {
          switch (type) {
              case 'get-document-folders-request':
                  // Lógica simplificada: Llama directamente al manejador unificado del proceso principal.
                  apiCallFunction = window.electronAPI.getDocumentFolders;
                  apiCallArgs = [payload];
                  break;
              case 'get-documents-in-folder-request':
                  // --- SIMPLIFIED LOGIC ---
                  // This now correctly points to a handler that just reads a directory.
                  apiCallFunction = window.electronAPI.getFolderContents;
                  apiCallArgs = [payload]; // payload is the folderPath string
                  break;
              case 'get-pdf-preview-request':
                  apiCallFunction = window.electronAPI.getPDFPreview;
                  apiCallArgs = [payload.filePath]; // Ensure payload is destructured
                  break;
              case 'get-excel-preview-request':
                  apiCallFunction = window.electronAPI.getExcelPreview;
                  apiCallArgs = [payload.filePath]; // Ensure payload is destructured
                  break;
              case 'get-word-preview-request':
                  apiCallFunction = window.electronAPI.getWordPreview;
                  apiCallArgs = [payload.filePath]; // Ensure payload is destructured
                  break;
              case 'download-document-request':
                  apiCallFunction = window.electronAPI.downloadDocument;
                  apiCallArgs = [payload];
                  break;
              case 'upload-document-request':
                  apiCallFunction = window.electronAPI.uploadDocument;
                  apiCallArgs = [payload];
                  break;
              case 'delete-document-request':
                  apiCallFunction = window.electronAPI.deleteDocument;
                  apiCallArgs = [payload.filePath];
                  break;
              case 'open-file-request':
                  apiCallFunction = window.electronAPI.openFile;
                  apiCallArgs = [payload.filePath];
                  break;
              case 'get-editable-content-request':
                  // Manejar solicitud de contenido editable para documentos
                  // Usar la función decodePathMultipleTimes definida fuera del switch
                  const decodedPayloadEd = {
                      ...payload,
                      filePath: payload.filePath ? decodePathMultipleTimes(payload.filePath) : payload.filePath
                  };
                  apiCallFunction = window.electronAPI.getEditableContent;
                  apiCallArgs = [decodedPayloadEd];
                  break;
              case 'save-edited-document-request':
                  // Manejar guardado de documento editado
                  // Usar la función decodePathMultipleTimes definida fuera del switch
                  const savePayloadEd = {
                      ...payload,
                      filePath: payload.filePath ? decodePathMultipleTimes(payload.filePath) : payload.filePath,
                      content: payload.content
                  };
                  apiCallFunction = window.electronAPI.saveEditedDocument;
                  apiCallArgs = [savePayloadEd];
                  break;
              case 'back-to-main-app':
                  // Volver al home principal
                  showHomePage();
                  return;
      case 'back-to-module-request':
        if (window.copasstPortalComponent) {
          console.log('[RENDERER] Delegando back-to-module al portal COPASST');
          return;
        }
        if (window.comiteConvivenciaPortalComponent) {
          console.log('[RENDERER] Delegando back-to-module al portal Comité de Convivencia');
          return;
        }
            if (window.planPortalComponent) {
              console.log('[RENDERER] Delegando back-to-module al portal Plan de Trabajo');
              window.planPortalComponent.goBackToHome();
              return;
            }
            // Volver al módulo actual
            console.log('RENDERER: Received back-to-module-request from iframe.');
            if (typeof currentModule !== 'undefined' && currentModule) {
          currentSubmodule = null;
          showModuleContent(currentModule);
        } else {
          showHomePage();
        }
        return;
              case 'back-to-submodule-home':
                  // Volver al home del submódulo actual (Evaluaciones Médicas 3.1.4)
                  console.log('RENDERER: Received back-to-submodule-home from iframe.');
                  if (typeof currentSubmodule !== 'undefined' && currentSubmodule) {
                      showSubmoduleContent(currentSubmodule);
                  } else if (typeof currentModule !== 'undefined' && currentModule) {
                      showModuleContent(currentModule);
                  } else {
                      showHomePage();
                  }
                  return;
              case 'load-module-view':
                  // Cargar una vista de módulo específica (ej: informe-pri-builder)
                  console.log('RENDERER: Received load-module-view request:', payload);
                  const viewPath = payload.path || payload.view;
                  if (viewPath) {
                      loadModuleViewInContentArea(viewPath);
                  }
                  return;
              case 'theme-preference-changed':
                  // El usuario cambió el tema desde el iframe de configuración
                  const themeMode = event.data.theme || payload;
                  console.log('RENDERER: Theme preference changed to:', themeMode);

                  // Aplicar tema inmediatamente
                  if (themeMode === 'dark') {
                      document.documentElement.setAttribute('data-theme', 'dark-legacy');
                  } else if (themeMode === 'light') {
                      document.documentElement.removeAttribute('data-theme');
                  } else if (themeMode === 'system') {
                      // Aplicar tema del sistema
                      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                      if (isDark) {
                          document.documentElement.setAttribute('data-theme', 'dark');
                      } else {
                          document.documentElement.removeAttribute('data-theme');
                      }
                  }

                  // Guardar preferencia
                  localStorage.setItem('kair-theme-preference', themeMode);

                  // Forzar actualización en todos los iframes
                  const iframes = document.querySelectorAll('iframe');
                  iframes.forEach(iframe => {
                      try {
                          const effectiveTheme = themeMode === 'system' ?
                              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') :
                              themeMode;

                          if (iframe.contentDocument) {
                              if (effectiveTheme === 'dark') {
                                  if (themeMode === 'dark') {
                                      iframe.contentDocument.documentElement.setAttribute('data-theme', 'dark-legacy');
                                  } else if (themeMode === 'system') {
                                      iframe.contentDocument.documentElement.setAttribute('data-theme', 'dark');
                                  }
                              } else {
                                  iframe.contentDocument.documentElement.removeAttribute('data-theme');
                              }
                          }

                          iframe.contentWindow?.postMessage({
                              type: 'theme-changed',
                              theme: themeMode,
                              effectiveTheme: effectiveTheme
                          }, '*');
                      } catch (e) {
                          console.warn('Error propagando tema a iframe:', e);
                      }
                  });

                  console.log('Tema aplicado:', themeMode, '(efectivo:', (themeMode === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : themeMode) + ')');

                  // Forzar actualización en módulos home activos
                  if (typeof currentModule !== 'undefined' && currentModule) {
                      console.log('Actualizando tema en módulo activo:', currentModule);
                      // Recargar el módulo para aplicar el nuevo tema
                      setTimeout(() => {
                          showModuleContent(currentModule);
                      }, 100);
                  }

                  return;
              case 'GET_AUSENTISMO_DATA':
                  // Handle request to get absenteeism data
                  apiCallFunction = window.electronAPI.readAusentismoData;
                  apiCallArgs = [currentCompany]; // Use current company for the request
                  break;
              case 'find-submodule-path-request':
                  apiCallFunction = window.electronAPI.findSubmodulePath;
                  apiCallArgs = [payload.company, payload.module, payload.submodule];
                  break;
              case 'read-directory-request':
                  apiCallFunction = window.electronAPI.readDirectory;
                  apiCallArgs = [payload.path];
                  break;
              case 'get-capacitaciones-sheets-request':
                  apiCallFunction = window.electronAPI.getCapacitacionesSheets;
                  apiCallArgs = [payload.filePath];
                  break;
              case 'duplicate-capacitaciones-sheet-request':
                  apiCallFunction = window.electronAPI.duplicateCapacitacionesSheet;
                  apiCallArgs = [payload];
                  break;
              case 'read-excel-file-request':
                  apiCallFunction = window.electronAPI.readExcelFile;
                  apiCallArgs = [payload.filePath];
                  break;
              case 'save-excel-data-request':
                  apiCallFunction = window.electronAPI.saveExcelData;
                  apiCallArgs = [payload];
                  break;
              case 'get-file-path-request':
                  apiCallFunction = window.electronAPI.getFilePath;
                  apiCallArgs = [payload];
                  break;
              case 'process-excel-data-request':
                  apiCallFunction = window.electronAPI.processExcelData;
                  apiCallArgs = [payload];
                  break;
      case 'update-plan-trabajo-excel-request':
        apiCallFunction = window.electronAPI.updatePlanTrabajoExcel;
        apiCallArgs = [payload];
        break;
      case 'repair-plan-trabajo-excel-request':
        apiCallFunction = window.electronAPI.repairPlanTrabajoExcel;
        apiCallArgs = [payload];
        break;
              case 'duplicate-budget-file-request':
                  apiCallFunction = window.electronAPI.duplicateBudgetFile;
                  apiCallArgs = [payload];
                  break;
              case 'electron-api-call-request':
                  // Mensaje enviado desde un iframe para llamar a una API específica
                  // El payload incluye el nombre de la función API y los argumentos
                  const { apiFunctionName, apiArgs } = payload;
                  apiCallFunction = window.electronAPI[apiFunctionName];
                  apiCallArgs = [apiArgs];
                  responseType = `${apiFunctionName}-response`;
                  break;
              case 'save-report-request':
                  // Funcionalidad no implementada aún
                  console.warn('RENDERER: save-report-request received but not implemented');
                  targetWindow.postMessage({
                      type: responseType,
                      payload: { success: false, error: 'Funcionalidad de guardar informe no implementada' },
                      requestId: requestId
                  }, '*');
                  return;
              case 'generate-pdf-request':
                  // Funcionalidad no implementada aún
                  console.warn('RENDERER: generate-pdf-request received but not implemented');
                  targetWindow.postMessage({
                      type: responseType,
                      payload: { success: false, error: 'Funcionalidad de generar PDF no implementada' },
                      requestId: requestId
                  }, '*');
                  return;
              case 'open-onlyoffice-editor-request':
                  // Abrir editor OnlyOffice
                  apiCallFunction = window.electronAPI.openOnlyOfficeEditor;
                  apiCallArgs = [payload];
                  responseType = 'open-onlyoffice-editor-response';
                  break;
              case 'investigacion-accidentes-save-temp-pdf-file-request':
                  // Manejar solicitud para guardar archivo PDF temporalmente
                  apiCallFunction = window.electronAPI.saveTempPdfFile;
                  apiCallArgs = [payload.filename, payload.data];
                  responseType = 'investigacion-accidentes-save-temp-pdf-file-response';
                  break;
              case 'investigacion-accidentes-process-accident-pdf-request':
                  // Manejar solicitud para procesar PDF de accidente
                  apiCallFunction = window.electronAPI.processAccidentPdf;
                  apiCallArgs = [payload.pdfPath];
                  responseType = 'investigacion-accidentes-process-accident-pdf-request-response';
                  break;
              case 'investigacion-accidentes-analyze-accident-request':
                  // Manejar solicitud para analizar accidente
                  apiCallFunction = window.electronAPI.analyzeAccident;
                  apiCallArgs = [payload.extractedData, payload.contextoAdicional];
                  responseType = 'investigacion-accidentes-analyze-accident-request-response';
                  break;
              case 'investigacion-accidentes-start-model-loading-request':
                  // Manejar solicitud para iniciar carga del modelo
                  apiCallFunction = window.electronAPI.startModelLoading;
                  apiCallArgs = [];
                  responseType = 'investigacion-accidentes-start-model-loading-request-response';
                  break;
              case 'investigacion-accidentes-generate-accident-report-request':
                  // Manejar solicitud para generar reporte de accidente
                  apiCallFunction = window.electronAPI.generateAccidentReport;
                  // El payload ya contiene los datos combinados directamente
                  apiCallArgs = [payload];
                  responseType = 'investigacion-accidentes-generate-accident-report-request-response';
                  break;
              case 'investigacion-accidentes-regenerate-analysis-request':
                  // Manejar solicitud para regenerar análisis (completo o por nivel) con feedback del usuario
                  apiCallFunction = window.electronAPI.regenerateAnalysis;
                  // El payload trae { descripcion, contexto, feedback, level, currentAnalysis }
                  apiCallArgs = [payload];
                  responseType = 'investigacion-accidentes-regenerate-analysis-response';
                  break;
              case 'investigacion-accidentes-get-stats-request':
                  // Manejar solicitud de estadísticas de investigaciones
                  apiCallFunction = window.electronAPI.getInvestigacionStats;
                  apiCallArgs = [payload.companyName];
                  responseType = 'investigacion-accidentes-get-stats-response';
                  break;
              case 'investigacion-accidentes-list-investigations-request':
                  // Manejar solicitud de lista de investigaciones
                  apiCallFunction = window.electronAPI.listInvestigations;
                  apiCallArgs = [payload.companyName, payload.filter];
                  responseType = 'investigacion-accidentes-list-investigations-response';
                  break;
    case 'investigacion-accidentes-get-investigation-detail-request':
      apiCallFunction = window.electronAPI.getInvestigationDetail;
      apiCallArgs = [payload.companyName, payload.investigationName];
      responseType = 'investigacion-accidentes-get-investigation-detail-response';
      break;
    case 'investigacion-accidentes-cross-reference-data-request':
      apiCallFunction = window.electronAPI.getCrossReferenceData;
      apiCallArgs = [payload.companyName];
      responseType = 'investigacion-accidentes-cross-reference-data-response';
      break;
    case 'investigacion-accidentes-find-furat-by-name-request':
      // Búsqueda del FURAT (PDF) en 3.2.1 por nombre — usada como fallback
      // cuando el viewer no envía la ruta del FURAT al iframe.
      apiCallFunction = window.electronAPI.findFuratByName;
      apiCallArgs = [payload.companyName, payload.caseName];
      responseType = 'investigacion-accidentes-find-furat-by-name-response';
      break;
case 'investigacion-accidentes-read-directory-request':
                    apiCallFunction = window.electronAPI.readDirectory;
                    apiCallArgs = [payload.path];
      responseType = 'investigacion-accidentes-read-directory-request-response';
      break;
    case 'investigacion-accidentes-create-folder-request':
      apiCallFunction = window.electronAPI.createFolder;
      apiCallArgs = [payload];
      responseType = 'investigacion-accidentes-create-folder-request-response';
      break;
    case 'investigacion-accidentes-delete-folder-request':
      apiCallFunction = window.electronAPI.deleteFolder;
      apiCallArgs = [payload];
      responseType = 'investigacion-accidentes-delete-folder-request-response';
      break;
    case 'investigacion-accidentes-delete-document-request':
      apiCallFunction = window.electronAPI.deleteDocument;
      apiCallArgs = [payload.filePath];
      responseType = 'investigacion-accidentes-delete-document-request-response';
      break;
    case 'investigacion-accidentes-rename-item-request':
      apiCallFunction = window.electronAPI.renameItem;
      apiCallArgs = [payload];
      responseType = 'investigacion-accidentes-rename-item-request-response';
      break;
    case 'investigacion-accidentes-show-item-in-folder-request':
      // Abrir el explorador de Windows en la carpeta del archivo seleccionado
      // (usado por los botones "Visualizar investigación" y "Ver en carpeta").
      apiCallFunction = window.electronAPI.showItemInFolder;
      apiCallArgs = [payload.filePath];
      responseType = 'investigacion-accidentes-show-item-in-folder-request-response';
      break;
    case 'investigacion-accidentes-select-directory-request':
      apiCallFunction = window.electronAPI.selectDirectory;
      apiCallArgs = [];
      responseType = 'investigacion-accidentes-select-directory-request-response';
      break;
              case 'get-investigacion-stats-request':
                  // Portal home solicita estadísticas de investigaciones
                  // Extraer companyName de la URL del iframe (query param ?company=)
                  try {
                      const portalUrl = targetWindow.location ? targetWindow.location.href : '';
                      const urlMatch = portalUrl.match(/[?&]company=([^&]+)/);
                      const portalCompany = urlMatch ? decodeURIComponent(urlMatch[1]) : '';

                      if (!portalCompany) {
                          targetWindow.postMessage({
                              type: responseType,
      payload: { pendientes: 0, completadas: 0, total: 0 },
      requestId: requestId
    }, '*');
    return;
  }

  const statsResult = await window.electronAPI.getInvestigacionStats(portalCompany);
  const statsData = (statsResult && statsResult.data) ? statsResult.data : { pendientes: 0, completadas: 0, total: 0 };

                      targetWindow.postMessage({
                          type: 'get-investigacion-stats-response',
                          payload: statsData,
                          requestId: requestId
                      }, '*');
                      return; // Ya enviamos la respuesta manualmente
                  } catch (e) {
                      console.error('[RENDERER] Error en get-investigacion-stats:', e);
                      targetWindow.postMessage({
                          type: 'get-investigacion-stats-response',
      payload: { pendientes: 0, completadas: 0, total: 0 },
      requestId: requestId
    }, '*');
    return;
  }
  break;
              case 'iframe-debug-log':
                  // Logs de debug del iframe
                  const { message, data } = payload || {};
                  console.log(message, data || '');
                  return;
              case 'get-theme-request':
                  // Responder con el tema actual
                  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                  targetWindow.postMessage({
                      type: 'get-theme-response',
                      theme: currentTheme
                  }, '*');
                  return;
              case 'back-to-main-app':
                  // Volver al home principal
                  showHomePage();
                  return;
              case 'ausentismo-home-action':
                  // Acción desde home de ausentismo - ya se maneja internamente en el módulo
                  console.log('[RENDERER] Ausentismo home action recibida, procesando...');
                  // No se requiere acción adicional, el módulo ya maneja la navegación internamente
                  return;
              case 'ausentismo-home-action-ver-estadisticas':
                  // Solicitud para ver estadísticas de ausentismo
                  console.log('[RENDERER] Ver estadísticas de ausentismo solicitada');
                  // El módulo se encarga de mostrar la vista de estadísticas
                  return;
		case 'ct-search-request':
			// Delegar al componente MedicionAusentismo — ya maneja este mensaje
			// directamente como proxy entre el iframe y electronAPI.
			// Si se procesa aquí también, se duplica la llamada IPC y la respuesta.
			console.log(`[RENDERER] Delegando búsqueda de trabajadores al componente MedicionAusentismo: ${type}`);
			return;

              // ═══════════════════════════════════════════════════════════
              // NOTA: Los mensajes de remisiones médicas (-request) y evaluaciones
              // médicas (-request) NO deben manejarse aquí. Los bridges
              // restricciones-medicas-logic.js y evaluaciones-medicas-logic.js ya
              // los manejan correctamente a través de sus handlers de postMessage.
              // Si se agregan aquí, se duplican las respuestas.
              // ═══════════════════════════════════════════════════════════
              
              // Delegar al componente EvaluacionesMedicasComponent para mensajes EMO
              case 'emo-get-dashboard-data-request':
              case 'emo-get-library-data-request':
                  console.log(`[RENDERER] Delegando mensaje EMO al componente: ${type} - no procesando`);
                  break; // break permite que el evento continúe hacia otros listeners (el componente)

              default:
                  // Verificar si es un mensaje de respuesta (ya procesado), para evitar bucles
                  if (type.endsWith('-response')) {
                      console.log(`RENDERER: Ignoring response message type (likely already processed): ${type}`);
                      return; // No responder a mensajes de respuesta para evitar bucles
                  }

                  // Mensajes manejados por componentes wrapper — no requieren
                  // acción del renderer global. Se ignoran sin warning.
                  if (
                    type === 'investigacion-home-action' ||
                    type === 'iniciar-investigacion-desde-viewer'
                  ) {
                    // El componente InvestigacionAccidentesComponent maneja este mensaje
                    // directamente. Ver: modules/gestion-salud/investigacion-accidentes/investigacion-accidentes-logic.js
                    return;
                  }

                  // Mensaje no reconocido — ignorar silenciosamente.
                  // Puede ser manejado por un componente wrapper (ej: ArchivoRetencionComponent, PoliticaComponent).
                  console.warn(`RENDERER: Unknown message type, ignorando: ${type}`);
                  return;
          }

          console.log(`RENDERER: 🗣️ Calling main process for ${type} with args:`, apiCallArgs);
          
          // Verificar si la función está disponible antes de llamarla
          if (typeof apiCallFunction !== 'function') {
              console.error(`RENDERER: La función ${type} no está disponible.`);
              targetWindow.postMessage({
                  type: responseType,
                  payload: { success: false, error: `Función no disponible: ${type}` },
                  requestId: requestId
              }, '*');
              return;
          }
          
          try {
              const result = await apiCallFunction(...apiCallArgs);
              console.log('RENDERER: 📥 Result from main process:', result);
              
              // Verificar si el targetWindow aún está disponible antes de enviar respuesta
              if (!targetWindow || targetWindow.closed) {
                  console.warn(`RENDERER: Target window cerrado para ${type}, omitiendo respuesta`);
                  return;
              }
              
              console.log('[DEBUG] Enviando respuesta a iframe:', {
                  type: responseType,
                  requestId: requestId,
                  hasConfig: !!result.config,
                  targetWindowExists: !!targetWindow,
                  targetWindowClosed: targetWindow?.closed
              });
              
      targetWindow.postMessage({
        type: responseType,
        success: result.success,
        payload: result,
        error: result.error || null,
        requestId: requestId
      }, '*');
              
              console.log('[DEBUG] Respuesta enviada a iframe');
          } catch (error) {
              // Manejo de errores específico para IPC
              if (error.message && error.message.includes('Object has been destroyed')) {
                  console.warn(`RENDERER: IPC destruido para ${type}, omitiendo respuesta`);
                  return;
              }
              throw error; // Re-lanzar para el catch exterior
          }

      } catch (error) {
          // Manejo de errores específico para IPC
          if (error.message && error.message.includes('Object has been destroyed')) {
              console.warn(`RENDERER: IPC destruido para ${type}, omitiendo respuesta`);
              return;
          }
          
          // Manejo de errores para ventana destruida
          if (error.message && error.message.includes('Cannot read properties of null')) {
              console.warn(`RENDERER: Error de propiedad nula para ${type}, omitiendo respuesta`);
              return;
          }
          
          console.error(`RENDERER: 😭 Error processing ${type}:`, error);
          
          // Solo intentar enviar error si el targetWindow está disponible
          try {
              if (targetWindow && !targetWindow.closed) {
          targetWindow.postMessage({
            type: responseType,
            success: false,
            error: { code: 'HANDLER_ERROR', message: error.message || 'Error desconocido' },
            payload: { success: false, error: error.message || 'Error desconocido' },
            requestId: requestId
          }, '*');
              }
          } catch (e) {
              console.warn(`RENDERER: No se pudo enviar mensaje de error para ${type}`);
          }
      }
  });
  // --- END: Iframe Communication Logic ---

  // --- BEGIN: Collapsible Sidebar Logic ---
  const sidebar = document.getElementById('sidebar');
  const sidebarHotspot = document.getElementById('sidebar-hotspot');

  function expandSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('sidebar-collapsed');
    if (sidebarHotspot) sidebarHotspot.classList.remove('active');
    if (window.updateVantaEffect) setTimeout(window.updateVantaEffect, 100);
  }

  function collapseSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('sidebar-collapsed');
    if (sidebarHotspot) sidebarHotspot.classList.add('active');
    if (window.updateVantaEffect) setTimeout(window.updateVantaEffect, 100);
  }

  if (sidebar) {
    // Collapse sidebar by default
    collapseSidebar();

    // Cuando el mouse entra al sidebar visible, expandir
    sidebar.addEventListener('mouseenter', expandSidebar);

    // Cuando el mouse entra al hotspot (borde izquierdo cuando colapsado), expandir
    if (sidebarHotspot) {
      sidebarHotspot.addEventListener('mouseenter', expandSidebar);
    }

    // Cuando el mouse sale del sidebar, colapsar de nuevo
    sidebar.addEventListener('mouseleave', collapseSidebar);

    console.log('Collapsible sidebar logic initialized.');
  }
  // --- END: Collapsible Sidebar Logic ---

// --- BEGIN: Collapsible Header Logic ---
const appHeader = document.getElementById('app-header');
const headerHoverZone = document.getElementById('header-hover-zone');
if (appHeader) {
  let headerHideTimeout = null;

  function showHeader() {
    if (headerHideTimeout) {
      clearTimeout(headerHideTimeout);
      headerHideTimeout = null;
    }
    appHeader.classList.add('app-header-hovering');
    appHeader.classList.remove('app-header-collapsed');
  }

  function hideHeader() {
    appHeader.classList.remove('app-header-hovering');
    headerHideTimeout = setTimeout(() => {
      if (!appHeader.classList.contains('app-header-hovering')) {
        appHeader.classList.add('app-header-collapsed');
      }
    }, 500);
  }

  setTimeout(() => {
    appHeader.classList.add('app-header-collapsed');
  }, 5000);

  appHeader.addEventListener('mouseenter', showHeader);
  appHeader.addEventListener('mouseleave', hideHeader);

  if (headerHoverZone) {
    headerHoverZone.addEventListener('mouseenter', showHeader);
    headerHoverZone.addEventListener('mouseleave', hideHeader);
  }

  console.log('Collapsible header logic initialized.');
}
// --- END: Collapsible Header Logic ---

  // Escuchar eventos de log desde el proceso principal
  if (window.electronAPI && window.electronAPI.onIpcMessage) {
    window.electronAPI.onIpcMessage('log-message', (message, level) => {
      logMessage(message, level);
    });
    logMessage('Renderer: Conectado al sistema de logs del proceso principal.', 'DEBUG');

    // --- Lógica para Auto Updater con Notificaciones Modernas ---
    console.log('[UPDATER] Verificando disponibilidad de electronAPI para updates...');
    console.log('[UPDATER] onUpdateChecking disponible:', typeof window.electronAPI?.onUpdateChecking);
    console.log('[UPDATER] onUpdateAvailable disponible:', typeof window.electronAPI?.onUpdateAvailable);
    console.log('[UPDATER] updateNotifier disponible:', typeof window.updateNotifier);
    
    // --- Header Update Button Elements ---
    const headerUpdateBtn = document.getElementById('header-update-btn');
    const headerUpdatePanel = document.getElementById('header-update-panel');
    const headerUpdateText = document.getElementById('header-update-text');
    const updateProgressFill = document.getElementById('update-progress-fill');
    const updateProgressText = document.getElementById('update-progress-text');
    const updateInstallBtn = document.getElementById('update-install-btn');
    const updateDownloadBtn = document.getElementById('update-download-btn');

    let headerUpdatePanelVisible = false;
    let currentAppVersion = null;

    // Toggle update panel when clicking the update button
    // 📦504 — El botón del header SOLO aparece cuando detecta update:
    //  - Si está al día: OCULTO (sin ruido visual en uso normal)
    //  - Si está buscando: OCULTO (transición interna, no necesita UI)
    //  - Si hay update disponible: VISIBLE + panel con "Descargar"
    //  - Si está descargado: VISIBLE + panel con "Actualizar y reiniciar"
    if (headerUpdateBtn) {
      headerUpdateBtn.addEventListener('click', () => {
        headerUpdatePanelVisible = !headerUpdatePanelVisible;
        if (headerUpdatePanel) {
          headerUpdatePanel.style.display = headerUpdatePanelVisible ? 'flex' : 'none';
        }
      });
    }

    // 📦546 — Botón "Descargar": FALLBACK por si la auto-descarga falla.
    // El flujo principal descarga en background apenas detecta update-available
    // (autoDownload=true en main.js). Este botón queda en el DOM pero normalmente
    // está oculto (case 'available' lo pone display:none).
    if (updateDownloadBtn) {
      updateDownloadBtn.addEventListener('click', () => {
        logMessage('Usuario solicitó descarga de la actualización', 'INFO');
        if (window.electronAPI?.downloadUpdate) {
          // Feedback inmediato: mostrar "preparando..." + activar shimmer
          if (updateProgressText) updateProgressText.textContent = 'Preparando descarga...';
          if (updateDownloadBtn) {
            updateDownloadBtn.disabled = true;
            updateDownloadBtn.textContent = 'Descargando...';
          }
          var bar = document.querySelector('.update-progress-bar');
          if (bar) {
            bar.classList.add('is-active');
            bar.classList.remove('is-complete');
            if (updateProgressFill) updateProgressFill.style.width = '2%'; // arranco con un poquito
          }
          window.electronAPI.downloadUpdate().then(res => {
            if (res && res.success) {
              if (updateProgressText) updateProgressText.textContent = 'Descargando...';
            } else {
              logMessage('Error iniciando descarga: ' + (res && res.error && res.error.message), 'ERROR');
              if (bar) bar.classList.remove('is-active');
              if (updateProgressFill) updateProgressFill.style.width = '0%';
              if (updateProgressText) updateProgressText.textContent = 'Error al iniciar';
              if (updateDownloadBtn) {
                updateDownloadBtn.disabled = false;
                updateDownloadBtn.textContent = 'Descargar';
                updateDownloadBtn.style.display = 'block';
              }
              if (window.updateNotifier) {
                window.updateNotifier.show({
                  type: 'error',
                  title: 'No se pudo iniciar la descarga',
                  subtitle: res && res.error ? res.error.message : 'Error desconocido',
                  autoClose: 6000
                });
              }
            }
          });
        }
      });
    }

    // Install button triggers restart
    if (updateInstallBtn) {
      updateInstallBtn.addEventListener('click', () => {
        logMessage('Usuario solicitó reiniciar para instalar actualización', 'INFO');
        window.electronAPI.restartApp && window.electronAPI.restartApp();
      });
    }

    // Helper: Update header status (unifica los 4 estados visuales del botón)
    // Estados: 'uptodate' | 'checking' | 'available' | 'ready'
    // 📦504 — El botón SOLO es visible cuando hay update ('available' | 'ready').
    // En 'uptodate' y 'checking' el botón se oculta para no agregar ruido visual
    // cuando todo está al día. Cuando aparece, el dot interior cambia de color
    // según el estado: amarillo pulsante=disponible, verde fuerte=descargado.
    function updateHeaderStatus(state, options = {}) {
      if (!headerUpdateBtn || !headerUpdateText) return;

      // Limpiar todas las clases de estado
      headerUpdateBtn.classList.remove(
        'header-update-uptodate',
        'header-update-checking',
        'header-update-available',
        'header-update-ready'
      );

      switch (state) {
        case 'uptodate':
          // OCULTO: está al día, no necesita UI
          headerUpdateBtn.style.display = 'none';
          headerUpdateBtn.classList.add('header-update-uptodate');
          // Panel se cierra si estaba abierto
          if (headerUpdatePanel) {
            headerUpdatePanel.style.display = 'none';
            headerUpdatePanelVisible = false;
          }
          break;

        case 'checking':
          // OCULTO: buscando es transición interna, no necesita UI
          headerUpdateBtn.style.display = 'none';
          headerUpdateBtn.classList.add('header-update-checking');
          if (headerUpdatePanel) {
            headerUpdatePanel.style.display = 'none';
            headerUpdatePanelVisible = false;
          }
          break;

        case 'available':
          // VISIBLE: hay update, botón amarillo pulsante con versión
          // 📦546 — La descarga ya arrancó automáticamente en background
          // (autoDownload=true en main.js). El estado 'available' dura muy poco
          // antes de transicionar a 'ready' (vía download-progress + update-downloaded).
          // El panel del header queda como atajo: si el usuario hace click en el botón
          // amarillo, puede ver el progreso de la descarga. El botón "Descargar" se
          // oculta porque ya no se necesita (la descarga está en curso).
          headerUpdateBtn.style.display = 'flex';
          headerUpdateBtn.classList.add('header-update-available');
          headerUpdateText.textContent = options.version ? `v${options.version}` : 'Update';
          headerUpdateBtn.title = options.version
            ? `Descargando actualización v${options.version} en segundo plano...`
            : 'Actualización disponible — Descargando en segundo plano';
          if (headerUpdatePanel) {
            headerUpdatePanel.style.display = 'none';
            headerUpdatePanelVisible = false;
          }
          if (updateProgressFill) updateProgressFill.style.width = '0%';
          // 📦546 — Texto refleja que la descarga arrancó sola (ya no dice "Listo para descargar")
          if (updateProgressText) updateProgressText.textContent = 'Descargando automáticamente...';
          // En estado "available" NO se muestra el botón Instalar todavía
          if (updateInstallBtn) updateInstallBtn.style.display = 'none';
          // 📦546 — Ocultar botón "Descargar" porque ya está descargando en background
          // (se mantiene en el DOM por si la auto-descarga falla y el usuario quiere reintentar)
          var downloadBtn = document.getElementById('update-download-btn');
          if (downloadBtn) {
            downloadBtn.style.display = 'none';
          }
          // Resetear animación de barra
          var barAvail = document.querySelector('.update-progress-bar');
          if (barAvail) {
            barAvail.classList.add('is-active');
            barAvail.classList.remove('is-complete');
          }
          break;

        case 'ready':
          // VISIBLE: update descargado, botón verde con botón "Actualizar"
          headerUpdateBtn.style.display = 'flex';
          headerUpdateBtn.classList.add('header-update-ready');
          headerUpdateText.textContent = options.version ? `v${options.version}` : 'Listo';
          headerUpdateBtn.title = options.version
            ? `Actualización v${options.version} descargada — Click para instalar`
            : 'Actualización lista para instalar';
          if (updateProgressFill) updateProgressFill.style.width = '100%';
          if (updateProgressText) updateProgressText.textContent = 'Descarga completa · Listo para instalar';
          if (updateInstallBtn) updateInstallBtn.style.display = 'block';
          // En "ready" ocultar el botón Descargar (ya está descargado)
          var dlBtn2 = document.getElementById('update-download-btn');
          if (dlBtn2) dlBtn2.style.display = 'none';
          // Detener shimmer, marcar como completa (barra quieta)
          var barReady = document.querySelector('.update-progress-bar');
          if (barReady) {
            barReady.classList.add('is-complete');
            barReady.classList.remove('is-active');
          }
          break;
      }
    }

    // Helper: Update progress in header (usado durante descarga)
    // 📦503 — Activa el shimmer animado mientras la descarga está en curso.
    // El contenedor .update-progress-bar recibe .is-active mientras percent < 100.
    function updateHeaderProgress(percent, speed) {
      if (updateProgressFill) {
        updateProgressFill.style.width = `${percent}%`;
      }
      if (updateProgressText) {
        updateProgressText.textContent = `${percent}%${speed ? ' · ' + speed + ' MB/s' : ''}`;
      }
      var bar = document.querySelector('.update-progress-bar');
      if (bar) {
        if (percent > 0 && percent < 100) {
          bar.classList.add('is-active');
          bar.classList.remove('is-complete');
        } else if (percent >= 100) {
          bar.classList.add('is-complete');
          bar.classList.remove('is-active');
        }
      }
    }

    // Wrappers de compatibilidad (para no romper otros call sites)
    function showHeaderUpdateAvailable(version) { updateHeaderStatus('available', { version }); }
    function showHeaderUpdateReady(version) { updateHeaderStatus('ready', { version }); }
    function hideHeaderUpdatePanel() { updateHeaderStatus('uptodate'); }

    // Cuando comienza a buscar actualizaciones
    // (Sin toast — solo actualizamos estado interno del header)
    window.electronAPI?.onUpdateChecking && window.electronAPI.onUpdateChecking(() => {
      console.log('[UPDATER] Evento recibido: update_checking');
      logMessage('Buscando actualizaciones...', 'INFO');
      updateHeaderStatus('checking');
    });

    // Cuando hay una actualización disponible
    // 📦546 — A+B+C: ahora main.js tiene autoDownload=true, así que la descarga
    // arranca automáticamente. El toast notifica al usuario del progreso y
    // el botón amarillo del header sigue ahí como atajo para abrir el panel.
    // (El botón "Descargar" del panel queda como fallback por si falla la auto-descarga.)
    window.electronAPI?.onUpdateAvailable && window.electronAPI.onUpdateAvailable((info) => {
      console.log('[UPDATER] Evento recibido: update_available', info);
      logMessage(`Actualización disponible: ${info ? info.version : 'nueva versión'}`, 'INFO');
      if (info && info.version) {
        updateHeaderStatus('available', { version: info.version });
        // B) Toast moderno con barra de progreso — autoClose 0 (no se cierra solo)
        if (window.updateNotifier && typeof window.updateNotifier.notifyAvailable === 'function') {
          window.updateNotifier.notifyAvailable(info.version);
        }
      }
    });

    // Cuando NO hay actualizaciones disponibles
    window.electronAPI?.onUpdateNotAvailable && window.electronAPI.onUpdateNotAvailable((info) => {
      console.log('[UPDATER] Evento recibido: update_not_available', info);
      logMessage('No hay actualizaciones disponibles', 'INFO');
      // Volver al estado "al día" (botón permanente con punto verde)
      updateHeaderStatus('uptodate', { version: info?.version || currentAppVersion });
      // Si el toast de "descargando" quedó abierto por error, cerrarlo
      if (window.updateNotifier && window.updateNotifier.currentToast) {
        window.updateNotifier.remove(window.updateNotifier.currentToast);
      }
    });

    // Progreso de descarga
    window.electronAPI?.onUpdateProgress && window.electronAPI.onUpdateProgress((data) => {
      console.log('[UPDATER] Evento recibido: update_progress', data);
      // Update header progress (la barra dentro del panel)
      if (data && data.percent !== undefined) {
        updateHeaderProgress(data.percent, data.speed);
        // B) Actualizar la barra de progreso del toast
        if (window.updateNotifier && typeof window.updateNotifier.updateProgress === 'function') {
          var speedLabel = data.speed ? data.speed + ' MB/s' : 'Calculando...';
          window.updateNotifier.updateProgress(data.percent, speedLabel);
        }
      }
    });

    // Cuando la descarga se completa
    window.electronAPI?.onUpdateDownloaded && window.electronAPI.onUpdateDownloaded((info) => {
      console.log('[UPDATER] Evento recibido: update_downloaded', info);
      logMessage('Actualización descargada y lista para instalar', 'INFO');
      const version = info ? info.version : 'más reciente';
      // Update header UI → estado "ready" (botón permanente con badge "Listo")
      updateHeaderStatus('ready', { version });
      // B) Toast de éxito con botón "Reiniciar e Instalar Ahora" — autoClose 0
      // C) Al cerrar la app, autoInstallOnAppQuit=true instala la versión pendiente
      //    aunque el usuario no abra el toast; este botón es para los que quieren
      //    reiniciar YA sin esperar.
      if (window.updateNotifier && typeof window.updateNotifier.notifyDownloaded === 'function') {
        window.updateNotifier.notifyDownloaded(version, function() {
          logMessage('Usuario solicitó reiniciar para instalar actualización (vía toast)', 'INFO');
          window.electronAPI.restartApp && window.electronAPI.restartApp();
        });
      }
    });

    // Error en la actualización
    window.electronAPI?.onUpdateError && window.electronAPI.onUpdateError((data) => {
      console.log('[UPDATER] Evento recibido: update_error', data);
      logMessage(`Error de actualización: ${data ? data.message : 'error desconocido'}`, 'ERROR');
      // Volver al estado "al día" (botón permanente con punto verde)
      updateHeaderStatus('uptodate', { version: currentAppVersion });
      // B) Toast de error con detalle
      if (window.updateNotifier && typeof window.updateNotifier.notifyError === 'function') {
        var errorMsg = data && data.message ? data.message : 'Error desconocido en la actualización';
        window.updateNotifier.notifyError(errorMsg);
      }
    });

    // Inicializar header con la versión actual (estado "al día" hasta que llegue el primer check)
    // Se hace DESPUÉS de definir updateHeaderStatus para evitar issues de hoisting en strict mode
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion()
        .then(version => {
          currentAppVersion = version;
          updateHeaderStatus('uptodate', { version });
        })
        .catch(err => {
          console.warn('[UPDATER] No se pudo obtener la versión inicial:', err);
          updateHeaderStatus('uptodate', {});
        });
    } else {
      updateHeaderStatus('uptodate', {});
    }

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

  // 📦572 — Botón de calendario (K+AIR Calendar Component v1 — popover centralizado) RETIRADO.
  // El calendario viejo ya no se abre desde el header de la app principal. La Bandeja Integrada
  // tiene su propio calendario interno (mini-cal en sidebar + calendario grande en slide) que
  // usa los mismos IPC handlers y datos. Si en el futuro se quiere re-activar, el código
  // está disponible en el tag backup-pre-calendar-removal-2026-07-21.
  // (NOOP: el bloque fue removido intencionalmente)

  // 📦573 — Alertas calendario — Inicializar el sistema de badge + popover de
  // pendientes. KairAlerts se suscribe al badge del botón de Bandeja Integrada
  // (#bandeja-integrada-badge) con stopPropagation, para que el badge no abra
  // el iframe al hacer click (solo el resto del botón abre la Bandeja Integrada).
  if (typeof window.KairAlerts === 'object' && typeof window.KairAlerts.init === 'function') {
    window.KairAlerts.init();
    console.log('[K+AIR] KairAlerts inicializado.');
  } else {
    console.warn('[K+AIR] KairAlerts no disponible — el badge de alertas no funcionará.');
  }

  // Botón de home de empresa
  const companyHomeButtonElement = document.getElementById('company-home-button');
  if (companyHomeButtonElement) {
    console.log('Found company home button, attaching event listener.');
    companyHomeButtonElement.addEventListener('click', function(event) {
      console.log('Company home button clicked.');
      event.preventDefault();
      handleCompanyHome();
    });
  } else {
    console.error('Company home button NOT found in DOM.');
  }

  initializeAuthFlow();
});

// Variable para mantener el botón activo del sidebar
let activeSidebarButton = null;

// --- Auth UI helpers ---
function setAuthUIState(isAuthenticated) {
const sidebar = document.getElementById('sidebar');
const appHeader = document.getElementById('app-header');
const headerHoverZone = document.getElementById('header-hover-zone');
const headerButtons = document.querySelectorAll('.header-btn');

if (sidebar) {
sidebar.style.display = isAuthenticated ? '' : 'none';
}

if (appHeader) {
appHeader.style.display = isAuthenticated ? '' : 'none';
}

if (headerHoverZone) {
headerHoverZone.style.display = isAuthenticated ? '' : 'none';
}

headerButtons.forEach(btn => {
btn.style.pointerEvents = isAuthenticated ? 'auto' : 'none';
btn.style.opacity = isAuthenticated ? '1' : '0.4';
});
}

// --- Controlador de Animación de Carga K+AIR ---

class KairLoadingController {
  constructor() {
    this.progress = 0;
    this.messageIndex = 0;
    this.isComplete = false;
    this.messages = [
      { main: 'Iniciando...', sub: 'Cargando recursos' },
      { main: 'Verificando credenciales', sub: 'Validando permisos' },
      { main: 'Cargando configuración', sub: 'Sincronizando datos' },
      { main: 'Preparando interfaz', sub: 'Cargando módulos' },
      { main: 'Completando', sub: 'Verificando acceso' }
    ];
    this.messageEl = null;
    this.submessageEl = null;
    this.progressFill = null;
  }

  _getElements() {
    if (!this.messageEl) {
      this.messageEl = document.querySelector('.loading-message');
      this.submessageEl = document.querySelector('.loading-submessage');
      this.progressFill = document.querySelector('.progress-fill');
      this.progressPercent = document.querySelector('.loading-progress-percent');
    }
    return { messageEl: this.messageEl, submessageEl: this.submessageEl, progressFill: this.progressFill, progressPercent: this.progressPercent };
  }

  setProgress(value) {
    const { progressFill, progressPercent } = this._getElements();
    if (progressFill) {
      const target = Math.max(0, Math.min(100, Math.round(value)));
      const startVal = parseInt(progressPercent?.textContent) || 0;
      this.progress = target;
      progressFill.style.width = `${target}%`;
      if (progressPercent && startVal !== target) {
        const startTime = performance.now();
        const duration = 400;
        const animate = (now) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);
          const displayed = Math.round(startVal + (target - startVal) * t);
          progressPercent.textContent = `${displayed}%`;
          if (t < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      } else if (progressPercent) {
        progressPercent.textContent = `${target}%`;
      }
    }
  }

  /**
   * Versión SINCRONIZADA: hace que la barra y el texto avancen juntos
   * con requestAnimationFrame, evitando el solapamiento de transiciones CSS.
   * Se llama desde executeLoginTransition para que cada paso complete
   * visualmente antes del siguiente.
   * @param {number} target - valor objetivo 0-100
   * @param {number} duration - duración en ms de la animación
   * @returns {Promise<void>}
   */
  animateToProgress(target, duration = 600) {
    const { progressFill, progressPercent } = this._getElements();
    if (!progressFill) return Promise.resolve();
    const startVal = this.progress || 0;
    const endVal = Math.max(0, Math.min(100, Math.round(target)));
    if (startVal === endVal) return Promise.resolve();
    return new Promise(function(resolve) {
      const startTime = performance.now();
      const animate = function(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease-out cubic para sensación profesional
        const eased = 1 - Math.pow(1 - t, 3);
        const current = Math.round(startVal + (endVal - startVal) * eased);
        progressFill.style.width = current + '%';
        if (progressPercent) progressPercent.textContent = current + '%';
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // CRÍTICO: actualizar this.progress para que la siguiente llamada
          // empiece desde donde terminamos, no desde 0.
          this.progress = endVal;
          resolve();
        }
      }.bind(this);
      requestAnimationFrame(animate);
    }.bind(this));
  }

  setMessage(main, sub) {
    const { messageEl, submessageEl } = this._getElements();
    setTimeout(() => {
      if (messageEl) {
        messageEl.textContent = main;
        messageEl.style.opacity = '1';
      }
      if (submessageEl) {
        submessageEl.textContent = sub;
        submessageEl.style.opacity = '1';
      }
    }, 200);
  }

  advanceMessage() {
    if (this.messageIndex < this.messages.length - 1) {
      this.messageIndex++;
      const msg = this.messages[this.messageIndex];
      this.setMessage(msg.main, msg.sub);
    }
  }

  updateMessage() {
    const msg = this.messages[this.messageIndex];
    this.setMessage(msg.main, msg.sub);
  }

  complete() {
    if (this.isComplete) return;
    this.isComplete = true;
    const container = document.querySelector('.loading-container');
    if (container) {
      container.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      container.style.opacity = '0';
      container.style.transform = 'scale(0.98)';
    }
    window.dispatchEvent(new CustomEvent('kair-loading-complete'));
  }

  showError(message = 'Error al cargar. Intentelo de nuevo.') {
    const { messageEl, progressFill } = this._getElements();
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.style.color = '#dc3545';
    }
    const { submessageEl } = this._getElements();
    if (submessageEl) {
      submessageEl.textContent = '';
    }
    document.querySelectorAll('.spinner-ring').forEach(el => {
      el.style.animationPlayState = 'paused';
    });
    document.querySelectorAll('.accent-dot').forEach(el => {
      el.style.animationPlayState = 'paused';
    });
    document.querySelectorAll('.particle').forEach(el => {
      el.style.animationPlayState = 'paused';
    });
    if (progressFill) {
      progressFill.style.background = '#dc3545';
    }
  }

  reset() {
    this.progress = 0;
    this.messageIndex = 0;
    this.isComplete = false;
    this.setProgress(0);
    this.updateMessage();
    const container = document.querySelector('.loading-container');
    if (container) {
      container.style.opacity = '1';
      container.style.transform = 'scale(1)';
    }
  }

  startSimulation() {
    this.updateMessage();
    const steps = [
      { delay: 400, target: 15 },
      { delay: 800, target: 30 },
      { delay: 600, target: 42 },
      { delay: 1000, target: 55 },
      { delay: 700, target: 65 },
      { delay: 900, target: 78 },
      { delay: 500, target: 88 },
      { delay: 1200, target: 95 },
      { delay: 800, target: 100 }
    ];
    let cumulativeDelay = 0;
    steps.forEach(step => {
      cumulativeDelay += step.delay;
      setTimeout(() => {
        this.setProgress(step.target);
        this.advanceMessage();
      }, cumulativeDelay);
    });
    setTimeout(() => this.complete(), cumulativeDelay + 500);
  }
}

window.kairLoading = new KairLoadingController();

// --- Funciones de Transición Login → Interfaz ---

/**
 * Espera un tiempo determinado
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Crea el overlay de transición
 */
function createTransitionOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'loading-container';
  overlay.innerHTML = `
    <!-- Partículas flotantes -->
    <div class="loading-particles">
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
      <div class="particle"></div>
    </div>

    <!-- Tarjeta de carga -->
    <div class="loading-card">
      <!-- Logo con ícono oficial K+AIR -->
      <div class="loading-logo-section">
        <img class="loading-logo-icon" src="assets/KIAR256.ico" alt="K+AIR" onerror="this.style.display='none'">
        <div class="loading-logo-text">
          <span class="loading-logo-brand">K+AIR</span>
          <span class="loading-logo-tagline">SG-SST COLOMBIA</span>
        </div>
      </div>

      <!-- Spinner -->
      <div class="loading-spinner-section">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>

      <!-- Mensajes -->
      <div class="loading-message-section">
        <div class="loading-message">Iniciando...</div>
        <div class="loading-submessage">Cargando recursos</div>
        <div class="accent-dots">
          <div class="accent-dot accent-dot--yellow"></div>
          <div class="accent-dot accent-dot--blue"></div>
          <div class="accent-dot accent-dot--navy"></div>
          <div class="accent-dot accent-dot--purple"></div>
        </div>
      </div>

      <!-- Progreso -->
      <div class="loading-progress-section">
        <div class="loading-progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="loading-progress-percent">0%</div>
      </div>

      <!-- Éxito -->
      <div class="loading-success" id="loading-success" style="display: none;">
        <svg class="loading-success-icon" viewBox="0 0 52 52">
          <circle class="loading-success-circle" cx="26" cy="26" r="25"/>
          <path class="loading-success-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
        </svg>
        <div class="loading-welcome">¡Bienvenido!</div>
        <div class="loading-welcome-user" id="loading-welcome-user">Usuario</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="loading-footer-text">K+AIR v<span id="loading-ver">—</span> · Sistema de Gestión en Seguridad y Salud en el Trabajo</div>
  `;

  // Inyectar versión de la app de forma asíncrona
  if (window.electronAPI && window.electronAPI.getAppVersion) {
    window.electronAPI.getAppVersion()
      .then(v => {
        const el = overlay.querySelector('#loading-ver');
        if (el) el.textContent = v;
      })
      .catch(() => {});
  }

  return overlay;
}

/**
 * Actualiza el mensaje de transición
 */
function updateTransitionMessage(main, sub) {
  const messageEl = document.querySelector('.loading-message');
  const submessageEl = document.querySelector('.loading-submessage');
  if (messageEl) {
    messageEl.textContent = main;
  }
  if (submessageEl) {
    submessageEl.textContent = sub;
  }
}

/**
 * Ejecuta la transición completa después del login exitoso
 */
async function executeLoginTransition(userName) {
  console.log('🚀 Iniciando transición de login...');

  const authScreen = document.querySelector('.kair-auth-screen');
  const overlay = createTransitionOverlay();
  document.body.appendChild(overlay);

  // Forzar reflow para que los estilos iniciales se apliquen antes de animar
  overlay.offsetHeight;

  try {
    // 1. Fade out del login
    if (authScreen) {
      authScreen.style.transition = 'opacity 0.5s ease, transform 0.5s ease, filter 0.5s ease';
      authScreen.style.opacity = '0';
      authScreen.style.transform = 'translateY(-40px) scale(0.95)';
      authScreen.style.filter = 'blur(4px)';
    }
    await wait(500);

    // 2. Ocultar login y mostrar overlay
    if (authScreen) {
      authScreen.style.display = 'none';
    }
    overlay.classList.remove('hidden');
    await wait(150);

    // 3. Secuencia SINCRONIZADA: cada paso espera a que la barra y el texto
    // lleguen visualmente al target antes del siguiente. Sin solapamiento.
    await window.kairLoading.animateToProgress(25, 600);
    window.kairLoading.setMessage('Verificando credenciales', 'Validando permisos...');

    await window.kairLoading.animateToProgress(55, 600);
    window.kairLoading.setMessage('Cargando configuración', 'Sincronizando datos...');

    await window.kairLoading.animateToProgress(80, 500);
    window.kairLoading.setMessage('Preparando interfaz', 'Cargando módulos...');

    await window.kairLoading.animateToProgress(100, 500);

    // 4. Mostrar checkmark inmediatamente al llegar a 100%
    const spinner = document.querySelector('.loading-spinner-section');
    const progressSection = document.querySelector('.loading-progress-section');
    const messageSection = document.querySelector('.loading-message-section');

    if (spinner) spinner.style.display = 'none';
    if (progressSection) progressSection.style.display = 'none';
    if (messageSection) messageSection.style.display = 'none';

    const welcomeUser = document.getElementById('loading-welcome-user');
    if (welcomeUser) {
      welcomeUser.textContent = userName || 'Usuario';
    }
    const successContainer = document.getElementById('loading-success');
    if (successContainer) {
      successContainer.style.display = 'flex';
      successContainer.style.flexDirection = 'column';
      successContainer.style.alignItems = 'center';
    }

    await wait(700);

    // 5. Listener de completitud y limpieza del overlay
    window.addEventListener('kair-loading-complete', function onComplete() {
      window.removeEventListener('kair-loading-complete', onComplete);
      overlay.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      overlay.style.opacity = '0';
      overlay.style.transform = 'scale(0.98)';
      setTimeout(() => {
        overlay.remove();
        console.log('✅ Transición completada');
      }, 400);
    });

    // 6. Ejecutar complete() para disparar evento
    window.kairLoading.complete();
  } catch (e) {
    console.error('[LOGIN] Error durante la transición:', e);
    if (overlay && overlay.parentNode) overlay.remove();
    if (typeof window.kairLoading.showError === 'function') {
      window.kairLoading.showError('Error durante la carga. Reintente.');
    }
  }
}

// --- Fin Funciones de Transición ---

function renderLoginScreen(errorMessage = '') {
currentCompany = null;
currentModule = null;
currentSubmodule = null;

setAuthUIState(false);

const mainContainer = document.querySelector('.main-container');
if (mainContainer) mainContainer.classList.add('vanta-fullscreen');

contentArea.innerHTML = '';

  const authScreen = document.createElement('div');
  authScreen.className = 'kair-auth-screen';
  authScreen.id = 'vanta-login-container';
  authScreen.innerHTML = `
    <div class="kair-splash-screen" id="kair-splash">
      <div class="kair-splash-overlay"></div>
      <div class="kair-splash-orb kair-splash-orb-1"></div>
      <div class="kair-splash-orb kair-splash-orb-2"></div>
      <div class="kair-splash-orb kair-splash-orb-3"></div>
      <div class="kair-splash-polygon kair-splash-polygon-1"></div>
      <div class="kair-splash-polygon kair-splash-polygon-2"></div>
      <div class="kair-splash-particle"></div>
      <div class="kair-splash-particle"></div>
      <div class="kair-splash-particle"></div>
      <div class="kair-splash-particle"></div>
      <div class="kair-splash-particle"></div>
      <div class="kair-splash-particle"></div>
      <div class="kair-splash-logo-container" id="kair-splash-logo-btn">
        <img class="kair-splash-logo" src="assets/KIAR256.ico" alt="K+AIR" />
        <div class="kair-splash-logo-text">K+AIR</div>
        <div class="kair-splash-logo-subtitle">SG-SST</div>
      </div>
      <div class="kair-splash-hint">Haz clic en el logo para continuar</div>
    </div>
    <div class="kair-auth-card" id="kair-auth-card">
      <div class="kair-auth-title">Ingreso a K+AIR</div>
      <div class="kair-auth-subtitle">Acceso seguro por usuario</div>
      <form id="kair-login-form" class="kair-auth-form">
        <div class="kair-auth-form-group">
          <label class="kair-auth-label" for="kair-login-email">Correo</label>
          <div class="kair-auth-input-wrapper">
            <i class="kair-auth-input-icon fas fa-envelope"></i>
            <input id="kair-login-email" class="kair-auth-input kair-auth-input-with-icon" type="email" autocomplete="username" placeholder="ejemplo@empresa.com" required />
          </div>
        </div>
        <div class="kair-auth-form-group">
          <label class="kair-auth-label" for="kair-login-pass">Contraseña</label>
          <div class="kair-auth-input-wrapper">
            <i class="kair-auth-input-icon fas fa-lock"></i>
            <input id="kair-login-pass" class="kair-auth-input kair-auth-input-with-icon" type="password" autocomplete="current-password" placeholder="••••••••" required />
            <button type="button" class="kair-password-toggle" id="kair-password-toggle" tabindex="-1">
              <i class="bi bi-eye-slash"></i>
            </button>
          </div>
        </div>
        <div class="kair-auth-remember">
          <label class="kair-auth-checkbox-label">
            <input type="checkbox" id="kair-remember-me" class="kair-auth-checkbox" />
            <span class="kair-auth-checkbox-custom"></span>
            <span>Recordar mis datos</span>
          </label>
        </div>
        <div class="kair-auth-error" id="kair-login-error">${errorMessage || ''}</div>
        <button class="kair-auth-button" type="submit" id="kair-login-button">Ingresar</button>
      </form>
      <div class="kair-auth-hint">Si no tienes acceso, contacta a administración.</div>
    </div>
  `;

  contentArea.appendChild(authScreen);

  // Splash Screen - Ocultar formulario inicialmente
  const splashScreen = document.getElementById('kair-splash');
  const authCard = document.getElementById('kair-auth-card');
  authCard.classList.add('kair-auth-fade-out');

  // Evento click en el logo del splash para mostrar el login
  const splashLogoBtn = document.getElementById('kair-splash-logo-btn');
  splashLogoBtn.addEventListener('click', function() {
    splashScreen.classList.add('kair-splash-hidden');
    authCard.classList.remove('kair-auth-fade-out');
    authCard.classList.add('kair-auth-fade-in');
  });

  // Aplicar Vanta.js al fondo del login (mismos tonos que selección de empresa)
  if (typeof VANTA !== 'undefined' && typeof VANTA.WAVES !== 'undefined') {
    setTimeout(() => {
      if (window.vantaEffect && typeof window.vantaEffect.destroy === 'function') {
        window.vantaEffect.destroy();
      }
      window.vantaEffect = VANTA.WAVES({
        el: '#vanta-login-container',
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 400,
        minWidth: 400,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x6a7f9b,
        shininess: 36.00,
        waveHeight: 16.00,
        waveSpeed: 1.20,
        zoom: 0.68
      });
      // 2026-06-27: forzar un resize inmediato para que Vanta ocupe todo el viewport.
      // 2026-07-01 v2: los 2 setTimeout no alcanzaban — Vanta seguia con franja
      // blanca en el lado derecho cuando el contenedor terminaba de expandirse
      // despues de la animacion del splash. Reforzar con multiples intentos
      // escalonados + listener permanente de resize + ResizeObserver.
      const triggerResize = function () {
        if (window.vantaEffect && typeof window.vantaEffect.resize === 'function') {
          window.vantaEffect.resize();
        }
      };
      // Multiples intentos escalonados (cubre fuentes web async, fonts, transitions).
      setTimeout(triggerResize, 50);
      setTimeout(triggerResize, 300);
      setTimeout(triggerResize, 1000);
      setTimeout(triggerResize, 2500);
      // Listener permanente: cualquier resize del window reajusta Vanta.
      window.addEventListener('resize', triggerResize);
      // ResizeObserver: detecta cambios del contenedor (CSS animations, flex).
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(triggerResize);
        const vantaEl = document.getElementById('vanta-login-container');
        if (vantaEl) ro.observe(vantaEl);
      }
      console.log('Vanta.js aplicado al login correctamente');
    }, 100);
  }

  const form = document.getElementById('kair-login-form');
  const button = document.getElementById('kair-login-button');
  const errorDiv = document.getElementById('kair-login-error');
  const emailInput = document.getElementById('kair-login-email');
  const passwordInput = document.getElementById('kair-login-pass');
  const rememberCheckbox = document.getElementById('kair-remember-me');

  const savedEmail = localStorage.getItem('kair_remembered_email');
  const savedPassword = localStorage.getItem('kair_remembered_password');
  if (savedEmail) {
    emailInput.value = savedEmail;
    if (savedPassword) {
      passwordInput.value = savedPassword;
      rememberCheckbox.checked = true;
    }
  }

  const passwordToggle = document.getElementById('kair-password-toggle');
  const passwordToggleIcon = passwordToggle.querySelector('i');
  passwordToggle.addEventListener('click', function() {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      passwordToggleIcon.classList.remove('bi-eye-slash');
      passwordToggleIcon.classList.add('bi-eye');
    } else {
      passwordInput.type = 'password';
      passwordToggleIcon.classList.remove('bi-eye');
      passwordToggleIcon.classList.add('bi-eye-slash');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    errorDiv.textContent = '';
    errorDiv.classList.remove('kair-auth-error-visible');
    emailInput.classList.remove('kair-auth-input-error');
    passwordInput.classList.remove('kair-auth-input-error');

    // Guard contra doble-submit: si ya hay un login en curso, ignorar
    // clics/Enter adicionales. Esto evita que el IPC authLoginV1 se
    // dispare múltiples veces y cause la "doble carga" que el usuario veía.
    if (button.disabled) return;

    try {
      button.classList.add('kair-auth-button-loading');
      button.disabled = true; // ← FIX: deshabilitar botón mientras login está en vuelo

      const result = await window.electronAPI.authLoginV1({ email, password });

      button.classList.remove('kair-auth-button-loading');

      if (!result || !result.success) {
        const msg = result?.error?.message || 'Credenciales inválidas.';
        errorDiv.textContent = msg;
        errorDiv.classList.add('kair-auth-error-visible');
        emailInput.classList.add('kair-auth-input-error');
        passwordInput.classList.add('kair-auth-input-error');
        return;
      }

      // Login exitoso - ejecutar transición
      authToken = result.data.token;
      currentUser = result.data.user;
      assignedCompanies = (result.data.companies || []).map(c => c.company_key || c.company_name || c.company_key);
      companyRoleByKey = {};
      (result.data.companies || []).forEach(c => {
        const key = c.company_key || c.company_name || c.display_name;
        if (key) companyRoleByKey[key] = c.role;
      });
      localStorage.setItem(AUTH_TOKEN_KEY, authToken);

      if (rememberCheckbox.checked) {
        localStorage.setItem('kair_remembered_email', email);
        localStorage.setItem('kair_remembered_password', password);
      } else {
        localStorage.removeItem('kair_remembered_email');
        localStorage.removeItem('kair_remembered_password');
      }

      // Extraer nombre del usuario para la transición
      const userName = email.split('@')[0].split('.')[0].charAt(0).toUpperCase() + email.split('@')[0].split('.')[0].slice(1);

      // Ejecutar transición visual
      await executeLoginTransition(userName);

      // Continuar con la inicialización normal
      await window.electronAPI.companiesSyncV1({ token: authToken });
      initializeApp(assignedCompanies);
    } catch (err) {
      button.classList.remove('kair-auth-button-loading');
      errorDiv.textContent = 'Error al iniciar sesión.';
      errorDiv.classList.add('kair-auth-error-visible');
      emailInput.classList.add('kair-auth-input-error');
      passwordInput.classList.add('kair-auth-input-error');
      console.error('Login error:', err);
    } finally {
      // Re-habilitar el botón siempre (éxito, error, o doble click).
      // Si el login fue exitoso, el form se destruye durante la transición
      // y este re-habilitar no tiene efecto visible.
      button.disabled = false;
    }
  });

  // Limpiar error al escribir
  emailInput.addEventListener('input', () => {
    errorDiv.classList.remove('kair-auth-error-visible');
    emailInput.classList.remove('kair-auth-input-error');
    passwordInput.classList.remove('kair-auth-input-error');
  });

  passwordInput.addEventListener('input', () => {
    errorDiv.classList.remove('kair-auth-error-visible');
    emailInput.classList.remove('kair-auth-input-error');
    passwordInput.classList.remove('kair-auth-input-error');
  });
}

async function loadAssignedCompaniesFromSession(token) {
  const assignmentsResult = await window.electronAPI.assignmentsListV1({ token });
  if (!assignmentsResult || !assignmentsResult.success) {
    return { success: false, error: assignmentsResult?.error };
  }
  const list = assignmentsResult.data.assignments || [];
  const unique = Array.from(new Set(list.map(a => a.company_key)));
  return { success: true, companies: unique };
}

async function initializeAuthFlow() {
  authToken = null;
  currentUser = null;
  assignedCompanies = [];
  companyRoleByKey = {};
  localStorage.removeItem(AUTH_TOKEN_KEY);
  
  // Destruir efecto Vanta existente si hay uno
  if (window.vantaEffect && typeof window.vantaEffect.destroy === 'function') {
    window.vantaEffect.destroy();
    window.vantaEffect = null;
  }
  if (window.updateVantaEffect) {
    window.removeEventListener('resize', window.updateVantaEffect);
    window.updateVantaEffect = null;
  }
  
  renderLoginScreen();
}

function initializeApp(overrideCompanies = null) {
  console.log('Initializing app...');
  setAuthUIState(true);
  // Crear los botones del menú lateral
  createSidebarButtons();
  // Mostrar la página de inicio por defecto
  showHomePage(overrideCompanies);
}

// --- Funciones de Navegación y UI ---

function createSidebarButtons(activeModules = null) {
  console.log('Creating sidebar buttons...', activeModules ? `Filtrando por: ${activeModules.length} módulos activos` : 'Mostrando todos');

  // ✅ LIMPIAR REFERENCIA AL BOTÓN ACTIVO ANTERIOR (el DOM va a ser eliminado)
  if (window.activeSidebarButton) {
    console.log('⚠️ [SIDEBAR] Limpiando referencia a botón activo anterior antes de reconstruir');
    window.activeSidebarButton = null;
  }

  // Limpiar el menú existente
  sidebarMenu.innerHTML = '';

  // Header de sección "MÓDULOS DEL SISTEMA" (solo cuando hay módulos, no en home)
  const headerLi = document.createElement('li');
  headerLi.className = 'sidebar-modules-header-li';
  headerLi.innerHTML = '<div class="sidebar-modules-header">Módulos del Sistema</div>';
  sidebarMenu.appendChild(headerLi);

  // Separar "Salir" del resto — se renderiza como footer al final
  const modules = SIDEBAR_BUTTONS.filter(b => b.name !== 'Salir');
  const salir = SIDEBAR_BUTTONS.find(b => b.name === 'Salir');

  modules.forEach((item) => {
    // FILTRADO DINÁMICO:
    // Si activeModules está definido (no es null), filtramos.
    // El botón "Salir" SIEMPRE se muestra.
    if (activeModules && !activeModules.includes(item.name)) {
      return; // No crear este botón
    }

    const li = document.createElement('li');
    li.className = 'sidebar-module-card-li';

    const card = document.createElement('button');
    card.className = 'sidebar-module-card';
    card.setAttribute('type', 'button');
    card.setAttribute('data-module', item.name);
    card.setAttribute('aria-label', item.name);

    // Caja del icono con color de fondo (tono pastel por módulo)
    const iconWrap = document.createElement('span');
    iconWrap.className = 'sidebar-module-icon';
    iconWrap.style.backgroundColor = item.iconBg || '#F3F4F6';

    const iconImg = document.createElement('img');
    iconImg.src = `assets/${item.icon}`;
    iconImg.alt = '';
    iconImg.className = 'sidebar-module-icon-img';
    iconWrap.appendChild(iconImg);

    // Bloque de texto (título + subtítulo)
    const textWrap = document.createElement('span');
    textWrap.className = 'sidebar-module-text';

    const titleEl = document.createElement('span');
    titleEl.className = 'sidebar-module-title';
    titleEl.textContent = item.name;

    const subtitleEl = document.createElement('span');
    subtitleEl.className = 'sidebar-module-subtitle';
    subtitleEl.textContent = item.subtitle || '';

    textWrap.appendChild(titleEl);
    textWrap.appendChild(subtitleEl);

    card.appendChild(iconWrap);
    card.appendChild(textWrap);

    card.addEventListener('click', () => {
      if (currentCompany) {
        // ✅ Validación: No cambiar módulo si estamos en un submódulo
        if (currentSubmodule && currentModule !== item.name) {
          console.log(`ℹ️ Ignorando click en "${item.name}" porque estamos en submódulo: "${currentSubmodule}"`);
          return;
        }
        setActiveSidebarButton(card);
        showModuleContent(item.name);
      } else {
        showCustomAlert('Por favor, selecciona una empresa antes de ingresar a un módulo.');
      }
    });

    li.appendChild(card);
    sidebarMenu.appendChild(li);
  });

  // Footer: "Salir" como card separada al final, con clase para estilo distinto
  if (salir) {
    const footerLi = document.createElement('li');
    footerLi.className = 'sidebar-footer-li';

    const card = document.createElement('button');
    card.className = 'sidebar-module-card sidebar-module-card--footer';
    card.setAttribute('type', 'button');
    card.setAttribute('data-module', salir.name);
    card.setAttribute('aria-label', salir.name);

    const iconWrap = document.createElement('span');
    iconWrap.className = 'sidebar-module-icon';
    iconWrap.style.backgroundColor = salir.iconBg || '#F3F4F6';

    const iconImg = document.createElement('img');
    iconImg.src = `assets/${salir.icon}`;
    iconImg.alt = '';
    iconImg.className = 'sidebar-module-icon-img';
    iconWrap.appendChild(iconImg);

    const textWrap = document.createElement('span');
    textWrap.className = 'sidebar-module-text';

    const titleEl = document.createElement('span');
    titleEl.className = 'sidebar-module-title';
    titleEl.textContent = salir.name;

    const subtitleEl = document.createElement('span');
    subtitleEl.className = 'sidebar-module-subtitle';
    subtitleEl.textContent = salir.subtitle || '';

    textWrap.appendChild(titleEl);
    textWrap.appendChild(subtitleEl);

    card.appendChild(iconWrap);
    card.appendChild(textWrap);

    card.addEventListener('click', () => {
      handleLogout();
    });

    footerLi.appendChild(card);
    sidebarMenu.appendChild(footerLi);
  }

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

async function showHomePage(overrideCompanies = null) {
  // ✅ LIMPIAR ESTADO
  currentSubmodule = null;
  // ✅ Pasar contentArea a hideCalendar
  hideCalendar(contentArea);
  console.log('Showing home page...');

// --- OCULTAR SIDEBAR EN HOME PRINCIPAL ---
const sidebar = document.getElementById('sidebar');
if (sidebar) {
sidebar.classList.add('sidebar-hidden');
}

const mainContainerForHome = document.querySelector('.main-container');
if (mainContainerForHome) mainContainerForHome.classList.add('vanta-fullscreen');

// Cargar dinámicamente las empresas desde la configuración
  let dynamicCompanies = [];
  
  // === FUNCIÓN AUXILIAR PARA VERIFICAR SI ES ADMIN ===
  function checkIsAdmin() {
    if (!currentUser || !currentUser.companies) return false;
    return currentUser.companies.some(c => {
      const role = (c.role || '').toLowerCase();
      return role === 'administrador' || role === 'administrador del sistema';
    });
  }
  
  // === FILTRAR EMPRESAS SEGÚN PERMISOS DEL USUARIO ===
  if (Array.isArray(overrideCompanies)) {
    // Si se proporcionan empresas específicas (ej: desde login), usarlas
    dynamicCompanies = overrideCompanies;
    console.log('📋 Mostrando empresas desde overrideCompanies:', dynamicCompanies.length);
  } else if (assignedCompanies && assignedCompanies.length > 0 && !checkIsAdmin()) {
    // === USUARIO NO-ADMIN: Solo mostrar empresas asignadas ===
    dynamicCompanies = assignedCompanies;
    console.log('👤 Usuario NO-ADMIN: mostrando solo empresas asignadas:', dynamicCompanies.length);
  } else {
    // === ADMINISTRADOR: Mostrar todas las empresas ===
    try {
      const config = await window.electronAPI.loadConfig();
      if (config.companyPaths) {
        dynamicCompanies = Object.keys(config.companyPaths);
      }
    } catch (error) {
      console.error('Error al cargar la configuración de empresas:', error);
      // Si hay un error, usar la constante existente como fallback
      dynamicCompanies = ["Tempoactiva", "Temposum", "Aseplus", "Asel"];
    }
    console.log('👑 Usuario ADMIN: mostrando todas las empresas:', dynamicCompanies.length);
  }

  // Limpiar el área de contenido
  contentArea.innerHTML = '';

  // Crear contenedor principal
  const homePageDiv = document.createElement('div');
  homePageDiv.id = 'home-page';
  homePageDiv.style.position = 'relative';
  homePageDiv.style.width = '100%';
  homePageDiv.style.height = '100%';
  homePageDiv.style.overflow = 'hidden'; // Asegurar que la animación no se salga del contenedor
  console.log('Created homePageDiv:', homePageDiv);

  // Aplicar la animación de Vanta al contenedor principal
  // Usar setTimeout para asegurar que el elemento esté en el DOM antes de aplicar la animación
  setTimeout(() => {
    if (typeof VANTA !== 'undefined' && typeof VANTA.WAVES !== 'undefined') {
      // Asegurar que no haya animaciones previas
      if (window.vantaEffect && typeof window.vantaEffect.destroy === 'function') {
        window.vantaEffect.destroy();
      }
      window.vantaEffect = VANTA.WAVES({
        el: homePageDiv,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x6a7f9b,
        shininess: 36.00,
        waveHeight: 16.00,
        waveSpeed: 1.20,
        zoom: 0.68
      });

      // Función para actualizar la animación cuando cambia el tamaño
      window.updateVantaEffect = function() {
        if (window.vantaEffect && typeof window.vantaEffect.resize === 'function') {
          window.vantaEffect.resize();
        }
      };

      // Escuchar cambios de tamaño en la ventana
      window.addEventListener('resize', window.updateVantaEffect);

      console.log('Animación de Vanta aplicada correctamente');
    } else {
      console.error('VANTA no está disponible. Puede que los scripts no se hayan cargado correctamente.');
    }
  }, 100); // Pequeño retraso para asegurar que el elemento esté en el DOM

  // Crear contenedor para los elementos de UI con posición absoluta encima de la animación
  const uiContainer = document.createElement('div');
  uiContainer.style.position = 'absolute';
  uiContainer.style.top = '0';
  uiContainer.style.left = '0';
  uiContainer.style.width = '100%';
  uiContainer.style.height = '100%';
  uiContainer.style.display = 'flex';
  uiContainer.style.flexDirection = 'column';
  uiContainer.style.justifyContent = 'center';
  uiContainer.style.alignItems = 'center';
  uiContainer.style.zIndex = '10'; // Asegurar que esté encima de la animación

  // Placeholder para la imagen de bienvenida
  // En una implementación completa, se cargaría una imagen real
  const welcomePlaceholder = document.createElement('div');
  welcomePlaceholder.id = 'welcome-placeholder';
  welcomePlaceholder.textContent = '¡Bienvenido al SG-SST! Selecciona una empresa para comenzar.';
  welcomePlaceholder.style.color = 'white';
  welcomePlaceholder.style.fontSize = '24px';
  welcomePlaceholder.style.textAlign = 'center';
  welcomePlaceholder.style.marginBottom = '20px';
  welcomePlaceholder.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
  uiContainer.appendChild(welcomePlaceholder);

  // Contenedor para los botones de selección de empresa
  const companySelectionDiv = document.createElement('div');
  companySelectionDiv.id = 'company-selection';
  companySelectionDiv.style.textAlign = 'center';

  // Mostrar mensaje si no hay empresas registradas
  if (dynamicCompanies.length === 0) {
    const noCompaniesMessage = document.createElement('p');
    noCompaniesMessage.textContent = Array.isArray(overrideCompanies)
      ? 'No tienes empresas asignadas. Contacta a administración.'
      : 'No hay empresas registradas. Por favor, crea una empresa en la sección de configuración.';
    noCompaniesMessage.style.color = 'white';
    noCompaniesMessage.style.fontSize = '18px';
    noCompaniesMessage.style.textAlign = 'center';
    noCompaniesMessage.style.marginBottom = '20px';
    noCompaniesMessage.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    uiContainer.appendChild(noCompaniesMessage);
  } else {
    dynamicCompanies.forEach(companyName => {
      const button = document.createElement('button');
      button.className = 'company-select-button';
      button.textContent = companyName;
      button.style.margin = '5px';
      button.addEventListener('click', () => selectCompany(companyName, button));
      companySelectionDiv.appendChild(button);
    });
  }

  uiContainer.appendChild(companySelectionDiv);
  homePageDiv.appendChild(uiContainer);

  contentArea.appendChild(homePageDiv);
  console.log('Added home page to contentArea');
}

async function selectCompany(companyName, buttonElement) {
console.log(`Selecting company: ${companyName}`);
currentCompany = companyName;

// 📦 Alertas calendario — refrescar badge al cambiar de empresa (los pendientes
// son por empresa). El módulo puede no estar cargado aún (caso de login inicial);
// el init() se hace en el bloque DOMContentLoaded y ya hace su propio refresh.
if (window.KairAlerts && typeof window.KairAlerts.refresh === 'function') {
  window.KairAlerts.refresh();
}

const mainContainerSel = document.querySelector('.main-container');
if (mainContainerSel) mainContainerSel.classList.remove('vanta-fullscreen');

// --- MOSTRAR SIDEBAR AL SELECCIONAR EMPRESA ---
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.remove('sidebar-hidden');
    // 2026-06-27: asegurar que permanezca colapsado + activar hotspot
    sidebar.classList.add('sidebar-collapsed');
    const hotspot = document.getElementById('sidebar-hotspot');
    if (hotspot) hotspot.classList.add('active');
  }

  // Cargar la normativa si aún no se ha hecho
  if (!normativaData) {
    await cargarNormativa();
  }

  // Obtener la configuración de la empresa para determinar el escenario normativo
  try {
    const config = await window.electronAPI.loadConfig();
    const empresa = config.companyPaths && config.companyPaths[companyName] ?
      { nombre: companyName, stats: config.companyPaths[companyName].stats } :
      { nombre: companyName, stats: { employees: 0, risk: 'I' } }; // Valores por defecto

    // Determinar el escenario normativo basado en los datos de la empresa
    const escenario = determinarEscenarioNormativo(empresa);

    // Filtrar los módulos y submódulos según el escenario normativo
    RESOURCES_SUBMODULES = filtrarModulosPorNormativa(escenario);
    const currentRole = companyRoleByKey[companyName] || '';
    RESOURCES_SUBMODULES = filterModulesByPermissions(RESOURCES_SUBMODULES, currentRole);

    console.log(`Módulos filtrados para la empresa ${companyName} (escenario: ${escenario}):`, RESOURCES_SUBMODULES);

    // --- ACTUALIZACIÓN DINÁMICA DEL SIDEBAR ---
    // Extraer los nombres de los módulos que tienen contenido (submódulos activos)
    const activeModuleNames = Object.keys(RESOURCES_SUBMODULES);
    // Reconstruir el sidebar mostrando solo los módulos activos
    createSidebarButtons(activeModuleNames);
    
    // ✅ LIMPIAR BOTÓN ACTIVO PREVIO (nueva empresa, nuevo sidebar)
    if (window.activeSidebarButton) {
      window.activeSidebarButton.classList.remove('active');
      window.activeSidebarButton = null;
    }

  } catch (error) {
    console.error('Error al cargar la configuración de la empresa o aplicar normativa:', error);
    // Si hay un error, usar los módulos completos como fallback
    const currentRole = companyRoleByKey[companyName] || '';
    RESOURCES_SUBMODULES = filterModulesByPermissions(ALL_SUBMODULES, currentRole);
    // Restaurar sidebar completo en caso de error
    createSidebarButtons(null);
  }

  // Actualizar UI: nombre de la empresa en el botón Home del header
  if (headerCompanyNameElement) {
    headerCompanyNameElement.textContent = companyName;
  }

  // Actualizar estado visual de los botones de empresa
  document.querySelectorAll('.company-select-button').forEach(btn => {
    btn.classList.remove('selected');
  });
  buttonElement.classList.add('selected');

  // Aquí se podría notificar al proceso principal para que inicie
  // el backend Python asociado a esta empresa.
  console.log(`Empresa seleccionada: ${companyName}`);

  // Establecer la empresa también en el contexto global
  window.currentCompany = companyName;

  // 📦 Alertas calendario — refrescar al cambiar de empresa.
  if (window.KairAlerts && typeof window.KairAlerts.refresh === 'function') {
    window.KairAlerts.refresh();
  }

  // Destruir la animación de Vanta antes de cambiar de página
  if (window.vantaEffect && typeof window.vantaEffect.destroy === 'function') {
    window.vantaEffect.destroy();
    window.vantaEffect = null;
  }
  // Eliminar el listener de resize si existe
  if (window.updateVantaEffect) {
    window.removeEventListener('resize', window.updateVantaEffect);
    window.updateVantaEffect = null;
  }

  // Después de seleccionar empresa, mostrar el home de la empresa
  showCompanyHomePage();
}

/**
 * Muestra/oculta el bloque de empresa activa en el header (label con nombre + botón Home).
 */
function setCompanyHeaderVisibility(visible) {
  const display = visible ? 'flex' : 'none';
  if (companyHomeButton) companyHomeButton.style.display = display;
  if (headerCompanyLabel) headerCompanyLabel.style.display = visible ? 'flex' : 'none';
}

/**
 * Maneja el clic en el botón "Home Empresa" para regresar al dashboard de la empresa actual.
 */
function handleCompanyHome() {
  if (!currentCompany) {
    setCompanyHeaderVisibility(false);
    return;
  }
  
  console.log('[NAV] Volviendo al home de la empresa:', currentCompany);
  
  // Resetear módulo y submódulo actual
  currentModule = null;
  currentSubmodule = null;
  
  // Ocultar calendario si existe
  hideCalendar(contentArea);
  
  // Mostrar home de la empresa
  showCompanyHomePage();
  
  // Resetear sidebar activo
  if (window.activeSidebarButton) {
    window.activeSidebarButton.classList.remove('active');
    window.activeSidebarButton = null;
  }
  
  // Ocultar botón home porque YA estamos en home
  setCompanyHeaderVisibility(false);
}

async function handleLogout() {
console.log('Handling logout...');
currentCompany = null;
currentModule = null;
currentSubmodule = null;

const mainContainerLogout = document.querySelector('.main-container');
if (mainContainerLogout) mainContainerLogout.classList.add('vanta-fullscreen');

// Resetear UI
  if (headerCompanyNameElement) {
    headerCompanyNameElement.textContent = '—';
  }

  document.querySelectorAll('.company-select-button').forEach(btn => {
    btn.classList.remove('selected');
  });

  // Destruir la animación de Vanta si existe antes de volver al home
  if (window.vantaEffect && typeof window.vantaEffect.destroy === 'function') {
    window.vantaEffect.destroy();
    window.vantaEffect = null;
  }
  // Eliminar el listener de resize si existe
  if (window.updateVantaEffect) {
    window.removeEventListener('resize', window.updateVantaEffect);
    window.updateVantaEffect = null;
  }

  // Cerrar sesión si existe token
  if (authToken) {
    try {
      await window.electronAPI.authLogoutV1({ token: authToken });
    } catch (e) {
      console.warn('Error al cerrar sesión en backend:', e);
    }
  }

  authToken = null;
  currentUser = null;
  assignedCompanies = [];
  companyRoleByKey = {};
  localStorage.removeItem(AUTH_TOKEN_KEY);

  // Restaurar el sidebar completo (mostrar todos los botones)
  createSidebarButtons(null);

  // Desactivar botón de sidebar
  if (window.activeSidebarButton) {
    window.activeSidebarButton.classList.remove('active');
    window.activeSidebarButton = null;
  }

  // Ocultar botón home empresa porque NO hay empresa seleccionada
  setCompanyHeaderVisibility(false);

  renderLoginScreen();
  console.log('Usuario desconectado.');
}

function showCompanyHomePage() {
// ✅ LIMPIAR ESTADO
currentSubmodule = null;

const mainContainerDash = document.querySelector('.main-container');
if (mainContainerDash) mainContainerDash.classList.remove('vanta-fullscreen');

// ✅ LIMPIAR BOTÓN ACTIVO DEL SIDEBAR (estamos en dashboard, no en módulo)
  if (window.activeSidebarButton) {
    window.activeSidebarButton.classList.remove('active');
    window.activeSidebarButton = null;
  }
  
  // Destruir la animación de Vanta si existe
  if (window.vantaEffect && typeof window.vantaEffect.destroy === 'function') {
    window.vantaEffect.destroy();
    window.vantaEffect = null;
  }
  // Eliminar el listener de resize si existe
  if (window.updateVantaEffect) {
    window.removeEventListener('resize', window.updateVantaEffect);
    window.updateVantaEffect = null;
  }
  // ✅ Pasar contentArea a hideCalendar
  hideCalendar(contentArea);
  console.log(`Showing dashboard for company: ${currentCompany}`);

  // Ocultar botón home porque YA estamos en home de empresa
  setCompanyHeaderVisibility(false);

  // Asegurar que el sidebar permanezca colapsado + activar hotspot
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.add('sidebar-collapsed');
    const hotspot = document.getElementById('sidebar-hotspot');
    if (hotspot) hotspot.classList.add('active');
  }

  contentArea.innerHTML = '';

  // Crear el contenedor principal del dashboard
  const mainCanvas = document.createElement('div');
  mainCanvas.className = 'main-canvas';
  mainCanvas.style.cssText = 'width: 100%; height: 100%; overflow: hidden;';

  // ==========================================
  // DASHBOARD K+AIR - COMMAND CENTER
  // ==========================================

  const dashboardContainer = document.createElement('div');
  dashboardContainer.style.cssText = `
    width: 100%;
    height: 100%;
    background: #f0f2f5;
    font-family: 'Inter', sans-serif;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;



  // --- KPIs: k-stats-ribbon (estandar Capacitaciones/Inducciones) ---
  const kpiRibbon = document.createElement('section');
  kpiRibbon.className = 'k-stats-ribbon dashboard-kpi-ribbon';
  kpiRibbon.style.cssText = 'margin: 20px 30px 0;';

  const kpiItems = [
    { id: 'kpi-accidents', icon: 'fa-shield-alt', label: 'Accidentes (Año)', colorClass: 'warning' },
    { id: 'kpi-pric', icon: 'fa-user-injured', label: 'Casos PRIC Activos', colorClass: 'primary' },
    { id: 'kpi-overdue', icon: 'fa-calendar-times', label: 'Documentos Vencidos', colorClass: 'danger' },
    { id: 'kpi-compliance', icon: 'fa-chart-line', label: 'Plan de Trabajo', colorClass: 'success' }
  ];

  kpiItems.forEach((kpi, index) => {
    const item = document.createElement('div');
    item.className = 'k-stats-ribbon__item';
    item.innerHTML = `
      <span class="k-stats-ribbon__icon ${kpi.colorClass}">
        <i class="fas ${kpi.icon}"></i>
      </span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value" id="${kpi.id}">-</span>
        <span class="k-stats-ribbon__label">${kpi.label}</span>
      </div>
    `;
    kpiRibbon.appendChild(item);

    if (index < kpiItems.length - 1) {
      const divider = document.createElement('div');
      divider.className = 'k-stats-ribbon__divider';
      kpiRibbon.appendChild(divider);
    }
  });

  dashboardContainer.appendChild(kpiRibbon);

  // --- MAIN GRID ---
  const mainGrid = document.createElement('div');
  mainGrid.style.cssText = `
    flex: 1;
    display: grid;
    grid-template-columns: 280px 1fr;
    grid-template-rows: 1fr;
    gap: 20px;
    padding: 10px 30px 20px;
    min-height: 0;
  `;

  // --- PANEL IZQUIERDO: MÓDULOS ---
  const modulesPanel = document.createElement('aside');
  modulesPanel.style.cssText = `
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  const panelHeader = document.createElement('div');
  panelHeader.style.cssText = `
    padding: 15px; border-bottom: 1px solid #e2e8f0; font-size: 12px;
    color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;
    background: #f8fafc;
  `;
  panelHeader.textContent = 'Módulos del Sistema';
  modulesPanel.appendChild(panelHeader);

  const moduleList = document.createElement('div');
  moduleList.setAttribute('data-module-list', 'true');
  moduleList.style.cssText = 'flex: 1; overflow-y: auto; padding: 10px;';

  const modulesData = [
    { name: 'Recursos', subtitle: 'Capacitación, Roles', icon: 'fa-users-cog', badge: 'Cargando...', badgeClass: 'bg-orange', active: false },
    { name: 'Gestión Integral', subtitle: 'Política, Planes', icon: 'fa-file-contract', badge: '-', badgeClass: 'bg-green', active: false },
    { name: 'Gestión de la Salud', subtitle: 'Ausentismo, AT, EL', icon: 'fa-heartbeat', badge: '-', badgeClass: 'bg-green', active: false },
    { name: 'Gestión de Peligros y Riesgos', subtitle: 'IPERC, Controles', icon: 'fa-radiation-alt', badge: '-', badgeClass: null, active: false },
    { name: 'Gestión de Amenazas', subtitle: 'Emergencias', icon: 'fa-biohazard', badge: '-', badgeClass: null, active: false },
    { name: 'Verificación', subtitle: 'Auditorías', icon: 'fa-check-double', badge: '-', badgeClass: null, active: false },
    { name: 'Mejoramiento', subtitle: 'Acciones Correctivas', icon: 'fa-chart-line', badge: '-', badgeClass: null, active: false }
  ];

  modulesData.forEach(mod => {
    const item = document.createElement('div');
    item.setAttribute('data-module-name', mod.name);
    item.style.cssText = `
      display: flex; align-items: center; padding: 12px;
      border-radius: 6px; margin-bottom: 5px; cursor: pointer;
      border: 1px solid transparent; transition: all 0.2s;
      background: transparent;
      border-color: transparent;
    `;
    item.onmouseover = function() {
      const isActive = this.getAttribute('data-module-active') === 'true';
      if (!isActive) { this.style.background = '#f8fafc'; this.style.borderColor = '#e2e8f0'; }
    };
    item.onmouseout = function() {
      const isActive = this.getAttribute('data-module-active') === 'true';
      if (!isActive) { this.style.background = 'transparent'; this.style.borderColor = 'transparent'; }
    };
    item.onclick = function(e) {
      e.stopPropagation();
      filterDashboardTasksByModule(mod.name);
    };

    const badgeId = `module-badge-${mod.name.replace(/\s+/g, '-').toLowerCase()}`;
    const badgeHtml = mod.badge ? `<span id="${badgeId}" data-module="${mod.name}" style="margin-left: auto; font-size: 10px; padding: 4px 10px; border-radius: 12px; font-weight: 600; background: ${getBadgeColor(mod.badgeClass)}; color: ${getBadgeTextColor(mod.badgeClass)}; cursor: pointer; border: 1px solid rgba(0,0,0,0.1);" title="Click para ver alertas de ${mod.name}"><i class="fas fa-filter" style="font-size: 8px; margin-right: 3px;"></i>${mod.badge}</span>` : '';

    item.innerHTML = `
      <div style="width: 36px; height: 36px; border-radius: 6px; background: #f1f5f9; color: #174ea6; display: flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 14px;">
        <i class="fas ${mod.icon}"></i>
      </div>
      <div style="flex: 1;">
        <h4 style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 1px;">${mod.name}</h4>
        <span style="font-size: 11px; color: #94a3b8;">${mod.subtitle}</span>
      </div>
      ${badgeHtml}
    `;

    // Agregar event listener al badge para filtrar tareas
    const badgeEl = item.querySelector(`#${badgeId}`);
    if (badgeEl) {
      badgeEl.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        const moduleName = this.getAttribute('data-module');
        filterDashboardTasksByModule(moduleName);
      };
    }
    
    moduleList.appendChild(item);
  });

  modulesPanel.appendChild(moduleList);
  mainGrid.appendChild(modulesPanel);

  // --- PANEL DERECHO: TAREAS ---
  const tasksPanel = document.createElement('main');
  tasksPanel.style.cssText = `
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  `;

  const tasksHeader = document.createElement('div');
  tasksHeader.id = 'tasks-panel-header';
  tasksHeader.style.cssText = `
    padding: 15px 20px;
    border-bottom: 1px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: center;
  `;
  tasksHeader.innerHTML = `
    <h2 style="font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin: 0;">
      <i class="fas fa-tasks" style="color: #174ea6;"></i> Pendientes y Tareas
    </h2>
    <div style="display: flex; gap: 5px;">
      <button class="filter-btn active" style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: #174ea6; color: white; border: none; cursor: pointer;">Todos</button>
      <button class="filter-btn" style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: transparent; border: none; cursor: pointer; color: #64748b;">Críticos</button>
      <button class="filter-btn" style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: transparent; border: none; cursor: pointer; color: #64748b;">Hoy</button>
    </div>
  `;
  tasksPanel.appendChild(tasksHeader);

  const tasksList = document.createElement('div');
  tasksList.id = 'tasks-container';
  tasksList.style.cssText = 'flex: 1; overflow-y: auto; padding: 15px 20px;';
  tasksList.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #94a3b8;">
      <i class="fas fa-spinner fa-spin" style="font-size: 32px; margin-bottom: 10px;"></i>
      <p>Cargando datos del dashboard...</p>
    </div>
  `;
  tasksPanel.appendChild(tasksList);
  mainGrid.appendChild(tasksPanel);
  dashboardContainer.appendChild(mainGrid);
  mainCanvas.appendChild(dashboardContainer);
  contentArea.appendChild(mainCanvas);

  // Funciones auxiliares para colores
  function getBadgeColor(cls) {
    if (cls === 'bg-red') return '#fee2e2';
    if (cls === 'bg-orange') return '#ffedd5';
    if (cls === 'bg-green') return '#dcfce7';
    return '#e0e7ff';
  }
  function getBadgeTextColor(cls) {
    if (cls === 'bg-red') return '#b91c1c';
    if (cls === 'bg-orange') return '#c2410c';
    if (cls === 'bg-green') return '#166534';
    return '#3730a3';
  }

  // ==========================================
  // CARGAR DATOS DINÁMICOS DEL DASHBOARD
  // ==========================================
  loadDashboardData();
}

// Función para cargar datos del dashboard
async function loadDashboardData() {
  console.log('🔍 [DASHBOARD] loadDashboardData INICIANDO para:', currentCompany);

    const tasksContainer = document.getElementById('tasks-container');

    console.log('🔍 [DASHBOARD] tasks-container:', tasksContainer);

  try {
    console.log('🔍 [DASHBOARD] Llamando a window.electronAPI.getDashboardSummary...');
    const response = await window.electronAPI.getDashboardSummary(currentCompany);
    console.log('🔍 [DASHBOARD] Respuesta recibida:', response);

    if (response.success && response.data) {
      const data = response.data;
      
      // Guardar datos para filtrado posterior
      currentDashboardData = data;
      console.log('🔍 [DASHBOARD] Datos guardados en currentDashboardData:', data);
      
      console.log('🔍 [DASHBOARD] Datos procesados:', data);
      console.log('🔍 [DASHBOARD] KPIs:', data.kpis);
      console.log('🔍 [DASHBOARD] Tasks:', data.tasks);
      console.log('🔍 [DASHBOARD] Module Status:', data.module_status);
      console.log('🔍 [DASHBOARD] Recursos Alerts:', data.kpis?.recursos_alerts);

      // Actualizar KPIs (k-stats-ribbon)
      const kpiAccidents = document.getElementById('kpi-accidents');
      const kpiPric = document.getElementById('kpi-pric');
      const kpiOverdue = document.getElementById('kpi-overdue');
      const kpiCompliance = document.getElementById('kpi-compliance');

      if (kpiAccidents) kpiAccidents.textContent = data.kpis.accidents_year || '0';
      if (kpiPric) kpiPric.textContent = data.kpis.pric_active || '0';
      if (kpiOverdue) kpiOverdue.textContent = data.kpis.overdue_docs || '0';
      if (kpiCompliance) kpiCompliance.textContent = (data.kpis.compliance || '0') + '%';

      // Actualizar badge de notificaciones
        const totalTasks = data.tasks ? data.tasks.length : 0;
        console.log('🔍 [DASHBOARD] Total tasks:', totalTasks);

        // Renderizar tareas
      console.log('🔍 [DASHBOARD] Llamando a renderTasks()');
      renderTasks(data.tasks || []);

      // Actualizar badges de módulos
      const recursosAlerts = data.kpis?.recursos_alerts || 0;
      const gestionSaludAlerts = data.kpis?.gestion_salud_alerts || 0;
      console.log('🔍 [DASHBOARD] Llamando a updateModuleBadges con recursos_alerts:', recursosAlerts, 'gestion_salud_alerts:', gestionSaludAlerts);
        updateModuleBadges(data.module_status || {}, recursosAlerts, gestionSaludAlerts);

        console.log('🔍 [DASHBOARD] loadDashboardData COMPLETADO');

    } else {
      console.error('[DASHBOARD] Error en respuesta:', response.error);
      if (tasksContainer) {
        tasksContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #ef4444;">
            <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px;"></i>
            <p>Error al cargar datos del dashboard</p>
            <p style="font-size: 12px; margin-top: 5px;">${response.error || 'Error desconocido'}</p>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('[DASHBOARD] Error crítico:', error);
    console.error('[DASHBOARD] Stack:', error.stack);
    if (tasksContainer) {
      tasksContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ef4444;">
          <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px;"></i>
          <p>Error de conexión con el backend</p>
          <p style="font-size: 12px; margin-top: 5px;">${error.message}</p>
        </div>
      `;
    }
  }
}

// Variables para el filtro de tareas
let currentDashboardData = null;
let currentFilterModule = null;

/**
 * Filtra las tareas del dashboard por módulo
 */
function filterDashboardTasksByModule(moduleName) {
  console.log('🔍 [DASHBOARD] Filtrando tareas para módulo:', moduleName);

  if (!currentDashboardData) {
    console.warn('[DASHBOARD] No hay datos del dashboard para filtrar');
    return;
  }

  // Mapeo de módulos a tipos de tareas
  const moduleTaskMap = {
    'Recursos': ['capacitaciones', 'epp', 'copasst', 'comite_convivencia', 'presupuesto', 'afiliacion', 'inducciones'],
    'Gestión de la Salud': ['ausentismo', 'investigacion', 'pric', 'inducciones'],
    'Gestión Integral': ['plan-trabajo', 'rendicion', 'politica'],
    'Peligros': ['iperc', 'controles'],
    'Amenazas': ['emergencias'],
    'Verificación': ['auditorias'],
    'Mejoramiento': ['acciones-correctivas', 'acciones-preventivas']
  };

  const taskTypes = moduleTaskMap[moduleName] || [];

  // Filtrar tareas actuales
  const filteredTasks = currentDashboardData.tasks.filter(task =>
    taskTypes.includes(task.module)
  );

  // Guardar filtro actual
  currentFilterModule = moduleName;

  // Actualizar UI del header
  updateFilterUI(moduleName, filteredTasks.length);
  
  // ✅ ACTUALIZAR VISUALMENTE EL MÓDULO SELECCIONADO
  updateModuleSelection(moduleName);

  // Re-renderizar panel de tareas
  renderTasks(filteredTasks, moduleName);

  console.log(`🔍 [DASHBOARD] Tareas filtradas: ${filteredTasks.length} de ${currentDashboardData.tasks.length}`);
}

/**
 * Actualiza visualmente el módulo seleccionado en el panel de módulos
 */
function updateModuleSelection(selectedModuleName) {
  const moduleList = document.querySelector('[data-module-list]');
  if (!moduleList) return;
  
  const items = moduleList.querySelectorAll('[data-module-name]');
  items.forEach(item => {
    const moduleName = item.getAttribute('data-module-name');
    const isActive = selectedModuleName && moduleName === selectedModuleName;
    
    // Actualizar atributo data-module-active
    item.setAttribute('data-module-active', isActive ? 'true' : 'false');
    
    // Actualizar estilos
    if (isActive) {
      item.style.background = '#eff6ff';
      item.style.borderColor = '#bfdbfe';
    } else {
      item.style.background = 'transparent';
      item.style.borderColor = 'transparent';
    }
  });
  
  console.log(`🔍 [DASHBOARD] Módulo seleccionado actualizado: ${selectedModuleName || 'NINGUNO (limpiado)'}`);
}

/**
 * Limpia el filtro de tareas y muestra todas
 */
function clearFilter() {
  console.log('🔍 [DASHBOARD] Limpiando filtro');
  currentFilterModule = null;

  // Actualizar UI del header
  updateFilterUI(null, currentDashboardData?.tasks?.length || 0);
  
  // ✅ LIMPIAR SELECCIÓN DE MÓDULO
  updateModuleSelection(null);

  if (currentDashboardData) {
    renderTasks(currentDashboardData.tasks || []);
  }
}

// Hacer clearFilter accesible globalmente para el onclick del botón
window.clearFilter = clearFilter;

/**
 * Actualiza la UI del header para mostrar filtro activo
 */
function updateFilterUI(moduleName, taskCount) {
  const tasksHeader = document.querySelector('#tasks-panel-header');
  if (!tasksHeader) return;

  if (moduleName) {
    tasksHeader.innerHTML = `
      <h2 style="font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin: 0;">
        <i class="fas fa-filter" style="color: #174ea6;"></i>
        <span>Filtrando: ${moduleName}</span>
        <span style="font-size: 12px; color: #64748b;">(${taskCount} tareas)</span>
      </h2>
      <button onclick="clearFilter()" style="padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #fee2e2; color: #dc2626; border: none; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'">
        <i class="fas fa-times" style="margin-right: 4px;"></i> Limpiar filtro
      </button>
    `;
  } else {
    tasksHeader.innerHTML = `
      <h2 style="font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; margin: 0;">
        <i class="fas fa-tasks" style="color: #174ea6;"></i> Pendientes y Tareas
      </h2>
      <div style="display: flex; gap: 5px;">
        <button class="filter-btn active" style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: #174ea6; color: white; border: none; cursor: pointer;">Todos</button>
        <button class="filter-btn" style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: transparent; border: none; cursor: pointer; color: #64748b;">Críticos</button>
        <button class="filter-btn" style="padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: transparent; border: none; cursor: pointer; color: #64748b;">Hoy</button>
      </div>
    `;
  }
}

// Función para renderizar tareas
function renderTasks(tasks) {
  const container = document.getElementById('tasks-container');
  if (!container) return;
  
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #10b981;">
        <i class="fas fa-check-circle" style="font-size: 32px; margin-bottom: 10px;"></i>
        <h3 style="font-size: 16px; margin: 0;">¡Estás al día!</h3>
        <p style="font-size: 13px; color: #94a3b8; margin-top: 5px;">No hay pendientes críticos.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = tasks.map(task => `
    <div class="task-card ${task.priority || ''}"
      data-module="${(task.module || '').replace(/"/g, '&quot;')}"
      data-submodule="${(task.submodule || '').replace(/"/g, '&quot;')}"
      onclick="navigateToModule(this.dataset.module, this.dataset.submodule)"
      style="
      background: #f8fafc;
      border-radius: 6px;
      margin-bottom: 10px;
      border-left: 4px solid ${getTaskBorderColor(task.priority)};
      padding: 12px 15px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      transition: transform 0.1s, box-shadow 0.1s;
      cursor: pointer;
    " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.05)'; this.style.background='white';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'; this.style.background='#f8fafc';">
      <div style="width: 36px; height: 36px; border-radius: 6px; background: #f1f5f9; color: #174ea6; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px;">
        <i class="${task.icon || 'fas fa-tasks'}"></i>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
          <span class="tag" style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: ${getTagColor(task.priority)}; color: ${getTagTextColor(task.priority)};">${task.priority ? task.priority.toUpperCase() : 'INFO'}</span>
          ${task.submodule ? `<span style="font-size: 10px; font-weight: 500; padding: 2px 6px; border-radius: 4px; background: #e0e7ff; color: #3730a3;">${task.submodule}</span>` : ''}
        </div>
        <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 2px;">${task.title || 'Tarea sin título'}</div>
        <div style="font-size: 12px; color: #64748b; line-height: 1.3;">${task.desc || ''}</div>
      </div>
      <button style="width: 30px; height: 30px; border-radius: 50%; border: none; background: transparent; color: #94a3b8; cursor: pointer; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.background='#174ea6'; this.style.color='white'" onmouseout="this.style.background='transparent'; this.style.color='#94a3b8'">
        <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  `).join('');
}

// Función para navegar a un módulo desde una tarea
// taskSubmodule: hint opcional del submódulo (ej: "1.2.1 Programa de Capacitación")
function navigateToModule(taskModule, taskSubmodule) {
  if (!taskModule) return;
  console.log('[DASHBOARD] Navegando a módulo:', taskModule, '| hint submódulo:', taskSubmodule || '(ninguno)');

  // Mapeo de módulos internos a nombres del sidebar
  const moduleMap = {
    'ausentismo': 'Gestión de la Salud',
    'investigacion': 'Gestión de la Salud',
    'capacitaciones': 'Recursos',
    'epp': 'Recursos',
    'presupuesto': 'Recursos',
    'copasst': 'Recursos',
    'comite_convivencia': 'Recursos',
    'inducciones': 'Recursos',
    'auditorias': 'Verificación'
  };

  const targetModule = moduleMap[taskModule] || taskModule;

  // Si hay hint de submódulo, intentar navegación directa extrayendo el código numérico
  // Ej: "1.2.1 Programa de Capacitación" → código "1.2.1" → busca en RESOURCES_SUBMODULES
  if (taskSubmodule) {
    const codeMatch = String(taskSubmodule).match(/^(\d+(?:\.\d+)+)/);
    if (codeMatch) {
      const code = codeMatch[1];
      const submodules = RESOURCES_SUBMODULES[targetModule] || [];
      const exactSubmodule = submodules.find(sub =>
        sub.startsWith(code + ' ') || sub === code
      );
      if (exactSubmodule) {
        console.log(`[DASHBOARD] Navegación directa: "${targetModule}" > "${exactSubmodule}"`);
        showModuleContentWithSubmodule(targetModule, exactSubmodule);
        return;
      } else {
        console.warn(`[DASHBOARD] Código "${code}" no encontrado en ${targetModule}. Fallback a home del módulo.`);
      }
    }
  }

  // Fallback: mostrar home del módulo
  showModuleContent(targetModule);
}

/**
 * Navega directamente a un submódulo específico desde el dashboard,
 * sin pasar por el home del módulo padre.
 * Replica la estructura DOM de showModuleHome pero llama
 * showSubmoduleContent directamente sobre el moduleContentContainer.
 *
 * @param {string} moduleName   - Nombre del módulo padre (ej: "Recursos")
 * @param {string} submoduleName - Nombre exacto del submódulo según RESOURCES_SUBMODULES
 */
function showModuleContentWithSubmodule(moduleName, submoduleName) {
  console.log(`[DASHBOARD NAV] Entrada directa: "${moduleName}" > "${submoduleName}"`);

  // Validar que el módulo y submódulo existan en RESOURCES_SUBMODULES
  const submodules = RESOURCES_SUBMODULES[moduleName];
  if (!submodules || submodules.length === 0) {
    console.warn(`[DASHBOARD NAV] Sin submódulos para "${moduleName}". Redirigiendo a home del módulo.`);
    showModuleContent(moduleName);
    return;
  }

  // Limpiar estado previo (mismo orden que showModuleContent)
  currentSubmodule = null;
  currentModule = moduleName;

  // Mostrar botón home empresa
  if (currentCompany) {
    setCompanyHeaderVisibility(true);
  }

  if (!contentArea) {
    console.error('[DASHBOARD NAV] contentArea no encontrado.');
    return;
  }

  // Construir la misma estructura DOM que showModuleHome genera
  contentArea.innerHTML = '';

  const mainCanvas = document.createElement('div');
  mainCanvas.className = 'main-canvas';
  contentArea.appendChild(mainCanvas);

  hideCalendar(mainCanvas);

  const moduleContentContainer = document.createElement('div');
  moduleContentContainer.className = 'module-content-area';
  mainCanvas.appendChild(moduleContentContainer);

  // Navegar directo al submódulo
  // showSubmoduleContent se encarga de establecer currentSubmodule,
  // verificar permisos y renderizar el componente correcto.
  // Su safeBackToModuleCallback llamará showModuleContent(moduleName) → home del módulo.
  showSubmoduleContent(moduleContentContainer, moduleName, submoduleName);
}

// Helper para colores de badges
function getBadgeColor(cls) {
  if (cls === 'bg-red') return '#fee2e2';
  if (cls === 'bg-orange') return '#ffedd5';
  if (cls === 'bg-green') return '#dcfce7';
  return '#e0e7ff';
}

function getBadgeTextColor(cls) {
  if (cls === 'bg-red') return '#b91c1c';
  if (cls === 'bg-orange') return '#c2410c';
  if (cls === 'bg-green') return '#166534';
  return '#3730a3';
}

// Mapeo de claves del backend a IDs de badges en el frontend
const MODULE_KEY_TO_BADGE_ID = {
  'recursos': 'module-badge-recursos',
  'gestion-salud': 'module-badge-gestión-de-la-salud',
  'gestion-integral': 'module-badge-gestión-integral',
  'peligros': 'module-badge-gestión-de-peligros-y-riesgos',
  'amenazas': 'module-badge-gestión-de-amenazas',
  'verificacion': 'module-badge-verificación',
  'mejoramiento': 'module-badge-mejoramiento'
};

// Función para actualizar badges de módulos
function updateModuleBadges(moduleStatus, recursosAlerts = 0, gestionSaludAlerts = 0) {
  console.log('🔍 [BADGES] updateModuleBadges llamada con:', { moduleStatus, recursosAlerts, gestionSaludAlerts });

  for (const [moduleName, status] of Object.entries(moduleStatus)) {
    // Usar el mapeo para encontrar el ID correcto del badge
    const badgeId = MODULE_KEY_TO_BADGE_ID[moduleName];
    const badgeEl = document.getElementById(badgeId);

    console.log(`🔍 [BADGES] Módulo: ${moduleName}, Status: ${status}, BadgeID: ${badgeId}, Elemento: ${badgeEl ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);

    if (badgeEl) {
      // Para el módulo de recursos, mostrar el número real de alertas si hay
      if (moduleName === 'recursos' && recursosAlerts > 0) {
        badgeEl.textContent = `${recursosAlerts} Alertas`;
        badgeEl.style.background = status === 'danger' ? '#fee2e2' : (status === 'warning' ? '#ffedd5' : '#dcfce7');
        badgeEl.style.color = status === 'danger' ? '#b91c1c' : (status === 'warning' ? '#c2410c' : '#166534');
        console.log(`✅ [BADGES] ${moduleName}: "${recursosAlerts} Alertas"`);
      }
      // Para el módulo de gestión de la salud, mostrar el número real de alertas si hay
      else if (moduleName === 'gestion-salud' && gestionSaludAlerts > 0) {
        badgeEl.textContent = `${gestionSaludAlerts} Alertas`;
        badgeEl.style.background = status === 'danger' ? '#fee2e2' : (status === 'warning' ? '#ffedd5' : '#dcfce7');
        badgeEl.style.color = status === 'danger' ? '#b91c1c' : (status === 'warning' ? '#c2410c' : '#166534');
        console.log(`✅ [BADGES] ${moduleName}: "${gestionSaludAlerts} Alertas"`);
      } else {
        const statusText = status === 'danger' ? 'Alerta' : (status === 'warning' ? 'Pendiente' : 'OK');
        const statusClass = status === 'danger' ? 'bg-red' : (status === 'warning' ? 'bg-orange' : 'bg-green');
        badgeEl.textContent = statusText;
        badgeEl.style.background = getBadgeColor(statusClass);
        badgeEl.style.color = getBadgeTextColor(statusClass);
        console.log(`✅ [BADGES] ${moduleName}: "${statusText}"`);
      }
    } else {
      console.error(`❌ [BADGES] Badge NO ENCONTRADO para ${moduleName} (ID: ${badgeId})`);
    }
  }
}

// Helper para colores de tareas
function getTaskBorderColor(priority) {
  if (priority === 'critical') return '#ef4444';
  if (priority === 'warning') return '#f59e0b';
  return '#cbd5e1';
}

function getTagColor(priority) {
  if (priority === 'critical') return '#fee2e2';
  if (priority === 'warning') return '#ffedd5';
  return '#e0e7ff';
}

function getTagTextColor(priority) {
  if (priority === 'critical') return '#b91c1c';
  if (priority === 'warning') return '#c2410c';
  return '#3730a3';
}


let _showModuleContentLock = false;

function showModuleContent(moduleName) {
// ✅ GUARD: Prevenir llamadas duplicadas desde handlers de mensajes solapados
if (_showModuleContentLock) {
console.warn(`[showModuleContent] BLOCKED duplicate call for "${moduleName}" (lock active)`);
return;
}
_showModuleContentLock = true;
Promise.resolve().then(() => { _showModuleContentLock = false; });

console.log(`Showing content for module: ${moduleName}`);
// ✅ SOLUCIÓN TEMPORAL: No cambiar módulo si estamos en un submódulo
if (currentSubmodule) {
console.warn(`🚨 [showModuleContent] BLOQUEANDO cambio de módulo porque estamos en submódulo: "${currentSubmodule}"`);
return;
}

const mainContainerMod = document.querySelector('.main-container');
if (mainContainerMod) mainContainerMod.classList.remove('vanta-fullscreen');

currentModule = moduleName;
  // ✅ LIMPIAR ESTADO: Al cambiar de módulo, ya no estamos en un submódulo
  currentSubmodule = null;
  console.log(`🔍 [showModuleContent] currentModule actualizado a: ${currentModule}`);

  // Mostrar botón home empresa porque YA NO estamos en home
  if (currentCompany) {
    setCompanyHeaderVisibility(true);
  }

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

function showSubmoduleSelectorAndContent(container, moduleName, submoduleName) {
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

    // ELIMINACIÓN DEL CALENDARIO: Ya no se muestra el calendario en los módulos principales
    // Los módulos ahora tendrán más espacio disponible

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
            if (window.currentGestionIntegralHome?._removeFullscreenListener) {
                console.log(`[CHART-DIAG] ═══ NAVIGATE AWAY — destroying old instance ═══`);
                window.currentGestionIntegralHome._removeFullscreenListener();
            }
            const gestionIntegralHome = new window.GestionIntegralHome(moduleContentContainer, moduleName, submodules);
            window.currentGestionIntegralHome = gestionIntegralHome; // Referencia global para filtros
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

  // Crear tarjetas para los submódulos con límite de rendimiento
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'module-cards';
  const displaySubmodules = submodules.slice(0, 50); // Máximo 50 para rendimiento
  displaySubmodules.forEach(submoduleName => {
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

const mainContainerSub = document.querySelector('.main-container');
if (mainContainerSub) mainContainerSub.classList.remove('vanta-fullscreen');

// Inspeccionar el DOM antes de limpiar
  hideCalendar(); // No necesita argumento con la nueva implementación

  // ✅ Verificar que container no sea null
  if (!container) {
    console.error('❌ Container es null, no se puede mostrar el contenido del submódulo');
    return;
  }
  
  // Mostrar botón home empresa porque YA NO estamos en home
  if (currentCompany) {
    setCompanyHeaderVisibility(true);
  }

  const currentRole = companyRoleByKey[currentCompany] || '';
  if (!isSubmoduleAllowed(currentRole, moduleName, submoduleName)) {
    showErrorMessage(container, submoduleName, 'No tienes permiso para acceder a este submódulo.');
    return;
  }

  // ✅ Limpiar contenido anterior
  container.innerHTML = '';

  // ✅ Crear contenedor principal del submódulo Y AÑADIRLO AL DOM INMEDIATAMENTE
  const submoduleContentDiv = document.createElement('div');
  submoduleContentDiv.className = 'submodule-content';
  // Asignar estilos para que ocupe todo el espacio disponible, crucial para componentes hijos
  submoduleContentDiv.style.height = '100%';
  submoduleContentDiv.style.width = '100%';
  submoduleContentDiv.style.display = 'flex';
  submoduleContentDiv.style.flexDirection = 'column';
  submoduleContentDiv.style.overflowY = 'auto';
  container.appendChild(submoduleContentDiv);

  try {
    // --- Callback genérico para volver al módulo limpiando el estado ---
    const backToModuleCallback = () => {
        currentSubmodule = null; // Limpiar estado
        showModuleContent(moduleName);
    };

    // --- Callback SEGURO para componentes que se portan mal ---
    const safeBackToModuleCallback = () => {
        console.warn('[safeBackToModuleCallback] Se ha llamado al callback de retorno. Limpiando estado y mostrando home del módulo.');
        if (currentActiveComponent && typeof currentActiveComponent.destroy === 'function') {
          try {
            currentActiveComponent.destroy();
          } catch (e) {
            console.warn('Error al destruir componente activo en retorno:', e);
          } finally {
            currentActiveComponent = null;
          }
        }
        currentSubmodule = null;
        showModuleContent(moduleName);
    };

    // Función auxiliar para crear componentes de forma segura
    const createComponentSafely = (ComponentConstructor, ...args) => {
      // Destruir componente anterior si existe
      if (currentActiveComponent && typeof currentActiveComponent.destroy === 'function') {
        try {
          currentActiveComponent.destroy();
        } catch (e) {
          console.warn('Error al destruir componente anterior:', e);
        }
      }

    if (ComponentConstructor) {
        try {
            const component = new ComponentConstructor(...args);
            currentActiveComponent = component;
            component.render();
            return component;
        } catch (e) {
            console.error('❌ Error al crear/renderizar componente:', e);
            currentActiveComponent = null;
            return null;
        }
    } else {
        console.error(`❌ Constructor de componente no encontrado`);
        return null;
      }
    };

    // ------------------ Submódulos con componentes especiales ------------------ //
    if (submoduleName === "1.1.1 Responsable del SG") {
      createComponentSafely(window.ResponsableSgComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
      );
      if (!window.ResponsableSgComponent) {
        console.error('❌ ResponsableSgComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }
    } else if (submoduleName === "1.1.2 Roles y Responsabilidades") {
      if (window.RolesResponsabilidadesComponent) {
        const rolesResponsabilidadesComponent = new window.RolesResponsabilidadesComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
        );
        rolesResponsabilidadesComponent.render();
      } else {
        console.error('❌ RolesResponsabilidadesComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }
    } else if (submoduleName === "1.1.4 Afiliación al SSSI") {
      if (window.AfiliacionComponent) {
        const afiliacionComponent = new window.AfiliacionComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
        );
        afiliacionComponent.render();
      } else {
        console.error('❌ AfiliacionComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }
    } else if (submoduleName === "1.1.5 Trabajo de alto riesgo") {
      if (window.TrabajoAltoRiesgoComponent) {
        const trabajoAltoRiesgoComponent = new window.TrabajoAltoRiesgoComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback
        );
        trabajoAltoRiesgoComponent.render();
      } else {
        console.error('❌ TrabajoAltoRiesgoComponent no encontrado');
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

    } else if (submoduleName === "1.1.7 Capacitación al Copasst") {
      if (window.CapacitacionCopasstComponent) {
        const capacitacionCopasstComponent = new window.CapacitacionCopasstComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback
        );
        capacitacionCopasstComponent.render();
      } else {
        console.error('❌ CapacitacionCopasstComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "1.1.8 Conformación de Comite de Convivencia") {
      if (window.ComiteConvivenciaComponent) {
      const convivenciaComponent = new window.ComiteConvivenciaComponent(
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      convivenciaComponent.render();
      } else {
        console.error('❌ ComiteConvivenciaComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "1.2.1 Programa de capacitación Anual") {
      if (window.CapacitacionesPortalComponent) {
        const capacitacionesPortal = new window.CapacitacionesPortalComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback
        );
        currentActiveComponent = capacitacionesPortal;
        capacitacionesPortal.render();
      } else {
        console.error('❌ CapacitacionesPortalComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "1.2.2 Inducción y Reinducción") {
      if (window.InduccionesViewer) {
        const induccionesViewer = new window.InduccionesViewer(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
        );
        induccionesViewer.render();
      } else {
        console.error('❌ InduccionesViewer no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "1.2.3 Curso Virtual 50 Horas") {
      if (window.CursoVirtualComponent) {
        const cursoComponent = new window.CursoVirtualComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
        );
        cursoComponent.render();
      } else {
        console.error('❌ CursoVirtualComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "1.2.4 Manual de SST para Proveedores y Contratistas") {
      if (window.ManualProveedoresComponent) {
        const manualComponent = new window.ManualProveedoresComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
        );
        manualComponent.render();
      } else {
        console.error('❌ ManualProveedoresComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

} else if (submoduleName === "2.1.1 Politica del SG-SST") {
if (window.PoliticaComponent) {
const politicaComponent = new window.PoliticaComponent(
submoduleContentDiv,
currentCompany,
moduleName,
submoduleName,
safeBackToModuleCallback
);
currentActiveComponent = politicaComponent;
politicaComponent.render();
} else {
console.error('❌ PoliticaComponent no encontrado');
showDevelopmentMessage(submoduleContentDiv, submoduleName);
}

    } else if (submoduleName === "2.2.1 Objetivos SST") {
      createComponentSafely(window.ObjetivosSSTComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
      );
      if (!window.ObjetivosSSTComponent) {
        console.error('❌ ObjetivosSSTComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "2.3.1 Evaluación inicial del SG-SST") {
      createComponentSafely(window.EvaluacionInicialSgSst,
        submoduleContentDiv,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.EvaluacionInicialSgSst) {
        console.error('❌ EvaluacionInicialSgSst no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "2.4.1 Plan de Trabajo Anual") {
      if (window.PlanTrabajoComponent) {
        const planTrabajoComponent = new window.PlanTrabajoComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
        );
        planTrabajoComponent.render();
      } else {
        console.error('❌ PlanTrabajoComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "2.5.1 Archivo y retención documental del SG-SST") {
      if (window.ArchivoRetencionComponent) {
        const archivoRetencionComponent = new window.ArchivoRetencionComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback
        );
        window.archivoRetencionInstance = archivoRetencionComponent; // ← referencia global
        archivoRetencionComponent.render();
      } else {
        console.error('❌ ArchivoRetencionComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "2.6.1 Rendición de cuentas") {
      if (window.RendicionCuentasComponent) {
        const rendicionCuentasComponent = new window.RendicionCuentasComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
        );
        rendicionCuentasComponent.render();
      } else {
        console.error('❌ RendicionCuentasComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

 } else if (submoduleName === "2.9.1 Identificación y evaluación para la adquisición de bienes y servicios") {
 createComponentSafely(window.EvaluacionProveedores,
 submoduleContentDiv,
 moduleName,
 submoduleName,
 safeBackToModuleCallback,
 currentCompany
 );
      if (!window.EvaluacionProveedores) {
        console.error('❌ EvaluacionProveedores no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "2.10.1 Evaluación y selección de proveedores y contratistas") {
      createComponentSafely(window.EvaluacionSeleccionComponent,
        submoduleContentDiv,
        moduleName,
        submoduleName,
        safeBackToModuleCallback,
        currentCompany
      );
      if (!window.EvaluacionSeleccionComponent) {
        console.error('❌ EvaluacionSeleccionComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "2.11.1 Gestión del Cambio") {
      if (window.GestionDelCambioComponent) {
        const gestionCambioComponent = new window.GestionDelCambioComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback
        );
        gestionCambioComponent.render();
      } else {
        console.error('❌ GestionDelCambioComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "3.1.1 Descripción Sociodemografica y diagnostico de condiciones de salud") {
      if (window.SociodemograficaComponent) {
        const sociodemograficaComponent = new window.SociodemograficaComponent(
          submoduleContentDiv,
          currentCompany,
          moduleName,
          submoduleName,
          safeBackToModuleCallback // <-- USAR EL CALLBACK SEGURO
        );
        sociodemograficaComponent.render();
      } else {
        console.error('❌ SociodemograficaComponent no encontrado');
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

    } else if (submoduleName === "3.2.3 Registro y analisis estadistico de indicentes, accidentes de trabajo y enfermedades") {
      showRegistroEstadisticoContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);

    } else if (submoduleName === "3.3.1 Frecuencia de la accidentalidad") {
      showFrecuenciaAccidentalidadContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);

    } else if (submoduleName === "3.3.2 Severidad de la accidentalidad") {
      showSeveridadAccidentalidadContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);

    } else if (submoduleName === "3.3.3 Proporción de accidentes de trabajo mortales") {
      showIndiceMortalidadContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);

    } else if (submoduleName === "3.3.4 Medición de la prevalencia de enfermedades laborales") {
      showPrevalenciaContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);

    } else if (submoduleName === "3.3.5 Medición de la incidencia de enfermedades laborales") {
      showIncidenciaContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);

    } else if (submoduleName === "3.3.6 Medición del ausentismo por causa médica") {
      showMedicionAusentismoContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);

    } else if (submoduleName === "Registrar Ausentismo") {
      showRegistrarAusentismoContent(submoduleContentDiv, currentCompany, moduleName, submoduleName);

} else if (submoduleName === "4.1.1 Metodologia IPEVR") {
createComponentSafely(window.MetodologiaIpevrComponent,
submoduleContentDiv,
currentCompany,
moduleName,
submoduleName,
safeBackToModuleCallback
);
if (!window.MetodologiaIpevrComponent) {
console.error('❌ MetodologiaIpevrComponent no encontrado');
showDevelopmentMessage(submoduleContentDiv, submoduleName);
}

} else if (submoduleName === "4.1.2 Identificación de Peligros") {
createComponentSafely(window.KairMatrizPeligros,
submoduleContentDiv,
currentCompany,
moduleName,
submoduleName,
safeBackToModuleCallback
);
if (!window.KairMatrizPeligros) {
console.error('❌ KairMatrizPeligros no encontrado');
showDevelopmentMessage(submoduleContentDiv, submoduleName);
}

} else if (submoduleName === "4.2.4 Realización de inspecciones sistematicas a las instalaciones, maquinas o equipos") {
                createComponentSafely(window.InspeccionesComponent,
                    submoduleContentDiv,
                    currentCompany,
                    moduleName,
                    submoduleName,
                    safeBackToModuleCallback
                );
if (!window.InspeccionesComponent) {
console.error('❌ InspeccionesComponent no encontrado');
showDevelopmentMessage(submoduleContentDiv, submoduleName);
}

 } else if (submoduleName === "4.2.5 Mantenimiento periodico de equipos, instalaciones herramientas") {
createComponentSafely(window.MantenimientoComponent,
 submoduleContentDiv,
 currentCompany,
 moduleName,
 submoduleName,
 safeBackToModuleCallback
);
if (!window.MantenimientoComponent) {
 console.error('❌ MantenimientoComponent no encontrado');
 showDevelopmentMessage(submoduleContentDiv, submoduleName);
}

} else if (submoduleName === "1.1.3 Asignación de Recursos") {
  showAsignacionRecursosContent(submoduleContentDiv);

} else if (submoduleName === "5.1.1 Plan de Prevención de Emergencias") {
      createComponentSafely(window.PlanPrevencionComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.PlanPrevencionComponent) {
        console.error('❌ PlanPrevencionComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

} else if (submoduleName === "5.1.2 Examenes Medicos Brigadista") {
      createComponentSafely(window.ExamenesBrigadistaComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.ExamenesBrigadistaComponent) {
        console.error('❌ ExamenesBrigadistaComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

} else if (submoduleName === "7.1.1 Acciones Preventivas y Correctivas") {
      createComponentSafely(window.AccionesPcComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.AccionesPcComponent) {
        console.error('❌ AccionesPcComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

} else if (submoduleName === "7.1.2 Acciones de Mejora conforme a revisiones de la alta gerencia") {
      createComponentSafely(window.AccionesMgComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.AccionesMgComponent) {
        console.error('❌ AccionesMgComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

} else if (submoduleName === "7.1.3 Acciones de Mejora con base en investigaciones de AT y EL") {
      createComponentSafely(window.AccionesMaComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.AccionesMaComponent) {
        console.error('❌ AccionesMaComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

} else if (submoduleName === "7.1.4 Elaboración de Planes de Mejoramiento de medidas y acciones correctivas por autoridades y ARL") {
      createComponentSafely(window.PlanesComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.PlanesComponent) {
        console.error('❌ PlanesComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "6.1.1 Definición de indicadores") {
      createComponentSafely(
        window.DefinicionIndicadoresComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.DefinicionIndicadoresComponent) {
        console.error('❌ DefinicionIndicadoresComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "6.1.2 Auditoria Anual") {
      createComponentSafely(
        window.AuditoriaAnualComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.AuditoriaAnualComponent) {
        console.error('❌ AuditoriaAnualComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else if (submoduleName === "6.1.3 Revisión de la alta Dirección") {
      createComponentSafely(
        window.RevisionAltaDireccionComponent,
        submoduleContentDiv,
        currentCompany,
        moduleName,
        submoduleName,
        safeBackToModuleCallback
      );
      if (!window.RevisionAltaDireccionComponent) {
        console.error('❌ RevisionAltaDireccionComponent no encontrado');
        showDevelopmentMessage(submoduleContentDiv, submoduleName);
      }

    } else {
      // ------------------ Submódulos genéricos ------------------ //
      showGenericSubmoduleContent(submoduleContentDiv, moduleName, submoduleName);
    }

  } catch (error) {
    console.error('⚠️ Error al renderizar el submódulo:', error);
    showErrorMessage(submoduleContentDiv, submoduleName, error.message);
  }
}

// Funciones para mostrar contenido específico de submódulos
function showVerAusentismoContent(container, currentCompany, moduleName, submoduleName) {
  // Crear una instancia del componente y renderizarlo
  if (typeof window.VerAusentismoComponent === 'function') {
    try {
      const verAusentismoComponent = new window.VerAusentismoComponent(
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
      verAusentismoComponent.render();
    } catch (error) {
      console.error('Error al crear/renderizar VerAusentismoComponent:', error);
      showDevelopmentMessage(container, submoduleName);
    }
  } else {
    console.error('VerAusentismoComponent no está disponible o no es una función');
    showDevelopmentMessage(container, submoduleName);
  }
}

function showRegistrarAusentismoContent(container, currentCompany, moduleName, submoduleName) {
  // Crear una instancia del componente y renderizarlo
  if (typeof window.RegistrarAusentismoComponent === 'function') {
    try {
      const registrarAusentismoComponent = new window.RegistrarAusentismoComponent(
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
      registrarAusentismoComponent.render();
    } catch (error) {
      console.error('Error al crear/renderizar RegistrarAusentismoComponent:', error);
      showDevelopmentMessage(container, submoduleName);
    }
  } else {
    console.error('RegistrarAusentismoComponent no está disponible o no es una función');
    showDevelopmentMessage(container, submoduleName);
  }
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
  container.innerHTML = '';

  // Agregar Bootstrap Icons si no existe
  if (!document.querySelector('link[href*="bootstrap-icons"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
    document.head.appendChild(link);
  }

  // Header System v2.0
  const header = document.createElement('header');
  header.className = 'kair-header';
  header.style.cssText = 'background: #ffffff; border-bottom: 1px solid #dee2e6; position: sticky; top: 0; z-index: 100;';
  header.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: flex-start; gap: 0.75rem; min-height: 52px; padding: 0 1.5rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <button id="btnVolver" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; color: #5a6378; border-radius: 0.375rem; cursor: pointer;">
          <i class="bi bi-arrow-left"></i>
        </button>
      </div>
      <div style="width: 1px; height: 24px; background: #dee2e6;"></div>
      <div style="display: flex; flex-direction: column; gap: 0.125rem;">
        <h1 style="font-size: 1.25rem; font-weight: 600; color: #1a1a2e; margin: 0;">
          <i class="fas fa-clipboard-check" style="color: #174ea6;"></i>
          Control de Remisiones
        </h1>
        <ol style="display: flex; align-items: center; gap: 0.375rem; list-style: none; margin: 0; padding: 0; font-size: 0.8125rem; color: #5a6378;">
          <li><a href="#" style="color: #5a6378; text-decoration: none;">Gestión de la Salud</a></li>
          <li>›</li>
          <li><a href="#" style="color: #5a6378; text-decoration: none;">3.1.6</a></li>
          <li>›</li>
          <li style="color: #174ea6; font-weight: 500;">3.1.6.1 Control de Remisiones</li>
        </ol>
      </div>
      <div style="margin-left: auto; display: flex; align-items: center; gap: 0.75rem;">
        <span style="display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: #5a6378;">
          <i class="bi bi-building"></i>
          <span id="header-company-text">${currentCompany || '—'}</span>
        </span>
      </div>
    </div>
  `;
  container.appendChild(header);

  const backBtn = header.querySelector('#btnVolver');
  backBtn.addEventListener('click', () => {
    currentSubmodule = null;
    showSubmoduleContent("3.1.6 Restricciones y recomendaciones médicas");
  });

  // Contenedor principal tipo card
  const wrapper = document.createElement('div');
  wrapper.className = 'control-remisiones-wrapper';
  container.appendChild(wrapper);

  // Función asíncrona para cargar y renderizar datos
  const renderContent = async () => {
    wrapper.innerHTML = '<p class="loading-msg">Cargando datos del archivo de control...</p>';

    try {
      const result = await window.electronAPI.getControlRemisionesData(currentCompany);

      wrapper.innerHTML = '';

      if (!result.success) {
        wrapper.innerHTML = `
          <div class="control-remisiones-error">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error al cargar datos</h3>
            <p>${result.error || 'Error desconocido'}</p>
            <button class="btn btn-primary" onclick="this.parentElement.parentElement.innerHTML='<p class=\\'loading-msg\\'>Cargando...</p>'; window._loadControlRemisiones()">Reintentar</button>
          </div>
        `;
        window._loadControlRemisiones = renderContent;
        return;
      }

      if (!result.rows || result.rows.length === 0) {
        wrapper.innerHTML = `
          <div class="control-remisiones-empty">
            <i class="fas fa-inbox"></i>
            <h3>Sin registros</h3>
            <p>El archivo de control no contiene registros aún.</p>
            <p style="font-size:0.85rem;color:#888;margin-top:8px;">Genera una remisión desde "Enviar Remisiones" para agregar el primer registro.</p>
          </div>
        `;
        return;
      }

      // Info superior
      const infoBar = document.createElement('div');
      infoBar.className = 'control-remisiones-info';
      infoBar.innerHTML = `
        <span><i class="fas fa-database"></i> <strong>${result.rows.length}</strong> registro(s)</span>
        <span class="info-file" title="${result.filePath}"><i class="fas fa-file-excel"></i> ${result.filePath ? result.filePath.split(/[\\/]/).pop() : ''}</span>
      `;
      wrapper.appendChild(infoBar);

      // Tabla con scroll
      const tableContainer = document.createElement('div');
      tableContainer.className = 'control-remisiones-table-container';

      const table = document.createElement('table');
      table.className = 'control-remisiones-table';

      // Encabezados
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      if (result.headers && Array.isArray(result.headers)) {
        result.headers.forEach(h => {
          const th = document.createElement('th');
          th.textContent = h || '';
          th.style.position = 'sticky';
          th.style.top = '0';
          headerRow.appendChild(th);
        });
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Cuerpo
      const tbody = document.createElement('tbody');
      result.rows.forEach((row, ri) => {
        const tr = document.createElement('tr');
        if (ri % 2 === 0) tr.className = 'row-even';

        if (Array.isArray(row)) {
          row.forEach((cell, ci) => {
            const td = document.createElement('td');
            // Última columna: input editable
            if (ci === row.length - 1) {
              const input = document.createElement('input');
              input.type = 'text';
              input.value = cell != null ? String(cell) : '';
              input.placeholder = 'Estado / Seguimiento';
              input.dataset.rowIndex = ri;
              input.dataset.colIndex = ci;
              input.addEventListener('change', async (e) => {
                try {
                  const saveResult = await window.electronAPI.updateExcelCell(
                    result.filePath,
                    ri + 7 + 1,  // +7 encabezados +1 base-1 Excel
                    ci + 1,
                    e.target.value
                  );
                  if (saveResult.success) {
                    input.style.borderColor = '#28a745';
                    setTimeout(() => { input.style.borderColor = '#dee2e6'; }, 1500);
                  }
                } catch (err) {
                  console.error('Error guardando celda:', err);
                  input.style.borderColor = '#dc3545';
                }
              });
              td.appendChild(input);
            } else {
              td.textContent = cell != null ? String(cell) : '';
            }
            tr.appendChild(td);
          });
        }
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      tableContainer.appendChild(table);
      wrapper.appendChild(tableContainer);

    } catch (error) {
      console.error('Error en Control de Remisiones:', error);
      wrapper.innerHTML = `
        <div class="control-remisiones-error">
          <i class="fas fa-times-circle"></i>
          <h3>Error crítico</h3>
          <p>${error.message}</p>
          <button class="btn btn-primary" onclick="window._loadControlRemisiones()">Reintentar</button>
        </div>
      `;
      window._loadControlRemisiones = renderContent;
    }
  };

  renderContent();
}

function showAsignacionRecursosContent(container) {
    console.log('🔍 [showAsignacionRecursosContent] Iniciando renderizado del submódulo 1.1.3');
    console.log('🔍 [showAsignacionRecursosContent] currentCompany:', currentCompany);
    console.log('🔍 [showAsignacionRecursosContent] currentModule:', currentModule);
    console.log('🔍 [showAsignacionRecursosContent] window.PresupuestoGestionComponent:', !!window.PresupuestoGestionComponent);

    if (window.PresupuestoGestionComponent) {
        try {
            console.log('✅ [showAsignacionRecursosContent] Creando instancia de PresupuestoGestionComponent');
            const presupuestoComponent = new window.PresupuestoGestionComponent(
                container,
                currentCompany,
                currentModule,
                () => {
                    console.log('🔙 [callback] Volviendo al módulo desde Asignación de Recursos');
                    // Limpiar el estado del submódulo actual antes de volver
                    currentSubmodule = null;
                    showModuleContent(currentModule);
                } // Callback para volver al módulo
            );
            console.log('🎨 [showAsignacionRecursosContent] Llamando a presupuestoComponent.render()');
            presupuestoComponent.render();
            console.log('✅ [showAsignacionRecursosContent] Renderizado completado');
        } catch (error) {
            console.error('❌ Error al crear PresupuestoGestionComponent:', error);
            console.error('❌ Error stack:', error.stack);
            showErrorMessage(container, "1.1.3 Asignación de Recursos", error.message);
        }
    } else {
        console.error('❌ PresupuestoGestionComponent no encontrado en window');
        console.log('📋 [DEBUG] Componentes disponibles en window:', Object.keys(window).filter(key => key.includes('Component')));
        showDevelopmentMessage(container, "1.1.3 Asignación de Recursos");
    }
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

function showRegistroEstadisticoContent(container, currentCompany, moduleName, submoduleName) {
  container.innerHTML = '<p>Cargando registro estadístico...</p>';

  const BASE = 'modules/gestion-salud/registro-estadistico/';

  if (!document.querySelector(`link[href="${BASE}registro-estadistico.css"]`)) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = BASE + 'registro-estadistico.css';
    document.head.appendChild(cssLink);
  }

  fetch(BASE + 'registro-estadistico.html')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      container.innerHTML = doc.body.innerHTML;

      function loadModuleScript() {
        const s = document.createElement('script');
        s.src = BASE + 'registro-estadistico.js';
        document.head.appendChild(s);
      }

      if (window.Chart) {
        loadModuleScript();
      } else {
        const chartScript = document.createElement('script');
        chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js@4';
        chartScript.onload = loadModuleScript;
        document.head.appendChild(chartScript);
      }
    })
    .catch(error => {
      console.error('Error al cargar registro-estadistico:', error);
      showDevelopmentMessage(container, submoduleName);
    });
}

function showFrecuenciaAccidentalidadContent(container, currentCompany, moduleName, submoduleName) {
  console.log('%c[FrecuenciaAccidentalidad] ========== CARGANDO ==========', 'color: green; font-weight: bold; font-size: 14px;');
  console.log('[FrecuenciaAccidentalidad] Empresa:', currentCompany);
  console.log('[FrecuenciaAccidentalidad] Contenedor:', container ? 'EXISTS' : 'NULL');
  container.innerHTML = '<p style="color: blue;">Cargando frecuencia de la accidentalidad... (v3)</p>';

  const BASE = 'modules/gestion-salud/frecuencia-accidentalidad/';

  // Cargar CSS si no está cargado
  if (!document.querySelector(`link[href="${BASE}frecuencia-accidentalidad.css"]`)) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = BASE + 'frecuencia-accidentalidad.css';
    document.head.appendChild(cssLink);
  }

  // Cargar HTML y luego el script
  fetch(BASE + 'frecuencia-accidentalidad.html')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      container.innerHTML = doc.body.innerHTML;

      // Guardar empresa seleccionada para que el módulo la use
      localStorage.setItem('selectedCompany', currentCompany);

      // Cargar el script del módulo con tag script (con cache-busting)
      var ts = Date.now();
      var scriptUrl = BASE + 'frecuencia-accidentalidad.js?_t=' + ts;
      console.log('[FrecuenciaAccidentalidad] Cargando script tag:', scriptUrl);
      
      var s = document.createElement('script');
      s.src = scriptUrl;
      s.onload = function() {
        console.log('[FrecuenciaAccidentalidad] Script cargado OK');
      };
      s.onerror = function(e) {
        console.error('[FrecuenciaAccidentalidad] Error cargando script:', e);
      };
      document.body.appendChild(s);
    })
    .catch(error => {
      console.error('[FrecuenciaAccidentalidad] Error al cargar:', error);
      showDevelopmentMessage(container, submoduleName);
    });
}

function showSeveridadAccidentalidadContent(container, currentCompany, moduleName, submoduleName) {
  console.log('%c[SeveridadAccidentalidad] ========== CARGANDO ==========', 'color: green; font-weight: bold; font-size: 14px;');
  console.log('[SeveridadAccidentalidad] Empresa:', currentCompany);
  console.log('[SeveridadAccidentalidad] Contenedor:', container ? 'EXISTS' : 'NULL');
  container.innerHTML = '<p style="color: blue;">Cargando severidad de la accidentalidad... (v1)</p>';

  const BASE = 'modules/gestion-salud/severidad-accidentalidad/';

  // Cargar CSS si no está cargado
  if (!document.querySelector(`link[href="${BASE}severidad-accidentalidad.css"]`)) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = BASE + 'severidad-accidentalidad.css';
    document.head.appendChild(cssLink);
  }

  // Cargar HTML y luego el script
  fetch(BASE + 'severidad-accidentalidad.html')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      container.innerHTML = doc.body.innerHTML;

      // Guardar empresa seleccionada para que el módulo la use
      localStorage.setItem('selectedCompany', currentCompany);

      // Cargar el script del módulo con tag script (con cache-busting)
      var ts = Date.now();
      var scriptUrl = BASE + 'severidad-accidentalidad.js?_t=' + ts;
      console.log('[SeveridadAccidentalidad] Cargando script tag:', scriptUrl);

      var s = document.createElement('script');
      s.src = scriptUrl;
      s.onload = function() {
        console.log('[SeveridadAccidentalidad] Script cargado OK');
      };
      s.onerror = function(e) {
        console.error('[SeveridadAccidentalidad] Error cargando script:', e);
      };
      document.body.appendChild(s);
    })
    .catch(error => {
      console.error('[SeveridadAccidentalidad] Error al cargar:', error);
      showDevelopmentMessage(container, submoduleName);
    });
}

function showIndiceMortalidadContent(container, currentCompany, moduleName, submoduleName) {
  console.log('[IndiceMortalidad] ✅ showIndiceMortalidadContent INICIADO');
  console.log('[IndiceMortalidad] container:', container);
  console.log('[IndiceMortalidad] currentCompany:', currentCompany);
  console.log('[IndiceMortalidad] moduleName:', moduleName);
  console.log('[IndiceMortalidad] submoduleName:', submoduleName);

  const BASE = './modules/gestion-salud/indice-mortalidad/';
  console.log('[IndiceMortalidad] Ruta BASE:', BASE);

  // Cargar CSS si no está cargado
  if (!document.querySelector(`link[href="${BASE}indice-mortalidad.css"]`)) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = BASE + 'indice-mortalidad.css';
    document.head.appendChild(cssLink);
  }

  // Cargar HTML y luego el script
  const htmlUrl = BASE + 'indice-mortalidad.html';
  console.log('[IndiceMortalidad] Intentando fetch:', htmlUrl);

  fetch(htmlUrl)
    .then(r => {
      console.log('[IndiceMortalidad] Fetch response status:', r.status, r.ok ? 'OK' : 'FALLO');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(html => {
      // Parser el HTML completo
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      
      // Mover todos los elementos del body al contenedor
      var sourceBody = doc.body;
      var elements = sourceBody.children;
      while (elements.length > 0) {
        container.appendChild(elements[0]);
      }
      
      console.log('[IndiceMortalidad] HTML insertado, elementos移入');
      console.log('[IndiceMortalidad] tableSection elemento:', !!container.querySelector('#tableSection'));
      
      // Cargar Chart.js si no está disponible
      if (typeof Chart === 'undefined') {
        console.log('[IndiceMortalidad] Cargando Chart.js...');
        var chartScript = document.createElement('script');
        chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        chartScript.onload = function() { console.log('[IndiceMortalidad] Chart.js cargado OK'); };
        chartScript.onerror = function(e) { console.error('[IndiceMortalidad] Error cargando Chart.js', e); };
        document.head.appendChild(chartScript);
      }

      // Guardar empresa seleccionada para que el módulo la use
      localStorage.setItem('selectedCompany', currentCompany);

      // Cargar el script del módulo con tag script (con cache-busting)
      var ts = Date.now();
      var scriptUrl = BASE + 'indice-mortalidad.js?_t=' + ts;
      console.log('[IndiceMortalidad] Cargando script tag:', scriptUrl);

      var s = document.createElement('script');
      s.src = scriptUrl;
      s.onload = function() {
        console.log('[IndiceMortalidad] Script cargado OK');
      };
      s.onerror = function(e) {
        console.error('[IndiceMortalidad] Error cargando script:', e);
      };
      document.body.appendChild(s);
    })
    .catch(error => {
      console.error('[IndiceMortalidad] Error al cargar:', error);
      showDevelopmentMessage(container, submoduleName);
    });
}

function showPrevalenciaContent(container, currentCompany, moduleName, submoduleName) {
  console.log('[PrevalenciaEL] showPrevalenciaContent INICIADO');

  const BASE = './modules/gestion-salud/prevalencia-enfermedad-laboral/';

  // Cargar CSS si no está cargado
  if (!document.querySelector(`link[href="${BASE}prevalencia-enfermedad-laboral.css"]`)) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = BASE + 'prevalencia-enfermedad-laboral.css';
    document.head.appendChild(cssLink);
  }

  // Cargar HTML y luego el script
  const htmlUrl = BASE + 'prevalencia-enfermedad-laboral.html';

  fetch(htmlUrl)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(html => {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      var sourceBody = doc.body;
      var elements = sourceBody.children;
      while (elements.length > 0) {
        container.appendChild(elements[0]);
      }

      // Cargar Chart.js si no está disponible
      if (typeof Chart === 'undefined') {
        var chartScript = document.createElement('script');
        chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        document.head.appendChild(chartScript);
      }

      // Guardar empresa seleccionada para que el módulo la use
      localStorage.setItem('selectedCompany', currentCompany);

      // Cargar el script del módulo
      var ts = Date.now();
      var scriptUrl = BASE + 'prevalencia-enfermedad-laboral.js?_t=' + ts;

      var s = document.createElement('script');
      s.src = scriptUrl;
      document.body.appendChild(s);
    })
    .catch(error => {
      console.error('[PrevalenciaEL] Error al cargar:', error);
      showDevelopmentMessage(container, submoduleName);
    });
}

function showIncidenciaContent(container, currentCompany, moduleName, submoduleName) {
  console.log('[IncidenciaEL] showIncidenciaContent INICIADO');

  const BASE = './modules/gestion-salud/incidencia-enfermedad-laboral/';

  if (!document.querySelector(`link[href="${BASE}incidencia-enfermedad-laboral.css"]`)) {
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = BASE + 'incidencia-enfermedad-laboral.css';
    document.head.appendChild(cssLink);
  }

  const htmlUrl = BASE + 'incidencia-enfermedad-laboral.html';

  fetch(htmlUrl)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(html => {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      var sourceBody = doc.body;
      var elements = sourceBody.children;
      while (elements.length > 0) {
        container.appendChild(elements[0]);
      }

      if (typeof Chart === 'undefined') {
        var chartScript = document.createElement('script');
        chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        document.head.appendChild(chartScript);
      }

      localStorage.setItem('selectedCompany', currentCompany);

      var ts = Date.now();
      var scriptUrl = BASE + 'incidencia-enfermedad-laboral.js?_t=' + ts;

      var s = document.createElement('script');
      s.src = scriptUrl;
      document.body.appendChild(s);
    })
    .catch(error => {
      console.error('[IncidenciaEL] Error al cargar:', error);
      showDevelopmentMessage(container, submoduleName);
    });
}

function showMedicionAusentismoContent(container, currentCompany, moduleName, submoduleName) {
  // Crear una instancia del componente y renderizarlo
  if (typeof window.MedicionAusentismoComponent === 'function') {
    try {
      console.log(`[INFO] Cargando MedicionAusentismoComponent para la empresa: ${currentCompany}`);

      const medicionComponent = new window.MedicionAusentismoComponent(
        container,
        currentCompany, // <-- CORREGIDO: Usar la variable dinámica
        moduleName,
        submoduleName,
        () => {
          // Callback para volver al home del módulo
          currentSubmodule = null; // Limpiar el estado del submódulo
          showModuleContent(moduleName);
        }
      );
      medicionComponent.render();
    } catch (error) {
      console.error('Error al crear/renderizar MedicionAusentismoComponent:', error);
      showDevelopmentMessage(container, submoduleName);
    }
  } else {
    console.error('MedicionAusentismoComponent no está disponible o no es una función');
    showDevelopmentMessage(container, submoduleName);
  }
}

// Función auxiliar para crear tarjetas de módulo
function createModuleCard(title, description, onClick) {
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

  /**
   * Carga una vista de módulo HTML en el área de contenido principal
   * @param {string} viewPath - Ruta del archivo HTML a cargar
   */
function loadModuleViewInContentArea(viewPath) {
console.log('[RENDERER] Cargando vista de módulo:', viewPath);

const mainContainerView = document.querySelector('.main-container');
if (mainContainerView) mainContainerView.classList.remove('vanta-fullscreen');

// Verificar que contentArea exista
    if (!contentArea) {
      console.error('contentArea is not defined or accessible in loadModuleViewInContentArea.');
      contentArea = document.getElementById('content-area');
      if (!contentArea) {
        console.error('Critical: content-area element still not found.');
        return;
      }
    }

    // Limpiar contenido anterior y ocultar calendario
    hideCalendar(contentArea);
    contentArea.innerHTML = '';

    // Crear contenedor principal
    const mainCanvas = document.createElement('div');
    mainCanvas.className = 'main-canvas';

    // Mostrar mensaje de carga
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.innerHTML = '<p>Cargando constructor de informes...</p>';
    mainCanvas.appendChild(loadingDiv);
    contentArea.appendChild(mainCanvas);

    // Cargar el HTML usando fetch
    fetch(viewPath)
      .then(response => {
        if (!response.ok) {
          throw new Error('Error al cargar el archivo: ' + response.statusText);
        }
        return response.text();
      })
      .then(html => {
        console.log('[RENDERER] Vista cargada exitosamente:', viewPath);
        
        // Limpiar el contenido
        mainCanvas.innerHTML = '';
        
        // Crear un contenedor temporal para parsear el HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Extraer y cargar los estilos del head
        const styles = tempDiv.querySelectorAll('link[rel="stylesheet"], style');
        styles.forEach(style => {
          if (style.tagName === 'LINK') {
            const newLink = document.createElement('link');
            newLink.rel = style.rel;
            newLink.href = style.href;
            document.head.appendChild(newLink);
          } else {
            const newStyle = document.createElement('style');
            newStyle.textContent = style.textContent;
            document.head.appendChild(newStyle);
          }
        });
        
        // Extraer el body content (excluyendo head)
        const bodyContent = tempDiv.querySelectorAll('body > *');
        if (bodyContent.length > 0) {
          bodyContent.forEach(el => {
            mainCanvas.appendChild(el.cloneNode(true));
          });
        } else {
          // Si no hay body, usar todos los elementos del tempDiv
          Array.from(tempDiv.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && 
                node.tagName !== 'HEAD' && 
                node.tagName !== 'HTML') {
              mainCanvas.appendChild(node.cloneNode(true));
            }
          });
        }
        
        // Ejecutar scripts inline si los hay
        const scripts = mainCanvas.querySelectorAll('script');
        scripts.forEach(oldScript => {
          if (oldScript.src) {
            const newScript = document.createElement('script');
            newScript.src = oldScript.src;
            document.head.appendChild(newScript);
          } else if (oldScript.textContent) {
            const newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            mainCanvas.appendChild(newScript);
          }
        });
        
        console.log('[RENDERER] Vista renderizada:', viewPath);
      })
      .catch(error => {
        console.error('[RENDERER] Error cargando vista:', error);
        mainCanvas.innerHTML = `
          <div class="error-message">
            <h3>Error al cargar la vista</h3>
            <p>No se pudo cargar el constructor de informes.</p>
            <p>Error: ${error.message}</p>
            <button class="btn" onclick="location.reload()">Recargar</button>
          </div>
        `;
      });
  }

  function showSettingsPage(section) {
    // F4-fix — Acepta parámetro opcional 'section' para navegar directo a una tab
    // (ej: 'empresas' para abrir Config > Gestión de Empresas, donde está el
    // switch de Gmail). Si no se pasa, muestra la tab por defecto.
    section = section || null;
    // ✅ Pasar contentArea a hideCalendar
    hideCalendar(contentArea);
    console.log('Showing enhanced settings page...');
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

    // Crear un iframe para cargar la nueva interfaz de configuraciones
    const iframe = document.createElement('iframe');
    iframe.src = 'components/config/config-viewer.html';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.id = 'config-iframe';

    // En lugar de usar sandbox (que bloquea el acceso a la API de Electron),
    // vamos a pasar la API de Electron al iframe a través de window.postMessage
    // Eliminar completamente el sandbox para permitir el acceso a la API

    contentArea.appendChild(iframe);

    // Una vez que el iframe se carga, pasarle la API de Electron y el tema
    iframe.onload = function() {
      if (iframe.contentWindow) {
        // Pasar la API de Electron al iframe
        iframe.contentWindow.electronAPI = window.electronAPI;

        // F4-fix — Si se pidió una sección específica, navegar a ella después de cargar
        if (section && typeof iframe.contentWindow.navigateToConfigSection === 'function') {
          setTimeout(function() {
            try { iframe.contentWindow.navigateToConfigSection(section); } catch (e) { /* ignore */ }
          }, 250);
        } else if (section) {
          // Fallback: usar el DOM directamente
          setTimeout(function() {
            try {
              var targetTab = iframe.contentDocument.getElementById('tab-' + section);
              if (targetTab) {
                // Ocultar todas las tabs
                iframe.contentDocument.querySelectorAll('.section-container').forEach(function(s) { s.classList.remove('active'); });
                targetTab.classList.add('active');
                // Scroll a la sección de Gmail
                var gmailSection = iframe.contentDocument.getElementById('gmail-section');
                if (gmailSection) gmailSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            } catch (e) { /* ignore */ }
          }, 250);
        }

        // Propagar el tema actual al iframe
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const savedTheme = localStorage.getItem('kair-theme-preference') || 'system';

        try {
          if (currentTheme === 'dark') {
            if (savedTheme === 'dark') {
              iframe.contentDocument.documentElement.setAttribute('data-theme', 'dark-legacy');
            } else if (savedTheme === 'system') {
              iframe.contentDocument.documentElement.setAttribute('data-theme', 'dark');
            }
          } else {
            iframe.contentDocument.documentElement.removeAttribute('data-theme');
          }

          // Enviar mensaje postMessage con el tema y la información del usuario para que el iframe lo procese
          console.log('[Renderer] === ENVIANDO USUARIO AL IFRAME ===');
          console.log('[Renderer] currentUser completo:', JSON.stringify(currentUser, null, 2));
          console.log('[Renderer] currentUser.isAdmin:', currentUser?.isAdmin);
          console.log('[Renderer] currentUser.email:', currentUser?.email);
          console.log('[Renderer] currentUser.companies:', currentUser?.companies);
          
          const userPayload = currentUser ? {
            id: currentUser.id,
            email: currentUser.email,
            full_name: currentUser.full_name,
            companies: currentUser.companies || [],
            // Usar isAdmin directamente del backend (ya incluye validación por email y rol)
            isAdmin: currentUser.isAdmin || false
          } : null;
          
          console.log('[Renderer] userPayload que se enviará:', JSON.stringify(userPayload, null, 2));
          
          iframe.contentWindow.postMessage({
            type: 'theme-changed',
            theme: savedTheme,
            effectiveTheme: currentTheme,
            // Información del usuario para validación de permisos
            user: userPayload
          }, '*');

          console.log('[Renderer] Tema propagado al iframe de configuración:', savedTheme, '(efectivo:', currentTheme + ')');
          console.log('[Renderer] Usuario propagado al iframe:', { email: currentUser?.email, isAdmin: currentUser?.isAdmin || false });
          console.log('[Renderer] === FIN ENVÍO AL IFRAME ===');
        } catch (e) {
          console.warn('[Renderer] Error al propagar tema al iframe:', e);
        }
      }
    };
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
        
        // === LOG DE DEPURACIÓN AGREGADO ===
        console.log(`[MAPEO][DEBUG] Iniciando mapeo para empresa: ${companyName}`);
        console.log(`[MAPEO][DEBUG] Ruta seleccionada: ${path}`);
        console.log(`[MAPEO][DEBUG] window.electronAPI disponible: ${!!window.electronAPI}`);
        console.log(`[MAPEO][DEBUG] window.electronAPI.mapDirectory disponible: ${!!window.electronAPI?.mapDirectory}`);
        
        if (logTextarea) {
          logTextarea.value = `[MAPEO] Iniciando mapeo para ${companyName} en la ruta ${path}...
[DEBUG] Verificando APIs de Electron...
`;
        }

        // Verificar que window.electronAPI exista
        if (!window.electronAPI || !window.electronAPI.mapDirectory) {
          const errorMsg = 'Electron API not available';
          console.error(`[MAPEO][ERROR] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        if (logTextarea) {
          logTextarea.value += `[DEBUG] Llamando a mapDirectory con ruta: ${path}
`;
        }
        
        console.log(`[MAPEO][DEBUG] Llamando a window.electronAPI.mapDirectory("${path}")`);
        const result = await window.electronAPI.mapDirectory(path);

        if (logTextarea) {
          logTextarea.value += `
[DEBUG] Resultado recibido de mapDirectory:
  - success: ${result.success}
  - structure: ${result.structure ? 'PRESENT' : 'MISSING'}
  - structure.structure: ${result.structure?.structure ? 'PRESENT' : 'MISSING'}
  
Resultado del proceso Python:
${result.log}

`;
        }
        
        console.log(`[MAPEO][DEBUG] Resultado de mapDirectory:`, {
          success: result.success,
          hasStructure: !!result.structure,
          hasStructureStructure: !!(result.structure?.structure),
          log: result.log
        });

        if (result.structure && result.structure.structure) {
          if (logTextarea) {
            logTextarea.value += '--- Estructura Mapeada (resumen) ---\n';
            logTextarea.value += `  Root: ${result.structure.root}
`;
            logTextarea.value += `  Total archivos: ${result.structure.total_files}
`;
            logTextarea.value += `  Total carpetas: ${result.structure.total_folders}
`;
            logTextarea.value += formatStructureForLog(result.structure.structure);
          }
          console.log(`[MAPEO][DEBUG] Estructura mapeada exitosamente para ${companyName}`);
        } else {
          if (logTextarea) {
            logTextarea.value += '[ERROR] No se pudo mostrar la estructura mapeada.\n';
            logTextarea.value += `  result.structure: ${JSON.stringify(result.structure, null, 2)}
`;
          }
          console.error(`[MAPEO][ERROR] result.structure es:`, result.structure);
        }

        const checkmark = document.getElementById(`checkmark-${companyName}`);
        if (checkmark) {
          checkmark.style.display = 'inline';
          console.log(`[MAPEO][DEBUG] Checkmark mostrado para ${companyName}`);
        }

        // Verificar que window.electronAPI exista
        if (!window.electronAPI || !window.electronAPI.loadConfig || !window.electronAPI.saveConfig) {
          const errorMsg = 'Electron API not available for config';
          console.error(`[MAPEO][ERROR] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        if (logTextarea) {
          logTextarea.value += `
[DEBUG] Cargando configuración actual...
`;
        }
        console.log(`[MAPEO][DEBUG] Llamando a window.electronAPI.loadConfig()`);
        const config = await window.electronAPI.loadConfig();
        
        console.log(`[MAPEO][DEBUG] Configuración cargada:`, {
          hasCompanyPaths: !!config.companyPaths,
          existingCompanies: config.companyPaths ? Object.keys(config.companyPaths) : []
        });
        
        if (!config.companyPaths) {
          config.companyPaths = {};
          console.log(`[MAPEO][DEBUG] companyPaths no existía, creado nuevo objeto`);
        }

        // === Determinar si es primera vez o reconfiguración ===
        const esPrimeraVez = !config.companyPaths[companyName];
        const tipoMapeo = esPrimeraVez ? 'primera_vez' : 'reconfiguracion';
        const fechaMapeo = new Date().toISOString();

        console.log(`[MAPEO][DEBUG] Tipo de mapeo: ${tipoMapeo}`);

        // === LOG CRÍTICO: Qué se está guardando ===
        console.log(`[MAPEO][DEBUG] Preparando para guardar configuración para ${companyName}:`, {
          root: path,
          structureKeys: result.structure ? Object.keys(result.structure) : 'MISSING',
          structureHasStructure: !!(result.structure?.structure),
          tipoMapeo,
          fechaMapeo
        });

        config.companyPaths[companyName] = {
          root: path,
          structure: result.structure,
          fechaMapeo,
          tipoMapeo
        };
        
        console.log(`[MAPEO][DEBUG] Configuración actualizada para ${companyName}:`, {
          root: config.companyPaths[companyName].root,
          structureKeys: config.companyPaths[companyName].structure ? Object.keys(config.companyPaths[companyName].structure) : 'MISSING',
          structureHasStructure: !!(config.companyPaths[companyName].structure?.structure)
        });
        
        if (logTextarea) {
          logTextarea.value += `[DEBUG] Guardando configuración...
`;
        }
        console.log(`[MAPEO][DEBUG] Llamando a window.electronAPI.saveConfig()`);
        const saveResult = await window.electronAPI.saveConfig(config);
        console.log(`[MAPEO][DEBUG] Resultado de saveConfig:`, saveResult);

        if (logTextarea) {
          logTextarea.value += `
--- Proceso Finalizado ---
Ruta para ${companyName} guardada exitosamente.
[DEBUG] Configuración guardada con:
  - root: ${path}
  - structure.structure: ${result.structure?.structure ? 'PRESENT' : 'MISSING'}
`;
        }
        console.log(`[MAPEO][SUCCESS] Mapeo completado para ${companyName}`);
        alert(`Ruta para ${companyName} guardada exitosamente.`);

      } catch (error) {
        console.error(`[MAPEO][ERROR] Error en mapeo para ${companyName}:`, error);
        if (logTextarea) {
            logTextarea.value += `
--- ERROR ---
Error al mapear el directorio: ${error.message}
[DEBUG] Stack trace:
${error.stack}
`;
        }
        alert(`Error al mapear el directorio: ${error.message}`);
      } finally {
        loadButton.textContent = 'Cargar Vínculo';
        loadButton.disabled = false;
        console.log(`[MAPEO][DEBUG] Botón reseteado para ${companyName}`);
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
  // Actualizar cache para que logMessage() use este nuevo textarea
  logTextareaCached = logTextarea;

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
