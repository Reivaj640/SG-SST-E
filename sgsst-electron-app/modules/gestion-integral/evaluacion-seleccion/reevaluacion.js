/* ==========================================================================
   K+AIR Reevaluación Anual — Módulo 2.10.1
   ========================================================================== */

(function () {
  'use strict';

  var selectedAsociadoId = null;
  var selectedScores = {};

  function load() {
    populateAsociadoDropdown();
    renderHistory();
    renderMatrix();
    renderResult();
    setupEvents();
  }

  function populateAsociadoDropdown() {
    var select = document.getElementById('kair-es-reeval-asociado');
    if (!select) return;
    var asociados = window.AsociadosServiceES.getWithSelectionEval();
    select.innerHTML = '<option value="">-- Seleccione un asociado --</option>';
    asociados.forEach(function (a) {
      var opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.razonSocial + ' (' + a.nit + ') — ' + window.KAIRUtils.getTipoLabel(a.tipo);
      select.appendChild(opt);
    });
    selectedAsociadoId = null;
    selectedScores = {};
    renderAsociadoInfo();
    renderHistory();
    renderMatrix();
    renderResult();
  }

  function setupEvents() {
    var select = document.getElementById('kair-es-reeval-asociado');
    if (select) {
      select.addEventListener('change', function (e) {
        selectedAsociadoId = e.target.value || null;
        selectedScores = {};
        renderAsociadoInfo();
        renderHistory();
        renderMatrix();
        renderResult();
      });
    }
    var saveBtn = document.getElementById('kair-es-reeval-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () { saveReevaluation(); });
  }

  function renderAsociadoInfo() {
    var container = document.getElementById('kair-es-reeval-asociado-info');
    if (!container) return;
    if (!selectedAsociadoId) { container.innerHTML = ''; return; }
    var asociado = window.AsociadosServiceES.getById(selectedAsociadoId);
    if (!asociado) { container.innerHTML = ''; return; }
    container.innerHTML =
      '<div class="kair-asociado-info">' +
        '<div class="kair-asociado-info__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>' +
        '<div class="kair-asociado-info__details">' +
          '<div class="kair-asociado-info__name">' + window.KAIRUtils.escapeHtml(asociado.razonSocial) + '</div>' +
          '<div class="kair-asociado-info__meta">' + window.KAIRUtils.getTipoLabel(asociado.tipo) + ' · NIT: ' + window.KAIRUtils.escapeHtml(asociado.nit) + ' · ' + window.KAIRUtils.escapeHtml(asociado.producto) + '</div>' +
        '</div>' +
        '<span class="kair-badge kair-badge--primary">' + window.KAIRUtils.getTipoLabel(asociado.tipo) + '</span>' +
      '</div>';
  }

  function renderHistory() {
    var container = document.getElementById('kair-es-reeval-history');
    if (!container) return;
    if (!selectedAsociadoId) { container.innerHTML = ''; return; }

    var selEvals = window.EvaluacionesServiceES.getSelectionEvalByAsociado(selectedAsociadoId);
    var reevals = window.EvaluacionesServiceES.getReevaluationsByAsociado(selectedAsociadoId);
    var all = selEvals.map(function (e) { return Object.assign({}, e, { tipoLabel: 'Selección' }); })
      .concat(reevals.map(function (r) { return Object.assign({}, r, { tipoLabel: 'Reevaluación' }); }))
      .sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); });

    if (all.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = '<div class="kair-card kair-mb-6"><div class="kair-card__header"><span class="kair-card__title">Historial de Evaluaciones</span></div><div class="kair-card__body">' +
      all.map(function (ev) {
        var trendHtml = '';
        if (ev.tendencia) {
          var info = window.KAIRUtils.getTrendInfo(ev.tendencia);
          trendHtml = '<span class="kair-trend ' + info.color + '">' + info.icon + ' ' + info.label + '</span>';
        }
        return '<div class="kair-history__item">' +
          '<span class="kair-history__date">' + window.KAIRUtils.formatDate(ev.fecha) + '</span>' +
          '<span class="kair-history__type">' + ev.tipoLabel + '</span>' +
          '<span class="kair-history__score kair-text-' + (ev.clasificacion === 'BUENO' ? 'success' : ev.clasificacion === 'REGULAR' ? 'warning' : 'danger') + '">' + ev.puntajeTotal + '</span>' +
          '<span class="kair-history__classification"><span class="kair-badge ' + window.KAIRUtils.getClasificacionBadgeClass(ev.clasificacion) + '">' + window.KAIRUtils.getClasificacionLabel(ev.clasificacion) + '</span></span>' +
          trendHtml + '</div>';
      }).join('') +
    '</div></div>';
  }

  function renderMatrix() {
    var container = document.getElementById('kair-es-reeval-matrix');
    if (!container) return;
    if (!selectedAsociadoId) { container.innerHTML = ''; return; }

    var asociado = window.AsociadosServiceES.getById(selectedAsociadoId);
    var isContratista = asociado && asociado.tipo === 'CONTRATISTA';
    var criteria = window.KAIRUtils.getReevaluationCriteria().filter(function (c) { return !c.onlyContratista || isContratista; });
    var moduleRef = window.ReevaluacionModuleES;

    var rows = criteria.map(function (c, i) {
      return '<tr' + (c.onlyContratista ? ' class="kair-reeval-sst-row"' : '') + '>' +
        '<td><div class="kair-eval-matrix__criteria"><span class="kair-eval-matrix__criteria-num">' + (i + 1) + '</span>' + c.label + (c.onlyContratista ? ' <span class="kair-badge kair-badge--info">Solo Contratistas</span>' : '') + '</div></td>' +
        '<td><div class="kair-eval-matrix__desc">' + c.desc1 + '</div></td>' +
        '<td><div class="kair-eval-matrix__desc">' + c.desc3 + '</div></td>' +
        '<td><div class="kair-eval-matrix__desc">' + c.desc5 + '</div></td>' +
        '<td class="kair-eval-matrix__score-cell"><div class="kair-radio-cards">' +
          '<label class="kair-radio-card' + (selectedScores[c.key] === 1 ? ' kair-radio-card--selected' : '') + '" onclick="window.ReevaluacionModuleES.selectScore(\'' + c.key + '\', 1)"><input type="radio" name="es_reeval_' + c.key + '" value="1"' + (selectedScores[c.key] === 1 ? ' checked' : '') + '><span class="kair-radio-card__value">1</span></label>' +
          '<label class="kair-radio-card' + (selectedScores[c.key] === 3 ? ' kair-radio-card--selected' : '') + '" onclick="window.ReevaluacionModuleES.selectScore(\'' + c.key + '\', 3)"><input type="radio" name="es_reeval_' + c.key + '" value="3"' + (selectedScores[c.key] === 3 ? ' checked' : '') + '><span class="kair-radio-card__value">3</span></label>' +
          '<label class="kair-radio-card' + (selectedScores[c.key] === 5 ? ' kair-radio-card--selected' : '') + '" onclick="window.ReevaluacionModuleES.selectScore(\'' + c.key + '\', 5)"><input type="radio" name="es_reeval_' + c.key + '" value="5"' + (selectedScores[c.key] === 5 ? ' checked' : '') + '><span class="kair-radio-card__value">5</span></label>' +
        '</div></td></tr>';
    });

    container.innerHTML = '<div class="kair-eval-matrix"><div class="kair-eval-matrix__header">Matriz de Reevaluación Anual</div>' +
      '<div class="kair-eval-ranges kair-mt-2">' +
        '<span class="kair-eval-range kair-eval-range--bueno"><span class="kair-eval-range__dot"></span> Bueno (3.1 - 5.0)</span>' +
        '<span class="kair-eval-range kair-eval-range--regular"><span class="kair-eval-range__dot"></span> Regular (2.6 - 3.0)</span>' +
        '<span class="kair-eval-range kair-eval-range--deficiente"><span class="kair-eval-range__dot"></span> Deficiente (1.0 - 2.5)</span>' +
      '</div>' +
      '<table class="kair-eval-matrix__table"><thead><tr><th>Criterio</th><th>Puntaje 1</th><th>Puntaje 3</th><th>Puntaje 5</th><th>Seleccionar</th></tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function selectScore(criteriaKey, value) {
    selectedScores[criteriaKey] = value;
    renderMatrix();
    renderResult();
  }

  function renderResult() {
    var container = document.getElementById('kair-es-reeval-result');
    if (!container) return;
    if (!selectedAsociadoId || Object.keys(selectedScores).length === 0) { container.innerHTML = ''; return; }

    var asociado = window.AsociadosServiceES.getById(selectedAsociadoId);
    var isContratista = asociado && asociado.tipo === 'CONTRATISTA';
    var criteria = window.KAIRUtils.getReevaluationCriteria().filter(function (c) { return !c.onlyContratista || isContratista; });
    var criteriaKeys = criteria.map(function (c) { return c.key; });
    var allSelected = criteriaKeys.every(function (k) { return selectedScores[k] !== undefined; });

    if (!allSelected) {
      var selected = Object.keys(selectedScores).length;
      container.innerHTML = '<div class="kair-alert kair-alert--info"><span class="kair-alert__icon">ℹ</span><span class="kair-alert__content"><span class="kair-alert__title">Evaluación incompleta</span>Ha seleccionado ' + selected + ' de ' + criteriaKeys.length + ' criterios.</span></div>';
      return;
    }

    var values = criteriaKeys.map(function (k) { return selectedScores[k]; });
    var avg = window.KAIRUtils.average(values);
    var clasificacion = window.KAIRUtils.classifyScore(avg);
    var cls = clasificacion.toLowerCase();

    var lastReeval = window.EvaluacionesServiceES.getLastReevaluation(selectedAsociadoId);
    var previousScore = null;
    if (!lastReeval) {
      var selEvals = window.EvaluacionesServiceES.getSelectionEvalByAsociado(selectedAsociadoId);
      if (selEvals.length > 0) previousScore = selEvals[selEvals.length - 1].puntajeTotal;
    } else {
      previousScore = lastReeval.puntajeTotal;
    }
    var trend = window.KAIRUtils.getTrend(avg, previousScore);

    var trendHtml = '';
    if (previousScore !== null) {
      var trendInfo = window.KAIRUtils.getTrendInfo(trend);
      trendHtml = '<div class="kair-trend ' + trendInfo.color + ' kair-mt-2">' + trendInfo.icon + ' ' + trendInfo.label + ' respecto a evaluación anterior (' + previousScore.toFixed(1) + ')</div>';
    }

    var message = cls === 'bueno' ? 'El asociado mantiene un desempeño satisfactorio. Se recomienda continuar con la vinculación.' :
      cls === 'regular' ? 'El asociado presenta deficiencias que requieren un plan de acción. Se debe dar seguimiento al cumplimiento.' :
      'El asociado no cumple con los estándares mínimos. Se debe evaluar la terminación del contrato y notificar al asociado.';

    container.innerHTML = '<div class="kair-eval-result">' +
      '<div class="kair-eval-result__score-circle kair-eval-result__score-circle--' + cls + '"><span class="kair-eval-result__score-value">' + avg.toFixed(1) + '</span><span class="kair-eval-result__score-label">de 5.0</span></div>' +
      '<div class="kair-eval-result__details">' +
        '<div class="kair-eval-result__classification kair-eval-result__classification--' + cls + '">' + window.KAIRUtils.getClasificacionLabel(clasificacion) + '</div>' +
        trendHtml +
        '<div class="kair-eval-result__message kair-mt-4">' + message + '</div>' +
      '</div></div>';
  }

  function saveReevaluation() {
    if (!selectedAsociadoId) { window.KAIRUtils.showToast('Seleccione un asociado primero', 'warning'); return; }
    var asociado = window.AsociadosServiceES.getById(selectedAsociadoId);
    var isContratista = asociado && asociado.tipo === 'CONTRATISTA';
    var criteria = window.KAIRUtils.getReevaluationCriteria().filter(function (c) { return !c.onlyContratista || isContratista; });
    var criteriaKeys = criteria.map(function (c) { return c.key; });
    var allSelected = criteriaKeys.every(function (k) { return selectedScores[k] !== undefined; });
    if (!allSelected) { window.KAIRUtils.showToast('Debe calificar todos los criterios', 'warning'); return; }

    var obsEl = document.getElementById('kair-es-reeval-observaciones');
    var observaciones = obsEl ? obsEl.value.trim() : '';

    window.EvaluacionesServiceES.createReevaluation({
      asociadoId: selectedAsociadoId, frecuencia: 'ANUAL',
      criterios: Object.assign({}, selectedScores), observaciones: observaciones,
    });

    var avg = window.KAIRUtils.average(criteriaKeys.map(function (k) { return selectedScores[k]; }));
    var clasificacion = window.KAIRUtils.classifyScore(avg);
    window.KAIRUtils.showToast('Reevaluación guardada — ' + window.KAIRUtils.getClasificacionLabel(clasificacion) + ' (' + avg.toFixed(1) + ')', clasificacion === 'BUENO' ? 'success' : 'warning');

    selectedAsociadoId = null; selectedScores = {};
    var selEl = document.getElementById('kair-es-reeval-asociado'); if (selEl) selEl.value = '';
    var obsEl2 = document.getElementById('kair-es-reeval-observaciones'); if (obsEl2) obsEl2.value = '';
    populateAsociadoDropdown();
  }

  window.ReevaluacionModuleES = { load: load, selectScore: selectScore };
})();
