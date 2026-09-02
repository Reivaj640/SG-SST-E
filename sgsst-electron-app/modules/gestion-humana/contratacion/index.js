// modules/gestion-humana/contratacion/index.js
// 📦756 · Contratación — Cards EN PROCESO + COMPLETADOS (vista moderna)
//
// Layout:
//   - 4 KPIs: Total Procesos, En Proceso, Completados, Ingresan Esta Semana
//   - Header de sección + botón "Nueva Contratación"
//   - Grid 2 cols: "EN PROCESO" (cards grandes con pipeline)
//   - Lista: "COMPLETADOS RECIENTEMENTE" (cards simples)
//   - Modal "Nueva Contratación" (9 campos)
//   - Modal "Detalle" (6 pasos verticales expandibles)
//
// Backend: gh:list-contrataciones, gh:list-sedes, gh:create-contratacion,
//          gh:update-contratacion, gh:marcar-paso, gh:delete-contratacion

class ContratacionComponent {
  constructor(container, companyName, moduleName, submoduleName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
    this.onBack = onBack;
    this.contrataciones = [];
    this.sedes = [];
    this.sedesById = {};
  }

  // ─── Constantes de los 6 pasos del pipeline ───
  static get PASOS() {
    return [
      { num: 1, label: 'Memo / Correo',          desc: 'Recepción del memo con datos del trabajador',  icon: 'fa-envelope' },
      { num: 2, label: 'Contacto Aspirante',     desc: 'Llamar/WhatsApp para citar el día antes del ingreso', icon: 'fa-phone' },
      { num: 3, label: 'Exámenes Médicos',       desc: 'Coordinar con IPS según fecha de ingreso',     icon: 'fa-stethoscope' },
      { num: 4, label: 'Firma de Documentos',    desc: '7 formatos: autorizaciones, datos, contrato, cartas', icon: 'fa-pen' },
      { num: 5, label: 'Afiliaciones',           desc: 'EPS, Pensión, ARL, Caja de Compensación',     icon: 'fa-shield-halved' },
      { num: 6, label: 'Activación S400',        desc: 'Activación en sistema interno tras autorización', icon: 'fa-microchip' }
    ];
  }

  // ─── Helpers ───
  _toast() { return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast; }
  _showToast(msg, type) { var t = this._toast(); if (t) t.show(msg, type || 'info'); }
  _confirmDialog() { return (window.parent && window.parent.KairConfirm) ? window.parent.KairConfirm : window.KairConfirm; }
  _escHtml(s) { if (s == null) return ''; return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  _initials(nombres, apellidos) {
    var n = (nombres || '').trim();
    var a = (apellidos || '').trim();
    var i1 = n ? n.charAt(0) : '';
    var i2 = a ? a.charAt(0) : '';
    return (i1 + i2).toUpperCase() || '?';
  }
  _avatarColor(seed) {
    var s = String(seed || '');
    var hash = 0;
    for (var i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    var hue = Math.abs(hash) % 360;
    return 'hsl(' + hue + ', 55%, 45%)';
  }
  _fmtCurrency(v) {
    if (v == null || v === '') return '—';
    var n = Number(v);
    if (isNaN(n)) return '—';
    return '$' + n.toLocaleString('es-CO');
  }
  _fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return iso; }
  }
  _isoToInputDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0, 10); } catch (e) { return ''; }
  }
  _inputDateToIso(s) {
    if (!s) return '';
    try { return new Date(s + 'T12:00:00').toISOString(); } catch (e) { return ''; }
  }
  _todayIso() { return new Date().toISOString().slice(0, 10); }
  _isSameWeek(iso) {
    if (!iso) return false;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    var now = new Date();
    var start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(now.getDate() - now.getDay()); // domingo
    var end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  }

  // ─── Cálculos KPI ───
  _kpis() {
    var self = this;
    var enProceso   = this.contrataciones.filter(function (c) { return c.estado === 'en_proceso'; });
    var completados = this.contrataciones.filter(function (c) { return c.estado === 'completado'; });
    var total       = this.contrataciones.filter(function (c) { return c.estado !== 'cancelado'; }).length;
    var estaSemana  = this.contrataciones.filter(function (c) { return self._isSameWeek(c.fechaIngreso); }).length;
    return {
      total:        total,
      enProceso:    enProceso.length,
      completados:  completados.length,
      estaSemana:   estaSemana,
      enProcesoList: enProceso,
      completadosList: completados
    };
  }

  // ─── Carga de datos ───
  async _loadSedes() {
    if (!window.electronAPI || !this.companyName) return;
    try {
      var r = await window.electronAPI.ghListSedes({ companyName: this.companyName });
      if (r && r.success && r.data && r.data.sedes) {
        this.sedes = r.data.sedes;
        this.sedesById = {};
        this.sedes.forEach(function (s) { self.sedesById[s.id] = s; });
      }
    } catch (e) { /* noop */ }
  }

  async _loadContrataciones() {
    if (!window.electronAPI || !this.companyName) return;
    var self = this;
    try {
      var r = await window.electronAPI.ghListContrataciones({ companyName: this.companyName });
      if (r && r.success && r.data && r.data.contrataciones) {
        this.contrataciones = r.data.contrataciones;
        this._renderAll();
      } else {
        this._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('Error: ' + e.message, 'error');
    }
  }

  // ─── Fetch + fallback HTML ───
  async _fetchHtml() {
    try {
      var r = await fetch('modules/gestion-humana/contratacion/index.html');
      if (r.ok) return await r.text();
    } catch (e) { console.warn('[Contratacion] fetch HTML falló, usando fallback inline:', e.message); }
    return '<div class="ct-wrapper" id="ct-wrapper">' +
      '<div class="ct-kpi-section"><div id="ct-kpi-bar" class="ct-kpi-bar"></div></div>' +
      '<div class="ct-section-head">' +
        '<div class="ct-section-head__text"><h2 class="ct-section-head__title">Procesos de Contratación</h2>' +
        '<p class="ct-section-head__sub">Workflow paso a paso desde recepción del memo hasta activación en S400</p></div>' +
        '<button id="ct-new-btn" class="ct-btn ct-btn--primary" type="button"><i class="fas fa-plus"></i> Nueva Contratación</button>' +
      '</div>' +
      '<div class="ct-block"><h3 class="ct-block__title">EN PROCESO</h3><div id="ct-en-proceso" class="ct-cards-grid"></div></div>' +
      '<div class="ct-block"><h3 class="ct-block__title">COMPLETADOS RECIENTEMENTE</h3><div id="ct-completados" class="ct-cards-list"></div></div>' +
    '</div>';
  }

  // ─── Render principal ───
  async render() {
    var self = this;
    if (!this._html) this._html = await this._fetchHtml();
    this.container.innerHTML = this._html;

    var newBtn = this.container.querySelector('#ct-new-btn');
    if (newBtn) newBtn.onclick = function () { self._openCreateModal(); };

    this._renderKpiBar();
    this._renderEnProceso();
    this._renderCompletados();

    this._loadSedes();
    this._loadContrataciones();
  }

  _renderAll() {
    this._renderKpiBar();
    this._renderEnProceso();
    this._renderCompletados();
  }

  _renderKpiBar() {
    var bar = this.container.querySelector('#ct-kpi-bar');
    if (!bar || !window.GHKPIBar) return;
    var k = this._kpis();
    var kpis = [
      { icon: 'fa-folder-open',  color: '#174ea6', bg: '#e8f0fe', value: k.total,        label: 'Total Procesos' },
      { icon: 'fa-spinner',      color: '#b06000', bg: '#fff3cd', value: k.enProceso,    label: 'En Proceso' },
      { icon: 'fa-circle-check', color: '#28a745', bg: '#d4edda', value: k.completados,  label: 'Completados' },
      { icon: 'fa-calendar-day', color: '#0d9488', bg: '#ccfbf1', value: k.estaSemana,   label: 'Ingresan Esta Semana' }
    ];
    window.GHKPIBar.render(bar, kpis);
  }

  // ─── Render: EN PROCESO (grid de cards) ───
  _renderEnProceso() {
    var cont = this.container.querySelector('#ct-en-proceso');
    if (!cont) return;
    var self = this;
    var list = this.contrataciones.filter(function (c) { return c.estado === 'en_proceso'; });

    if (list.length === 0) {
      cont.innerHTML = '<div class="ct-empty">No hay procesos en curso. Iniciá uno con "Nueva Contratación".</div>';
      return;
    }

    var html = list.map(function (c) { return self._renderEnProcesoCard(c); }).join('');
    cont.innerHTML = html;

    cont.querySelectorAll('.ct-card').forEach(function (card) {
      card.onclick = function () { self._openDetailModal(card.getAttribute('data-id')); };
    });
  }

  _renderEnProcesoCard(c) {
    var self = this;
    var paso = c.pasoActual || 1;
    var pasoLabel = this._pasoLabel(paso);
    var pasoIcon = this._pasoIcon(paso);
    var sedeNombre = c.sedeId && this.sedesById[c.sedeId] ? this.sedesById[c.sedeId].nombre : (c.sedeId || '');
    var initials = this._initials(c.nombres, c.apellidos);
    var avatarBg = this._avatarColor(c.cedula || c.id);

    return '<div class="ct-card ct-card--en_proceso" data-id="' + this._escHtml(c.id) + '">' +
      '<div class="ct-card__head">' +
        '<div class="ct-avatar" style="background:' + avatarBg + ';">' + this._escHtml(initials) + '</div>' +
        '<div class="ct-card__head-text">' +
          '<div class="ct-card__name">' + this._escHtml((c.nombres || '') + ' ' + (c.apellidos || '')) + '</div>' +
          '<div class="ct-card__cargo">' + this._escHtml((c.cargo || '—') + ' · ' + (sedeNombre || 'Sin sede')) + '</div>' +
        '</div>' +
        '<span class="ct-paso-chip"><i class="fas ' + pasoIcon + '"></i> Paso ' + paso + '/6</span>' +
      '</div>' +
      '<div class="ct-card__grid">' +
        '<div><div class="ct-card__field-label">Fecha Ingreso</div><div class="ct-card__field-value">' + this._fmtDate(c.fechaIngreso) + '</div></div>' +
        '<div><div class="ct-card__field-label">Salario</div><div class="ct-card__field-value">' + this._fmtCurrency(c.salario) + '</div></div>' +
        '<div><div class="ct-card__field-label">Teléfono</div><div class="ct-card__field-value ct-card__field-value--mono">' + (c.telefono ? this._escHtml(c.telefono) : '—') + '</div></div>' +
        '<div><div class="ct-card__field-label">Empresa Usuaria</div><div class="ct-card__field-value">' + (c.empresaUsuaria ? this._escHtml(c.empresaUsuaria) : '—') + '</div></div>' +
      '</div>' +
      '<div class="ct-card__progress">' +
        '<div class="ct-card__progress-label"><span>Progreso del proceso</span><span>' + Math.round((paso / 6) * 100) + '%</span></div>' +
        '<div class="ct-card__progress-bar"><div class="ct-card__progress-fill" style="width:' + ((paso / 6) * 100) + '%;"></div></div>' +
      '</div>' +
      '<div class="ct-card__paso-actual"><i class="fas ' + pasoIcon + '"></i> Paso actual: ' + pasoLabel + '<i class="fas fa-chevron-right ct-card__arrow"></i></div>' +
    '</div>';
  }

  _pasoLabel(n) { return (ContratacionComponent.PASOS[n - 1] || {}).label || '—'; }
  _pasoIcon(n)  { return (ContratacionComponent.PASOS[n - 1] || {}).icon  || 'fa-circle'; }

  // ─── Render: COMPLETADOS (lista) ───
  _renderCompletados() {
    var cont = this.container.querySelector('#ct-completados');
    if (!cont) return;
    var self = this;
    var list = this.contrataciones.filter(function (c) { return c.estado === 'completado'; });

    if (list.length === 0) {
      cont.innerHTML = '<div class="ct-empty">Aún no hay contrataciones completadas.</div>';
      return;
    }

    // Limitar a las 6 más recientes
    list = list.slice(0, 6);

    var html = list.map(function (c) {
      var initials = self._initials(c.nombres, c.apellidos);
      var avatarBg = self._avatarColor(c.cedula || c.id);
      var cargo = c.cargo || '—';
      return '<div class="ct-card-row" data-id="' + self._escHtml(c.id) + '">' +
        '<div class="ct-avatar" style="background:' + avatarBg + ';">' + self._escHtml(initials) + '</div>' +
        '<div class="ct-card-row__text">' +
          '<div class="ct-card-row__name">' + self._escHtml((c.nombres || '') + ' ' + (c.apellidos || '')) + '</div>' +
          '<div class="ct-card-row__meta">' + self._escHtml(cargo) + ' · ' + self._fmtDate(c.fechaIngreso) + '</div>' +
        '</div>' +
        '<span class="ct-card-row__badge"><i class="fas fa-check"></i> Completado</span>' +
        '<div class="ct-card-row__date">' + self._fmtDate(c.s400Fecha || c.updatedAt) + '</div>' +
      '</div>';
    }).join('');
    cont.innerHTML = html;

    cont.querySelectorAll('.ct-card-row').forEach(function (row) {
      row.onclick = function () { self._openDetailModal(row.getAttribute('data-id')); };
    });
  }

  // ─── Modal: Nueva Contratación (9 campos) ───
  _openCreateModal() {
    var self = this;
    var sedeOptions = this.sedes.map(function (s) {
      return '<option value="' + self._escHtml(s.id) + '">' + self._escHtml(s.nombre) + '</option>';
    }).join('');

    var html =
      '<div class="ct-modal-backdrop" id="ct-create-backdrop">' +
        '<div class="ct-modal" role="dialog" aria-modal="true">' +
          '<div class="ct-modal__head">' +
            '<div>' +
              '<h2 class="ct-modal__title">Nueva Contratación</h2>' +
              '<p class="ct-modal__sub">Datos del memo/correo inicial</p>' +
            '</div>' +
            '<button class="ct-modal__close" type="button" aria-label="Cerrar">×</button>' +
          '</div>' +
          '<div class="ct-modal__body">' +
            '<form id="ct-create-form" class="ct-form-grid">' +
              '<div class="ct-field"><label>Nombres <span class="req">*</span></label><input type="text" name="nombres" required /></div>' +
              '<div class="ct-field"><label>Apellidos <span class="req">*</span></label><input type="text" name="apellidos" required /></div>' +
              '<div class="ct-field" id="ct-cedula-field">' +
                '<label>Cédula</label>' +
                '<input type="text" name="cedula" id="ct-cedula-input" inputmode="numeric" autocomplete="off" />' +
                '<div class="ct-cedula-warning" id="ct-cedula-warning" hidden>' +
                  '<i class="fas fa-exclamation-triangle"></i>' +
                  '<span id="ct-cedula-warning-msg"></span>' +
                '</div>' +
              '</div>' +
              '<div class="ct-field"><label>Teléfono</label><input type="text" name="telefono" inputmode="numeric" /></div>' +
              '<div class="ct-field"><label>Cargo <span class="req">*</span></label><input type="text" name="cargo" placeholder="Ej: Salvavidas, Recepcionista" required /></div>' +
              '<div class="ct-field"><label>Salario (COP)</label><input type="number" name="salario" placeholder="1300000" /></div>' +
              '<div class="ct-field"><label>Fecha Ingreso <span class="req">*</span></label><input type="date" name="fechaIngreso" required /></div>' +
              '<div class="ct-field"><label>Sede</label><select name="sedeId"><option value="">— sin asignar —</option>' + sedeOptions + '</select></div>' +
              '<div class="ct-field ct-field--full"><label>Empresa Usuaria (Cliente)</label><input type="text" name="empresaUsuaria" placeholder="Ej: COMFAMILIAR ATLANTICO" /></div>' +
            '</form>' +
          '</div>' +
          '<div class="ct-modal__foot">' +
            '<button class="ct-btn ct-btn--ghost" type="button" data-action="cancel">Cancelar</button>' +
            '<button class="ct-btn ct-btn--primary" type="button" data-action="submit"><i class="fas fa-play"></i> Iniciar Proceso</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);

    var close = function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
    backdrop.querySelector('.ct-modal__close').onclick = close;
    backdrop.querySelector('[data-action="cancel"]').onclick = close;
    backdrop.onclick = function (e) { if (e.target === backdrop) close(); };

    // 📦767 · Validación de cédula duplicada (primera barrera UI)
    // Mientras el user tipea: debounce 400ms → consulta exacta.
    // Al hacer submit: validación final sincrónica (carrera-safe).
    var cedulaInput = backdrop.querySelector('#ct-cedula-input');
    var cedulaField = backdrop.querySelector('#ct-cedula-field');
    var cedulaWarning = backdrop.querySelector('#ct-cedula-warning');
    var cedulaWarningMsg = backdrop.querySelector('#ct-cedula-warning-msg');
    var warningActive = false;     // true cuando hay coincidencia
    var lastCheckedCedula = '';    // para no re-consultar el mismo valor
    var debounceTimer = null;
    var CEDULA_DEBOUNCE_MS = 400;

    function _formatEstado(estado) {
      // Normalizar estados legacy (A/activo, R/retirado) que la BD trae del Excel
      var e = (estado || '').toLowerCase();
      if (e === 'a' || e === 'act' || e === 'activo') return 'Activo';
      if (e === 'r' || e === 'ret' || e === 'retirado') return 'Retirado';
      if (e === 'incapacitado') return 'Incapacitado';
      if (e === 'vacaciones') return 'Vacaciones';
      if (e === 'permiso') return 'Permiso';
      if (e === 'maternidad') return 'Maternidad';
      if (e === 'paternidad') return 'Paternidad';
      if (e === 'luto') return 'Luto';
      return estado ? (estado.charAt(0).toUpperCase() + estado.slice(1)) : 'Sin estado';
    }

    function showCedulaWarning(personal) {
      warningActive = true;
      cedulaField.classList.add('ct-cedula-field--warning');
      var nombre = ((personal.nombres || '') + ' ' + (personal.apellidos || '')).trim() || '(sin nombre)';
      cedulaWarningMsg.textContent =
        'Cédula ya registrada — Trabajador encontrado: ' + nombre +
        ' (CC ' + personal.cedula + ', Estado: ' + _formatEstado(personal.estado) + ').' +
        ' Verifica antes de continuar.';
      cedulaWarning.hidden = false;
    }
    function hideCedulaWarning() {
      warningActive = false;
      cedulaField.classList.remove('ct-cedula-field--warning');
      cedulaWarningMsg.textContent = '';
      cedulaWarning.hidden = true;
    }

    async function checkCedulaExact(cedulaVal) {
      if (!cedulaVal) { hideCedulaWarning(); return; }
      if (cedulaVal === lastCheckedCedula) return;  // ya validado este valor
      lastCheckedCedula = cedulaVal;
      try {
        var r = await window.electronAPI.ghGetPersonalByCedula({
          companyName: self.companyName,
          cedula: cedulaVal
        });
        if (r && r.success && r.data && r.data.personal) {
          showCedulaWarning(r.data.personal);
        } else {
          hideCedulaWarning();
        }
      } catch (e) {
        // Falla silenciosa: no bloquear al user si la red/BD tiene un traspié
        hideCedulaWarning();
      }
    }

    cedulaInput.addEventListener('input', function () {
      // Cualquier cambio → resetear caché y warning
      hideCedulaWarning();
      lastCheckedCedula = '';
      if (debounceTimer) clearTimeout(debounceTimer);
      var val = cedulaInput.value.trim();
      if (!val) return;  // cédula vacía → no validar
      debounceTimer = setTimeout(function () { checkCedulaExact(val); }, CEDULA_DEBOUNCE_MS);
    });
    cedulaInput.addEventListener('blur', function () {
      // Validación final al salir del campo (sin debounce)
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      var val = cedulaInput.value.trim();
      if (!val) { hideCedulaWarning(); return; }
      checkCedulaExact(val);
    });

    backdrop.querySelector('[data-action="submit"]').onclick = async function () {
      var form = backdrop.querySelector('#ct-create-form');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var cedulaVal = form.cedula.value.trim();

      // Construir el formData UNA sola vez (fuente única de verdad)
      var formData = {
        nombres:       form.nombres.value.trim(),
        apellidos:     form.apellidos.value.trim(),
        cedula:        form.cedula.value.trim() || null,
        telefono:      form.telefono.value.trim() || null,
        cargo:         form.cargo.value.trim(),
        salario:       form.salario.value ? Number(form.salario.value) : null,
        fechaIngreso:  self._inputDateToIso(form.fechaIngreso.value),
        sedeId:        form.sedeId.value || null,
        empresaUsuaria: form.empresaUsuaria.value.trim() || null
      };

      // 📦767 · Doble validación en submit (carrera-safe)
      // Si el user dejó el form abierto mucho tiempo, otro proceso pudo haber
      // creado un bp-id con esa cédula. Re-consultamos antes de avanzar.
      if (cedulaVal) {
        try {
          var r2 = await window.electronAPI.ghGetPersonalByCedula({
            companyName: self.companyName,
            cedula: cedulaVal
          });
          if (r2 && r2.success && r2.data && r2.data.personal) {
            var bpEncontrado = r2.data.personal;
            // 📦767 · I-103.A1.0-E-frontend · Bifurcación según estado del BP
            if (bpEncontrado.estado === 'retirado') {
              // BP retirado → modal de decisión (Reingreso / Recontratar / Corregir / Cancelar)
              showCedulaWarning(bpEncontrado);
              self._openRecontratacionDecisionModal(bpEncontrado, formData, function () {
                if (cedulaInput) { cedulaInput.focus(); cedulaInput.select(); }
              });
            } else {
              // BP activo (u otro) → modal de advertencia actual (bloqueante)
              showCedulaWarning(bpEncontrado);
              self._openCedulaWarningModal(cedulaInput, bpEncontrado, function () {
                if (cedulaInput) { cedulaInput.focus(); cedulaInput.select(); }
              });
            }
            return;  // ← bloquea el submit
          }
        } catch (e) {
          // Si falla la verificación, dejamos pasar (no bloquear por error de transporte)
        }
      }

      close();
      self._create(formData);
    };
  }

  // 📦767 · Modal de advertencia cuando la cédula ya está registrada.
  // Primera barrera UI. NO ofrece re-vincular todavía — esa acción requiere
  // la Fase 1 del backend (decidir explícitamente entre NO EXISTE / RETIRADO / ACTIVO).
  // Solo permite corregir la cédula o cancelar la operación.
  _openCedulaWarningModal(cedulaInput, existingPersonal, onCorregir) {
    var self = this;
    var nombre = ((existingPersonal.nombres || '') + ' ' + (existingPersonal.apellidos || '')).trim() || '(sin nombre)';
    var estadoFmt = (function () {
      var e = (existingPersonal.estado || '').toLowerCase();
      if (e === 'a' || e === 'act' || e === 'activo') return 'Activo';
      if (e === 'r' || e === 'ret' || e === 'retirado') return 'Retirado';
      return existingPersonal.estado ? (existingPersonal.estado.charAt(0).toUpperCase() + existingPersonal.estado.slice(1)) : 'Sin estado';
    })();
    var cargoFmt = existingPersonal.cargo || '—';

    var html =
      '<div class="ct-modal-backdrop" id="ct-cedula-warn-backdrop">' +
        '<div class="ct-modal ct-modal--warning" role="alertdialog" aria-modal="true" aria-labelledby="ct-cedula-warn-title" style="max-width:520px;">' +
          '<div class="ct-modal__head ct-modal__head--warning">' +
            '<div>' +
              '<h2 class="ct-modal__title" id="ct-cedula-warn-title">' +
                '<i class="fas fa-exclamation-triangle"></i> Cédula ya registrada' +
              '</h2>' +
              '<p class="ct-modal__sub">No se puede iniciar este proceso con esta cédula</p>' +
            '</div>' +
            '<button class="ct-modal__close" type="button" data-action="close" aria-label="Cerrar">×</button>' +
          '</div>' +
          '<div class="ct-modal__body">' +
            '<div class="ct-cedula-warn-card">' +
              '<div class="ct-cedula-warn-card__row"><span class="ct-cedula-warn-card__label">Trabajador encontrado:</span><span class="ct-cedula-warn-card__value">' + this._escHtml(nombre) + '</span></div>' +
              '<div class="ct-cedula-warn-card__row"><span class="ct-cedula-warn-card__label">Cédula:</span><span class="ct-cedula-warn-card__value">' + this._escHtml(existingPersonal.cedula) + '</span></div>' +
              '<div class="ct-cedula-warn-card__row"><span class="ct-cedula-warn-card__label">Estado:</span><span class="ct-cedula-warn-card__value">' + this._escHtml(estadoFmt) + '</span></div>' +
              '<div class="ct-cedula-warn-card__row"><span class="ct-cedula-warn-card__label">Cargo:</span><span class="ct-cedula-warn-card__value">' + this._escHtml(cargoFmt) + '</span></div>' +
            '</div>' +
            '<p class="ct-cedula-warn-msg">Verifica que la cédula corresponda al trabajador que estás contratando. Si se trata de un registro equivocado, corrige la cédula.</p>' +
          '</div>' +
          '<div class="ct-modal__foot">' +
            '<button class="ct-btn ct-btn--ghost" type="button" data-action="cancel">Cancelar</button>' +
            '<button class="ct-btn ct-btn--primary" type="button" data-action="corregir"><i class="fas fa-pen"></i> Corregir cédula</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);

    function closeWarn() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }

    backdrop.querySelector('.ct-modal__close').onclick = closeWarn;
    backdrop.querySelector('[data-action="cancel"]').onclick = closeWarn;
    backdrop.querySelector('[data-action="corregir"]').onclick = function () {
      closeWarn();
      if (typeof onCorregir === 'function') onCorregir();
    };
    backdrop.onclick = function (e) { if (e.target === backdrop) closeWarn(); };
  }

  // 📦767 · I-103.A1.0-E-frontend · Modal de decisión cuando se detecta un BP RETIRADO
  // Ofrece 4 acciones: Reingreso, Recontratar, Corregir, Cancelar.
  // - Reingreso: gh:cambiar-estado (1.0-D-1) → reactiva el bp SIN crear CT
  // - Recontratar: gh:recontratar-personal (a6cba571 refactor) → crea CT + reactiva + inserta RECONTRATACION
  // - Corregir: cierra modal + enfoca el input de cédula
  // - Cancelar: cierra modal sin acciones
  // El formData se pasa para construir contratacionData del mismo formulario actual
  // (sin duplicar la fuente de verdad: nombres, cargo, salario, sede, etc. vienen del form).
  _openRecontratacionDecisionModal(personal, formData, onCorregir) {
    var self = this;
    var nombre = ((personal.nombres || '') + ' ' + (personal.apellidos || '')).trim() || '(sin nombre)';
    var fechaRetiroFmt = personal.fecha_retiro ? self._fmtDate(personal.fecha_retiro) : '—';
    var cargoFmt = personal.cargo || '—';

    var html =
      '<div class="ct-modal-backdrop" id="ct-recontratacion-backdrop">' +
        '<div class="ct-modal ct-modal--warning" role="alertdialog" aria-modal="true" aria-labelledby="ct-recontratacion-title" style="max-width:560px;">' +
          '<div class="ct-modal__head ct-modal__head--warning">' +
            '<div>' +
              '<h2 class="ct-modal__title" id="ct-recontratacion-title">' +
                '<i class="fas fa-user-clock"></i> Trabajador retirado' +
              '</h2>' +
              '<p class="ct-modal__sub">Esta persona requiere una decisión explícita</p>' +
            '</div>' +
            '<button class="ct-modal__close" type="button" data-action="close" aria-label="Cerrar">×</button>' +
          '</div>' +
          '<div class="ct-modal__body">' +
            '<div class="ct-cedula-warn-card">' +
              '<div class="ct-cedula-warn-card__row"><span class="ct-cedula-warn-card__label">Trabajador:</span><span class="ct-cedula-warn-card__value">' + self._escHtml(nombre) + '</span></div>' +
              '<div class="ct-cedula-warn-card__row"><span class="ct-cedula-warn-card__label">Cédula:</span><span class="ct-cedula-warn-card__value">' + self._escHtml(personal.cedula) + '</span></div>' +
              '<div class="ct-cedula-warn-card__row"><span class="ct-cedula-warn-card__label">Retirado desde:</span><span class="ct-cedula-warn-card__value">' + self._escHtml(fechaRetiroFmt) + '</span></div>' +
              '<div class="ct-cedula-warn-card__row"><span class="ct-cedula-warn-card__label">Cargo anterior:</span><span class="ct-cedula-warn-card__value">' + self._escHtml(cargoFmt) + '</span></div>' +
            '</div>' +
            '<p class="ct-cedula-warn-msg">Elige una opción:</p>' +
          '</div>' +
          '<div class="ct-modal__foot" style="flex-wrap:wrap;gap:0.5rem;">' +
            '<button class="ct-btn ct-btn--ghost" type="button" data-action="cancel"><i class="fas fa-times"></i> Cancelar</button>' +
            '<button class="ct-btn ct-btn--ghost" type="button" data-action="corregir"><i class="fas fa-pen"></i> Corregir cédula</button>' +
            '<button class="ct-btn ct-btn--success" type="button" data-action="reingreso"><i class="fas fa-user-check"></i> Reingresar (sin nueva CT)</button>' +
            '<button class="ct-btn ct-btn--primary" type="button" data-action="recontratar"><i class="fas fa-file-contract"></i> Recontratar (con nueva CT)</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);

    function closeModal() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }

    backdrop.querySelector('.ct-modal__close').onclick = closeModal;
    backdrop.querySelector('[data-action="cancel"]').onclick = closeModal;
    backdrop.querySelector('[data-action="corregir"]').onclick = function () {
      closeModal();
      if (typeof onCorregir === 'function') onCorregir();
    };
    backdrop.querySelector('[data-action="reingreso"]').onclick = async function () {
      closeModal();
      // 📦767 · Reingreso: SOLO gh:cambiar-estado (1.0-D-1) → reactiva bp + inserta evento REINGRESO. NO crea CT.
      try {
        var r = await window.electronAPI.ghCambiarEstado({
          personalId: personal.id,
          estado: 'activo',
          notas: 'Reingreso desde UI de contratación'
        });
        if (r && r.success) {
          self._showToast('Trabajador reactivado (sin nueva CT)', 'success');
          await self._loadContrataciones();
        } else {
          self._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
        }
      } catch (e) {
        self._showToast('Error: ' + e.message, 'error');
      }
    };
    backdrop.querySelector('[data-action="recontratar"]').onclick = async function () {
      closeModal();
      // 📦767 · Recontratar: gh:recontratar-personal (a6cba571) con contratacionData del mismo formulario
      // (sin duplicar la fuente de verdad: los campos vienen de formData ya construido en submit)
      var contratacionData = {
        nombres:       formData.nombres,
        apellidos:     formData.apellidos,
        cedula:        formData.cedula,
        telefono:      formData.telefono,
        cargo:         formData.cargo,
        salario:       formData.salario,
        fechaIngreso:  formData.fechaIngreso,
        sedeId:        formData.sedeId,
        empresaUsuaria: formData.empresaUsuaria
      };
      try {
        var r2 = await window.electronAPI.ghRecontratarPersonal({
          companyName: self.companyName,
          bpId: personal.id,
          contratacionData: contratacionData,
          motivo: 'Recontratación desde UI de contratación'
        });
        if (r2 && r2.success) {
          self._showToast('Recontratación exitosa. CT: ' + r2.data.contratacionId, 'success');
          await self._loadContrataciones();
        } else {
          self._showToast('Error: ' + ((r2 && r2.error && r2.error.message) || 'desconocido'), 'error');
        }
      } catch (e) {
        self._showToast('Error: ' + e.message, 'error');
      }
    };
    backdrop.onclick = function (e) { if (e.target === backdrop) closeModal(); };
  }

  async _create(data) {
    var self = this;
    try {
      var r = await window.electronAPI.ghCreateContratacion({ companyName: this.companyName, data: data });
      if (r && r.success) {
        this._showToast('Proceso de contratación iniciado', 'success');
        await this._loadContrataciones();
      } else {
        this._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('Error: ' + e.message, 'error');
    }
  }

  // ─── Modal: Detalle de Contratación (6 pasos) ───
  async _openDetailModal(id) {
    var c = this.contrataciones.find(function (x) { return x.id === id; });
    if (!c) { this._showToast('Contratación no encontrada', 'error'); return; }
    var self = this;

    // Soportes del pipeline (memo, orden de exámenes, etc.) — 1 llamada, agrupada por paso
    c._soportesPorPaso = {};
    try {
      var rs = await window.electronAPI.ghListarSoportesContratacion({ companyName: this.companyName, contratacionId: id });
      if (rs && rs.success && rs.data && rs.data.soportes) {
        rs.data.soportes.forEach(function (s) {
          if (!c._soportesPorPaso[s.pasoNum]) c._soportesPorPaso[s.pasoNum] = [];
          c._soportesPorPaso[s.pasoNum].push(s);
        });
      }
    } catch (e) { console.warn('[Contratacion] No se pudieron cargar soportes:', e.message); }

    var sedeNombre = c.sedeId && this.sedesById[c.sedeId] ? this.sedesById[c.sedeId].nombre : (c.sedeId || '—');

    var badgeClass = 'ct-detail-badge';
    if (c.estado === 'completado') badgeClass += ' ct-detail-badge--completado';
    if (c.estado === 'cancelado')  badgeClass += ' ct-detail-badge--cancelado';
    var badgeLabel = { 'en_proceso': 'En proceso', 'completado': 'Completado', 'cancelado': 'Cancelado' }[c.estado] || c.estado;

    var html =
      '<div class="ct-modal-backdrop" id="ct-detail-backdrop">' +
        '<div class="ct-modal" role="dialog" aria-modal="true" style="max-width:780px;">' +
          '<div class="ct-modal__head">' +
            '<div>' +
              '<h2 class="ct-modal__title">' + this._escHtml((c.nombres || '') + ' ' + (c.apellidos || '')) +
                ' <span class="' + badgeClass + '">' + badgeLabel + '</span></h2>' +
              '<p class="ct-modal__sub">' + this._escHtml((c.cargo || '—') + ' · ' + sedeNombre + ' · Ingreso: ' + this._fmtDate(c.fechaIngreso) + ' · Salario: ' + this._fmtCurrency(c.salario)) + '</p>' +
            '</div>' +
            '<button class="ct-modal__close" type="button" aria-label="Cerrar">×</button>' +
          '</div>' +
          '<div class="ct-modal__body" id="ct-steps-body"></div>' +
          '<div class="ct-modal__foot">' +
            (c.estado !== 'cancelado' ?
              '<button class="ct-btn ct-btn--ghost" type="button" data-action="cancel-ct"><i class="fas fa-ban"></i> Cancelar Contratación</button>' :
              '') +
            '<button class="ct-btn ct-btn--primary" type="button" data-action="close">Cerrar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var backdrop = wrap.firstChild;
    document.body.appendChild(backdrop);

    var close = function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
    backdrop.querySelector('.ct-modal__close').onclick = close;
    backdrop.querySelector('[data-action="close"]').onclick = close;
    backdrop.onclick = function (e) { if (e.target === backdrop) close(); };
    var cancelBtn = backdrop.querySelector('[data-action="cancel-ct"]');
    if (cancelBtn) cancelBtn.onclick = function () { close(); self._openCancelConfirm(c.id, (c.nombres || '') + ' ' + (c.apellidos || '')); };

    var body = backdrop.querySelector('#ct-steps-body');
    body.innerHTML = this._renderPasos(c);
    this._wireSoportes(body, c);

    // Eventos de los pasos (delegación)
    body.querySelectorAll('.ct-step').forEach(function (step) {
      var pasoNum = parseInt(step.getAttribute('data-paso'), 10);
      var boolKey = self._pasoBoolKey(pasoNum);
      var isDone = c[boolKey] === 1;
      var header = step.querySelector('.ct-step__head');
      if (header) {
        header.style.cursor = (c.estado !== 'cancelado') ? 'pointer' : 'default';
        header.onclick = function () {
          if (c.estado === 'cancelado') return;
          if (isDone) return; // no expandir pasos ya completados
          step.classList.toggle('ct-step--expanded');
        };
      }
      var submitBtn = step.querySelector('[data-action="marcar-paso"]');
      if (submitBtn) {
        submitBtn.onclick = function () {
          var fechaVal = step.querySelector('input[name="fecha"]').value;
          var notasVal = step.querySelector('textarea[name="notas"]').value;
          var extraField = step.querySelector('input[name="ips"]');
          var ipsVal = extraField ? extraField.value : null;
          var payload = {
            contratacionId: c.id,
            pasoNum: pasoNum,
            fecha: fechaVal ? self._inputDateToIso(fechaVal) : null,
            notas: notasVal || null
          };
          if (ipsVal !== null) payload.fecha = fechaVal ? self._inputDateToIso(fechaVal) : null; // ips se guarda en notas como contexto si hace falta
          // NOTA: el backend gh:marcar-paso solo persiste fecha+notas. Si el paso es
          // Exámenes Médicos, también guardamos el nombre de la IPS en notas (sufijo).
          if (pasoNum === 3 && ipsVal) {
            payload.notas = (notasVal ? (notasVal + ' · ') : '') + 'IPS: ' + ipsVal;
          }
          close();
          self._marcarPaso(payload);
        };
      }
    });
  }

  _pasoBoolKey(n) { return ['', 'memoRecibido', 'contactoRealizado', 'examenesProgramados', 'documentosFirmados', 'afiliacionesCompletadas', 's400Activado'][n]; }
  _pasoFechaKey(n) { return ['', 'memoFecha', 'contactoFecha', 'examenesFecha', 'documentosFecha', 'afiliacionesFecha', 's400Fecha'][n]; }
  _pasoNotasKey(n) { return ['', 'memoNotas', 'contactoNotas', 'examenesNotas', 'documentosNotas', 'afiliacionesNotas', 's400Notas'][n]; }

  _renderPasos(c) {
    var self = this;
    return ContratacionComponent.PASOS.map(function (p) {
      var isDone = c[self._pasoBoolKey(p.num)] === 1;
      var fecha = c[self._pasoFechaKey(p.num)];
      var notas = c[self._pasoNotasKey(p.num)];
      var isCurrent = c.pasoActual === p.num && !isDone;
      var isCanceled = c.estado === 'cancelado';

      var cls = 'ct-step';
      if (isDone) cls += ' ct-step--done';
      else if (isCurrent) cls += ' ct-step--current';
      else cls += ' ct-step--pending';

      var numHtml = isDone ? '<i class="fas fa-check"></i>' : (isCurrent ? '<i class="fas fa-clock"></i>' : String(p.num));
      var badge = isDone
        ? '<span class="ct-step__badge"><i class="fas fa-check"></i> Completado</span>'
        : (isCurrent ? '<span class="ct-step__badge ct-step__badge--pending"><i class="fas fa-hourglass-half"></i> Pendiente</span>' : '');

      var meta = '';
      if (isDone && fecha) meta = '<div class="ct-step__meta"><i class="fas fa-calendar-check"></i> Fecha: ' + self._fmtDate(fecha) + '</div>';
      if (notas && isDone) meta += '<div class="ct-step__meta ct-step__meta--neutral" style="margin-top:0.15rem;"><i class="fas fa-note-sticky"></i> ' + self._escHtml(notas) + '</div>';

      // Solo expandir pasos NO completados Y no cancelados
      var expandible = (!isDone && !isCanceled);
      var fechaInputId = 'ct-step-' + p.num + '-fecha';
      var notasInputId = 'ct-step-' + p.num + '-notas';
      var ipsInputId = 'ct-step-' + p.num + '-ips';

      var expand = '';
      if (expandible) {
        var defaultFecha = fecha ? self._isoToInputDate(fecha) : self._todayIso();
        // Regla: sin soporte no se puede completar — botón deshabilitado + ayuda
        var soportesDelPaso = (c._soportesPorPaso && c._soportesPorPaso[p.num]) || [];
        var sinSoporte = soportesDelPaso.length === 0;
        expand = '<div class="ct-step__expand">' +
          '<div class="ct-step__expand-row">' +
            '<div class="ct-field"><label>Fecha</label><input type="date" name="fecha" id="' + fechaInputId + '" value="' + defaultFecha + '" /></div>' +
            (p.num === 3 ? '<div class="ct-field"><label>IPS</label><input type="text" name="ips" id="' + ipsInputId + '" placeholder="Ej: IPS Compensar" /></div>' : '<div></div>') +
          '</div>' +
          '<div class="ct-field"><label>Notas</label><textarea name="notas" id="' + notasInputId + '" rows="2" placeholder="Registrar detalles del paso..." style="width:100%;padding:0.5rem 0.7rem;border:1px solid #dee2e6;border-radius:0.35rem;font-size:0.85rem;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;">' + self._escHtml(notas || '') + '</textarea></div>' +
          '<div class="ct-step__expand-actions">' +
            (sinSoporte
              ? '<span class="ct-step__require-soporte"><i class="fas fa-paperclip"></i> Adjuntá al menos un soporte para poder completar este paso.</span>'
              : '<button class="ct-btn ct-btn--success ct-btn--small" type="button" data-action="marcar-paso"><i class="fas fa-check-circle"></i> Marcar como completado</button>') +
          '</div>' +
        '</div>';
      }

      return '<div class="' + cls + '" data-paso="' + p.num + '">' +
        '<div class="ct-step__num">' + numHtml + '</div>' +
        '<div class="ct-step__body">' +
          '<div class="ct-step__head">' +
            '<div><div class="ct-step__title"><i class="fas ' + p.icon + '"></i> ' + p.label + '</div>' +
            '<div class="ct-step__desc">' + p.desc + '</div></div>' +
            badge +
          '</div>' +
          meta +
          expand +
          self._renderSoportes(c, p.num, isCanceled) +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ─── Soportes (evidencias) por paso ───
  _renderSoportes(c, pasoNum, isCanceled) {
    var self = this;
    var lista = (c._soportesPorPaso && c._soportesPorPaso[pasoNum]) || [];
    var items = lista.map(function (s) {
      var kb = s.tamanoBytes ? (s.tamanoBytes / 1024) : 0;
      var tam = kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(kb)) + ' KB';
      return '<div class="ct-soporte" data-soporte-id="' + self._escHtml(s.id) + '">' +
        '<i class="fas fa-paperclip ct-soporte__icon"></i>' +
        '<span class="ct-soporte__name" title="' + self._escHtml(s.nombreArchivo) + '">' + self._escHtml(s.nombreArchivo) + '</span>' +
        '<span class="ct-soporte__size">' + tam + '</span>' +
        '<button class="ct-soporte__btn" type="button" data-sop-action="abrir" title="Abrir"><i class="fas fa-up-right-from-square"></i></button>' +
        '<button class="ct-soporte__btn ct-soporte__btn--danger" type="button" data-sop-action="eliminar" title="Eliminar"><i class="fas fa-trash"></i></button>' +
      '</div>';
    }).join('');
    var empty = lista.length === 0 ? '<div class="ct-soportes__empty">Sin soportes adjuntos</div>' : '';
    return '<div class="ct-soportes" data-paso-soportes="' + pasoNum + '">' +
      '<div class="ct-soportes__head">' +
        '<span class="ct-soportes__label"><i class="fas fa-folder-open"></i> Soportes' + (lista.length ? ' (' + lista.length + ')' : '') + '</span>' +
        (isCanceled ? '' : '<button class="ct-btn ct-btn--ghost ct-btn--small" type="button" data-sop-action="subir"><i class="fas fa-paperclip"></i> Adjuntar</button>') +
      '</div>' +
      '<div class="ct-soportes__list">' + items + empty + '</div>' +
    '</div>';
  }

  // Recarga solo la sección de soportes de un paso dentro del modal abierto
  async _refreshSoportes(c, pasoNum, modalBody) {
    try {
      var rs = await window.electronAPI.ghListarSoportesContratacion({ companyName: this.companyName, contratacionId: c.id });
      if (rs && rs.success && rs.data && rs.data.soportes) {
        c._soportesPorPaso = {};
        rs.data.soportes.forEach(function (s) {
          if (!c._soportesPorPaso[s.pasoNum]) c._soportesPorPaso[s.pasoNum] = [];
          c._soportesPorPaso[s.pasoNum].push(s);
        });
      }
    } catch (e) { console.warn('[Contratacion] refresh soportes:', e.message); }
    var zone = modalBody.querySelector('[data-paso-soportes="' + pasoNum + '"]');
    if (zone) {
      var tmp = document.createElement('div');
      tmp.innerHTML = this._renderSoportes(c, pasoNum, c.estado === 'cancelado');
      zone.replaceWith(tmp.firstChild);
    }
  }

  // Wire de botones de soportes (delegación en el body del modal)
  _wireSoportes(body, c) {
    var self = this;
    body.addEventListener('click', async function (ev) {
      var btn = ev.target.closest('[data-sop-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-sop-action');
      var stepEl = btn.closest('.ct-step');
      var pasoNum = stepEl ? parseInt(stepEl.getAttribute('data-paso'), 10) : null;
      var sopEl = btn.closest('.ct-soporte');
      var soporteId = sopEl ? sopEl.getAttribute('data-soporte-id') : null;

      if (action === 'subir' && pasoNum) {
        btn.disabled = true;
        try {
          var r = await window.electronAPI.ghSubirSoportePaso({ companyName: self.companyName, contratacionId: c.id, pasoNum: pasoNum });
          if (r && r.success && !r.data.canceled) {
            self._showToast('Soporte adjuntado', 'success');
            await self._refreshSoportes(c, pasoNum, body);
          } else if (r && !r.success) {
            self._showToast('Error: ' + ((r.error && r.error.message) || 'desconocido'), 'error');
          }
        } catch (e) { self._showToast('Error: ' + e.message, 'error'); }
        btn.disabled = false;
      } else if (action === 'abrir' && soporteId) {
        window.electronAPI.ghAbrirSoportePaso({ soporteId: soporteId }).then(function (r) {
          if (r && !r.success) self._showToast('No se pudo abrir: ' + ((r.error && r.error.message) || ''), 'error');
        });
      } else if (action === 'eliminar' && soporteId) {
        var confirmRef = self._confirmDialog();
        var okDel;
        if (confirmRef) {
          okDel = await confirmRef.confirm({
            title: 'Eliminar soporte',
            message: '¿Eliminar este soporte? El archivo se borra definitivamente del computador.',
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            type: 'danger'
          });
        } else {
          okDel = window.confirm('¿Eliminar este soporte? El archivo se borra definitivamente.');
        }
        if (!okDel) return;
        var rd = await window.electronAPI.ghEliminarSoportePaso({ soporteId: soporteId });
        if (rd && rd.success) {
          // Si el backend revirtió el paso (se eliminó el último soporte), hay que
          // re-renderizar todo el pipeline → cerrar, recargar y reabrir el modal.
          if (rd.data && rd.data.pasoRevertido) {
            self._showToast('Paso ' + rd.data.pasoNum + ' revertido a pendiente: se eliminó su último soporte', 'warning');
            var backdrop = body.closest('.ct-modal-backdrop');
            if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
            await self._loadContrataciones();
            self._openDetailModal(c.id);
          } else {
            self._showToast('Soporte eliminado', 'success');
            await self._refreshSoportes(c, pasoNum, body);
          }
        } else {
          var code = rd && rd.error && rd.error.code;
          if (code === 'PASO6_NO_REVERTIBLE') {
            self._showToast((rd.error && rd.error.message), 'warning');
          } else {
            self._showToast('Error: ' + ((rd && rd.error && rd.error.message) || 'desconocido'), 'error');
          }
        }
      }
    });
  }

  async _marcarPaso(payload) {
    try {
      var r = await window.electronAPI.ghMarcarPaso(payload);
      if (r && r.success) {
        this._showToast('Paso marcado como completado', 'success');
        await this._loadContrataciones();
        // Re-abrir el modal con la versión actualizada
        if (payload.contratacionId) this._openDetailModal(payload.contratacionId);
      } else {
        var mpCode = r && r.error && r.error.code;
        if (mpCode === 'SOPORTE_REQUERIDO') {
          this._showToast('⚠️ ' + (r.error.message || 'Adjuntá al menos un soporte antes de completar el paso'), 'warning');
        } else {
          this._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
        }
      }
    } catch (e) {
      this._showToast('Error: ' + e.message, 'error');
    }
  }

  async _openCancelConfirm(id, nombre) {
    var confirmRef = this._confirmDialog();
    var confirmed;
    if (confirmRef) {
      confirmed = await confirmRef.confirm({
        title: 'Cancelar Contratación',
        message: '¿Cancelar la contratación de "' + nombre + '"? El registro se preserva como cancelado para histórico.',
        confirmText: 'Cancelar contratación',
        cancelText: 'Volver',
        type: 'danger'
      });
    } else {
      confirmed = window.confirm('¿Cancelar la contratación de "' + nombre + '"?\n\nEl registro se preserva como cancelado para histórico.');
    }
    if (!confirmed) return;
    try {
      var r = await window.electronAPI.ghDeleteContratacion({ contratacionId: id });
      if (r && r.success) {
        this._showToast('Contratación cancelada', 'success');
        await this._loadContrataciones();
      } else {
        this._showToast('Error: ' + ((r && r.error && r.error.message) || 'desconocido'), 'error');
      }
    } catch (e) {
      this._showToast('Error: ' + e.message, 'error');
    }
  }

  destroy() { /* noop */ }
}

window.ContratacionComponent = ContratacionComponent;
