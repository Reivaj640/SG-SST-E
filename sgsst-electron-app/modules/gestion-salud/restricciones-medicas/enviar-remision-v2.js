/* ============================================================
   K+AIR · 3.1.6 Enviar Remisión — premium v2
   Componente embebido (sin iframe). Sustituye a
   enviar-remision.html/js/css con el mismo contrato de datos:

     · window.electronAPI.selectPdfFile()              → { filePath }
     · window.electronAPI.processRemisionPdf(filePath) → { success, data, error }

   Tras extraer los datos redirige al informe oficial mediante el
   callback onNavigateToInforme(extractedData) — es el padre
   (restricciones-medicas-logic.js) quien monta generar-informe.

   El montaje lo hace RestriccionesMedicasComponent.showEnviarRemisionPage()
   con: new EnviarRemisionV2Component(container, { ... }).

   LECCIONES APLICADAS (de los paquetes anteriores):
     · Avisos se mudan al <body> ENVUELTOS en .remenv-scope (los
       selectores CSS son descendientes; sin envoltorio pierden todo).
     · destroy() retira las capas + vigía de navegación.
   ============================================================ */
(function () {
  'use strict';

  var TAG = 'K+AIRENV';
  function klog(mod, acc, st, extra) {
    var l = '[' + TAG + '][' + mod + '][' + acc + '][' + st + ']' + (extra ? ' ' + extra : '');
    if (st === 'ERR') console.warn(l); else console.log(l);
  }

  /* Iconos Lucide inline */
  var IC = {
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M12 12v9"/><path d="m8 17 4-4 4 4"/></svg>',
    filePdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
    spinner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>'
  };

  var PASOS = ['Cargar PDF', 'Generar informe oficial', 'Enviar a la EPS'];

  /* Marcado embebido */
  var MARCADO = [
    '<div class="remenv-header">',
    '  <span class="remenv-header__icon">' + IC.send + '</span>',
    '  <div class="remenv-header__text">',
    '    <h1 class="remenv-header__title">Nueva Remisión</h1>',
    '    <p class="remenv-header__sub">Gestión de la Salud › 3.1.6 › Enviar Remisión — carga el PDF y la app extrae los datos automáticamente</p>',
    '  </div>',
    '  <span class="remenv-header__chip" title="Empresa activa">' + IC.building + '<span id="remenv-emp">—</span></span>',
    '  <div class="remenv-header__actions">',
    '    <button type="button" class="remenv-btn remenv-btn--ghost" id="remenv-back">' + IC.arrowLeft + ' Volver</button>',
    '  </div>',
    '</div>',
    '<div class="remenv-track" id="remenv-track"></div>',
    '<div class="remenv-body">',
    '  <div class="remenv-col">',
    '    <div class="remenv-card">',
    '      <div class="remenv-card__head">' + IC.upload + '<h2 class="remenv-card__title">Archivo de remisión</h2></div>',
    '      <div class="remenv-card__body">',
    '        <div class="remenv-drop" id="remenv-drop" role="button" tabindex="0">',
    '          <div class="remenv-drop__icon" id="remenv-drop-icon">' + IC.upload + '</div>',
    '          <p class="remenv-drop__title" id="remenv-drop-title">Selecciona el PDF de la remisión</p>',
    '          <p class="remenv-drop__hint">Haz clic aquí para abrir el explorador de archivos</p>',
    '          <div class="remenv-drop__file remenv-hidden" id="remenv-file-pill">' + IC.filePdf + '<span id="remenv-file-name"></span></div>',
    '        </div>',
    '        <div class="remenv-progress remenv-hidden" id="remenv-progress">' + IC.spinner + '<span>Extrayendo datos del PDF…</span></div>',
    '      </div>',
    '    </div>',
    '    <div class="remenv-card">',
    '      <div class="remenv-card__head">' + IC.info + '<h2 class="remenv-card__title">Qué sigue después de cargar el PDF</h2></div>',
    '      <div class="remenv-card__body">',
    '        <div class="remenv-next">',
    '          <div class="remenv-next__item"><span class="remenv-next__num">1</span><div class="remenv-next__text"><b>Extracción automática</b><p>El sistema lee el PDF de la remisión y toma los datos del trabajador, la fecha de atención y las recomendaciones médicas.</p></div></div>',
    '          <div class="remenv-next__item"><span class="remenv-next__num">2</span><div class="remenv-next__text"><b>Informe oficial</b><p>Revisa los datos extraídos y genera el informe oficial con el formato establecido por la Resolución 2346 de 2007.</p></div></div>',
    '          <div class="remenv-next__item"><span class="remenv-next__num">3</span><div class="remenv-next__text"><b>Envío a la EPS</b><p>Al finalizar, el documento queda listo para enviarse por WhatsApp o correo electrónico con los datos de contacto registrados.</p></div></div>',
    '        </div>',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div class="remenv-col">',
    '    <div class="remenv-card remenv-log">',
    '      <div class="remenv-card__head">' + IC.list + '<h2 class="remenv-card__title">Registro de actividad</h2>',
    '        <button type="button" class="remenv-btn remenv-btn--ghost" id="remenv-log-clear" style="padding:5px 10px;font-size:12px">' + IC.trash + ' Limpiar</button>',
    '      </div>',
    '      <div class="remenv-log__body" id="remenv-log"></div>',
    '    </div>',
    '  </div>',
    '</div>',
    '<div class="remenv-toasts" id="remenv-toasts"></div>'
  ].join('\n');

  class EnviarRemisionV2Component {
    constructor(container, opts) {
      opts = opts || {};
      this.container = container;
      this.companyName = opts.companyName || '';
      this.onBack = opts.onBack || null;
      this.onNavigateToInforme = opts.onNavigateToInforme || null;
      this.logMessage = opts.logMessage || null;

      this.extractedData = null;
      this.lastFilePath = null;
      this.isDestroyed = false;
      this.raiz = null;
      this._nodosEnBody = [];
      this._obs = null;
      this._redirectTimer = null;
    }

    async render() {
      if (this.isDestroyed) return;
      var host = this.container;
      if (!host) { klog('MODULO', 'INIT', 'ERR', 'sin contenedor'); return; }

      this.#limpiarCapas();
      host.innerHTML = '';
      host.style.display = 'flex';
      host.style.flexDirection = 'column';
      host.style.height = '100%';
      host.style.flex = '1';
      host.style.minHeight = '0';
      host.style.overflow = 'hidden';

      this.raiz = document.createElement('div');
      this.raiz.className = 'remenv-scope';
      this.raiz.innerHTML = MARCADO;
      host.appendChild(this.raiz);

      /* Avisos al body, envueltos para conservar el alcance CSS */
      var self = this;
      this._nodosEnBody = [];
      Array.prototype.slice.call(this.raiz.querySelectorAll('.remenv-toasts')).forEach(function (n) {
        var wrap = document.createElement('div');
        wrap.className = 'remenv-scope';
        wrap.appendChild(n);
        document.body.appendChild(wrap);
        self._nodosEnBody.push(wrap);
      });

      /* Vigía: si el host o la raíz salen del documento, recogemos las capas */
      if (typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver(function () {
          if (!host.isConnected || !self.raiz || !self.raiz.isConnected) self.#limpiarCapas();
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
      }

      this.#buildTrack();
      this.#bind();
      var emp = this.$('#remenv-emp');
      if (emp) emp.textContent = this.companyName || '—';
      this.#log('Listo para seleccionar un archivo PDF de remisión.', 'info');
      klog('MODULO', 'INIT', 'OK', 'empresa=' + this.companyName);
    }

    destroy() {
      this.isDestroyed = true;
      if (this._redirectTimer) { clearTimeout(this._redirectTimer); this._redirectTimer = null; }
      this.#limpiarCapas();
      if (this.container) this.container.innerHTML = '';
      this.raiz = null;
      klog('MODULO', 'DESTROY', 'OK', 'capas retiradas');
    }

    #limpiarCapas() {
      if (this._obs) { try { this._obs.disconnect(); } catch (e) {} this._obs = null; }
      this._nodosEnBody.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      this._nodosEnBody = [];
    }

    $(sel) {
      if (!this.raiz) return null;
      var n = this.raiz.querySelector(sel);
      if (n) return n;
      for (var i = 0; i < this._nodosEnBody.length; i++) {
        n = this._nodosEnBody[i].querySelector(sel);
        if (n) return n;
      }
      if (sel.charAt(0) === '#') return document.getElementById(sel.slice(1));
      return null;
    }

    /* ── Recorrido (pasos) ── */
    #buildTrack() {
      var track = this.$('#remenv-track');
      if (!track) return;
      track.innerHTML = PASOS.map(function (label, i) {
        return '<div class="remenv-track__step" data-paso="' + (i + 1) + '">' +
          '<span class="remenv-track__dot">' + (i + 1) + '</span>' +
          '<span class="remenv-track__label">' + label + '</span>' +
          (i < PASOS.length - 1 ? '<span class="remenv-track__bar"></span>' : '') +
          '</div>';
      }).join('');
      this.#setPaso(1);
    }
    #setPaso(activo, hechos) {
      hechos = hechos || 0;
      var self = this;
      this.$$('.remenv-track__step').forEach(function (el) {
        var n = parseInt(el.getAttribute('data-paso'), 10);
        el.classList.toggle('is-done', n <= hechos);
        el.classList.toggle('is-active', n === activo && n > hechos);
        if (n <= hechos) {
          var dot = el.querySelector('.remenv-track__dot');
          if (dot) dot.innerHTML = IC.check;
        }
      });
    }
    $$(sel) {
      var out = [];
      if (this.raiz) out = out.concat(Array.prototype.slice.call(this.raiz.querySelectorAll(sel)));
      for (var i = 0; i < this._nodosEnBody.length; i++) {
        out = out.concat(Array.prototype.slice.call(this._nodosEnBody[i].querySelectorAll(sel)));
      }
      return out;
    }

    /* ── Eventos ── */
    #bind() {
      var self = this;
      var back = this.$('#remenv-back');
      if (back) back.addEventListener('click', function () {
        if (typeof self.onBack === 'function') self.onBack();
      });

      var drop = this.$('#remenv-drop');
      if (drop) {
        drop.addEventListener('click', function () { self.#seleccionarPdf(); });
        drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.#seleccionarPdf(); } });
        drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-drag'); });
        drop.addEventListener('dragleave', function (e) { e.preventDefault(); drop.classList.remove('is-drag'); });
        drop.addEventListener('drop', function (e) {
          e.preventDefault(); drop.classList.remove('is-drag');
          self.#toast('Selección', 'Usa el clic para elegir el archivo — el sistema necesita la ruta completa.', 'info');
        });
      }

      var clear = this.$('#remenv-log-clear');
      if (clear) clear.addEventListener('click', function () {
        var body = self.$('#remenv-log');
        if (body) body.innerHTML = '';
        self.#log('Registro limpiado.', 'info');
      });
    }

    /* ── Paso 1: seleccionar y procesar PDF ── */
    async #seleccionarPdf() {
      if (!window.electronAPI || typeof window.electronAPI.selectPdfFile !== 'function') {
        this.#toast('Sin conexión', 'No se encuentra el servicio de archivos.', 'error');
        return;
      }
      this.#log('Abriendo el selector de archivos…', 'info');
      try {
        var r = await window.electronAPI.selectPdfFile();
        var filePath = (r && (r.filePath || (r.success && r.data && r.data.filePath))) || (typeof r === 'string' ? r : null);
        if (!filePath) { this.#log('Selección cancelada.', 'warning'); return; }
        this.#mostrarArchivo(filePath);
        await this.#procesarPdf(filePath);
      } catch (err) {
        klog('PDF', 'SELECT', 'ERR', err.message);
        this.#log('Error al abrir el selector: ' + err.message, 'error');
        this.#toast('Error', err.message, 'error');
      }
    }

    #mostrarArchivo(filePath) {
      this.lastFilePath = filePath;
      var nombre = String(filePath).split('\\').pop().split('/').pop();
      var drop = this.$('#remenv-drop'), icon = this.$('#remenv-drop-icon'),
          title = this.$('#remenv-drop-title'), pill = this.$('#remenv-file-pill'),
          name = this.$('#remenv-file-name');
      if (drop) drop.classList.add('is-busy');
      if (icon) icon.innerHTML = IC.filePdf;
      if (title) title.textContent = 'Archivo seleccionado';
      if (name) { name.textContent = nombre; name.title = filePath; }
      if (pill) pill.classList.remove('remenv-hidden');
      this.#log('Archivo: ' + filePath, 'info');
    }

    async #procesarPdf(filePath) {
      var prog = this.$('#remenv-progress');
      if (prog) prog.classList.remove('remenv-hidden');
      this.#log('Procesando PDF y extrayendo datos…', 'info');
      try {
        var result = await window.electronAPI.processRemisionPdf(filePath);
        if (prog) prog.classList.add('remenv-hidden');

        if (result && result.success && result.data) {
          this.extractedData = result.data;
          this.#setPaso(2, 1);
          this.#log('Datos extraídos correctamente (' + Object.keys(result.data).length + ' campos).', 'success');
          this.#toast('PDF procesado', 'Redirigiendo al informe oficial para revisar los datos…', 'success');
          var self = this;
          this._redirectTimer = setTimeout(function () {
            if (self.isDestroyed) return;
            if (typeof self.onNavigateToInforme === 'function') {
              klog('NAV', 'INFORME', 'OK', 'datos extraídos');
              self.onNavigateToInforme(self.extractedData);
            }
          }, 1400);
        } else {
          var errMsg = (result && result.error) || 'No se pudieron extraer datos del PDF.';
          this.#log('Error en la extracción: ' + errMsg, 'error');
          this.#toast('Error de extracción', errMsg, 'error');
          this.#resetDrop();
        }
      } catch (err) {
        if (prog) prog.classList.add('remenv-hidden');
        klog('PDF', 'PROCESS', 'ERR', err.message);
        this.#log('Error crítico al procesar el PDF: ' + err.message, 'error');
        this.#toast('Error', err.message, 'error');
        this.#resetDrop();
      }
    }

    #resetDrop() {
      var drop = this.$('#remenv-drop'), icon = this.$('#remenv-drop-icon'),
          title = this.$('#remenv-drop-title'), pill = this.$('#remenv-file-pill');
      if (drop) drop.classList.remove('is-busy');
      if (icon) icon.innerHTML = IC.upload;
      if (title) title.textContent = 'Selecciona el PDF de la remisión';
      if (pill) pill.classList.add('remenv-hidden');
      this.#setPaso(1, 0);
    }

    /* ── Registro de actividad ── */
    #log(msg, tipo) {
      var body = this.$('#remenv-log');
      if (!body) return;
      var empty = body.querySelector('.remenv-log__empty');
      if (empty) empty.remove();
      var hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      var item = document.createElement('div');
      item.className = 'remenv-log__item remenv-log__item--' + (tipo || 'info');
      item.innerHTML = '<div style="flex:1;min-width:0"><b></b><small>' + hora + '</small></div>';
      item.querySelector('b').textContent = msg;
      body.insertBefore(item, body.firstChild);
      if (this.logMessage) this.logMessage(msg, tipo);
    }

    /* ── Avisos ── */
    #toast(titulo, mensaje, tipo) {
      var box = this.$('#remenv-toasts');
      if (!box) return;
      tipo = tipo || 'info';
      var icon = tipo === 'success' ? IC.check : tipo === 'error' ? IC.err : tipo === 'warning' ? IC.warn : IC.info;
      var el = document.createElement('div');
      el.className = 'remenv-toast remenv-toast--' + tipo;
      el.innerHTML = icon + '<div><p class="remenv-toast__title"></p><p class="remenv-toast__msg"></p></div>';
      el.querySelector('.remenv-toast__title').textContent = titulo;
      el.querySelector('.remenv-toast__msg').textContent = mensaje;
      box.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 5000);
    }
  }

  window.EnviarRemisionV2Component = EnviarRemisionV2Component;
  klog('REGISTRO', 'GLOBAL', 'OK', 'window.EnviarRemisionV2Component');
})();
