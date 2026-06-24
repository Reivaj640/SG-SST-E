/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
matriz.js — Vista Matriz: buscador + 3 dropdowns + tabla plana con todas las columnas
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;

  /* Definición de columnas de la tabla */
  var COLS = [
    { key: 'id',                 label: '',                   cls: 'km-table__id-cell' },
    { key: 'sede',               label: 'SEDE' },
    { key: 'proceso',            label: 'PROCESO' },
    { key: 'actividadTarea',     label: 'ACTIVIDAD / TAREA',   wrap: true },
    { key: 'peligro',            label: 'PELIGRO',             cls: 'km-table__cell-peligro', wrap: true },
    { key: 'clasificacion',      label: 'CLASIFICACIÓN',       pill: 'clasif' },
    { key: 'efectosPosibles',    label: 'EFECTOS POSIBLES',    wrap: true },
    { key: 'nd',                 label: 'ND',                   cls: 'km-table__num km-table__num--nd' },
    { key: 'ne',                 label: 'NE',                   cls: 'km-table__num km-table__num--ne' },
    { key: 'np',                 label: 'NP',                   cls: 'km-table__np' },
    { key: 'interpNp',           label: 'INTERP. NP',           pill: 'interp' },
    { key: 'nc',                 label: 'NC',                   cls: 'km-table__num km-table__num--nc' },
    { key: 'nr',                 label: 'NR',                   cls: 'km-table__nr' },
    { key: 'nivel',              label: 'NIVEL DE RIESGO',      pill: 'nivel' },
    { key: 'aceptabilidad',      label: 'ACEPTABILIDAD',        pill: 'acept' },
    { key: 'expuestos',          label: 'EXP.',                 cls: 'km-table__num' },
    { key: 'peorConsecuencia',   label: 'PEOR CONSECUENCIA',    wrap: true },
    { key: 'fuente',             label: 'FUENTE',               wrap: true },
    { key: 'medio',              label: 'MEDIO',                wrap: true },
    { key: 'individuo',          label: 'INDIVIDUO',            wrap: true },
    { key: 'medidaFuente',       label: 'MEDIDA FUENTE',        wrap: true },
    { key: 'medidaMedio',        label: 'MEDIDA MEDIO',         wrap: true },
    { key: 'medidaIndividuo',    label: 'MEDIDA INDIVIDUO',     wrap: true },
    { key: 'actions',            label: '',                    cls: 'km-table__actions' }
  ];

  var MatrizView = {};
  var _companyName = null;
  var _matriz = null;
  var _stats = null;
  var _gtc45Options = null;
  var _searchText = '';
  var _filterSede = '';
  var _filterClasif = '';
  var _filterAcept = '';
  var _editingCellId = null;
  var _pendingChanges = {};
  var _saveTimer = null;
  var _docClickHandler = null;
  var _keyHandler = null;
  var _expandState = {}; // {peligroId: true/false}

  function _flattenPeligros(matriz) {
    var all = [];
    if (!matriz || !matriz.sedes) return all;
    matriz.sedes.forEach(function (s) {
      (s.procesos || []).forEach(function (p) {
        (p.cargos || []).forEach(function (c) {
          (c.peligros || []).forEach(function (pel) {
            var interpNp = KM.interpNP(pel.np);
            var interpNr = KM.interpNR(pel.nr);
            /* Medidas de intervención según GTC-45:
               - Fuente: Eliminación + Sustitución + Ingeniería (eliminan el peligro)
               - Medio: Administrativos (separan persona del peligro)
               - Individuo: EPP (protegen a la persona) */
            var medidaFuente = [pel.medidaEliminacion, pel.medidaSustitucion, pel.medidaIngenieria]
              .filter(Boolean).join(' | ');
            all.push({
              id: pel.id,
              sede: s.nombre || '',
              proceso: p.nombre || '',
              cargo: c.nombre || '',
              actividadTarea: (c.actividades || '') + (c.tareas ? '\nTareas: ' + c.tareas : ''),
              rutinaria: c.rutinaria === true ? 'Si' : (c.rutinaria === false ? 'No' : ''),
              peligro: pel.peligro || '',
              tipo: pel.tipo || '',
              clasificacion: pel.tipo || '',
              efectosPosibles: pel.efectosPosibles || '',
              peorConsecuencia: pel.peorConsecuencia || '',
              nd: pel.nd,
              ne: pel.ne,
              np: pel.np,
              interpNp: interpNp.label,
              interpNpTone: interpNp.tone,
              nc: pel.nc,
              nr: pel.nr,
              nivel: interpNr.nivel,
              nivelLabel: interpNr.label,
              nivelTone: interpNr.tone,
              aceptabilidad: interpNr.label,
              aceptTone: interpNr.tone,
              expuestos: pel.expuestos,
              fuente: pel.controlFuente || '',
              medio: pel.controlMedio || '',
              individuo: pel.controlPersona || '',
              medidaFuente: medidaFuente,
              medidaMedio: pel.medidaAdministrativos || '',
              medidaIndividuo: pel.medidaEpp || ''
            });
          });
        });
      });
    });
    return all;
  }

  function _filterPeligros(all) {
    var q = (_searchText || '').toLowerCase().trim();
    return all.filter(function (p) {
      if (_filterSede && p.sede !== _filterSede) return false;
      if (_filterClasif && p.clasificacion !== _filterClasif) return false;
      if (_filterAcept && p.aceptabilidad !== _filterAcept) return false;
      if (q) {
        var haystack = (p.peligro + ' ' + p.actividadTarea + ' ' + p.efectosPosibles + ' ' + p.sede + ' ' + p.proceso + ' ' + p.cargo + ' ' + p.tipo).toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function _renderCellContent(p, col) {
    var val = p[col.key];
    /* Helper: true si el valor tiene contenido visible */
    function hasValue(v) {
      return v != null && String(v).trim() !== '';
    }
    if (col.key === 'id') {
      return '<span class="km-table__id">' + KM.esc(p.id) + '</span>';
    }
    if (col.key === 'actividadTarea') {
      var txt = hasValue(p.actividadTarea) ? p.actividadTarea : '—';
      var rutin = p.rutinaria ? '<div class="km-table__rutinaria">Rutinaria: ' + KM.esc(p.rutinaria) + '</div>' : '';
      return txt + rutin;
    }
    if (col.key === 'peligro') return hasValue(val) ? val : '—';
    if (col.key === 'clasificacion') {
      if (!hasValue(val)) return '<span class="km-pill km-pill--clasif-empty">—</span>';
      return '<span class="km-pill km-pill--clasif">' + KM.esc(val) + '</span>';
    }
    if (col.key === 'interpNp') {
      if (!hasValue(val)) return '<span class="km-pill km-pill--clasif-empty">—</span>';
      return '<span class="km-pill km-pill--interp km-pill--interp--' + p.interpNpTone + '">' + KM.esc(val) + '</span>';
    }
    if (col.key === 'nd' || col.key === 'ne' || col.key === 'nc') {
      if (!hasValue(val)) return '<span class="' + (col.cls || '') + ' km-table__num--' + col.key + '-dash">—</span>';
      return '<span class="' + (col.cls || '') + '">' + KM.esc(val) + '</span>';
    }
    if (col.key === 'np') return hasValue(val) ? val : '—';
    if (col.key === 'nr') {
      var cls = 'km-table__nr';
      if (p.nrTone === 'danger') cls += ' km-table__nr--high';
      return hasValue(val) ? '<span class="' + cls + '">' + KM.esc(val) + '</span>' : '—';
    }
    if (col.key === 'nivel') {
      if (!hasValue(val)) return '<span class="km-pill km-pill--nivel-empty">—</span>';
      return '<span class="km-pill km-pill--nivel km-pill--nivel-' + val + '">' + KM.esc(val) + '</span>';
    }
    if (col.key === 'aceptabilidad') {
      if (!hasValue(val)) return '<span class="km-pill km-pill--acept-empty">—</span>';
      return '<span class="km-pill km-pill--acept km-pill--acept-' + p.aceptTone + '">' + KM.esc(val) + '</span>';
    }
    if (col.key === 'actions') {
      return '<button type="button" class="km-table__action-btn" data-action="edit" data-peligro-id="' + KM.esc(p.id) + '" title="Editar"><i class="bi bi-pencil"></i></button>' +
             '<button type="button" class="km-table__action-btn km-table__action-btn--delete" data-action="delete" data-peligro-id="' + KM.esc(p.id) + '" title="Eliminar"><i class="bi bi-trash"></i></button>';
    }
    /* Celdas wrap (fuente, medio, individuo, medidas, etc.) */
    if (col.wrap) {
      if (!hasValue(val)) return '<span class="km-table__empty">—</span>';
      return '<span class="km-table__wrap">' + KM.esc(val) + '</span>';
    }
    return hasValue(val) ? KM.esc(val) : '—';
  }

  function _renderRow(p) {
    var html = '<tr data-peligro-id="' + KM.esc(p.id) + '">';
    for (var i = 0; i < COLS.length; i++) {
      var c = COLS[i];
      var tdCls = c.cls ? ' class="' + c.cls + '"' : '';
      html += '<td' + tdCls + '>' + _renderCellContent(p, c) + '</td>';
    }
    html += '</tr>';
    return html;
  }

  function _renderTable(all) {
    var filtered = _filterPeligros(all);
    if (filtered.length === 0) {
      return '<div class="km-empty"><i class="bi bi-inbox"></i><p>No se encontraron peligros con los filtros actuales.</p></div>';
    }
    var html = '<table class="km-table"><thead><tr>';
    for (var i = 0; i < COLS.length; i++) {
      var c = COLS[i];
      html += '<th>' + KM.esc(c.label) + '</th>';
    }
    html += '</tr></thead><tbody>';
    for (var j = 0; j < filtered.length; j++) {
      html += _renderRow(filtered[j]);
    }
    html += '</tbody></table>';
    return html;
  }

  function _renderToolbar(all) {
    var filtered = _filterPeligros(all);
    var totalVisible = filtered.length;
    var totalAll = all.length;

    var sedesOptions = '<option value="">Todas las sedes</option>';
    var sedesSet = {};
    all.forEach(function (p) { sedesSet[p.sede] = true; });
    Object.keys(sedesSet).forEach(function (s) {
      var sel = (s === _filterSede) ? ' selected' : '';
      sedesOptions += '<option value="' + KM.esc(s) + '"' + sel + '>' + KM.esc(s) + '</option>';
    });

    var clasifOptions = '<option value="">Todas las clasificaciones</option>';
    var clasifSet = {};
    all.forEach(function (p) { if (p.clasificacion) clasifSet[p.clasificacion] = true; });
    Object.keys(clasifSet).forEach(function (c) {
      var sel = (c === _filterClasif) ? ' selected' : '';
      clasifOptions += '<option value="' + KM.esc(c) + '"' + sel + '>' + KM.esc(c) + '</option>';
    });

    var aceptOptions = '<option value="">Toda aceptabilidad</option>';
    var aceptSet = { 'ACEPTABLE': true, 'ACEPTABLE CON CONTROL': true, 'NO ACEPTABLE': true };
    Object.keys(aceptSet).forEach(function (a) {
      var sel = (a === _filterAcept) ? ' selected' : '';
      aceptOptions += '<option value="' + KM.esc(a) + '"' + sel + '>' + KM.esc(a) + '</option>';
    });

    return '<div class="km-matriz-toolbar">' +
      '<div class="km-search"><i class="bi bi-search"></i><input type="text" id="km-search-input" placeholder="Buscar por peligro, actividad, efectos, tarea..." value="' + KM.esc(_searchText) + '"></div>' +
      '<select class="km-select" id="km-filter-sede">' + sedesOptions + '</select>' +
      '<select class="km-select" id="km-filter-clasif">' + clasifOptions + '</select>' +
      '<select class="km-select" id="km-filter-acept">' + aceptOptions + '</select>' +
      '<button type="button" class="km-btn km-btn--sm km-btn--outline" id="km-btn-sync-xlsx" title="Exportar cambios al Excel">' +
        '<i class="bi bi-download"></i> Exportar Excel' +
      '</button>' +
      '<div class="km-matriz-info">' +
        '<span>' + totalVisible + ' de ' + totalAll + ' peligros</span>' +
        '<button type="button" class="km-matriz-info__icon-btn" id="km-toggle-expand" title="Expandir/contraer"><i class="bi bi-arrows-expand"></i></button>' +
      '</div>' +
    '</div>';
  }

  function _render(container) {
    if (!_matriz || !_matriz.sedes || !_matriz.sedes.length) {
      container.innerHTML = '<div class="km-empty"><i class="bi bi-exclamation-triangle"></i><p>No hay peligros. Importe una matriz o agregue datos.</p></div>';
      return;
    }
    var all = _flattenPeligros(_matriz);
    container.innerHTML = _renderToolbar(all) +
      '<div class="km-table-wrapper">' + _renderTable(all) + '</div>';
    _bindToolbar(container);
    _bindTable(container);
  }

  function _bindToolbar(container) {
    var searchInput = container.querySelector('#km-search-input');
    if (searchInput) searchInput.addEventListener('input', function () {
      _searchText = searchInput.value;
      var all = _flattenPeligros(_matriz);
      var wrap = container.querySelector('.km-table-wrapper');
      if (wrap) wrap.innerHTML = _renderTable(all);
      var info = container.querySelector('.km-matriz-info span');
      if (info) {
        var f = _filterPeligros(all);
        info.textContent = f.length + ' de ' + all.length + ' peligros';
      }
    });
    var filterSede = container.querySelector('#km-filter-sede');
    if (filterSede) filterSede.addEventListener('change', function () { _filterSede = filterSede.value; _render(container); });
    var filterClasif = container.querySelector('#km-filter-clasif');
    if (filterClasif) filterClasif.addEventListener('change', function () { _filterClasif = filterClasif.value; _render(container); });
    var filterAcept = container.querySelector('#km-filter-acept');
    if (filterAcept) filterAcept.addEventListener('change', function () { _filterAcept = filterAcept.value; _render(container); });

    /* Botón Exportar Excel — guarda cambios actuales al XLSX original */
    var btnSync = container.querySelector('#km-btn-sync-xlsx');
    if (btnSync) btnSync.addEventListener('click', function () {
      btnSync.disabled = true;
      KM.notify('Sincronizando con Excel', 'Guardando cambios en el archivo…', 'info');
      global.KMService.syncXlsx(_companyName).then(function (sr) {
        btnSync.disabled = false;
        if (sr && sr.success) {
          var rows = (sr.data && sr.data.rowsWritten) || 0;
          var fp = (sr.data && sr.data.filePath) || '';
          var fname = fp ? fp.split(/[\\\/]/).pop() : 'Excel';
          KM.notify('Exportación completa', rows + ' peligros guardados en ' + fname, 'success', 4500);
        } else {
          KM.notify('Error al exportar', (sr && sr.error && sr.error.message) || 'Error desconocido', 'error', 6000);
        }
      });
    });
  }

  /* Buscar un peligro (data completa) y sus referencias sede/proceso/cargo por ID. */
  function _findPeligroById(pid) {
    if (!_matriz || !_matriz.sedes) return null;
    for (var si = 0; si < _matriz.sedes.length; si++) {
      var sede = _matriz.sedes[si];
      for (var pi = 0; pi < (sede.procesos || []).length; pi++) {
        var proc = sede.procesos[pi];
        for (var ci = 0; ci < (proc.cargos || []).length; ci++) {
          var cargo = proc.cargos[ci];
          for (var li = 0; li < (cargo.peligros || []).length; li++) {
            var pel = cargo.peligros[li];
            if (pel.id === pid) {
              return {
                peligro: pel,
                sede: sede,
                proceso: proc,
                cargo: cargo,
                sedeId: sede.id,
                procesoId: proc.id,
                cargoId: cargo.id
              };
            }
          }
        }
      }
    }
    return null;
  }

  function _bindTable(container) {
    var wrap = container.querySelector('.km-table-wrapper');
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        var pid = editBtn.getAttribute('data-peligro-id');
        var found = _findPeligroById(pid);
        var detail = { mode: 'edit', peligroId: pid };
        if (found) {
          detail.data = found.peligro;
          detail.cargoId = found.cargoId;
          detail.sedeId = found.sedeId;
          detail.procesoId = found.procesoId;
        }
        try { document.dispatchEvent(new CustomEvent('km:open-editor', { detail: detail })); } catch (err) {}
        return;
      }
      var delBtn = e.target.closest('[data-action="delete"]');
      if (delBtn) {
        var delId = delBtn.getAttribute('data-peligro-id');
        KM.modal({
          title: 'Eliminar peligro',
          body: '<p>Vas a <strong>eliminar</strong> este peligro. Esta acción no se puede deshacer.</p>',
          danger: true,
          confirm: 'Eliminar',
          onConfirm: function () {
            global.KMService.deletePeligro(_companyName, delId).then(function (r) {
              if (r && r.success) { KM.notify('Peligro eliminado', delId, 'success'); MatrizView.refresh(); }
              else KM.notify('Error al eliminar', (r && r.error && r.error.message) || 'No se pudo eliminar', 'error', 6000);
            });
          }
        });
        return;
      }
    });
  }

  MatrizView.load = function (companyName) {
    _companyName = companyName;
    var container = document.getElementById('km-view-matriz');
    if (!container) return;
    container.innerHTML = '<div class="km-empty"><div class="km-kpi__icon"><i class="bi bi-arrow-clockwise"></i></div><p>Cargando matriz...</p></div>';
    Promise.all([
      global.KMService.loadWithAutoImport(companyName),
      global.KMService.gtc45Options()
    ]).then(function (results) {
      var read = results[0];
      var opts = results[1];
      if (read && read.success) {
        _matriz = read.data.matriz;
        _stats = read.data.stats;
        _gtc45Options = (opts && opts.success) ? opts.data : null;
        _render(container);
      } else {
        container.innerHTML = '<div class="km-empty"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3></div>';
      }
    }).catch(function () {
      container.innerHTML = '<div class="km-empty"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3></div>';
    });
  };

  MatrizView.refresh = function () { if (_companyName) MatrizView.load(_companyName); };
  MatrizView.destroy = function () { _matriz = null; _stats = null; _companyName = null; };

  global.KMMatrizView = MatrizView;
})(window);
