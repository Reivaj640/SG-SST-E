/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
matriz.js — Vista Matriz: buscador + 3 dropdowns + tabla plana con todas las columnas
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;

  /* 📦440 (2026-06-25) — Definición de columnas de la tabla alineada con el
     Excel GI-FO-019 MATRIZ DE PELIGROS ALC. Orden y encabezados tomados
     del archivo oficial (filas 8-9: super-encabezado + sub-encabezado).
     El campo `group` indica el super-encabezado bajo el que se anida la
     columna (colspan en fila 8 del Excel). El campo `groupSpan` solo se
     usa para las columnas que encabezan un grupo (span = 1 si no).

     📦442 (2026-06-25) — IMPORTANTE: en el Excel GI-FO-019 las columnas H/I
     del PELIGRO vienen invertidas respecto a la convención estándar:
       - H (Descripción): contiene el TIPO corto (Psicosocial, Biológico, etc.)
       - I (Clasificación): contiene la DESCRIPCIÓN larga del peligro
     El parser del bridge ya hace auto-swap (bridge.js líneas 1273-1276) y
     guarda `tipo` con el TIPO corto y `peligro` con la DESCRIPCIÓN larga.
     Por eso aquí mapeamos:
       - col "Descripción" (pill corto) → renderiza `p.clasificacion` (= p.tipo)
       - col "Clasificación" (wrap largo) → renderiza `p.peligro`
     Esto hace que la app muestre las columnas EXACTAMENTE como el Excel. */
  var COLS = [
    /* 1 */ { key: 'id',                  label: '',                              cls: 'km-table__id-cell' },
    /* 2 */ { key: 'sede',                label: 'Sede',                           group: 'Identificación' },
    /* 3 */ { key: 'proceso',             label: 'Proceso',                        group: 'Identificación' },
    /* 4 */ { key: 'cargo',               label: 'Cargo',                          group: 'Identificación', wrap: true },
    /* 5 */ { key: 'zona',                label: 'Zona/Lugar',                     group: 'Identificación', wrap: true },
    /* 6 */ { key: 'actividades',         label: 'Actividades',                    group: 'Identificación', wrap: true },
    /* 7 */ { key: 'tareas',              label: 'Tareas',                         group: 'Identificación', wrap: true },
    /* 8 */ { key: 'tipoProceso',         label: 'Procesos',                       group: 'Identificación', wrap: true },
    /* 9 */ { key: 'clasificacion',       label: 'Descripción',                    group: 'Peligro',         pill: 'clasif' },
    /* 10*/ { key: 'peligro',             label: 'Clasificación',                  group: 'Peligro',         wrap: true },
    /* 11*/ { key: 'efectosPosibles',     label: 'Efectos Posibles',               group: 'Peligro',         wrap: true },
    /* 12*/ { key: 'fuente',              label: 'Fuente',                         group: 'Controles existentes', wrap: true },
    /* 13*/ { key: 'medio',               label: 'Medio',                          group: 'Controles existentes', wrap: true },
    /* 14*/ { key: 'individuo',           label: 'Individuo',                      group: 'Controles existentes', wrap: true },
    /* 15*/ { key: 'nd',                  label: 'Nivel de deficiencia',           group: 'Evaluación de Riesgos', cls: 'km-table__num km-table__num--nd' },
    /* 16*/ { key: 'ne',                  label: 'Nivel de exposición',            group: 'Evaluación de Riesgos', cls: 'km-table__num km-table__num--ne' },
    /* 17*/ { key: 'np',                  label: 'Nivel de probabilidad (ND X NE)', group: 'Evaluación de Riesgos', cls: 'km-table__np' },
    /* 18*/ { key: 'interpNp',            label: 'Interpretación del nivel de probabilidad', group: 'Evaluación de Riesgos', pill: 'interp' },
    /* 19*/ { key: 'nc',                  label: 'Nivel de Consecuencia',          group: 'Evaluación de Riesgos', cls: 'km-table__num km-table__num--nc' },
    /* 20*/ { key: 'nr',                  label: 'Nivel de Riesgo',                group: 'Evaluación de Riesgos', cls: 'km-table__nr' },
    /* 21*/ { key: 'nivel',               label: 'Interpretación del NR',          group: 'Evaluación de Riesgos', pill: 'nivel' },
    /* 22*/ { key: 'aceptabilidad',       label: 'Aceptabilidad del Riesgo',       group: 'Valoración del riesgo', pill: 'acept' },
    /* 23*/ { key: 'expuestos',           label: 'Nro. expuestos',                 group: 'Criterios para establecer controles', cls: 'km-table__num' },
    /* 24*/ { key: 'peorConsecuencia',    label: 'Peor consecuencia',              group: 'Criterios para establecer controles', wrap: true },
    /* 25*/ { key: 'medidaEliminacion',   label: 'Eliminación',                    group: 'Medidas de intervención', wrap: true },
    /* 26*/ { key: 'medidaSustitucion',   label: 'Sustitución',                    group: 'Medidas de intervención', wrap: true },
    /* 27*/ { key: 'medidaIngenieria',    label: 'Controles de ingeniería',        group: 'Medidas de intervención', wrap: true },
    /* 28*/ { key: 'medidaAdministrativos', label: 'Señalización, advertencia, controles admon.', group: 'Medidas de intervención', wrap: true },
    /* 29*/ { key: 'medidaEpp',           label: 'Equipos de protección personal', group: 'Medidas de intervención', wrap: true },
    /* 30*/ { key: 'actions',             label: '',                               cls: 'km-table__actions' }
  ];

  /* Orden canónico de super-encabezados (fila 8 del Excel) y bajo cuál
     columna arranca cada grupo (1-based, contando desde 1 = Sede). */
  var HEADER_GROUPS = [
    { label: '',                              span: 1 },  /* col id (helper) */
    { label: '',                              span: 7 },  /* Identificación: Sede+Proceso+Cargo+Zona+Actividades+Tareas+Procesos */
    { label: 'PELIGRO',                       span: 3 },  /* Descripción + Clasificación + Efectos Posibles */
    { label: 'CONTROLES EXISTENTES',          span: 3 },  /* Fuente + Medio + Individuo */
    { label: 'EVALUACIÓN DE RIESGOS',         span: 7 },  /* ND + NE + NP + InterpNP + NC + NR + InterpNR */
    { label: 'VALORACIÓN DEL RIESGO',         span: 1 },  /* Aceptabilidad */
    { label: 'CRITERIOS PARA ESTABLECER CONTROLES', span: 2 },  /* NroExp + PeorConsec */
    { label: 'MEDIDAS DE INTERVENCIÓN',       span: 5 },  /* Elim + Sust + Ing + Señal + EPP */
    { label: '',                              span: 1 }   /* col actions (helper) */
  ];

  /* 📦440 — Anchos de columna (en px) tomados como referencia de los anchos
     del Excel GI-FO-019 + ajustes para legibilidad. Estos anchos alimentan
     el <colgroup> que se renderiza antes del thead. */
  var COL_WIDTHS = [
    60,    /* id helper */
    120,   /* Sede */
    130,   /* Proceso */
    200,   /* Cargo */
    160,   /* Zona/Lugar */
    220,   /* Actividades */
    240,   /* Tareas */
    130,   /* Procesos (tipo) */
    280,   /* Peligro - Descripción */
    150,   /* Peligro - Clasificación */
    240,   /* Efectos Posibles */
    200,   /* Fuente */
    200,   /* Medio */
    200,   /* Individuo */
    80,    /* ND */
    80,    /* NE */
    80,    /* NP */
    130,   /* Interp. NP */
    80,    /* NC */
    80,    /* NR */
    80,    /* Interp. NR (nivel) */
    180,   /* Aceptabilidad */
    100,   /* Nro. Expuestos */
    220,   /* Peor Consecuencia */
    200,   /* Eliminación */
    200,   /* Sustitución */
    220,   /* Controles de ingeniería */
    240,   /* Señalización / Admon */
    200,   /* EPP */
    70     /* actions helper */
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
  /* 📦441 — último resultado de loadWithAutoImport. Se usa para detectar
     desfase entre JSON local y Excel (needsReplace + mismatchDetail). */
  var _lastLoadResult = null;
  var _mismatchBannerDismissed = false;

/* 📦440 (2026-06-25) — _flattenPeligros: agrega campos nuevos para alinear
     la tabla con el Excel GI-FO-019:
       - cargo: nombre del cargo (columna C)
       - actividades: solo el texto de actividades (columna E)
       - tareas: solo el texto de tareas (columna F)
       - tipoProceso: derivado del proceso (columna G, "Gestión operativa"
         o "Gestión Operativa" según el tipo de proceso)
       - nrTone: tono danger para NR>300 que se usa para colorear la celda */
  function _flattenPeligros(matriz) {
    var all = [];
    if (!matriz || !matriz.sedes) return all;
    matriz.sedes.forEach(function (s) {
      (s.procesos || []).forEach(function (p) {
        /* 📦440 — Columna G del Excel ("Procesos"): siempre "Gestión operativa"
           para procesos Administrativos y "Gestión Operativa" para Operativos. */
        var procNombre = (p.nombre || '').toLowerCase();
        var tipoProceso = procNombre.indexOf('operativ') !== -1 ? 'Gestión Operativa' : 'Gestión operativa';
        (p.cargos || []).forEach(function (c) {
          (c.peligros || []).forEach(function (pel) {
            var interpNp = KM.interpNP(pel.np);
            var interpNr = KM.interpNR(pel.nr);
            all.push({
              id: pel.id,
              sede: s.nombre || '',
              proceso: p.nombre || '',
              cargo: c.nombre || '',
              zona: c.zona || '',
              /* 📦440 — separadas en dos columnas (E y F del Excel) */
              actividades: c.actividades || '',
              tareas: c.tareas || '',
              /* 📦440 — nueva columna derivada (G del Excel) */
              tipoProceso: tipoProceso,
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
              nrTone: (pel.nr != null && pel.nr > 300) ? 'danger' : (interpNr.tone || ''),
              nivel: interpNr.nivel,
              nivelLabel: interpNr.label,
              nivelTone: interpNr.tone,
              aceptabilidad: interpNr.label,
              aceptTone: interpNr.tone,
              expuestos: pel.expuestos,
              fuente: pel.controlFuente || '',
              medio: pel.controlMedio || '',
              individuo: pel.controlPersona || '',
              /* F439.6 + 📦440: 5 columnas separadas con los títulos exactos del Excel */
              medidaEliminacion: pel.medidaEliminacion || '',
              medidaSustitucion: pel.medidaSustitucion || '',
              medidaIngenieria: pel.medidaIngenieria || '',
              medidaAdministrativos: pel.medidaAdministrativos || '',
              medidaEpp: pel.medidaEpp || ''
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
        /* 📦440 — búsqueda incluye actividades, tareas, cargo y tipoProceso
           (los nuevos campos) además de los originales. */
        var haystack = (
          p.peligro + ' ' +
          p.actividades + ' ' +
          p.tareas + ' ' +
          p.efectosPosibles + ' ' +
          p.sede + ' ' +
          p.proceso + ' ' +
          p.cargo + ' ' +
          p.tipoProceso + ' ' +
          p.tipo
        ).toLowerCase();
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
    /* 📦440 — Actividades y Tareas son ahora columnas independientes.
       Cada una muestra solo su contenido (sin combinar). */
    if (col.key === 'actividades' || col.key === 'tareas') {
      if (!hasValue(val)) return '<span class="km-table__empty">—</span>';
      return '<span class="km-table__wrap">' + KM.esc(val) + '</span>';
    }
    /* 📦442 — "peligro" (descripción larga) ahora se renderiza en la columna
       "Clasificación" del Excel, con wrap para textos largos. Mantenemos
       la key como 'peligro' para no romper el resto del código. */
    if (col.key === 'peligro') {
      if (!hasValue(val)) return '<span class="km-table__cell-peligro-empty">—</span>';
      return '<span class="km-table__cell-peligro">' + KM.esc(val) + '</span>';
    }
    /* 📦442 — "clasificacion" (tipo corto) ahora se renderiza como pill en la
       columna "Descripción" del Excel. Se mantiene la key 'clasificacion'. */
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
    /* 📦440 — "nivel" ahora se muestra como pill I/II/III/IV/V (Excel columna T
       "Interpretación del NR"). Sin cambios visuales respecto a la versión
       anterior — solo se conserva el comportamiento ya existente. */
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
    /* Celdas wrap (cargo, zona, fuente, medio, individuo, medidas, etc.) */
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

  /* 📦440 (2026-06-25) — _renderTable: thead de 2 filas que reproduce la
     estructura del Excel GI-FO-019 (fila 8 super-encabezado con colspan,
     fila 9 sub-encabezado con los títulos de cada columna).
     Incluye <colgroup> con anchos fijos para mantener la legibilidad
     al hacer scroll horizontal. */
  function _renderTable(all) {
    var filtered = _filterPeligros(all);
    if (filtered.length === 0) {
      return '<div class="km-empty"><i class="bi bi-inbox"></i><p>No se encontraron peligros con los filtros actuales.</p></div>';
    }
    /* <colgroup> con anchos fijos por columna */
    var colgroup = '<colgroup>';
    for (var w = 0; w < COL_WIDTHS.length; w++) {
      colgroup += '<col style="width:' + COL_WIDTHS[w] + 'px; min-width:' + COL_WIDTHS[w] + 'px;">';
    }
    colgroup += '</colgroup>';
    /* Fila 1 — super-encabezado (uno por cada HEADER_GROUP, con colspan).
       Las columnas auxiliares (id, actions) no llevan etiqueta visible. */
    var superRow = '<tr class="km-table__super-header">';
    for (var g = 0; g < HEADER_GROUPS.length; g++) {
      var grp = HEADER_GROUPS[g];
      var visibleLabel = grp.label || '';
      superRow += '<th class="km-table__super-th" colspan="' + grp.span + '">' +
        (visibleLabel ? KM.esc(visibleLabel) : '&nbsp;') +
        '</th>';
    }
    superRow += '</tr>';
    /* Fila 2 — sub-encabezado (uno por cada COL, en orden). */
    var subRow = '<tr class="km-table__sub-header">';
    for (var i = 0; i < COLS.length; i++) {
      var c = COLS[i];
      var thCls = c.cls ? ' class="' + c.cls.replace('km-table__cell-peligro', 'km-table__th-peligro') + '"' : '';
      subRow += '<th' + thCls + '>' + KM.esc(c.label) + '</th>';
    }
    subRow += '</tr>';
    var html = '<table class="km-table km-table--excel">' + colgroup + '<thead>' + superRow + subRow + '</thead><tbody>';
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
      '<button type="button" class="km-btn km-btn--sm km-btn--outline" id="km-btn-import-xlsx" title="Completar datos faltantes desde el Excel (no sobrescribe lo que ya tienes)">' +
        '<i class="bi bi-upload"></i> Importar Excel' +
      '</button>' +
      /* 📦441 (2026-06-25) — Botón REEMPLAZAR desde Excel. Borra el JSON local y
         lo reconstruye 100% desde el Excel actual. Soluciona:
           1) IDs fuera de orden (pel_4 primero por IDs antiguos eliminados)
           2) Filas con medidas vacías (datos incompletos del JSON viejo)
           3) Desfase entre Excel y JSON (sedes/procesos/cargos no coinciden) */
      '<button type="button" class="km-btn km-btn--sm km-btn--warning" id="km-btn-replace-xlsx" title="Borra los datos locales y los reemplaza 100% con los del Excel. Úsalo cuando el Excel y la tabla no coincidan.">' +
        '<i class="bi bi-arrow-repeat"></i> Reemplazar desde Excel' +
      '</button>' +
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
    var html = '';
    /* 📦441 (2026-06-25) — Banner de aviso cuando el JSON local no
       coincide con el Excel. Aparece arriba de la tabla y guía al usuario
       hacia el botón "Reemplazar desde Excel". */
    if (_lastLoadResult && _lastLoadResult.needsReplace) {
      html += _renderMismatchBanner(_lastLoadResult.mismatchDetail);
    }
    html += _renderToolbar(all) +
      '<div class="km-table-wrapper">' + _renderTable(all) + '</div>';
    container.innerHTML = html;
    _bindToolbar(container);
    _bindTable(container);
    _bindMismatchBanner(container);
  }

  /* 📦441 — Binding del banner de desfase. El botón de acción dispara el
     mismo flujo que "Reemplazar desde Excel"; el botón X solo cierra el
     banner en esta sesión (no resuelve el problema). */
  function _bindMismatchBanner(container) {
    var banner = container.querySelector('#km-mismatch-banner');
    if (!banner) return;
    var btnAction = banner.querySelector('#km-mismatch-banner-action');
    var btnClose = banner.querySelector('#km-mismatch-banner-close');
    if (btnAction) btnAction.addEventListener('click', function () {
      var toolbarBtn = container.querySelector('#km-btn-replace-xlsx');
      if (toolbarBtn) toolbarBtn.click();
    });
    if (btnClose) btnClose.addEventListener('click', function () {
      _mismatchBannerDismissed = true;
      banner.remove();
    });
  }

  /* 📦441 — Banner ámbar que avisa al usuario del desfase JSON ↔ Excel.
     Ofrece un atajo al mismo botón "Reemplazar desde Excel" para que
     no tenga que buscarlo en la barra de herramientas. */
  function _renderMismatchBanner(detail) {
    var excelSedes = (detail && detail.excelSedes) || [];
    var jsonSedes = (detail && detail.jsonSedes) || [];
    return '<div class="km-mismatch-banner" id="km-mismatch-banner">' +
      '<div class="km-mismatch-banner__icon"><i class="bi bi-exclamation-triangle-fill"></i></div>' +
      '<div class="km-mismatch-banner__body">' +
        '<strong>Datos desfasados del Excel.</strong> ' +
        'Los datos guardados localmente no coinciden con el Excel actual ' +
        '(los nombres de las sedes son diferentes).' +
        (excelSedes.length ? ' Excel tiene: <code>' + KM.esc(excelSedes.join(', ')) + '</code>.' : '') +
        (jsonSedes.length ? ' Local tiene: <code>' + KM.esc(jsonSedes.join(', ')) + '</code>.' : '') +
      '</div>' +
      '<button type="button" class="km-btn km-btn--sm km-btn--warning" id="km-mismatch-banner-action">' +
        '<i class="bi bi-arrow-repeat"></i> Reemplazar desde Excel' +
      '</button>' +
      '<button type="button" class="km-mismatch-banner__close" id="km-mismatch-banner-close" aria-label="Cerrar aviso">' +
        '<i class="bi bi-x-lg"></i>' +
      '</button>' +
    '</div>';
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

    /* Botón Importar Excel — completa campos vacíos del JSON desde el Excel
       sin sobrescribir lo que el usuario ya editó manualmente */
    var btnImport = container.querySelector('#km-btn-import-xlsx');
    if (btnImport) btnImport.addEventListener('click', function () {
      btnImport.disabled = true;
      KM.notify('Importando desde Excel', 'Completando campos vacíos sin sobrescribir nada…', 'info');
      global.KMService.importXlsx(_companyName, null, { mode: 'merge-empty' }).then(function (ir) {
        btnImport.disabled = false;
        if (ir && ir.success) {
          var filled = (ir.data && ir.data.fieldsFilled) || 0;
          var msg = filled > 0
            ? 'Importación completa: ' + filled + ' campos vacíos completados desde Excel.'
            : 'No había campos vacíos para completar.';
          KM.notify('Importación completa', msg, 'success', 4500);
          MatrizView.refresh();
        } else {
          KM.notify('Error al importar', (ir && ir.error && ir.error.message) || 'Error desconocido', 'error', 6000);
        }
      });
    });

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

    /* 📦441 (2026-06-25) — Botón REEMPLAZAR desde Excel.
       Acción destructiva: borra el JSON local y lo reconstruye 100% desde
       el Excel actual (findMatrizXlsx auto-descubre el archivo). Esto
       soluciona tres problemas típicos:
         1) IDs fuera de orden (pel_4 primero, faltan pel_1, pel_2, pel_3)
         2) Filas con medidas vacías (datos incompletos del JSON viejo)
         3) Desfase total entre Excel y JSON (sedes/procesos/cargos
            no coinciden, merge-empty no puede hacer nada) */
    var btnReplace = container.querySelector('#km-btn-replace-xlsx');
    if (btnReplace) btnReplace.addEventListener('click', function () {
      var doReplace = function () {
        btnReplace.disabled = true;
        KM.notify('Reemplazando desde Excel', 'Borrando datos locales y releyendo el archivo…', 'info', 6000);
        global.KMService.importXlsx(_companyName, null, { replace: true }).then(function (rr) {
          btnReplace.disabled = false;
          if (rr && rr.success) {
            var rows = (rr.data && rr.data.rowsImported) || 0;
            var sedes = (rr.data && rr.data.sedesCreated) || 0;
            var msg = 'Reemplazo completo: ' + rows + ' peligros, ' + sedes + ' sedes recargadas del Excel.';
            KM.notify('Tabla sincronizada', msg, 'success', 5000);
            MatrizView.refresh();
          } else {
            var errMsg = (rr && rr.error && rr.error.message) || 'Error desconocido';
            KM.notify('Error al reemplazar', errMsg, 'error', 8000);
          }
        }).catch(function (err) {
          btnReplace.disabled = false;
          KM.notify('Error al reemplazar', (err && err.message) || 'Error desconocido', 'error', 8000);
        });
      };

      /* Modal de confirmación — acción destructiva */
      KM.modal({
        title: '¿Reemplazar toda la matriz desde el Excel?',
        body:
          '<p>Esta acción va a <strong>borrar todos los datos locales</strong> ' +
          'y reconstruirlos desde el archivo Excel actual.</p>' +
          '<p style="margin-top:10px;color:#b45309;"><i class="bi bi-exclamation-triangle"></i> ' +
          '<strong>Atención:</strong> se perderán todas las ediciones manuales ' +
          'que hayas hecho y los IDs se regenerarán (pel_1, pel_2, …).</p>' +
          '<p style="margin-top:10px;">Si solo quieres <em>completar campos vacíos</em> ' +
          'sin perder nada, usa el botón <strong>"Importar Excel"</strong>.</p>',
        danger: true,
        confirm: 'Sí, reemplazar todo',
        cancel: 'Cancelar',
        onConfirm: doReplace
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
        /* 📦441 — Capturar info de desfase para mostrar el banner ámbar */
        _lastLoadResult = {
          needsReplace: !!(read.data && read.data.needsReplace),
          mismatchDetail: (read.data && read.data.mismatchDetail) || null
        };
        _render(container);
        /* Si detectamos desfase y el usuario NO ha cerrado el banner antes,
           disparamos un toast persistente para que se entere de la acción
           recomendada (reemplazar). */
        if (_lastLoadResult.needsReplace && !_mismatchBannerDismissed) {
          KM.notify(
            'Datos desfasados del Excel',
            'Las sedes/procesos locales no coinciden con el Excel actual. Usa "Reemplazar desde Excel" para sincronizar.',
            'warning',
            8000
          );
        }
      } else {
        container.innerHTML = '<div class="km-empty"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3></div>';
      }
    }).catch(function () {
      container.innerHTML = '<div class="km-empty"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3></div>';
    });
  };

  MatrizView.refresh = function () { if (_companyName) MatrizView.load(_companyName); };
  MatrizView.destroy = function () { _matriz = null; _stats = null; _companyName = null; _lastLoadResult = null; };

  global.KMMatrizView = MatrizView;
})(window);
