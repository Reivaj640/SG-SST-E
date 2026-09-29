/* ============================================================
   K+AIR · Gestión del Cambio (2.11.1) — premium v2
   Componente con marcado embebido (un solo archivo, sin
   fragmentos HTML ni hojas viejas). Misma firma de constructor
   que la versión anterior para no tocar renderer.js:
   (container, companyName, moduleName, submoduleName, onBackToModule)

   DATOS — se conserva EXACTAMENTE el contrato de la versión anterior:
     · window.electronAPI.loadGestionCambioData(companyName)
     · window.electronAPI.saveGestionCambioData(companyName, data)
     · window.electronAPI.generateGestionCambioId(companyName)
     · window.electronAPI.updateGestionCambioEstado(companyName, id, estado, extra)
   El backend sigue guardando en el Excel de la empresa.

   LECCIONES APLICADAS (de los paquetes anteriores):
     · Overlays y avisos se mudan al <body> y se retiran en destroy()
       Y con un vigía (MutationObserver) porque renderer.js solo destruye
       el componente activo cuando el siguiente se monta por
       createComponentSafely (bug del modal flotante, 📦771).
     · ESC ligado una sola vez y desligado en destroy().
     · Re-render: limpiar antes las capas del body (sin duplicados).
   ============================================================ */

(function () {
  'use strict';

  var TAG = 'K+AIRGDC';
  function klog(mod, acc, st, extra) {
    var linea = '[' + TAG + '][' + mod + '][' + acc + '][' + st + ']' + (extra ? ' ' + extra : '');
    if (st === 'ERR') console.warn(linea); else console.log(linea);
  }

  /* Lista de chequeo — 13 ítems literales (igual que la versión anterior) */
  var CHECKLIST = [
    { k: 'Rh1',  q: '¿El cambio implica modificación de funciones o tareas?' },
    { k: 'Rh2',  q: '¿Requiere capacitación previa al cambio?' },
    { k: 'Rh3',  q: '¿Afecta turnos, horarios o carga laboral?' },
    { k: 'Rh4',  q: '¿Involucra contratistas o terceros?' },
    { k: 'Rl1',  q: '¿El cambio genera nuevos requisitos legales aplicables?' },
    { k: 'Rl2',  q: '¿Requiere actualización de procedimientos del SG-SST?' },
    { k: 'Rl3',  q: '¿Requiere actualización de la matriz legal?' },
    { k: 'Sst1', q: '¿El cambio introduce nuevos peligros?' },
    { k: 'Sst2', q: '¿Modifica riesgos existentes?' },
    { k: 'Sst3', q: '¿Incrementa el nivel de riesgo actual?' },
    { k: 'Sst4', q: '¿Requiere controles adicionales?' },
    { k: 'Sst5', q: '¿Requiere EPP adicional o diferente?' },
    { k: 'Sst6', q: '¿Requiere actualización obligatoria de la matriz de peligros?' }
  ];
  var CLAVES = CHECKLIST.map(function (i) { return i.k; });

  var TIPOS_CAMBIO = ['Operativo', 'Organizacional', 'Tecnológico', 'Locativo',
    'Personal', 'Temporal', 'Permanente', 'Emergencia'];

  var CONTROLES = [
    { k: 'elim', nombre: 'Eliminación' },
    { k: 'sub',  nombre: 'Sustitución' },
    { k: 'ing',  nombre: 'Ingeniería' },
    { k: 'adm',  nombre: 'Administrativos' },
    { k: 'epp',  nombre: 'EPP' }
  ];

  var ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  /* ══════════════ Marcado ══════════════ */
  var MARCADO = [
    '<div class="gdc-app">',
    /* ── Header ── */
    '  <header class="gdc-header">',
    '    <div class="gdc-header__bar">',
    '      <div class="gdc-header__id">',
    '        <span class="gdc-header__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></span>',
    '        <div>',
    '          <h1 class="gdc-header__title">Gestión del Cambio</h1>',
    '          <p class="gdc-header__sub">2.11.1 · Gestión Integral — Identifica, evalúa y controla los cambios antes de ejecutarlos</p>',
    '        </div>',
    '      </div>',
    '      <div class="gdc-header__actions">',
    '        <span class="gdc-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11"/><path d="M2 21h20"/><path d="M7 8h4M7 12h4M7 16h4"/></svg><span id="gdc-chip-emp">—</span></span>',
    '        <button type="button" class="gdc-btn gdc-btn--primary" id="gdc-new"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Nuevo Cambio</button>',
    '        <button type="button" class="gdc-btn gdc-btn--ghost" id="gdc-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>Volver</button>',
    '      </div>',
    '    </div>',
    '  </header>',
    /* ── KPIs ── */
    '  <section class="gdc-kpis" aria-label="Resumen">',
    '    <div class="gdc-kpi gdc-kpi--amber"><span class="gdc-kpi__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></span><div><div class="gdc-kpi__value" id="gdc-k-pend">0</div><div class="gdc-kpi__label">Pendientes</div></div></div>',
    '    <div class="gdc-kpi gdc-kpi--red"><span class="gdc-kpi__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span><div><div class="gdc-kpi__value" id="gdc-k-alto">0</div><div class="gdc-kpi__label">Alto Riesgo</div></div></div>',
    '    <div class="gdc-kpi gdc-kpi--blue"><span class="gdc-kpi__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></span><div><div class="gdc-kpi__value" id="gdc-k-activos">0</div><div class="gdc-kpi__label">Activos</div></div></div>',
    '    <div class="gdc-kpi gdc-kpi--green"><span class="gdc-kpi__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg></span><div><div class="gdc-kpi__value" id="gdc-k-mes">0</div><div class="gdc-kpi__label">Este Mes</div></div></div>',
    '  </section>',
    /* ── Pipeline ── */
    '  <section class="gdc-pipeline" aria-label="Flujo de estados">',
    '    <div class="gdc-pipe gdc-pipe--sol"><span class="gdc-pipe__dot"></span><span class="gdc-pipe__count" id="gdc-p-sol">0</span><span class="gdc-pipe__label">Solicitud</span></div>',
    '    <div class="gdc-pipe gdc-pipe--eva"><span class="gdc-pipe__dot"></span><span class="gdc-pipe__count" id="gdc-p-eva">0</span><span class="gdc-pipe__label">En Evaluación</span></div>',
    '    <div class="gdc-pipe gdc-pipe--apr"><span class="gdc-pipe__dot"></span><span class="gdc-pipe__count" id="gdc-p-apr">0</span><span class="gdc-pipe__label">Aprobado</span></div>',
    '    <div class="gdc-pipe gdc-pipe--eje"><span class="gdc-pipe__dot"></span><span class="gdc-pipe__count" id="gdc-p-eje">0</span><span class="gdc-pipe__label">En Ejecución</span></div>',
    '    <div class="gdc-pipe gdc-pipe--cer"><span class="gdc-pipe__dot"></span><span class="gdc-pipe__count" id="gdc-p-cer">0</span><span class="gdc-pipe__label">Cerrado</span></div>',
    '  </section>',
    /* ── Registro ── */
    '  <section class="gdc-card">',
    '    <div class="gdc-card__head">',
    '      <h2 class="gdc-card__title">Registro de Cambios</h2>',
    '      <div class="gdc-card__filters">',
    '        <select class="gdc-select" id="gdc-f-estado" aria-label="Filtrar por estado">',
    '          <option value="">Todos los Estados</option>',
    '          <option value="solicitud">Solicitud</option>',
    '          <option value="evaluacion">En Evaluación</option>',
    '          <option value="aprobado">Aprobado</option>',
    '          <option value="ejecucion">En Ejecución</option>',
    '          <option value="cerrado">Cerrado</option>',
    '          <option value="no-aprobado">No Aprobado</option>',
    '        </select>',
    '        <select class="gdc-select" id="gdc-f-riesgo" aria-label="Filtrar por riesgo">',
    '          <option value="">Todos los Riesgos</option>',
    '          <option value="alto">Alto</option>',
    '          <option value="medio">Medio</option>',
    '          <option value="bajo">Bajo</option>',
    '        </select>',
    '      </div>',
    '    </div>',
    '    <div class="gdc-loading" id="gdc-loading"><span class="gdc-spinner"></span>Cargando cambios…</div>',
    '    <div class="gdc-empty gdc-hidden" id="gdc-empty">',
    '      <span class="gdc-empty__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 13h6M9 17h6"/></svg></span>',
    '      <h3 class="gdc-empty__title">No hay cambios registrados</h3>',
    '      <p class="gdc-empty__desc">Registra el primer cambio para comenzar a evaluarlo, aprobarlo y darle seguimiento hasta el cierre.</p>',
    '    </div>',
    '    <div class="gdc-tbl-scroll gdc-hidden" id="gdc-table">',
    '      <table class="gdc-table">',
    '        <thead><tr><th>ID</th><th>Fecha</th><th>Área Ejecutora</th><th>Tipo</th><th>Responsable</th><th>Riesgo</th><th>Estado</th><th>Acciones</th></tr></thead>',
    '        <tbody id="gdc-tbody"></tbody>',
    '      </table>',
    '    </div>',
    '  </section>',
    '</div>',
    /* ── Modal asistente (se muda al body) ── */
    '<div class="gdc-overlay" id="gdc-overlay">',
    '  <div class="gdc-modal" role="dialog" aria-modal="true" aria-labelledby="gdc-modal-title">',
    '    <div class="gdc-modal__head">',
    '      <span class="gdc-modal__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 13h6M9 17h4"/></svg></span>',
    '      <div><h2 class="gdc-modal__title" id="gdc-modal-title">Nuevo Cambio</h2><p class="gdc-modal__sub" id="gdc-modal-sub">GI-FO-058 / GI-FO-059 · Gestión del Cambio</p></div>',
    '      <button type="button" class="gdc-modal__close" id="gdc-modal-close" aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>',
    '    </div>',
    '    <div class="gdc-stepper" id="gdc-stepper">',
    '      <div class="gdc-wstep gdc-active" data-step="1"><span class="gdc-wstep__circle">1</span><span class="gdc-wstep__label">Identificación</span></div>',
    '      <div class="gdc-wstep" data-step="2"><span class="gdc-wstep__circle">2</span><span class="gdc-wstep__label">Lista de Chequeo</span></div>',
    '      <div class="gdc-wstep" data-step="3"><span class="gdc-wstep__circle">3</span><span class="gdc-wstep__label">Evaluación y Controles</span></div>',
    '      <div class="gdc-wstep" data-step="4"><span class="gdc-wstep__circle">4</span><span class="gdc-wstep__label">Plan y Cierre</span></div>',
    '      <span class="gdc-step-ind" id="gdc-step-ind">Paso 1 de 4</span>',
    '    </div>',
    '    <div class="gdc-modal__body">',
    '      <form id="gdc-form" novalidate>',
    /* ══ PASO 1 · Identificación ══ */
    '        <section class="gdc-step gdc-active" data-step="1">',
    '          <div class="gdc-sec"><h3 class="gdc-sec__title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>Identificación del cambio</h3>',
    '            <div class="gdc-grid">',
    '              <div class="gdc-field"><label class="gdc-field__label">ID del cambio</label><input class="gdc-input" id="gdc-id" readonly placeholder="Auto-generado"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Fecha del cambio <b>*</b></label><input type="date" class="gdc-input" id="gdc-fecha"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Área ejecutora <b>*</b></label><input class="gdc-input" id="gdc-area-ejec" placeholder="Ej.: RRHH, Mantenimiento"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Fecha de implementación</label><input type="date" class="gdc-input" id="gdc-fecha-impl"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Área usuaria</label><input class="gdc-input" id="gdc-area-usu" placeholder="Área que recibe el cambio"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Responsable <b>*</b></label><input class="gdc-input" id="gdc-responsable" placeholder="Nombre de quien solicita"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Cargo</label><input class="gdc-input" id="gdc-cargo" placeholder="Cargo del responsable"></div>',
    '              <div class="gdc-field gdc-field--full"><label class="gdc-field__label">Descripción del cambio <b>*</b></label><textarea class="gdc-textarea" id="gdc-descripcion" placeholder="Describa qué cambia, cómo y dónde"></textarea></div>',
    '              <div class="gdc-field gdc-field--full"><label class="gdc-field__label">Justificación</label><textarea class="gdc-textarea" id="gdc-justificacion" placeholder="Motivo del cambio y beneficio esperado"></textarea></div>',
    '              <div class="gdc-field gdc-field--full"><label class="gdc-field__label">Tipo de cambio</label><div class="gdc-checks" id="gdc-tipos"></div></div>',
    '            </div>',
    '          </div>',
    '        </section>',
    /* ══ PASO 2 · Lista de chequeo ══ */
    '        <section class="gdc-step" data-step="2">',
    '          <div class="gdc-sec"><h3 class="gdc-sec__title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Lista de chequeo de evaluación</h3>',
    '            <div class="gdc-mini-wrap"><table class="gdc-mini"><thead><tr><th>#</th><th>Pregunta</th><th>SI</th><th>NO</th><th>NA</th><th>Especifique</th><th>Responsable</th></tr></thead><tbody id="gdc-cl-body"></tbody></table></div>',
    '          </div>',
    '          <div class="gdc-sec"><h3 class="gdc-sec__title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Decisión de la evaluación</h3>',
    '            <div class="gdc-grid">',
    '              <div class="gdc-field gdc-field--full"><label class="gdc-field__label">Decisión</label><div class="gdc-radios" id="gdc-decision">',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-decision" value="aprobado"><span>Aprobado</span></label>',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-decision" value="aprobado_con_acciones"><span>Aprobado con acciones</span></label>',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-decision" value="no_aprobado"><span>No aprobado</span></label>',
    '              </div></div>',
    '              <div class="gdc-field gdc-field--full"><label class="gdc-field__label">Acciones requeridas</label><textarea class="gdc-textarea" id="gdc-acciones" placeholder="Describa las acciones necesarias si aplica..."></textarea></div>',
    '            </div>',
    '          </div>',
    '        </section>'
  ].join('\n');
  MARCADO += [
    /* ══ PASO 3 · Evaluación y controles ══ */
    '        <section class="gdc-step" data-step="3">',
    '          <div class="gdc-sec"><h3 class="gdc-sec__title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>Peligros y riesgos</h3>',
    '            <div class="gdc-grid">',
    '              <div class="gdc-field"><label class="gdc-field__label">¿Introduce nuevos peligros?</label><div class="gdc-radios">',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-newhaz" value="SI"><span>Sí</span></label>',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-newhaz" value="NO"><span>No</span></label></div></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">¿Modifica riesgos existentes?</label><div class="gdc-radios">',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-modrisk" value="SI"><span>Sí</span></label>',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-modrisk" value="NO"><span>No</span></label></div></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Peligro afectado (nuevo)</label><input class="gdc-input" id="gdc-newhaz-desc" placeholder="Especifique el peligro"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Riesgo afectado (modificado)</label><input class="gdc-input" id="gdc-modrisk-desc" placeholder="Especifique el riesgo"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Fecha matriz peligro nuevo</label><input type="date" class="gdc-input" id="gdc-newhaz-mdate"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Firma matriz peligro nuevo</label><input class="gdc-input" id="gdc-newhaz-firma" placeholder="Quién firma la matriz"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Fecha matriz riesgo modificado</label><input type="date" class="gdc-input" id="gdc-modrisk-mdate"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Firma matriz riesgo modificado</label><input class="gdc-input" id="gdc-modrisk-firma" placeholder="Quién firma la matriz"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Riesgo antes del cambio</label><input class="gdc-input" id="gdc-riesgo-antes" placeholder="Ej.: Medio"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Riesgo después del cambio</label><input class="gdc-input" id="gdc-riesgo-despues" placeholder="Ej.: Bajo"></div>',
    '              <div class="gdc-field gdc-field--full"><label class="gdc-field__label">Nivel de riesgo del cambio</label><div class="gdc-radios" id="gdc-nivel">',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-nivel" value="ALTO"><span>Alto</span></label>',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-nivel" value="MEDIO"><span>Medio</span></label>',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-nivel" value="BAJO"><span>Bajo</span></label>',
    '              </div></div>',
    '            </div>',
    '          </div>',
    '          <div class="gdc-sec"><h3 class="gdc-sec__title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/></svg>Jerarquía de controles</h3>',
    '            <div class="gdc-mini-wrap"><table class="gdc-mini"><thead><tr><th>Control</th><th>Descripción</th><th>Responsable</th><th>Fecha</th></tr></thead><tbody>',
    CONTROLES.map(function (c) {
      return '              <tr><td style="font-weight:700;white-space:nowrap">' + c.nombre + '</td>' +
        '<td><input class="gdc-input" id="gdc-ctrl-' + c.k + '-desc" placeholder="Descripción del control"></td>' +
        '<td><input class="gdc-input" id="gdc-ctrl-' + c.k + '-resp" placeholder="Responsable"></td>' +
        '<td><input type="date" class="gdc-input" id="gdc-ctrl-' + c.k + '-date"></td></tr>';
    }).join('\n'),
    '            </tbody></table></div>',
    '          </div>',
    '        </section>',
    /* ══ PASO 4 · Plan y cierre ══ */
    '        <section class="gdc-step" data-step="4">',
    '          <div class="gdc-sec"><h3 class="gdc-sec__title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>Plan de acción</h3>',
    '            <div class="gdc-mini-wrap"><table class="gdc-mini"><thead><tr><th>Actividad</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th>Estado</th><th></th></tr></thead><tbody id="gdc-plan-body"></tbody></table></div>',
    '            <button type="button" class="gdc-btn gdc-btn--ghost gdc-btn--sm gdc-plan-add" id="gdc-plan-add">+ Agregar actividad</button>',
    '          </div>',
    '          <div class="gdc-sec"><h3 class="gdc-sec__title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Aprobaciones</h3>',
    '            <div class="gdc-grid gdc-grid--3">',
    '              <div class="gdc-field"><label class="gdc-field__label">Área · fecha</label><input type="date" class="gdc-input" id="gdc-ap-area-date"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Área · firma</label><input class="gdc-input" id="gdc-ap-area-sign" placeholder="Nombre y apellido"></div>',
    '              <div></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">SST · fecha</label><input type="date" class="gdc-input" id="gdc-ap-sst-date"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">SST · firma</label><input class="gdc-input" id="gdc-ap-sst-sign" placeholder="Nombre y apellido"></div>',
    '              <div></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Gerencia · fecha</label><input type="date" class="gdc-input" id="gdc-ap-ger-date"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Gerencia · firma</label><input class="gdc-input" id="gdc-ap-ger-sign" placeholder="Nombre y apellido"></div>',
    '              <div></div>',
    '            </div>',
    '          </div>',
    '          <div class="gdc-sec"><h3 class="gdc-sec__title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>Ejecución y cierre</h3>',
    '            <div class="gdc-grid">',
    '              <div class="gdc-field"><label class="gdc-field__label">Fecha de ejecución</label><input type="date" class="gdc-input" id="gdc-ejec-date"></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">¿Controles implementados?</label><div class="gdc-radios">',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-ejec-ctrl" value="SI"><span>Sí</span></label>',
    '                <label class="gdc-radio-pill"><input type="radio" name="gdc-ejec-ctrl" value="NO"><span>No</span></label></div></div>',
    '              <div class="gdc-field gdc-field--full"><label class="gdc-field__label">Observaciones de ejecución</label><textarea class="gdc-textarea" id="gdc-ejec-obs" placeholder="Observaciones durante la ejecución..."></textarea></div>',
    '              <div class="gdc-field gdc-field--full"><label class="gdc-field__label">Incidentes</label><textarea class="gdc-textarea" id="gdc-incidentes" placeholder="Describa si se presentaron incidentes..."></textarea></div>',
    '              <div class="gdc-field"><label class="gdc-field__label">Fecha de cierre</label><input type="date" class="gdc-input" id="gdc-cierre-date"></div>',
    '              <div class="gdc-field gdc-field--full"><label class="gdc-field__label">Conclusión</label><textarea class="gdc-textarea" id="gdc-conclusion" placeholder="Conclusión final sobre la eficacia del cambio..."></textarea></div>',
    '            </div>',
    '          </div>',
    '        </section>',
    '      </form>',
    '    </div>',
    '    <div class="gdc-modal__foot">',
    '      <span class="gdc-foot-note" id="gdc-foot-note"></span>',
    '      <button type="button" class="gdc-btn gdc-btn--ghost gdc-hidden" id="gdc-prev">← Anterior</button>',
    '      <button type="button" class="gdc-btn gdc-btn--soft" id="gdc-next">Siguiente →</button>',
    '      <button type="button" class="gdc-btn gdc-btn--success gdc-hidden" id="gdc-save">Guardar Cambio</button>',
    '      <button type="button" class="gdc-btn gdc-btn--violet gdc-hidden" id="gdc-trans"></button>',
    '    </div>',
    '  </div>',
    '</div>',
    /* ── Avisos (se mudan al body) ── */
    '<div class="gdc-toasts" id="gdc-toasts"></div>'
  ].join('\n');

  /* ══════════════ Componente ══════════════ */
  class GestionDelCambioComponent {
    constructor(container, companyName, moduleName, submoduleName, onBackToModule) {
      this.container = container;
      this.companyName = companyName;
      this.moduleName = moduleName;
      this.submoduleName = submoduleName;
      this.onBackToModule = onBackToModule;

      this.changes = [];
      this.filterEstado = '';
      this.filterRiesgo = '';
      this.editingId = null;
      this.isDestroyed = false;
      this.currentStep = 1;
      this.totalSteps = 4;
      this.currentEstado = null;
      this.readonly = false;

      this.raiz = null;          /* nodo raíz inyectado (.gdc-scope) */
      this._nodosEnBody = [];    /* capas mudadas al body */
      this._obs = null;          /* vigía de navegación */
      this._escHandler = null;
      this._bodyLocked = false;
    }

    /* ── Ciclo de vida ── */
    async render() {
      if (this.isDestroyed) return;
      var host = this.container;
      if (!host) { klog('MODULO', 'INIT', 'ERR', 'sin contenedor'); return; }

      /* Re-render: recoger primero lo que una corrida anterior dejó en el body */
      this.#limpiarCapas();

      host.innerHTML = '';
      this.raiz = document.createElement('div');
      this.raiz.className = 'gdc-scope';
      this.raiz.innerHTML = MARCADO;
      host.appendChild(this.raiz);

      /* Checkbox de tipos de cambio + filas de la lista de chequeo */
      this.#buildTipos();
      this.#buildChecklistRows();

      /* Overlays y avisos al body (son position:fixed). Van envueltos en un
         .gdc-scope: el CSS usa selectores descendientes (.gdc-scope .gdc-modal)
         y al salir del árbol del componente perderían TODOS los estilos. */
      var self = this;
      this._nodosEnBody = [];
      Array.prototype.slice.call(
        this.raiz.querySelectorAll('.gdc-overlay, .gdc-toasts')
      ).forEach(function (n) {
        var wrap = document.createElement('div');
        wrap.className = 'gdc-scope';
        wrap.appendChild(n);
        document.body.appendChild(wrap);
        self._nodosEnBody.push(wrap);
      });

      /* Vigía: renderer.js solo destruye el componente activo cuando el
         siguiente se monta por createComponentSafely; los montajes directos
         no avisan. Si el contenedor O la raíz salen del documento (al
         navegar, renderer vacía el contenedor: la raíz se desconecta
         aunque el host siga conectado), recogemos las capas. */
      if (typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver(function () {
          if (!host.isConnected || !self.raiz || !self.raiz.isConnected) self.#limpiarCapas();
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
      }

      this.#bind();
      this.#setChipEmpresa();
      await this.#loadChanges();
      klog('MODULO', 'INIT', 'OK', '2.11.1 premium v2');
    }

    destroy() {
      this.isDestroyed = true;
      this.#limpiarCapas();
      if (this._escHandler) {
        document.removeEventListener('keydown', this._escHandler);
        this._escHandler = null;
      }
      this.#unlockBody();
      if (this.container) this.container.innerHTML = '';
      this.raiz = null;
      klog('MODULO', 'DESTROY', 'OK', 'capas retiradas');
    }

    #limpiarCapas() {
      if (this._obs) { try { this._obs.disconnect(); } catch (e) {} this._obs = null; }
      this._nodosEnBody.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      this._nodosEnBody = [];
    }

    #unlockBody() { if (this._bodyLocked) { document.body.style.overflow = ''; this._bodyLocked = false; } }

    /* ── Helpers DOM ──
       $ y $$ buscan PRIMERO en la raíz y DESPUÉS en las capas mudadas
       al body (el modal vive allá: sin esto el asistente no cambia de
       paso, lección del laboratorio). */
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
    $$(sel) {
      var out = [];
      if (this.raiz) {
        out = out.concat(Array.prototype.slice.call(this.raiz.querySelectorAll(sel)));
      }
      for (var i = 0; i < this._nodosEnBody.length; i++) {
        out = out.concat(Array.prototype.slice.call(this._nodosEnBody[i].querySelectorAll(sel)));
      }
      return out;
    }
    #esc(s) {
      if (s === null || s === undefined) return '';
      var d = document.createElement('div');
      d.textContent = String(s);
      return d.innerHTML;
    }

    #buildTipos() {
      var box = this.$('#gdc-tipos');
      if (!box) return;
      box.innerHTML = TIPOS_CAMBIO.map(function (t) {
        return '<label class="gdc-check"><input type="checkbox" name="gdc-tipo" value="' + t + '">' + t + '</label>';
      }).join('');
    }

    #buildChecklistRows() {
      var tbody = this.$('#gdc-cl-body');
      if (!tbody) return;
      tbody.innerHTML = CHECKLIST.map(function (item, i) {
        var radios = ['SI', 'NO', 'NA'].map(function (v) {
          return '<td><label class="gdc-radio-pill"><input type="radio" name="gdc-cl-' + item.k + '" value="' + v + '"><span>' + v + '</span></label></td>';
        }).join('');
        return '<tr><td class="gdc-cl-num">' + (i + 1) + '</td><td class="gdc-cl-q">' + item.q + '</td>' + radios +
          '<td><input class="gdc-input" id="gdc-cl-' + item.k + '-esp" placeholder="Especifique"></td>' +
          '<td><input class="gdc-input" id="gdc-cl-' + item.k + '-resp" placeholder="Responsable"></td></tr>';
      }).join('');
    }

    #setChipEmpresa() {
      var el = this.$('#gdc-chip-emp');
      if (el) el.textContent = this.companyName || window.currentCompany || '—';
    }

    /* ── Eventos ── */
    #bind() {
      var self = this;
      var on = function (id, ev, fn) {
        var el = self.$('#' + id);
        if (el) el.addEventListener(ev, fn);
      };

      on('gdc-back', 'click', function () {
        if (typeof self.onBackToModule === 'function') self.onBackToModule();
      });
      on('gdc-new', 'click', function () { self.#openModal(null); });
      on('gdc-modal-close', 'click', function () { self.#closeModal(); });
      on('gdc-prev', 'click', function () { self.#stepPrev(); });
      on('gdc-next', 'click', function () { self.#stepNext(); });
      on('gdc-save', 'click', function () { self.#saveChange(); });
      on('gdc-trans', 'click', function () { self.#handleTransitionClick(); });
      on('gdc-plan-add', 'click', function () { self.#addPlanRow(); });
      on('gdc-f-estado', 'change', function (e) { self.filterEstado = e.target.value; self.#renderTable(); });
      on('gdc-f-riesgo', 'change', function (e) { self.filterRiesgo = e.target.value; self.#renderTable(); });

      /* Clic en el fondo del overlay */
      var overlay = this.$('#gdc-overlay');
      if (overlay) {
        overlay.addEventListener('mousedown', function (e) {
          if (e.target === overlay) self.#closeModal();
        });
      }

      /* Acciones de la tabla (delegación) */
      var tbody = this.$('#gdc-tbody');
      if (tbody) {
        tbody.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-action]');
          if (!btn) return;
          var ch = self.changes.find(function (c) { return c.id === btn.dataset.id; });
          if (!ch) return;
          if (btn.dataset.action === 'view') self.#viewChange(ch.id);
          else self.#openForChange(ch, parseInt(btn.dataset.step) || null);
        });
      }

      /* ESC: se liga por instancia y se desliga en destroy() */
      this._escHandler = function (e) {
        if (e.key === 'Escape') {
          var ov = self.$('#gdc-overlay');
          if (ov && ov.classList.contains('gdc-open')) self.#closeModal();
        }
      };
      document.addEventListener('keydown', this._escHandler);
    }

    /* ── Datos ── */
    async #loadChanges() {
      var loading = this.$('#gdc-loading');
      var empty = this.$('#gdc-empty');
      var table = this.$('#gdc-table');
      if (loading) loading.classList.remove('gdc-hidden');
      if (empty) empty.classList.add('gdc-hidden');
      if (table) table.classList.add('gdc-hidden');

      try {
        if (!window.electronAPI || typeof window.electronAPI.loadGestionCambioData !== 'function') {
          throw new Error('electronAPI no disponible');
        }
        var result = await window.electronAPI.loadGestionCambioData(this.companyName);
        this.changes = (result && result.success && result.data && result.data.changes) ? result.data.changes : [];
      } catch (err) {
        klog('DATOS', 'LOAD', 'ERR', err.message);
        this.changes = [];
      } finally {
        if (loading) loading.classList.add('gdc-hidden');
      }

      this.#renderMetrics();
      this.#renderPipeline();
      this.#renderTable();
    }

    /* ── KPIs / pipeline / tabla ── */
    #renderMetrics() {
      var now = new Date(), month = now.getMonth(), year = now.getFullYear();
      var pend = 0, alto = 0, activos = 0, mes = 0;
      this.changes.forEach(function (ch) {
        var estado = (ch.estado || '').toLowerCase();
        var riesgo = (ch.nivelRiesgo || '').toLowerCase();
        if (['solicitud', 'pendiente', 'en evaluación', 'en evaluacion', 'aprobado', 'aprobada'].indexOf(estado) !== -1) pend++;
        if (riesgo === 'alto') alto++;
        if (['cerrado', 'cerrada', 'cancelado', 'no aprobado'].indexOf(estado) === -1) activos++;
        if (ch.fecha) {
          var d = new Date(ch.fecha);
          if (d.getMonth() === month && d.getFullYear() === year) mes++;
        }
      });
      var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
      set('gdc-k-pend', pend);
      set('gdc-k-alto', alto);
      set('gdc-k-activos', activos);
      set('gdc-k-mes', mes);
    }

    #renderPipeline() {
      var counts = { sol: 0, eva: 0, apr: 0, eje: 0, cer: 0 };
      this.changes.forEach(function (ch) {
        var e = (ch.estado || '').toLowerCase();
        if (e === 'solicitud' || e === 'pendiente') counts.sol++;
        else if (e === 'en evaluación' || e === 'en evaluacion') counts.eva++;
        else if (e === 'aprobado' || e === 'aprobada') counts.apr++;
        else if (e === 'en ejecución' || e === 'en ejecucion') counts.eje++;
        else counts.cer++;
      });
      var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
      set('gdc-p-sol', counts.sol);
      set('gdc-p-eva', counts.eva);
      set('gdc-p-apr', counts.apr);
      set('gdc-p-eje', counts.eje);
      set('gdc-p-cer', counts.cer);
    }

    #estadoBucket(estado) {
      var e = (estado || '').toLowerCase();
      if (e === 'en evaluación' || e === 'en evaluacion') return 'evaluacion';
      if (e === 'aprobado' || e === 'aprobada') return 'aprobado';
      if (e === 'no aprobado') return 'no-aprobado';
      if (e === 'en ejecución' || e === 'en ejecucion' || e === 'en proceso') return 'ejecucion';
      if (e === 'cerrado' || e === 'cerrada' || e === 'cancelado') return 'cerrado';
      return 'solicitud';
    }

    #renderTable() {
      var tbody = this.$('#gdc-tbody');
      var empty = this.$('#gdc-empty');
      var table = this.$('#gdc-table');
      if (!tbody) return;

      var self = this;
      var rows = this.changes.filter(function (ch) {
        if (self.filterEstado && self.#estadoBucket(ch.estado) !== self.filterEstado) return false;
        if (self.filterRiesgo && (ch.nivelRiesgo || '').toLowerCase() !== self.filterRiesgo) return false;
        return true;
      });

      if (!rows.length) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('gdc-hidden');
        if (table) table.classList.add('gdc-hidden');
        return;
      }
      if (empty) empty.classList.add('gdc-hidden');
      if (table) table.classList.remove('gdc-hidden');

      tbody.innerHTML = rows.map(function (ch) {
        return '<tr>' +
          '<td class="gdc-td-id">' + self.#esc(ch.id) + '</td>' +
          '<td>' + self.#esc(ch.fecha || '—') + '</td>' +
          '<td>' + self.#esc(ch.areaEjecutora || '—') + '</td>' +
          '<td>' + self.#esc(Array.isArray(ch.tipoCambio) ? ch.tipoCambio.join(', ') : (ch.tipoCambio || '—')) + '</td>' +
          '<td>' + self.#esc(ch.responsable || '—') + '</td>' +
          '<td>' + self.#riskBadge(ch.nivelRiesgo) + '</td>' +
          '<td>' + self.#estadoBadge(ch.estado) + '</td>' +
          '<td class="gdc-td-actions"><div class="gdc-row-actions">' + self.#actionButtons(ch) + '</div></td>' +
          '</tr>';
      }).join('');
    }

    #riskBadge(level) {
      var l = (level || '').toLowerCase();
      if (l.indexOf('alto') !== -1) return '<span class="gdc-badge gdc-badge--alto">Alto</span>';
      if (l.indexOf('medio') !== -1) return '<span class="gdc-badge gdc-badge--medio">Medio</span>';
      if (l.indexOf('bajo') !== -1) return '<span class="gdc-badge gdc-badge--bajo">Bajo</span>';
      return '<span class="gdc-badge gdc-badge--bajo">—</span>';
    }

    #estadoBadge(estado) {
      var map = {
        'solicitud': 'Solicitud', 'pendiente': 'Solicitud',
        'en evaluación': 'En Evaluación', 'en evaluacion': 'En Evaluación',
        'aprobado': 'Aprobado', 'aprobada': 'Aprobado',
        'no aprobado': 'No Aprobado',
        'en ejecución': 'En Ejecución', 'en ejecucion': 'En Ejecución', 'en proceso': 'En Proceso',
        'cerrado': 'Cerrado', 'cerrada': 'Cerrado', 'cancelado': 'Cancelado'
      };
      var e = (estado || 'solicitud').toLowerCase();
      var labels = { 'solicitud': 'Solicitud', 'evaluacion': 'En Evaluación', 'aprobado': 'Aprobado', 'ejecucion': 'En Ejecución', 'cerrado': 'Cerrado', 'no-aprobado': 'No Aprobado' };
      var bucket = this.#estadoBucket(estado);
      return '<span class="gdc-badge gdc-badge--' + bucket + '">' + this.#esc(map[e] || estado || 'Solicitud') + '</span>';
    }

    #actionButtons(ch) {
      var id = this.#esc(ch.id);
      var viewBtn = '<button type="button" class="gdc-btn gdc-btn--ghost gdc-btn--sm" data-action="view" data-id="' + id + '">Ver</button>';
      var est = (ch.estado || 'Solicitud').toLowerCase();
      if (est === 'solicitud' || est === 'pendiente')
        return '<button type="button" class="gdc-btn-action gdc-btn-action--eva" data-action="advance" data-id="' + id + '" data-step="1" title="Completar solicitud y enviar a evaluación">Enviar a Evaluación →</button>' + viewBtn;
      if (est === 'en evaluación' || est === 'en evaluacion')
        return '<button type="button" class="gdc-btn-action gdc-btn-action--apr" data-action="advance" data-id="' + id + '" data-step="2" title="Gestionar evaluación">Gestionar Evaluación →</button>' + viewBtn;
      if (est === 'aprobado' || est === 'aprobada')
        return '<button type="button" class="gdc-btn-action gdc-btn-action--eje" data-action="advance" data-id="' + id + '" data-step="3" title="Iniciar ejecución del cambio">Iniciar Ejecución →</button>' + viewBtn;
      if (est === 'en ejecución' || est === 'en ejecucion')
        return '<button type="button" class="gdc-btn-action gdc-btn-action--cer" data-action="advance" data-id="' + id + '" data-step="4" title="Registrar cierre del cambio">Cerrar Cambio →</button>' + viewBtn;
      return viewBtn;
    }

    /* ── Asistente: navegación ── */
    #goToStep(step) {
      this.currentStep = step;
      var self = this;
      this.$$('.gdc-step').forEach(function (p) {
        p.classList.toggle('gdc-active', parseInt(p.dataset.step) === step);
      });
      this.$$('.gdc-wstep').forEach(function (el) {
        var s = parseInt(el.dataset.step);
        el.classList.remove('gdc-active', 'gdc-done');
        var circ = el.querySelector('.gdc-wstep__circle');
        if (s === step) el.classList.add('gdc-active');
        else if (s < step) el.classList.add('gdc-done');
        if (circ) circ.textContent = s < step ? '✓' : String(s);
      });

      var prev = this.$('#gdc-prev'), next = this.$('#gdc-next'),
          save = this.$('#gdc-save'), trans = this.$('#gdc-trans'),
          ind = this.$('#gdc-step-ind');
      if (prev) prev.classList.toggle('gdc-hidden', step === 1);
      if (next) next.classList.toggle('gdc-hidden', step === this.totalSteps);
      if (ind) ind.textContent = 'Paso ' + step + ' de ' + this.totalSteps;

      var transInfo = this.#getTransitionInfo();
      var isLast = step === this.totalSteps;
      var trigger = { 'solicitud': 1, 'pendiente': 1, 'en evaluación': 2, 'en evaluacion': 2, 'aprobado': 3, 'aprobada': 3, 'en ejecución': 4, 'en ejecucion': 4 };
      var curEst = (this.currentEstado || '').toLowerCase();
      var triggerAt = trigger[curEst] || this.totalSteps;
      var showTrans = transInfo && step === triggerAt;

      if (save) save.classList.toggle('gdc-hidden', !isLast || !!transInfo);
      if (trans) {
        trans.classList.toggle('gdc-hidden', !showTrans);
        if (showTrans) trans.textContent = transInfo.label;
      }
      var body = this.$('.gdc-modal__body');
      if (body) body.scrollTop = 0;
    }

    #stepNext() { if (this.currentStep < this.totalSteps) this.#goToStep(this.currentStep + 1); }
    #stepPrev() { if (this.currentStep > 1) this.#goToStep(this.currentStep - 1); }

    /* ── Asistente: abrir/cerrar ── */
    #openModal(changeData) {
      var overlay = this.$('#gdc-overlay');
      if (!overlay) return;

      this.editingId = changeData ? changeData.id : null;
      this.currentEstado = changeData ? changeData.estado : null;
      this.readonly = false;

      var title = this.$('#gdc-modal-title');
      if (title) title.textContent = changeData ? 'Editar — ' + changeData.id : 'Nuevo Cambio';

      this.#resetForm();
      if (!changeData) {
        this.#generateNewId();
        var today = new Date().toISOString().split('T')[0];
        var fecha = this.$('#gdc-fecha');
        if (fecha) fecha.value = today;
      } else {
        this.#populateForm(changeData);
      }

      this.#goToStep(1);
      overlay.classList.add('gdc-open');
      document.body.style.overflow = 'hidden';
      this._bodyLocked = true;
      klog('UI', 'MODAL', 'OK', changeData ? 'editar ' + changeData.id : 'nuevo');
    }

    #openForChange(changeData, preferredStep) {
      this.#openModal(changeData);
      if (preferredStep && preferredStep >= 1 && preferredStep <= this.totalSteps) {
        this.#goToStep(preferredStep);
        return;
      }
      var stepByEstado = { 'solicitud': 1, 'pendiente': 1, 'en evaluación': 2, 'en evaluacion': 2, 'no aprobado': 2, 'aprobado': 3, 'aprobada': 3, 'en ejecución': 4, 'en ejecucion': 4, 'cerrado': 4, 'cerrada': 4 };
      this.#goToStep(stepByEstado[(changeData.estado || 'solicitud').toLowerCase()] || 1);
    }

    #viewChange(id) {
      var ch = this.changes.find(function (c) { return c.id === id; });
      if (!ch) { this.#toast('Cambio no encontrado.', 'warning'); return; }
      this.#openModal(ch);
      this.readonly = true;
      var self = this;
      setTimeout(function () {
        self.$$('#gdc-form input, #gdc-form select, #gdc-form textarea, #gdc-form button').forEach(function (el) { el.disabled = true; });
        var close = self.$('#gdc-modal-close');
        if (close) close.disabled = false;
      }, 60);
    }

    #closeModal() {
      var overlay = this.$('#gdc-overlay');
      if (!overlay) return;
      overlay.classList.remove('gdc-open');
      this.#unlockBody();
      this.editingId = null;
      this.currentEstado = null;
      this.readonly = false;
      /* devolver los campos a editables por si se abrió en modo Ver */
      this.$$('#gdc-form input, #gdc-form select, #gdc-form textarea, #gdc-form button').forEach(function (el) { el.disabled = false; });
    }

    /* ── Formulario: reset / poblar / recolectar ── */
    #resetForm() {
      var form = this.$('#gdc-form');
      if (form) form.reset();
      CONTROLES.forEach(function (c) {
        ['desc', 'resp', 'date'].forEach(function (sfx) {
          var el = document.getElementById('gdc-ctrl-' + c.k + '-' + sfx);
          if (el) el.value = '';
        });
      });
      var plan = this.$('#gdc-plan-body');
      if (plan) plan.innerHTML = '';
      this.#addPlanRow();
    }

    async #generateNewId() {
      var el = this.$('#gdc-id');
      try {
        if (window.electronAPI && typeof window.electronAPI.generateGestionCambioId === 'function') {
          var r = await window.electronAPI.generateGestionCambioId(this.companyName);
          if (r && r.success && r.data && el) { el.value = r.data.id; return; }
        }
        throw new Error('sin backend');
      } catch (e) {
        if (el) el.value = 'CHG-' + new Date().getFullYear() + '-' + String(this.changes.length + 1).padStart(3, '0');
      }
    }

    #populateForm(d) {
      var self = this;
      var set = function (id, val) {
        var el = self.$('#' + id);
        if (el && val !== null && val !== undefined) el.value = val;
      };
      var radio = function (name, val) {
        if (val === null || val === undefined || val === '') return;
        var el = self.$('input[name="' + name + '"][value="' + val + '"]');
        if (el) el.checked = true;
      };

      /* Paso 1 */
      set('gdc-id', d.id);
      set('gdc-fecha', d.fecha);
      set('gdc-area-ejec', d.areaEjecutora);
      set('gdc-fecha-impl', d.fechaImplementacion);
      set('gdc-area-usu', d.areaUsuaria);
      set('gdc-responsable', d.responsable);
      set('gdc-cargo', d.cargo);
      set('gdc-descripcion', d.descripcion);
      set('gdc-justificacion', d.justificacion);
      if (d.tipoCambio) {
        var tipos = Array.isArray(d.tipoCambio) ? d.tipoCambio : [d.tipoCambio];
        this.$$('input[name="gdc-tipo"]').forEach(function (cb) { cb.checked = tipos.indexOf(cb.value) !== -1; });
      }

      /* Paso 2 — checklist */
      var cl = d.checklist || {};
      CLAVES.forEach(function (k) {
        var key = k.charAt(0).toLowerCase() + k.slice(1);
        radio('gdc-cl-' + k, cl[key]);
        set('gdc-cl-' + k + '-esp', cl[key + 'Esp']);
        set('gdc-cl-' + k + '-resp', cl[key + 'Resp']);
      });
      radio('gdc-decision', d.decision);
      set('gdc-acciones', d.accionesRequeridas);

      /* Paso 3 */
      radio('gdc-newhaz', d.introducePeligros === true || d.introducePeligros === 'SI' ? 'SI' : (d.introducePeligros === false || d.introducePeligros === 'NO' ? 'NO' : ''));
      radio('gdc-modrisk', d.modificaRiesgos === true || d.modificaRiesgos === 'SI' ? 'SI' : (d.modificaRiesgos === false || d.modificaRiesgos === 'NO' ? 'NO' : ''));
      set('gdc-newhaz-desc', d.peligroAfectado1);
      set('gdc-modrisk-desc', d.peligroAfectado2);
      set('gdc-newhaz-mdate', d.hazard1MatrizDate);
      set('gdc-newhaz-firma', d.hazard1Firma);
      set('gdc-modrisk-mdate', d.risk2MatrizDate);
      set('gdc-modrisk-firma', d.risk2Firma);
      set('gdc-riesgo-antes', d.riesgoAntes);
      set('gdc-riesgo-despues', d.riesgoDespues);
      if (d.controles) {
        var map = { elim: 'eliminacion', sub: 'sustitucion', ing: 'ingenieria', adm: 'administrativos', epp: 'epp' };
        CONTROLES.forEach(function (c) {
          var cc = d.controles[map[c.k]] || {};
          set('gdc-ctrl-' + c.k + '-desc', cc.descripcion);
          set('gdc-ctrl-' + c.k + '-resp', cc.responsable);
          set('gdc-ctrl-' + c.k + '-date', cc.fecha);
        });
      }
      radio('gdc-nivel', d.nivelRiesgo);

      /* Paso 4 */
      var plan = this.$('#gdc-plan-body');
      if (plan && d.planAccion && d.planAccion.length) {
        plan.innerHTML = '';
        d.planAccion.forEach(function (act) { self.#addPlanRow(act); });
      }
      set('gdc-ap-area-date', d.aprobaciones && d.aprobaciones.areaFecha);
      set('gdc-ap-area-sign', d.aprobaciones && d.aprobaciones.areaFirma);
      set('gdc-ap-sst-date', d.aprobaciones && d.aprobaciones.sstFecha);
      set('gdc-ap-sst-sign', d.aprobaciones && d.aprobaciones.sstFirma);
      set('gdc-ap-ger-date', d.aprobaciones && d.aprobaciones.gerenciaFecha);
      set('gdc-ap-ger-sign', d.aprobaciones && d.aprobaciones.gerenciaFirma);
      set('gdc-ejec-date', d.fechaEjecucion);
      radio('gdc-ejec-ctrl', d.controlesImplementados);
      set('gdc-ejec-obs', d.observacionesEjecucion);
      set('gdc-verif-date', d.fechaVerificacion);
      radio('gdc-verif-ctrl', d.controlesEficaces);
      set('gdc-incidentes', d.incidentes);
      set('gdc-cierre-date', d.fechaCierre);
      set('gdc-conclusion', d.conclusion);
    }

    #collectFormData() {
      var self = this;
      var get = function (id) { var el = self.$('#' + id); return el ? el.value.trim() : ''; };
      var radio = function (name) { var el = self.$('input[name="' + name + '"]:checked'); return el ? el.value : ''; };
      var checks = function (name) {
        return self.$$('input[name="' + name + '"]:checked').map(function (c) { return c.value; });
      };

      var cl = {};
      CLAVES.forEach(function (k) {
        var key = k.charAt(0).toLowerCase() + k.slice(1);
        cl[key] = radio('gdc-cl-' + k);
        cl[key + 'Esp'] = get('gdc-cl-' + k + '-esp');
        cl[key + 'Resp'] = get('gdc-cl-' + k + '-resp');
      });

      var planRows = this.$$('#gdc-plan-body tr');
      var planAccion = planRows.map(function (row) {
        var ins = row.querySelectorAll('input, select');
        return {
          actividad: ins[0] ? ins[0].value : '',
          responsable: ins[1] ? ins[1].value : '',
          fechaInicio: ins[2] ? ins[2].value : '',
          fechaFin: ins[3] ? ins[3].value : '',
          estado: ins[4] ? ins[4].value : 'Pendiente'
        };
      }).filter(function (r) { return r.actividad || r.responsable; });

      var ctrlKey = { elim: 'eliminacion', sub: 'sustitucion', ing: 'ingenieria', adm: 'administrativos', epp: 'epp' };
      var controles = {};
      CONTROLES.forEach(function (c) {
        controles[ctrlKey[c.k]] = {
          descripcion: get('gdc-ctrl-' + c.k + '-desc'),
          responsable: get('gdc-ctrl-' + c.k + '-resp'),
          fecha: get('gdc-ctrl-' + c.k + '-date')
        };
      });

      var previo = this.editingId ? this.changes.find(function (c) { return c.id === self.editingId; }) : null;

      return {
        id: get('gdc-id'),
        fecha: get('gdc-fecha'),
        fechaImplementacion: get('gdc-fecha-impl'),
        areaEjecutora: get('gdc-area-ejec'),
        areaUsuaria: get('gdc-area-usu'),
        responsable: get('gdc-responsable'),
        cargo: get('gdc-cargo'),
        descripcion: get('gdc-descripcion'),
        justificacion: get('gdc-justificacion'),
        tipoCambio: checks('gdc-tipo'),
        checklist: cl,
        decision: radio('gdc-decision'),
        accionesRequeridas: get('gdc-acciones'),
        introducePeligros: radio('gdc-newhaz') === 'SI',
        modificaRiesgos: radio('gdc-modrisk') === 'SI',
        peligroAfectado1: get('gdc-newhaz-desc'),
        peligroAfectado2: get('gdc-modrisk-desc'),
        hazard1MatrizDate: get('gdc-newhaz-mdate'),
        hazard1Firma: get('gdc-newhaz-firma'),
        risk2MatrizDate: get('gdc-modrisk-mdate'),
        risk2Firma: get('gdc-modrisk-firma'),
        riesgoAntes: get('gdc-riesgo-antes'),
        riesgoDespues: get('gdc-riesgo-despues'),
        controles: controles,
        nivelRiesgo: radio('gdc-nivel'),
        planAccion: planAccion,
        aprobaciones: {
          areaFecha: get('gdc-ap-area-date'), areaFirma: get('gdc-ap-area-sign'),
          sstFecha: get('gdc-ap-sst-date'), sstFirma: get('gdc-ap-sst-sign'),
          gerenciaFecha: get('gdc-ap-ger-date'), gerenciaFirma: get('gdc-ap-ger-sign')
        },
        fechaEjecucion: get('gdc-ejec-date'),
        controlesImplementados: radio('gdc-ejec-ctrl'),
        observacionesEjecucion: get('gdc-ejec-obs'),
        fechaVerificacion: get('gdc-verif-date'),
        controlesEficaces: radio('gdc-verif-ctrl'),
        incidentes: get('gdc-incidentes'),
        fechaCierre: get('gdc-cierre-date'),
        conclusion: get('gdc-conclusion'),
        estado: previo ? (previo.estado || 'Solicitud') : 'Solicitud'
      };
    }

    /* ── Plan de acción ── */
    #addPlanRow(data) {
      var tbody = this.$('#gdc-plan-body');
      if (!tbody) return;
      data = data || {};
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" class="gdc-input" value="' + this.#esc(data.actividad || '') + '" placeholder="Actividad"></td>' +
        '<td><input type="text" class="gdc-input" value="' + this.#esc(data.responsable || '') + '" placeholder="Responsable"></td>' +
        '<td><input type="date" class="gdc-input" value="' + this.#esc(data.fechaInicio || '') + '"></td>' +
        '<td><input type="date" class="gdc-input" value="' + this.#esc(data.fechaFin || '') + '"></td>' +
        '<td><select class="gdc-input">' +
        '<option' + (data.estado === 'Pendiente' ? ' selected' : '') + '>Pendiente</option>' +
        '<option' + (data.estado === 'En Proceso' ? ' selected' : '') + '>En Proceso</option>' +
        '<option' + (data.estado === 'Completado' ? ' selected' : '') + '>Completado</option>' +
        '</select></td>' +
        '<td><button type="button" class="gdc-icon-btn" title="Eliminar fila">' + ICON_X + '</button></td>';
      var self = this;
      tr.querySelector('.gdc-icon-btn').addEventListener('click', function () { tr.remove(); });
      tbody.appendChild(tr);
    }

    /* ── Guardar ── */
    async #saveChange() {
      var get = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
      if (!get('gdc-fecha') || !get('gdc-area-ejec') || !get('gdc-responsable') || !get('gdc-descripcion')) {
        this.#toast('Complete los campos obligatorios: Fecha, Área Ejecutora, Responsable, Descripción.', 'error');
        this.#goToStep(1);
        return;
      }
      var data = this.#collectFormData();
      try {
        var r = await window.electronAPI.saveGestionCambioData(this.companyName, data);
        if (r && r.success) {
          this.#toast('Cambio guardado exitosamente.', 'success');
          this.#closeModal();
          await this.#loadChanges();
        } else {
          this.#toast('Error al guardar: ' + ((r && r.error && r.error.message) || 'Error desconocido'), 'error');
        }
      } catch (err) {
        klog('DATOS', 'SAVE', 'ERR', err.message);
        this.#toast('Error de comunicación con el backend.', 'error');
      }
    }

    /* ── Máquina de estados (igual que la versión anterior) ── */
    #getTransitionInfo() {
      var T = {
        'solicitud': { next: 'En Evaluación', label: 'Enviar a Evaluación →' },
        'pendiente': { next: 'En Evaluación', label: 'Enviar a Evaluación →' },
        'en evaluación': { next: 'Aprobado', label: 'Aprobar y Avanzar →' },
        'en evaluacion': { next: 'Aprobado', label: 'Aprobar y Avanzar →' },
        'aprobado': { next: 'En Ejecución', label: 'Iniciar Ejecución →' },
        'aprobada': { next: 'En Ejecución', label: 'Iniciar Ejecución →' },
        'en ejecución': { next: 'Cerrado', label: 'Cerrar Cambio ✓' },
        'en ejecucion': { next: 'Cerrado', label: 'Cerrar Cambio ✓' }
      };
      return T[(this.currentEstado || '').toLowerCase()] || null;
    }

    #validateForTransition(targetEstado) {
      var self = this;
      var get = function (id) { var el = self.$('#' + id); return el ? el.value.trim() : ''; };
      var radio = function (name) { var el = self.$('input[name="' + name + '"]:checked'); return el ? el.value : ''; };
      var errors = [];

      if (!get('gdc-fecha')) errors.push('Fecha del cambio requerida');
      if (!get('gdc-area-ejec')) errors.push('Área Ejecutora requerida');
      if (!get('gdc-responsable')) errors.push('Responsable requerido');
      if (!get('gdc-descripcion')) errors.push('Descripción del cambio requerida');

      if (targetEstado === 'Aprobado' || targetEstado === 'No Aprobado') {
        var missing = CLAVES.filter(function (k) { return !radio('gdc-cl-' + k); });
        if (missing.length) errors.push('Lista de chequeo incompleta (' + missing.length + ' ítem(s) sin responder)');
        if (!radio('gdc-nivel')) errors.push('Nivel de riesgo requerido');
      }
      if (targetEstado === 'En Ejecución') {
        if (!get('gdc-ap-sst-date') && !get('gdc-ap-area-date')) errors.push('Se requiere al menos una fecha de aprobación');
      }
      if (targetEstado === 'Cerrado') {
        if (!get('gdc-ejec-date')) errors.push('Fecha de ejecución requerida');
        if (!get('gdc-cierre-date')) errors.push('Fecha de cierre requerida');
      }
      return errors;
    }

    async #handleTransitionClick() {
      var transInfo = this.#getTransitionInfo();
      if (!transInfo) return;
      var est = (this.currentEstado || '').toLowerCase();
      if (est === 'en evaluación' || est === 'en evaluacion') {
        var decision = window.confirm('¿Aprobar este cambio?\n\nAceptar → Pasa a "Aprobado"\nCancelar → Pasa a "No Aprobado"');
        await this.#transitionEstado(decision ? 'Aprobado' : 'No Aprobado');
        return;
      }
      await this.#transitionEstado(transInfo.next);
    }

    async #transitionEstado(nuevoEstado) {
      var self = this;
      var data = this.#collectFormData();
      var errors = this.#validateForTransition(nuevoEstado);
      if (errors.length) {
        this.#toast('Complete los campos requeridos:\n• ' + errors.join('\n• '), 'error');
        if (errors.some(function (e) { return /Fecha del cambio|Área|Responsable|Descripción/.test(e); })) this.#goToStep(1);
        else if (errors.some(function (e) { return /checklist|riesgo/.test(e); })) this.#goToStep(2);
        return;
      }

      try {
        var saveResult = await window.electronAPI.saveGestionCambioData(this.companyName, data);
        if (!saveResult || !saveResult.success) {
          this.#toast('Error al guardar: ' + ((saveResult && saveResult.error && saveResult.error.message) || 'Error desconocido'), 'error');
          return;
        }
      } catch (err) {
        this.#toast('Error de comunicación al guardar.', 'error');
        return;
      }

      var extraData = {};
      if (nuevoEstado === 'Cerrado') extraData.fechaCierre = data.fechaCierre || new Date().toISOString().split('T')[0];
      if (nuevoEstado === 'En Ejecución') extraData.fechaEjecucion = data.fechaEjecucion || '';

      try {
        var r = await window.electronAPI.updateGestionCambioEstado(this.companyName, data.id, nuevoEstado, extraData);
        if (r && r.success) {
          this.#toast('Estado actualizado: "' + (r.data.estadoAnterior || '') + '" → "' + nuevoEstado + '"', 'success');
          this.#closeModal();
          await this.#loadChanges();
        } else {
          this.#toast('Error al cambiar estado: ' + ((r && r.error && r.error.message) || 'Error desconocido'), 'error');
        }
      } catch (err) {
        klog('DATOS', 'TRANSICION', 'ERR', err.message);
        this.#toast('Error de comunicación al actualizar estado.', 'error');
      }
    }

    /* ── Avisos ── */
    #toast(msg, type) {
      var box = this.$('#gdc-toasts') || document.getElementById('gdc-toasts');
      if (!box) return;
      var icon = type === 'success'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>'
        : type === 'error'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>';
      var el = document.createElement('div');
      el.className = 'gdc-toast gdc-toast--' + (type || 'info');
      el.innerHTML = icon + '<span>' + this.#esc(msg) + '</span>';
      box.appendChild(el);
      setTimeout(function () {
        el.classList.add('gdc-out');
        setTimeout(function () { el.remove(); }, 320);
      }, 3400);
    }
  }

  window.GestionDelCambioComponent = GestionDelCambioComponent;
  klog('REGISTRO', 'GLOBAL', 'OK', 'window.GestionDelCambioComponent');
})();
