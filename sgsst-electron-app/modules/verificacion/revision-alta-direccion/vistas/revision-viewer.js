/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: REVISIÓN VIEWER
 * Acta imprimible oficial G-FO-006 Rev. 03
 * · Header oficial con logo + código
 * · Generalidades + 12 secciones + conclusiones + acciones + firmas
 * · Print-ready (sin chrome al imprimir)
 * =====================================================================
 */

var RevisionViewerView = (function() {
  'use strict';

  function _esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatDate(d) {
    if (!d) return '';
    var months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var parts = String(d).split('-');
    if (parts.length === 3) return parseInt(parts[2], 10) + ' de ' + months[parseInt(parts[1], 10) - 1] + ' de ' + parts[0];
    return String(d);
  }

  function render(ctx) {
    var id = ctx.params && ctx.params.id;
    var revision = null;

    if (id) {
      revision = (ctx.data.revisiones || []).filter(function(r) { return r.id === id; })[0];
    }
    if (!revision) revision = ctx.data.cicloActivo || (ctx.data.revisiones || [])[0];
    if (!revision) {
      var empty = document.createElement('div');
      empty.className = 'kair-rad-state';
      empty.innerHTML =
        '<div class="kair-rad-state__icon kair-rad-state__icon--muted">' +
          '<i class="bi bi-file-earmark-x" style="font-size:1.5rem"></i>' +
        '</div>' +
        '<h3 class="kair-rad-state__title">No hay acta para mostrar</h3>' +
        '<p class="kair-rad-state__desc">Selecciona una revisión del listado para ver su acta.</p>';
      return empty;
    }

    /* Normalizar formato de secciones: el editor guarda {lectura: {contenido}} (objeto por key),
       pero el viewer/parser produce [{numero, contenido}] (array). Detectamos y normalizamos. */
    (function _normalizarSecciones() {
      if (Array.isArray(revision.secciones)) return; // ya es array
      if (revision.secciones && typeof revision.secciones === 'object') {
        /* Mapear key → numero (1-12) */
        var KEY_TO_NUM = {
          lectura: 1, componentes: 2, auditorias: 3, requisitos: 4,
          participacion: 5, incidentes: 6, acciones: 7, cambios: 8,
          supervision: 9, evaluacion: 10, preventivas: 11, conclusiones: 12
        };
        var TITULOS = {
          lectura: 'Lectura del acta anterior',
          componentes: 'Revisión de componentes organizacionales',
          auditorias: 'Auditorías internas',
          requisitos: 'Requisitos legales',
          participacion: 'Participación y consulta',
          incidentes: 'Investigación de incidentes',
          acciones: 'Acciones del acta anterior',
          cambios: 'Cambios que pueden afectar el SG-SST',
          supervision: 'Recursos',
          evaluacion: 'Gestión de riesgos',
          preventivas: 'Actividades pendientes',
          conclusiones: 'Conclusiones, recomendaciones y acciones tomadas'
        };
        var arr = [];
        Object.keys(revision.secciones).forEach(function(key) {
          var sec = revision.secciones[key];
          if (!sec) return;
          arr.push({
            numero: KEY_TO_NUM[key] || 0,
            titulo: TITULOS[key] || key,
            contenido: (sec.contenido || ''),
            subTemas: []
          });
        });
        arr.sort(function(a, b) { return a.numero - b.numero; });
        revision.secciones = arr;
      }
      if (!revision.secciones) revision.secciones = [];
    })();

var SECCIONES = (window.RevisionEditorView && window.RevisionEditorView.SECCIONES) || [];
    var editorState = (ctx.state && ctx.state.editor) || { secciones: {}, completed: {} };

    /* Empresa: priorizar revision.empresa, luego state.empresaActiva, luego fallback genérico */
    var empresaNombre = revision.empresa
      || (ctx.data && ctx.data.empresaActiva)
      || (ctx.state && ctx.state.empresaActiva)
      || 'EMPRESA';

    /* Mapear secciones del parser (numero 1-12) a keys del editor para lookup.
       El parser guarda secciones como { numero, titulo, contenido, subTemas[] }. */
    function _getSeccionDelRevision(numero) {
      var secs = (revision.secciones || []);
      return secs.find(function(s) { return s.numero === numero; }) || null;
    }
    function _getContenidoSeccion(numero) {
      var sec = _getSeccionDelRevision(numero);
      return sec && sec.contenido ? sec.contenido : '';
    }
    function _getSubTemasSeccion(numero) {
      var sec = _getSeccionDelRevision(numero);
      return (sec && sec.subTemas && sec.subTemas.length) ? sec.subTemas : [];
    }

    /* View wrapper */
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-revision-viewer';

    /* Viewer container */
    var viewer = document.createElement('div');
    viewer.className = 'kair-rad-viewer';

    /* Acta */
    var acta = document.createElement('article');
    acta.className = 'kair-rad-acta';

    /* Header oficial */
    var head = document.createElement('div');
    head.className = 'kair-rad-acta__head';
    head.innerHTML =
      '<div class="kair-rad-acta__head-l">' +
        '<div class="kair-rad-acta__logo">T+</div>' +
        '<div>' +
          '<p class="kair-rad-acta__company">' + _esc(empresaNombre) + '</p>' +
          '<p class="kair-rad-acta__doc">Sistema de Gestión de Seguridad y Salud en el Trabajo</p>' +
        '</div>' +
      '</div>' +
      '<div class="kair-rad-acta__head-r">' +
        '<span class="kair-rad-acta__code">G-FO-006</span>' +
        '<p class="kair-rad-acta__rev">Rev. 03 · ' + formatDate(revision.fecha || revision.fechaProgramada || '2025-11-30') + '</p>' +
      '</div>';
    acta.appendChild(head);

    /* Título del acta */
    var titleEl = document.createElement('h1');
    titleEl.className = 'kair-rad-acta__title';
    titleEl.textContent = 'Acta de Revisión Gerencial del SG-SST';
    acta.appendChild(titleEl);

    var subEl = document.createElement('p');
    subEl.className = 'kair-rad-acta__subtitle';
    subEl.textContent = 'Conforme al Decreto 1072 de 2015 · Art. 2.2.4.1.7 y Resolución 0312 de 2019';
    acta.appendChild(subEl);

    /* Sección: Generalidades */
    var genSection = document.createElement('section');
    genSection.className = 'kair-rad-acta__section';
    genSection.innerHTML = '<h2 class="kair-rad-acta__section-title">1. Generalidades</h2>' +
      '<div class="kair-rad-acta__grid">' +
        _field('Consecutivo', revision.id) +
        _field('Período', revision.periodo) +
        _field('Fecha realizada', formatDate(revision.fecha || revision.fechaProgramada)) +
        _field('Lugar', revision.lugar) +
        _field('Preside', revision.preside) +
        _field('Elabora', revision.elabora) +
      '</div>';
    acta.appendChild(genSection);

    /* Sección: Participantes (desde revision.porEmpresa / invitados del parser) */
    var porEmpresa = revision.porEmpresa || [];
    var invitados = revision.invitados || [];
    var partSection = document.createElement('section');
    partSection.className = 'kair-rad-acta__section';
    var partHtml = '<h2 class="kair-rad-acta__section-title">2. Participantes</h2>' +
      '<div class="kair-rad-acta__participants">' +
        '<div class="kair-rad-acta__participant-block">' +
          '<h4>Por la empresa</h4>';
    if (porEmpresa.length === 0) {
      partHtml += '<p class="kair-rad-acta__empty">Sin participantes registrados por la empresa.</p>';
    } else {
      porEmpresa.forEach(function(p) {
        partHtml += _participantRow(p.nombre, p.cargo);
      });
    }
    partHtml += '</div><div class="kair-rad-acta__participant-block"><h4>Invitados</h4>';
    if (invitados.length === 0) {
      partHtml += '<p class="kair-rad-acta__empty">Sin invitados registrados.</p>';
    } else {
      invitados.forEach(function(p) {
        partHtml += _participantRow(p.nombre, p.cargo);
      });
    }
    partHtml += '</div></div>';
    partSection.innerHTML = partHtml;
    acta.appendChild(partSection);

    /* Secciones 3-14 (las 12 secciones canónicas) — contenido desde el JSON real.
       Itera sobre revision.secciones[] (orden del XLSX importado) en vez de SECCIONES
       del editor, porque el orden y títulos pueden diferir entre la plantilla del
       Ministerio y el editor. Así respetamos exactamente lo que tiene cada archivo. */
    (revision.secciones || []).forEach(function(sec) {
      if (!sec.numero) return;
      var sectionEl = document.createElement('section');
      sectionEl.className = 'kair-rad-acta__section';

      var titleText = (sec.numero + 2) + '. ' + (sec.titulo || ('Sección ' + sec.numero));
      var contenidoReal = sec.contenido || '';
      var subTemasReales = (sec.subTemas && sec.subTemas.length) ? sec.subTemas : [];

      var contentHtml = contenidoReal
        ? '<div class="kair-rad-acta__content">' + _esc(contenidoReal).replace(/\n/g, '<br>') + '</div>'
        : '<div class="kair-rad-acta__content"><em>Sin contenido registrado en esta sección.</em></div>';

      sectionEl.innerHTML = '<h2 class="kair-rad-acta__section-title">' + _esc(titleText) + '</h2>' + contentHtml;

      if (subTemasReales.length > 0) {
        var subHtml = '<ul class="kair-rad-acta__subpoints">';
        subTemasReales.forEach(function(st) {
          subHtml += '<li><strong>' + _esc(st.titulo || '') + ':</strong> ' + _esc(st.contenido || '') + '</li>';
        });
        subHtml += '</ul>';
        sectionEl.innerHTML += subHtml;
      }

      acta.appendChild(sectionEl);
    });

    /* Sección: Acciones tomadas (de §7) y Conclusiones (de §12) ya están en las 12 secciones.
       Aquí solo mostramos el bloque de acciones detalladas si hay sub-temas con compromisos. */

    /* Firmas — solo si hay datos reales; si no, ocultar */
    var hayFirmantes = (revision.porEmpresa && revision.porEmpresa.length > 0)
      || revision.preside || revision.elabora;
    if (hayFirmantes) {
      var sigs = document.createElement('div');
      sigs.className = 'kair-rad-acta__signatures';
      var sigsHtml = '';
      // Primera firma: quien preside
      if (revision.preside) {
        sigsHtml += '<div class="kair-rad-acta__signature">' +
          '<div class="kair-rad-acta__signature-line">' +
            '<p class="kair-rad-acta__signature-name">' + _esc(revision.preside) + '</p>' +
            '<p class="kair-rad-acta__signature-role">Preside</p>' +
          '</div>' +
        '</div>';
      }
      // Segunda firma: quien elabora
      if (revision.elabora) {
        sigsHtml += '<div class="kair-rad-acta__signature">' +
          '<div class="kair-rad-acta__signature-line">' +
            '<p class="kair-rad-acta__signature-name">' + _esc(revision.elabora) + '</p>' +
            '<p class="kair-rad-acta__signature-role">Elaboró</p>' +
          '</div>' +
        '</div>';
      }
      sigs.innerHTML = sigsHtml;
      acta.appendChild(sigs);
    }

    viewer.appendChild(acta);

    /* Acciones del viewer (no se imprimen) */
    var actions = document.createElement('div');
    actions.className = 'kair-rad-viewer-actions';
    actions.innerHTML =
      '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-viewer-action="back"><i class="bi bi-arrow-left"></i> Volver al listado</button>' +
      '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-viewer-action="export"><i class="bi bi-download"></i> Exportar XLSX</button>' +
      '<button class="kair-rad-header__action kair-rad-header__action--primary" data-viewer-action="print"><i class="bi bi-printer"></i> Imprimir / Guardar PDF</button>';
    viewer.appendChild(actions);

    wrap.appendChild(viewer);

    /* Bind actions */
    setTimeout(function() {
      var btnBack = wrap.querySelector('[data-viewer-action="back"]');
      var btnExport = wrap.querySelector('[data-viewer-action="export"]');
      var btnPrint = wrap.querySelector('[data-viewer-action="print"]');

      if (btnBack) {
        btnBack.addEventListener('click', function() {
          if (typeof ctx.navigate === 'function') ctx.navigate('revisiones-list');
        });
      }
      if (btnExport) {
        btnExport.addEventListener('click', function() {
          if (typeof ctx.toast === 'function') ctx.toast('Exportación', 'Generando XLSX del acta G-FO-006', 'info');
        });
      }
      if (btnPrint) {
        btnPrint.addEventListener('click', function() {
          window.print();
        });
      }
    }, 0);

    return wrap;
  }

  function _field(label, value) {
    return '<div class="kair-rad-acta__field">' +
      '<span class="kair-rad-acta__label">' + _esc(label) + '</span>' +
      '<span class="kair-rad-acta__value">' + _esc(value || '—') + '</span>' +
    '</div>';
  }

  function _participantRow(name, role) {
    var initials = name.split(' ').map(function(w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    return '<div class="kair-rad-participant-row">' +
      '<div class="kair-rad-participant-row__avatar">' + _esc(initials) + '</div>' +
      '<div class="kair-rad-participant-row__body">' +
        '<p class="kair-rad-participant-row__name">' + _esc(name) + '</p>' +
        '<p class="kair-rad-participant-row__role">' + _esc(role) + '</p>' +
      '</div>' +
    '</div>';
  }

  return { render: render };
})();

window.RevisionViewerView = RevisionViewerView;
