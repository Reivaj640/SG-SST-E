// ============================================================
// K+AIR SG-SST - indice-mortalidad/index.js
// Entry point para el submódulo Índice de Mortalidad
// Submódulo 3.3.3 Índice de Mortalidad
// ============================================================

(function() {
  'use strict';

  var container = null;
  var moduleName = 'indice-mortalidad';

  var moduleConfig = {
    id: '3.3.3',
    name: 'Índice de Mortalidad',
    category: 'gestion-salud',
    description: 'Índice de Mortalidad - Proporción de accidentes de trabajo mortales',
    icon: 'bi-heart-pulse'
  };

  function getElement(id) {
    return document.getElementById(id);
  }

  function render() {
    if (!container) {
      console.error('[IndiceMortalidad] Container no encontrado');
      return;
    }

    // Limpiar container
    container.innerHTML = '';

    // Crear iframe para cargar la vista
    var iframe = document.createElement('iframe');
    iframe.src = 'modules/gestion-salud/indice-mortalidad/indice-mortalidad.html?company=' + (window.currentCompany || '');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = '#f8f9fa';

    container.appendChild(iframe);
  }

  function load(containerId) {
    container = getElement(containerId);
    if (!container) {
      console.error('[IndiceMortalidad] Container no encontrado:', containerId);
      return;
    }

    console.log('[IndiceMortalidad] Cargando módulo...');
    render();
  }

  function unload() {
    if (container) {
      container.innerHTML = '';
    }
  }

  // Exportar módulo
  window.IndiceMortalidadModule = {
    config: moduleConfig,
    load: load,
    unload: unload,
    render: render
  };

  // Auto-registrar si ViewLoader disponible
  if (window.ViewLoader) {
    window.ViewLoader.register(moduleConfig.id, {
      name: moduleConfig.name,
      category: moduleConfig.category,
      load: function(c) { load(c); },
      unload: unload
    });
  }

  console.log('[IndiceMortalidad] Módulo registrado:', moduleConfig.id);

})();