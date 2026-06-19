/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: ACTAS EDITOR (G-FO-009)
 * Editor de actas de reunión gerencial conforme al formato G-FO-009.
 * Patrón: sidebar con secciones + main content + sticky footer.
 * Modelo semestral: 2 actas por año (1 Principal + 1 Seguimiento).
 * =====================================================================
 */

var ActasEditorView = (function() {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════
     CONSTANTES
     ═══════════════════════════════════════════════════════════════════════ */

  var SECCIONES = [
    { key: 'generalidades',  num: 0, title: 'Generalidades',  desc: 'Datos de cabecera del acta' },
    { key: 'participantes',  num: 1, title: 'Participantes',  desc: 'Asistentes a la reunión' },
    { key: 'ordenDelDia',    num: 2, title: 'Orden del día',  desc: 'Agenda de la reunión' },
    { key: 'desarrollo',     num: 3, title: 'Desarrollo y compromisos', desc: 'Temas tratados y acciones' }
  ];

  var TIPO_ACTA = [
    { value: 'Principal',    label: 'Principal (revisión del periodo anterior)' },
    { value: 'Seguimiento',  label: 'Seguimiento (primer seguimiento del año)' }
  ];

  var ESTADOS_COMPROMISO = ['Pendiente', 'En proceso', 'Cumplido', 'Vencido'];

  /* ═══════════════════════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════════════════════ */

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

  function _field(name, label, value, type, required) {
    var req = required ? ' <span style="color:var(--rad-danger)">*</span>' : '';
    return '<div class="kair-rad-field">' +
      '<label>' + _esc(label) + req + '</label>' +
      '<input type="' + (type || 'text') + '" value="' + _esc(value || '') + '" data-field="' + _esc(name) + '" id="kair-rad-acta-edit-' + _esc(name) + '"' + (required ? ' required' : '') + '>' +
    '</div>';
  }

  function _textarea(name, label, value, placeholder, required) {
    var req = required ? ' <span style="color:var(--rad-danger)">*</span>' : '';
    return '<div class="kair-rad-field">' +
      '<label>' + _esc(label) + req + '</label>' +
      '<textarea data-field="' + _esc(name) + '" id="kair-rad-acta-edit-' + _esc(name) + '" placeholder="' + _esc(placeholder || '') + '" rows="4">' + _esc(value || '') + '</textarea>' +
    '</div>';
  }

  function _select(name, label, value, options, required) {
    var req = required ? ' <span style="color:var(--rad-danger)">*</span>' : '';
    var optsHtml = options.map(function(o) {
      var selected = (String(o.value) === String(value)) ? ' selected' : '';
      return '<option value="' + _esc(o.value) + '"' + selected + '>' + _esc(o.label) + '</option>';
    }).join('');
    return '<div class="kair-rad-field">' +
      '<label>' + _esc(label) + req + '</label>' +
      '<select data-field="' + _esc(name) + '" id="kair-rad-acta-edit-' + _esc(name) + '"' + (required ? ' required' : '') + '>' +
        optsHtml +
      '</select>' +
    '</div>';
  }

  function _calcularIdEsperado(tipo, año) {
    if (tipo === 'Seguimiento') return 'ACT-' + año + '-S2-SEG';
    return 'ACT-' + año + '-S1';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TRANSFORMACIONES DE DATOS
     ═══════════════════════════════════════════════════════════════════════ */

  function _initEditorState(acta) {
    var idInicial = acta.id || _calcularIdEsperado(acta.tipo || 'Principal', acta.año || new Date().getFullYear());
    return {
      _actaId: idInicial,
      activeKey: 'generalidades',
      completed: {},
      formData: {
        tipo: acta.tipo || 'Principal',
        año: acta.año || new Date().getFullYear(),
        semestre: acta.semestre || 1,
        revisionId: acta.revisionId || '',
        fecha: acta.fecha || new Date().toISOString().split('T')[0],
        tema: acta.metadata.tema || '',
        preside: acta.metadata.preside || '',
        ciudad: acta.metadata.ciudad || '',
        horaInicio: acta.metadata.horaInicio || '',
        horaFin: acta.metadata.horaFin || '',
        ordenDia: acta.metadata.ordenDia || '',
        estado: acta.estado || 'Abierta'
      },
      participantes: (acta.metadata.participantes || []).slice(),
      desarrollo: (acta.metadata.desarrollo || []).slice()
    };
  }

  function _nuevaActa(ctx) {
    var hoy = new Date();
    var año = hoy.getFullYear();
    var semestre = (hoy.getMonth() + 1) <= 6 ? 1 : 2;
    return {
      id: null,
      numero: null,
      fecha: hoy.toISOString().split('T')[0],
      estado: 'Abierta',
      archivo: '',
      tipo: 'Principal',
      año: año,
      semestre: semestre,
      revisionId: '',
      metadata: {
        tema: '',
        preside: '',
        ciudad: '',
        horaInicio: '',
        horaFin: '',
        participantes: [],
        ordenDia: '',
        desarrollo: []
      }
    };
  }

  function _dbActaToEditorShape(dbActa) {
    var meta = dbActa.metadata || {};
    var fecha = dbActa.fecha || '';
    var año = meta.año || (fecha ? parseInt(fecha.substring(0, 4), 10) : new Date().getFullYear());
    var semestre = meta.semestre || (fecha ? (parseInt(fecha.substring(5, 7), 10) <= 6 ? 1 : 2) : 1);

    return {
      id: dbActa.id,
      numero: dbActa.numero,
      fecha: fecha,
      estado: dbActa.estado || 'Abierta',
      archivo: dbActa.archivo || '',
      tipo: meta.tipo || 'Principal',
      año: año,
      semestre: semestre,
      revisionId: meta.revisionId || '',
      metadata: {
        tema: meta.tema || '',
        preside: meta.preside || '',
        ciudad: meta.ciudad || '',
        horaInicio: meta.horaInicio || '',
        horaFin: meta.horaFin || '',
        participantes: Array.isArray(meta.participantes) ? meta.participantes.slice() : [],
        ordenDia: meta.ordenDia || '',
        desarrollo: Array.isArray(meta.desarrollo) ? meta.desarrollo.slice() : []
      }
    };
  }

  function _revisionesDelAñoAnterior(ctx, año) {
    var revisiones = (ctx.data.revisiones || []);
    return revisiones
      .filter(function(r) {
        var rAño = parseInt(String(r.periodo || r.id || '').match(/\d{4}/)?.[0] || '0', 10);
        return rAño === (año - 1);
      })
      .map(function(r) { return { id: r.id, periodo: r.periodo || '' }; });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RECOLECCIÓN DE DATOS + VALIDACIÓN
     ═══════════════════════════════════════════════════════════════════════ */

  function _collectFormData(wrap, editorState, acta, esNuevo, cerrar) {
    if (wrap) {
      wrap.querySelectorAll('[data-field]').forEach(function(inp) {
        var key = inp.getAttribute('data-field');
        if (!key || inp.disabled) return;
        editorState.formData[key] = inp.value;
      });
    }

    var fd = editorState.formData;
    var tipo = fd.tipo || 'Principal';
    var año = parseInt(fd.año, 10) || new Date().getFullYear();
    var semestre = parseInt(fd.semestre, 10) || 1;
    var idCalculado = acta.id || _calcularIdEsperado(tipo, año);

    return {
      id: acta.id || idCalculado,
      empresaId: acta.empresaId || null,
      numero: acta.numero || (tipo === 'Seguimiento' ? 2 : 1),
      fecha: fd.fecha || '',
      estado: cerrar ? 'Cerrada' : (fd.estado || 'Abierta'),
      archivo: acta.archivo || '',
      metadata: {
        tipo: tipo,
        año: año,
        semestre: semestre,
        revisionId: tipo === 'Principal' ? (fd.revisionId || '') : '',
        tema: fd.tema || '',
        preside: fd.preside || '',
        ciudad: fd.ciudad || '',
        horaInicio: fd.horaInicio || '',
        horaFin: fd.horaFin || '',
        participantes: (editorState.participantes || []).filter(function(p) {
          return p.nombre && p.nombre.trim();
        }).map(function(p) {
          return {
            nombre: p.nombre.trim(),
            cargo: p.cargo || '',
            empresa: p.empresa || '',
            correo: p.correo || '',
            telefono: p.telefono || '',
            presente: p.presente !== false
          };
        }),
        ordenDia: fd.ordenDia || '',
        desarrollo: (editorState.desarrollo || []).map(function(c, i) {
          return {
            numero: i + 1,
            temaTratado: c.temaTratado || '',
            compromiso: c.compromiso || '',
            responsable: c.responsable || '',
            fecha: c.fecha || '',
            verificacion: c.verificacion || '',
            estado: c.estado || 'Pendiente'
          };
        })
      }
    };
  }

  function _validate(data, actasExistentes, esNuevo) {
    var errores = [];
    if (!data.fecha) errores.push('La fecha es obligatoria');
    if (!data.metadata.preside || !data.metadata.preside.trim()) errores.push('El campo "Preside" es obligatorio');
    if (!data.metadata.participantes || data.metadata.participantes.length === 0) {
      errores.push('Debe registrar al menos un participante');
    }
    if (data.metadata.tipo === 'Principal' && !data.metadata.revisionId) {
      errores.push('Las actas de tipo Principal deben vincularse a una revisión del año anterior');
    }
    if (data.metadata.tipo === 'Principal' && data.metadata.revisionId) {
      var revAño = parseInt(String(data.metadata.revisionId).match(/\d{4}/)?.[0] || '0', 10);
      if (revAño !== data.metadata.año - 1) {
        errores.push('La revisión vinculada (' + data.metadata.revisionId + ') no corresponde al año anterior (' + (data.metadata.año - 1) + ')');
      }
    }
    if (esNuevo && Array.isArray(actasExistentes)) {
      var duplicado = actasExistentes.find(function(a) {
        var aMeta = a.metadata || {};
        return aMeta.tipo === data.metadata.tipo && aMeta.año === data.metadata.año;
      });
      if (duplicado) {
        errores.push('Ya existe un acta de tipo ' + data.metadata.tipo + ' para el año ' + data.metadata.año + ' (ID: ' + duplicado.id + ')');
      }
    }
    return errores;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER · HEADER / TABS / SIDEBAR / FOOTER
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderHeader(acta, esNuevo) {
    var head = document.createElement('div');
    head.style.margin = 'var(--rad-s4) var(--rad-s6) 0 var(--rad-s6)';
    var idLabel = acta.id || (esNuevo ? 'Nueva acta' : 'Acta sin ID');
    head.innerHTML =
      '<div class="kair-rad-inline-counter">' +
        '<span class="kair-rad-badge kair-rad-badge--info"><span class="dot"></span>Editor · G-FO-009 · ' + _esc(idLabel) + '</span>' +
        '<span>·</span>' +
        '<span>Acta de Reunión Gerencial</span>' +
      '</div>' +
      '<h1 style="margin: var(--rad-s2) 0 0 0; font: var(--rad-title-xl); color: var(--rad-text-strong)">' +
        (esNuevo ? 'Nueva acta de reunión' : 'Editar acta ' + _esc(acta.id)) +
      '</h1>';
    return head;
  }

  function _renderTabs(editorState, ctx) {
    var tabs = document.createElement('div');
    tabs.className = 'kair-rad-editor-tabs';
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
        ctx.state.editorActa = editorState;
        ctx.refresh();
      });
      tabs.appendChild(btn);
    });
    return tabs;
  }

  function _renderSidebarNav(editorState, ctx) {
    var card = document.createElement('div');
    card.className = 'kair-rad-side-card';
    card.innerHTML = '<h3 class="kair-rad-side-card__title">Secciones del acta</h3>';

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
        ctx.state.editorActa = editorState;
        ctx.refresh();
      });
      navList.appendChild(item);
    });
    card.appendChild(navList);
    return card;
  }

  function _renderFooter(esNuevo, ctx) {
    var footer = document.createElement('div');
    footer.className = 'kair-rad-sticky-footer';
    footer.innerHTML =
      '<div class="kair-rad-sticky-footer__hint">' +
        'Complete los datos del acta conforme al formato G-FO-009.' +
      '</div>' +
      '<div class="kair-rad-sticky-footer__actions">' +
        '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-footer="cancel"><i class="bi bi-x-lg"></i> Cancelar</button>' +
        '<button class="kair-rad-header__action kair-rad-header__action--secondary" data-footer="save"><i class="bi bi-file-earmark"></i> Guardar borrador</button>' +
        '<button class="kair-rad-header__action kair-rad-header__action--primary" data-footer="save-close"><i class="bi bi-check-circle"></i> Guardar y cerrar acta</button>' +
      '</div>';

    setTimeout(function() {
      var btnCancel = footer.querySelector('[data-footer="cancel"]');
      var btnSave = footer.querySelector('[data-footer="save"]');
      var btnSaveClose = footer.querySelector('[data-footer="save-close"]');

      if (btnCancel) {
        btnCancel.addEventListener('click', function() {
          if (typeof ctx.navigate === 'function') ctx.navigate('actas');
        });
      }
      if (btnSave) {
        btnSave.addEventListener('click', function() { _handleSave(ctx, false, btnSave); });
      }
      if (btnSaveClose) {
        btnSaveClose.addEventListener('click', function() { _handleSave(ctx, true, btnSaveClose); });
      }
    }, 0);

    return footer;
  }

  function _handleSave(ctx, cerrar, btn) {
    if (btn.disabled) return;
    btn.disabled = true;

    try {
      var wrap = btn.closest('.kair-rad-view-actas-editor');
      if (!wrap) {
        if (typeof ctx.toast === 'function') ctx.toast('Error', 'No se pudo acceder al formulario', 'error');
        btn.disabled = false;
        return;
      }

      var editorState = wrap._editorState;
      var acta = wrap._acta;
      var esNuevo = wrap._esNuevo;

      var data = _collectFormData(wrap, editorState, acta, esNuevo, cerrar);

      var actasExistentes = ctx.data.actas || [];
      var errores = _validate(data, actasExistentes, esNuevo);
      if (errores.length > 0) {
        if (typeof ctx.toast === 'function') {
          ctx.toast('Datos incompletos', errores[0], 'warning');
        }
        btn.disabled = false;
        return;
      }

      if (data.metadata.tipo === 'Seguimiento' && esNuevo) {
        var hayPrincipal = actasExistentes.some(function(a) {
          var m = a.metadata || {};
          return m.tipo === 'Principal' && m.año === data.metadata.año;
        });
        if (!hayPrincipal && typeof ctx.toast === 'function') {
          ctx.toast('Aviso', 'No hay acta principal de ' + data.metadata.año + '. El seguimiento se creará independiente.', 'info');
        }
      }

      if (typeof ctx.guardarActa !== 'function') {
        if (typeof ctx.toast === 'function') {
          ctx.toast('Función no disponible', 'No se puede guardar el acta en este momento', 'error');
        }
        btn.disabled = false;
        return;
      }

      ctx.guardarActa(data, esNuevo).then(function(result) {
        if (result && result.success) {
          ctx.state.editorActa = null;
          if (typeof ctx.navigate === 'function') {
            ctx.navigate('actas');
          }
        }
      }).catch(function(e) {
        if (typeof ctx.toast === 'function') {
          ctx.toast('Error al guardar', e && e.message ? e.message : 'Intente de nuevo', 'error');
        }
      }).then(function() {
        btn.disabled = false;
      });
    } catch (e) {
      if (typeof ctx.toast === 'function') {
        ctx.toast('Error', e && e.message ? e.message : 'Error inesperado', 'error');
      }
      btn.disabled = false;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER · SECCIONES
     ═══════════════════════════════════════════════════════════════════════ */

  function _renderSeccion(seccion, editorState, acta, ctx) {
    var card = document.createElement('div');
    card.className = 'kair-rad-section-card';

    var head = document.createElement('div');
    head.className = 'kair-rad-section-card__head';
    head.innerHTML =
      '<div class="kair-rad-section-card__num"><i class="bi bi-card-text" style="font-size:1rem"></i></div>' +
      '<div class="kair-rad-section-card__title-wrap">' +
        '<h2 class="kair-rad-section-card__title">' + _esc(seccion.title) + '</h2>' +
        '<p class="kair-rad-section-card__hint">' + _esc(seccion.desc) + '</p>' +
      '</div>' +
      '<span class="kair-rad-section-card__status kair-rad-section-card__status--pending">' +
        '<span class="dot"></span>Pendiente' +
      '</span>';
    card.appendChild(head);

    var body = document.createElement('div');
    body.style.marginTop = 'var(--rad-s4)';

    if (seccion.key === 'generalidades') {
      body.appendChild(_renderGeneralidadesBody(editorState, ctx));
    } else if (seccion.key === 'participantes') {
      body.appendChild(_renderParticipantesBody(editorState, ctx));
    } else if (seccion.key === 'ordenDelDia') {
      body.appendChild(_renderOrdenDelDiaBody(editorState, ctx));
    } else if (seccion.key === 'desarrollo') {
      body.appendChild(_renderDesarrolloBody(editorState, ctx));
    }

    card.appendChild(body);

    var idx = SECCIONES.findIndex(function(s) { return s.key === seccion.key; });
    var prevS = idx > 0 ? SECCIONES[idx - 1] : null;
    var nextS = idx < SECCIONES.length - 1 ? SECCIONES[idx + 1] : null;
    var isComplete = !!editorState.completed[seccion.key];

    var footer = document.createElement('div');
    footer.className = 'kair-rad-section-footer';
    footer.innerHTML =
      '<span class="kair-rad-section-footer__hint">' +
        (isComplete ? 'Sección completa. Puedes continuar.' : 'Completa los datos antes de marcar como completada.') +
      '</span>' +
      '<div style="display:flex; gap:var(--rad-s2)">' +
        (prevS ? '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-section-nav="prev"><i class="bi bi-chevron-left"></i> ' + _esc(prevS.title) + '</button>' : '<span></span>') +
        '<button class="kair-rad-header__action kair-rad-header__action--success" data-section-action="complete">' +
          '<i class="bi bi-check-circle"></i> ' + (isComplete ? 'Completada' : 'Marcar completada') +
        '</button>' +
        (nextS ? '<button class="kair-rad-header__action kair-rad-header__action--primary" data-section-nav="next">' + _esc(nextS.title) + ' <i class="bi bi-chevron-right"></i></button>' : '') +
      '</div>';
    card.appendChild(footer);

    setTimeout(function() {
      var btnPrev = card.querySelector('[data-section-nav="prev"]');
      var btnNext = card.querySelector('[data-section-nav="next"]');
      var btnComplete = card.querySelector('[data-section-action="complete"]');

      if (btnPrev) {
        btnPrev.addEventListener('click', function() {
          editorState.activeKey = prevS.key;
          ctx.state.editorActa = editorState;
          ctx.refresh();
        });
      }
      if (btnNext) {
        btnNext.addEventListener('click', function() {
          editorState.activeKey = nextS.key;
          ctx.state.editorActa = editorState;
          ctx.refresh();
        });
      }
      if (btnComplete) {
        btnComplete.addEventListener('click', function() {
          editorState.completed[seccion.key] = !editorState.completed[seccion.key];
          if (editorState.completed[seccion.key] && nextS) {
            editorState.activeKey = nextS.key;
          }
          ctx.state.editorActa = editorState;
          ctx.refresh();
          if (typeof ctx.toast === 'function' && editorState.completed[seccion.key]) {
            ctx.toast('Sección completada', seccion.title, 'success');
          }
        });
      }
    }, 0);

    return card;
  }

  function _renderGeneralidadesBody(editorState, ctx) {
    var wrap = document.createElement('div');
    var fd = editorState.formData;

    var row1 = document.createElement('div');
    row1.className = 'kair-rad-form-row';
    row1.innerHTML =
      _select('tipo', 'Tipo de acta', fd.tipo, TIPO_ACTA, true) +
      _field('año', 'Año', String(fd.año), 'number', true) +
      _field('semestre', 'Semestre (1 o 2)', String(fd.semestre), 'number', true);
    wrap.appendChild(row1);

    var revisionesAnt = _revisionesDelAñoAnterior(ctx, fd.año);
    var rowRevision = document.createElement('div');
    rowRevision.className = 'kair-rad-form-row';
    rowRevision.id = 'kair-rad-acta-revision-row';
    if (fd.tipo === 'Principal') {
      var revOptions = [{ value: '', label: '— Seleccionar revisión —' }].concat(
        revisionesAnt.map(function(r) {
          return { value: r.id, label: r.id + (r.periodo ? ' (' + r.periodo + ')' : '') };
        })
      );
      rowRevision.innerHTML =
        _select('revisionId', 'Vinculada a revisión (del año anterior)', fd.revisionId, revOptions, true) +
        '<div class="kair-rad-field-note">' +
          (revisionesAnt.length > 0
            ? 'Revisiones encontradas del año ' + (fd.año - 1) + ': ' + revisionesAnt.length
            : '⚠️ No hay revisiones registradas para ' + (fd.año - 1) + '. Cree primero la revisión del año anterior.') +
        '</div>';
    } else {
      rowRevision.innerHTML =
        '<div class="kair-rad-field-note">Las actas de seguimiento no requieren vincularse a una revisión.</div>';
    }
    wrap.appendChild(rowRevision);

    var idEsperado = _calcularIdEsperado(fd.tipo, fd.año);
    var row2 = document.createElement('div');
    row2.className = 'kair-rad-form-row';
    row2.innerHTML =
      '<div class="kair-rad-field">' +
        '<label>ID generado</label>' +
        '<input type="text" value="' + _esc(idEsperado) + '" disabled style="background:var(--rad-neutral-soft); font-family:monospace">' +
      '</div>' +
      _field('fecha', 'Fecha', fd.fecha, 'date', true) +
      _select('estado', 'Estado', fd.estado, [
        { value: 'Abierta', label: 'Abierta' },
        { value: 'Cerrada', label: 'Cerrada' }
      ], true);
    wrap.appendChild(row2);

    var rowTema = document.createElement('div');
    rowTema.className = 'kair-rad-form-row kair-rad-form-row--full';
    rowTema.innerHTML = _field('tema', 'Tema de la reunión', fd.tema, 'text', true);
    wrap.appendChild(rowTema);

    var row4 = document.createElement('div');
    row4.className = 'kair-rad-form-row';
    row4.innerHTML =
      _field('preside', 'Preside', fd.preside, 'text', true) +
      _field('ciudad', 'Lugar / Ciudad', fd.ciudad, 'text', false);
    wrap.appendChild(row4);

    var row5 = document.createElement('div');
    row5.className = 'kair-rad-form-row';
    row5.innerHTML =
      _field('horaInicio', 'Hora inicio', fd.horaInicio, 'time', false) +
      _field('horaFin', 'Hora fin', fd.horaFin, 'time', false);
    wrap.appendChild(row5);

    wrap.querySelectorAll('[data-field]').forEach(function(inp) {
      var key = inp.getAttribute('data-field');
      if (key && inp.type !== 'disabled' && editorState.formData[key] === undefined) {
        editorState.formData[key] = inp.value;
      }
    });

    var tipoSelect = wrap.querySelector('[data-field="tipo"]');
    var añoInput = wrap.querySelector('[data-field="año"]');
    if (tipoSelect) {
      tipoSelect.addEventListener('change', function() {
        editorState.formData.tipo = tipoSelect.value;
        if (ctx.refresh) ctx.refresh();
      });
    }
    if (añoInput) {
      añoInput.addEventListener('input', function() {
        var v = parseInt(añoInput.value, 10);
        if (!isNaN(v) && v > 2000 && v < 2100) {
          editorState.formData.año = v;
          if (ctx.refresh) ctx.refresh();
        }
      });
    }

    return wrap;
  }

  function _renderParticipantesBody(editorState, ctx) {
    var wrap = document.createElement('div');

    var helpText = document.createElement('p');
    helpText.style.cssText = 'font:var(--rad-caption); color:var(--rad-text-muted); margin:0 0 var(--rad-s3) 0';
    helpText.textContent = 'Agregue los asistentes a la reunión. Al menos uno es obligatorio.';
    wrap.appendChild(helpText);

    var lista = document.createElement('div');
    lista.id = 'kair-rad-acta-participantes-list';

    editorState.participantes.forEach(function(p, idx) {
      lista.appendChild(_renderParticipanteRow(p, idx, editorState, ctx));
    });

    wrap.appendChild(lista);

    var btnAdd = document.createElement('button');
    btnAdd.className = 'kair-rad-header__action kair-rad-header__action--secondary';
    btnAdd.style.marginTop = 'var(--rad-s3)';
    btnAdd.innerHTML = '<i class="bi bi-plus-circle"></i> Agregar participante';
    btnAdd.addEventListener('click', function() {
      editorState.participantes.push({
        nombre: '', cargo: '', empresa: '', correo: '', telefono: '', presente: true
      });
      ctx.state.editorActa = editorState;
      ctx.refresh();
    });
    wrap.appendChild(btnAdd);

    return wrap;
  }

  function _renderParticipanteRow(participante, idx, editorState, ctx) {
    var row = document.createElement('div');
    row.className = 'kair-rad-form-row';
    row.style.alignItems = 'flex-end';
    row.innerHTML =
      _field('part-nombre-' + idx, 'Nombre', participante.nombre, 'text', false) +
      _field('part-cargo-' + idx, 'Cargo', participante.cargo, 'text', false) +
      _field('part-empresa-' + idx, 'Empresa', participante.empresa, 'text', false) +
      '<div class="kair-rad-field" style="flex:0">' +
        '<label>&nbsp;</label>' +
        '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-part-remove="' + idx + '" title="Eliminar">' +
          '<i class="bi bi-trash"></i>' +
        '</button>' +
      '</div>';

    row.querySelectorAll('[data-field]').forEach(function(inp) {
      var key = inp.getAttribute('data-field');
      var match = key.match(/^part-(\w+)-(\d+)$/);
      if (match) {
        var field = match[1];
        var index = parseInt(match[2], 10);
        if (index === idx) {
          inp.addEventListener('input', function() {
            if (!editorState.participantes[index]) return;
            editorState.participantes[index][field] = inp.value;
          });
        }
      }
    });

    setTimeout(function() {
      var btn = row.querySelector('[data-part-remove="' + idx + '"]');
      if (btn) {
        btn.addEventListener('click', function() {
          editorState.participantes.splice(idx, 1);
          ctx.state.editorActa = editorState;
          ctx.refresh();
        });
      }
    }, 0);

    return row;
  }

  function _renderOrdenDelDiaBody(editorState, ctx) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      _textarea('ordenDia', 'Orden del día',
        editorState.formData.ordenDia,
        '1. Lectura del acta anterior\n2. Revisión de compromisos\n3. Proposiciones y varios',
        false);

    wrap.querySelectorAll('[data-field]').forEach(function(inp) {
      var key = inp.getAttribute('data-field');
      if (key && editorState.formData[key] === undefined) {
        editorState.formData[key] = inp.value;
      }
    });

    return wrap;
  }

  function _renderDesarrolloBody(editorState, ctx) {
    var wrap = document.createElement('div');

    var helpText = document.createElement('p');
    helpText.style.cssText = 'font:var(--rad-caption); color:var(--rad-text-muted); margin:0 0 var(--rad-s3) 0';
    helpText.textContent = 'Registre los temas tratados, los compromisos adquiridos, responsables y fechas límite.';
    wrap.appendChild(helpText);

    /* Contenedor scrollable: limita la altura máxima para evitar overflow en modo ventana.
       El cálculo deja espacio para el header (~80px), tabs (~50px), section header (~80px),
       section footer (~70px), sticky footer global (~70px) y márgenes (~30px). */
    var listWrap = document.createElement('div');
    listWrap.style.cssText = 'max-height:calc(100vh - 380px); overflow-y:auto; padding:4px 6px 4px 2px; display:flex; flex-direction:column; gap:var(--rad-s3)';
    listWrap.id = 'kair-rad-acta-desarrollo-list';

    editorState.desarrollo.forEach(function(c, idx) {
      listWrap.appendChild(_renderDesarrolloRow(c, idx, editorState, ctx));
    });

    wrap.appendChild(listWrap);

    var btnAdd = document.createElement('button');
    btnAdd.className = 'kair-rad-header__action kair-rad-header__action--secondary';
    btnAdd.style.marginTop = 'var(--rad-s3)';
    btnAdd.innerHTML = '<i class="bi bi-plus-circle"></i> Agregar compromiso';
    btnAdd.addEventListener('click', function() {
      editorState.desarrollo.push({
        numero: editorState.desarrollo.length + 1,
        temaTratado: '',
        compromiso: '',
        responsable: '',
        fecha: '',
        verificacion: '',
        estado: 'Pendiente'
      });
      ctx.state.editorActa = editorState;
      ctx.refresh();
    });
    wrap.appendChild(btnAdd);

    return wrap;
  }

  /**
   * Render de un compromiso individual como CARD (no celda de tabla).
   * Layout vertical apilado — sin bordes visibles, sin cuadrículas.
   * Mantiene data-dev-field / data-dev-idx para que los handlers existentes sigan funcionando.
   */
  function _renderDesarrolloRow(compromiso, idx, editorState, ctx) {
    var card = document.createElement('div');
    card.className = 'kair-rad-acta-compromiso-card';
    card.style.cssText = 'background:var(--rad-bg-card); border:1px solid var(--rad-border-soft); border-radius:var(--rad-radius-md); padding:var(--rad-s4); display:flex; flex-direction:column; gap:var(--rad-s3)';

    /* Header de la card: número + botón eliminar */
    var head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; justify-content:space-between';
    head.innerHTML =
      '<span style="font:600 0.75rem var(--rad-font); color:var(--rad-text-muted); text-transform:uppercase; letter-spacing:0.05em">Compromiso N° ' + (idx + 1) + '</span>' +
      '<button class="kair-rad-header__action kair-rad-header__action--ghost" data-dev-remove="' + idx + '" title="Eliminar" style="padding:4px 8px">' +
        '<i class="bi bi-trash"></i>' +
      '</button>';
    card.appendChild(head);

    /* Campo: Tema tratado (full width) */
    var fieldTema = document.createElement('div');
    fieldTema.style.cssText = 'display:flex; flex-direction:column; gap:4px';
    fieldTema.innerHTML =
      '<label style="font:500 0.75rem var(--rad-font); color:var(--rad-text-muted); text-transform:uppercase; letter-spacing:0.04em">Tema tratado</label>' +
      '<input type="text" value="' + _esc(compromiso.temaTratado) + '" data-dev-field="temaTratado" data-dev-idx="' + idx + '" placeholder="Ej: Cierre de hallazgos auditoría Q3" style="width:100%">';
    card.appendChild(fieldTema);

    /* Campo: Compromiso (full width) */
    var fieldComp = document.createElement('div');
    fieldComp.style.cssText = 'display:flex; flex-direction:column; gap:4px';
    fieldComp.innerHTML =
      '<label style="font:500 0.75rem var(--rad-font); color:var(--rad-text-muted); text-transform:uppercase; letter-spacing:0.04em">Compromiso</label>' +
      '<input type="text" value="' + _esc(compromiso.compromiso) + '" data-dev-field="compromiso" data-dev-idx="' + idx + '" placeholder="Ej: Documentar evidencia de cierre" style="width:100%">';
    card.appendChild(fieldComp);

    /* Fila: Responsable + Fecha + Estado (3 columnas en pantallas anchas, apilables en angostas) */
    var rowMeta = document.createElement('div');
    rowMeta.style.cssText = 'display:grid; grid-template-columns: 2fr 1fr 1fr; gap:var(--rad-s3); align-items:end';
    rowMeta.innerHTML =
      '<div style="display:flex; flex-direction:column; gap:4px">' +
        '<label style="font:500 0.75rem var(--rad-font); color:var(--rad-text-muted); text-transform:uppercase; letter-spacing:0.04em">Responsable</label>' +
        '<input type="text" value="' + _esc(compromiso.responsable) + '" data-dev-field="responsable" data-dev-idx="' + idx + '" placeholder="Nombre">' +
      '</div>' +
      '<div style="display:flex; flex-direction:column; gap:4px">' +
        '<label style="font:500 0.75rem var(--rad-font); color:var(--rad-text-muted); text-transform:uppercase; letter-spacing:0.04em">Fecha límite</label>' +
        '<input type="date" value="' + _esc(compromiso.fecha) + '" data-dev-field="fecha" data-dev-idx="' + idx + '">' +
      '</div>' +
      '<div style="display:flex; flex-direction:column; gap:4px">' +
        '<label style="font:500 0.75rem var(--rad-font); color:var(--rad-text-muted); text-transform:uppercase; letter-spacing:0.04em">Estado</label>' +
        '<select data-dev-field="estado" data-dev-idx="' + idx + '">' +
          ESTADOS_COMPROMISO.map(function(e) {
            var sel = (e === compromiso.estado) ? ' selected' : '';
            return '<option value="' + e + '"' + sel + '>' + e + '</option>';
          }).join('') +
        '</select>' +
      '</div>';
    card.appendChild(rowMeta);

    /* Bind input changes (mismo patrón que antes) */
    card.querySelectorAll('[data-dev-field]').forEach(function(inp) {
      var field = inp.getAttribute('data-dev-field');
      var index = parseInt(inp.getAttribute('data-dev-idx'), 10);
      var handler = function() {
        if (!editorState.desarrollo[index]) return;
        editorState.desarrollo[index][field] = inp.value;
      };
      inp.addEventListener('input', handler);
      inp.addEventListener('change', handler);
    });

    setTimeout(function() {
      var btn = card.querySelector('[data-dev-remove="' + idx + '"]');
      if (btn) {
        btn.addEventListener('click', function() {
          editorState.desarrollo.splice(idx, 1);
          editorState.desarrollo.forEach(function(c, i) { c.numero = i + 1; });
          ctx.state.editorActa = editorState;
          ctx.refresh();
        });
      }
    }, 0);

    return card;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER · MAIN
     ═══════════════════════════════════════════════════════════════════════ */

  function _render(ctx) {
    var id = ctx.params && ctx.params.id;
    var acta = null;
    var esNuevo = true;

    if (id) {
      var dbActa = (ctx.data.actas || []).filter(function(a) { return a.id === id; })[0];
      if (dbActa) {
        acta = _dbActaToEditorShape(dbActa);
        esNuevo = false;
      }
    }
    if (!acta) {
      acta = _nuevaActa(ctx);
      esNuevo = true;
    }

    var editorState = ctx.state.editorActa || _initEditorState(acta);
    if (!ctx.state.editorActa || ctx.state.editorActa._actaId !== editorState._actaId) {
      editorState = _initEditorState(acta);
      ctx.state.editorActa = editorState;
    }

    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-actas-editor';
    wrap._editorState = editorState;
    wrap._acta = acta;
    wrap._esNuevo = esNuevo;

    wrap.appendChild(_renderHeader(acta, esNuevo));

    var grid = document.createElement('div');
    grid.className = 'kair-rad-editor';

    var main = document.createElement('div');
    main.className = 'kair-rad-editor__main';

    main.appendChild(_renderTabs(editorState, ctx));

    var seccionActiva = SECCIONES.filter(function(s) { return s.key === editorState.activeKey; })[0] || SECCIONES[0];
    main.appendChild(_renderSeccion(seccionActiva, editorState, acta, ctx));

    grid.appendChild(main);

    var sidebar = document.createElement('div');
    sidebar.className = 'kair-rad-editor__sidebar';
    sidebar.appendChild(_renderSidebarNav(editorState, ctx));
    grid.appendChild(sidebar);

    wrap.appendChild(grid);

    wrap.appendChild(_renderFooter(esNuevo, ctx));

    /* Capturar cambios del form en tiempo real */
    if (!editorState.formData) editorState.formData = {};
    wrap.addEventListener('input', function(e) {
      var inp = e.target;
      if (!inp || !inp.matches || !inp.matches('[data-field]')) return;
      var key = inp.getAttribute('data-field');
      if (!key || inp.disabled) return;
      editorState.formData[key] = inp.value;
    });

    return wrap;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     API PÚBLICA
     ═══════════════════════════════════════════════════════════════════════ */

  return {
    render: _render,
    SECCIONES: SECCIONES,
    TIPO_ACTA: TIPO_ACTA,
    ESTADOS_COMPROMISO: ESTADOS_COMPROMISO,
    _calcularIdEsperado: _calcularIdEsperado
  };

})();

window.ActasEditorView = ActasEditorView;
