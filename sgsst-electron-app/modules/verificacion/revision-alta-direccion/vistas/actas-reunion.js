/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: ACTAS DE REUNIÓN (G-FO-009)
 * Master-detail: lista lateral de actas + detalle amplio con agenda y compromisos
 * =====================================================================
 */

var ActasReunionView = (function() {
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

  /* Mock data de actas (basado en formato G-FO-009) */
  var ACTAS_MOCK = [
    {
      id: 'AR-2025-11',
      fecha: '2025-11-20',
      hora: '09:00 - 11:30',
      lugar: 'Sala de Juntas TEMPOSUM',
      responsable: 'Sergina Orozco Hincapié',
      tipo: 'Seguimiento',
      estado: 'Cerrada',
      participantes: ['Sergina Orozco Hincapié', 'Javier Robles Fontalvo', 'Berkis Romero Mercado', 'Lic. María Rodríguez'],
      ordenDelDia: '1. Revisión de cumplimiento de acuerdos del acta anterior\n2. Estado del plan de capacitaciones Q4\n3. Avance del sistema de gestión de EPP\n4. Próximos pasos y cierre',
      compromisos: [
        { id: 'CO-001', tema: 'Cierre de hallazgos auditoría interna Q3', responsable: 'Ing. Carlos López', fechaLimite: '2025-12-15', estado: 'En proceso' },
        { id: 'CO-002', tema: 'Implementación del sistema de EPP digital', responsable: 'Ing. Luis Torres', fechaLimite: '2026-03-30', estado: 'Pendiente' },
        { id: 'CO-003', tema: 'Capacitación en manejo de cargas críticas', responsable: 'Lic. María Rodríguez', fechaLimite: '2025-12-20', estado: 'Cumplido' }
      ]
    },
    {
      id: 'AR-2025-10',
      fecha: '2025-10-15',
      hora: '14:00 - 16:00',
      lugar: 'Sala de Juntas TEMPOSUM',
      responsable: 'Sergina Orozco Hincapié',
      tipo: 'Ordinaria',
      estado: 'Cerrada',
      participantes: ['Sergina Orozco Hincapié', 'Javier Robles Fontalvo', 'Bernardo Ortiz Galindo'],
      ordenDelDia: '1. Lectura del acta anterior\n2. Informe de accidentalidad del periodo\n3. Estado de implementación del SG-SST\n4. Proposiciones y varios',
      compromisos: [
        { id: 'CO-004', tema: 'Actualización matriz de riesgo psicosocial', responsable: 'Lic. María Rodríguez', fechaLimite: '2025-11-30', estado: 'Cumplido' },
        { id: 'CO-005', tema: 'Programa de seguridad vial para conductores', responsable: 'Ing. Luis Torres', fechaLimite: '2026-03-30', estado: 'En proceso' }
      ]
    }
  ];

  function render(ctx) {
    /* Si el backend trae actas reales, las usamos; sino mocks */
    var actas = (ctx.data.actas && ctx.data.actas.length > 0) ? ctx.data.actas : ACTAS_MOCK;

    /* Estado local */
    var viewState = ctx.state.actasReunion || { activeId: actas[0] ? actas[0].id : null };

    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-actas-reunion';

    /* Layout: lista lateral (master) + detalle (detail) */
    var layout = document.createElement('div');
    layout.className = 'kair-rad-master-detail';

    /* ================
       MASTER (lista)
       ================ */
    var master = document.createElement('aside');
    master.className = 'kair-rad-master';

    var masterHead = document.createElement('div');
    masterHead.className = 'kair-rad-master__head';
    masterHead.innerHTML =
      '<h3 class="kair-rad-master__title">Actas registradas</h3>' +
      '<p class="kair-rad-master__sub">' + actas.length + ' acta' + (actas.length !== 1 ? 's' : '') + ' en el periodo</p>' +
      '<button class="kair-rad-header__action kair-rad-header__action--primary" data-acta="new" style="margin-top: var(--rad-s3); width: 100%; justify-content: center">' +
        '<i class="bi bi-plus-circle"></i> Nueva acta' +
      '</button>';
    master.appendChild(masterHead);

    var list = document.createElement('div');
    list.className = 'kair-rad-master__list';
    actas.forEach(function(a) {
      var item = document.createElement('button');
      item.className = 'kair-rad-master__item' + (a.id === viewState.activeId ? ' is-active' : '');
      item.setAttribute('data-acta-id', a.id);
      item.innerHTML =
        '<div class="kair-rad-master__item-head">' +
          '<span class="kair-rad-master__item-id">' + _esc(a.id) + '</span>' +
          '<span class="kair-rad-badge kair-rad-badge--' + (a.estado === 'Cerrada' ? 'success' : a.estado === 'En proceso' ? 'warning' : 'info') + '">' +
            '<span class="dot"></span>' + _esc(a.estado) +
          '</span>' +
        '</div>' +
        '<div class="kair-rad-master__item-date">' + _esc(formatDate(a.fecha)) + '</div>' +
        '<div class="kair-rad-master__item-meta">' +
          '<i class="bi bi-people"></i> ' + (a.participantes ? a.participantes.length : 0) + ' participantes' +
          '<span style="margin: 0 4px">·</span>' +
          '<i class="bi bi-clock"></i> ' + _esc(a.hora || '—') +
        '</div>';
      item.addEventListener('click', function() {
        viewState.activeId = a.id;
        ctx.state.actasReunion = viewState;
        ctx.refresh();
      });
      list.appendChild(item);
    });
    master.appendChild(list);
    layout.appendChild(master);

    /* ================
       DETAIL (detalle)
       ================ */
    var detail = document.createElement('section');
    detail.className = 'kair-rad-detail';

    var acta = actas.filter(function(a) { return a.id === viewState.activeId; })[0] || actas[0];

    if (!acta) {
      detail.appendChild(_emptyDetail());
      layout.appendChild(detail);
      wrap.appendChild(layout);
      return wrap;
    }

    /* Header del detalle */
    var dHead = document.createElement('div');
    dHead.className = 'kair-rad-detail__head';
    dHead.innerHTML =
      '<div class="kair-rad-detail__head-row">' +
        '<span class="kair-rad-badge kair-rad-badge--primary"><span class="dot"></span>G-FO-009 · Acta de Reunión</span>' +
        '<span class="kair-rad-badge kair-rad-badge--' + (acta.estado === 'Cerrada' ? 'success' : 'warning') + '"><span class="dot"></span>' + _esc(acta.estado) + '</span>' +
      '</div>' +
      '<h2 class="kair-rad-detail__title">Acta ' + _esc(acta.id) + '</h2>' +
      '<p class="kair-rad-detail__subtitle">Reunión de ' + _esc(acta.tipo || 'seguimiento') + ' · ' + _esc(formatDate(acta.fecha)) + '</p>' +
      '<div class="kair-rad-detail__actions">' +
        '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-acta="export"><i class="bi bi-download"></i> Exportar</button>' +
        '<button class="kair-rad-header__action kair-rad-header__action--primary" data-acta="edit"><i class="bi bi-pencil"></i> Editar acta</button>' +
      '</div>';
    detail.appendChild(dHead);

    /* Datos generales */
    var datosCard = document.createElement('div');
    datosCard.className = 'kair-rad-detail-card';
    datosCard.innerHTML =
      '<h3 class="kair-rad-side-card__title">Datos generales</h3>' +
      '<div class="kair-rad-detail-grid">' +
        _field('Fecha', formatDate(acta.fecha)) +
        _field('Hora', acta.hora || '—') +
        _field('Lugar', acta.lugar || '—') +
        _field('Responsable', acta.responsable || '—') +
        _field('Tipo', acta.tipo || '—') +
        _field('N° participantes', String((acta.participantes || []).length)) +
      '</div>';
    detail.appendChild(datosCard);

    /* Orden del día */
    var odCard = document.createElement('div');
    odCard.className = 'kair-rad-detail-card';
    odCard.innerHTML =
      '<h3 class="kair-rad-side-card__title">Orden del día</h3>' +
      '<div class="kair-rad-acta__content">' + _esc(acta.ordenDelDia || 'Sin orden del día registrado.') + '</div>';
    detail.appendChild(odCard);

    /* Participantes */
    var partCard = document.createElement('div');
    partCard.className = 'kair-rad-detail-card';
    var partHtml = '<h3 class="kair-rad-side-card__title">Participantes</h3><div class="kair-rad-detail-grid kair-rad-detail-grid--participants">';
    (acta.participantes || []).forEach(function(name) {
      var initials = name.split(' ').map(function(w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
      partHtml +=
        '<div class="kair-rad-participant-row">' +
          '<div class="kair-rad-participant-row__avatar">' + _esc(initials) + '</div>' +
          '<div class="kair-rad-participant-row__body">' +
            '<p class="kair-rad-participant-row__name">' + _esc(name) + '</p>' +
            '<p class="kair-rad-participant-row__role">Empresa</p>' +
          '</div>' +
        '</div>';
    });
    partHtml += '</div>';
    partCard.innerHTML = partHtml;
    detail.appendChild(partCard);

    /* Tabla de compromisos */
    var compCard = document.createElement('div');
    compCard.className = 'kair-rad-detail-card';
    var compHtml =
      '<h3 class="kair-rad-side-card__title">Compromisos</h3>' +
      '<table class="kair-rad-table" style="margin-top: var(--rad-s3)">' +
        '<thead><tr>' +
          '<th>ID</th>' +
          '<th>Tema / Acción</th>' +
          '<th>Responsable</th>' +
          '<th>Fecha límite</th>' +
          '<th>Estado</th>' +
        '</tr></thead><tbody>';
    (acta.compromisos || []).forEach(function(c) {
      var estadoCls = c.estado === 'Cumplido' ? 'success' : (c.estado === 'En proceso' ? 'warning' : 'info');
      compHtml += '<tr>' +
        '<td class="cell-mono">' + _esc(c.id) + '</td>' +
        '<td>' + _esc(c.tema) + '</td>' +
        '<td>' + _esc(c.responsable) + '</td>' +
        '<td>' + _esc(formatDate(c.fechaLimite)) + '</td>' +
        '<td><span class="kair-rad-badge kair-rad-badge--' + estadoCls + '"><span class="dot"></span>' + _esc(c.estado) + '</span></td>' +
      '</tr>';
    });
    if (!acta.compromisos || acta.compromisos.length === 0) {
      compHtml += '<tr><td colspan="5" style="text-align:center; padding: var(--rad-s4); color: var(--rad-text-muted); font: var(--rad-caption)">Sin compromisos registrados en esta acta.</td></tr>';
    }
    compHtml += '</tbody></table>';
    compCard.innerHTML = compHtml;
    detail.appendChild(compCard);

    layout.appendChild(detail);
    wrap.appendChild(layout);

    /* Bind buttons */
    setTimeout(function() {
      var btnExport = wrap.querySelector('[data-acta="export"]');
      var btnEdit = wrap.querySelector('[data-acta="edit"]');
      var btnNew = wrap.querySelector('[data-acta="new"]');

      if (btnExport && typeof ctx.toast === 'function') {
        btnExport.addEventListener('click', function() {
          ctx.toast('Exportación', 'Generando XLSX del acta ' + acta.id, 'info');
        });
      }
      if (btnEdit && typeof ctx.toast === 'function') {
        btnEdit.addEventListener('click', function() {
          ctx.toast('Editor de actas', 'Próximamente en OLA 4', 'info');
        });
      }
      if (btnNew && typeof ctx.toast === 'function') {
        btnNew.addEventListener('click', function() {
          ctx.toast('Nueva acta', 'Iniciando conforme a G-FO-009', 'info');
        });
      }
    }, 0);

    return wrap;
  }

  function _field(label, value) {
    return '<div class="kair-rad-detail-field">' +
      '<span class="kair-rad-detail-field__label">' + _esc(label) + '</span>' +
      '<span class="kair-rad-detail-field__value">' + _esc(value) + '</span>' +
    '</div>';
  }

  function _emptyDetail() {
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-state';
    wrap.innerHTML =
      '<div class="kair-rad-state__icon kair-rad-state__icon--muted">' +
        '<i class="bi bi-file-earmark" style="font-size:1.5rem"></i>' +
      '</div>' +
      '<h3 class="kair-rad-state__title">Sin acta seleccionada</h3>' +
      '<p class="kair-rad-state__desc">Crea una nueva acta de reunión para iniciar el seguimiento conforme a G-FO-009.</p>';
    return wrap;
  }

  return { render: render };
})();

window.ActasReunionView = ActasReunionView;
