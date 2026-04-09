/* ==========================================================================
   K+AIR Evaluación de Selección — Módulo 2.10.1
   ========================================================================== */

(function () {
  'use strict';

  var selectedAsociadoId = null;
  var selectedScores = {};

  function load() {
    populateAsociadoDropdown();
    renderMatrix();
    renderResult();
    setupEvents();
  }

  function populateAsociadoDropdown() {
    var select = document.getElementById('kair-es-eval-asociado');
    if (!select) return;
    var asociados = window.AsociadosServiceES.getWithoutSelectionEval();
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
    renderResult();
  }

  function setupEvents() {
    var select = document.getElementById('kair-es-eval-asociado');
    if (select) {
      select.addEventListener('change', function (e) {
        selectedAsociadoId = e.target.value || null;
        selectedScores = {};
        renderAsociadoInfo();
        renderMatrix();
        renderResult();
      });
    }
    var saveBtn = document.getElementById('kair-es-eval-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () { saveEvaluation(); });
  }

  function renderAsociadoInfo() {
    var container = document.getElementById('kair-es-eval-asociado-info');
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

  function renderMatrix() {
    var container = document.getElementById('kair-es-eval-matrix');
    if (!container) return;
    if (!selectedAsociadoId) { container.innerHTML = ''; return; }
    var criteria = window.KAIRUtils.getSelectionCriteria();
    var moduleRef = window.EvaluacionModuleES;
    var rows = criteria.map(function (c, i) {
      return '<tr>' +
        '<td><div class="kair-eval-matrix__criteria"><span class="kair-eval-matrix__criteria-num">' + (i + 1) + '</span>' + c.label + '</div></td>' +
        '<td><div class="kair-eval-matrix__desc">' + c.desc1 + '</div></td>' +
        '<td><div class="kair-eval-matrix__desc">' + c.desc3 + '</div></td>' +
        '<td><div class="kair-eval-matrix__desc">' + c.desc5 + '</div></td>' +
        '<td class="kair-eval-matrix__score-cell"><div class="kair-radio-cards">' +
          '<label class="kair-radio-card' + (selectedScores[c.key] === 1 ? ' kair-radio-card--selected' : '') + '" onclick="window.EvaluacionModuleES.selectScore(\'' + c.key + '\', 1)"><input type="radio" name="es_eval_' + c.key + '" value="1"' + (selectedScores[c.key] === 1 ? ' checked' : '') + '><span class="kair-radio-card__value">1</span></label>' +
          '<label class="kair-radio-card' + (selectedScores[c.key] === 3 ? ' kair-radio-card--selected' : '') + '" onclick="window.EvaluacionModuleES.selectScore(\'' + c.key + '\', 3)"><input type="radio" name="es_eval_' + c.key + '" value="3"' + (selectedScores[c.key] === 3 ? ' checked' : '') + '><span class="kair-radio-card__value">3</span></label>' +
          '<label class="kair-radio-card' + (selectedScores[c.key] === 5 ? ' kair-radio-card--selected' : '') + '" onclick="window.EvaluacionModuleES.selectScore(\'' + c.key + '\', 5)"><input type="radio" name="es_eval_' + c.key + '" value="5"' + (selectedScores[c.key] === 5 ? ' checked' : '') + '><span class="kair-radio-card__value">5</span></label>' +
        '</div></td></tr>';
    });
    container.innerHTML = '<div class="kair-eval-matrix"><div class="kair-eval-matrix__header">Matriz de Evaluación de Selección</div>' +
      '<table class="kair-eval-matrix__table"><thead><tr><th>Criterio</th><th>Puntaje 1</th><th>Puntaje 3</th><th>Puntaje 5</th><th>Seleccionar</th></tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function selectScore(criteriaKey, value) {
    selectedScores[criteriaKey] = value;
    renderMatrix();
    renderResult();
  }

  function renderResult() {
    var container = document.getElementById('kair-es-eval-result');
    if (!container) return;
    if (!selectedAsociadoId || Object.keys(selectedScores).length === 0) { container.innerHTML = ''; return; }

    var criteria = window.KAIRUtils.getSelectionCriteria();
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

    var actionMsg = cls === 'bueno' ? 'El asociado cumple con los requisitos mínimos de selección. Se puede proceder con la vinculación.' :
      cls === 'regular' ? 'El asociado requiere un plan de acción para mejorar los aspectos deficientes. Se permite la vinculación condicionada al cumplimiento del plan de mejora.' :
      'El asociado no cumple con los requisitos mínimos. No se recomienda su vinculación. Se debe notificar y dar oportunidad de mejoramiento.';

    var alertHtml = cls !== 'bueno' ?
      '<div class="kair-alert kair-alert--' + (cls === 'regular' ? 'warning' : 'danger') + ' kair-mt-4">' +
        '<span class="kair-alert__icon">' + (cls === 'regular' ? '\u26A0' : '\u2715') + '</span>' +
        '<span class="kair-alert__content">' +
          (cls === 'regular' ? 'Se requiere elaborar un plan de acción con cronograma de mejoramiento antes de 30 días.' : 'Asociado rechazado. Se debe informar al proveedor/contratista los motivos del rechazo.') +
        '</span></div>' : '';

    container.innerHTML = '<div class="kair-eval-result">' +
      '<div class="kair-eval-result__score-circle kair-eval-result__score-circle--' + cls + '"><span class="kair-eval-result__score-value">' + avg.toFixed(1) + '</span><span class="kair-eval-result__score-label">de 5.0</span></div>' +
      '<div class="kair-eval-result__details">' +
        '<div class="kair-eval-result__classification kair-eval-result__classification--' + cls + '">' + window.KAIRUtils.getClasificacionLabel(clasificacion) + '</div>' +
        '<div class="kair-eval-result__message">' + actionMsg + '</div>' +
        alertHtml +
      '</div></div>';
  }

  function saveEvaluation() {
    if (!selectedAsociadoId) { window.KAIRUtils.showToast('Seleccione un asociado primero', 'warning'); return; }
    var criteria = window.KAIRUtils.getSelectionCriteria();
    var criteriaKeys = criteria.map(function (c) { return c.key; });
    var allSelected = criteriaKeys.every(function (k) { return selectedScores[k] !== undefined; });
    if (!allSelected) { window.KAIRUtils.showToast('Debe calificar todos los criterios', 'warning'); return; }

    var obsEl = document.getElementById('kair-es-eval-observaciones');
    var observaciones = obsEl ? obsEl.value.trim() : '';

    window.EvaluacionesServiceES.createSelectionEval({
      asociadoId: selectedAsociadoId,
      criterios: Object.assign({}, selectedScores),
      observaciones: observaciones,
    });

    var avg = window.KAIRUtils.average(criteriaKeys.map(function (k) { return selectedScores[k]; }));
    var clasificacion = window.KAIRUtils.classifyScore(avg);
    window.KAIRUtils.showToast('Evaluación guardada — ' + window.KAIRUtils.getClasificacionLabel(clasificacion) + ' (' + avg.toFixed(1) + ')', clasificacion === 'BUENO' ? 'success' : 'warning');

    selectedAsociadoId = null;
    selectedScores = {};
    var selEl = document.getElementById('kair-es-eval-asociado');
    if (selEl) selEl.value = '';
    var obsEl2 = document.getElementById('kair-es-eval-observaciones');
    if (obsEl2) obsEl2.value = '';
    populateAsociadoDropdown();
    renderAsociadoInfo();
    renderMatrix();
    renderResult();
  }

  window.EvaluacionModuleES = { load: load, selectScore: selectScore };
})();
