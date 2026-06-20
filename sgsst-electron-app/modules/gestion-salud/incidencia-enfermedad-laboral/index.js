/**
 * 3.3.5 Incidencia de Enfermedad Laboral
 * Entry point – carga dinámica del submódulo
 */
(function () {
  'use strict';

  window.ModuleRegistry = window.ModuleRegistry || {};
  window.ModuleRegistry['3.3.5'] = {
    id: '3.3.5',
    name: 'Incidencia de Enfermedad Laboral',
    load: function () {
      return new Promise(function (resolve, reject) {
        // Cargar CSS
        if (!document.querySelector('link[href*="incidencia-enfermedad-laboral"]')) {
          var link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'modules/gestion-salud/incidencia-enfermedad-laboral/incidencia-enfermedad-laboral.css';
          document.head.appendChild(link);
        }

        // Cargar HTML
        fetch('modules/gestion-salud/incidencia-enfermedad-laboral/incidencia-enfermedad-laboral.html')
          .then(function (r) { return r.text(); })
          .then(function (html) {
            // Cargar JS
            var script = document.createElement('script');
            script.src = 'modules/gestion-salud/incidencia-enfermedad-laboral/incidencia-enfermedad-laboral.js';
            script.onload = function () {
              resolve({ html: html });
            };
            script.onerror = reject;
            document.body.appendChild(script);
          })
          .catch(reject);
      });
    }
  };
})();
