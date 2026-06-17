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

    var SECCIONES = (window.RevisionEditorView && window.RevisionEditorView.SECCIONES) || [];
    var editorState = (ctx.state && ctx.state.editor) || { secciones: {}, completed: {} };

    /* 12 secciones con contenido mock (para vista) */
    var contenidoSeccion = {
      'lectura': 'Se realiza la lectura integral del acta de revisión gerencial anterior (RG-2024-01) verificando el cumplimiento de los compromisos y acciones derivados. Se confirma el cierre efectivo del 87% de las acciones propuestas en el periodo anterior.',
      'componentes': 'La política SST se encuentra vigente y aprobada por la gerencia general con fecha 15 de marzo de 2024. Se mantienen asignados los responsables del SG-SST con sus roles claramente definidos. El presupuesto asignado para el periodo 2025-2026 alcanza los $850 millones.',
      'auditorias': 'Se ejecutaron 2 auditorías internas durante el periodo: la primera al componente de gestión de peligros (junio 2025) y la segunda al componente de gestión de salud (septiembre 2025). Se identificaron 4 hallazgos menores, todos con plan de acción en ejecución.',
      'requisitos': 'La matriz legal se mantiene actualizada al 100% con corte a 30 de noviembre de 2025. Se verificó el cumplimiento del Decreto 1072 de 2015 y la Resolución 0312 de 2019. No se identificaron incumplimientos materiales durante el periodo.',
      'participacion': 'El COPASST se reunió mensualmente con quórum completo (10 sesiones en el año). Se ejecutaron 28 actividades de capacitación con participación del 92% de los trabajadores. Las actas reposan en el repositorio documental.',
      'incidentes': 'Se presentaron 3 accidentes de trabajo leves durante el periodo, todos investigados y cerrados. La tasa de accidentalidad se mantuvo en 1.8 accidentes por cada 200.000 horas trabajadas, dentro de la meta establecida (≤ 2.0).',
      'acciones': 'De las 8 acciones resultantes de la revisión anterior, 7 se cerraron efectivamente y 1 se encuentra en ejecución con avance del 65% (Implementación del sistema de gestión de EPP digital).',
      'cambios': 'Se identificaron tres cambios significativos: (1) actualización de la normatividad sobre riesgo psicosocial, (2) apertura de nueva sede operativa en Barranquilla, (3) renovación del software de gestión SST. Todos cuentan con plan de adaptación.',
      'supervision': 'Se ejecutaron 12 inspecciones planeadas de las 12 programadas (100%). Se realizaron 24 inspecciones no planeadas. Se generaron 18 hallazgos, todos con plan de cierre.',
      'evaluacion': 'La evaluación inicial del SG-SST fue actualizada en marzo de 2025. Se identificaron 23 oportunidades de mejora, de las cuales 18 ya están implementadas.',
      'preventivas': 'Se ejecutaron 22 acciones preventivas y 5 acciones correctivas durante el periodo. La eficacia medida al cierre es del 87%, superior a la meta del 85%.',
      'conclusiones': 'El SG-SST de TEMPOSUM S.A.S. se mantiene en operación conforme a los requisitos normativos. Los indicadores principales muestran tendencia favorable. Se recomienda mantener el ritmo de implementación de acciones y fortalecer los mecanismos de participación.'
    };

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
          '<p class="kair-rad-acta__company">' + _esc(revision.empresa || 'TEMPOSUM S.A.S.') + '</p>' +
          '<p class="kair-rad-acta__doc">Sistema de Gestión de Seguridad y Salud en el Trabajo</p>' +
        '</div>' +
      '</div>' +
      '<div class="kair-rad-acta__head-r">' +
        '<span class="kair-rad-acta__code">G-FO-006</span>' +
        '<p class="kair-rad-acta__rev">Rev. 03 · ' + formatDate('2025-11-30') + '</p>' +
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
        _field('Lugar', 'Sede Administrativa TEMPOSUM S.A.S.') +
        _field('Preside', revision.preside || 'Sergina Orozco Hincapié') +
        _field('Elabora', revision.elabora || 'Javier Robles Fontalvo') +
      '</div>';
    acta.appendChild(genSection);

    /* Sección: Participantes */
    var partSection = document.createElement('section');
    partSection.className = 'kair-rad-acta__section';
    partSection.innerHTML =
      '<h2 class="kair-rad-acta__section-title">2. Participantes</h2>' +
      '<div class="kair-rad-acta__participants">' +
        '<div class="kair-rad-acta__participant-block">' +
          '<h4>Por la empresa</h4>' +
          _participantRow('Sergina Orozco Hincapié', 'Representante Legal / Gerente General') +
          _participantRow('Javier Robles Fontalvo', 'Coordinador SG-SST') +
          _participantRow('Berkis Romero Mercado', 'Profesional SG-SST') +
        '</div>' +
        '<div class="kair-rad-acta__participant-block">' +
          '<h4>Invitados</h4>' +
          _participantRow('Bernardo Ortiz Galindo', 'Presidente COPASST') +
          _participantRow('Lic. María Rodríguez', 'Coordinadora de Recursos Humanos') +
        '</div>' +
      '</div>';
    acta.appendChild(partSection);

    /* Secciones 3-14 (las 12 secciones canónicas) */
    SECCIONES.filter(function(s) { return !s.isMeta; }).forEach(function(s) {
      var sectionEl = document.createElement('section');
      sectionEl.className = 'kair-rad-acta__section';

      var titleText = (s.num + 2) + '. ' + s.title; /* +2 porque 1=Generalidades, 2=Participantes */
      sectionEl.innerHTML = '<h2 class="kair-rad-acta__section-title">' + _esc(titleText) + '</h2>' +
        '<div class="kair-rad-acta__content">' + _esc(contenidoSeccion[s.key] || 'Sin contenido registrado en esta sección.') + '</div>';

      /* Sub-puntos si los hay */
      var subs = (window.RevisionEditorView && window.RevisionEditorView._subPuntosForSeccion(s.key)) || [];
      if (subs.length > 0) {
        var subHtml = '<ul class="kair-rad-acta__subpoints">';
        subs.forEach(function(sp, i) {
          var subKey = s.key + '-sub-' + i;
          var estado = (editorState.secciones[s.key] &&
                       editorState.secciones[s.key].subpuntos &&
                       editorState.secciones[s.key].subpuntos[subKey] &&
                       editorState.secciones[s.key].subpuntos[subKey].estado) || 'Cumple';
          var stateCls = {
            'Cumple': 'state--success',
            'Parcial': 'state--warning',
            'No cumple': 'state--danger',
            'Pendiente': 'state--pending'
          }[estado] || 'state--pending';
          subHtml += '<li>' + _esc(sp) + '<span class="state ' + stateCls + '">' + _esc(estado) + '</span></li>';
        });
        subHtml += '</ul>';
        sectionEl.innerHTML += subHtml;
      }

      acta.appendChild(sectionEl);
    });

    /* Sección: Conclusiones y recomendaciones */
    var conclSection = document.createElement('section');
    conclSection.className = 'kair-rad-acta__section';
    conclSection.innerHTML =
      '<h2 class="kair-rad-acta__section-title">15. Conclusiones y recomendaciones</h2>' +
      '<div class="kair-rad-acta__content">' +
        'El Sistema de Gestión de Seguridad y Salud en el Trabajo de TEMPOSUM S.A.S. demuestra un nivel de madurez avanzado, con cumplimiento superior al 90% en los indicadores estructurales y de proceso. La participación de los trabajadores, la asignación de recursos y el seguimiento a la gestión son consistentes con la política SST vigente. Se recomienda a la gerencia: (1) mantener el ritmo de inversión en programas preventivos, (2) fortalecer los mecanismos de evaluación de eficacia de acciones, (3) ampliar la cobertura del sistema a la nueva sede operativa, (4) actualizar la matriz de riesgos con la nueva normatividad sobre riesgo psicosocial.' +
      '</div>';
    acta.appendChild(conclSection);

    /* Sección: Acciones tomadas */
    var actSection = document.createElement('section');
    actSection.className = 'kair-rad-acta__section';
    actSection.innerHTML =
      '<h2 class="kair-rad-acta__section-title">16. Acciones tomadas</h2>' +
      '<table class="kair-rad-table" style="margin-top:var(--rad-s2)">' +
        '<thead><tr><th>#</th><th>Acción</th><th>Responsable</th><th>Fecha límite</th><th>Estado</th></tr></thead>' +
        '<tbody>' +
          '<tr><td>1</td><td>Implementación del sistema de gestión de EPP digital</td><td>Ing. Carlos López</td><td>30 jun 2026</td><td><span class="kair-rad-badge kair-rad-badge--warning"><span class="dot"></span>En proceso</span></td></tr>' +
          '<tr><td>2</td><td>Actualización matriz de riesgo psicosocial</td><td>Lic. María Rodríguez</td><td>31 mar 2026</td><td><span class="kair-rad-badge kair-rad-badge--info"><span class="dot"></span>Pendiente</span></td></tr>' +
          '<tr><td>3</td><td>Programa de seguridad vial para conductores</td><td>Ing. Luis Torres</td><td>30 mar 2026</td><td><span class="kair-rad-badge kair-rad-badge--warning"><span class="dot"></span>En proceso</span></td></tr>' +
          '<tr><td>4</td><td>Capacitación en manejo de cargas críticas</td><td>Lic. María Rodríguez</td><td>30 abr 2026</td><td><span class="kair-rad-badge kair-rad-badge--success"><span class="dot"></span>Cumplido</span></td></tr>' +
        '</tbody>' +
      '</table>';
    acta.appendChild(actSection);

    /* Firmas */
    var sigs = document.createElement('div');
    sigs.className = 'kair-rad-acta__signatures';
    sigs.innerHTML =
      '<div class="kair-rad-acta__signature">' +
        '<div class="kair-rad-acta__signature-line">' +
          '<p class="kair-rad-acta__signature-name">Sergina Orozco Hincapié</p>' +
          '<p class="kair-rad-acta__signature-role">Gerente General · Representante Legal</p>' +
        '</div>' +
      '</div>' +
      '<div class="kair-rad-acta__signature">' +
        '<div class="kair-rad-acta__signature-line">' +
          '<p class="kair-rad-acta__signature-name">Javier Robles Fontalvo</p>' +
          '<p class="kair-rad-acta__signature-role">Coordinador SG-SST · Elaboró</p>' +
        '</div>' +
      '</div>';
    acta.appendChild(sigs);

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
