/* ============================================================================
   K+AIR — Gestión del Cambio (2.11.1)
   gestion-cambio-logic.js
   ============================================================================ */

class GestionDelCambioComponent {
  constructor(container, companyName, moduleName, submoduleName, onBackToModule) {
    this.container     = container;
    this.companyName   = companyName;
    this.moduleName    = moduleName;
    this.submoduleName = submoduleName;
    this.onBackToModule = onBackToModule;

    this.changes       = [];
    this.editingId     = null;
    this.isDestroyed   = false;
    this.currentStep   = 1;
    this.totalSteps    = 4;
    this.currentEstado = null;  // Estado del registro abierto en el modal

    this.cssPaths = [
      'modules/gestion-integral/gestion-del-cambio/gestion-cambio-view.css',
      'modules/gestion-integral/gestion-del-cambio/gestion-cambio-modal.css',
    ];
    this.htmlPath = 'modules/gestion-integral/gestion-del-cambio/gestion-cambio-view.html';
  }

  /* ── Lifecycle ──────────────────────────────────────── */

  async render() {
    if (this.isDestroyed) return;
    try {
      await this.#loadStylesheets();
      this.container.innerHTML = '';
      this.container.innerHTML = await this.#loadHtmlFragment();
      this.#bindEvents();
      await this.#loadChanges();
    } catch (err) {
      console.error('[GestionDelCambioComponent] render():', err);
      this.container.innerHTML = `
        <div style="padding:2rem;text-align:center;color:#dc3545;">
          <h3>Error al cargar el módulo</h3><p>${err.message}</p>
          <button onclick="location.reload()" style="margin-top:1rem;padding:.5rem 1rem;cursor:pointer;">Reintentar</button>
        </div>`;
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.#unbindEvents();
    this.container.innerHTML = '';
  }

  /* ── CSS / HTML ─────────────────────────────────────── */

  async #loadStylesheets() {
    const promises = this.cssPaths.map(href => {
      if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
      return new Promise((res, rej) => {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = href;
        l.onload = res;
        l.onerror = () => rej(new Error(`CSS no cargado: ${href}`));
        document.head.appendChild(l);
      });
    });
    await Promise.all(promises);
  }

  async #loadHtmlFragment() {
    const r = await fetch(this.htmlPath);
    if (!r.ok) throw new Error(`HTML no cargado: ${this.htmlPath} (${r.status})`);
    return r.text();
  }

  /* ── Event Binding ──────────────────────────────────── */

  #bindEvents() {
    const q = id => this.container.querySelector(`#${id}`);

    // Botón volver al módulo
    q('kairGcBackBtn')?.addEventListener('click', () => {
      if (typeof this.onBackToModule === 'function') this.onBackToModule();
    });

    q('kairGcNewChangeBtn')?.addEventListener('click', () => this.#openModal());
    q('kairGcModalClose')?.addEventListener('click',  () => this.#closeModal());
    q('kairGcCancelBtn')?.addEventListener('click',   () => this.#closeModal());

    // Cerrar al click fuera
    q('kairGcModalOverlay')?.addEventListener('click', e => {
      if (e.target === q('kairGcModalOverlay')) this.#closeModal();
    });

    // Wizard nav
    q('kairGcNextBtn')?.addEventListener('click', () => this.#stepNext());
    q('kairGcPrevBtn')?.addEventListener('click', () => this.#stepPrev());
    q('kairGcSaveBtn')?.addEventListener('click', () => this.#saveChange());
    q('kairGcTransitionBtn')?.addEventListener('click', () => this.#handleTransitionClick());

    // Plan de acción
    q('kairGcAddActionRow')?.addEventListener('click', () => this.#addActionPlanRow());

    // ESC
    this._escHandler = e => { if (e.key === 'Escape') this.#closeModal(); };
    document.addEventListener('keydown', this._escHandler);
  }

  #unbindEvents() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  }

  /* ── Data Loading ───────────────────────────────────── */

  async #loadChanges() {
    const q   = id => this.container.querySelector(`#${id}`);
    const loading  = q('kairGcLoading');
    const empty    = q('kairGcEmptyState');
    const table    = q('kairGcChangesTable');

    loading?.classList.remove('kair-gc-hidden');
    empty?.classList.add('kair-gc-hidden');
    table?.classList.add('kair-gc-hidden');

    try {
      const result = await window.electronAPI.loadGestionCambioData(this.companyName);
      this.changes = (result.success && result.data?.changes) ? result.data.changes : [];
    } catch {
      this.changes = [];
    } finally {
      loading?.classList.add('kair-gc-hidden');
    }

    this.#renderMetrics();
    this.#renderPipeline();
    this.#renderTable();
  }

  /* ── Metrics ────────────────────────────────────────── */

  #renderMetrics() {
    const now    = new Date();
    const month  = now.getMonth();
    const year   = now.getFullYear();
    let pending = 0, highRisk = 0, active = 0, monthCount = 0;

    for (const ch of this.changes) {
      const estado = (ch.estado || '').toLowerCase();
      const riesgo = (ch.nivelRiesgo || '').toLowerCase();

      if (['solicitud', 'pendiente', 'en evaluación', 'en evaluacion', 'aprobado', 'aprobada'].includes(estado)) pending++;
      if (riesgo === 'alto') highRisk++;
      if (!['cerrado', 'cerrada', 'cancelado', 'no aprobado'].includes(estado)) active++;
      if (ch.fecha) {
        const d = new Date(ch.fecha);
        if (d.getMonth() === month && d.getFullYear() === year) monthCount++;
      }
    }

    const set = (id, v) => { const el = this.container.querySelector(`#${id}`); if (el) el.textContent = v; };
    set('kairGcMetricPending',  pending);
    set('kairGcMetricHighRisk', highRisk);
    set('kairGcMetricActive',   active);
    set('kairGcMetricMonth',    monthCount);
  }

  /* ── Pipeline ───────────────────────────────────────── */

  #renderPipeline() {
    const counts = { solicitud: 0, evaluacion: 0, aprobado: 0, ejecucion: 0, cerrado: 0 };

    for (const ch of this.changes) {
      const e = (ch.estado || '').toLowerCase();
      if (e === 'solicitud' || e === 'pendiente') counts.solicitud++;
      else if (e === 'en evaluación' || e === 'en evaluacion') counts.evaluacion++;
      else if (e === 'aprobado' || e === 'aprobada') counts.aprobado++;
      else if (e === 'en ejecución' || e === 'en ejecucion') counts.ejecucion++;
      else if (e === 'cerrado' || e === 'cerrada' || e === 'cancelado' || e === 'no aprobado') counts.cerrado++;
      else counts.solicitud++;
    }

    const set = (id, v) => { const el = this.container.querySelector(`#${id}`); if (el) el.textContent = v; };
    set('kairGcPipeSolicitud',  counts.solicitud);
    set('kairGcPipeEvaluacion', counts.evaluacion);
    set('kairGcPipeAprobado',   counts.aprobado);
    set('kairGcPipeEjecucion',  counts.ejecucion);
    set('kairGcPipeCerrado',    counts.cerrado);
  }

  /* ── Table ──────────────────────────────────────────── */

  #renderTable() {
    const tbody = this.container.querySelector('#kairGcTableBody');
    const empty = this.container.querySelector('#kairGcEmptyState');
    const table = this.container.querySelector('#kairGcChangesTable');
    if (!tbody) return;

    if (!this.changes.length) {
      tbody.innerHTML = '';
      empty?.classList.remove('kair-gc-hidden');
      table?.classList.add('kair-gc-hidden');
      return;
    }

    empty?.classList.add('kair-gc-hidden');
    table?.classList.remove('kair-gc-hidden');

    tbody.innerHTML = this.changes.map(ch => `
      <tr>
        <td><strong>${this.#esc(ch.id)}</strong></td>
        <td>${this.#esc(ch.fecha || '—')}</td>
        <td>${this.#esc(ch.areaEjecutora || '—')}</td>
        <td>${this.#esc(Array.isArray(ch.tipoCambio) ? ch.tipoCambio.join(', ') : (ch.tipoCambio || '—'))}</td>
        <td>${this.#esc(ch.responsable || '—')}</td>
        <td>${this.#riskBadge(ch.nivelRiesgo)}</td>
        <td>${this.#estadoBadge(ch.estado)}</td>
        <td>
          <div class="kair-gc-actions">
            ${this.#actionButtons(ch)}
          </div>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-action]').forEach(b => {
      b.addEventListener('click', () => {
        const id     = b.dataset.id;
        const action = b.dataset.action;
        const step   = parseInt(b.dataset.step) || 1;
        const ch     = this.changes.find(c => c.id === id);
        if (!ch) return;
        if (action === 'view') {
          this.#viewChange(id);
        } else {
          this.#openForChange(ch, step);
        }
      });
    });
  }

  /* ── Badges ─────────────────────────────────────────── */

  /* Botones de acción contextuales según el estado del cambio */
  #actionButtons(ch) {
    const id  = this.#esc(ch.id);
    const est = (ch.estado || 'Solicitud').toLowerCase();

    const viewBtn = `<button class="kair-gc-btn kair-gc-btn-ghost kair-gc-btn-sm" data-action="view" data-id="${id}">Ver</button>`;

    if (est === 'solicitud' || est === 'pendiente') {
      return `
        <button class="kair-gc-btn-action" style="color:#1565c0;border-color:#1565c0;"
          data-action="advance" data-id="${id}" data-step="1"
          title="Completar solicitud y enviar a evaluación">Enviar a Evaluación →</button>
        ${viewBtn}`;
    }
    if (est === 'en evaluación' || est === 'en evaluacion') {
      return `
        <button class="kair-gc-btn-action" style="color:#e65100;border-color:#e65100;"
          data-action="advance" data-id="${id}" data-step="2"
          title="Gestionar evaluación">Gestionar Evaluación →</button>
        ${viewBtn}`;
    }
    if (est === 'aprobado' || est === 'aprobada') {
      return `
        <button class="kair-gc-btn-action" style="color:#2e7d32;border-color:#2e7d32;"
          data-action="advance" data-id="${id}" data-step="3"
          title="Iniciar ejecución del cambio">Iniciar Ejecución →</button>
        ${viewBtn}`;
    }
    if (est === 'en ejecución' || est === 'en ejecucion') {
      return `
        <button class="kair-gc-btn-action" style="color:#6a1b9a;border-color:#6a1b9a;"
          data-action="advance" data-id="${id}" data-step="4"
          title="Registrar cierre del cambio">Cerrar Cambio →</button>
        ${viewBtn}`;
    }
    // Cerrado / No Aprobado — solo lectura
    return viewBtn;
  }

  #riskBadge(level) {
    const l = (level || '').toLowerCase();
    if (l.includes('alto'))  return '<span class="kair-gc-badge kair-gc-badge-high">Alto</span>';
    if (l.includes('medio')) return '<span class="kair-gc-badge kair-gc-badge-medium">Medio</span>';
    if (l.includes('bajo'))  return '<span class="kair-gc-badge kair-gc-badge-low">Bajo</span>';
    return '<span class="kair-gc-badge kair-gc-badge-low">—</span>';
  }

  #estadoBadge(estado) {
    const map = {
      'solicitud':       ['--solicitud',   'Solicitud'],
      'pendiente':       ['--solicitud',   'Solicitud'],
      'en evaluación':   ['--evaluacion',  'En Evaluación'],
      'en evaluacion':   ['--evaluacion',  'En Evaluación'],
      'aprobado':        ['--aprobado',    'Aprobado'],
      'aprobada':        ['--aprobado',    'Aprobado'],
      'no aprobado':     ['--no-aprobado', 'No Aprobado'],
      'en ejecución':    ['--ejecucion',   'En Ejecución'],
      'en ejecucion':    ['--ejecucion',   'En Ejecución'],
      'en proceso':      ['--ejecucion',   'En Proceso'],
      'cerrado':         ['--cerrado',     'Cerrado'],
      'cerrada':         ['--cerrado',     'Cerrado'],
      'cancelado':       ['--cerrado',     'Cancelado'],
    };
    const e = (estado || 'solicitud').toLowerCase();
    const [cls, label] = map[e] || ['--solicitud', estado || 'Solicitud'];
    return `<span class="kair-gc-badge kair-gc-badge${cls}">${this.#esc(label)}</span>`;
  }

  /* ── Wizard Navigation ──────────────────────────────── */

  #goToStep(step) {
    const prev = this.currentStep;
    this.currentStep = step;

    // Panels
    for (let i = 1; i <= this.totalSteps; i++) {
      const panel = this.container.querySelector(`#kairGcStep${i}`);
      if (panel) panel.classList.toggle('kair-gc-step-active', i === step);
    }

    // Step indicators in header bar
    this.container.querySelectorAll('.kair-gc-wizard-step').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.remove('kair-gc-step-active', 'kair-gc-step-done');
      if (s === step) el.classList.add('kair-gc-step-active');
      else if (s < step) el.classList.add('kair-gc-step-done');
    });

    // Step circle text — restore number for non-done steps
    this.container.querySelectorAll('.kair-gc-wizard-step').forEach(el => {
      const s    = parseInt(el.dataset.step);
      const circ = el.querySelector('.kair-gc-step-circle');
      if (circ) {
        if (s < step) {
          circ.textContent = '✓';
        } else {
          circ.textContent = String(s);
        }
      }
    });

    // Footer buttons
    const prevBtn        = this.container.querySelector('#kairGcPrevBtn');
    const nextBtn        = this.container.querySelector('#kairGcNextBtn');
    const saveBtn        = this.container.querySelector('#kairGcSaveBtn');
    const transitionBtn  = this.container.querySelector('#kairGcTransitionBtn');
    const indicator      = this.container.querySelector('#kairGcStepIndicator');

    if (prevBtn)  prevBtn.classList.toggle('kair-gc-hidden', step === 1);
    if (nextBtn)  nextBtn.classList.toggle('kair-gc-hidden', step === this.totalSteps);
    if (indicator) indicator.textContent = `Paso ${step} de ${this.totalSteps}`;

    // Guardar y botón de transición: lógica por estado
    const isLastStep = step === this.totalSteps;
    const transInfo  = this.#getTransitionInfo();

    // El paso "gatillo" para la transición es el paso donde el usuario
    // debe completar información antes de avanzar:
    //   Solicitud     → step 1  (completar identificación)
    //   En Evaluación → step 2  (completar checklist)
    //   Aprobado      → step 3  (completar aprobaciones)
    //   En Ejecución  → step 4  (completar cierre)
    const TRIGGER_STEP = {
      'solicitud': 1, 'pendiente': 1,
      'en evaluación': 2, 'en evaluacion': 2,
      'aprobado': 3, 'aprobada': 3,
      'en ejecución': 4, 'en ejecucion': 4,
    };
    const curEst     = (this.currentEstado || '').toLowerCase();
    const triggerAt  = TRIGGER_STEP[curEst] ?? this.totalSteps;
    const showTrans  = transInfo && step === triggerAt;

    if (saveBtn) saveBtn.classList.toggle('kair-gc-hidden', !isLastStep || !!transInfo);
    if (transitionBtn) {
      if (showTrans) {
        transitionBtn.classList.remove('kair-gc-hidden');
        transitionBtn.textContent = transInfo.label;
      } else {
        transitionBtn.classList.add('kair-gc-hidden');
      }
    }

    // Scroll modal body to top on step change
    const body = this.container.querySelector('.kair-gc-modal-body');
    if (body) body.scrollTop = 0;
  }

  #stepNext() {
    if (this.currentStep < this.totalSteps) this.#goToStep(this.currentStep + 1);
  }

  #stepPrev() {
    if (this.currentStep > 1) this.#goToStep(this.currentStep - 1);
  }

  /* ── Modal Open / Close ─────────────────────────────── */

  #openModal(changeData = null) {
    const overlay = this.container.querySelector('#kairGcModalOverlay');
    if (!overlay) return;

    this.editingId     = changeData?.id ?? null;
    this.currentEstado = changeData?.estado ?? null;

    const title    = this.container.querySelector('#kairGcModalTitle');
    const subtitle = this.container.querySelector('#kairGcModalSubtitle');

    if (title)    title.textContent    = changeData ? `Editar — ${changeData.id}` : 'Nuevo Cambio';
    if (subtitle) subtitle.textContent = 'GI-FO-058 / GI-FO-059 · Gestión del Cambio';

    if (!changeData) {
      this.#resetForm();
      this.#generateNewId();
      const today = new Date().toISOString().split('T')[0];
      const dateEl = this.container.querySelector('#kairGcChangeDate');
      if (dateEl) dateEl.value = today;
    } else {
      this.#resetForm();
      this.#populateForm(changeData);
    }

    this.#goToStep(1);
    overlay.classList.add('kair-gc-modal-active');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Abre el modal para un cambio existente posicionando en el paso adecuado
   * según su estado en la máquina de estados.
   */
  #openForChange(changeData, preferredStep = null) {
    this.#openModal(changeData);

    // Si se especificó paso, ir directo
    if (preferredStep && preferredStep >= 1 && preferredStep <= this.totalSteps) {
      this.#goToStep(preferredStep);
      return;
    }

    // Mapear estado → paso de trabajo principal
    const stepByEstado = {
      'solicitud':      1,
      'pendiente':      1,
      'en evaluación':  2,
      'en evaluacion':  2,
      'aprobado':       3,
      'aprobada':       3,
      'no aprobado':    2,
      'en ejecución':   4,
      'en ejecucion':   4,
      'cerrado':        4,
      'cerrada':        4,
    };
    const e    = (changeData.estado || 'solicitud').toLowerCase();
    const step = stepByEstado[e] ?? 1;
    this.#goToStep(step);
  }

  #closeModal() {
    const overlay = this.container.querySelector('#kairGcModalOverlay');
    if (!overlay) return;
    overlay.classList.remove('kair-gc-modal-active');
    document.body.style.overflow = '';
    this.editingId     = null;
    this.currentEstado = null;
  }

  /* ── Form Helpers ───────────────────────────────────── */

  #resetForm() {
    this.container.querySelector('#kairGcChangeForm')?.reset();
    // Limpiar campos extra no cubiertos por form.reset()
    const extraIds = [
      'kairGcCtrlElimDesc','kairGcCtrlElimResp','kairGcCtrlElimDate',
      'kairGcCtrlSubDesc', 'kairGcCtrlSubResp', 'kairGcCtrlSubDate',
      'kairGcCtrlEngDesc', 'kairGcCtrlEngResp', 'kairGcCtrlEngDate',
      'kairGcCtrlAdmDesc', 'kairGcCtrlAdmResp', 'kairGcCtrlAdmDate',
      'kairGcCtrlEppDesc', 'kairGcCtrlEppResp', 'kairGcCtrlEppDate',
    ];
    extraIds.forEach(id => {
      const el = this.container.querySelector(`#${id}`);
      if (el) el.value = '';
    });
    // Limpiar plan de acción
    const tbody = this.container.querySelector('#kairGcActionPlanBody');
    if (tbody) tbody.innerHTML = '';
    // Agregar fila inicial vacía
    this.#addActionPlanRow();
  }

  async #generateNewId() {
    try {
      const r = await window.electronAPI.generateGestionCambioId(this.companyName);
      if (r.success && r.data) {
        const el = this.container.querySelector('#kairGcChangeId');
        if (el) el.value = r.data.id;
      }
    } catch {
      const el = this.container.querySelector('#kairGcChangeId');
      const yr = new Date().getFullYear();
      if (el) el.value = `CHG-${yr}-${String(this.changes.length + 1).padStart(3, '0')}`;
    }
  }

  #populateForm(d) {
    const set = (id, val) => {
      const el = this.container.querySelector(`#${id}`);
      if (el) el.value = val ?? '';
    };
    const radio = (name, val) => {
      if (!val) return;
      const el = this.container.querySelector(`input[name="${name}"][value="${val}"]`);
      if (el) el.checked = true;
    };

    // Paso 1
    set('kairGcChangeId',      d.id);
    set('kairGcChangeDate',    d.fecha);
    set('kairGcExecutingArea', d.areaEjecutora);
    set('kairGcImplDate',      d.fechaImplementacion);
    set('kairGcUserArea',      d.areaUsuaria);
    set('kairGcResponsible',   d.responsable);
    set('kairGcPosition',      d.cargo);
    set('kairGcDescription',   d.descripcion);
    set('kairGcJustification', d.justificacion);

    if (d.tipoCambio) {
      const tipos = Array.isArray(d.tipoCambio) ? d.tipoCambio : [d.tipoCambio];
      this.container.querySelectorAll('input[name="kairGcTipoCambio"]').forEach(cb => {
        cb.checked = tipos.includes(cb.value);
      });
    }

    // Paso 2 — checklist
    const cl = d.checklist || {};
    ['Rh1','Rh2','Rh3','Rh4','Rl1','Rl2','Rl3','Sst1','Sst2','Sst3','Sst4','Sst5','Sst6'].forEach(k => {
      const key = k.charAt(0).toLowerCase() + k.slice(1);
      radio(`kairGc${k}`, cl[key]);
    });
    // campos especifique / responsable checklist
    const clFields = [
      'Rh1','Rh2','Rh3','Rh4','Rl1','Rl2','Rl3',
      'Sst1','Sst2','Sst3','Sst4','Sst5','Sst6',
    ];
    clFields.forEach(k => {
      const key = k.charAt(0).toLowerCase() + k.slice(1);
      set(`kairGc${k}Esp`,  cl[`${key}Esp`]);
      set(`kairGc${k}Resp`, cl[`${key}Resp`]);
    });

    radio('kairGcDecision', d.decision);
    set('kairGcAccionesRequeridas', d.accionesRequeridas);

    // Paso 3 — evaluación
    radio('kairGcNewHazards', d.introducePeligros ? 'SI' : (d.introducePeligros === false ? 'NO' : ''));
    radio('kairGcModRisks',   d.modificaRiesgos   ? 'SI' : (d.modificaRiesgos   === false ? 'NO' : ''));
    set('kairGcNewHazardsDesc',   d.peligroAfectado1);
    set('kairGcModRisksDesc',     d.peligroAfectado2);
    set('kairGcHazard1MatrizDate',d.hazard1MatrizDate);
    set('kairGcHazard1Firma',     d.hazard1Firma);
    set('kairGcRisk2MatrizDate',  d.risk2MatrizDate);
    set('kairGcRisk2Firma',       d.risk2Firma);
    set('kairGcRiskBefore',       d.riesgoAntes);
    set('kairGcRiskAfter',        d.riesgoDespues);

    if (d.controles) {
      const c = d.controles;
      set('kairGcCtrlElimDesc', c.eliminacion?.descripcion);
      set('kairGcCtrlElimResp', c.eliminacion?.responsable);
      set('kairGcCtrlElimDate', c.eliminacion?.fecha);
      set('kairGcCtrlSubDesc',  c.sustitucion?.descripcion);
      set('kairGcCtrlSubResp',  c.sustitucion?.responsable);
      set('kairGcCtrlSubDate',  c.sustitucion?.fecha);
      set('kairGcCtrlEngDesc',  c.ingenieria?.descripcion);
      set('kairGcCtrlEngResp',  c.ingenieria?.responsable);
      set('kairGcCtrlEngDate',  c.ingenieria?.fecha);
      set('kairGcCtrlAdmDesc',  c.administrativos?.descripcion);
      set('kairGcCtrlAdmResp',  c.administrativos?.responsable);
      set('kairGcCtrlAdmDate',  c.administrativos?.fecha);
      set('kairGcCtrlEppDesc',  c.epp?.descripcion);
      set('kairGcCtrlEppResp',  c.epp?.responsable);
      set('kairGcCtrlEppDate',  c.epp?.fecha);
    }

    radio('kairGcNivelRiesgo', d.nivelRiesgo);

    // Paso 4 — plan, aprobaciones, ejecución
    if (d.planAccion?.length) {
      const tbody = this.container.querySelector('#kairGcActionPlanBody');
      if (tbody) {
        tbody.innerHTML = '';
        d.planAccion.forEach(act => this.#addActionPlanRow(act));
      }
    }

    set('kairGcApprovalAreaDate',  d.aprobaciones?.areaFecha);
    set('kairGcApprovalAreaSign',  d.aprobaciones?.areaFirma);
    set('kairGcApprovalSstDate',   d.aprobaciones?.sstFecha);
    set('kairGcApprovalSstSign',   d.aprobaciones?.sstFirma);
    set('kairGcApprovalMgmtDate',  d.aprobaciones?.gerenciaFecha);
    set('kairGcApprovalMgmtSign',  d.aprobaciones?.gerenciaFirma);

    set('kairGcExecDate',   d.fechaEjecucion);
    radio('kairGcControlsImplemented', d.controlesImplementados);
    set('kairGcExecObs',    d.observacionesEjecucion);
    set('kairGcVerifyDate', d.fechaVerificacion);
    radio('kairGcControlsEffective', d.controlesEficaces);
    set('kairGcIncidents',  d.incidentes);
    set('kairGcCloseDate',  d.fechaCierre);
    set('kairGcConclusion', d.conclusion);
  }

  /* ── Collect Form Data ──────────────────────────────── */

  #collectFormData() {
    const get   = id   => this.container.querySelector(`#${id}`)?.value?.trim() ?? '';
    const radio = name => this.container.querySelector(`input[name="${name}"]:checked`)?.value ?? '';
    const checks = name => [...this.container.querySelectorAll(`input[name="${name}"]:checked`)].map(c => c.value);

    const cl = {};
    ['Rh1','Rh2','Rh3','Rh4','Rl1','Rl2','Rl3','Sst1','Sst2','Sst3','Sst4','Sst5','Sst6'].forEach(k => {
      const key = k.charAt(0).toLowerCase() + k.slice(1);
      cl[key]           = radio(`kairGc${k}`);
      cl[`${key}Esp`]   = get(`kairGc${k}Esp`);
      cl[`${key}Resp`]  = get(`kairGc${k}Resp`);
    });

    const rows = [...this.container.querySelectorAll('#kairGcActionPlanBody tr')];
    const planAccion = rows.map(row => {
      const ins = row.querySelectorAll('input, select');
      return {
        actividad:    ins[0]?.value ?? '',
        responsable:  ins[1]?.value ?? '',
        fechaInicio:  ins[2]?.value ?? '',
        fechaFin:     ins[3]?.value ?? '',
        estado:       ins[4]?.value ?? 'Pendiente',
      };
    }).filter(r => r.actividad || r.responsable);

    const nivelRiesgo = radio('kairGcNivelRiesgo');

    return {
      id:                   get('kairGcChangeId'),
      fecha:                get('kairGcChangeDate'),
      fechaImplementacion:  get('kairGcImplDate'),
      areaEjecutora:        get('kairGcExecutingArea'),
      areaUsuaria:          get('kairGcUserArea'),
      responsable:          get('kairGcResponsible'),
      cargo:                get('kairGcPosition'),
      descripcion:          get('kairGcDescription'),
      justificacion:        get('kairGcJustification'),
      tipoCambio:           checks('kairGcTipoCambio'),
      checklist:            cl,
      decision:             radio('kairGcDecision'),
      accionesRequeridas:   get('kairGcAccionesRequeridas'),
      introducePeligros:    radio('kairGcNewHazards') === 'SI',
      modificaRiesgos:      radio('kairGcModRisks')   === 'SI',
      peligroAfectado1:     get('kairGcNewHazardsDesc'),
      peligroAfectado2:     get('kairGcModRisksDesc'),
      hazard1MatrizDate:    get('kairGcHazard1MatrizDate'),
      hazard1Firma:         get('kairGcHazard1Firma'),
      risk2MatrizDate:      get('kairGcRisk2MatrizDate'),
      risk2Firma:           get('kairGcRisk2Firma'),
      riesgoAntes:          get('kairGcRiskBefore'),
      riesgoDespues:        get('kairGcRiskAfter'),
      controles: {
        eliminacion:     { descripcion: get('kairGcCtrlElimDesc'), responsable: get('kairGcCtrlElimResp'), fecha: get('kairGcCtrlElimDate') },
        sustitucion:     { descripcion: get('kairGcCtrlSubDesc'),  responsable: get('kairGcCtrlSubResp'),  fecha: get('kairGcCtrlSubDate') },
        ingenieria:      { descripcion: get('kairGcCtrlEngDesc'),  responsable: get('kairGcCtrlEngResp'),  fecha: get('kairGcCtrlEngDate') },
        administrativos: { descripcion: get('kairGcCtrlAdmDesc'),  responsable: get('kairGcCtrlAdmResp'),  fecha: get('kairGcCtrlAdmDate') },
        epp:             { descripcion: get('kairGcCtrlEppDesc'),  responsable: get('kairGcCtrlEppResp'),  fecha: get('kairGcCtrlEppDate') },
      },
      nivelRiesgo,
      planAccion,
      aprobaciones: {
        areaFecha:      get('kairGcApprovalAreaDate'),
        areaFirma:      get('kairGcApprovalAreaSign'),
        sstFecha:       get('kairGcApprovalSstDate'),
        sstFirma:       get('kairGcApprovalSstSign'),
        gerenciaFecha:  get('kairGcApprovalMgmtDate'),
        gerenciaFirma:  get('kairGcApprovalMgmtSign'),
      },
      fechaEjecucion:          get('kairGcExecDate'),
      controlesImplementados:  radio('kairGcControlsImplemented'),
      observacionesEjecucion:  get('kairGcExecObs'),
      fechaVerificacion:       get('kairGcVerifyDate'),
      controlesEficaces:       radio('kairGcControlsEffective'),
      incidentes:              get('kairGcIncidents'),
      fechaCierre:             get('kairGcCloseDate'),
      conclusion:              get('kairGcConclusion'),
      estado:                  this.editingId ? (this.changes.find(c => c.id === this.editingId)?.estado || 'Solicitud') : 'Solicitud',
    };
  }

  /* ── Save ───────────────────────────────────────────── */

  async #saveChange() {
    const get = id => this.container.querySelector(`#${id}`)?.value ?? '';
    if (!get('kairGcChangeDate') || !get('kairGcExecutingArea') ||
        !get('kairGcResponsible') || !get('kairGcDescription')) {
      this.#showToast('Complete los campos obligatorios: Fecha, Área Ejecutora, Responsable, Descripción.', 'error');
      this.#goToStep(1);
      return;
    }

    const data = this.#collectFormData();
    try {
      const r = await window.electronAPI.saveGestionCambioData(this.companyName, data);
      if (r.success) {
        this.#showToast('Cambio guardado exitosamente.', 'success');
        this.#closeModal();
        await this.#loadChanges();
      } else {
        this.#showToast(`Error al guardar: ${r.error?.message || 'Error desconocido'}`, 'error');
      }
    } catch (err) {
      console.error('[GestionDelCambioComponent] saveChange:', err);
      this.#showToast('Error de comunicación con el backend.', 'error');
    }
  }

  /* ── Edit / View ────────────────────────────────────── */

  #editChange(id) {
    const ch = this.changes.find(c => c.id === id);
    if (!ch) { this.#showToast('Cambio no encontrado.', 'warning'); return; }
    this.#openForChange(ch);
  }

  #viewChange(id) {
    const ch = this.changes.find(c => c.id === id);
    if (!ch) { this.#showToast('Cambio no encontrado.', 'warning'); return; }
    this.#openModal(ch);
    setTimeout(() => {
      this.container.querySelectorAll('#kairGcChangeForm input, #kairGcChangeForm select, #kairGcChangeForm textarea')
        .forEach(el => { el.disabled = true; });
      const saveBtn = this.container.querySelector('#kairGcSaveBtn');
      if (saveBtn) saveBtn.style.display = 'none';
    }, 80);
  }

  /* ── Action Plan Row ────────────────────────────────── */

  #addActionPlanRow(data = {}) {
    const tbody = this.container.querySelector('#kairGcActionPlanBody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="kair-gc-input" value="${this.#esc(data.actividad || '')}" placeholder="Actividad"></td>
      <td><input type="text" class="kair-gc-input" value="${this.#esc(data.responsable || '')}" placeholder="Responsable"></td>
      <td><input type="date" class="kair-gc-input" value="${this.#esc(data.fechaInicio || '')}"></td>
      <td><input type="date" class="kair-gc-input" value="${this.#esc(data.fechaFin || '')}"></td>
      <td>
        <select class="kair-gc-select">
          <option value="Pendiente"  ${data.estado === 'Pendiente'  ? 'selected' : ''}>Pendiente</option>
          <option value="En Proceso" ${data.estado === 'En Proceso' ? 'selected' : ''}>En Proceso</option>
          <option value="Completado" ${data.estado === 'Completado' ? 'selected' : ''}>Completado</option>
        </select>
      </td>
      <td>
        <button type="button" class="kair-gc-btn kair-gc-btn-ghost kair-gc-btn-sm" title="Eliminar fila" style="padding:.2rem .4rem;color:#dc3545;">✕</button>
      </td>`;

    tr.querySelector('button').addEventListener('click', () => tr.remove());
    tbody.appendChild(tr);
  }

  /* ── Toast ──────────────────────────────────────────── */

  #showToast(msg, type = 'success') {
    document.querySelectorAll('.kair-gc-toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = `kair-gc-toast kair-gc-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.cssText += 'opacity:0;transform:translateY(16px);transition:all .3s ease;';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  /* ── Máquina de Estados ─────────────────────────────── */

  /**
   * Retorna la información de transición disponible para el estado actual,
   * o null si no hay transición posible (Cerrado, No Aprobado).
   */
  #getTransitionInfo() {
    const TRANSITIONS = {
      'solicitud':      { next: 'En Evaluación', label: 'Enviar a Evaluación →' },
      'pendiente':      { next: 'En Evaluación', label: 'Enviar a Evaluación →' },
      'en evaluación':  { next: 'Aprobado',      label: 'Aprobar y Avanzar →' },
      'en evaluacion':  { next: 'Aprobado',      label: 'Aprobar y Avanzar →' },
      'aprobado':       { next: 'En Ejecución',  label: 'Iniciar Ejecución →' },
      'aprobada':       { next: 'En Ejecución',  label: 'Iniciar Ejecución →' },
      'en ejecución':   { next: 'Cerrado',       label: 'Cerrar Cambio ✓' },
      'en ejecucion':   { next: 'Cerrado',       label: 'Cerrar Cambio ✓' },
    };
    const e = (this.currentEstado || '').toLowerCase();
    return TRANSITIONS[e] ?? null;
  }

  /**
   * Valida que los campos mínimos estén completos para la transición destino.
   * Retorna array de mensajes de error (vacío = válido).
   */
  #validateForTransition(targetEstado) {
    const get   = id   => this.container.querySelector(`#${id}`)?.value?.trim() ?? '';
    const radio = name => this.container.querySelector(`input[name="${name}"]:checked`)?.value ?? '';
    const errors = [];

    // Siempre requerir campos base del Paso 1
    if (!get('kairGcChangeDate'))    errors.push('Fecha del cambio requerida');
    if (!get('kairGcExecutingArea')) errors.push('Área Ejecutora requerida');
    if (!get('kairGcResponsible'))   errors.push('Responsable requerido');
    if (!get('kairGcDescription'))   errors.push('Descripción del cambio requerida');

    if (targetEstado === 'Aprobado' || targetEstado === 'No Aprobado') {
      // Verificar que todos los 13 ítems del checklist estén respondidos
      const clItems = ['Rh1','Rh2','Rh3','Rh4','Rl1','Rl2','Rl3','Sst1','Sst2','Sst3','Sst4','Sst5','Sst6'];
      const missing = clItems.filter(k => !radio(`kairGc${k}`));
      if (missing.length > 0) errors.push(`Lista de chequeo incompleta (${missing.length} ítem(s) sin responder)`);
      if (!radio('kairGcNivelRiesgo')) errors.push('Nivel de riesgo requerido');
    }

    if (targetEstado === 'En Ejecución') {
      if (!get('kairGcApprovalSstDate') && !get('kairGcApprovalAreaDate')) {
        errors.push('Se requiere al menos una fecha de aprobación');
      }
    }

    if (targetEstado === 'Cerrado') {
      if (!get('kairGcExecDate'))   errors.push('Fecha de ejecución requerida');
      if (!get('kairGcCloseDate'))  errors.push('Fecha de cierre requerida');
    }

    return errors;
  }

  /** Maneja el clic en el botón de transición (en el footer del wizard). */
  async #handleTransitionClick() {
    const transInfo = this.#getTransitionInfo();
    if (!transInfo) return;

    // Para "En Evaluación → Aprobado" también ofrecer rechazar
    const est = (this.currentEstado || '').toLowerCase();
    if (est === 'en evaluación' || est === 'en evaluacion') {
      await this.#promptApprovalDecision();
      return;
    }

    await this.#transitionEstado(transInfo.next);
  }

  /**
   * Para el estado En Evaluación muestra un diálogo inline (confirm) para
   * elegir entre Aprobar o Rechazar.
   */
  async #promptApprovalDecision() {
    const decision = window.confirm(
      '¿Aprobar este cambio?\n\n' +
      'Aceptar → Pasa a "Aprobado"\n' +
      'Cancelar → Pasa a "No Aprobado"'
    );
    await this.#transitionEstado(decision ? 'Aprobado' : 'No Aprobado');
  }

  /**
   * Ejecuta la transición de estado: valida, guarda datos actuales y
   * llama al handler IPC de actualización.
   */
  async #transitionEstado(nuevoEstado) {
    // 1. Guardar datos del formulario primero (para no perder ediciones)
    const data = this.#collectFormData();

    // 2. Validar campos mínimos
    const errors = this.#validateForTransition(nuevoEstado);
    if (errors.length > 0) {
      this.#showToast(`Complete los campos requeridos:\n• ${errors.join('\n• ')}`, 'error');
      // Ir al primer paso con error
      if (errors.some(e => e.includes('Fecha del cambio') || e.includes('Área') ||
                           e.includes('Responsable') || e.includes('Descripción'))) {
        this.#goToStep(1);
      } else if (errors.some(e => e.includes('checklist') || e.includes('riesgo'))) {
        this.#goToStep(2);
      }
      return;
    }

    // 3. Guardar estado actual del formulario
    try {
      const saveResult = await window.electronAPI.saveGestionCambioData(this.companyName, data);
      if (!saveResult.success) {
        this.#showToast(`Error al guardar: ${saveResult.error?.message || 'Error desconocido'}`, 'error');
        return;
      }
    } catch (err) {
      this.#showToast('Error de comunicación al guardar.', 'error');
      return;
    }

    // 4. Llamar al handler de transición de estado
    const extraData = {};
    if (nuevoEstado === 'Cerrado') {
      extraData.fechaCierre    = data.fechaCierre || new Date().toISOString().split('T')[0];
    }
    if (nuevoEstado === 'En Ejecución') {
      extraData.fechaEjecucion = data.fechaEjecucion || '';
    }

    try {
      const r = await window.electronAPI.updateGestionCambioEstado(
        this.companyName, data.id, nuevoEstado, extraData
      );

      if (r.success) {
        this.#showToast(`Estado actualizado: "${r.data.estadoAnterior}" → "${nuevoEstado}"`, 'success');
        this.#closeModal();
        await this.#loadChanges();
      } else {
        this.#showToast(`Error al cambiar estado: ${r.error?.message || 'Error desconocido'}`, 'error');
      }
    } catch (err) {
      console.error('[GestionDelCambio] transitionEstado:', err);
      this.#showToast('Error de comunicación al actualizar estado.', 'error');
    }
  }

  /* ── Utils ──────────────────────────────────────────── */

  #esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }
}

window.GestionDelCambioComponent = GestionDelCambioComponent;
console.log('[GestionDelCambioComponent] ✅ Registrado');
