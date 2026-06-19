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

  /**
   * Transforma un acta del shape DB ({id, numero, fecha, estado, metadata})
   * al shape que espera la vista master-detail.
   * IMPORTANTE: extrae tipo/año/semestre/revisionId de metadata para el modelo semestral.
   * @param {Object} dbActa - Acta cruda desde SQLite
   * @returns {Object} Acta en shape de vista
   */
  function _mapDbActaToView(dbActa) {
    var meta = dbActa.metadata || {};
    /* Si metadata no tiene año/semestre, derivarlos de la fecha */
    var fecha = dbActa.fecha || '';
    var año = meta.año || (fecha ? parseInt(fecha.substring(0, 4), 10) : new Date().getFullYear());
    var semestre = meta.semestre || (fecha ? (parseInt(fecha.substring(5, 7), 10) <= 6 ? 1 : 2) : 1);

    return {
      id: dbActa.id,
      numero: dbActa.numero,
      fecha: fecha,
      estado: dbActa.estado || 'Abierta',
      archivo: dbActa.archivo || '',
      /* Campos del modelo semestral */
      tipo: meta.tipo || 'Principal',
      año: año,
      semestre: semestre,
      revisionId: meta.revisionId || null,
      /* Campos derivados de metadata */
      hora: (meta.horaInicio && meta.horaFin) ? (meta.horaInicio + ' - ' + meta.horaFin) : '—',
      lugar: meta.ciudad || '—',
      responsable: meta.preside || '—',
      tema: meta.tema || '',
      participantes: Array.isArray(meta.participantes) ? meta.participantes.map(function(p) { return p.nombre || ''; }) : [],
      ordenDelDia: meta.ordenDia || '',
      compromisos: Array.isArray(meta.desarrollo) ? meta.desarrollo.map(function(c, i) {
        return {
          id: c.id || ('CO-' + String(i + 1).padStart(3, '0')),
          tema: c.temaTratado || '',
          responsable: c.responsable || '—',
          fechaLimite: c.fecha || '',
          estado: c.estado || 'Pendiente'
        };
      }) : []
    };
  }

  /**
   * Agrupa las actas por año y semestre para mostrar la lista master-detail.
   * @param {Array} actas - Actas en shape de vista
   * @returns {Array} Estructura agrupada [{ año, semestre, actas: [...] }, ...]
   */
  function _agruparPorAñoSemestre(actas) {
    var grupos = {};
    actas.forEach(function(a) {
      var key = a.año + '-' + a.semestre;
      if (!grupos[key]) {
        grupos[key] = { año: a.año, semestre: a.semestre, actas: [] };
      }
      grupos[key].actas.push(a);
    });
    /* Ordenar por año DESC, semestre DESC */
    return Object.keys(grupos)
      .map(function(k) { return grupos[k]; })
      .sort(function(a, b) {
        if (a.año !== b.año) return b.año - a.año;
        return b.semestre - a.semestre;
      });
  }

  function render(ctx) {
    /* Transformar actas del backend al shape de vista */
    var actas = (ctx.data.actas || []).map(_mapDbActaToView);

    /* Si no hay actas, mostrar empty state con CTA para crear primera */
    if (actas.length === 0) {
      return _renderEmptyState(ctx);
    }

    /* Agrupar por año y semestre para mostrar estructura jerárquica */
    var grupos = _agruparPorAñoSemestre(actas);

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

    /* Lista agrupada por año y semestre */
    grupos.forEach(function(grupo) {
      var añoLabel = grupo.año + (grupo.año === new Date().getFullYear() ? ' (actual)' : '');

      /* Encabezado de año */
      var añoHead = document.createElement('div');
      añoHead.className = 'kair-rad-master__group-head';
      añoHead.style.cssText = 'font:var(--rad-caption); color:var(--rad-text-muted); padding:var(--rad-s2) var(--rad-s3); text-transform:uppercase; letter-spacing:0.05em; margin-top:var(--rad-s3); border-bottom:1px solid var(--rad-border-soft)';
      añoHead.textContent = 'Año ' + añoLabel;
      list.appendChild(añoHead);

      grupo.actas.forEach(function(a) {
        var item = document.createElement('button');
        item.className = 'kair-rad-master__item' + (a.id === viewState.activeId ? ' is-active' : '');
        item.setAttribute('data-acta-id', a.id);

        var tipoBadgeCls = a.tipo === 'Principal' ? 'success' : 'info';
        var semLabel = 'S' + a.semestre + (a.tipo === 'Seguimiento' ? '-SEG' : '');

        item.innerHTML =
          '<div class="kair-rad-master__item-head">' +
            '<span class="kair-rad-master__item-id">' + _esc(a.id) + '</span>' +
            '<span class="kair-rad-badge kair-rad-badge--' + tipoBadgeCls + '">' +
              '<span class="dot"></span>' + _esc(a.tipo) +
            '</span>' +
          '</div>' +
          '<div class="kair-rad-master__item-date">' +
            '<i class="bi bi-calendar3"></i> ' + _esc(formatDate(a.fecha)) +
            ' <span style="color:var(--rad-text-muted); margin-left:var(--rad-s2)">' + semLabel + '</span>' +
          '</div>' +
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
    var tipoBadgeCls = acta.tipo === 'Principal' ? 'success' : 'info';
    dHead.innerHTML =
      '<div class="kair-rad-detail__head-row">' +
        '<span class="kair-rad-badge kair-rad-badge--primary"><span class="dot"></span>G-FO-009 · Acta de Reunión</span>' +
        '<span class="kair-rad-badge kair-rad-badge--' + tipoBadgeCls + '"><span class="dot"></span>' + _esc(acta.tipo || 'Principal') + '</span>' +
        '<span class="kair-rad-badge kair-rad-badge--' + (acta.estado === 'Cerrada' ? 'success' : 'warning') + '"><span class="dot"></span>' + _esc(acta.estado) + '</span>' +
      '</div>' +
      '<h2 class="kair-rad-detail__title">Acta ' + _esc(acta.id) + '</h2>' +
      '<p class="kair-rad-detail__subtitle">Año ' + _esc(String(acta.año)) + ' · Semestre ' + _esc(String(acta.semestre)) +
        (acta.revisionId ? ' · Rev: ' + _esc(acta.revisionId) : '') +
        ' · Reunión de ' + _esc(acta.tipo === 'Principal' ? 'revisión gerencial' : 'seguimiento') +
      '</p>' +
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
      if (btnEdit && typeof ctx.navigate === 'function') {
        btnEdit.addEventListener('click', function() {
          ctx.navigate('actas-editor', { id: acta.id });
        });
      }
      if (btnNew && typeof ctx.navigate === 'function') {
        btnNew.addEventListener('click', function() {
          ctx.navigate('actas-editor');
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

  /**
   * Renderiza el empty state cuando no hay actas registradas.
   * Muestra el contexto del modelo semestral (2 actas/año) para que el usuario entienda.
   * @param {Object} ctx - Contexto de la vista (para navigate/toast)
   * @returns {HTMLElement} Wrap con el empty state
   */
  function _renderEmptyState(ctx) {
    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-state';
    wrap.style.padding = 'var(--rad-s8) var(--rad-s6)';
    wrap.innerHTML =
      '<div class="kair-rad-state__icon kair-rad-state__icon--muted">' +
        '<i class="bi bi-file-earmark-text" style="font-size:1.75rem"></i>' +
      '</div>' +
      '<h3 class="kair-rad-state__title">Sin actas registradas</h3>' +
      '<p class="kair-rad-state__desc">' +
        'El formato G-FO-009 se usa 2 veces por año para registrar las reuniones gerenciales: ' +
        '<strong>1 acta principal</strong> (donde se firma la revisión del periodo anterior) y ' +
        '<strong>1 acta de seguimiento</strong> (primer seguimiento a mitad de año).' +
      '</p>' +
      '<button class="kair-rad-header__action kair-rad-header__action--primary" id="kair-rad-actas-empty-new" style="margin-top: var(--rad-s4)">' +
        '<i class="bi bi-plus-circle"></i> Crear primera acta' +
      '</button>';

    setTimeout(function() {
      var btn = document.getElementById('kair-rad-actas-empty-new');
      if (btn && typeof ctx.navigate === 'function') {
        btn.addEventListener('click', function() {
          ctx.navigate('actas-editor');
        });
      }
    }, 0);

    return wrap;
  }

  return { render: render };
})();

window.ActasReunionView = ActasReunionView;
