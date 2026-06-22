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

  function _renderLeyenda() {
    return '<div class="km-leyenda">' +
      '<span class="km-leyenda__label">LEYENDA:</span>' +
      '<span class="km-leyenda__item"><span class="km-leyenda__dot km-leyenda__dot--I"></span> Nivel I - No aceptable (CRÍTICO)</span>' +
      '<span class="km-leyenda__item"><span class="km-leyenda__dot km-leyenda__dot--II"></span> Nivel II - Aceptable con control (ALTO)</span>' +
      '<span class="km-leyenda__item"><span class="km-leyenda__dot km-leyenda__dot--III"></span> Nivel III - Aceptable (MEDIO)</span>' +
      '<span class="km-leyenda__item"><span class="km-leyenda__dot km-leyenda__dot--IV"></span> Nivel IV - Aceptable (BAJO)</span>' +
    '</div>';
  }

  function _renderSubTabs() {
    return '<div class="km-prior-tabs">' +
      '<button type="button" class="km-prior-tab ' + (_activeTab === 'semaforo' ? 'km-prior-tab--active' : '') + '" data-tab="semaforo"><i class="bi bi-list-ol"></i> Tabla semáforo</button>' +
      '<button type="button" class="km-prior-tab ' + (_activeTab === 'heatmap' ? 'km-prior-tab--active' : '') + '" data-tab="heatmap"><i class="bi bi-grid-3x3"></i> Matriz de calor 3x3</button>' +
    '</div>';
  }

  function _renderSemaforo(all) {
    var ordenados = all.slice().sort(function (a, b) { return (b.nr || 0) - (a.nr || 0); });
    var html = '<div class="km-prior-card">' +
      '<div class="km-prior-card__header">' +
        '<span class="km-prior-card__title"><i class="bi bi-list-ol"></i> Peligros priorizados por nivel de riesgo</span>' +
        '<span class="km-prior-card__count">' + ordenados.length + ' peligros · ordenados por NR descendente</span>' +
      '</div>' +
      '<div class="km-table-wrapper"><table class="km-table"><thead><tr>' +
        '<th>#</th><th>ID</th><th>SEDE</th><th>PELIGRO</th><th>ACTIVIDAD</th><th>CLASIFICACIÓN</th>' +
        '<th>NP</th><th>NC</th><th>NR</th><th>NIVEL</th><th>ACEPTABILIDAD</th><th>EXP.</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < ordenados.length; i++) {
      var p = ordenados[i];
      var nrCls = p.nrTone === 'danger' ? ' km-table__nr--high' : '';
      html += '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td><span class="km-table__id">' + KM.esc(p.id) + '</span></td>' +
        '<td>' + KM.esc(p.sede) + '</td>' +
        '<td class="km-table__cell-peligro">' + KM.esc(p.peligro || '—') + '</td>' +
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
    html += '</tbody></table></div></div>';
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
    var html = '<div class="km-prior-body">' + _renderLeyenda() + _renderSubTabs();
    if (_activeTab === 'semaforo') html += _renderSemaforo(all);
    else html += _renderHeatmap(all);
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.km-prior-tab').forEach(function (t) {
      t.addEventListener('click', function () { _activeTab = t.getAttribute('data-tab'); _render(); });
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
  PriorizacionView.destroy = function () { _matriz = null; _companyName = null; };

  global.KMPriorizacionView = PriorizacionView;
})(window);
