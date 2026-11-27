// modules/gestion-humana/plantillas-editar/index.js
// 📦GPE · Editor de datos del documento antes de la firma electrónica.
//
// Qué resuelve: el paso entre "Generar documento" (ghCreateDocumento) y
// "Enviar a firma" (_firmarElectronico) NO permitía revisar ni corregir los
// datos del trabajador. Aquí queda ese eslabón: Gestión Humana ve los PUNTOS
// CLAVE del proceso de contratación (nombre, cédula, cargo, salario, fechas…),
// cambia los que necesite, agrega reemplazos de texto libre y desde el mismo
// diálogo puede EXPORTAR el archivo o ENVIARLO A FIRMA.
//
// Integración: FirmaElectronicaComponent abre este editor con GPEditor.open(...)
// (ver _abrirEditorDatos en firma-electronica/index.js). Este archivo NO toca
// IPCs existentes: reutiliza ghUpdateDocumento y ghAbrirDocumento tal cual.
//
// Persistencia: los cambios se guardan dentro de `contenido` (JSON del
// documento) bajo la llave `datosEditados`:
//   contenido = JSON.stringify({
//     tipoDocumento, generadoEn,
//     datosEditados: {
//       editadoEn, editadoPor,
//       valores:  { [clave]: valorFinal },      // solo los editados
//       reemplazos: [ { buscar, reemplazar } ]  // texto libre adicional
//     }
//   })
// El backend (proceso principal) aplica `valores` y `reemplazos` sobre el
// archivo del template al producir el PDF final del documento.
//
// Sin certificado digital: el envío a firma sigue siendo el flujo ya existente
// de firma-service (OTP / enlace remoto / firma dual).

(function () {
  'use strict';

  var COMPONENT = 'GPEditor';

  // ═══ Puntos clave del proceso de contratación ═══
  // La clave es estable (viaja en datosEditados.valores); el label es lo que
  // se muestra. Los valores los resuelve el caller (Firma Electrónica) con
  // los datos del trabajador y de la contratación activa.
  var KEY_FIELDS = [
    { key: 'TRABAJADOR_NOMBRE',        label: 'Nombre completo',     clave: true },
    { key: 'TRABAJADOR_CEDULA',        label: 'Cédula',              clave: true },
    { key: 'TRABAJADOR_CARGO',         label: 'Cargo',               clave: true },
    { key: 'TRABAJADOR_SALARIO',       label: 'Salario',             clave: true },
    { key: 'TRABAJADOR_FECHA_INGRESO', label: 'Fecha de ingreso',    clave: true },
    { key: 'TRABAJADOR_SEDE',          label: 'Sede',                clave: false },
    { key: 'TRABAJADOR_EMPRESA_USUARIA', label: 'Empresa usuaria (cliente)', clave: false },
    { key: 'DOC_TIPO',                 label: 'Tipo de documento',   clave: true },
    { key: 'EMPRESA_NOMBRE',           label: 'Razón social (empresa)', clave: true }
  ];

  function _toast() {
    if (window.parent && window.parent.GestionHumanaToast) return window.parent.GestionHumanaToast;
    if (window.GestionHumanaToast) return window.GestionHumanaToast;
    var k = (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
    if (k) return k;
    return { success: function () {}, error: function () {}, warning: function () {}, info: function () {}, show: function () {} };
  }

  function _escHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function GPEditor() {
    this._el = null;
    this._escHandler = null;
    this._opts = null;
  }

  GPEditor.prototype._isEdited = function (key) {
    var o = this._opts.ovr;
    return !!(o && Object.prototype.hasOwnProperty.call(o, key));
  };

  GPEditor.prototype._rowHtml = function (f) {
    var auto = this._opts.valoresAuto[f.key];
    var autoV = auto == null ? '' : String(auto);
    var edited = this._isEdited(f.key);
    var value = edited ? String(this._opts.ovr[f.key]) : autoV;
    return '<div class="gpe-row' + (f.clave ? ' gpe-row--key' : '') + (edited ? ' gpe-row--edited' : '') + '"' +
      ' data-key="' + _escHtml(f.key) + '" data-search="' + _escHtml(f.label.toLowerCase() + ' ' + value.toLowerCase()) + '">' +
      '<span class="gpe-row__label">' +
        (f.clave ? '<span class="gpe-row__star" title="Punto clave del proceso de contratación">★</span>' : '') +
        '<span title="' + _escHtml(f.label) + '">' + _escHtml(f.label) + '</span>' +
        (edited ? '<span class="gpe-row__editado">editado</span>' : '') +
      '</span>' +
      '<input class="gpe-row__input" data-gpe-field="' + _escHtml(f.key) + '" value="' + _escHtml(value) + '"' +
        ' placeholder="automático: ' + (autoV ? _escHtml(autoV) : '—') + '" />' +
      (edited
        ? '<button class="gpe-row__revert" data-gpe-revert="' + _escHtml(f.key) + '" type="button" title="Revertir al valor automático"><i class="fas fa-rotate-left"></i></button>'
        : '<span style="width:28px;flex:0 0 auto;"></span>') +
    '</div>';
  };

  GPEditor.prototype._reemplazoHtml = function (r, idx) {
    return '<div class="gpe-reemplazo" data-gpe-repl="' + idx + '">' +
      '<input class="gpe-reemplazo__find" data-gpe-repl-find value="' + _escHtml(r.buscar) + '" placeholder="Texto impreso en el documento…" />' +
      '<i class="fas fa-arrow-right gpe-reemplazo__arrow"></i>' +
      '<input class="gpe-reemplazo__replace" data-gpe-repl-replace value="' + _escHtml(r.reemplazar) + '" placeholder="Nuevo texto…" />' +
      '<button class="gpe-reemplazo__del" data-gpe-repl-del type="button" title="Quitar reemplazo"><i class="fas fa-trash"></i></button>' +
    '</div>';
  };

  GPEditor.prototype._renderBody = function () {
    var self = this;
    var o = this._opts;
    var editedCount = Object.keys(o.ovr || {}).length;
    var replCount = (o.reemplazos || []).filter(function (r) { return r.buscar && r.buscar.trim(); }).length;
    var total = KEY_FIELDS.length + (o.extraFields || []).length;

    var rows = KEY_FIELDS.concat(o.extraFields || []);
    var listHtml = rows.map(function (f) { return self._rowHtml(f); }).join('');

    return '' +
      '<div class="gpe-note gpe-note--info"><i class="fas fa-circle-info"></i><span>' +
        '<strong>Puntos clave ★</strong>: nombre, cédula, cargo, salario, fechas y razón social — los datos que ' +
        'casi siempre se ajustan en la contratación. Cualquier campo se puede editar; lo cambiado queda marcado ' +
        'y se revierte con el botón de flecha. Al guardar, el documento registra quién editó y qué cambió.</span></div>' +
      '<div class="gpe-field" style="margin-bottom:0.75rem;">' +
        '<label class="gpe-modal__sub" style="margin-bottom:0.25rem;font-weight:600;">Documento</label>' +
        '<div class="gpe-summary"><i class="fas fa-file-pdf" style="color:#174ea6;margin-right:0.375rem;"></i>' +
          '<strong>' + _escHtml(o.doc.titulo || 'Documento') + '</strong>' +
          (o.doc.nombreArchivo ? ' · ' + _escHtml(o.doc.nombreArchivo) : '') +
        '</div>' +
      '</div>' +
      '<div class="gpe-search"><i class="fas fa-search gpe-search__icon"></i>' +
        '<input class="gpe-search__input" data-gpe-search placeholder="Buscar un dato: nombre, cédula, cargo…" /></div>' +
      '<div class="gpe-chips" data-gpe-chips>' +
        '<button class="gpe-chip gpe-chip--on" data-gpe-chip="todos" type="button">Todos</button>' +
        '<button class="gpe-chip" data-gpe-chip="clave" type="button"><span class="gpe-chip__star">★</span> Puntos clave</button>' +
        '<button class="gpe-chip" data-gpe-chip="editados" type="button">Editados (' + editedCount + ')</button>' +
        '<button class="gpe-chip" data-gpe-chip="todos" type="button" style="visibility:hidden" aria-hidden="true"></button>' +
      '</div>' +
      '<div class="gpe-list" data-gpe-list>' +
        (listHtml || '<div class="gpe-empty">Sin datos para editar</div>') +
      '</div>' +
      '<div class="gpe-reemplazos">' +
        '<div class="gpe-reemplazos__head">' +
          '<span class="gpe-reemplazos__title"><i class="fas fa-pen-to-square"></i> Otros cambios de texto (' + replCount + ')</span>' +
          '<button class="gpe-btn gpe-btn--sm" data-gpe-add-repl type="button"><i class="fas fa-plus"></i> Agregar cambio</button>' +
        '</div>' +
        '<div data-gpe-repl-list>' + (o.reemplazos || []).map(function (r, i) { return self._reemplazoHtml(r, i); }).join('') + '</div>' +
        '<p class="gpe-modal__sub">Reemplaza texto impreso del documento (ej. cláusulas, ciudades, fechas específicas). Se aplica al archivo final, junto con los datos de arriba.</p>' +
      '</div>' +
      '<p class="gpe-modal__sub" style="margin-top:0.75rem;">Cambios guardados: <span data-gpe-saved-badge></span> · total de campos: ' + total + '</p>';
  };

  GPEditor.prototype._refresh = function () {
    var self = this;
    var list = this._el.querySelector('[data-gpe-list]');
    var o = this._opts;
    var rows = KEY_FIELDS.concat(o.extraFields || []);
    list.innerHTML = rows.map(function (f) { return self._rowHtml(f); }).join('');
    this._wireRows();
    var chips = this._el.querySelectorAll('[data-gpe-chip]');
    chips.forEach(function (c) {
      if (c.getAttribute('data-gpe-chip') === 'editados') {
        c.textContent = 'Editados (' + Object.keys(o.ovr).length + ')';
      }
      c.classList.toggle('gpe-chip--on', c.getAttribute('data-gpe-chip') === o.chip);
    });
    this._applyFilter();
    var replList = this._el.querySelector('[data-gpe-repl-list]');
    replList.innerHTML = (o.reemplazos || []).map(function (r, i) { return self._reemplazoHtml(r, i); }).join('');
    this._wireRepl();
    var badge = this._el.querySelector('[data-gpe-saved-badge]');
    if (badge) {
      badge.innerHTML = o.savedAt
        ? '<span class="gpe-saved-badge"><i class="fas fa-check"></i> ' + _escHtml(o.savedAt) + '</span>'
        : '<span style="color:#9ca3af;">sin cambios guardados aún</span>';
    }
  };

  GPEditor.prototype._applyFilter = function () {
    var self = this;
    var q = (this._el.querySelector('[data-gpe-search]').value || '').trim().toLowerCase();
    var chip = this._opts.chip || 'todos';
    var o = this._opts;
    var rows = KEY_FIELDS.concat(o.extraFields || []);
    this._el.querySelectorAll('.gpe-row').forEach(function (el) {
      var key = el.getAttribute('data-key');
      var f = rows.find(function (x) { return x.key === key; }) || { clave: false, label: key };
      var ok = true;
      if (chip === 'clave') ok = !!f.clave;
      else if (chip === 'editados') ok = self._isEdited(key);
      if (ok && q) ok = (el.getAttribute('data-search') || '').indexOf(q) !== -1;
      el.style.display = ok ? '' : 'none';
    });
  };

  GPEditor.prototype._wireRows = function () {
    var self = this;
    this._el.querySelectorAll('[data-gpe-field]').forEach(function (inp) {
      inp.onchange = function () {
        var key = inp.getAttribute('data-gpe-field');
        var rows = KEY_FIELDS.concat(self._opts.extraFields || []);
        var f = rows.find(function (x) { return x.key === key; });
        var auto = self._opts.valoresAuto[key];
        var autoV = auto == null ? '' : String(auto);
        var v = inp.value;
        if (String(v).trim() === '' || String(v) === autoV) {
          delete self._opts.ovr[key]; // vacío o igual al automático → vuelve al dato del expediente
          _toast().info('Dato revertido', f ? f.label + ': se restauró el valor automático.' : '');
        } else {
          self._opts.ovr[key] = v;
        }
        self._refresh();
      };
    });
    this._el.querySelectorAll('[data-gpe-revert]').forEach(function (btn) {
      btn.onclick = function () {
        var key = btn.getAttribute('data-gpe-revert');
        delete self._opts.ovr[key];
        self._refresh();
        _toast().info('Dato revertido', 'Se restauró el valor automático del expediente.');
      };
    });
  };

  GPEditor.prototype._wireRepl = function () {
    var self = this;
    this._el.querySelectorAll('.gpe-reemplazo').forEach(function (el) {
      var idx = Number(el.getAttribute('data-gpe-repl'));
      var find = el.querySelector('[data-gpe-repl-find]');
      var rep = el.querySelector('[data-gpe-repl-replace]');
      if (find) find.onchange = function () { self._opts.reemplazos[idx].buscar = find.value; };
      if (rep) rep.onchange = function () { self._opts.reemplazos[idx].reemplazar = rep.value; };
      var del = el.querySelector('[data-gpe-repl-del]');
      if (del) del.onclick = function () {
        self._opts.reemplazos.splice(idx, 1);
        self._refresh();
      };
    });
  };

  GPEditor.prototype._wireShell = function () {
    var self = this;
    this._el.querySelector('[data-gpe-search]').oninput = function () { self._applyFilter(); };
    this._el.querySelector('[data-gpe-chips]').onclick = function (ev) {
      var chip = ev.target.closest('[data-gpe-chip]');
      if (!chip) return;
      self._opts.chip = chip.getAttribute('data-gpe-chip');
      self._refresh();
    };
    this._el.querySelector('[data-gpe-add-repl]').onclick = function () {
      self._opts.reemplazos.push({ buscar: '', reemplazar: '' });
      self._refresh();
    };
    this._el.querySelector('[data-gpe-close]').onclick = function () { self.close(); };
    this._el.querySelector('[data-gpe-overlay]').onclick = function () { self.close(); };
    this._el.querySelector('[data-gpe-export]').onclick = function () { self._exportar(); };
    this._el.querySelector('[data-gpe-save]').onclick = function () { self._guardar(); };
    this._el.querySelector('[data-gpe-firmar]').onclick = function () { self._guardarYFirmar(); };
    this._escHandler = function (ev) {
      if (ev.key === 'Escape') self.close();
    };
    document.addEventListener('keydown', this._escHandler);
  };

  GPEditor.prototype._collectReemplazos = function () {
    var out = (this._opts.reemplazos || []).filter(function (r) {
      return r.buscar && r.buscar.trim();
    }).map(function (r) {
      return { buscar: String(r.buscar).trim(), reemplazar: String(r.reemplazar == null ? '' : r.reemplazar) };
    });
    return out;
  };

  GPEditor.prototype._exportar = async function () {
    var api = this._opts.electronAPI;
    if (!api || !this._opts.doc.id) return;
    if (api.ghAbrirDocumento) {
      var r = await api.ghAbrirDocumento({ documentoId: this._opts.doc.id });
      if (r && !r.success) {
        _toast().error('No se pudo exportar', (r.error && r.error.message || 'desconocido'));
      }
    }
  };

  GPEditor.prototype._payload = function () {
    var o = this._opts;
    // Contenido previo del documento (JSON con tipoDocumento, generadoEn…)
    var prev = {};
    try { prev = JSON.parse(o.doc.contenido || '{}') || {}; } catch (e) { prev = {}; }
    prev.datosEditados = {
      editadoEn: new Date().toISOString(),
      editadoPor: 'gestion-humana',
      valores: Object.assign({}, o.ovr),
      reemplazos: this._collectReemplazos()
    };
    return JSON.stringify(prev);
  };

  GPEditor.prototype._guardar = async function (btn) {
    var self = this;
    var api = this._opts.electronAPI;
    if (!api || !api.ghUpdateDocumento || !this._opts.doc.id) {
      _toast().error('No hay conexión con el backend');
      return;
    }
    var saveBtn = this._el.querySelector('[data-gpe-save]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…'; }
    try {
      var r = await api.ghUpdateDocumento({
        documentoId: this._opts.doc.id,
        updates: { contenido: this._payload() }
      });
      if (r && r.success) {
        this._opts.savedAt = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        this._opts.valoresAuto = Object.assign({}, this._opts.valoresAuto, this._opts.ovr);
        this._opts.ovr = {};
        this._opts.onSaved && this._opts.onSaved(this._opts.doc, JSON.parse(this._payload()));
        this._refresh();
        _toast().success('Datos guardados', 'El documento quedó listo para exportar o enviar a firma.');
        // 📦GPE · Aviso del render: que dato LLEGO al archivo y cual no.
        // Un valor que no se aplico es un dato que el documento no tiene.
        var rGPE = (r && r.data && r.data.render) || null;
        if (rGPE && rGPE.mensaje) {
          if (rGPE.sinVerificar && rGPE.sinVerificar.length) {
            _toast().warning('Datos guardados, con avisos', rGPE.mensaje + ' Revisa los campos que no quedaron verificados.');
          } else if (rGPE.faltantes && rGPE.faltantes.length) {
            _toast().info('Datos guardados', rGPE.mensaje + ' Esos campos no tienen etiqueta en la plantilla.');
          }
        }
      } else {
        _toast().error('Error guardando cambios', (r && r.error && r.error.message || 'desconocido'));
      }
    } catch (e) {
      _toast().error('Error guardando cambios', e.message);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Guardar cambios'; }
    }
  };

  GPEditor.prototype._guardarYFirmar = async function () {
    var o = this._opts;
    if (!o.doc.rutaArchivo) {
      _toast().warning('Sin archivo', 'El documento no tiene archivo generado todavía.');
      return;
    }
    await this._guardar();
    this.close();
    o.onEnviarFirma && o.onEnviarFirma(o.doc.id);
  };

  GPEditor.prototype.open = function (opts) {
    var self = this;
    if (this._el) this.close();
    this._opts = Object.assign({
      doc: {}, electronAPI: window.electronAPI || null,
      valoresAuto: {}, extraFields: [], ovr: {}, reemplazos: [],
      chip: 'todos', savedAt: null,
      onSaved: null, onEnviarFirma: null
    }, opts || {});
    var o = this._opts;

    var el = document.createElement('div');
    el.className = 'gpe-modal';
    el.innerHTML =
      '<div class="gpe-modal__overlay" data-gpe-overlay></div>' +
      '<div class="gpe-modal__panel" role="dialog" aria-modal="true">' +
        '<header class="gpe-modal__header">' +
          '<div>' +
            '<h3 class="gpe-modal__title"><i class="fas fa-pen-ruler"></i> Editar datos del documento</h3>' +
            '<p class="gpe-modal__sub">Revisa y corrige los datos antes de exportar o enviar a firma electrónica</p>' +
          '</div>' +
          '<button class="gpe-modal__close" data-gpe-close type="button" aria-label="Cerrar"><i class="fas fa-times"></i></button>' +
        '</header>' +
        '<div class="gpe-modal__body" data-gpe-body></div>' +
        '<footer class="gpe-modal__footer">' +
          '<p class="gpe-modal__foot-hint">Los cambios quedan registrados en el documento (trazabilidad de la edición).</p>' +
          '<button class="gpe-btn" data-gpe-export type="button" title="Abrir el archivo actual"><i class="fas fa-download"></i> Exportar</button>' +
          '<button class="gpe-btn gpe-btn--success" data-gpe-save type="button"><i class="fas fa-floppy-disk"></i> Guardar cambios</button>' +
          '<button class="gpe-btn gpe-btn--primary" data-gpe-firmar type="button"><i class="fas fa-file-signature"></i> Guardar y enviar a firma</button>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(el);
    this._el = el;
    el.querySelector('[data-gpe-body]').innerHTML = this._renderBody();
    this._wireShell();
    this._wireRows();
    this._wireRepl();
    this._refresh();
  };

  GPEditor.prototype.close = function () {
    if (!this._el) return;
    document.removeEventListener('keydown', this._escHandler);
    if (this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
    this._opts = null;
  };

  if (typeof window !== 'undefined') {
    window.GPEditor = new GPEditor();
  }
})();
