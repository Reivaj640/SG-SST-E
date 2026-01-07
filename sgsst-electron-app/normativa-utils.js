// normativa-utils.js - Funciones para manejar la normativa 0312 de 2019

// Cargar la normativa desde el archivo JSON
async function cargarNormativa() {
  try {
    // Usar fetch para cargar el archivo JSON
    const response = await fetch('normativa-0312.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const normativaData = await response.json();
    console.log('Normativa cargada correctamente:', normativaData);
    return normativaData;
  } catch (error) {
    console.error('Error al cargar la normativa:', error);
    // En caso de error, usar una estructura vacía o valores por defecto
    return {
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
    return null;
  }

  // Cargar la normativa si no está disponible
  if (!window.normativaData) {
    console.error('Normativa no está disponible. Asegúrate de cargarla primero.');
    return 'COMPLETO_CAP_III'; // Escenario por defecto
  }

  // Buscar escenario en la normativa
  for (const [nombreEscenario, escenario] of Object.entries(window.normativaData.escenarios)) {
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
function filtrarModulosPorNormativa(escenario, allModules) {
  if (!window.normativaData || !escenario || !window.normativaData.escenarios[escenario]) {
    console.warn('No se encontró escenario normativo válido:', escenario);
    // Devolver todos los módulos si no hay normativa
    return allModules;
  }

  const reglas = window.normativaData.escenarios[escenario];
  const { modulos, submodulos } = reglas;

  // Filtrar módulos activos
  const modulosActivos = modulos.activar || [];
  const modulosDesactivados = modulos.desactivar || [];

  // Filtrar submódulos activos
  const submodulosActivos = submodulos.activar || [];
  const submodulosDesactivados = submodulos.desactivar || [];

  // Crear objeto con módulos filtrados
  const modulosFiltrados = {};

  for (const [moduloNombre, submodulos] of Object.entries(allModules)) {
    // Determinar si este módulo está en la lista de activos
    const moduloNumero = parseInt(moduloNombre.split(' ')[0]); // Extraer número del módulo
    const moduloActivo = modulosActivos.includes(moduloNumero) && !modulosDesactivados.includes(moduloNumero);

    if (moduloActivo) {
      // Filtrar submódulos para este módulo
      const submodulosFiltrados = submodulos.filter(submodulo => {
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

// Exportar las funciones para que puedan ser usadas en otros archivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cargarNormativa,
    determinarEscenarioNormativo,
    evaluarCondicionAdicional,
    filtrarModulosPorNormativa
  };
}