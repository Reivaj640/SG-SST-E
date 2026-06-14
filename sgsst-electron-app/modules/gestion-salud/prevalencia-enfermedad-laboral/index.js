// ============================================================
// K+AIR SG-SST - prevalencia-enfermedad-laboral/index.js
// Entry point para el submódulo 3.3.4 Prevalencia de EL
// ============================================================

(function() {
  'use strict';

  var container = null;
  var moduleName = 'prevalencia-enfermedad-laboral';

  var moduleConfig = {
    id: '3.3.4',
    name: 'Prevalencia de Enfermedad Laboral',
    category: 'gestion-salud',
    description: 'Prevalencia de enfermedad laboral — (Casos EL / Trabajadores) × 100.000',
    icon: 'bi-clipboard2-pulse'
  };

  function getElement(id) {
    return document.getElementById(id);
  }

  function render() {
    if (!container) {
      console.error('[PrevalenciaEL] Container no encontrado');
      return;
    }

    container.innerHTML = '';

    var iframe = document.createElement('iframe');
    iframe.src = 'modules/gestion-salud/prevalencia-enfermedad-laboral/prevalencia-enfermedad-laboral.html?company=' + (window.currentCompany || '');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = '#f8f9fa';

    container.appendChild(iframe);
  }

  function load(containerId) {
    container = getElement(containerId);
    if (!container) {
      console.error('[PrevalenciaEL] Container no encontrado:', containerId);
      return;
    }

    console.log('[PrevalenciaEL] Cargando módulo...');
    render();
  }

  function unload() {
    if (container) {
      container.innerHTML = '';
    }
  }

  window.PrevalenciaELModule = {
    config: moduleConfig,
    load: load,
    unload: unload,
    render: render
  };

  if (window.ViewLoader) {
    window.ViewLoader.register(moduleConfig.id, {
      name: moduleConfig.name,
      category: moduleConfig.category,
      load: function(c) { load(c); },
      unload: unload
    });
  }

  console.log('[PrevalenciaEL] Módulo registrado:', moduleConfig.id);

})();
