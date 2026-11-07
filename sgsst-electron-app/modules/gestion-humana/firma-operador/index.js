/* modules/gestion-humana/firma-operador/index.js
   📦1038 · Los anexos (Anexo de Encargo y Anexo de Nube) desde la app.

   QUÉ ES ESTA VISTA
   ----------------
   Es la vista del OPERADOR de K+AIR (Gesstiar S.A.S.), no la del cliente.
   Desde acá se gestionan las suscripciones de todas las Empresas: se abre
   la suscripción, se manda el enlace, se verifica al representante, se pide
   el código de contrafirma y se contrafirma.

   POR QUÉ ES UNA VISTA NUEVA Y NO UNA SECCIÓN DE `firma-electronica`
   ------------------------------------------------------------------
   El módulo `firma-electronica` es POR EMPRESA: trabaja con
   `self.companyName` y con los trabajadores de esa empresa. El panel de
   operador es ENTRE EMPRESAS. Meterlo ahí mezclaría las dos cosas y
   dejaría un panel de operador dentro de la pantalla del cliente.

   LA LÍNEA QUE NO SE CRUZA
   -----------------------
   Los actos de K+AIR usan la ADMIN KEY. La contrafirma (fase 2) es el acto
   de K+AIR: su código sale al buzón de protección de datos de K+AIR, y su
   versión para el cliente NO EXISTE a propósito. Si la admin key llegara al
   equipo de un cliente, ese cliente podría contrafirmar su propio Anexo.

   El estado que ve el cliente (el del Anexo en la vista `firma-electronica`)
   usa la API KEY de la Empresa y solo lee lo suyo.

   LOS TRES ACTOS QUE PIDEN MOTIVO
   -------------------------------
   Anular, verificar-representante y contrafirmar van con `X-Admin-Motivo`:
   sin motivo, el service responde 400 MOTIVO_REQUERIDO y el acto NO se
   registra. Esta vista lo pide SIEMPRE.
*/

(function () {
  'use strict';

  var COMPONENT_NAME = 'FirmaOperadorComponent';

  // ═══════════════════════════════════════════════════════════════════
  //  LOS ESTADOS
  // ═══════════════════════════════════════════════════════════════════
  //
  //  "FIRMADA" en el service significa que la EMPRESA suscribió (fase 1).
  //  El instrumento está EJECUTADO solo con la contrafirma de K+AIR (fase 2).
  //  La vista dice "suscrito" y "ejecutado", nunca "firmado": mezclar los dos
  //  dos términos hace creer que el Anexo está listo cuando la Empresa sigue
  //  bloqueada con el 409.

  var ESTADO_ENCARGO = {
    no_suscrito: { label: 'No suscrito', clase: 'fo-badge--neutro' },
    suscrito: { label: 'Suscrito · falta contrafirma', clase: 'fo-badge--ambar' },
    ejecutado: { label: 'Ejecutado', clase: 'fo-badge--verde' }
  };

  var ESTADO_NUBE = {
    no_suscrito: { label: 'No suscrito', clase: 'fo-badge--neutro' },
    suscrito: { label: 'Suscrito', clase: 'fo-badge--ambar' },
    firmado: { label: 'Firmado', clase: 'fo-badge--verde' }
  };

  // Los estados de la suscripción que ve el operador. El service los llama
  // PENDIENTE, CODIGO_ENVIADO, FIRMADA, EXPIRADA, BLOQUEADA y ANULADA.
  var ETIQUETA_SUSCRIPCION = {
    PENDIENTE: 'Esperando que la Empresa se suscriba',
    CODIGO_ENVIADO: 'Código enviado, esperando la firma',
    FIRMADA: 'La Empresa suscribió',
    EXPIRADA: 'El enlace venció',
    BLOQUEADA: 'Bloqueada',
    ANULADA: 'Anulada'
  };

  var TIPOS_DOCUMENTO = [
    { value: 'CERTIFICADO_CAMARA', label: 'Certificado de cámara de comercio' },
    { value: 'RUT', label: 'RUT' },
    { value: 'PODER', label: 'Poder de representación' }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════

  function _esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** La fecha, en el formato de Colombia y sin la 'T' del ISO. */
  function _fmtFecha(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var dia = ('0' + d.getDate()).slice(-2);
    var hh = ('0' + d.getHours()).slice(-2);
    var mm = ('0' + d.getMinutes()).slice(-2);
    return dia + ' ' + mes[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + hh + ':' + mm;
  }

  /** Lo que se muestra del enlace: el token es lo unico que lo identifica. */
  function _resumenToken(token) {
    if (!token) return '';
    var t = String(token);
    if (t.length <= 12) return t;
    return t.slice(0, 6) + '…' + t.slice(-4);
  }

  function _fmtBytes(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EL COMPONENTE
  // ═══════════════════════════════════════════════════════════════════

  function FirmaOperadorComponent(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName || null;
    this.moduleName = moduleName || 'Gestión Humana';
    this.subName = subName || 'Anexos';
    this.onBack = typeof onBack === 'function' ? onBack : null;

    this._empresas = [];
    this._seleccion = null;   // la Empresa abierta en el modal
    this._detalle = null;     // su detalle de suscripciones
    this._hayAdminKey = false;
    this._fuenteAdminKey = null;
    this._cargando = false;
    this._modo = null;        // 'suscripcion' | 'nube' | 'verificar' | 'contrafirmar' | 'anular'
    this._enlace = null;      // el enlace de la ultima subscription abierta
  }

  FirmaOperadorComponent.prototype.render = function () {
    var self = this;
    if (!self.container) return;
    self.container.innerHTML = self._getShellHtml();
    self._cacheRefs();
    self._setupListeners();
    self._load();
  };

  // ── El esqueleto ──────────────────────────────────────────────────

  FirmaOperadorComponent.prototype._getShellHtml = function () {
    return [
      '<div class="fo-wrapper">',
      '  <header class="fo-header">',
      '    <div class="fo-header__titles">',
      '      <h2 class="fo-header__title">Anexos de Encargo y de Nube</h2>',
      '      <p class="fo-header__sub">Suscripciones, verificación del representante y contrafirma de K+AIR.</p>',
      '    </div>',
      '    <div class="fo-header__actions">',
      '      <button id="fo-refrescar" class="fo-btn fo-btn--ghost" type="button">',
      '        <i class="fas fa-sync-alt"></i> Actualizar',
      '      </button>',
      '    </div>',
      '  </header>',
      '  <div class="fo-main" id="fo-main">',
      '    <div class="fo-cargando">Cargando…</div>',
      '  </div>',
      '  <div id="fo-modal" class="fo-modal" hidden>',
      '    <div class="fo-modal__overlay" data-fo-close="true"></div>',
      '    <div class="fo-modal__panel" role="dialog" aria-labelledby="fo-modal-title">',
      '      <header class="fo-modal__header">',
      '        <h3 class="fo-modal__title" id="fo-modal-title">Anexo</h3>',
      '        <button class="fo-modal__close" data-fo-close="true" type="button" aria-label="Cerrar">',
      '          <i class="fas fa-times"></i>',
      '        </button>',
      '      </header>',
      '      <div class="fo-modal__body" id="fo-modal-body"></div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  };

  FirmaOperadorComponent.prototype._cacheRefs = function () {
    this._main = this.container.querySelector('#fo-main');
    this._modal = this.container.querySelector('#fo-modal');
    this._modalBody = this.container.querySelector('#fo-modal-body');
    this._modalTitle = this.container.querySelector('#fo-modal-title');
    this._refrescar = this.container.querySelector('#fo-refrescar');
  };

  FirmaOperadorComponent.prototype._setupListeners = function () {
    var self = this;
    if (self._refrescar) {
      self._refrescar.addEventListener('click', function () { self._load(); });
    }
    // Un solo listener en el contenedor para todo lo que se hace con
    // delegation (data-fo-accion). Asi los botones que se re-pintan no
    // acumulan listeners.
    self._onClick = function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var cerrar = t.closest('[data-fo-close]');
      if (cerrar) { e.preventDefault(); self._cerrarModal(); return; }
      var acc = t.closest('[data-fo-accion]');
      if (!acc) return;
      e.preventDefault();
      self._accion(acc.getAttribute('data-fo-accion'), acc);
    };
    self.container.addEventListener('click', self._onClick);

    self._onKey = function (e) {
      if (e.key === 'Escape' && self._modal && !self._modal.hidden) self._cerrarModal();
    };
    document.addEventListener('keydown', self._onKey);
  };

  FirmaOperadorComponent.prototype.destroy = function () {
    if (this._onClick && this.container) {
      this.container.removeEventListener('click', this._onClick);
    }
    if (this._onKey) document.removeEventListener('keydown', this._onKey);
    this._onClick = null;
    this._onKey = null;
  };

  // ── La carga ──────────────────────────────────────────────────────

  FirmaOperadorComponent.prototype._load = async function () {
    var self = this;
    if (!self._main) return;
    self._cargando = true;
    self._main.innerHTML = '<div class="fo-cargando">Cargando…</div>';

    // 1) ¿Hay admin key? Sin ella esta vista no puede hacer NADA: lo dice
    //    claro en vez de mostrar una tabla vacía que parece un error.
    var diag;
    try {
      diag = await window.electronAPI.firmaConfigAdminDiag();
    } catch (e) {
      self._cargando = false;
      self._main.innerHTML = '<div class="fo-alerta fo-alerta--error">No se pudo consultar la configuración: '
        + _esc(e.message) + '</div>';
      return;
    }
    self._hayAdminKey = !!(diag && diag.success && diag.data && diag.data.hayAdminKey);
    self._fuenteAdminKey = (diag && diag.success && diag.data) ? diag.data.source : null;

    if (!self._hayAdminKey) {
      self._cargando = false;
      self._renderSinAdminKey();
      return;
    }

    // 2) El listado de Empresas con su estado de anexos.
    var r;
    try {
      r = await window.electronAPI.firmaAnexoEmpresas();
    } catch (e) {
      self._cargando = false;
      self._main.innerHTML = '<div class="fo-alerta fo-alerta--error">No se pudo consultar las empresas: '
        + _esc(e.message) + '</div>';
      return;
    }
    if (!r || !r.success) {
      self._cargando = false;
      self._main.innerHTML = '<div class="fo-alerta fo-alerta--error">'
        + _esc((r && r.error && r.error.message) || 'No se pudo consultar el listado de empresas.')
        + '</div>';
      return;
    }
    self._empresas = (r.data && r.data.items) || [];
    self._cargando = false;
    self._renderMain();
  };

  FirmaOperadorComponent.prototype._renderSinAdminKey = function () {
    this._main.innerHTML = [
      '<div class="fo-sinkey">',
      '  <h3 class="fo-sinkey__title">Esta es una vista de operador</h3>',
      '  <p class="fo-sinkey__text">',
      '    La admin key de K+AIR no esta configurada en este equipo. Es la que permite abrir',
      '    suscripciones, verificar al representante y contrafirmar el Anexo de Encargo.',
      '  </p>',
      '  <p class="fo-sinkey__text fo-sinkey__text--aviso">',
      '    <strong>La admin key es del operador y no se comparte:</strong> con ella, quien la tenga',
      '    puede contrafirmar el Anexo de cualquier Empresa. No se escribe en el equipo de un cliente.',
      '  </p>',
      '  <p class="fo-sinkey__text">',
      '    Configurala en <strong>Configuración → Firma Electrónica</strong>.',
      '  </p>',
      '</div>'
    ].join('\n');
  };

  FirmaOperadorComponent.prototype._renderMain = function () {
    var self = this;
    var ejecutadas = 0;
    var pendientes = 0;
    var sinAnexo = 0;
    self._empresas.forEach(function (e) {
      if (e.tiene_anexo) ejecutadas += 1;
      else if (e.tiene_anexo_suscrito) pendientes += 1;
      else sinAnexo += 1;
    });

    self._main.innerHTML = [
      '<div class="fo-stats">',
      '  <div class="fo-stat">',
      '    <span class="fo-stat__value">' + self._empresas.length + '</span>',
      '    <span class="fo-stat__label">Empresas</span>',
      '  </div>',
      '  <div class="fo-stat">',
      '    <span class="fo-stat__value fo-stat__value--verde">' + ejecutadas + '</span>',
      '    <span class="fo-stat__label">Con Anexo ejecutado</span>',
      '  </div>',
      '  <div class="fo-stat">',
      '    <span class="fo-stat__value fo-stat__value--ambar">' + pendientes + '</span>',
      '    <span class="fo-stat__label">Suscritas sin contrafirmar</span>',
      '  </div>',
      '  <div class="fo-stat">',
      '    <span class="fo-stat__value">' + sinAnexo + '</span>',
      '    <span class="fo-stat__label">Sin Anexo</span>',
      '  </div>',
      '</div>',
      '<div class="kair-table-wrap fo-table-wrap">',
      '  <table class="kair-table fo-table">',
      '    <thead>',
      '      <tr>',
      '        <th>Empresa</th>',
      '        <th>NIT</th>',
      '        <th>Anexo de Encargo</th>',
      '        <th>Anexo de Nube</th>',
      '        <th></th>',
      '      </tr>',
      '    </thead>',
      '    <tbody id="fo-tbody"></tbody>',
      '  </table>',
      '</div>',
      '<div id="fo-vacio" class="fo-vacio" hidden>No hay empresas registradas en el servidor de firma.</div>'
    ].join('\n');
    self._renderTabla();
  };

  FirmaOperadorComponent.prototype._renderTabla = function () {
    var self = this;
    var tbody = self.container.querySelector('#fo-tbody');
    if (!tbody) return;
    if (!self._empresas.length) {
      tbody.innerHTML = '';
      var vacio = self.container.querySelector('#fo-vacio');
      if (vacio) vacio.hidden = false;
      return;
    }
    tbody.innerHTML = self._empresas.map(function (e) {
      return self._renderFila(e);
    }).join('');
  };

  FirmaOperadorComponent.prototype._renderFila = function (e) {
    var estEncargo = e.tiene_anexo ? 'ejecutado' : (e.tiene_anexo_suscrito ? 'suscrito' : 'no_suscrito');
    var estNube = e.anexo_nube_firmado_at ? 'firmado' : 'no_suscrito';
    var cEnc = ESTADO_ENCARGO[estEncargo];
    var cNube = ESTADO_NUBE[estNube];
    return [
      '<tr>',
      '  <td class="fo-td-empresa">' + _esc(e.razon_social || '(sin razón social)') + '</td>',
      '  <td><code>' + _esc(e.nit || e.id_empresa) + '</code></td>',
      '  <td><span class="fo-badge ' + cEnc.clase + '">' + _esc(cEnc.label) + '</span></td>',
      '  <td><span class="fo-badge ' + cNube.clase + '">' + _esc(cNube.label) + '</span></td>',
      '  <td class="fo-td-accion">',
      '    <button class="fo-btn fo-btn--sm fo-btn--primary" type="button" data-fo-accion="detalle"',
      '      data-id-empresa="' + _esc(e.id_empresa) + '">Gestionar</button>',
      '  </td>',
      '</tr>'
    ].join('\n');
  };

  // ── El modal ──────────────────────────────────────────────────────

  FirmaOperadorComponent.prototype._cerrarModal = function () {
    if (this._modal) this._modal.hidden = true;
    this._modo = null;
    this._enlace = null;
  };

  FirmaOperadorComponent.prototype._abrirModal = function (titulo, html) {
    if (!this._modal) return;
    if (this._modalTitle) this._modalTitle.textContent = titulo;
    if (this._modalBody) this._modalBody.innerHTML = html;
    this._modal.hidden = false;
  };

  FirmaOperadorComponent.prototype._accion = function (nombre, el) {
    var self = this;
    var idEmpresa = el.getAttribute('data-id-empresa');
    if (nombre === 'detalle') { self._abrirDetalle(idEmpresa); return; }
    if (nombre === 'suscripcion') { self._mostrarFormSuscripcion(false); return; }
    if (nombre === 'nube-suscripcion') { self._mostrarFormSuscripcion(true); return; }
    if (nombre === 'verificar') { self._mostrarFormVerificar(); return; }
    if (nombre === 'pedir-codigo') { self._pedirCodigo(); return; }
    if (nombre === 'contrafirmar') { self._mostrarFormContrafirmar(); return; }
    if (nombre === 'anular') { self._mostrarFormAnular(false); return; }
    if (nombre === 'nube-anular') { self._mostrarFormAnular(true); return; }
    if (nombre === 'copiar') { self._copiarEnlace(); return; }
    if (nombre === 'volver') { self._renderDetalle(); return; }
    if (nombre === 'guardar-suscripcion') { self._guardarSuscripcion(); return; }
    if (nombre === 'guardar-verificacion') { self._guardarVerificacion(); return; }
    if (nombre === 'guardar-contrafirma') { self._guardarContrafirma(); return; }
    if (nombre === 'guardar-anular') { self._guardarAnular(); return; }
  };

  FirmaOperadorComponent.prototype._abrirDetalle = async function (id_empresa) {
    var self = this;
    self._seleccion = id_empresa;
    self._abrirModal('Cargando…', '<div class="fo-cargando">Cargando…</div>');
    var r;
    try {
      r = await window.electronAPI.firmaAnexoEstado({ id_empresa: id_empresa });
    } catch (e) {
      self._abrirModal('Anexo', '<div class="fo-alerta fo-alerta--error">'
        + _esc(e.message) + '</div>');
      return;
    }
    if (!r || !r.success) {
      self._abrirModal('Anexo', '<div class="fo-alerta fo-alerta--error">'
        + _esc((r && r.error && r.error.message) || 'No se pudo consultar el detalle.')
        + '</div>');
      return;
    }
    self._detalle = r.data || {};
    self._renderDetalle();
  };

  FirmaOperadorComponent.prototype._renderDetalle = function () {
    var self = this;
    var d = self._detalle || {};
    var enc = d.anexo_encargo || {};
    var nube = d.anexo_nube || {};
    var sub = enc.suscripcion || null;
    var subNube = nube.suscripcion || null;
    var empresa = null;
    self._empresas.forEach(function (e) {
      if (e.id_empresa === self._seleccion) empresa = e;
    });
    var nombre = empresa ? (empresa.razon_social || empresa.id_empresa) : self._seleccion;

    var html = [];

    html.push('<div class="fo-detalle-empresa"><strong>' + _esc(nombre) + '</strong> · <code>'
      + _esc(self._seleccion) + '</code></div>');

    // ── Anexo de Encargo ──
    html.push('<h4 class="fo-detalle__titulo">Anexo de Encargo</h4>');
    if (!sub) {
      html.push('<p class="fo-detalle__vacio">Esta Empresa no tiene ninguna suscripcion del Anexo de Encargo.</p>');
      html.push('<button class="fo-btn fo-btn--primary" type="button" data-fo-accion="suscripcion">Abrir suscripcion</button>');
    } else {
      html.push(self._htmlSuscripcionEncargo(sub, enc.eventos || []));
    }

    // ── Anexo de Nube ──
    html.push('<h4 class="fo-detalle__titulo">Anexo de Nube</h4>');
    if (!subNube) {
      html.push('<p class="fo-detalle__vacio">Esta Empresa no tiene ninguna suscripcion del Anexo de Nube.</p>');
      html.push('<button class="fo-btn fo-btn--ghost" type="button" data-fo-accion="nube-suscripcion">Abrir suscripcion del Anexo de Nube</button>');
    } else {
      html.push(self._htmlSuscripcionNube(subNube, nube.eventos || []));
    }

    self._abrirModal('Anexos · ' + nombre, html.join('\n'));
  };

  FirmaOperadorComponent.prototype._htmlSuscripcionEncargo = function (sub, eventos) {
    // Sin esto, `self` resuelve al `window` del navegador y la llamada a
    // `self._htmlEventos` revienta con "is not a function".
    var self = this;
    var html = [];
    var etiqueta = ETIQUETA_SUSCRIPCION[sub.estado] || sub.estado || '—';
    var verificada = !!sub.representante_verificacion;
    var contrafirmada = !!sub.contrafirmado_at;

    html.push('<div class="fo-kv"><span class="fo-kv__k">Suscripcion</span><span class="fo-kv__v">#'
      + _esc(sub.id) + ' · ' + _esc(etiqueta) + '</span></div>');
    html.push('<div class="fo-kv"><span class="fo-kv__k">Version del texto</span><span class="fo-kv__v">'
      + _esc(sub.version || '—') + '</span></div>');
    if (sub.firmado_at) {
      html.push('<div class="fo-kv"><span class="fo-kv__k">La Empresa suscribio</span><span class="fo-kv__v">'
        + _esc(_fmtFecha(sub.firmado_at)) + '</span></div>');
    }
    html.push('<div class="fo-kv"><span class="fo-kv__k">Firmante</span><span class="fo-kv__v">'
      + _esc(sub.nombre_firmante || '—') + (sub.cargo_firmante ? ' · ' + _esc(sub.cargo_firmante) : '')
      + '</span></div>');
    html.push('<div class="fo-kv"><span class="fo-kv__k">Correo</span><span class="fo-kv__v">'
      + _esc(sub.correo_firmante || '—') + '</span></div>');
    html.push('<div class="fo-kv"><span class="fo-kv__k">Representante verificado</span><span class="fo-kv__v">'
      + (verificada
        ? 'Si · ' + _fmtFecha(sub.representante_verificado_at)
        : 'No · sin esto K+AIR no contrafirma') + '</span></div>');
    html.push('<div class="fo-kv"><span class="fo-kv__k">Contrafirma de K+AIR</span><span class="fo-kv__v">'
      + (contrafirmada ? 'Si · ' + _esc(_fmtFecha(sub.contrafirmado_at)) : 'No · el instrumento no esta ejecutado')
      + '</span></div>');

    // Las acciones, en el orden que el service impone.
    html.push('<div class="fo-acciones">');
    if (sub.estado === 'FIRMADA' && !verificada && !contrafirmada) {
      html.push('<button class="fo-btn fo-btn--primary" type="button" data-fo-accion="verificar">Verificar representante</button>');
    }
    if (sub.estado === 'FIRMADA' && verificada && !contrafirmada) {
      html.push('<button class="fo-btn fo-btn--primary" type="button" data-fo-accion="pedir-codigo">Pedir codigo de contrafirma</button>');
      html.push('<button class="fo-btn fo-btn--ghost" type="button" data-fo-accion="contrafirmar">Contrafirmar</button>');
    }
    if (sub.estado !== 'FIRMADA') {
      html.push('<button class="fo-btn fo-btn--peligro" type="button" data-fo-accion="anular">Anular la suscripcion</button>');
    }
    html.push('</div>');

    html.push(self._htmlEventos(eventos));
    return html.join('\n');
  };

  FirmaOperadorComponent.prototype._htmlSuscripcionNube = function (sub, eventos) {
    // Mismo caso que en `_htmlSuscripcionEncargo`: `self` tiene que ser `this`.
    var self = this;
    var html = [];
    var etiqueta = ETIQUETA_SUSCRIPCION[sub.estado] || sub.estado || '—';
    html.push('<div class="fo-kv"><span class="fo-kv__k">Suscripcion</span><span class="fo-kv__v">#'
      + _esc(sub.id) + ' · ' + _esc(etiqueta) + '</span></div>');
    html.push('<div class="fo-kv"><span class="fo-kv__k">Version del texto</span><span class="fo-kv__v">'
      + _esc(sub.version || '—') + '</span></div>');
    html.push('<div class="fo-kv"><span class="fo-kv__k">Correo</span><span class="fo-kv__v">'
      + _esc(sub.correo_firmante || '—') + '</span></div>');
    if (sub.firmado_at) {
      html.push('<div class="fo-kv"><span class="fo-kv__k">Firmado</span><span class="fo-kv__v">'
        + _esc(_fmtFecha(sub.firmado_at)) + '</span></div>');
    }
    if (sub.estado !== 'FIRMADA') {
      html.push('<div class="fo-acciones"><button class="fo-btn fo-btn--peligro" type="button"'
        + ' data-fo-accion="nube-anular">Anular la suscripcion</button></div>');
    }
    html.push(self._htmlEventos(eventos));
    return html.join('\n');
  };

  FirmaOperadorComponent.prototype._htmlEventos = function (eventos) {
    if (!eventos || !eventos.length) return '';
    var html = ['<details class="fo-eventos"><summary>Rastro (' + eventos.length + ' eventos)</summary><ul class="fo-eventos__lista">'];
    eventos.forEach(function (e) {
      html.push('<li class="fo-evento"><span class="fo-evento__fecha">' + _esc(_fmtFecha(e.fecha_hora))
        + '</span><span class="fo-evento__nombre">' + _esc(e.evento) + '</span>'
        + (e.detalle ? '<span class="fo-evento__detalle">' + _esc(e.detalle) + '</span>' : '')
        + '</li>');
    });
    html.push('</ul></details>');
    return html.join('\n');
  };

  // ── Las formas ────────────────────────────────────────────────────

  FirmaOperadorComponent.prototype._mostrarFormSuscripcion = function (esNube) {
    var self = this;
    self._modo = esNube ? 'nube' : 'suscripcion';
    var html = [];
    html.push('<p class="fo-form__nota">');
    if (esNube) {
      html.push('El enlace de un solo uso se manda por correo a la Empresa, que lo abre y se suscribe desde la pantalla del servicio.');
    } else {
      html.push('El enlace de un solo uso se manda por correo a la Empresa, que lo abre y se suscribe desde la pantalla del servicio.');
      html.push(' El <strong>codigo</strong> de verificacion sale a un buzon <strong>distinto</strong>: el enlace y el codigo no van al mismo canal.');
    }
    html.push('</p>');
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-susc-correo">Correo de quien firma <span class="fo-field__req">*</span></label>');
    html.push('<input id="fo-susc-correo" class="fo-field__input" type="email" placeholder="representante@empresa.com" autocomplete="off" />');
    html.push('</div>');
    if (!esNube) {
      html.push('<div class="fo-field">');
      html.push('<label class="fo-field__label" for="fo-susc-canal">Correo del SEGUNDO canal (el del codigo) <span class="fo-field__req">*</span></label>');
      html.push('<input id="fo-susc-canal" class="fo-field__input" type="email" placeholder="otro-canal@empresa.com" autocomplete="off" />');
      html.push('<p class="fo-field__hint">Tiene que ser un buzon distinto del anterior: el enlace y el codigo no se mandan al mismo canal.</p>');
      html.push('</div>');
      html.push('<div class="fo-field">');
      html.push('<label class="fo-field__label" for="fo-susc-confirmacion">Como se confirmo ese canal <span class="fo-field__req">*</span></label>');
      html.push('<input id="fo-susc-confirmacion" class="fo-field__input" type="text" placeholder="Ej: llamada al numero de la camara de comercio" />');
      html.push('</div>');
    }
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-susc-nombre">Nombre de quien firma</label>');
    html.push('<input id="fo-susc-nombre" class="fo-field__input" type="text" placeholder="Ej: Lilia Maria Vasquez Munoz" />');
    html.push('</div>');
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-susc-cargo">Cargo</label>');
    html.push('<input id="fo-susc-cargo" class="fo-field__input" type="text" placeholder="Ej: Representante legal" />');
    html.push('</div>');
    html.push('<div class="fo-form__acciones">');
    html.push('<button class="fo-btn fo-btn--ghost" type="button" data-fo-accion="volver">Volver</button>');
    html.push('<button class="fo-btn fo-btn--primary" type="button" data-fo-accion="guardar-suscripcion">Abrir la suscripcion</button>');
    html.push('</div>');
    self._abrirModal('Abrir suscripcion', html.join('\n'));
  };

  FirmaOperadorComponent.prototype._guardarSuscripcion = async function () {
    var self = this;
    var esNube = self._modo === 'nube';
    var correo = self._valor('fo-susc-correo');
    var datos = {
      correo_firmante: correo,
      nombre_firmante: self._valor('fo-susc-nombre'),
      cargo_firmante: self._valor('fo-susc-cargo')
    };
    if (!esNube) {
      datos.canal_codigo = self._valor('fo-susc-canal');
      datos.canal_codigo_confirmacion = self._valor('fo-susc-confirmacion');
    }
    if (!datos.correo_firmante) {
      self._showToast('Falta el correo de quien firma', 'error');
      return;
    }
    if (!esNube && (!datos.canal_codigo || !datos.canal_codigo_confirmacion)) {
      self._showToast('Falta el segundo canal o como se confirmo', 'error');
      return;
    }
    if (!esNube && datos.canal_codigo.toLowerCase() === datos.correo_firmante.toLowerCase()) {
      self._showToast('El segundo canal tiene que ser un buzon DISTINTO del correo de quien firma', 'error');
      return;
    }

    var r = esNube
      ? await window.electronAPI.firmaAnexoNubeSuscripcion({ id_empresa: self._seleccion, datos: datos })
      : await window.electronAPI.firmaAnexoSuscripcion({ id_empresa: self._seleccion, datos: datos });

    if (!r || !r.success) {
      self._showToast((r && r.error && r.error.message) || 'No se pudo abrir la suscripcion', 'error');
      return;
    }
    self._enlace = (r.data && r.data.url) ? r.data.url : null;
    var html = [];
    html.push('<div class="fo-alerta fo-alerta--ok">');
    html.push('La suscripcion quedo abierta y el service <strong>mando el correo de invitacion</strong> a '
      + _esc(datos.correo_firmante) + '.');
    html.push('</div>');
    if (self._enlace) {
      html.push('<div class="fo-field">');
      html.push('<label class="fo-field__label">Enlace de suscripcion (de un solo uso)</label>');
      html.push('<div class="fo-enlace"><code class="fo-enlace__url">' + _esc(self._enlace) + '</code></div>');
      html.push('<p class="fo-field__hint">Este enlace sale en claro <strong>una sola vez</strong>: la base solo guarda su huella, asi que no se puede volver a leer. Si se pierde, hay que anular la suscripcion y abrir otra.</p>');
      html.push('<button class="fo-btn fo-btn--ghost" type="button" data-fo-accion="copiar">Copiar el enlace</button>');
      html.push('</div>');
    }
    if (r.data && r.data.expira_en) {
      html.push('<div class="fo-kv"><span class="fo-kv__k">El enlace vence</span><span class="fo-kv__v">'
        + _esc(_fmtFecha(r.data.expira_en)) + '</span></div>');
    }
    html.push('<div class="fo-form__acciones"><button class="fo-btn fo-btn--primary" type="button" data-fo-accion="volver">Volver al detalle</button></div>');
    self._abrirModal('Suscripcion abierta', html.join('\n'));
    self._showToast('Suscripcion abierta: se mando el correo de invitacion', 'success');
  };

  FirmaOperadorComponent.prototype._mostrarFormVerificar = function () {
    var self = this;
    self._modo = 'verificar';
    var html = [];
    html.push('<p class="fo-form__nota">K+AIR no contrafirma el Anexo sin verificar <strong>quien</strong> firmó por la Empresa. '
      + 'Se registra que documento se reviso y con que referencia.</p>');
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-ver-tipo">Tipo de documento <span class="fo-field__req">*</span></label>');
    html.push('<select id="fo-ver-tipo" class="fo-field__input">');
    TIPOS_DOCUMENTO.forEach(function (t) {
      html.push('<option value="' + _esc(t.value) + '">' + _esc(t.label) + '</option>');
    });
    html.push('</select></div>');
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-ver-referencia">Referencia <span class="fo-field__req">*</span></label>');
    html.push('<input id="fo-ver-referencia" class="fo-field__input" type="text" placeholder="Ej: radicado 2026-11-07-14 de la camara de comercio" />');
    html.push('</div>');
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-ver-nota">Nota</label>');
    html.push('<input id="fo-ver-nota" class="fo-field__input" type="text" placeholder="Opcional" />');
    html.push('</div>');
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-ver-motivo">Motivo <span class="fo-field__req">*</span></label>');
    html.push('<input id="fo-ver-motivo" class="fo-field__input" type="text" placeholder="Este motivo queda en el rastro" />');
    html.push('</div>');
    html.push('<div class="fo-form__acciones">');
    html.push('<button class="fo-btn fo-btn--ghost" type="button" data-fo-accion="volver">Volver</button>');
    html.push('<button class="fo-btn fo-btn--primary" type="button" data-fo-accion="guardar-verificacion">Registrar la verificacion</button>');
    html.push('</div>');
    self._abrirModal('Verificar al representante', html.join('\n'));
  };

  FirmaOperadorComponent.prototype._guardarVerificacion = async function () {
    var self = this;
    var motivo = self._valor('fo-ver-motivo');
    if (!motivo) { self._showToast('Falta el motivo: queda en el rastro', 'error'); return; }
    var sub = (self._detalle && self._detalle.anexo_encargo && self._detalle.anexo_encargo.suscripcion) || null;
    if (!sub) { self._showToast('No hay suscripcion abierta', 'error'); return; }
    var r = await window.electronAPI.firmaAnexoVerificarRepresentante({
      id_empresa: self._seleccion,
      id_suscripcion: sub.id,
      datos: {
        tipo_documento: self._valor('fo-ver-tipo'),
        referencia: self._valor('fo-ver-referencia'),
        nota: self._valor('fo-ver-nota')
      },
      motivo: motivo
    });
    if (!r || !r.success) {
      self._showToast((r && r.error && r.error.message) || 'No se pudo registrar la verificacion', 'error');
      return;
    }
    self._showToast('Verificacion registrada: ya se puede pedir el codigo de contrafirma', 'success');
    await self._abrirDetalle(self._seleccion);
  };

  FirmaOperadorComponent.prototype._pedirCodigo = async function () {
    var self = this;
    var sub = (self._detalle && self._detalle.anexo_encargo && self._detalle.anexo_encargo.suscripcion) || null;
    if (!sub) { self._showToast('No hay suscripcion abierta', 'error'); return; }
    var r = await window.electronAPI.firmaAnexoContrafirmaCodigo({
      id_empresa: self._seleccion,
      id_suscripcion: sub.id
    });
    if (!r || !r.success) {
      self._showToast((r && r.error && r.error.message) || 'No se pudo pedir el codigo', 'error');
      return;
    }
    self._showToast('Codigo enviado al buzon de K+AIR (' + ((r.data && r.data.canal) || 'enmascarado') + ')', 'success');
    self._mostrarFormContrafirmar();
  };

  FirmaOperadorComponent.prototype._mostrarFormContrafirmar = function () {
    var self = this;
    self._modo = 'contrafirmar';
    var html = [];
    html.push('<p class="fo-form__nota">Este es el <strong>segundo acto</strong>: K+AIR contrafirma el Anexo de Encargo. '
      + 'Con esto el instrumento queda ejecutado y la Empresa ya puede firmar los documentos de sus trabajadores.</p>');
    html.push('<p class="fo-form__nota">El codigo llego al buzon de proteccion de datos de K+AIR, no al de la Empresa. '
      + 'Copia el de ahi: <strong>esta vista no lo pide ni lo guarda</strong>.</p>');
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-ctr-otp">Codigo de 6 digitos <span class="fo-field__req">*</span></label>');
    html.push('<input id="fo-ctr-otp" class="fo-field__input" type="text" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code" />');
    html.push('</div>');
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-ctr-motivo">Motivo <span class="fo-field__req">*</span></label>');
    html.push('<input id="fo-ctr-motivo" class="fo-field__input" type="text" placeholder="Este motivo queda en el rastro" />');
    html.push('</div>');
    html.push('<div class="fo-form__acciones">');
    html.push('<button class="fo-btn fo-btn--ghost" type="button" data-fo-accion="volver">Volver</button>');
    html.push('<button class="fo-btn fo-btn--primary" type="button" data-fo-accion="guardar-contrafirma">Contrafirmar</button>');
    html.push('</div>');
    self._abrirModal('Contrafirmar el Anexo de Encargo', html.join('\n'));
  };

  FirmaOperadorComponent.prototype._guardarContrafirma = async function () {
    var self = this;
    var motivo = self._valor('fo-ctr-motivo');
    var otp = self._valor('fo-ctr-otp');
    if (!motivo) { self._showToast('Falta el motivo: queda en el rastro', 'error'); return; }
    if (!/^\d{6}$/.test(otp)) { self._showToast('El codigo son 6 digitos', 'error'); return; }
    var sub = (self._detalle && self._detalle.anexo_encargo && self._detalle.anexo_encargo.suscripcion) || null;
    if (!sub) { self._showToast('No hay suscripcion abierta', 'error'); return; }
    var r = await window.electronAPI.firmaAnexoContrafirmar({
      id_empresa: self._seleccion,
      id_suscripcion: sub.id,
      otp: otp,
      motivo: motivo
    });
    if (!r || !r.success) {
      self._showToast((r && r.error && r.error.message) || 'No se pudo contrafirmar', 'error');
      return;
    }
    self._showToast('Anexo contrafirmado: el instrumento quedo ejecutado', 'success');
    await self._abrirDetalle(self._seleccion);
  };

  FirmaOperadorComponent.prototype._mostrarFormAnular = function (esNube) {
    var self = this;
    self._modo = esNube ? 'nube-anular' : 'anular';
    var html = [];
    html.push('<p class="fo-form__nota">Anular da de baja la suscripcion. El motivo queda en el rastro y el enlace deja de servir.</p>');
    html.push('<div class="fo-field">');
    html.push('<label class="fo-field__label" for="fo-anu-motivo">Motivo <span class="fo-field__req">*</span></label>');
    html.push('<input id="fo-anu-motivo" class="fo-field__input" type="text" placeholder="Este motivo queda en el rastro" />');
    html.push('</div>');
    html.push('<div class="fo-form__acciones">');
    html.push('<button class="fo-btn fo-btn--ghost" type="button" data-fo-accion="volver">Volver</button>');
    html.push('<button class="fo-btn fo-btn--peligro" type="button" data-fo-accion="guardar-anular">Anular</button>');
    html.push('</div>');
    self._abrirModal('Anular la suscripcion', html.join('\n'));
  };

  FirmaOperadorComponent.prototype._guardarAnular = async function () {
    var self = this;
    var esNube = self._modo === 'nube-anular';
    var motivo = self._valor('fo-anu-motivo');
    if (!motivo) { self._showToast('Falta el motivo: queda en el rastro', 'error'); return; }
    var sub = esNube
      ? ((self._detalle && self._detalle.anexo_nube && self._detalle.anexo_nube.suscripcion) || null)
      : ((self._detalle && self._detalle.anexo_encargo && self._detalle.anexo_encargo.suscripcion) || null);
    if (!sub) { self._showToast('No hay suscripcion abierta', 'error'); return; }
    var r = esNube
      ? await window.electronAPI.firmaAnexoNubeAnular({ id_empresa: self._seleccion, id_suscripcion: sub.id, motivo: motivo })
      : await window.electronAPI.firmaAnexoAnular({ id_empresa: self._seleccion, id_suscripcion: sub.id, motivo: motivo });
    if (!r || !r.success) {
      self._showToast((r && r.error && r.error.message) || 'No se pudo anular', 'error');
      return;
    }
    self._showToast('Suscripcion anulada', 'success');
    await self._abrirDetalle(self._seleccion);
  };

  FirmaOperadorComponent.prototype._copiarEnlace = async function () {
    var self = this;
    if (!self._enlace) return;
    try {
      await navigator.clipboard.writeText(self._enlace);
      self._showToast('Enlace copiado', 'success');
    } catch (e) {
      self._showToast('No se pudo copiar: seleccioná el enlace a mano', 'warning');
    }
  };

  // ── Utilidades ────────────────────────────────────────────────────

  FirmaOperadorComponent.prototype._valor = function (id) {
    var el = this.container.querySelector('#' + id);
    if (!el) return '';
    return String(el.value || '').trim();
  };

  FirmaOperadorComponent.prototype._showToast = function (msg, type) {
    var t = this._toast;
    if (!t) return;
    if (typeof t[type] === 'function') { t[type](msg); return; }
    if (typeof t.show === 'function') t.show(msg, type || 'info');
  };

  // El toast estandarizado, igual que en el resto del modulo (con fallback
  // para que una vista sin helper no se quede sin avisar).
  Object.defineProperty(FirmaOperadorComponent.prototype, '_toast', {
    get: function () {
      if (window.parent && window.parent.GestionHumanaToast) return window.parent.GestionHumanaToast;
      if (window.GestionHumanaToast) return window.GestionHumanaToast;
      var k = (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
      if (k) return k;
      return { success: function () {}, error: function () {}, warning: function () {}, info: function () {}, show: function () {} };
    },
    configurable: true
  });

  window[COMPONENT_NAME] = FirmaOperadorComponent;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FirmaOperadorComponent: FirmaOperadorComponent, COMPONENT_NAME: COMPONENT_NAME };
  }
})();
