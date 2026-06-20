/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: REVISIÓN EDITOR
 * Patrón C Workflow · 12 secciones canónicas + sidebar + footer sticky
 * Editor del acta G-FO-006 con avance, sub-puntos verificables y firmas
 * =====================================================================
 */

var RevisionEditorView = (function() {
  'use strict';

  /* Las 12 secciones canónicas del formato G-FO-006 Rev. 03 */
  var SECCIONES = [
    {
      key: 'generalidades',
      num: 0,
      title: 'Generalidades',
      isMeta: true,
      desc: 'Encabezado del acta G-FO-006 · Rev. 03'
    },
    { key: 'lectura',       num: 1,  title: 'Lectura del acta anterior', desc: 'Se realiza la lectura del acta de revisión gerencial anterior y se verifican las acciones pendientes.' },
    { key: 'componentes',   num: 2,  title: 'Revisión de componentes organizacionales', desc: 'Política, responsables, recursos, comunicación y competencia del SG-SST.' },
    { key: 'auditorias',    num: 3,  title: 'Auditorías internas', desc: 'Resultados del plan de auditoría interna del periodo y seguimiento de hallazgos.' },
    { key: 'requisitos',    num: 4,  title: 'Requisitos legales', desc: 'Evaluación del cumplimiento de la normatividad legal vigente aplicable al SG-SST.' },
    { key: 'participacion', num: 5,  title: 'Participación y consulta', desc: 'Mecanismos de participación, consulta y comunicación con los trabajadores.' },
    { key: 'incidentes',    num: 6,  title: 'Investigación de incidentes', desc: 'Análisis de incidentes, accidentes de trabajo y enfermedad laboral del periodo.' },
    { key: 'acciones',      num: 7,  title: 'Acciones del acta de revisión gerencial anterior', desc: 'Estado y cierre de las acciones resultantes de la revisión anterior.' },
    { key: 'cambios',       num: 8,  title: 'Cambios que puedan afectar el SG-SST', desc: 'Cambios internos y externos que impacten el sistema.' },
    { key: 'supervision',   num: 9,  title: 'Resultados de la supervisión', desc: 'Resultados de las inspecciones y mediciones de seguimiento.' },
    { key: 'evaluacion',    num: 10, title: 'Resultados de la evaluación inicial', desc: 'Revisión de la evaluación inicial del SG-SST y su actualización.' },
    { key: 'preventivas',   num: 11, title: 'Acciones preventivas y correctivas', desc: 'Estado y eficacia de las acciones preventivas y correctivas.' },
    { key: 'conclusiones',  num: 12, title: 'Conclusiones', desc: 'Conclusiones generales, compromisos y decisiones de la gerencia.' }
  ];

  /* Sub-puntos por sección (mock para vista rápida) */
  function _subPuntosForSeccion(key) {
    var m = {
      'lectura': [
        'Lectura del acta anterior RG-2024-01',
        'Verificación de acciones pendientes'
      ],
      'componentes': [
        'Política SST vigente',
        'Responsables asignados',
        'Recursos asignados',
        'Comunicación interna'
      ],
      'auditorias': [
        'Plan de auditoría 2025',
        'Hallazgos abiertos',
        'Cierre de no conformidades'
      ],
      'requisitos': [
        'Matriz legal actualizada',
        'Cumplimiento Decreto 1072',
        'Resolución 0312 de 2019'
      ],
      'participacion': [
        'Funcionarios capacitados',
        'COPASST activo',
        'Actas de reunión'
      ],
      'incidentes': [
        'Investigaciones cerradas',
        'Accidentalidad del periodo',
        'Planes de acción'
      ],
      'acciones': [
        'Cumplimiento de compromisos previos'
      ],
      'cambios': [
        'Cambios normativos',
        'Cambios organizacionales',
        'Cambios tecnológicos'
      ],
      'supervision': [
        'Inspecciones planeadas',
        'Inspecciones ejecutadas'
      ],
      'evaluacion': [
        'Evaluación inicial del año',
        'Plan de mejora'
      ],
      'preventivas': [
        'Acciones preventivas ejecutadas',
        'Acciones correctivas cerradas'
      ],
      'conclusiones': [
        'Conclusiones generales'
      ]
    };
    return m[key] || [];
  }

  function _esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatDate(d) {
    if (!d) return '';
    var months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var parts = String(d).split('-');
    if (parts.length === 3) return parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    return String(d);
  }

  /**
   * Recopila los datos del formulario del editor.
   * Lee primero del DOM (si la sección está activa), luego completa con
   * editorState.formData (capturado en tiempo real por delegación de eventos).
   * Esto garantiza que los datos persistan aunque el usuario navegue a
   * otra sección antes de guardar.
   * @param {HTMLElement} wrap - contenedor del editor
   * @param {Object} revision - revisión original (para campos no editados)
   * @returns {Object} data listo para enviar al backend
   */
  function _collectFormData(wrap, revision) {
    var data = {
      id: revision.id,
      periodo: revision.periodo,
      fecha: revision.fecha,
      fechaProgramada: revision.fechaProgramada,
      preside: revision.preside,
      elabora: revision.elabora,
      empresa: revision.empresa,
      participantes: revision.participantes || 0,
      estado: revision.estado || 'Borrador',
      progreso: revision.progreso || 0,
      secciones: {}
    };

    var captured = {};
    if (wrap) {
      wrap.querySelectorAll('[data-field]').forEach(function(inp) {
        var key = inp.getAttribute('data-field');
        if (!key) return;
        var val = inp.value;
        if (inp.type === 'number') val = Number(val) || 0;
        else if (inp.type === 'date') val = val || revision[key] || '';
        data[key] = val;
        captured[key] = true;
      });
    }

    /* Completar con datos capturados en tiempo real (form ya no visible) */
    var stored = (wrap && wrap._editorState && wrap._editorState.formData) || {};
    Object.keys(stored).forEach(function(k) {
      if (!captured[k]) data[k] = stored[k];
    });

    /* Calcular progreso y secciones completadas desde editorState */
    if (wrap && wrap._editorState) {
      data.secciones = wrap._editorState.secciones || {};
      data.completedSections = Object.keys(wrap._editorState.completed || {}).filter(function(k) {
        return wrap._editorState.completed[k];
      });
      /* 12 secciones canónicas del G-FO-006 */
      data.progreso = Math.round((data.completedSections.length / 12) * 100);
    }

    return data;
  }

  /* Vista principal del editor */
  function render(ctx) {
    var id = ctx.params && ctx.params.id;
    var revision = null;

    if (id) {
      revision = (ctx.data.revisiones || []).filter(function(r) { return r.id === id; })[0];
    }
    if (!revision) {
      /* Si no hay id o no se encuentra, usar el ciclo activo o crear nueva */
      revision = ctx.data.cicloActivo || {
        id: 'RG-' + new Date().getFullYear() + '-01',
        periodo: String(new Date().getFullYear()),
        fecha: new Date().toISOString().split('T')[0],
        estado: 'Borrador',
        preside: '',
        elabora: '',
        empresa: ctx.data.empresaActiva || 'EMPRESA ACTIVA',
        participantes: 0,
        progreso: 0
      };
    }

    /* Estado local del editor */
    var editorState = ctx.state.editor || {
      activeKey: 'generalidades',
      secciones: {}, // { key: { contenido: '', subpuntos: [{label, estado, observacion}] } }
      completed: {}, // { key: true }
      formData: {}   // valores del form de Generalidades (preservados entre navegaciones)
    };

    /* Si la revisión es nueva (no hay estado guardado), inicializar */
    if (!ctx.state.editor || !ctx.state.editor._revisionId || ctx.state.editor._revisionId !== revision.id) {
      editorState = {
        _revisionId: revision.id,
        activeKey: 'generalidades',
        secciones: {},
        completed: {},
        formData: {}
      };
      ctx.state.editor = editorState;

      /* Cargar datos desde el JSON importado (revision.secciones[]) al editorState.
         El parser del bridge devuelve secciones por NUMERO (1-12) según el orden de la
         plantilla G-FO-006 del Ministerio. El editor las referencia por KEY (lectura,
         componentes, etc.) con un ORDEN distinto. Mapeamos numero → key del editor. */
      var NUM_TO_KEY = {
        1: 'lectura',
        2: 'componentes',
        3: 'auditorias',
        4: 'requisitos',
        5: 'participacion',
        6: 'incidentes',
        7: 'acciones',
        8: 'cambios',
        9: 'supervision',
        10: 'evaluacion',
        11: 'preventivas',
        12: 'conclusiones'
      };
      (revision.secciones || []).forEach(function(sec) {
        var key = NUM_TO_KEY[sec.numero];
        if (!key) return;
        editorState.secciones[key] = {
          contenido: sec.contenido || '',
          subpuntos: {} // el editor usa subpuntos por key-sub-N; el parser trae subTemas pero
                        // no se mapean 1:1 a subpuntos del editor — quedan vacíos para edición
        };
      });

      /* Cargar datos de cabecera (formData) desde la revisión */
      if (revision.preside) editorState.formData.preside = revision.preside;
      if (revision.elabora) editorState.formData.elabora = revision.elabora;
      if (revision.lugar) editorState.formData.lugar = revision.lugar;
      if (revision.fecha) editorState.formData.fecha = revision.fecha;
      if (revision.fechaProgramada) editorState.formData.fecha = revision.fechaProgramada;
    }

    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-revision-editor';

    /* Editor grid: main + sidebar */
    var grid = document.createElement('div');
    grid.className = 'kair-rad-editor';

    var main = document.createElement('div');
    main.className = 'kair-rad-editor__main';

    var sidebar = document.createElement('div');
    sidebar.className = 'kair-rad-editor__sidebar';

    /* Header del editor (título de la revisión) */
    var titleRow = document.createElement('div');
    titleRow.style.margin = 'var(--rad-s4) var(--rad-s6) 0 var(--rad-s6)';
    titleRow.innerHTML =
      '<div class="kair-rad-inline-counter">' +
        '<span class="kair-rad-badge kair-rad-badge--info"><span class="dot"></span>Editor · ' + _esc(revision.id) + '</span>' +
        '<span>·</span>' +
        '<span>Período ' + _esc(revision.periodo) + '</span>' +
      '</div>' +
      '<h1 style="margin: var(--rad-s2) 0 0 0; font: var(--rad-title-xl); color: var(--rad-text-strong)">Revisión Gerencial ' + _esc(revision.id) + '</h1>';
    /* IMPORTANTE: titleRow va FUERA del grid para no romper el layout de 2 columnas.
       Si se agrega dentro del grid, ocupa la col 1 (1fr) y empuja main a col 2 (280px). */
    /* Se anexará a wrap más abajo, justo antes que grid */

    /* Tabs del editor (12 secciones + generalidades) */
    var tabs = document.createElement('div');
    tabs.className = 'kair-rad-editor-tabs';
    tabs.id = 'kair-rad-editor-tabs';

    SECCIONES.forEach(function(s) {
      var btn = document.createElement('button');
      btn.className = 'kair-rad-editor-tab' +
        (editorState.activeKey === s.key ? ' is-active' : '') +
        (editorState.completed[s.key] ? ' is-complete' : '');
      btn.setAttribute('data-tab', s.key);
      btn.innerHTML =
        '<span class="kair-rad-editor-tab__num">' + (s.num || '·') + '</span>' +
        '<span>' + _esc(s.title) + '</span>';
      btn.addEventListener('click', function() {
        editorState.activeKey = s.key;
        ctx.state.editor = editorState;
        ctx.refresh();
      });
      tabs.appendChild(btn);
    });
    main.appendChild(tabs);

    /* Progress strip */
    var totalSecciones = SECCIONES.length;
    var completedCount = Object.keys(editorState.completed).filter(function(k) { return editorState.completed[k]; }).length;
    var inProgress = editorState.activeKey ? 1 : 0;
    var pendingCount = totalSecciones - completedCount - inProgress;
    var progPct = Math.round((completedCount / totalSecciones) * 100);

    var progress = document.createElement('div');
    progress.className = 'kair-rad-editor-progress';
    progress.innerHTML =
      '<div>' +
        '<div class="kair-rad-editor-progress__title">Avance del acta G-FO-006</div>' +
        '<div class="kair-rad-editor-progress__pct">' + progPct + '% completado</div>' +
      '</div>' +
      '<div class="kair-rad-editor-progress__counts">' +
        '<span class="kair-rad-editor-progress__count">' +
          '<strong>' + completedCount + '</strong> completadas' +
        '</span>' +
        '<span class="kair-rad-editor-progress__count">' +
          '<strong style="color:#b08500">' + inProgress + '</strong> en progreso' +
        '</span>' +
        '<span class="kair-rad-editor-progress__count">' +
          '<strong style="color:var(--rad-text-muted)">' + pendingCount + '</strong> pendientes' +
        '</span>' +
      '</div>' +
      '<div class="kair-rad-editor-progress__bar" style="flex: 0 0 100%; margin-left: 0">' +
        '<div class="kair-rad-editor-progress__fill" style="width:' + progPct + '%"></div>' +
      '</div>';
    main.appendChild(progress);

    /* Render del contenido de la sección activa */
    var seccionActiva = SECCIONES.filter(function(s) { return s.key === editorState.activeKey; })[0] || SECCIONES[0];
    main.appendChild(_renderSeccionCard(seccionActiva, revision, editorState, ctx));

    grid.appendChild(main);

    /* Sidebar: navegación rápida */
    var navCard = document.createElement('div');
    navCard.className = 'kair-rad-side-card';
    navCard.innerHTML = '<h3 class="kair-rad-side-card__title">Secciones del acta</h3>';
    var navList = document.createElement('div');
    navList.className = 'kair-rad-side-nav';
    SECCIONES.forEach(function(s) {
      var item = document.createElement('button');
      item.className = 'kair-rad-side-nav__item' +
        (editorState.activeKey === s.key ? ' is-active' : '') +
        (editorState.completed[s.key] ? ' is-complete' : '');
      item.setAttribute('data-nav', s.key);
      item.innerHTML =
        '<span class="kair-rad-side-nav__num">' + (s.num || '·') + '</span>' +
        '<span class="kair-rad-side-nav__label">' + _esc(s.title) + '</span>';
      item.addEventListener('click', function() {
        editorState.activeKey = s.key;
        ctx.state.editor = editorState;
        ctx.refresh();
      });
      navList.appendChild(item);
    });
    navCard.appendChild(navList);
    sidebar.appendChild(navCard);

    /* Sidebar: actividad reciente */
    var actCard = document.createElement('div');
    actCard.className = 'kair-rad-side-card';
    actCard.innerHTML = '<h3 class="kair-rad-side-card__title">Actividad reciente</h3>';
    var now = new Date();
    var stamp = now.toLocaleDateString('es-CO') + ', ' + now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    actCard.innerHTML +=
      '<div class="kair-rad-activity-item">' +
        '<div class="kair-rad-activity-item__dot"></div>' +
        '<div class="kair-rad-activity-item__body">' +
          '<p class="kair-rad-activity-item__title">Borrador de revisión creado</p>' +
          '<p class="kair-rad-activity-item__meta">' + stamp + ' · ' + _esc(revision.elabora || 'Javier Robles Fontalvo') + '</p>' +
        '</div>' +
      '</div>';
    sidebar.appendChild(actCard);

    /* Sidebar: participantes */
    var partCard = document.createElement('div');
    partCard.className = 'kair-rad-side-card';
    partCard.innerHTML = '<h3 class="kair-rad-side-card__title">Participantes</h3>';
    if ((revision.participantes || 0) === 0) {
      partCard.innerHTML += '<p style="font:var(--rad-caption); color:var(--rad-text-muted); margin:0">No hay participantes registrados.</p>';
    } else {
      var part = partCard;
      ['Sergina Orozco Hincapié', 'Javier Robles Fontalvo', 'Bernardo Ortiz Galindo'].slice(0, revision.participantes || 2).forEach(function(name) {
        var initials = name.split(' ').map(function(w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
        var row = document.createElement('div');
        row.className = 'kair-rad-participant-row';
        row.innerHTML =
          '<div class="kair-rad-participant-row__avatar">' + _esc(initials) + '</div>' +
          '<div class="kair-rad-participant-row__body">' +
            '<p class="kair-rad-participant-row__name">' + _esc(name) + '</p>' +
            '<p class="kair-rad-participant-row__role">Empresa</p>' +
          '</div>';
        part.appendChild(row);
      });
    }
    sidebar.appendChild(partCard);

    grid.appendChild(sidebar);
    wrap.appendChild(titleRow);
    wrap.appendChild(grid);

    /* Sticky footer */
    var footer = document.createElement('div');
    footer.className = 'kair-rad-sticky-footer';
    var idx = SECCIONES.findIndex(function(s) { return s.key === editorState.activeKey; });
    var prevKey = idx > 0 ? SECCIONES[idx - 1].key : null;
    var nextKey = idx < SECCIONES.length - 1 ? SECCIONES[idx + 1].key : null;

    footer.innerHTML =
      '<div class="kair-rad-sticky-footer__hint">' +
        'Completa el contenido y sub-puntos antes de marcar como completada.' +
      '</div>' +
      '<div class="kair-rad-sticky-footer__actions">' +
        '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-footer="cancel"><i class="bi bi-x-lg"></i> Cancelar</button>' +
        '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-footer="save"><i class="bi bi-file-earmark"></i> Guardar borrador</button>' +
        '<button class="kair-rad-header__action kair-rad-header__action--primary" data-footer="finalize"><i class="bi bi-check-circle"></i> Finalizar y ver acta</button>' +
      '</div>';
    wrap.appendChild(footer);

    /* Exponer el editorState en el wrap para que _collectFormData pueda leerlo
       desde los handlers de Guardar/Finalizar (que se bindean con setTimeout). */
    wrap._editorState = editorState;
    wrap._revision = revision;

    /* Capturar cambios del form en tiempo real (delegación).
       Cuando el usuario está en Generalidades y digita un campo, lo guardamos
       en editorState.formData. Así, si navega a otra sección y luego hace click
       en "Guardar borrador", los datos siguen disponibles aunque el form ya
       no esté en el DOM. */
    if (!editorState.formData) editorState.formData = {};
    wrap.addEventListener('input', function(e) {
      var inp = e.target;
      if (!inp || !inp.matches || !inp.matches('[data-field]')) return;
      var key = inp.getAttribute('data-field');
      if (!key) return;
      editorState.formData[key] = inp.value;
    });

    /* Bind footer buttons */
    setTimeout(function() {
      var btnCancel = wrap.querySelector('[data-footer="cancel"]');
      var btnSave = wrap.querySelector('[data-footer="save"]');
      var btnFinalize = wrap.querySelector('[data-footer="finalize"]');

      if (btnCancel) {
        btnCancel.addEventListener('click', function() {
          if (typeof ctx.navigate === 'function') ctx.navigate('revisiones-list');
        });
      }
      if (btnSave) {
        btnSave.addEventListener('click', async function() {
          /* Guard contra doble-click · deshabilitar mientras se procesa */
          if (btnSave.disabled) return;
          btnSave.disabled = true;
          try {
            var formData = _collectFormData(wrap, revision);
            var exists = (ctx.data.revisiones || []).some(function(r) { return r.id === revision.id; });
            if (typeof ctx.guardarRevision !== 'function') {
              if (typeof ctx.toast === 'function') {
                ctx.toast('Función no disponible', 'No se puede guardar en este momento', 'error');
              }
              return;
            }
            var result = await ctx.guardarRevision(formData, !exists);
            if (result && result.success && result.revision && !exists) {
              ctx.state.editor = null;
              ctx.refresh();
              setTimeout(function() {
                if (typeof ctx.navigate === 'function') ctx.navigate('revisiones-list');
              }, 600);
            }
          } catch (e) {
            if (typeof ctx.toast === 'function') {
              ctx.toast('Error al guardar', e && e.message ? e.message : 'Intente de nuevo', 'error');
            }
          } finally {
            btnSave.disabled = false;
          }
        });
      }
      if (btnFinalize) {
        btnFinalize.addEventListener('click', async function() {
          if (btnFinalize.disabled) return;
          btnFinalize.disabled = true;
          try {
            SECCIONES.forEach(function(s) { editorState.completed[s.key] = true; });
            ctx.state.editor = editorState;
            var formData = _collectFormData(wrap, revision);
            formData.estado = 'Finalizada';
            formData.progreso = 100;
            var exists = (ctx.data.revisiones || []).some(function(r) { return r.id === revision.id; });
            if (typeof ctx.guardarRevision !== 'function') {
              if (typeof ctx.toast === 'function') {
                ctx.toast('Función no disponible', 'No se puede finalizar en este momento', 'error');
              }
              return;
            }
            var result = await ctx.guardarRevision(formData, !exists);
            if (result && result.success) {
              if (typeof ctx.toast === 'function') {
                ctx.toast('Revisión finalizada', 'Generando acta G-FO-006', 'success');
              }
              if (typeof ctx.navigate === 'function') {
                ctx.navigate('revisiones-viewer', { id: result.revision.id });
              }
            }
          } catch (e) {
            if (typeof ctx.toast === 'function') {
              ctx.toast('Error al finalizar', e && e.message ? e.message : 'Intente de nuevo', 'error');
            }
          } finally {
            btnFinalize.disabled = false;
          }
        });
      }
    }, 0);

    return wrap;
  }

  /* Render de la tarjeta de la sección activa */
  function _renderSeccionCard(seccion, revision, editorState, ctx) {
    var card = document.createElement('div');
    card.className = 'kair-rad-section-card';

    if (seccion.isMeta) {
      /* Helper: preferir valor capturado en formData (cambios sin guardar)
         sobre el de revision, para preservar ediciones entre navegaciones.
         Defensivo: si formData no existe, devuelve el fallback. */
      function _formValue(key, fallback) {
        return (editorState.formData && editorState.formData[key]) || fallback;
      }

      /* Generalidades · Form de encabezado */
      var head = document.createElement('div');
      head.className = 'kair-rad-section-card__head';
      head.innerHTML =
        '<div class="kair-rad-section-card__num"><i class="bi bi-card-text" style="font-size:1rem"></i></div>' +
        '<div class="kair-rad-section-card__title-wrap">' +
          '<h2 class="kair-rad-section-card__title">Acta de Revisión Gerencial</h2>' +
          '<p class="kair-rad-section-card__hint">' + _esc(seccion.desc) + '</p>' +
        '</div>' +
        '<span class="kair-rad-section-card__status kair-rad-section-card__status--pending">' +
          '<span class="dot"></span>Pendiente' +
        '</span>';
      card.appendChild(head);

      var formRow1 = document.createElement('div');
      formRow1.className = 'kair-rad-form-row';
      formRow1.innerHTML =
        _field('consecutivo', 'Consecutivo', _formValue('consecutivo', revision.id), 'text', true) +
        _field('periodo', 'Período', _formValue('periodo', revision.periodo), 'text', true) +
        _field('fechaProgramada', 'Fecha Programada', _formValue('fechaProgramada', revision.fechaProgramada || revision.fecha || ''), 'date', true);
      card.appendChild(formRow1);

      var formRow2 = document.createElement('div');
      formRow2.className = 'kair-rad-form-row';
      formRow2.innerHTML =
        _field('fechaRealizada', 'Fecha Realizada', _formValue('fechaRealizada', ''), 'date', false) +
        _field('lugar', 'Lugar', _formValue('lugar', revision.lugar || ''), 'text', false) +
        _field('empresa', 'Empresa', _formValue('empresa', revision.empresa || ctx.data.empresaActiva || 'EMPRESA ACTIVA'), 'text', true);
      card.appendChild(formRow2);

      var formRow3 = document.createElement('div');
      formRow3.className = 'kair-rad-form-row';
      formRow3.innerHTML =
        _field('preside', 'Preside', _formValue('preside', revision.preside || ''), 'text', true) +
        _field('elabora', 'Elabora', _formValue('elabora', revision.elabora || ''), 'text', true);
      card.appendChild(formRow3);

      /* Participantes · input editable (no solo counter display) */
      var partRow = document.createElement('div');
      partRow.className = 'kair-rad-form-row';
      partRow.innerHTML =
        '<div class="kair-rad-field" style="flex:1">' +
          '<label><i class="bi bi-people"></i> Participantes registrados (por la empresa e invitados)</label>' +
          '<input type="number" min="0" step="1" value="' + (_formValue('participantes', revision.participantes || 0)) + '" data-field="participantes" id="kair-rad-edit-participantes" style="max-width:200px">' +
        '</div>';
      card.appendChild(partRow);

      /* Poblar formData con los valores actuales del form (recién renderizado)
         Esto garantiza que siempre haya un valor en formData para todos los
         campos, incluso si el usuario no los ha editado todavía. */
      if (!editorState.formData) editorState.formData = {};
      card.querySelectorAll('[data-field]').forEach(function(inp) {
        var key = inp.getAttribute('data-field');
        if (key && editorState.formData[key] === undefined) {
          editorState.formData[key] = inp.value;
        }
      });

      /* Footer de navegación · Generalidades solo tiene "Siguiente"
         (es la primera sección, no hay anterior) */
      var idx = SECCIONES.findIndex(function(s) { return s.key === seccion.key; });
      var nextS = idx < SECCIONES.length - 1 ? SECCIONES[idx + 1] : null;
      var isComplete = !!editorState.completed[seccion.key];

      var footer = document.createElement('div');
      footer.className = 'kair-rad-section-footer';
      footer.innerHTML =
        '<span class="kair-rad-section-footer__hint">' +
          (isComplete
            ? 'Generalidades completas. Puedes continuar con la siguiente sección.'
            : 'Completa los datos del encabezado antes de continuar.') +
        '</span>' +
        '<div style="display:flex; gap:var(--rad-s2)">' +
          '<button class="kair-rad-header__action kair-rad-header__action--success" data-section-action="complete">' +
            '<i class="bi bi-check-circle"></i> ' + (isComplete ? 'Completada' : 'Marcar completada') +
          '</button>' +
          (nextS
            ? '<button class="kair-rad-header__action kair-rad-header__action--primary" data-section-action="next">' +
                'Ir a ' + _esc(nextS.title) + ' <i class="bi bi-chevron-right"></i>' +
              '</button>'
            : '') +
        '</div>';
      card.appendChild(footer);

      /* Bind footer buttons */
      setTimeout(function() {
        var btnNext = card.querySelector('[data-section-action="next"]');
        var btnComplete = card.querySelector('[data-section-action="complete"]');

        if (btnNext) {
          btnNext.addEventListener('click', function() {
            editorState.activeKey = nextS.key;
            ctx.state.editor = editorState;
            ctx.refresh();
            if (typeof ctx.toast === 'function') {
              ctx.toast('Sección iniciada', nextS.title, 'info');
            }
          });
        }
        if (btnComplete) {
          btnComplete.addEventListener('click', function() {
            editorState.completed[seccion.key] = !editorState.completed[seccion.key];
            if (editorState.completed[seccion.key] && nextS) {
              editorState.activeKey = nextS.key;
            }
            ctx.state.editor = editorState;
            ctx.refresh();
            if (typeof ctx.toast === 'function' && editorState.completed[seccion.key]) {
              ctx.toast('Generalidades completas', 'Continúa con la siguiente sección', 'success');
            }
          });
        }
      }, 0);

      return card;
    }

    /* Sección normal · Contenido + sub-puntos */
    var head = document.createElement('div');
    head.className = 'kair-rad-section-card__head';
    head.innerHTML =
      '<div class="kair-rad-section-card__num">' + (seccion.num || '') + '</div>' +
      '<div class="kair-rad-section-card__title-wrap">' +
        '<h2 class="kair-rad-section-card__title">' + (seccion.num ? seccion.num + '. ' : '') + _esc(seccion.title) + '</h2>' +
        '<p class="kair-rad-section-card__hint">' + _esc(seccion.desc) + '</p>' +
      '</div>' +
      '<span class="kair-rad-section-card__status ' +
        (editorState.completed[seccion.key] ? 'kair-rad-section-card__status--success' : 'kair-rad-section-card__status--pending') +
      '">' +
        '<span class="dot"></span>' + (editorState.completed[seccion.key] ? 'Completada' : 'Pendiente') +
      '</span>';
    card.appendChild(head);

    /* Contenido (textarea principal) */
    var contenidoGroup = document.createElement('div');
    contenidoGroup.style.marginTop = 'var(--rad-s4)';
    /* Leer el contenido desde editorState.secciones[key].contenido (poblado por el parser del XLSX).
       Fallback a revision.secciones[] directo si editorState aún no fue inicializado. */
    var contenidoInicial = '';
    if (editorState.secciones[seccion.key] && editorState.secciones[seccion.key].contenido) {
      contenidoInicial = editorState.secciones[seccion.key].contenido;
    } else if (revision.secciones && Array.isArray(revision.secciones)) {
      /* Mapear key → numero (1-12) según SECCIONES del editor para buscar en revision.secciones[] */
      var KEY_TO_NUM = {
        lectura: 1, componentes: 2, auditorias: 3, requisitos: 4,
        participacion: 5, incidentes: 6, acciones: 7, cambios: 8,
        supervision: 9, evaluacion: 10, preventivas: 11, conclusiones: 12
      };
      var num = KEY_TO_NUM[seccion.key];
      if (num) {
        var sec = revision.secciones.find(function(s) { return s.numero === num; });
        if (sec && sec.contenido) contenidoInicial = sec.contenido;
      }
    }
    contenidoGroup.innerHTML =
      '<div class="kair-rad-field">' +
        '<label>Contenido de la sección</label>' +
        '<textarea placeholder="Describe los hallazgos, análisis y conclusiones de la sección &quot;' + _esc(seccion.title) + '&quot;…" rows="4">' + _esc(contenidoInicial) + '</textarea>' +
        '<span class="kair-rad-field-note">Este texto se exportará al campo correspondiente del formato G-FO-006.</span>' +
      '</div>';
    card.appendChild(contenidoGroup);

    /* Sub-puntos a verificar */
    var subs = _subPuntosForSeccion(seccion.key);
    if (subs.length > 0) {
      var subWrap = document.createElement('div');
      subWrap.className = 'kair-rad-subpoints';
      subWrap.innerHTML = '<h4 class="kair-rad-subpoints__title">Sub-puntos a verificar</h4>';

      subs.forEach(function(sp, i) {
        var subKey = seccion.key + '-sub-' + i;
        var subState = (editorState.secciones[seccion.key] &&
                        editorState.secciones[seccion.key].subpuntos &&
                        editorState.secciones[seccion.key].subpuntos[subKey]) || { estado: 'Pendiente', observacion: '' };

        var subItem = document.createElement('div');
        subItem.className = 'kair-rad-subpoint';
        subItem.innerHTML =
          '<div class="kair-rad-subpoint__head">' +
            '<span class="kair-rad-subpoint__label">' + _esc(sp) + '</span>' +
            '<div class="kair-rad-subpoint__states" data-sub="' + _esc(subKey) + '" data-section="' + _esc(seccion.key) + '">' +
              _stateBtn('Cumple',     'success', subState.estado) +
              _stateBtn('Parcial',    'warning', subState.estado) +
              _stateBtn('No cumple',  'danger',  subState.estado) +
              _stateBtn('Pendiente',  '',        subState.estado) +
            '</div>' +
          '</div>' +
          '<textarea placeholder="Observaciones específicas de este sub-punto…" rows="2">' + _esc(subState.observacion || '') + '</textarea>';
        subWrap.appendChild(subItem);
      });

      card.appendChild(subWrap);

      /* Bind sub-point state buttons */
      setTimeout(function() {
        card.querySelectorAll('[data-sub]').forEach(function(group) {
          var subKey = group.getAttribute('data-sub');
          var sectionKey = group.getAttribute('data-section');
          group.querySelectorAll('.kair-rad-state-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
              if (!editorState.secciones[sectionKey]) {
                editorState.secciones[sectionKey] = { contenido: '', subpuntos: {} };
              }
              if (!editorState.secciones[sectionKey].subpuntos) {
                editorState.secciones[sectionKey].subpuntos = {};
              }
              editorState.secciones[sectionKey].subpuntos[subKey] = {
                estado: btn.getAttribute('data-state'),
                observacion: ''
              };
              ctx.state.editor = editorState;
              /* Update visual sin re-render completo */
              group.querySelectorAll('.kair-rad-state-btn').forEach(function(b) {
                b.classList.remove('is-active');
              });
              btn.classList.add('is-active');
            });
          });
        });
      }, 0);
    }

    /* Footer de sección: marcar completada + navegación */
    var footer = document.createElement('div');
    footer.className = 'kair-rad-section-footer';
    var idx = SECCIONES.findIndex(function(s) { return s.key === seccion.key; });
    var prevS = idx > 0 ? SECCIONES[idx - 1] : null;
    var nextS = idx < SECCIONES.length - 1 ? SECCIONES[idx + 1] : null;

    var navBtns = '';
    if (prevS) {
      navBtns += '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-section-nav="prev"><i class="bi bi-chevron-left"></i> ' + _esc(prevS.title) + '</button>';
    } else {
      navBtns += '<span></span>';
    }
    if (nextS) {
      navBtns += '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-section-nav="next">' + _esc(nextS.title) + ' <i class="bi bi-chevron-right"></i></button>';
    }
    footer.innerHTML =
      '<span class="kair-rad-section-footer__hint">Completa el contenido y sub-puntos antes de marcar como completada</span>' +
      '<div style="display:flex; gap:var(--rad-s2)">' +
        '<button class="kair-rad-header__action kair-rad-header__action--success" data-section-action="complete">' +
          '<i class="bi bi-check-circle"></i> ' + (editorState.completed[seccion.key] ? 'Completada' : 'Marcar completada') +
        '</button>' +
        navBtns +
      '</div>';
    card.appendChild(footer);

    /* Bind section footer buttons */
    setTimeout(function() {
      var btnPrev = card.querySelector('[data-section-nav="prev"]');
      var btnNext = card.querySelector('[data-section-nav="next"]');
      var btnComplete = card.querySelector('[data-section-action="complete"]');

      if (btnPrev) {
        btnPrev.addEventListener('click', function() {
          editorState.activeKey = prevS.key;
          ctx.state.editor = editorState;
          ctx.refresh();
        });
      }
      if (btnNext) {
        btnNext.addEventListener('click', function() {
          editorState.activeKey = nextS.key;
          ctx.state.editor = editorState;
          ctx.refresh();
        });
      }
      if (btnComplete) {
        btnComplete.addEventListener('click', function() {
          editorState.completed[seccion.key] = !editorState.completed[seccion.key];
          if (editorState.completed[seccion.key] && nextS) {
            editorState.activeKey = nextS.key;
          }
          ctx.state.editor = editorState;
          ctx.refresh();
          if (typeof ctx.toast === 'function') {
            if (editorState.completed[seccion.key]) {
              ctx.toast('Sección completada', seccion.title, 'success');
            }
          }
        });
      }
    }, 0);

    return card;
  }

  /* Helpers de form */
  function _field(name, label, value, type, required) {
    var req = required ? ' <span style="color:var(--rad-danger)">*</span>' : '';
    return '<div class="kair-rad-field">' +
      '<label>' + _esc(label) + req + '</label>' +
      '<input type="' + (type || 'text') + '" value="' + _esc(value || '') + '" data-field="' + _esc(name) + '" id="kair-rad-edit-' + _esc(name) + '"' + (required ? ' required' : '') + '>' +
    '</div>';
  }

  function _stateBtn(label, variant, current) {
    var cls = 'kair-rad-state-btn' + (variant ? ' kair-rad-state-btn--' + variant : '');
    var isActive = label === current;
    return '<button class="' + cls + (isActive ? ' is-active' : '') + '" data-state="' + _esc(label) + '">' + _esc(label) + '</button>';
  }

  return {
    render: render,
    SECCIONES: SECCIONES,
    _subPuntosForSeccion: _subPuntosForSeccion
  };
})();

window.RevisionEditorView = RevisionEditorView;
