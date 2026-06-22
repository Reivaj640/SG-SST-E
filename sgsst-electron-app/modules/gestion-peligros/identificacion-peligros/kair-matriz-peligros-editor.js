/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
editor.js — Editor de peligro: modal centrado (no fullscreen) con form simple
API: window.KMEditor.open({ mode, cargoId, peligroId, data, companyName, onSaved })
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;

  var Editor = {};
  var _state = null;
  var _escHandler = null;

  function _esc(s) { return KM.esc(s); }

  function _buildSelect(name, options, required, current) {
    var html = '<option value="">— Seleccione —</option>';
    (options || []).forEach(function (o) {
      var v = o.value != null ? String(o.value) : o.label;
      var sel = (v === String(current)) ? ' selected' : '';
      html += '<option value="' + _esc(v) + '"' + sel + '>' + _esc(o.label) + '</option>';
    });
    return html;
  }

  function _renderBody() {
    var d = _state.data;
    var opts = _state.gtc45Options || KM.GTC45;
    var ndOpts = (opts.nd || []).map(function (o) { return { value: o.value, label: o.label }; });
    var neOpts = (opts.ne || []).map(function (o) { return { value: o.value, label: o.label }; });
    var ncOpts = (opts.nc || []).map(function (o) { return { value: o.value, label: o.label }; });
    var tiposOpts = (opts.tipos || []).map(function (t) { return { value: t, label: t }; });

    var np = KM.calcNP(d.nd, d.ne);
    var nr = KM.calcNR(np, d.nc);
    var npInterp = KM.interpNP(np);
    var nrInterp = KM.interpNR(nr);

    return '<div class="km-editor-form-grid">' +
      '<div class="km-editor-field km-editor-field--full">' +
        '<label class="km-editor-field__label">Tipo de peligro <span class="km-editor-field__required">*</span></label>' +
        '<select class="km-editor-field__select" name="tipo" required>' + _buildSelect('tipo', tiposOpts, true, d.tipo) + '</select>' +
      '</div>' +
      '<div class="km-editor-field km-editor-field--full">' +
        '<label class="km-editor-field__label">Descripción del peligro <span class="km-editor-field__required">*</span></label>' +
        '<input class="km-editor-field__input" name="peligro" type="text" value="' + _esc(d.peligro) + '" required>' +
      '</div>' +
      '<div class="km-editor-field km-editor-field--full">' +
        '<label class="km-editor-field__label">Efectos posibles <span class="km-editor-field__required">*</span></label>' +
        '<textarea class="km-editor-field__textarea" name="efectosPosibles" rows="2">' + _esc(d.efectosPosibles) + '</textarea>' +
      '</div>' +
      '<div class="km-editor-field">' +
        '<label class="km-editor-field__label">ND <span class="km-editor-field__required">*</span></label>' +
        '<select class="km-editor-field__select" name="nd" required>' + _buildSelect('nd', ndOpts, true, d.nd) + '</select>' +
      '</div>' +
      '<div class="km-editor-field">' +
        '<label class="km-editor-field__label">NE <span class="km-editor-field__required">*</span></label>' +
        '<select class="km-editor-field__select" name="ne" required>' + _buildSelect('ne', neOpts, true, d.ne) + '</select>' +
      '</div>' +
      '<div class="km-editor-field">' +
        '<label class="km-editor-field__label">NC <span class="km-editor-field__required">*</span></label>' +
        '<select class="km-editor-field__select" name="nc" required>' + _buildSelect('nc', ncOpts, true, d.nc) + '</select>' +
      '</div>' +
      '<div class="km-editor-field">' +
        '<label class="km-editor-field__label">Expuestos</label>' +
        '<input class="km-editor-field__input" name="expuestos" type="number" value="' + _esc(d.expuestos) + '">' +
      '</div>' +
      '<div class="km-editor-field km-editor-field--full" style="background:#f8fafc;padding:12px;border-radius:8px;">' +
        '<div style="display:flex;gap:16px;align-items:center;justify-content:space-between;">' +
          '<div><div style="font-size:0.7rem;text-transform:uppercase;color:var(--km-text-muted);font-weight:600;">NP = ND × NE</div><div style="font-size:1.5rem;font-weight:700;">' + (np != null ? np : '—') + '</div><div style="font-size:0.75rem;color:var(--km-text-muted);">' + (npInterp.label || '—') + '</div></div>' +
          '<div><div style="font-size:0.7rem;text-transform:uppercase;color:var(--km-text-muted);font-weight:600;">NR = NP × NC</div><div style="font-size:1.5rem;font-weight:700;color:' + (nrInterp.tone === 'danger' ? '#b71c1c' : '#1a1a2e') + '">' + (nr != null ? nr : '—') + '</div><div style="font-size:0.75rem;color:var(--km-text-muted);">Nivel ' + (nrInterp.nivel || '—') + ' · ' + (nrInterp.label || '—') + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="km-editor-field">' +
        '<label class="km-editor-field__label">Responsable</label>' +
        '<input class="km-editor-field__input" name="responsable" type="text" value="' + _esc(d.responsable) + '">' +
      '</div>' +
      '<div class="km-editor-field">' +
        '<label class="km-editor-field__label">Plazo</label>' +
        '<input class="km-editor-field__input" name="plazo" type="text" value="' + _esc(d.plazo) + '" placeholder="2026-Q3">' +
      '</div>' +
      '<div class="km-editor-field km-editor-field--full">' +
        '<label class="km-editor-field__label">Medidas de intervención</label>' +
        '<textarea class="km-editor-field__textarea" name="medidaIntervencion" rows="3" placeholder="Eliminación, sustitución, ingeniería, administrativos, EPP...">' + _esc(d.medidaIntervencion) + '</textarea>' +
      '</div>' +
      '<div class="km-editor-field km-editor-field--full">' +
        '<label class="km-editor-field__label">Observaciones</label>' +
        '<textarea class="km-editor-field__textarea" name="observaciones" rows="2">' + _esc(d.observaciones) + '</textarea>' +
      '</div>' +
    '</div>';
  }

  function _handleSave() {
    if (!_state.companyName) { KM.notify('No hay empresa activa', 'Selecciona una empresa', 'error', 6000); return; }
    var saveBtn = document.querySelector('#km-editor-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }
    var overlay = document.getElementById('km-editor-modal-overlay');
    var inputs = overlay.querySelectorAll('[name]');
    inputs.forEach(function (el) { _state.data[el.getAttribute('name')] = el.value; });

    var np = KM.calcNP(_state.data.nd, _state.data.ne);
    var nr = KM.calcNR(np, _state.data.nc);
    var interpNp = KM.interpNP(np);
    var interpNr = KM.interpNR(nr);

    var payload = Object.assign({}, _state.data, {
      np: np, nr: nr,
      npInterpretacion: interpNp.label,
      nrNivel: interpNr.nivel,
      nrLabel: interpNr.label,
      updatedAt: new Date().toISOString()
    });

    var p;
    if (_state.mode === 'edit' && _state.data.id) {
      p = global.KMService.updatePeligro(_state.companyName, _state.data.id, payload);
    } else {
      if (!_state.cargoId) { KM.notify('Selecciona un cargo', 'Para crear un peligro necesitas un cargo activo', 'error', 6000); if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; } return; }
      payload.createdAt = new Date().toISOString();
      p = global.KMService.addPeligro(_state.companyName, _state.cargoId, payload);
    }

    p.then(function (r) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; }
      if (r && r.success) {
        var savedId = (r.data && r.data.id) ? r.data.id : '';
        KM.notify(
          _state.mode === 'edit' ? 'Peligro actualizado' : 'Peligro creado',
          savedId ? ('ID: ' + savedId) : '',
          'success'
        );
        try { document.dispatchEvent(new CustomEvent('km:peligros-changed')); } catch (e) {}
        close();
        if (typeof _state.onSaved === 'function') _state.onSaved(r.data);
      } else {
        KM.notify('Error al guardar', (r && r.error && r.error.message) || 'Error desconocido', 'error', 6000);
      }
    }).catch(function (err) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; }
      KM.notify('Error inesperado', (err && err.message) || 'Sin detalles', 'error', 6000);
    });
  }

  function close() {
    var overlay = document.getElementById('km-editor-modal-overlay');
    if (overlay) overlay.remove();
    if (_escHandler) { document.removeEventListener('keydown', _escHandler); _escHandler = null; }
    _state = null;
  }

  function _bindLiveUpdate() {
    var overlay = document.getElementById('km-editor-modal-overlay');
    if (!overlay) return;
    overlay.querySelectorAll('select[name="nd"], select[name="ne"], select[name="nc"]').forEach(function (el) {
      el.addEventListener('change', function () {
        // Re-render preview
        var d = _state.data;
        d.nd = overlay.querySelector('[name="nd"]').value;
        d.ne = overlay.querySelector('[name="ne"]').value;
        d.nc = overlay.querySelector('[name="nc"]').value;
        var previewField = overlay.querySelector('.km-editor-field--full[style*="background"]');
        if (previewField) {
          var np = KM.calcNP(d.nd, d.ne);
          var nr = KM.calcNR(np, d.nc);
          var npInterp = KM.interpNP(np);
          var nrInterp = KM.interpNR(nr);
          previewField.innerHTML = '<div style="display:flex;gap:16px;align-items:center;justify-content:space-between;">' +
            '<div><div style="font-size:0.7rem;text-transform:uppercase;color:var(--km-text-muted);font-weight:600;">NP = ND × NE</div><div style="font-size:1.5rem;font-weight:700;">' + (np != null ? np : '—') + '</div><div style="font-size:0.75rem;color:var(--km-text-muted);">' + (npInterp.label || '—') + '</div></div>' +
            '<div><div style="font-size:0.7rem;text-transform:uppercase;color:var(--km-text-muted);font-weight:600;">NR = NP × NC</div><div style="font-size:1.5rem;font-weight:700;color:' + (nrInterp.tone === 'danger' ? '#b71c1c' : '#1a1a2e') + '">' + (nr != null ? nr : '—') + '</div><div style="font-size:0.75rem;color:var(--km-text-muted);">Nivel ' + (nrInterp.nivel || '—') + ' · ' + (nrInterp.label || '—') + '</div></div>' +
            '</div>';
        }
      });
    });
  }

  Editor.open = function (opts) {
    opts = opts || {};
    if (document.getElementById('km-editor-modal-overlay')) return;
    var data = Object.assign({}, opts.data || {});
    if (opts.peligroId && !data.id) data.id = opts.peligroId;
    _state = {
      companyName: opts.companyName || null,
      cargoId: opts.cargoId || null,
      mode: opts.mode || 'new',
      data: data,
      gtc45Options: opts.gtc45Options || null,
      onSaved: opts.onSaved || null
    };

    var isEdit = _state.mode === 'edit';
    var overlay = document.createElement('div');
    overlay.id = 'km-editor-modal-overlay';
    overlay.className = 'km-editor-overlay';
    overlay.innerHTML =
      '<div class="km-editor-modal">' +
        '<div class="km-editor-modal__header">' +
          '<h3 class="km-editor-modal__title">' + (isEdit ? 'Editar peligro' : 'Nuevo peligro') + '</h3>' +
          '<button type="button" class="km-editor-modal__close" title="Cerrar"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="km-editor-modal__body">' + _renderBody() + '</div>' +
        '<div class="km-editor-modal__footer">' +
          '<button type="button" class="km-btn km-btn--ghost" id="km-editor-cancel">Cancelar</button>' +
          '<button type="button" class="km-btn km-btn--primary" id="km-editor-save"><i class="bi bi-save"></i> Guardar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var ready = Promise.resolve();
    if (!_state.gtc45Options) {
      ready = global.KMService.gtc45Options().then(function (r) { if (r && r.success && r.data) _state.gtc45Options = r.data; }).catch(function () {});
    }
    ready.then(function () {
      var body = overlay.querySelector('.km-editor-modal__body');
      if (body) body.innerHTML = _renderBody();
      _bindLiveUpdate();
    });

    overlay.querySelector('.km-editor-modal__close').addEventListener('click', close);
    var cancelBtn = overlay.querySelector('#km-editor-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    var saveBtn = overlay.querySelector('#km-editor-save');
    if (saveBtn) saveBtn.addEventListener('click', _handleSave);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    if (_escHandler) document.removeEventListener('keydown', _escHandler);
    _escHandler = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', _escHandler);
  };

  Editor.close = close;
  global.KMEditor = Editor;
})(window);
