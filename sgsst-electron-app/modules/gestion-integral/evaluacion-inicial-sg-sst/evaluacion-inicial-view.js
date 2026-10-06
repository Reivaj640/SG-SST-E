/* ============================================================
   K+AIR · Evaluación Inicial del SG-SST — lógica (v2 premium)
   ============================================================
   Adopta el diseño premium v2 y lo conecta al backend REAL. El prototipo
   traía datasets de ejemplo en memoria y puntos de integración comentados;
   acá se reemplazaron por las llamadas que ya existen:

     · PDFs disponibles ....... findSubmodulePath + readDirectory
     · evaluación del PDF ..... processEvaluacionPdf(pdfPath, sourceType)
     · planes de acción ....... evaluacionActionPlans.listar/guardar/eliminar
     · ver el documento ....... openPath
     · volver ................. callback de navegación del contenedor

   LO QUE HAY QUE RESPETAR AL TOCAR ESTE ARCHIVO:
   1. Todo va dentro de la función IIFE y se exporta a `window` como
      `EvaluacionInicialView`. `renderer.js` lo instancia así:
        new EvaluacionInicialView(container, moduleName, submoduleTitle, backCallback)
        .render()
   2. Los colores salen de la hoja (`evaluacion-inicial-view.css`), NUNCA del
      JS: el medidor es un SVG y se pinta con el atributo `stroke`, que el CSS
      no puede cambiar por clase, así que las constantes de color de acá son el
      único lugar con valores fijos. Están juntas y marcadas para que se vean.
   3. Los planes viven en la base (por empresa y año). El `source` distingue de
      dónde salió cada plan: `arl` para los que trae el informe de la ARL,
      `ministerio` para los que se generan por cada hallazgo no conforme.
   ============================================================ */
(function () {
  'use strict';

  /* ── Logging estructurado del módulo ── */
  function EV_LOG(mod, acc, st, extra) {
    var line = '[K+AIREVAL][' + mod + '][' + acc + '][' + st + ']' + (extra ? ' ' + extra : '');
    if (st === 'ERR') console.warn(line); else console.log(line);
  }

  /* ══════════════ BÚSQUEDA DENTRO DEL COMPONENTE ══════════════
     `$q` y `$$` se reasignan en render() para buscar dentro del marcado que el
     componente inyecta (`contenedorMarcado`) y NO en todo el documento: así dos
     módulos abiertos a la vez no se pisan los elementos entre sí. Acá quedan los
     valores por defecto, que solo se usan antes del primer render. */
  var contenedorMarcado = null;   // el nodo .ev-scope que crea render()
  var $q = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Colores del medidor (único lugar del JS con valores fijos:
        `stroke` de un SVG no se puede cambiar por clase desde el CSS) ── */
  var COLOR_ALTO = '#1BB888';   /* ≥ 80 % */
  var COLOR_MEDIO = '#E7A224';  /* ≥ 50 % */
  var COLOR_BAJO = '#DA5563';   /* < 50 % */
  function colorGauge(p) {
    if (p >= 80) return COLOR_ALTO;
    if (p >= 50) return COLOR_MEDIO;
    return COLOR_BAJO;
  }
  var R_ARC = 295.3;            /* longitud del semicírculo del medidor (r = 94) */

  /* ── Iconos ── */
  var ICON_SEG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>';
  var ICON_HOUR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v3.5a4 4 0 0 0 1.2 2.9L11 12l-2.8 2.6A4 4 0 0 0 7 17.5V21"/><path d="M17 3v3.5a4 4 0 0 1-1.2 2.9L13 12l2.8 2.6A4 4 0 0 1 17 17.5V21"/><path d="M6 3h12M6 21h12"/></svg>';
  var ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>';
  var ICON_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.6L10.7 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z"/></svg>';
  var ICON_SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 5.5v5.2c0 4.5 2.9 8.2 7 9.8 4.1-1.6 7-5.3 7-9.8V5.5z"/><path d="m9.2 12 2 2 3.8-4"/></svg>';
  var ICON_PDF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>';
  var ICON_ERR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>';
  var ICON_INFO2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>';

  /* ══════════════ ESTADO ══════════════ */
  var S = {
    tab: 'dashboard',
    evaluacion: null,       /* { archivoId, nombre, pct, criticos, estandares, phva } */
    archivoActivo: null,    /* archivo elegido del selector */
    planes: [],             /* planes persistidos (base de datos) */
    carpetas: [],           /* carpetas con PDFs, del disco */
    hallQ: '', hallPage: 1, hallSize: 12,
    planPage: 1, planSize: 10,
    detPlanId: null, editPlanId: null, delPlanId: null, pdfCarpeta: null,
    segPlanId: null, respPlanId: null,
    cargando: false
  };
  var empresaId = 'default_company';
  var year = String(new Date().getFullYear());
  var submodulePath = null;
  var backCallback = null;
  var containerRef = null;

  /* ══════════════ API DEL CONTENEDOR ══════════════ */
  function api() { return (typeof window !== 'undefined' && window.electronAPI) || null; }

  function getEmpresaId() {
    var c = (typeof window !== 'undefined' && (window.currentCompany || (window.rendererState && window.rendererState.selectedCompany))) || '';
    return (c && c !== 'default_company') ? c : 'default_company';
  }

  /* ══════════════ FECHAS Y ORDEN ══════════════ */
  function fechaISOaDMY(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '';
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function fechaDMYaISO(dmy) {
    var p = String(dmy || '').split('/');
    if (p.length !== 3) return dmy || '';
    return p[2] + '-' + p[1] + '-' + p[0];
  }
  function cmpCodigo(a, b) {
    var pa = String(a).split('.'), pb = String(b).split('.'), i;
    for (i = 0; i < Math.max(pa.length, pb.length); i++) {
      var na = parseInt(pa[i] || '0', 10), nb = parseInt(pb[i] || '0', 10);
      if (na !== nb) return na - nb;
    }
    return 0;
  }

  /* ══════════════ ADAPTADOR: BACKEND → VISTA ══════════════
     El parser del PDF entrega `findings` con { code, desc, max, grade, status }
     y `metrics` con el cumplimiento. La vista trabaja con
     { c, d, max, obt, estado }. Y los planes del backend traen los nombres de
     la base, no los de la tabla: por eso el plan se arma acá, campo por campo,
     y no se usa el objeto del backend directo. */
  function estadoDe(status) {
    if (status === 'cumple') return 'cumple';
    if (status === 'parcial') return 'parcial';
    return 'no_cumple';
  }
  function aEstandares(findings) {
    return (findings || [])
      .filter(function (f) { return f && f.code; })
      .map(function (f) {
        var max = Number(f.max != null ? f.max : f.valor) || 0;
        var obt = Number(f.obt != null ? f.obt : f.grade) || 0;
        return { c: String(f.code), d: f.desc || '', max: max, obt: obt, estado: estadoDe(f.status) };
      })
      .sort(function (a, b) { return cmpCodigo(a.c, b.c); });
  }
  function contarCriticos(estandares) {
    return estandares.filter(function (e) { return e.estado !== 'cumple' && e.max >= 4; }).length;
  }

  /** Plan de la base → modelo de la vista. */
  function planDesdeBackend(p) {
    var fecha = p.fechaLimite || p.fecha || '';
    return {
      id: p.id,
      codigo: p.hallazgoCode || p.hallazgoCodigo || p.codigo || '',
      hallazgoDesc: p.hallazgoDesc || '',
      estado: p.estado || 'Pendiente',
      accion: p.accion || '',
      responsable: p.responsable || 'Por asignar',
      fecha: fecha && fecha.indexOf('-') > 0 ? fechaISOaDMY(fecha) : fecha,
      fechaISO: fecha && fecha.indexOf('-') > 0 ? fecha : fechaDMYaISO(fecha),
      seguimientos: Array.isArray(p.seguimientos) ? p.seguimientos : [],
      responsables: Array.isArray(p.responsables) ? p.responsables : [],
      _source: p._source || 'ministerio'
    };
  }
  /** Modelo de la vista → payload de la base. */
  function planHaciaBackend(p) {
    return {
      id: p.id,
      hallazgoCode: p.codigo,
      hallazgoDesc: p.hallazgoDesc || '',
      estado: p.estado,
      accion: p.accion,
      responsable: p.responsable,
      fechaLimite: p.fechaISO || fechaDMYaISO(p.fecha),
      seguimientos: p.seguimientos || [],
      responsables: p.responsables || [],
      _source: p._source || 'ministerio'
    };
  }

  /* ══════════════ VISTA: RENDER ══════════════ */
  function badgeEstado(e) {
    var cls = e === 'cumple' ? 'badge--green' : (e === 'parcial' ? 'badge--amber' : 'badge--red');
    return '<span class="badge ' + cls + '">' + esc(e) + '</span>';
  }
  function badgePlanEstado(e) {
    var map = { 'Pendiente': 'badge--amber', 'En proceso': 'badge--blue', 'Completado': 'badge--green' };
    var ico = e === 'Pendiente' ? ICON_HOUR : '';
    return '<span class="badge ' + (map[e] || 'badge--slate') + '">' + ico + esc(e) + '</span>';
  }
  function badgePlanClass(e) {
    return e === 'Pendiente' ? 'badge--amber' : (e === 'Completado' ? 'badge--green' : 'badge--blue');
  }

  function pagerHTML(page, pages, prefix) {
    if (pages <= 1) return '';
    var h = '<div class="pager" role="navigation" aria-label="Paginación">';
    h += '<button type="button" class="pg-btn" data-pg="' + prefix + '-first"' + (page === 1 ? ' disabled' : '') + ' aria-label="Primera página"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/></svg></button>';
    h += '<button type="button" class="pg-btn" data-pg="' + prefix + '-prev"' + (page === 1 ? ' disabled' : '') + ' aria-label="Anterior"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>';
    var i, list = [];
    for (i = 1; i <= pages; i++) {
      if (pages > 7 && i !== 1 && i !== pages && Math.abs(i - page) > 1) {
        if (list[list.length - 1] !== 'ell') list.push('ell');
        continue;
      }
      list.push(i);
    }
    for (i = 0; i < list.length; i++) {
      if (list[i] === 'ell') { h += '<span class="pg-ell">…</span>'; continue; }
      var p = list[i];
      h += '<button type="button" class="pg-btn' + (p === page ? ' is-on' : '') + '" data-pg="' + prefix + '-' + p + '" aria-label="Página ' + p + '">' + p + '</button>';
    }
    h += '<button type="button" class="pg-btn" data-pg="' + prefix + '-next"' + (page === pages ? ' disabled' : '') + ' aria-label="Siguiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>';
    h += '<button type="button" class="pg-btn" data-pg="' + prefix + '-last"' + (page === pages ? ' disabled' : '') + ' aria-label="Última página"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 17 5-5-5-5M6 17l5-5-5-5"/></svg></button>';
    return h + '</div>';
  }

  function setTab(tab) {
    S.tab = tab;
    $$('.ev-tab').forEach(function (t) {
      var on = t.getAttribute('data-tab') === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.kair-view').forEach(function (v) { v.classList.add('is-hidden'); });
    var vista = $q('#view-' + tab);
    if (vista) vista.classList.remove('is-hidden');
    EV_LOG('NAV', 'TAB', 'OK', tab);
  }

  function renderDashboard() {
    var d = S.evaluacion;
    var pct = d ? d.pct : 0;
    var pendientes = S.planes.filter(function (p) { return p.estado !== 'Completado'; }).length;
    var criticos = d ? d.criticos : 0;

    $q('#kv-cumplimiento').textContent = pct + '%';
    $q('#kchip-cumplimiento').textContent = pct + '%';
    $q('#kv-criticos').textContent = criticos;
    $q('#kv-planes').textContent = pendientes;
    $q('#gauge-val').textContent = pct + '%';

    var arc = $q('#gauge-arc');
    arc.style.strokeDashoffset = String(R_ARC * (1 - pct / 100));
    arc.style.stroke = colorGauge(pct);

    var chip = $q('#gauge-chip');
    chip.classList.toggle('is-hidden', !d);
    if (d) {
      chip.textContent = pct + '% de cumplimiento';
      var nTotal = d.estandares.length;
      var nCumple = d.estandares.filter(function (e) { return e.estado === 'cumple'; }).length;
      var nParcial = d.estandares.filter(function (e) { return e.estado === 'parcial'; }).length;
      $q('#gauge-foot').innerHTML =
        '<span class="chip chip--slate">' + nTotal + ' estándares evaluados</span>' +
        '<span class="chip chip--green">' + nCumple + ' cumplen</span>' +
        (nParcial ? '<span class="chip chip--amber">' + nParcial + ' parciales</span>' : '') +
        '<span class="chip chip--red">' + (nTotal - nCumple - nParcial) + ' no cumplen</span>';
    } else {
      $q('#gauge-foot').innerHTML = '';
    }

    /* Tarjeta de archivo */
    var ico = $q('#file-ico'), nm = $q('#file-name'), meta = $q('#file-meta'), ver = $q('#btn-ver-doc');
    if (d) {
      ico.classList.remove('file-ico--wait');
      ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
      nm.textContent = d.nombre;
      meta.textContent = 'Archivo seleccionado · ' + d.estandares.length + ' estándares evaluados';
      ver.classList.remove('is-hidden');
    } else {
      ico.classList.add('file-ico--wait');
      ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6"/><path d="m9.5 6.5 2.5 2.5 2.5-2.5"/><path d="M4 13v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4"/></svg>';
      nm.textContent = 'Esperando archivo fuente...';
      meta.textContent = 'Elija "Cargar Ministerio" o "Cargar ARL" para leer un informe PDF';
      ver.classList.add('is-hidden');
    }
    var chipPdf = $q('#chip-pdf');
    if (d) {
      chipPdf.classList.remove('is-hidden');
      $q('#chip-pdf-name').textContent = d.nombre;
    } else {
      chipPdf.classList.add('is-hidden');
    }

    /* Balance PHVA: solo si el informe lo trae */
    renderPhva(d && d.phva);
  }

  function renderPhva(phva) {
    var box = $q('#phva-body');
    if (!phva || typeof phva !== 'object' ||
        (phva.planear == null && phva.hacer == null && phva.verificar == null && phva.actuar == null)) {
      box.innerHTML =
        '<div class="phva-empty">' +
        '  <div class="phva-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>' +
        '  <div class="phva-txt">Sin datos PHVA en el PDF</div>' +
        '  <div class="phva-hint">' + (S.evaluacion
          ? 'El informe de calificación por estándares no incluye el balance del ciclo.'
          : 'Cargue un informe PDF para ver el balance del ciclo.') + '</div>' +
        '</div>';
      return;
    }
    var fases = [
      { k: 'Planear', v: Number(phva.planear) || 0, color: 'var(--kair-blue)' },
      { k: 'Hacer', v: Number(phva.hacer) || 0, color: 'var(--kair-green)' },
      { k: 'Verificar', v: Number(phva.verificar) || 0, color: 'var(--kair-amber)' },
      { k: 'Actuar', v: Number(phva.actuar) || 0, color: 'var(--kair-red)' }
    ];
    var h = '<div class="phva-list">';
    fases.forEach(function (f) {
      var v = Math.max(0, Math.min(100, f.v));
      h += '<div class="phva-row">' +
        '<span class="phva-k">' + f.k + '</span>' +
        '<span class="phva-track"><i class="phva-fill" style="width:' + v + '%;background:' + f.color + '"></i></span>' +
        '<span class="phva-v">' + v + '%</span></div>';
    });
    h += '</div>';
    box.innerHTML = h;
  }

  function hallFiltrados() {
    var d = S.evaluacion;
    if (!d) return [];
    var q = S.hallQ.trim().toLowerCase();
    if (!q) return d.estandares;
    return d.estandares.filter(function (e) {
      return e.c.toLowerCase().indexOf(q) !== -1 || e.d.toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderHallazgos() {
    var d = S.evaluacion, box = $q('#hall-scroll'), foot = $q('#hall-foot');
    $q('#hall-count').textContent = d ? d.estandares.length + ' estándares' : '0 estándares';
    if (!d) {
      box.innerHTML = '<div class="empty-block"><div class="empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg></div><div class="empty-t">Sin evaluación cargada</div><div class="empty-d">Cargue un informe PDF para ver el detalle de estándares.</div></div>';
      foot.innerHTML = '';
      return;
    }
    var lista = hallFiltrados();
    var pages = Math.max(1, Math.ceil(lista.length / S.hallSize));
    if (S.hallPage > pages) S.hallPage = pages;
    var ini = (S.hallPage - 1) * S.hallSize;
    var rows = lista.slice(ini, ini + S.hallSize);
    var h = '<table class="ev-tbl"><thead><tr>' +
      '<th style="width:120px">Código</th>' +
      '<th>Descripción del estándar</th>' +
      '<th class="num" style="width:90px">Max</th>' +
      '<th class="num" style="width:90px">Obt.</th>' +
      '<th style="width:130px">Estado</th></tr></thead><tbody>';
    if (!rows.length) {
      h += '<tr><td colspan="5"><div class="empty-block" style="padding:30px"><div class="empty-t">Sin resultados</div><div class="empty-d">Ningún estándar coincide con "' + esc(S.hallQ) + '".</div></div></td></tr>';
    }
    rows.forEach(function (e) {
      var warn = e.estado !== 'cumple' ? ' class="is-warn"' : '';
      h += '<tr' + warn + '>' +
        '<td><span class="code-chip">' + esc(e.c) + '</span> <span class="info-dot" title="' + esc(e.d) + '">' + ICON_INFO + '</span></td>' +
        '<td class="std-desc">' + esc(e.d) + '</td>' +
        '<td class="num cell-max">' + esc(e.max) + '</td>' +
        '<td class="num cell-obt">' + esc(e.obt) + '</td>' +
        '<td>' + badgeEstado(e.estado) + '</td></tr>';
    });
    h += '</tbody></table>';
    box.innerHTML = h;
    foot.innerHTML = '<div class="tbl-count">Mostrando ' + (rows.length ? (ini + 1) + '–' + (ini + rows.length) : 0) + ' de ' + lista.length + ' estándares' + (S.hallQ ? ' · filtro: "' + esc(S.hallQ) + '"' : '') + '</div>' + pagerHTML(S.hallPage, pages, 'hall');
  }

  function renderPlanes() {
    var box = $q('#plan-scroll'), foot = $q('#plan-foot');
    $q('#plan-count').textContent = S.planes.length + ' planes';
    if (!S.evaluacion && !S.planes.length) {
      box.innerHTML = '<div class="empty-block"><div class="empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/></svg></div><div class="empty-t">Sin planes de acción</div><div class="empty-d">Cargue un informe PDF o cree un plan para comenzar.</div></div>';
      foot.innerHTML = '';
      return;
    }
    var lista = S.planes;
    var pages = Math.max(1, Math.ceil(lista.length / S.planSize));
    if (S.planPage > pages) S.planPage = pages;
    var ini = (S.planPage - 1) * S.planSize;
    var rows = lista.slice(ini, ini + S.planSize);
    var h = '<table class="ev-tbl" style="min-width:980px"><thead><tr>' +
      '<th style="width:130px">Estado</th>' +
      '<th style="width:230px">Hallazgo asociado</th>' +
      '<th>Acción correctiva</th>' +
      '<th style="width:130px">Responsable</th>' +
      '<th style="width:120px">Fecha límite</th>' +
      '<th style="width:120px">Acciones</th></tr></thead><tbody>';
    if (!rows.length) {
      h += '<tr><td colspan="6"><div class="empty-block" style="padding:30px"><div class="empty-t">Sin planes</div><div class="empty-d">No hay planes de acción registrados para este informe.</div></div></td></tr>';
    }
    rows.forEach(function (p) {
      var e = hallazgoPorCodigo(p.codigo);
      h += '<tr>' +
        '<td>' + badgePlanEstado(p.estado) + '</td>' +
        '<td><span class="plan-code">' + esc(p.codigo || '—') + '</span>' + (p.hallazgoDesc ? '<div class="plan-hsub" title="' + esc(p.hallazgoDesc) + '">' + esc(e ? e.d : p.hallazgoDesc) + '</div>' : '') + '</td>' +
        '<td class="plan-acc">' + esc(p.accion) + '</td>' +
        '<td>' + (p.responsable === 'Por asignar' ? '<span class="resp-mut">Por asignar</span>' : esc(p.responsable)) + '</td>' +
        '<td>' + esc(p.fecha || '—') + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="icon-btn" data-det="' + esc(p.id) + '" title="Ver detalle" aria-label="Ver detalle del plan ' + esc(p.codigo) + '">' + ICON_EYE + '</button>' +
          '<button type="button" class="icon-btn" data-edit="' + esc(p.id) + '" title="Editar" aria-label="Editar plan ' + esc(p.codigo) + '">' + ICON_EDIT + '</button>' +
          '<button type="button" class="icon-btn icon-btn--del" data-del="' + esc(p.id) + '" title="Eliminar" aria-label="Eliminar plan ' + esc(p.codigo) + '">' + ICON_TRASH + '</button>' +
        '</div></td></tr>';
    });
    h += '</tbody></table>';
    box.innerHTML = h;
    foot.innerHTML = '<div class="tbl-count">Mostrando ' + (rows.length ? (ini + 1) + '–' + (ini + rows.length) : 0) + ' de ' + lista.length + ' planes</div>' + pagerHTML(S.planPage, pages, 'plan');
  }

  function hallazgoPorCodigo(c) {
    if (!S.evaluacion) return null;
    for (var i = 0; i < S.evaluacion.estandares.length; i++) {
      if (S.evaluacion.estandares[i].c === c) return S.evaluacion.estandares[i];
    }
    return null;
  }
  function planPorId(id) {
    for (var i = 0; i < S.planes.length; i++) {
      if (String(S.planes[i].id) === String(id)) return S.planes[i];
    }
    return null;
  }
  function renderTodo() {
    renderDashboard();
    renderHallazgos();
    renderPlanes();
  }

  /* ══════════════ AVISOS ══════════════ */
  function toast(msg, kind, ms) {
    var box = $q('#toasts');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast toast--' + (kind || 'info');
    el.innerHTML = (kind === 'ok' ? ICON_OK : kind === 'err' ? ICON_ERR : ICON_INFO2) + '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, ms || 3200);
  }

  /* ══════════════ PDFs DESDE EL DISCO ══════════════ */
  var GRUPOS = [
    { id: 'min', nombre: 'Diagnóstico Ministerio', tipo: 'folder', sub: 'Diagnostico Ministerio' },
    { id: 'arl', nombre: 'Informe ARL', tipo: 'shield', sub: 'Diagnostico ARL' },
    { id: 'otros', nombre: 'Otros Archivos', tipo: 'folder', sub: '' }
  ];

  function soloPdf(f) {
    return f && !f.isDirectory && /\.pdf$/i.test(f.name || '');
  }
  function aArchivo(f, prefijo) {
    return {
      id: prefijo + '|' + (f.path || f.name),
      nombre: f.name,
      path: f.path || f.name,
      kb: Math.max(1, Math.round((Number(f.size) || 0) / 1024))
    };
  }

  async function cargarCarpetas() {
    var a = api();
    S.carpetas = GRUPOS.map(function (g) { return { id: g.id, nombre: g.nombre, tipo: g.tipo, archivos: [], vacia: true }; });
    if (!a) { EV_LOG('PDF', 'LISTAR', 'ERR', 'electronAPI no disponible'); return; }
    try {
      if (!submodulePath && a.findSubmodulePath) {
        var empresa = getEmpresaId();
        var ruta = await a.findSubmodulePath(empresa, 'Gestión Integral', '2.3.1 Evaluación inicial del SG-SST');
        if (ruta && ruta.success && ruta.path) submodulePath = ruta.path;
      }
      if (!submodulePath) { EV_LOG('PDF', 'LISTAR', 'ERR', 'no se encontró la carpeta del submódulo'); return; }

      var base = await a.readDirectory(submodulePath);
      var raiz = (base && base.files) ? base.files.filter(soloPdf) : [];
      if (raiz.length) {
        S.carpetas[2].archivos = raiz.map(function (f) { return aArchivo(f, 'otros'); });
        S.carpetas[2].vacia = false;
      }
      for (var i = 0; i < 2; i++) {
        var g = GRUPOS[i];
        try {
          var res = await a.readDirectory(submodulePath + '\\' + g.sub);
          var pdfs = (res && res.files) ? res.files.filter(soloPdf) : [];
          if (pdfs.length) {
            S.carpetas[i].archivos = pdfs.map(function (f) { return aArchivo(f, GRUPOS[i].id); });
            S.carpetas[i].vacia = false;
          }
        } catch (e) { /* la subcarpeta puede no existir */ }
      }
      var total = S.carpetas.reduce(function (n, c) { return n + c.archivos.length; }, 0);
      EV_LOG('PDF', 'LISTAR', 'OK', total + ' PDF en ' + submodulePath);
      if (!total) toast('No se encontraron informes PDF en la carpeta del módulo.', 'info');
    } catch (e) {
      EV_LOG('PDF', 'LISTAR', 'ERR', e.message);
      toast('No se pudieron listar los informes: ' + e.message, 'err');
    }
  }

  /* ══════════════ MODAL: SELECCIONAR PDF ══════════════ */
  var overlayStack = [];
  function openOverlay(id) {
    var el = $q('#' + id);
    if (!el) return;
    el.classList.remove('is-hidden');
    if (overlayStack.indexOf(id) === -1) overlayStack.push(id);
  }
  function closeOverlay(id) {
    var el = $q('#' + id);
    if (!el) return;
    el.classList.add('is-hidden');
    overlayStack = overlayStack.filter(function (x) { return x !== id; });
  }
  function topOverlay() { return overlayStack.length ? overlayStack[overlayStack.length - 1] : null; }

  function abrirModalPdf(preselect) {
    S.pdfCarpeta = preselect || null;
    renderPicker();
    openOverlay('modal-pdf');
    EV_LOG('PDF', 'MODAL_OPEN', 'OK', preselect ? 'carpeta=' + preselect : 'raiz');
  }
  function carpetaPorId(id) {
    for (var i = 0; i < S.carpetas.length; i++) if (S.carpetas[i].id === id) return S.carpetas[i];
    return null;
  }
  function renderPicker() {
    var carpeta = carpetaPorId(S.pdfCarpeta);
    var hC = '';
    S.carpetas.forEach(function (c) {
      hC += '<button type="button" class="folder-item' + (S.pdfCarpeta === c.id ? ' is-sel' : '') + '" data-carp="' + c.id + '">' +
        '<span class="folder-ico">' + (c.tipo === 'shield' ? ICON_SHIELD : ICON_FOLDER) + '</span>' +
        '<span class="folder-nm">' + esc(c.nombre) + '</span>' +
        '<span class="folder-cnt">' + c.archivos.length + '</span></button>';
    });
    $q('#pdf-carpetas').innerHTML = hC;
    $q('#pdf-crumb').innerHTML = carpeta
      ? '<b>Raíz</b> &nbsp;&gt;&nbsp; ' + esc(carpeta.nombre)
      : '<b>Raíz</b>';
    var docs = $q('#pdf-docs'), empty = $q('#pdf-empty'), back = $q('#pdf-back'), cap = $q('#pdf-docs-cap');
    if (!carpeta) {
      back.classList.add('is-hidden');
      docs.innerHTML = '';
      empty.classList.remove('is-hidden');
      cap.textContent = 'Documentos';
      return;
    }
    back.classList.remove('is-hidden');
    empty.classList.add('is-hidden');
    cap.textContent = carpeta.nombre + ' · ' + carpeta.archivos.length + ' PDF';
    if (!carpeta.archivos.length) {
      empty.classList.remove('is-hidden');
      empty.querySelector('.pdf-empty-t').textContent = 'Sin informes en esta carpeta';
      empty.querySelector('.pdf-empty-d').textContent = 'Coloque los PDF en la carpeta "' + carpeta.nombre + '" del módulo y vuelva a intentar.';
      docs.innerHTML = '';
      return;
    }
    var h = '';
    carpeta.archivos.forEach(function (a) {
      h += '<button type="button" class="doc-item" data-doc="' + esc(a.id) + '">' +
        '<span class="doc-ico">' + ICON_PDF + '</span>' +
        '<span class="doc-nm">' + esc(a.nombre) + '</span>' +
        '<span class="doc-kb">' + a.kb + ' KB</span></button>';
    });
    docs.innerHTML = h;
  }

  function archivoPorId(id) {
    for (var i = 0; i < S.carpetas.length; i++) {
      for (var j = 0; j < S.carpetas[i].archivos.length; j++) {
        if (S.carpetas[i].archivos[j].id === id) return { archivo: S.carpetas[i].archivos[j], carpeta: S.carpetas[i] };
      }
    }
    return null;
  }

  /** Carga y procesa el PDF elegido contra el backend real. */
  async function cargarArchivo(archivo, carpeta) {
    var a = api();
    closeOverlay('modal-pdf');
    if (S.cargando) return;
    S.cargando = true;

    var ico = $q('#file-ico');
    ico.classList.add('file-ico--wait');
    ico.innerHTML = '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>';
    $q('#file-name').textContent = 'Procesando ' + archivo.nombre + '...';
    $q('#file-meta').textContent = 'Leyendo los estándares de calificación del informe';
    EV_LOG('PDF', 'LOAD_START', 'OK', archivo.nombre);

    try {
      if (!a || !a.processEvaluacionPdf) throw new Error('El procesador de PDF no está disponible');
      // Contrato del backend: 'ministerio' | 'arl'. Las carpetas usan ids cortos
      // ('min'/'arl'), así que 'min' se normaliza aquí — antes llegaba 'min' tal cual
      // y el validador lo rechazaba con "Tipo de fuente no reconocido".
      var sourceType = (carpeta && carpeta.id === 'arl') ? 'arl' : 'ministerio';
      var result = await a.processEvaluacionPdf(archivo.path, sourceType);
      if (!result || result.success === false) {
        throw new Error((result && result.error) || 'El informe no se pudo interpretar');
      }
      var estandares = aEstandares(result.findings);
      var pct = (result.metrics && Number(result.metrics.cumplimiento)) || 0;

      S.archivoActivo = archivo;
      S.evaluacion = {
        archivoId: archivo.id,
        nombre: archivo.nombre,
        path: archivo.path,
        pct: pct,
        criticos: contarCriticos(estandares),
        estandares: estandares,
        phva: (result.metrics && result.metrics.phva) || result.phva || null
      };
      S.hallPage = 1; S.planPage = 1;

      ico.classList.remove('file-ico--wait');
      renderTodo();
      toast('Informe procesado: ' + estandares.length + ' estándares, ' + pct + '% de cumplimiento.', 'ok');
      EV_LOG('PDF', 'LOAD_DONE', 'OK', 'pct=' + pct + ' estandares=' + estandares.length);

      // Los planes que trae el informe de la ARL son de su carpeta; el resto se
      // generan por hallazgo no conforme. Se guardan para que persistan.
      await sincronizarPlanes(result, sourceType);
    } catch (e) {
      EV_LOG('PDF', 'LOAD_DONE', 'ERR', e.message);
      toast('No se pudo procesar el informe: ' + e.message, 'err');
      ico.classList.add('file-ico--wait');
      ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6"/><path d="m9.5 6.5 2.5 2.5 2.5-2.5"/><path d="M4 13v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4"/></svg>';
      $q('#file-name').textContent = 'Esperando archivo fuente...';
      $q('#file-meta').textContent = 'Elija "Cargar Ministerio" o "Cargar ARL" para leer un informe PDF';
    } finally {
      S.cargando = false;
    }
  }

  /* ══════════════ PLANES: PERSISTENCIA ══════════════ */
  async function guardarPlan(plan) {
    var a = api();
    if (!a || !a.evaluacionActionPlans) throw new Error('La base de planes no está disponible');
    var payload = planHaciaBackend(plan);
    var res = await a.evaluacionActionPlans.guardar({
      empresaId: empresaId,
      year: year,
      source: plan._source || 'ministerio',
      plan: payload
    });
    if (res && res.success === false) throw new Error((res.error && res.error.message) || res.error || 'No se pudo guardar');
    return res;
  }
  async function eliminarPlan(id) {
    var a = api();
    if (!a || !a.evaluacionActionPlans) throw new Error('La base de planes no está disponible');
    var res = await a.evaluacionActionPlans.eliminar({ empresaId: empresaId, id: id });
    if (res && res.success === false) throw new Error((res.error && res.error.message) || res.error || 'No se pudo eliminar');
    return res;
  }
  async function cargarPlanes() {
    var a = api();
    if (!a || !a.evaluacionActionPlans) return;
    try {
      var res = await a.evaluacionActionPlans.listar({ empresaId: empresaId, year: year });
      var arr = (res && Array.isArray(res.data)) ? res.data : (Array.isArray(res) ? res : []);
      S.planes = arr.map(function (row) {
        var plan = row.plan || row.plan_json || row;
        if (typeof plan === 'string') { try { plan = JSON.parse(plan); } catch (e) { plan = {}; } }
        if (!plan._source) plan._source = row.source || 'ministerio';
        if (!plan.id) plan.id = row.id;
        return planDesdeBackend(plan);
      });
      EV_LOG('PLAN', 'LISTAR', 'OK', S.planes.length + ' planes');
      renderPlanes();
    } catch (e) {
      EV_LOG('PLAN', 'LISTAR', 'ERR', e.message);
    }
  }

  function nuevoId() {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch (e) { /* sin crypto */ }
    return 'evp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  /** Genera un plan por cada hallazgo no conforme que todavía no tenga uno, y
      suma los planes que vienen dentro del informe de la ARL. */
  async function sincronizarPlanes(result, sourceType) {
    var planes = S.planes.slice();
    var porCodigo = {};
    planes.forEach(function (p) { if (p.codigo) porCodigo[p.codigo] = p; });

    // 1. Planes que trae el informe de la ARL
    var delInforme = Array.isArray(result.actionPlans) ? result.actionPlans : [];
    for (var i = 0; i < delInforme.length && sourceType === 'arl'; i++) {
      var raw = delInforme[i] || {};
      // Se intenta vincular al hallazgo por código; si no, se guarda suelto
      var codigo = raw.hallazgoCode || raw.code || (String(raw.hallazgoDesc || '').match(/\d+\.\d+\.\d+/) || [])[0] || '';
      if (codigo && porCodigo[codigo]) continue;
      var plan = {
        id: nuevoId(),
        codigo: codigo,
        hallazgoDesc: raw.hallazgoDesc || raw.desc || '',
        estado: 'Pendiente',
        accion: raw.accion || raw.descripcion || '',
        responsable: raw.responsable || 'Por asignar',
        fecha: raw.fechaLimite || raw.fecha || '',
        fechaISO: raw.fechaLimite || raw.fecha || '',
        seguimientos: [], responsables: [],
        _source: 'arl'
      };
      if (!plan.accion) continue;
      try { await guardarPlan(plan); planes.push(plan); if (codigo) porCodigo[codigo] = plan; }
      catch (e) { EV_LOG('PLAN', 'CREATE_ARL', 'ERR', e.message); }
    }

    // 2. Un plan por cada hallazgo no conforme sin plan
    var nuevos = 0;
    for (var j = 0; j < S.evaluacion.estandares.length; j++) {
      var e2 = S.evaluacion.estandares[j];
      if (e2.estado === 'cumple') continue;
      if (porCodigo[e2.c]) continue;
      var base = new Date();
      base.setDate(base.getDate() + 30);
      var p2 = {
        id: nuevoId(),
        codigo: e2.c,
        hallazgoDesc: e2.d,
        estado: 'Pendiente',
        accion: 'Implementar acciones correctivas para cumplir con el estándar ' + e2.c,
        responsable: 'Por asignar',
        fecha: fechaISOaDMY(base.toISOString().slice(0, 10)),
        fechaISO: base.toISOString().slice(0, 10),
        seguimientos: [], responsables: [],
        _source: sourceType
      };
      try {
        await guardarPlan(p2);
        planes.push(p2);
        porCodigo[e2.c] = p2;
        nuevos++;
      } catch (err) { EV_LOG('PLAN', 'CREATE', 'ERR', e2.c + ': ' + err.message); }
    }
    S.planes = planes;
    renderTodo();
    if (nuevos) EV_LOG('PLAN', 'GENERADOS', 'OK', nuevos + ' planes por hallazgos no conformes');
  }

  /* ══════════════ MODAL: DETALLE DEL PLAN ══════════════ */
  function abrirDetalle(id) {
    var p = planPorId(id);
    if (!p) return;
    S.detPlanId = id;
    var e = hallazgoPorCodigo(p.codigo);
    var be = $q('#det-estado');
    be.className = 'badge ' + badgePlanClass(p.estado);
    be.textContent = p.estado;
    $q('#det-fecha').textContent = p.fecha || '—';
    $q('#det-resp').textContent = p.responsable || 'Por asignar';
    $q('#det-hall-code').textContent = p.codigo || '—';
    $q('#det-hall-estado').textContent = e ? e.estado : 'sin evaluación';
    $q('#det-hall-desc').textContent = e ? e.d : (p.hallazgoDesc || '—');
    $q('#det-accion').textContent = p.accion || '—';

    var resp = $q('#det-responsables');
    if (p.responsables && p.responsables.length) {
      resp.classList.remove('det-muted');
      resp.classList.add('det-v');
      resp.textContent = p.responsables.join(' · ');
    } else {
      resp.classList.add('det-muted');
      resp.classList.remove('det-v');
      resp.textContent = p.responsable === 'Por asignar' ? 'Sin responsables asignados' : 'Responsable principal: ' + p.responsable;
    }

    var segBox = $q('#det-seg-list'), segEmpty = $q('#det-seg-empty');
    if (p.seguimientos && p.seguimientos.length) {
      segEmpty.classList.add('is-hidden');
      segBox.classList.remove('is-hidden');
      var hs = '';
      p.seguimientos.slice().reverse().forEach(function (s) {
        hs += '<div class="seg-item">' + ICON_SEG + '<div><div class="seg-note">' + esc(s.nota || s.descripcion) + '</div><div class="seg-meta">' + esc(s.fecha || '') + '</div></div></div>';
      });
      segBox.innerHTML = hs;
    } else {
      segEmpty.classList.remove('is-hidden');
      segEmpty.textContent = 'No hay seguimientos registrados';
      segBox.classList.add('is-hidden');
    }
    openOverlay('modal-detalle');
    EV_LOG('PLAN', 'DETALLE', 'OK', 'id=' + id + ' cod=' + p.codigo);
  }

  /* ══════════════ MODAL: NUEVO / EDITAR PLAN ══════════════ */
  function hallazgosSinPlan() {
    if (!S.evaluacion) return [];
    var conPlan = {};
    S.planes.forEach(function (p) { if (p.codigo) conPlan[p.codigo] = true; });
    return S.evaluacion.estandares.filter(function (e) {
      return e.estado !== 'cumple' && !conPlan[e.c];
    });
  }
  function abrirForm(editId) {
    S.editPlanId = editId || null;
    var esEdit = !!editId;
    $q('#form-title').textContent = esEdit ? 'Editar Plan de Acción' : 'Nuevo Plan de Acción';
    $q('#form-sub').textContent = esEdit ? 'Modifique los datos del plan de acción existente' : 'Registre los datos del nuevo plan de acción';
    var sel = $q('#f-hall'), p = esEdit ? planPorId(editId) : null, opts = '';
    if (esEdit) {
      var e = hallazgoPorCodigo(p.codigo);
      var txt = e ? e.d : (p.hallazgoDesc || '');
      opts = '<option value="' + esc(p.codigo) + '">' + esc(p.codigo) + ' – ' + esc(txt.slice(0, 42)) + (txt.length > 42 ? '…' : '') + '</option>';
      sel.innerHTML = opts; sel.disabled = true; sel.value = p.codigo;
      $q('#f-estado').value = p.estado;
      $q('#f-accion').value = p.accion;
      $q('#f-resp').value = p.responsable;
      $q('#f-fecha').value = p.fechaISO || fechaDMYaISO(p.fecha);
    } else {
      var libres = hallazgosSinPlan();
      if (libres.length) {
        libres.forEach(function (e2) {
          opts += '<option value="' + esc(e2.c) + '">' + esc(e2.c) + ' – ' + esc(e2.d.slice(0, 42)) + (e2.d.length > 42 ? '…' : '') + '</option>';
        });
      } else {
        // Todos los hallazgos no conformes ya tienen plan (o no hay evaluación
        // cargada): se deja registrar un plan suelto igual, porque el botón
        // "Nuevo Plan" siempre tiene que hacer algo.
        opts = '<option value="">Sin hallazgo asociado</option>';
        if (S.evaluacion) {
          toast('Todos los hallazgos no conformes ya tienen un plan asociado.', 'info');
        }
      }
      sel.innerHTML = opts; sel.disabled = false;
      $q('#f-estado').value = 'Pendiente';
      $q('#f-accion').value = '';
      $q('#f-resp').value = 'Por asignar';
      var base = new Date();
      base.setDate(base.getDate() + 30);
      $q('#f-fecha').value = base.toISOString().slice(0, 10);
    }
    validarForm();
    openOverlay('modal-form');
    EV_LOG('PLAN', esEdit ? 'EDIT_OPEN' : 'NEW_OPEN', 'OK', esEdit ? 'id=' + editId : '');
  }
  function validarForm() {
    var est = $q('#f-estado').value;
    var acc = $q('#f-accion').value.trim();
    var resp = $q('#f-resp').value.trim();
    var f = $q('#f-fecha').value;
    // El hallazgo solo es obligatorio si el selector ofrece hallazgos y no está
    // deshabilitado (al editar viene fijo). Con "Sin hallazgo asociado" se permite
    // guardar un plan suelto.
    var sel = $q('#f-hall');
    var hall = sel.value;
    var hallOk = sel.disabled ? true : (!!hall || sel.options.length === 1);
    var ok = !!(est && acc && resp && f && hallOk);
    $q('#form-save').disabled = !ok;
    return ok;
  }
  async function guardarForm() {
    if (!validarForm()) return;
    var btn = $q('#form-save');
    btn.disabled = true;
    var datos = {
      estado: $q('#f-estado').value,
      accion: $q('#f-accion').value.trim(),
      responsable: $q('#f-resp').value.trim(),
      fecha: fechaISOaDMY($q('#f-fecha').value),
      fechaISO: $q('#f-fecha').value,
      codigo: $q('#f-hall').value
    };
    try {
      if (S.editPlanId) {
        var p = planPorId(S.editPlanId);
        if (!p) throw new Error('Plan no encontrado');
        var antes = JSON.stringify(planHaciaBackend(p));
        p.estado = datos.estado; p.accion = datos.accion;
        p.responsable = datos.responsable; p.fecha = datos.fecha; p.fechaISO = datos.fechaISO;
        try {
          await guardarPlan(p);
        } catch (err) {
          // Se intenta volver al estado anterior para no mentir en pantalla
          var prev = JSON.parse(antes);
          p.estado = prev.estado; p.accion = prev.accion;
          p.responsable = prev.responsable; p.fecha = fechaISOaDMY(prev.fechaLimite);
          throw err;
        }
        toast('Cambios guardados correctamente.', 'ok');
        EV_LOG('PLAN', 'UPDATE', 'OK', 'id=' + p.id + ' estado=' + p.estado);
      } else {
        var e = hallazgoPorCodigo(datos.codigo);
        var nuevo = {
          id: nuevoId(),
          codigo: datos.codigo,
          hallazgoDesc: e ? e.d : '',
          estado: datos.estado,
          accion: datos.accion,
          responsable: datos.responsable,
          fecha: datos.fecha,
          fechaISO: datos.fechaISO,
          seguimientos: [], responsables: [],
          _source: (S.archivoActivo && S.archivoActivo.id.indexOf('arl') === 0) ? 'arl' : 'ministerio'
        };
        await guardarPlan(nuevo);
        S.planes.push(nuevo);
        toast('Plan de acción creado correctamente.', 'ok');
        EV_LOG('PLAN', 'CREATE', 'OK', 'cod=' + nuevo.codigo);
      }
      S.planes.sort(function (a, b) { return cmpCodigo(b.codigo || '', a.codigo || ''); });
      closeOverlay('modal-form');
      renderTodo();
    } catch (err) {
      EV_LOG('PLAN', S.editPlanId ? 'UPDATE' : 'CREATE', 'ERR', err.message);
      toast('No se pudo guardar el plan: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  /* ══════════════ MODAL: CONFIRMAR ELIMINACIÓN ══════════════ */
  function abrirConfirm(id) {
    var p = planPorId(id);
    if (!p) return;
    S.delPlanId = id;
    $q('#confirm-code').textContent = p.codigo || '—';
    openOverlay('modal-confirm');
  }
  async function confirmarEliminar() {
    var p = planPorId(S.delPlanId);
    if (p) {
      try {
        await eliminarPlan(p.id);
        S.planes = S.planes.filter(function (x) { return String(x.id) !== String(p.id); });
        toast('Plan del hallazgo ' + (p.codigo || '') + ' eliminado.', 'ok');
        EV_LOG('PLAN', 'DELETE', 'OK', 'id=' + p.id);
        renderTodo();
      } catch (e) {
        EV_LOG('PLAN', 'DELETE', 'ERR', e.message);
        toast('No se pudo eliminar el plan: ' + e.message, 'err');
      }
    }
    S.delPlanId = null;
    closeOverlay('modal-confirm');
  }

  /* ══════════════ MODAL: SEGUIMIENTO ══════════════ */
  function abrirSeg() {
    if (!S.detPlanId) return;
    S.segPlanId = S.detPlanId;
    $q('#seg-nota').value = '';
    $q('#seg-save').disabled = true;
    openOverlay('modal-seg');
    setTimeout(function () { $q('#seg-nota').focus(); }, 60);
  }
  async function guardarSeg() {
    var p = planPorId(S.segPlanId);
    var nota = $q('#seg-nota').value.trim();
    if (!p || !nota) return;
    $q('#seg-save').disabled = true;
    var nuevo = { id: Date.now(), nota: nota, fecha: fechaISOaDMY(new Date().toISOString().slice(0, 10)) };
    p.seguimientos = (p.seguimientos || []).concat([nuevo]);
    try {
      await guardarPlan(p);
      toast('Seguimiento registrado.', 'ok');
      EV_LOG('PLAN', 'SEGUIMIENTO', 'OK', 'id=' + p.id);
      closeOverlay('modal-seg');
      abrirDetalle(p.id);
    } catch (e) {
      p.seguimientos = p.seguimientos.filter(function (s) { return s.id !== nuevo.id; });
      EV_LOG('PLAN', 'SEGUIMIENTO', 'ERR', e.message);
      toast('No se pudo registrar el seguimiento: ' + e.message, 'err');
      $q('#seg-save').disabled = false;
    }
  }

  /* ══════════════ MODAL: RESPONSABLES ══════════════ */
  function renderResponsables() {
    var p = planPorId(S.respPlanId);
    var box = $q('#resp-lista');
    if (!p || !(p.responsables || []).length) {
      box.innerHTML = '<div class="det-muted">Sin responsables asignados</div>';
      return;
    }
    var h = '<div class="seg-list">';
    p.responsables.forEach(function (r, i) {
      h += '<div class="seg-item">' + ICON_SEG +
        '<div style="flex:1"><div class="seg-note">' + esc(r) + '</div></div>' +
        '<button type="button" class="icon-btn icon-btn--del" data-resp-del="' + i + '" title="Quitar" aria-label="Quitar responsable">' + ICON_TRASH + '</button>' +
        '</div>';
    });
    box.innerHTML = h + '</div>';
  }
  function abrirResp() {
    if (!S.detPlanId) return;
    S.respPlanId = S.detPlanId;
    $q('#resp-nuevo').value = '';
    renderResponsables();
    openOverlay('modal-resp');
  }
  async function agregarResp() {
    var p = planPorId(S.respPlanId);
    var nombre = $q('#resp-nuevo').value.trim();
    if (!p || !nombre) return;
    p.responsables = (p.responsables || []).concat([nombre]);
    try {
      await guardarPlan(p);
      $q('#resp-nuevo').value = '';
      renderResponsables();
      toast('Responsable agregado.', 'ok');
      EV_LOG('PLAN', 'RESP_ADD', 'OK', p.id);
    } catch (e) {
      p.responsables = p.responsables.filter(function (r) { return r !== nombre; });
      EV_LOG('PLAN', 'RESP_ADD', 'ERR', e.message);
      toast('No se pudo agregar el responsable: ' + e.message, 'err');
    }
  }
  async function quitarResp(idx) {
    var p = planPorId(S.respPlanId);
    if (!p || !p.responsables || !p.responsables[idx]) return;
    var quitado = p.responsables[idx];
    p.responsables.splice(idx, 1);
    try {
      await guardarPlan(p);
      renderResponsables();
      toast('Responsable quitado.', 'ok');
    } catch (e) {
      p.responsables.splice(idx, 0, quitado);
      renderResponsables();
      EV_LOG('PLAN', 'RESP_DEL', 'ERR', e.message);
      toast('No se pudo quitar el responsable: ' + e.message, 'err');
    }
  }

  /* ══════════════ EVENTOS ══════════════ */
  function onClick(ev) {
    var t = ev.target, el;
    if (t.classList && t.classList.contains('overlay')) { closeOverlay(t.getAttribute('id')); return; }

    el = t.closest ? t.closest('[data-close]') : null;
    if (el) { closeOverlay(el.getAttribute('data-close')); return; }

    el = t.closest ? t.closest('[data-resp-del]') : null;
    if (el) { quitarResp(parseInt(el.getAttribute('data-resp-del'), 10)); return; }

    el = t.closest ? t.closest('[data-carp]') : null;
    if (el) { S.pdfCarpeta = el.getAttribute('data-carp'); renderPicker(); EV_LOG('PDF', 'CARPETA', 'OK', S.pdfCarpeta); return; }

    el = t.closest ? t.closest('[data-doc]') : null;
    if (el) {
      var found = archivoPorId(el.getAttribute('data-doc'));
      if (found) cargarArchivo(found.archivo, found.carpeta);
      return;
    }

    el = t.closest ? t.closest('[data-det]') : null;
    if (el) { abrirDetalle(el.getAttribute('data-det')); return; }

    el = t.closest ? t.closest('[data-edit]') : null;
    if (el) { abrirForm(el.getAttribute('data-edit')); return; }

    el = t.closest ? t.closest('[data-del]') : null;
    if (el) { abrirConfirm(el.getAttribute('data-del')); return; }

    el = t.closest ? t.closest('[data-pg]') : null;
    if (el) {
      var pg = el.getAttribute('data-pg').split('-'), pref = pg[0], accion = pg[1];
      if (pref === 'hall') {
        var lh = hallFiltrados(), ph = Math.max(1, Math.ceil(lh.length / S.hallSize));
        if (accion === 'first') S.hallPage = 1;
        else if (accion === 'prev') S.hallPage = Math.max(1, S.hallPage - 1);
        else if (accion === 'next') S.hallPage = Math.min(ph, S.hallPage + 1);
        else if (accion === 'last') S.hallPage = ph;
        else S.hallPage = parseInt(accion, 10);
        renderHallazgos();
      } else {
        var pp = Math.max(1, Math.ceil(S.planes.length / S.planSize));
        if (accion === 'first') S.planPage = 1;
        else if (accion === 'prev') S.planPage = Math.max(1, S.planPage - 1);
        else if (accion === 'next') S.planPage = Math.min(pp, S.planPage + 1);
        else if (accion === 'last') S.planPage = pp;
        else S.planPage = parseInt(accion, 10);
        renderPlanes();
      }
    }
  }
  function onKeydown(ev) {
    if (ev.key === 'Escape' && overlayStack.length) { closeOverlay(topOverlay()); return; }
    if (ev.key === 'Enter' && !$q('#modal-form').classList.contains('is-hidden') && !$q('#form-save').disabled) {
      if (ev.target && ev.target.tagName === 'TEXTAREA' && (ev.ctrlKey || ev.metaKey)) guardarForm();
    }
    if (ev.key === 'Enter' && !$q('#modal-seg').classList.contains('is-hidden') && !$q('#seg-save').disabled) {
      if (ev.target && ev.target.tagName === 'TEXTAREA' && (ev.ctrlKey || ev.metaKey)) guardarSeg();
    }
  }

  /* ══════════════ MARCADO DE LA VISTA ══════════════
     El marcado va acá, embebido, y NO en el index.html del módulo.
     MOTIVO: este componente no se monta en un iframe — `renderer.js` le pasa un
     contenedor del documento principal. El index.html del módulo nunca se carga
     solo, así que el componente tiene que inyectar su propio marcado en render().
     El index.html queda para poder abrir la vista suelta durante el desarrollo.
     ══════════════ */
  function marcadoVista() {
    return `<!-- ══════════ BARRA SUPERIOR ══════════ -->
  <header class="ev-topbar">
    <div class="ev-badge-ico" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/><path d="m14.5 15.8 1.6 1.6 3-3.2" stroke-width="2"/></svg>
    </div>
    <div class="ev-titles">
      <h1 class="ev-title">Evaluación Inicial del SG-SST</h1>
      <p class="ev-sub">Evaluación del cumplimiento normativo SG-SST.</p>
    </div>
    <div class="ev-actions">
      <button type="button" class="btn btn-outline" id="btn-min">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>
        Cargar Ministerio
      </button>
      <button type="button" class="btn btn-outline" id="btn-arl">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 5.5v5.2c0 4.5 2.9 8.2 7 9.8 4.1-1.6 7-5.3 7-9.8V5.5z"/><path d="m9.2 12 2 2 3.8-4"/></svg>
        Cargar ARL
      </button>
      <span aria-hidden="true" style="width:1px;height:24px;background:var(--kair-border)"></span>
      <button type="button" class="btn btn-outline" id="btn-volver">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>
        Volver
      </button>
    </div>
  </header>

  <!-- ══════════ PESTAÑAS ══════════ -->
  <nav class="ev-tabs" role="tablist" aria-label="Secciones del módulo">
    <button type="button" class="ev-tab is-active" id="tab-dashboard" role="tab" aria-selected="true" aria-controls="view-dashboard" data-tab="dashboard">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M12 12 17.5 6.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>
      Dashboard
    </button>
    <button type="button" class="ev-tab" id="tab-hallazgos" role="tab" aria-selected="false" aria-controls="view-hallazgos" data-tab="hallazgos">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
      Hallazgos
    </button>
    <button type="button" class="ev-tab" id="tab-planes" role="tab" aria-selected="false" aria-controls="view-planes" data-tab="planes">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>
      Planes de Acción
    </button>
    <span class="ev-chip-pdf is-hidden" id="chip-pdf">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>
      <span>PDF activo&nbsp;·&nbsp;<b id="chip-pdf-name"></b></span>
    </span>
  </nav>

  <main>
    <!-- ══════════ VISTA DASHBOARD ══════════ -->
    <section class="kair-view" id="view-dashboard" role="tabpanel" aria-labelledby="tab-dashboard">
      <div class="kpi-strip">
        <div class="kpi-card" id="kpi-cumplimiento">
          <div class="kpi-ico kpi-ico--blue" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M12 12 17.5 6.5"/></svg>
          </div>
          <div class="kpi-body">
            <div class="kpi-val" id="kv-cumplimiento">0%</div>
            <div class="kpi-lbl">Cumplimiento</div>
          </div>
          <div class="kpi-side"><span class="chip chip--blue" id="kchip-cumplimiento">0%</span></div>
        </div>
        <button type="button" class="kpi-card is-click" id="kpi-criticos" title="Ir a Hallazgos">
          <div class="kpi-ico kpi-ico--red" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div class="kpi-body">
            <div class="kpi-val" id="kv-criticos">0</div>
            <div class="kpi-lbl">Hallazgos críticos</div>
          </div>
        </button>
        <button type="button" class="kpi-card is-click" id="kpi-planes" title="Ir a Planes de Acción">
          <div class="kpi-ico kpi-ico--amber" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12"/><path d="M6 21h12"/><path d="M7 3v3.5a4 4 0 0 0 1.2 2.9L11 12l-2.8 2.6A4 4 0 0 0 7 17.5V21"/><path d="M17 3v3.5a4 4 0 0 1-1.2 2.9L13 12l2.8 2.6A4 4 0 0 1 17 17.5V21"/></svg>
          </div>
          <div class="kpi-body">
            <div class="kpi-val" id="kv-planes">0</div>
            <div class="kpi-lbl">Planes pendientes</div>
          </div>
        </button>
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="card-h"><h2 class="card-t">Estado General de Cumplimiento</h2><span class="chip chip--blue count-chip is-hidden" id="gauge-chip">0%</span></div>
          <div class="gauge-wrap">
            <div class="gauge-box">
              <svg viewBox="0 0 220 122" role="img" aria-label="Medidor de cumplimiento general">
                <path class="gauge-track" d="M16 112 A94 94 0 0 1 204 112" stroke-width="15"/>
                <path class="gauge-arc" id="gauge-arc" d="M16 112 A94 94 0 0 1 204 112" stroke-width="15" stroke-dasharray="295.3" stroke-dashoffset="295.3" stroke="#DA5563"/>
              </svg>
              <div class="gauge-center">
                <div class="gauge-val" id="gauge-val">0%</div>
                <div class="gauge-cap">Cumplimiento</div>
              </div>
            </div>
            <div class="gauge-foot" id="gauge-foot"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-h"><h2 class="card-t">Balance Ciclo PHVA</h2></div>
          <div id="phva-body">
            <div class="phva-empty">
              <div class="phva-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              </div>
              <div class="phva-txt" id="phva-txt">Sin datos PHVA en el PDF</div>
              <div class="phva-hint" id="phva-hint">Cargue un informe PDF para ver el balance del ciclo.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="file-card">
          <div class="file-ico file-ico--wait" id="file-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6"/><path d="m9.5 6.5 2.5 2.5 2.5-2.5"/><path d="M4 13v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4"/></svg>
          </div>
          <div class="file-body">
            <div class="file-name" id="file-name">Esperando archivo fuente...</div>
            <div class="file-meta" id="file-meta">El sistema buscará automáticamente informes en la carga</div>
          </div>
          <button type="button" class="btn btn-outline is-hidden" id="btn-ver-doc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>
            Ver Documento
          </button>
        </div>
      </div>
    </section>

    <!-- ══════════ VISTA HALLAZGOS ══════════ -->
    <section class="kair-view is-hidden" id="view-hallazgos" role="tabpanel" aria-labelledby="tab-hallazgos">
      <div class="card">
        <div class="tbl-toolbar">
          <h2 class="card-t" style="font-size:15px">Detalle de Estándares</h2>
          <span class="chip chip--slate" id="hall-count">0 estándares</span>
          <div class="search" id="hall-search" style="margin-left:auto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
            <input type="text" id="hall-q" placeholder="Buscar estándar..." autocomplete="off" aria-label="Buscar estándar">
            <button type="button" class="search-x" id="hall-x" aria-label="Limpiar búsqueda">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div class="tbl-scroll" id="hall-scroll"></div>
        <div class="tbl-foot" id="hall-foot"></div>
      </div>
    </section>

    <!-- ══════════ VISTA PLANES ══════════ -->
    <section class="kair-view is-hidden" id="view-planes" role="tabpanel" aria-labelledby="tab-planes">
      <div class="card">
        <div class="tbl-toolbar">
          <h2 class="card-t" style="font-size:15px">Seguimiento de Planes</h2>
          <span class="chip chip--slate" id="plan-count">0 planes</span>
          <button type="button" class="btn btn-primary" id="btn-nuevo-plan" style="margin-left:auto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Nuevo Plan
          </button>
        </div>
        <div class="tbl-scroll" id="plan-scroll"></div>
        <div class="tbl-foot" id="plan-foot"></div>
      </div>
    </section>
  </main>

  <!-- ══════════ MODAL: SELECCIONAR PDF DE EVALUACIÓN ══════════ -->
  <div class="overlay is-hidden" id="modal-pdf" role="dialog" aria-modal="true" aria-labelledby="modal-pdf-t">
    <div class="modal m-pdf">
      <div class="modal-h">
        <div class="folder-ico" aria-hidden="true" style="background:var(--kair-blue-soft);color:var(--kair-blue)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>
        </div>
        <h2 class="modal-t" id="modal-pdf-t">Seleccionar PDF de Evaluación</h2>
        <button type="button" class="modal-x" data-close="modal-pdf" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-b">
        <div class="pdf-pane">
          <div class="crumb" id="pdf-crumb"><b>Raíz</b></div>
          <div class="pane-cap">Carpetas</div>
          <div id="pdf-carpetas"></div>
        </div>
        <div class="pdf-pane pdf-pane--r">
          <button type="button" class="back-bar is-hidden" id="pdf-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>
            Volver a carpetas
          </button>
          <div class="pane-cap" id="pdf-docs-cap" style="padding-top:14px">Documentos</div>
          <div class="doc-list" id="pdf-docs"></div>
          <div class="pdf-empty" id="pdf-empty">
            <div class="pdf-empty-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.6L10.7 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z"/></svg>
            </div>
            <div class="pdf-empty-t">Seleccione una carpeta</div>
            <div class="pdf-empty-d">Haga clic en una carpeta del panel izquierdo para ver los archivos PDF disponibles.</div>
          </div>
        </div>
      </div>
      <div class="modal-f">
        <button type="button" class="btn btn-ghost" data-close="modal-pdf">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- ══════════ MODAL: DETALLE DEL PLAN DE ACCIÓN ══════════ -->
  <div class="overlay is-hidden" id="modal-detalle" role="dialog" aria-modal="true" aria-labelledby="modal-det-t">
    <div class="modal m-det">
      <div class="det-head">
        <div class="det-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h6M7 13h10"/><path d="M7 17h4"/><path d="m14.8 15.6 1.5 1.5 2.8-3" stroke-width="2"/></svg>
        </div>
        <h2 class="det-title" id="modal-det-t">Detalle del Plan de Acción</h2>
      </div>
      <div class="modal-b" style="padding-top:10px">
        <div class="det-grid">
          <div class="det-card det-card--full">
            <div class="det-card-t">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="m3 6 1 1 2-2"/><path d="m3 12 1 1 2-2"/><path d="m3 18 1 1 2-2"/></svg>
              Información del Plan
            </div>
            <div class="det-row"><span class="det-k">Estado:</span><span class="det-v"><span class="badge" id="det-estado">Pendiente</span></span></div>
            <div class="det-row"><span class="det-k">Fecha Límite:</span><span class="det-v" id="det-fecha">—</span></div>
            <div class="det-row"><span class="det-k">Responsable:</span><span class="det-v" id="det-resp">Por asignar</span></div>
          </div>
          <div class="det-card">
            <div class="det-card-t">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              Hallazgo Asociado
            </div>
            <div class="hall-block">
              <span class="plan-code" id="det-hall-code">—</span>
              <span class="hall-estado" id="det-hall-estado">no_cumple</span>
            </div>
            <div class="hall-desc" id="det-hall-desc">—</div>
          </div>
          <div class="det-card">
            <div class="det-card-t">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="8" height="4" rx="1.5"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="m9.5 13 1.8 1.8 3.4-3.6" stroke-width="2"/></svg>
              Acción Correctiva
            </div>
            <div class="det-v" id="det-accion" style="font-weight:400;color:var(--kair-text-2)">—</div>
          </div>
          <div class="det-card">
            <div class="det-card-t">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Responsables
            </div>
            <div class="det-muted" id="det-responsables">Sin responsables asignados</div>
          </div>
          <div class="det-card">
            <div class="det-card-t">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              Seguimiento
            </div>
            <div class="det-muted" id="det-seg-empty">No hay seguimientos registrados</div>
            <div class="seg-list is-hidden" id="det-seg-list"></div>
          </div>
        </div>
      </div>
      <div class="modal-f">
        <button type="button" class="btn btn-outline lead" id="btn-add-seg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Agregar Seguimiento
        </button>
        <button type="button" class="btn btn-outline" id="btn-gest-resp">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>
          Gestionar Responsables
        </button>
      </div>
    </div>
  </div>

  <!-- ══════════ MODAL: NUEVO / EDITAR PLAN ══════════ -->
  <div class="overlay is-hidden" id="modal-form" role="dialog" aria-modal="true" aria-labelledby="form-title">
    <div class="modal m-form">
      <div class="form-head">
        <div class="form-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="8" height="4" rx="1.5"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6"/></svg>
        </div>
        <h2 class="form-title" id="form-title">Editar Plan de Acción</h2>
        <div class="form-sub" id="form-sub">Modifique los datos del plan de acción existente</div>
      </div>
      <div class="modal-b">
        <div class="f-grid">
          <div class="f-field f-field--full" id="ff-hall">
            <label class="f-label" for="f-hall">Hallazgo Asociado <span class="req">*</span></label>
            <select class="f-ctrl" id="f-hall"></select>
            <div class="f-hint">Seleccione el hallazgo asociado al plan.</div>
          </div>
          <div class="f-field" id="ff-estado">
            <label class="f-label" for="f-estado">Estado <span class="req">*</span></label>
            <select class="f-ctrl" id="f-estado">
              <option value="Pendiente">Pendiente</option>
              <option value="En proceso">En proceso</option>
              <option value="Completado">Completado</option>
            </select>
            <div class="f-hint">Seleccione el estado del plan.</div>
          </div>
          <div class="f-field" id="ff-fecha">
            <label class="f-label" for="f-fecha">Fecha Límite <span class="req">*</span></label>
            <input type="date" class="f-ctrl" id="f-fecha">
            <div class="f-hint">Indique la fecha límite del plan.</div>
          </div>
          <div class="f-field f-field--full" id="ff-accion">
            <label class="f-label" for="f-accion">Acción Correctiva <span class="req">*</span></label>
            <textarea class="f-ctrl" id="f-accion" placeholder="Implementar acciones correctivas para cumplir con el estándar"></textarea>
            <div class="f-hint">Describa la acción correctiva del plan.</div>
          </div>
          <div class="f-field f-field--full" id="ff-resp">
            <label class="f-label" for="f-resp">Responsable <span class="req">*</span></label>
            <input type="text" class="f-ctrl" id="f-resp" placeholder="Por asignar" value="Por asignar" autocomplete="off">
            <div class="f-hint">Indique el responsable del plan.</div>
          </div>
        </div>
      </div>
      <div class="modal-f">
        <button type="button" class="btn btn-ghost" id="form-cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          Cancelar
        </button>
        <button type="button" class="btn btn-primary" id="form-save" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
          Guardar Cambios
        </button>
      </div>
    </div>
  </div>

  <!-- ══════════ MODAL: CONFIRMAR ELIMINACIÓN ══════════ -->
  <div class="overlay is-hidden" id="modal-confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-t">
    <div class="modal m-confirm">
      <div class="confirm-b">
        <div class="confirm-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
        </div>
        <div>
          <div class="confirm-t" id="confirm-t">Eliminar plan de acción</div>
          <div class="confirm-d">¿Desea eliminar el plan del hallazgo <b id="confirm-code">—</b>? Esta acción no se puede deshacer.</div>
        </div>
      </div>
      <div class="modal-f">
        <button type="button" class="btn btn-ghost" id="confirm-no">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirm-yes">Eliminar</button>
      </div>
    </div>
  </div>

  <!-- ══════════ MODAL: AGREGAR SEGUIMIENTO ══════════ -->
  <div class="overlay is-hidden" id="modal-seg" role="dialog" aria-modal="true" aria-labelledby="seg-t">
    <div class="modal m-confirm">
      <div class="modal-h">
        <h2 class="modal-t" id="seg-t">Agregar Seguimiento</h2>
        <button type="button" class="modal-x" data-close="modal-seg" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-b">
        <div class="f-field f-field--full">
          <label class="f-label" for="seg-nota">Novedad <span class="req">*</span></label>
          <textarea class="f-ctrl" id="seg-nota" placeholder="Describa el avance o la novedad del plan..."></textarea>
        </div>
      </div>
      <div class="modal-f">
        <button type="button" class="btn btn-ghost" data-close="modal-seg">Cancelar</button>
        <button type="button" class="btn btn-primary" id="seg-save" disabled>Guardar</button>
      </div>
    </div>
  </div>

  <!-- ══════════ MODAL: GESTIONAR RESPONSABLES ══════════ -->
  <div class="overlay is-hidden" id="modal-resp" role="dialog" aria-modal="true" aria-labelledby="resp-t">
    <div class="modal m-confirm">
      <div class="modal-h">
        <h2 class="modal-t" id="resp-t">Gestionar Responsables</h2>
        <button type="button" class="modal-x" data-close="modal-resp" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-b">
        <div class="f-field f-field--full">
          <label class="f-label" for="resp-nuevo">Agregar responsable</label>
          <input type="text" class="f-ctrl" id="resp-nuevo" placeholder="Nombre del responsable" autocomplete="off">
        </div>
        <div style="margin-top:14px">
          <div class="pane-cap">Responsables actuales</div>
          <div id="resp-lista"></div>
        </div>
      </div>
      <div class="modal-f">
        <button type="button" class="btn btn-ghost" data-close="modal-resp">Cerrar</button>
        <button type="button" class="btn btn-primary" id="resp-add">Agregar</button>
      </div>
    </div>
  </div>

  <div class="toasts" id="toasts" aria-live="polite"></div>`;
  }

  /* ══════════════ API PÚBLICA DEL COMPONENTE ══════════════ */
  function EvaluacionInicialView(container, moduleName, submoduleTitle, backToModuleCallback) {
    containerRef = container;
    backCallback = backToModuleCallback;
    empresaId = getEmpresaId();
    this.container = container;
    this.moduleName = moduleName || 'Gestión Integral';
    this.submoduleTitle = submoduleTitle || '2.3.1 Evaluación inicial del SG-SST';
  }

  /**
   * Busca un elemento DENTRO del componente. Importante: no se usa `document`
   * a secas porque este componente monta su marcado dentro del contenedor que le
   * pasa `renderer.js`, y `document.getElementById` funcionaría por casualidad
   * (los ids son únicos en el documento) pero se rompería si la app tuviera dos
   * módulos abiertos o una vista previa. Con el contenedor, todo queda adentro.
   */
  function $q(sel) {
    var raiz = contenedorMarcado || containerRef || document;
    return raiz.querySelector(sel);
  }

  EvaluacionInicialView.prototype.render = async function () {
    var a = api();
    var self = this;

    // El marcado NO vive acá: se inyecta. El componente corre dentro del documento
    // principal (no en un iframe), así que el index.html del módulo no se carga solo.
    var marcado = marcadoVista();
    var host = this.container;
    if (host) { host.innerHTML = ''; }
    if (!document.getElementById('ev-root') || !host) {
      contenedorMarcado = document.createElement('div');
      contenedorMarcado.className = 'ev-scope';
      contenedorMarcado.id = 'ev-root';
      contenedorMarcado.innerHTML = marcado;
      if (host) host.appendChild(contenedorMarcado);
      else document.body.appendChild(contenedorMarcado);
    } else {
      contenedorMarcado = document.getElementById('ev-root');
    }

    // A partir de acá, TODAS las búsquedas quedan dentro del componente.
    // Respaldo: los modales y los avisos se MUEVEN al <body> (ver abajo), así que
    // dejan de estar dentro de `contenedorMarcado`. Para esos se busca por id, que
    // es único en el documento. El respaldo solo actúa si el nodo no está adentro.
    $q = function (s) {
      var n = contenedorMarcado.querySelector(s);
      if (n) return n;
      return (s.charAt(0) === '#') ? document.getElementById(s.slice(1)) : null;
    };
    $$ = function (s) { return Array.prototype.slice.call(contenedorMarcado.querySelectorAll(s)); };

    // Los modales y los avisos se mueven al <body>: son `position: fixed` y dentro
    // de un contenedor con flex/transform, `fixed` se comporta como `absolute` y no
    // cubriría la ventana. Se les deja la clase `ev-scope` para que sigan recibiendo
    // los estilos (las reglas de modales contemplan las dos formas).
    var nodosFlotantes = contenedorMarcado.querySelectorAll('.overlay, .toasts');
    Array.prototype.forEach.call(nodosFlotantes, function (n) {
      n.classList.add('ev-scope');
      document.body.appendChild(n);
    });

    // Lectura inicial de datos
    try {
      await cargarPlanes();
      await cargarCarpetas();
      renderTodo();
    } catch (e) {
      EV_LOG('MODULO', 'DATOS', 'ERR', (e && e.message) || String(e));
    }

    // Eventos
    $$('.ev-tab').forEach(function (t) {
      t.addEventListener('click', function () { setTab(t.getAttribute('data-tab')); });
    });
    var _faltantes = [];
    function on(sel, ev, fn) {
      var n = $q(sel);
      if (!n) { _faltantes.push(sel); return; }
      n.addEventListener(ev, fn);
    }
    on('#btn-min', 'click', function () { abrirModalPdf('min'); });
    on('#btn-arl', 'click', function () { abrirModalPdf('arl'); });
    on('#btn-volver', 'click', function () {
      if (typeof backCallback === 'function') { backCallback(); EV_LOG('NAV', 'VOLVER', 'OK'); }
      else { toast('No se pudo volver: falta el enlace con el panel del módulo.', 'err'); }
    });
    on('#btn-ver-doc', 'click', function () {
      if (S.evaluacion && S.evaluacion.path && a && a.openPath) {
        a.openPath(S.evaluacion.path);
        EV_LOG('PDF', 'VIEW', 'OK', S.evaluacion.nombre);
      }
    });
    on('#btn-nuevo-plan', 'click', function () { abrirForm(null); });
    on('#pdf-back', 'click', function () { S.pdfCarpeta = null; renderPicker(); });
    on('#hall-q', 'input', function () {
      S.hallQ = this.value;
      S.hallPage = 1;
      var s = $q('#hall-search');
      if (s) s.classList.toggle('has-val', !!this.value);
      clearTimeout(window.__hallT);
      window.__hallT = setTimeout(renderHallazgos, 260);
    });
    on('#hall-x', 'click', function () {
      S.hallQ = '';
      var q = $q('#hall-q'), s = $q('#hall-search');
      if (q) q.value = '';
      if (s) s.classList.remove('has-val');
      S.hallPage = 1;
      renderHallazgos();
      if (q) q.focus();
    });
    on('#kpi-criticos', 'click', function () { setTab('hallazgos'); });
    on('#kpi-planes', 'click', function () { setTab('planes'); });
    on('#kpi-cumplimiento', 'click', function () { setTab('dashboard'); });
    on('#form-cancel', 'click', function () { closeOverlay('modal-form'); });
    on('#form-save', 'click', guardarForm);
    on('#f-estado', 'change', validarForm);
    on('#f-accion', 'input', validarForm);
    on('#f-resp', 'input', validarForm);
    on('#f-fecha', 'change', validarForm);
    on('#confirm-no', 'click', function () { closeOverlay('modal-confirm'); });
    on('#confirm-yes', 'click', confirmarEliminar);
    on('#btn-add-seg', 'click', abrirSeg);
    on('#seg-save', 'click', guardarSeg);
    on('#seg-nota', 'input', function () {
      var b = $q('#seg-save');
      if (b) b.disabled = !this.value.trim();
    });
    on('#btn-gest-resp', 'click', abrirResp);
    on('#resp-add', 'click', agregarResp);
    if (_faltantes.length) EV_LOG('MODULO', 'BIND', 'ERR', 'no se encontraron: ' + _faltantes.join(', '));

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);

    this._onClick = onClick;
    this._onKeydown = onKeydown;
    setTab('dashboard');
    EV_LOG('MODULO', 'INIT', 'OK', 'evaluación inicial lista · empresa=' + empresaId + ' año=' + year);
  };

  EvaluacionInicialView.prototype.destroy = function () {
    if (this._onClick) document.removeEventListener('click', this._onClick);
    if (this._onKeydown) document.removeEventListener('keydown', this._onKeydown);
    clearTimeout(window.__hallT);
    // Se sacan del <body> los nodos que se habían movido (modales y avisos)
    ['modal-pdf', 'modal-detalle', 'modal-form', 'modal-confirm', 'modal-seg', 'modal-resp', 'toasts']
      .forEach(function (id) {
        var n = document.getElementById(id);
        if (n && n.parentNode) n.parentNode.removeChild(n);
      });
    contenedorMarcado = null;
    containerRef = null;
    overlayStack = [];
    EV_LOG('MODULO', 'DESTROY', 'OK');
  };

  window.EvaluacionInicialView = EvaluacionInicialView;
  // Alias con el nombre viejo: si algún otro punto de la app todavía busca
  // `window.EvaluacionInicialSgSst`, sigue funcionando.
  window.EvaluacionInicialSgSst = EvaluacionInicialView;
})();
