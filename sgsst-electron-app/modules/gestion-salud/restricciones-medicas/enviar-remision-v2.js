/* ============================================================
   K+AIR · 3.1.6 Enviar Remisión — premium v2
   Componente embebido (sin iframe) que cubre el FLUJO COMPLETO en
   una sola interfaz (📦776):

     Paso 1 · Cargar PDF            → selectPdfFile + processRemisionPdf
     Paso 2 · Generar informe oficial → generateRemisionDocument
     Paso 3 · Enviar a la EPS        → getContactInfo + sendRemisionByWhatsapp / sendRemisionByEmail

   Antes el paso 1 redirigía a la página vieja `generar-informe-remision.html`
   (otro diseño) y al modal legacy: se veían DOS interfaces distintas. Ahora
   los 3 pasos viven en el mismo `.remenv-scope`.

   Montaje: RestriccionesMedicasComponent.showEnviarRemisionPage() con
   new EnviarRemisionV2Component(container, { companyName, onBack, logMessage }).

   LECCIONES APLICADAS: avisos al <body> envueltos en .remenv-scope,
   destroy() + vigía de navegación.
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
    fileWord: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m8 13 1.5 5L12 13l2.5 5L16 13"/></svg>',
    spinner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    folderOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
  };

  var PASOS = ['Cargar PDF', 'Generar informe oficial', 'Enviar a la EPS'];

  /* Marcado embebido */
  var MARCADO = [
    '<div class="remenv-header">',
    '  <span class="remenv-header__icon">' + IC.send + '</span>',
    '  <div class="remenv-header__text">',
    '    <h1 class="remenv-header__title">Nueva Remisión</h1>',
    '    <p class="remenv-header__sub">Gestión de la Salud › 3.1.6 › Enviar Remisión — carga el PDF, revisa los datos, genera el informe y envíalo</p>',
    '  </div>',
    '  <span class="remenv-header__chip" title="Empresa activa">' + IC.building + '<span id="remenv-emp">—</span></span>',
    '  <div class="remenv-header__actions">',
    '    <button type="button" class="remenv-btn remenv-btn--ghost remenv-hidden" id="remenv-cancelar">' + IC.x + ' Cancelar</button>',
    '    <button type="button" class="remenv-btn remenv-btn--ghost" id="remenv-back">' + IC.arrowLeft + ' Volver</button>',
    '  </div>',
    '</div>',
    '<div class="remenv-track" id="remenv-track"></div>',
    '<div class="remenv-body">',
    '  <div class="remenv-col">',

    /* ── Paso 1: cargar PDF ── */
    '    <div class="remenv-card" id="remenv-card-pdf">',
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

    /* ── Paso 2: datos + generar informe ── */
    '    <div class="remenv-card remenv-hidden" id="remenv-card-datos">',
    '      <div class="remenv-card__head">' + IC.filePdf + '<h2 class="remenv-card__title">Datos extraídos del PDF</h2>',
    '        <button type="button" class="remenv-btn remenv-btn--ghost remenv-btn--sm" id="remenv-cambiar">' + IC.rotate + ' Cambiar archivo</button>',
    '      </div>',
    '      <div class="remenv-card__body">',
    '        <div class="remenv-grid" id="remenv-datos"></div>',
    '        <div class="remenv-generate">',
    '          <button type="button" class="remenv-btn remenv-btn--primary remenv-btn--lg" id="remenv-generar">' + IC.fileWord + ' Generar Informe Oficial</button>',
    '          <div class="remenv-progress remenv-hidden" id="remenv-gen-progress">' + IC.spinner + '<span>Generando el documento oficial y actualizando el control…</span></div>',
    '          <div class="remenv-ok remenv-hidden" id="remenv-doc-ok">' + IC.check + '<div><b>Informe oficial generado</b><span id="remenv-doc-name"></span></div>',
    '            <button type="button" class="remenv-btn remenv-btn--ghost remenv-btn--sm" id="remenv-open-folder">' + IC.folderOpen + ' Abrir carpeta</button>',
    '          </div>',
    '        </div>',
    '      </div>',
    '    </div>',

    /* ── Paso 3: revisar el informe y enviar a la EPS ── */
    '    <div class="remenv-card remenv-hidden" id="remenv-card-enviar">',
    '      <div class="remenv-card__head">' + IC.eye + '<h2 class="remenv-card__title">Revisar y enviar a la EPS</h2></div>',
    '      <div class="remenv-card__body">',
    '        <div class="remenv-preview">',
    '          <div class="remenv-preview__top">',
    '            <span class="remenv-preview__icon">' + IC.fileWord + '</span>',
    '            <div class="remenv-preview__info"><b>Vista previa del informe oficial</b><span id="remenv-preview-name">—</span></div>',
    '            <button type="button" class="remenv-btn remenv-btn--ghost remenv-btn--sm" id="remenv-ver-informe">' + IC.eye + ' Ver informe</button>',
    '          </div>',
    '          <div class="remenv-preview__meta" id="remenv-preview-meta"></div>',
    '        </div>',
    '        <p class="remenv-send__hint">' + IC.check + ' Corrobora el informe y elige el medio de envío — se usan los datos de contacto registrados en la base de datos.</p>',
    '        <div class="remenv-send">',
    '          <button type="button" class="remenv-send__btn remenv-send__btn--wa" id="remenv-wa">' + IC.whatsapp + '<span class="remenv-send__label">WhatsApp</span><span class="remenv-send__contact" id="remenv-wa-contact">Buscando teléfono…</span></button>',
    '          <button type="button" class="remenv-send__btn remenv-send__btn--mail" id="remenv-email">' + IC.mail + '<span class="remenv-send__label">Correo Electrónico</span><span class="remenv-send__contact" id="remenv-email-contact">Buscando email…</span></button>',
    '        </div>',
    '        <div class="remenv-send__status remenv-hidden" id="remenv-send-status">' + IC.spinner + '<span id="remenv-send-status-text"></span></div>',
    '      </div>',
    '    </div>',

    /* ── Info (solo paso 1) ── */
    '    <div class="remenv-card" id="remenv-card-info">',
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
    '        <button type="button" class="remenv-btn remenv-btn--ghost remenv-btn--sm" id="remenv-log-clear">' + IC.trash + ' Limpiar</button>',
    '      </div>',
    '      <div class="remenv-log__body" id="remenv-log"></div>',
    '    </div>',
    '  </div>',
    '</div>',
    '<div class="remenv-confirm remenv-hidden" id="remenv-confirm">',
    '  <div class="remenv-confirm__box">',
    '    <span class="remenv-confirm__icon">' + IC.warn + '</span>',
    '    <h3 class="remenv-confirm__title">¿Cancelar el proceso?</h3>',
    '    <p class="remenv-confirm__msg">Se descarta el avance actual y vuelves al paso 1. Los archivos ya generados NO se borran.</p>',
    '    <div class="remenv-confirm__actions">',
    '      <button type="button" class="remenv-btn remenv-btn--ghost" id="remenv-confirm-no">Seguir</button>',
    '      <button type="button" class="remenv-btn remenv-btn--danger" id="remenv-confirm-si">' + IC.x + ' Sí, cancelar</button>',
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
      this.logMessage = opts.logMessage || null;

      this.extractedData = null;
      this.lastFilePath = null;
      this.documentPath = null;
      this.controlPath = null;
      this.contacto = { telefono: '', email: '' };
      this.paso = 1;
      this.isDestroyed = false;
      this.raiz = null;
      this._nodosEnBody = [];
      this._obs = null;
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
      this.#mostrarPaso(1);
      this.#log('Listo para seleccionar un archivo PDF de remisión.', 'info');
      klog('MODULO', 'INIT', 'OK', 'empresa=' + this.companyName);
    }

    destroy() {
      this.isDestroyed = true;
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

    /* ── Visibilidad de los pasos ── */
    #mostrarPaso(n) {
      this.paso = n;
      var pdf = this.$('#remenv-card-pdf'), datos = this.$('#remenv-card-datos'),
          enviar = this.$('#remenv-card-enviar'), info = this.$('#remenv-card-info'),
          cancelar = this.$('#remenv-cancelar');
      var toggle = function (el, show) { if (el) el.classList.toggle('remenv-hidden', !show); };
      toggle(pdf, n === 1);
      toggle(info, n === 1);
      toggle(datos, n === 2);
      toggle(enviar, n === 3);
      toggle(cancelar, n > 1);
      if (n === 1) this.#setPaso(1, 0);
      else if (n === 2) this.#setPaso(2, 1);
      else if (n === 3) this.#setPaso(3, 2);
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

      var cambiar = this.$('#remenv-cambiar');
      if (cambiar) cambiar.addEventListener('click', function () { self.#resetDrop(); self.#mostrarPaso(1); });

      var generar = this.$('#remenv-generar');
      if (generar) generar.addEventListener('click', function () { self.#generarInforme(); });

      var abrir = this.$('#remenv-open-folder');
      if (abrir) abrir.addEventListener('click', function () {
        if (self.documentPath && window.electronAPI && window.electronAPI.openPath) {
          window.electronAPI.openPath(self.documentPath);
        }
      });

      var ver = this.$('#remenv-ver-informe');
      if (ver) ver.addEventListener('click', function () { self.#verInforme(); });

      var wa = this.$('#remenv-wa');
      if (wa) wa.addEventListener('click', function () { self.#enviarWhatsApp(); });

      var mail = this.$('#remenv-email');
      if (mail) mail.addEventListener('click', function () { self.#enviarEmail(); });

      var cancelar = this.$('#remenv-cancelar');
      if (cancelar) cancelar.addEventListener('click', function () { self.#abrirConfirm(); });
      var confNo = this.$('#remenv-confirm-no');
      if (confNo) confNo.addEventListener('click', function () { self.#cerrarConfirm(); });
      var confSi = this.$('#remenv-confirm-si');
      if (confSi) confSi.addEventListener('click', function () { self.#cancelarProceso(); });
      var conf = this.$('#remenv-confirm');
      if (conf) conf.addEventListener('click', function (e) { if (e.target === conf) self.#cerrarConfirm(); });
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
          this.#log('Datos extraídos correctamente (' + Object.keys(result.data).length + ' campos).', 'success');
          this.#irAPaso2();
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

    /* ── Paso 2: revisar datos y generar el informe oficial ── */
    #irAPaso2() {
      this.#renderDatos();
      this.#mostrarPaso(2);
      this.#toast('PDF procesado', 'Revisa los datos y genera el informe oficial.', 'success');
    }

    #renderDatos() {
      var grid = this.$('#remenv-datos');
      if (!grid) return;
      var d = this.extractedData || {};
      var claves = Object.keys(d).filter(function (k) { return d[k] !== '' && d[k] != null; });
      if (!claves.length) {
        grid.innerHTML = '<div class="remenv-grid__empty">No se reconocieron campos en el PDF.</div>';
        return;
      }
      grid.innerHTML = claves.map(function (k) {
        return '<div class="remenv-grid__item"><span class="remenv-grid__label"></span><span class="remenv-grid__value"></span></div>';
      }).join('');
      var items = grid.querySelectorAll('.remenv-grid__item');
      claves.forEach(function (k, i) {
        if (!items[i]) return;
        items[i].querySelector('.remenv-grid__label').textContent = k;
        items[i].querySelector('.remenv-grid__value').textContent = String(d[k]);
      });
    }

    async #generarInforme() {
      if (!window.electronAPI || typeof window.electronAPI.generateRemisionDocument !== 'function') {
        this.#toast('Sin conexión', 'No se encuentra el servicio de generación.', 'error');
        return;
      }
      var btn = this.$('#remenv-generar');
      var prog = this.$('#remenv-gen-progress');
      if (btn) btn.disabled = true;
      if (prog) prog.classList.remove('remenv-hidden');
      this.#log('Generando el informe oficial y actualizando el archivo de control…', 'info');
      try {
        var r = await window.electronAPI.generateRemisionDocument(this.extractedData, this.companyName);
        if (prog) prog.classList.add('remenv-hidden');
        if (r && r.success) {
          this.documentPath = r.documentPath || null;
          this.controlPath = r.controlPath || null;
          var ok = this.$('#remenv-doc-ok');
          var name = this.$('#remenv-doc-name');
          if (name) name.textContent = String(this.documentPath || '').split(/[\\/]/).pop() || '';
          if (ok) ok.classList.remove('remenv-hidden');
          this.#log('Informe generado: ' + (this.documentPath || ''), 'success');
          if (r.controlUpdated) this.#log('Archivo de control actualizado: ' + (this.controlPath || ''), 'success');
          else if (r.controlWarning) this.#log('⚠ Control: ' + r.controlWarning, 'warning');
          this.#irAPaso3();
        } else {
          var errMsg = (r && r.error) || 'No se pudo generar el informe.';
          this.#log('Error al generar el informe: ' + errMsg, 'error');
          this.#toast('Error al generar', errMsg, 'error');
          if (btn) btn.disabled = false;
        }
      } catch (err) {
        if (prog) prog.classList.add('remenv-hidden');
        klog('GEN', 'DOC', 'ERR', err.message);
        this.#log('Error crítico al generar el informe: ' + err.message, 'error');
        this.#toast('Error', err.message, 'error');
        if (btn) btn.disabled = false;
      }
    }

    /* ── Paso 3: revisar el informe y enviar a la EPS ── */
    #irAPaso3() {
      this.#renderPreview();
      this.#mostrarPaso(3);
      this.#cargarContacto();
    }

    /* Vista previa del informe: nombre del documento + resumen de los datos. */
    #renderPreview() {
      var name = this.$('#remenv-preview-name');
      if (name) name.textContent = String(this.documentPath || '').split(/[\\/]/).pop() || '—';
      var meta = this.$('#remenv-preview-meta');
      if (!meta) return;
      var d = this.extractedData || {};
      var campos = [
        ['Trabajador', d['Nombre Completo']],
        ['Cédula', d['No. Identificación']],
        ['Fecha de atención', d['Fecha de Atención']],
        ['Cargo', d['Cargo']]
      ].filter(function (x) { return x[1] !== '' && x[1] != null; });
      meta.innerHTML = campos.map(function () {
        return '<div class="remenv-preview__row"><span class="remenv-preview__label"></span><span class="remenv-preview__value"></span></div>';
      }).join('');
      var rows = meta.querySelectorAll('.remenv-preview__row');
      campos.forEach(function (x, i) {
        if (!rows[i]) return;
        rows[i].querySelector('.remenv-preview__label').textContent = x[0];
        rows[i].querySelector('.remenv-preview__value').textContent = String(x[1]);
      });
    }

    /* Abre el documento generado en el visor (file-viewer) del padre. */
    #verInforme() {
      if (!this.documentPath) {
        this.#toast('Sin documento', 'Todavía no se ha generado el informe.', 'warning');
        return;
      }
      if (window.kairFV && typeof window.kairFV.openWithFileViewerFromPath === 'function') {
        window.kairFV.openWithFileViewerFromPath(this.documentPath);
      } else if (window.electronAPI && window.electronAPI.openPath) {
        window.electronAPI.openPath(this.documentPath);
      } else {
        this.#toast('No disponible', 'No se pudo abrir el visor del documento.', 'error');
      }
    }

    /* ── Cancelar el proceso y reiniciar (sin borrar nada) ── */
    #abrirConfirm() {
      var c = this.$('#remenv-confirm');
      if (c) c.classList.remove('remenv-hidden');
    }
    #cerrarConfirm() {
      var c = this.$('#remenv-confirm');
      if (c) c.classList.add('remenv-hidden');
    }
    #cancelarProceso() {
      this.#cerrarConfirm();
      this.extractedData = null;
      this.documentPath = null;
      this.controlPath = null;
      this.contacto = { telefono: '', email: '' };
      var ok = this.$('#remenv-doc-ok'); if (ok) ok.classList.add('remenv-hidden');
      var btn = this.$('#remenv-generar'); if (btn) btn.disabled = false;
      this.#resetDrop();
      this.#log('Proceso cancelado. Listo para iniciar una nueva remisión.', 'warning');
      this.#toast('Proceso cancelado', 'Puedes empezar de nuevo. Los archivos generados no se borraron.', 'info');
      this.#mostrarPaso(1);
    }

    async #cargarContacto() {
      var wa = this.$('#remenv-wa'), mail = this.$('#remenv-email'),
          waC = this.$('#remenv-wa-contact'), mailC = this.$('#remenv-email-contact');
      var cedula = (this.extractedData && this.extractedData['No. Identificación']) || '';
      if (!cedula || !window.electronAPI || typeof window.electronAPI.getContactInfo !== 'function') {
        if (waC) waC.textContent = 'Cédula no disponible';
        if (mailC) mailC.textContent = 'Cédula no disponible';
        if (wa) wa.disabled = true;
        if (mail) mail.disabled = true;
        return;
      }
      try {
        var r = await window.electronAPI.getContactInfo(cedula, this.companyName || 'TEMPOACTIVA');
        this.contacto = { telefono: (r && r.telefono) || '', email: (r && r.email) || '' };
        if (this.contacto.telefono) { if (waC) waC.textContent = this.contacto.telefono; if (wa) wa.disabled = false; }
        else { if (waC) waC.textContent = 'Teléfono no encontrado'; if (wa) wa.disabled = true; }
        if (this.contacto.email) { if (mailC) mailC.textContent = this.contacto.email; if (mail) mail.disabled = false; }
        else { if (mailC) mailC.textContent = 'Email no encontrado'; if (mail) mail.disabled = true; }
      } catch (err) {
        klog('SEND', 'CONTACT', 'ERR', err.message);
        if (waC) waC.textContent = 'Error al buscar contacto';
        if (mailC) mailC.textContent = 'Error al buscar contacto';
        if (wa) wa.disabled = true;
        if (mail) mail.disabled = true;
      }
    }

    async #enviarWhatsApp() {
      if (!window.electronAPI || typeof window.electronAPI.sendRemisionByWhatsapp !== 'function') return;
      var btn = this.$('#remenv-wa');
      this.#estadoEnvio('Preparando WhatsApp…', 'info');
      if (btn) btn.disabled = true;
      try {
        var r = await window.electronAPI.sendRemisionByWhatsapp(this.documentPath, this.extractedData, this.companyName);
        if (r && r.success) { this.#estadoEnvio('¡WhatsApp abierto correctamente!', 'ok'); this.#log('WhatsApp abierto para el envío.', 'success'); }
        else { this.#estadoEnvio((r && r.error) || 'Error al enviar', 'error'); if (btn) btn.disabled = false; }
      } catch (err) {
        this.#estadoEnvio('Error: ' + err.message, 'error');
        if (btn) btn.disabled = false;
      }
    }

    async #enviarEmail() {
      if (!window.electronAPI || typeof window.electronAPI.sendRemisionByEmail !== 'function') return;
      var btn = this.$('#remenv-email');
      this.#estadoEnvio('Enviando correo…', 'info');
      if (btn) btn.disabled = true;
      try {
        var r = await window.electronAPI.sendRemisionByEmail(this.documentPath, this.extractedData, this.companyName);
        if (r && r.success) { this.#estadoEnvio('¡Correo enviado exitosamente!', 'ok'); this.#log('Correo enviado a la EPS.', 'success'); }
        else { this.#estadoEnvio((r && r.error) || 'Error al enviar', 'error'); if (btn) btn.disabled = false; }
      } catch (err) {
        this.#estadoEnvio('Error: ' + err.message, 'error');
        if (btn) btn.disabled = false;
      }
    }

    #estadoEnvio(texto, tipo) {
      var box = this.$('#remenv-send-status'), txt = this.$('#remenv-send-status-text');
      if (!box || !txt) return;
      txt.textContent = texto;
      box.classList.remove('remenv-hidden');
      box.classList.remove('is-ok', 'is-error');
      if (tipo === 'ok') box.classList.add('is-ok');
      else if (tipo === 'error') box.classList.add('is-error');
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
