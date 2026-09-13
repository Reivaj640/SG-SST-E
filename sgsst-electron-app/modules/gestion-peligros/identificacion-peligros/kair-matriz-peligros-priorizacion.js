/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
priorizacion.js — Vista Priorización: leyenda + sub-tabs + tabla semáforo / matriz calor 3x3
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;

  var PriorizacionView = {};
  var _companyName = null;
  var _matriz = null;
  var _activeTab = 'semaforo';
  /* 📦447 (2026-06-25) — Filtro por nivel de riesgo. null = sin filtro
     (mostrar todos). Cuando se activa, la tabla semáforo y el conteo del
     header se actualizan para mostrar solo los peligros del nivel elegido.
     Persiste durante la vida de la vista (se resetea al destruir). */
  var _activeLevel = null;

  function _flattenPeligros(matriz) {
    var all = [];
    if (!matriz || !matriz.sedes) return all;
    matriz.sedes.forEach(function (s) {
      (s.procesos || []).forEach(function (p) {
        (p.cargos || []).forEach(function (c) {
          (c.peligros || []).forEach(function (pel) {
            var interpNr = KM.interpNR(pel.nr);
            all.push({
              id: pel.id,
              sede: s.nombre || '',
              proceso: p.nombre || '',
              cargo: c.nombre || '',
              peligro: pel.peligro || '',
              actividadTarea: (c.actividades || '') + (c.tareas ? ' ' + c.tareas : ''),
              clasificacion: pel.tipo || '',
              tipo: pel.tipo || '',
              np: pel.np,
              nc: pel.nc,
              nr: pel.nr,
              nivel: interpNr.nivel,
              nivelLabel: interpNr.label,
              nivelTone: interpNr.tone,
              aceptabilidad: interpNr.label,
              aceptTone: interpNr.tone,
              expuestos: pel.expuestos || 0
            });
          });
        });
      });
    });
    return all;
  }

  /* 📦447 (2026-06-25) — Calcular conteo por nivel para mostrar en cada
     botón de la leyenda. El usuario ve cuántos peligros hay en cada
     nivel sin tener que abrir la tabla. */
  function _countByLevel(all) {
    var counts = { I: 0, II: 0, III: 0, IV: 0, V: 0, '': 0 };
    all.forEach(function (p) {
      var lvl = p.nivel || '';
      counts[lvl] = (counts[lvl] || 0) + 1;
    });
    return counts;
  }

  /* 📦447 (2026-06-25) — Leyenda convertida en BOTONES DE FILTRO.
     Click en un nivel = filtra la tabla semáforo por ese nivel.
     Click en "Todos" = limpia el filtro. El botón activo se resalta con
     un fondo del color del nivel + borde. Se muestra el conteo entre
     paréntesis para que el usuario sepa cuántos resultados obtendrá. */
  function _renderLeyenda(all) {
    var c = _countByLevel(all);
    var btn = function (level, label, dotCls, count, isActive) {
      var activeCls = isActive ? ' km-leyenda__btn--active' : '';
      var emptyCls = count === 0 ? ' km-leyenda__btn--empty' : '';
      return '<button type="button" class="km-leyenda__btn' + activeCls + emptyCls + '" data-level="' + level + '" title="' + (isActive ? 'Click para quitar filtro' : 'Filtrar por ' + label) + '">' +
        '<span class="km-leyenda__dot ' + dotCls + '"></span>' +
        '<span class="km-leyenda__btn-label">' + label + '</span>' +
        '<span class="km-leyenda__count">' + count + '</span>' +
      '</button>';
    };
    return '<div class="km-leyenda">' +
      '<span class="km-leyenda__label">LEYENDA / FILTRO:</span>' +
      btn('I',   'Nivel I · No aceptable (CRÍTICO)', 'km-leyenda__dot--I',   c.I,   _activeLevel === 'I') +
      btn('II',  'Nivel II · Aceptable con control (ALTO)', 'km-leyenda__dot--II',  c.II,  _activeLevel === 'II') +
      btn('III', 'Nivel III · Aceptable (MEDIO)',    'km-leyenda__dot--III', c.III, _activeLevel === 'III') +
      btn('IV',  'Nivel IV · Aceptable (BAJO)',      'km-leyenda__dot--IV',  c.IV,  _activeLevel === 'IV') +
      '<button type="button" class="km-leyenda__btn km-leyenda__btn--reset' + (_activeLevel === null ? ' km-leyenda__btn--active' : '') + '" data-level="" title="Quitar filtro y mostrar todos">' +
        '<i class="bi bi-arrow-counterclockwise"></i>' +
        '<span class="km-leyenda__btn-label">Todos</span>' +
        '<span class="km-leyenda__count">' + all.length + '</span>' +
      '</button>' +
    '</div>';
  }

  function _renderSubTabs() {
    return '<div class="km-prior-tabs">' +
      '<button type="button" class="km-prior-tab ' + (_activeTab === 'semaforo' ? 'km-prior-tab--active' : '') + '" data-tab="semaforo"><i class="bi bi-list-ol"></i> Tabla semáforo</button>' +
      '<button type="button" class="km-prior-tab ' + (_activeTab === 'heatmap' ? 'km-prior-tab--active' : '') + '" data-tab="heatmap"><i class="bi bi-grid-3x3"></i> Matriz de calor 3x3</button>' +
    '</div>';
  }

  /* 📦445 (2026-06-25) — wrapper con max-height + scroll siempre visible.
     El contenedor limita la altura para que aparezca scroll vertical cuando
     hay muchas filas, y usa overflow:scroll (no auto) para garantizar
     que las barras horizontal+vertical se vean siempre que el contenido
     exceda el contenedor. */
  function _renderSemaforo(all) {
    /* 📦447 (2026-06-25) — Aplicar filtro por nivel si está activo.
       Si _activeLevel es null, mostramos todos. */
    var filtrados = _activeLevel
      ? all.filter(function (p) { return (p.nivel || '') === _activeLevel; })
      : all;
    var ordenados = filtrados.slice().sort(function (a, b) { return (b.nr || 0) - (a.nr || 0); });
    /* 📦445 — Anchos fijos por columna para forzar scroll horizontal cuando
       el viewport sea más estrecho que la suma de anchos. Sin esto, las
       columnas se comprimen y el contenido se hace ilegible.
       📦446 — Reducir PELIGRO (280→200) y ACEPTABILIDAD (220→180) para
       dar más espacio a ACTIVIDAD (que es la columna con texto más largo)
       y evitar que ambas dominen el ancho de la tabla. */
    var colWidths = [20, 40, 120, 200, 1150, 120, 60, 60, 70, 70, 130, 50];

    /* 📦447 — Banner del filtro activo: muestra qué nivel está filtrando
       y cuántos resultados se muestran vs el total. Click en la X lo
       quita. Empty state separado si no hay resultados. */
    var filterBanner = '';
    if (_activeLevel) {
      var lvlLabel = { I: 'Nivel I · CRÍTICO', II: 'Nivel II · ALTO', III: 'Nivel III · MEDIO', IV: 'Nivel IV · BAJO', V: 'Nivel V · CATASTRÓFICO' }[_activeLevel] || _activeLevel;
      filterBanner = '<div class="km-filter-banner">' +
        '<i class="bi bi-funnel-fill"></i>' +
        '<span>Filtrando por <strong>' + KM.esc(lvlLabel) + '</strong> · ' + ordenados.length + ' de ' + all.length + ' peligros</span>' +
        '<button type="button" class="km-filter-banner__clear" data-clear-filter title="Quitar filtro"><i class="bi bi-x-lg"></i></button>' +
      '</div>';
    }

    var tableHtml;
    if (ordenados.length === 0) {
      /* 📦447 — Empty state específico para "filtro sin resultados" */
      tableHtml = '<div class="km-table-empty">' +
        '<i class="bi bi-inbox"></i>' +
        '<h3>Sin resultados para este nivel</h3>' +
        '<p>No hay peligros clasificados como <strong>' + KM.esc(_activeLevel || '') + '</strong> en esta matriz.</p>' +
        '<button type="button" class="km-btn km-btn--primary" data-clear-filter><i class="bi bi-arrow-counterclockwise"></i> Mostrar todos los niveles</button>' +
      '</div>';
    } else {
      tableHtml = '<div class="km-table-wrapper km-table-wrapper--scroll"><table class="km-table km-table--excel"><colgroup>';
      for (var cw = 0; cw < colWidths.length; cw++) {
        tableHtml += '<col style="width:' + colWidths[cw] + 'px;min-width:' + colWidths[cw] + 'px;">';
      }
      tableHtml += '</colgroup><thead><tr>' +
          '<th>#</th><th>ID</th><th>SEDE</th><th>PELIGRO</th><th>ACTIVIDAD</th><th>CLASIFICACIÓN</th>' +
          '<th>NP</th><th>NC</th><th>NR</th><th>NIVEL</th><th>ACEPTABILIDAD</th><th>EXP.</th>' +
        '</tr></thead><tbody>';
      for (var i = 0; i < ordenados.length; i++) {
        var p = ordenados[i];
        var nrCls = p.nrTone === 'danger' ? ' km-table__nr--high' : '';
        /* 📦445 — El TD de PELIGRO ya NO lleva la clase km-table__cell-peligro
           (eso se lo pone al span interno). Antes el cls en el TD convertía
           la celda en inline-block y rompía vertical-align:middle. */
        tableHtml += '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><span class="km-table__id">' + KM.esc(p.id) + '</span></td>' +
          '<td>' + KM.esc(p.sede) + '</td>' +
          '<td><span class="km-table__cell-peligro">' + KM.esc(p.peligro || '—') + '</span></td>' +
          '<td>' + KM.esc(p.actividadTarea || '—') + '</td>' +
          '<td>' + (p.clasificacion ? '<span class="km-pill km-pill--clasif">' + KM.esc(p.clasificacion) + '</span>' : '<span class="km-pill km-pill--clasif-empty">—</span>') + '</td>' +
          '<td class="km-table__np">' + (p.np != null ? p.np : '—') + '</td>' +
          '<td>' + (p.nc != null ? p.nc : '—') + '</td>' +
          '<td><span class="km-table__nr' + nrCls + '">' + (p.nr != null ? p.nr : '—') + '</span></td>' +
          '<td>' + (p.nivel ? '<span class="km-pill km-pill--nivel km-pill--nivel-' + p.nivel + '">' + p.nivel + '</span>' : '—') + '</td>' +
          '<td>' + (p.aceptabilidad ? '<span class="km-pill km-pill--acept km-pill--acept-' + p.aceptTone + '">' + KM.esc(p.aceptabilidad) + '</span>' : '—') + '</td>' +
          '<td>' + p.expuestos + '</td>' +
        '</tr>';
      }
      tableHtml += '</tbody></table></div>';
    }

    var html = '<div class="km-prior-card">' +
      '<div class="km-prior-card__header">' +
        '<span class="km-prior-card__title"><i class="bi bi-list-ol"></i> Peligros priorizados por nivel de riesgo</span>' +
        '<span class="km-prior-card__count">' + ordenados.length + (_activeLevel ? ' de ' + all.length : '') + ' peligros · ordenados por NR descendente</span>' +
      '</div>' +
      filterBanner +
      tableHtml +
    '</div>';
    return html;
  }

  function _renderHeatmap(all) {
    // NP bins: Bajo (1-4), Medio (5-12), Alto (>12)
    // NC bins: Bajo (10-25), Medio (40-60), Alto (100)
    var cells = {};
    all.forEach(function (p) {
      var np = p.np || 0;
      var nc = p.nc || 0;
      var npBin = np <= 4 ? 0 : (np <= 12 ? 1 : 2);
      var ncBin = nc <= 25 ? 0 : (nc <= 60 ? 1 : 2);
      var key = npBin + '|' + ncBin;
      cells[key] = (cells[key] || 0) + 1;
    });
    var labelsNP = ['NP Bajo', 'NP Medio', 'NP Alto'];
    var labelsNC = ['NC Bajo', 'NC Medio', 'NC Alto'];

    var html = '<div class="km-prior-card">' +
      '<div class="km-prior-card__header">' +
        '<span class="km-prior-card__title"><i class="bi bi-grid-3x3"></i> Matriz de calor NP × NC</span>' +
        '<span class="km-prior-card__count">' + all.length + ' peligros</span>' +
      '</div>' +
      '<div style="padding:16px;"><table style="width:100%;border-collapse:separate;border-spacing:8px;">' +
      '<thead><tr><th></th>';
    labelsNC.forEach(function (l) { html += '<th style="font-size:0.75rem;font-weight:600;color:var(--km-text-muted);padding:8px;">' + l + '</th>'; });
    html += '</tr></thead><tbody>';
    for (var i = 0; i < 3; i++) {
      html += '<tr><th style="font-size:0.75rem;font-weight:600;color:var(--km-text-muted);text-align:right;padding:8px;">' + labelsNP[i] + '</th>';
      for (var j = 0; j < 3; j++) {
        var c = cells[i + '|' + j] || 0;
        var bg = c === 0 ? '#f8fafc' : (j === 2 && i === 2 ? '#fee2e2' : (j >= 1 || i >= 1) ? '#fff8e1' : '#d4edda');
        html += '<td style="background:' + bg + ';border-radius:8px;padding:24px;text-align:center;font-size:1.5rem;font-weight:700;">' + c + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div></div>';
    return html;
  }

  function _render() {
    var container = document.getElementById('km-view-priorizacion');
    if (!container) return;
    var all = _flattenPeligros(_matriz);
    /* 📦447 — Pasamos `all` a _renderLeyenda para que pueda calcular los
       conteos por nivel y mostrarlos junto a cada botón de filtro. */
    var html = '<div class="km-prior-body">' + _renderLeyenda(all) + _renderSubTabs();
    if (_activeTab === 'semaforo') html += _renderSemaforo(all);
    else html += _renderHeatmap(all);
    html += '</div>';
    container.innerHTML = html;

    /* Sub-tabs */
    container.querySelectorAll('.km-prior-tab').forEach(function (t) {
      t.addEventListener('click', function () { _activeTab = t.getAttribute('data-tab'); _render(); });
    });

    /* 📦447 (2026-06-25) — Handlers de los botones de filtro de la leyenda.
       Click en un nivel: activa/desactiva el filtro (toggle).
       Click en "Todos" o en el banner X: limpia el filtro.
       Usamos un solo listener delegado por contenedor (más eficiente y
       más simple que N listeners individuales). */
    container.querySelectorAll('.km-leyenda__btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var lvl = b.getAttribute('data-level');
        /* Toggle: si ya está activo el mismo nivel, lo desactiva (vuelve
           a null = "Todos"). Si es otro nivel o null, lo aplica. */
        _activeLevel = (lvl === '') ? null : (_activeLevel === lvl ? null : lvl);
        _render();
      });
    });
    /* Botones de "quitar filtro" dentro del banner o empty state */
    container.querySelectorAll('[data-clear-filter]').forEach(function (b) {
      b.addEventListener('click', function () { _activeLevel = null; _render(); });
    });
  }

  PriorizacionView.load = function (companyName) {
    _companyName = companyName;
    var container = document.getElementById('km-view-priorizacion');
    if (!container) return;
    container.innerHTML = '<div class="km-empty"><div class="km-kpi__icon"><i class="bi bi-arrow-clockwise"></i></div><p>Cargando priorización...</p></div>';
    global.KMService.read(companyName).then(function (r) {
      if (r && r.success && r.data && r.data.matriz) {
        _matriz = r.data.matriz;
        _render();
      } else {
        container.innerHTML = '<div class="km-empty"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3></div>';
      }
    });
  };

  PriorizacionView.refresh = function () { if (_companyName) PriorizacionView.load(_companyName); };
  /* 📦447 — destroy limpia también el estado del filtro para que al
     recargar la vista (cambio de empresa o reload) no quede un filtro
     residual que filtre resultados inesperados. */
  PriorizacionView.destroy = function () { _matriz = null; _companyName = null; _activeLevel = null; _activeTab = 'semaforo'; };

  global.KMPriorizacionView = PriorizacionView;
})(window);
