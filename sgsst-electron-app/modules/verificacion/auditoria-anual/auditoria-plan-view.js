/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Plan de Auditoría (Visor de Documentos)
   Visor de documentos PDF/Excel con postMessage API bridge
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaPlanView = (function () {
  'use strict';

  var _container = null;
  var _iframe = null;

  var DOCUMENTS = [
    { id: 'doc-1', name: 'Plan de Auditoría 2026', type: 'PDF', size: '2.4 MB', fecha: '2026-01-10', estado: 'Aprobado' },
    { id: 'doc-2', name: 'Programa de Auditorías Q1', type: 'Excel', size: '156 KB', fecha: '2026-01-05', estado: 'Aprobado' },
    { id: 'doc-3', name: 'Programa de Auditorías Q2', type: 'Excel', size: '148 KB', fecha: '2026-04-01', estado: 'Aprobado' },
    { id: 'doc-4', name: 'Cronograma General 2026', type: 'PDF', size: '1.1 MB', fecha: '2026-01-02', estado: 'Aprobado' },
    { id: 'doc-5', name: 'Lista de Verificación Auditoría Interna', type: 'Excel', size: '89 KB', fecha: '2026-01-08', estado: 'Vigente' },
    { id: 'doc-6', name: 'Informe Resultados Q1 2026', type: 'PDF', size: '3.2 MB', fecha: '2026-02-05', estado: 'Aprobado' }
  ];

  function load(container) {
    _container = container;
    render();
  }

  function render() {
    var docsHtml = DOCUMENTS.map(function (doc) {
      var iconClass = doc.type === 'PDF' ? 'bi-file-earmark-pdf' : 'bi-file-earmark-excel';
      var iconColor = doc.type === 'PDF' ? '#dc3545' : '#28a745';

      return '<div class="kair-aud-hallazgo-card" data-doc-id="' + doc.id + '" style="cursor:pointer;">' +
        '<div style="display:flex;align-items:center;gap:0.75rem;flex:1;min-width:0;">' +
          '<div style="width:40px;height:40px;border-radius:8px;background:' + iconColor + '15;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            '<i class="bi ' + iconClass + '" style="color:' + iconColor + ';font-size:1.1rem;"></i>' +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:600;font-size:0.875rem;color:var(--kair-aud-text);margin-bottom:0.125rem;">' + doc.name + '</div>' +
            '<div style="font-size:0.75rem;color:var(--kair-aud-text-muted);">' + doc.type + ' · ' + doc.size + ' · ' + formatDate(doc.fecha) + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0;">' +
          '<span class="kair-aud-status kair-aud-status--completada">' + doc.estado + '</span>' +
          '<button class="kair-aud-btn kair-aud-btn--ghost" data-action="download" data-doc="' + doc.id + '" title="Descargar">' +
            '<i class="bi bi-download"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    _container.innerHTML =
      '<div class="kair-aud-toolbar">' +
        '<div class="kair-aud-toolbar__search">' +
          '<i class="bi bi-search"></i>' +
          '<input type="text" class="kair-aud-toolbar__input" id="kair-aud-doc-search" placeholder="Buscar documento..." />' +
        '</div>' +
      '</div>' +
      '<div class="kair-aud-hallazgos" id="kair-aud-doc-list">' + docsHtml + '</div>';

    bindEvents();
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
  }

  function bindEvents() {
    var searchInput = _container.querySelector('#kair-aud-doc-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var q = searchInput.value.toLowerCase();
        var cards = _container.querySelectorAll('.kair-aud-hallazgo-card');
        cards.forEach(function (card) {
          var text = card.textContent.toLowerCase();
          card.style.display = text.indexOf(q) !== -1 ? '' : 'none';
        });
      });
    }

    var downloadBtns = _container.querySelectorAll('[data-action="download"]');
    downloadBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var docId = btn.getAttribute('data-doc');
        var doc = DOCUMENTS.find(function (d) { return d.id === docId; });
        if (doc) {
          alert('Descargando: ' + doc.name + '.' + doc.type.toLowerCase());
        }
      });
    });
  }

  function destroy() {
    _container = null;
    _iframe = null;
  }

  return { load: load, destroy: destroy };
})();

window.AuditoriaPlanView = AuditoriaPlanView;
