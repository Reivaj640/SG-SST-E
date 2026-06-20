/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: PROCEDIMIENTO (G-PR-001)
 * Visor del documento normativo · objeto, alcance, responsables, desarrollo
 * =====================================================================
 */

var ProcedimientoView = (function() {
  'use strict';

  function _esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /* Mock: contenido del procedimiento G-PR-001 Rev. 01 Nov 2016 */
  var PROCEDIMIENTO = {
    codigo: 'G-PR-001',
    revision: 'Rev. 01',
    fecha: 'Nov 2016',
    titulo: 'Procedimiento de Revisión Gerencial del SG-SST',
    secciones: [
      {
        num: '1',
        title: 'Objeto',
        content: 'Definir la metodología para que la alta dirección de TEMPOSUM S.A.S. revise el Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST), evaluando su conveniencia, adecuación, eficacia y mejora continua, conforme a los requisitos del Decreto 1072 de 2015 y la Resolución 0312 de 2019.'
      },
      {
        num: '2',
        title: 'Alcance',
        content: 'Aplica a todas las revisiones gerenciales del SG-SST de la organización, incluyendo la revisión ordinaria anual y las extraordinarias que se requieran por cambios significativos, no conformidades mayores o solicitudes de la alta dirección.'
      },
      {
        num: '3',
        title: 'Responsables',
        items: [
          { rol: 'Gerente General',          responsabilidad: 'Convocar y presidir la reunión de revisión gerencial. Asegurar la disponibilidad de recursos.' },
          { rol: 'Coordinador SST',          responsabilidad: 'Preparar la información de entrada. Elaborar el acta (formato G-FO-006). Gestionar el seguimiento a las acciones resultantes.' },
          { rol: 'Profesional SST',          responsabilidad: 'Consolidar los informes de gestión, indicadores y resultados de auditorías para la presentación.' },
          { rol: 'COPASST',                  responsabilidad: 'Participar activamente y presentar los resultados de su gestión.' },
          { rol: 'Responsables de proceso',  responsabilidad: 'Asistir cuando sean convocados. Presentar el estado de sus indicadores y acciones.' }
        ]
      },
      {
        num: '4',
        title: 'Definiciones',
        items: [
          { termino: 'SG-SST',          definicion: 'Sistema de Gestión de Seguridad y Salud en el Trabajo.' },
          { termino: 'Revisión Gerencial', definicion: 'Evaluación formal realizada por la alta dirección para asegurar la conveniencia, adecuación y eficacia del SG-SST.' },
          { termino: 'Acta G-FO-006',   definicion: 'Documento oficial donde se registran las decisiones, compromisos y acciones resultantes de la revisión gerencial.' },
          { termino: 'No conformidad',  definicion: 'Incumplimiento de un requisito del SG-SST o de la normatividad aplicable.' },
          { termino: 'Acción correctiva', definicion: 'Acción tomada para eliminar la causa de una no conformidad detectada.' }
        ]
      },
      {
        num: '5',
        title: 'Documentos y formatos',
        items: [
          { doc: 'G-FO-006 · Acta de Revisión Gerencial', proposito: 'Registro oficial de la reunión y sus resultados' },
          { doc: 'G-FO-009 · Acta de Reunión Gerencial',  proposito: 'Registro de reuniones ordinarias de seguimiento' },
          { doc: 'G-FO-001 · Despliegue Estratégico',     proposito: 'Objetivos, indicadores y metas del SG-SST' },
          { doc: 'GG-FO-005 · Registro Documental',        proposito: 'Trazabilidad de correspondencia y documentos soporte' }
        ]
      },
      {
        num: '6',
        title: 'Generalidades',
        content: 'La revisión gerencial del SG-SST es un proceso sistemático que permite a la alta dirección evaluar el desempeño del sistema y tomar decisiones informadas sobre su mejora continua. Se realiza al menos una vez al año de forma ordinaria, y de manera extraordinaria cuando se requiera.'
      },
      {
        num: '7',
        title: 'Desarrollo',
        content: 'La revisión gerencial se desarrolla conforme a la siguiente secuencia de actividades:',
        tabla: [
          { que: 'Preparación de información',          quien: 'Coordinador SST',                como: 'Consolida informes, indicadores y resultados del periodo. Convoca con mínimo 8 días hábiles de anticipación.', evidencia: 'Reporte pre-reunión' },
          { que: 'Verificación de acta anterior',        quien: 'Coordinador SST',                como: 'Presenta el estado de cumplimiento de los compromisos y acciones de la revisión anterior.', evidencia: 'Estado de compromisos' },
          { que: 'Revisión de componentes',              quien: 'Gerente General',                como: 'Analiza la política, organización, planificación, aplicación, verificación y mejora del SG-SST.', evidencia: 'Acta G-FO-006' },
          { que: 'Auditorías internas',                 quien: 'Profesional SST',                como: 'Presenta los resultados de las auditorías del periodo y el seguimiento a hallazgos.', evidencia: 'Informes de auditoría' },
          { que: 'Requisitos legales',                  quien: 'Coordinador SST',                como: 'Presenta el estado de cumplimiento de la normatividad aplicable y los cambios normativos recientes.', evidencia: 'Matriz legal' },
          { que: 'Participación y consulta',            quien: 'Representante COPASST',          como: 'Reporta las actividades del periodo y la participación de los trabajadores.', evidencia: 'Actas de reunión' },
          { que: 'Investigación de incidentes',         quien: 'Profesional SST',                como: 'Presenta las estadísticas de accidentalidad y enfermedad laboral y los planes de acción asociados.', evidencia: 'Reportes de investigación' },
          { que: 'Acciones del acta anterior',          quien: 'Coordinador SST',                como: 'Verifica el cierre efectivo de las acciones comprometidas en la revisión anterior.', evidencia: 'Estado de acciones' },
          { que: 'Conclusiones y compromisos',          quien: 'Gerente General',                como: 'Define los compromisos, responsables, plazos y recursos para la mejora del sistema.', evidencia: 'Acta G-FO-006' },
          { que: 'Elaboración del acta',                quien: 'Coordinador SST',                como: 'Documenta la reunión conforme al formato G-FO-006, con todos los puntos tratados y decisiones.', evidencia: 'Acta firmada' },
          { que: 'Distribución del acta',               quien: 'Coordinador SST',                como: 'Distribuye el acta firmada a todos los participantes y la almacena en el repositorio documental.', evidencia: 'Registro de distribución' },
          { que: 'Seguimiento a compromisos',           quien: 'Responsables asignados',         como: 'Ejecutan las acciones conforme a los plazos definidos. Reportan avance en reuniones de seguimiento.', evidencia: 'Reportes de avance' }
        ]
      },
      {
        num: '8',
        title: 'Control de cambios',
        items: [
          { version: 'Rev. 01', fecha: 'Nov 2016', descripcion: 'Emisión inicial del procedimiento conforme a Decreto 1072 de 2015.' }
        ]
      }
    ]
  };

  function render(ctx) {
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-procedimiento';

    var viewer = document.createElement('div');
    viewer.className = 'kair-rad-viewer kair-rad-procedimiento-viewer';

    var doc = document.createElement('article');
    doc.className = 'kair-rad-acta';

    /* Header */
    var head = document.createElement('div');
    head.className = 'kair-rad-acta__head';
    head.innerHTML =
      '<div class="kair-rad-acta__head-l">' +
        '<div class="kair-rad-acta__logo"><i class="bi bi-journal-text" style="font-size:1.5rem"></i></div>' +
        '<div>' +
          '<p class="kair-rad-acta__company">TEMPOSUM S.A.S.</p>' +
          '<p class="kair-rad-acta__doc">Sistema de Gestión de Seguridad y Salud en el Trabajo</p>' +
        '</div>' +
      '</div>' +
      '<div class="kair-rad-acta__head-r">' +
        '<span class="kair-rad-acta__code">' + PROCEDIMIENTO.codigo + '</span>' +
        '<p class="kair-rad-acta__rev">' + PROCEDIMIENTO.revision + ' · ' + PROCEDIMIENTO.fecha + '</p>' +
      '</div>';
    doc.appendChild(head);

    /* Título */
    var title = document.createElement('h1');
    title.className = 'kair-rad-acta__title';
    title.textContent = PROCEDIMIENTO.titulo;
    doc.appendChild(title);

    var sub = document.createElement('p');
    sub.className = 'kair-rad-acta__subtitle';
    sub.textContent = 'Documento normativo de referencia para el ciclo de revisión gerencial del SG-SST';
    doc.appendChild(sub);

    /* Render de cada sección del procedimiento */
    PROCEDIMIENTO.secciones.forEach(function(s) {
      var section = document.createElement('section');
      section.className = 'kair-rad-acta__section';
      section.innerHTML = '<h2 class="kair-rad-acta__section-title">' + s.num + '. ' + _esc(s.title) + '</h2>';

      if (s.content) {
        section.innerHTML += '<div class="kair-rad-acta__content">' + _esc(s.content) + '</div>';
      }

      if (s.items && s.title === 'Responsables') {
        var table = '<table class="kair-rad-table" style="margin-top: var(--rad-s3)"><thead><tr><th style="width: 200px">Rol</th><th>Responsabilidad</th></tr></thead><tbody>';
        s.items.forEach(function(item) {
          table += '<tr><td><strong>' + _esc(item.rol) + '</strong></td><td>' + _esc(item.responsabilidad) + '</td></tr>';
        });
        table += '</tbody></table>';
        section.innerHTML += table;
      }

      if (s.items && s.title === 'Definiciones') {
        var defTable = '<table class="kair-rad-table" style="margin-top: var(--rad-s3)"><thead><tr><th style="width: 200px">Término</th><th>Definición</th></tr></thead><tbody>';
        s.items.forEach(function(item) {
          defTable += '<tr><td><strong>' + _esc(item.termino) + '</strong></td><td>' + _esc(item.definicion) + '</td></tr>';
        });
        defTable += '</tbody></table>';
        section.innerHTML += defTable;
      }

      if (s.items && s.title === 'Documentos y formatos') {
        var docList = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--rad-s3); margin-top: var(--rad-s3)">';
        s.items.forEach(function(item) {
          docList += '<div class="kair-rad-doc-card">' +
            '<div class="kair-rad-doc-card__head"><i class="bi bi-file-earmark-text"></i> ' + _esc(item.doc) + '</div>' +
            '<div class="kair-rad-doc-card__desc">' + _esc(item.proposito) + '</div>' +
          '</div>';
        });
        docList += '</div>';
        section.innerHTML += docList;
      }

      if (s.tabla) {
        var devTable = '<table class="kair-rad-table" style="margin-top: var(--rad-s3)"><thead><tr><th>Qué</th><th>Quién</th><th>Cómo</th><th>Evidencia</th></tr></thead><tbody>';
        s.tabla.forEach(function(item) {
          devTable += '<tr>' +
            '<td><strong>' + _esc(item.que) + '</strong></td>' +
            '<td>' + _esc(item.quien) + '</td>' +
            '<td>' + _esc(item.como) + '</td>' +
            '<td><span style="display: inline-block; padding: 2px 8px; background: var(--rad-info-soft); color: var(--rad-info); border-radius: var(--rad-radius-pill); font: 500 0.6875rem/1.3 var(--rad-font);">' + _esc(item.evidencia) + '</span></td>' +
          '</tr>';
        });
        devTable += '</tbody></table>';
        section.innerHTML += '<div class="kair-rad-acta__content">' + _esc(s.content || '') + '</div>' + devTable;
      }

      if (s.items && s.title === 'Control de cambios') {
        var ccTable = '<table class="kair-rad-table" style="margin-top: var(--rad-s3)"><thead><tr><th style="width: 100px">Versión</th><th style="width: 130px">Fecha</th><th>Descripción</th></tr></thead><tbody>';
        s.items.forEach(function(item) {
          ccTable += '<tr><td><strong>' + _esc(item.version) + '</strong></td><td>' + _esc(item.fecha) + '</td><td>' + _esc(item.descripcion) + '</td></tr>';
        });
        ccTable += '</tbody></table>';
        section.innerHTML += ccTable;
      }

      doc.appendChild(section);
    });

    /* Firmas */
    var sigs = document.createElement('div');
    sigs.className = 'kair-rad-acta__signatures';
    sigs.innerHTML =
      '<div class="kair-rad-acta__signature">' +
        '<div class="kair-rad-acta__signature-line">' +
          '<p class="kair-rad-acta__signature-name">Sergina Orozco Hincapié</p>' +
          '<p class="kair-rad-acta__signature-role">Gerente General · Aprobó</p>' +
        '</div>' +
      '</div>' +
      '<div class="kair-rad-acta__signature">' +
        '<div class="kair-rad-acta__signature-line">' +
          '<p class="kair-rad-acta__signature-name">Javier Robles Fontalvo</p>' +
          '<p class="kair-rad-acta__signature-role">Coordinador SST · Elaboró</p>' +
        '</div>' +
      '</div>';
    doc.appendChild(sigs);

    viewer.appendChild(doc);

    /* Acciones del visor */
    var actions = document.createElement('div');
    actions.className = 'kair-rad-viewer-actions';
    actions.innerHTML =
      '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-proc-action="back"><i class="bi bi-arrow-left"></i> Volver al hub</button>' +
      '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-proc-action="open-word"><i class="bi bi-file-earmark-word"></i> Abrir documento original (.doc)</button>' +
      '<button class="kair-rad-header__action kair-rad-header__action--primary" data-proc-action="print"><i class="bi bi-printer"></i> Imprimir / PDF</button>';
    viewer.appendChild(actions);

    wrap.appendChild(viewer);

    /* Bind actions */
    setTimeout(function() {
      var btnBack = wrap.querySelector('[data-proc-action="back"]');
      var btnOpen = wrap.querySelector('[data-proc-action="open-word"]');
      var btnPrint = wrap.querySelector('[data-proc-action="print"]');

      if (btnBack && typeof ctx.navigate === 'function') {
        btnBack.addEventListener('click', function() { ctx.navigate('hub'); });
      }
      if (btnOpen && typeof ctx.toast === 'function') {
        btnOpen.addEventListener('click', function() {
          ctx.toast('Abriendo documento', 'G-PR-001 Rev. 01 Nov 2016 (Word)', 'info');
        });
      }
      if (btnPrint) {
        btnPrint.addEventListener('click', function() { window.print(); });
      }
    }, 0);

    return wrap;
  }

  return { render: render };
})();

window.ProcedimientoView = ProcedimientoView;
