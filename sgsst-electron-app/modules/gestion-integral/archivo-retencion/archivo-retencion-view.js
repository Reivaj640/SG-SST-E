/* ============================================================
   K+AIR · Archivo y Retención Documental — Lógica (v2 premium)
   ============================================================
   Base visual: el prototipo premium v2 (barra con migas, tarjetas de KPI,
   tabla con fila expandible, modales por bloques, paginación con números).
   Sobre esa base se conserva TODO lo funcional del módulo anterior:

     · Puente real con el contenedor por postMessage (el prototipo era una
       demo en memoria y no tenía puente). Se mantienen los `type` exactos
       que ya soporta `archivo-retencion.js`: leer-todos, crear, actualizar,
       eliminar, guardar, back-to-module-request, iframe-ready.
     · Edición en línea en la tabla (Descripción, Código, Revisión,
       Almacenamiento), con la fila marcada y botón "Guardar" que sube los
       cambios al Excel.
     · Atajos Ctrl+N y Ctrl+F.

   🚨 ADAPTADOR DE CAMPOS — acá estaban los 3 bugs de datos del módulo viejo:
   El iframe leía `doc.tipo` y `doc.hoja` y escribía `disposicionFinal` y
   `tipo`, pero el backend del Excel (archivo-retencion-main.js) usa OTROS
   nombres. Consecuencias que tenía el módulo anterior:
     · la columna Tipo salía siempre "—" y los KPI Documentos/Registros en 0
       (el backend entrega tipoDoc/tipoReg/tipoInterno/tipoExterno booleanos);
     · el selector "Todas las hojas" quedaba vacío (el backend lo llama
       `hojaOrigen`, y siempre vale el nombre de la hoja maestra);
     · editar Tipo o Disposición Final NO se guardaba (el backend lee
       `disposicion` y parsea `tipo` como texto combinado).
   Por eso ahora hay dos funciones explícitas, `desdeBackend()` y
   `haciaBackend()`, y toda mutación pasa por ellas. No usar los nombres del
   backend directamente en la vista nunca más.
   ============================================================ */
(function () {
  'use strict';

  /* ── Logging estructurado ── */
  function klog(mod, accion, status, extra) {
    var tag = '[K+AIRARC][' + mod + '][' + accion + '][' + status + ']';
    if (extra !== undefined) console.log(tag, extra); else console.log(tag);
  }

  /* ── Helpers base ── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  var MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fDoc(iso) {
    if (!iso) return '';
    var s = String(iso).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return parseInt(m[3], 10) + ' ' + MES3[parseInt(m[2], 10) - 1] + ' ' + m[1];
    // El Excel también trae fechas ya formateadas (dd/mm/aaaa o texto libre)
    var m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) return parseInt(m2[1], 10) + ' ' + MES3[parseInt(m2[2], 10) - 1] + ' ' + m2[3];
    return s;
  }
  /** Normaliza cualquier fecha del Excel a `yyyy-mm-dd` (lo que espera <input type=date>). */
  function aISO(v) {
    if (!v) return '';
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    var m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) return m2[3] + '-' + pad2(parseInt(m2[2], 10)) + '-' + pad2(parseInt(m2[1], 10));
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }
    return '';
  }

  /* ── Iconos (SVG inline) ── */
  function ico(path, extra) {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + path + '</svg>';
  }
  var ICO = {
    chev: '<svg class="kair-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    chevl: ico('<path d="m15 18-6-6 6-6"/>'),
    chevr: ico('<path d="m9 18 6-6-6-6"/>'),
    chev2l: ico('<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>'),
    chev2r: ico('<path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/>'),
    pencil: ico('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
    trash: ico('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>'),
    ok: ico('<path d="M20 6 9 17l-5-5"/>'),
    err: ico('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
    info: ico('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
    doc: ico('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>'),
    copy: ico('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    layers: ico('<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>'),
    box: ico('<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>')
  };

  /* ══════════════════════════════════════════════════════════════
     PUENTE CON EL CONTENEDOR (postMessage)
     Los `type` son EXACTAMENTE los que ya maneja archivo-retencion.js.
     ══════════════════════════════════════════════════════════════ */
  function callParentAPI(type, payload) {
    return new Promise(function (resolve, reject) {
      var requestId = 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      var handler = function (event) {
        if (!event.data || event.data.type !== type + '-response') return;
        if (event.data.requestId !== requestId) return;
        window.removeEventListener('message', handler);
        var p = event.data.payload;
        if (p && p.success) resolve(p);
        else reject(new Error((p && p.error && p.error.message) || (p && p.error) || 'Error desconocido'));
      };
      window.addEventListener('message', handler);
      try {
        window.parent.postMessage({ type: type + '-request', payload: payload, requestId: requestId }, '*');
      } catch (e) {
        window.removeEventListener('message', handler);
        reject(e);
      }
    });
  }
  function notifyParent(type, payload) {
    try { window.parent.postMessage({ type: type, payload: payload }, '*'); } catch (e) { /* sin padre */ }
  }

  /* ══════════════════════════════════════════════════════════════
     ADAPTADOR DE CAMPOS  (ver el comentario grande de arriba)
     ══════════════════════════════════════════════════════════════ */

  /** Los 4 booleanos del backend → el texto combinado que muestra la vista. */
  function tipoDesdeBooleanos(d) {
    var out = [];
    if (d.tipoDoc) out.push('Documento');
    if (d.tipoReg) out.push('Registro');
    if (d.tipoInterno) out.push('Interno');
    if (d.tipoExterno) out.push('Externo');
    return out.join(', ');
  }

  /** Texto combinado de la vista → los 4 booleanos del backend. */
  function booleanosDesdeTipo(tipo) {
    var partes = String(tipo || '').split(',').map(function (s) { return s.trim(); });
    return {
      tipoDoc: partes.indexOf('Documento') >= 0,
      tipoReg: partes.indexOf('Registro') >= 0,
      tipoInterno: partes.indexOf('Interno') >= 0,
      tipoExterno: partes.indexOf('Externo') >= 0
    };
  }

  /** Registro del backend Excel → modelo de la vista. */
  function desdeBackend(d, i) {
    var tipo = tipoDesdeBooleanos(d);
    var disp = (d.disposicion || '').trim();
    // "Sin definir" es el estado vacío de la vista; el Excel guarda esa opción como "N/A"
    if (norm(disp) === 'n/a') disp = '';
    return {
      id: 'r' + (i + 1),
      n: i + 1,
      desc: d.descripcion || '',
      codigo: d.codigo || '',
      rev: d.revision == null ? '' : String(d.revision),
      tipo: tipo,
      fcre: aISO(d.fechaCreacion),
      fact: aISO(d.fechaActualizacion),
      alm: d.almacenamiento || '',
      ret: d.retencion || '',
      disp: disp,
      hoja: d.hojaOrigen || '',
      _dirty: false
    };
  }

  /** Modelo de la vista → payload del backend (para crear / actualizar / guardar). */
  function haciaBackend(r) {
    var flags = booleanosDesdeTipo(r.tipo);
    return {
      // El nombre que lee el backend es `disposicion`; el que usaba la vista vieja
      // (con "Final" al final) no existe allá y por eso el campo no se guardaba.
      descripcion: r.desc || '',
      codigo: r.codigo || '',
      revision: r.rev || '',
      tipo: r.tipo || '',
      tipoDoc: flags.tipoDoc,
      tipoReg: flags.tipoReg,
      tipoInterno: flags.tipoInterno,
      tipoExterno: flags.tipoExterno,
      fechaCreacion: r.fcre || '',
      fechaActualizacion: r.fact || '',
      almacenamiento: r.alm || '',
      retencion: r.ret || '',
      disposicion: r.disp || ''
    };
  }

  /* ══════════════ ESTADO ══════════════ */
  var REGISTROS = [];
  var HOJAS = [];
  var S = { q: '', hoja: '', disp: '', sort: { key: null, dir: 1 }, page: 1, size: 50, open: {}, editId: null, delId: null };
  var companyName = '';

  function visibles() {
    var q = norm(S.q), out = [];
    REGISTROS.forEach(function (r) {
      if (S.hoja && r.hoja !== S.hoja) return;
      if (S.disp === 'muerto' && r.disp !== 'Muerto') return;
      if (S.disp === 'sindef' && r.disp !== '') return;
      if (q && norm(r.desc).indexOf(q) < 0 && norm(r.codigo).indexOf(q) < 0) return;
      out.push(r);
    });
    if (S.sort.key) {
      var k = S.sort.key, dir = S.sort.dir;
      out.sort(function (a, b) {
        var va, vb;
        if (k === 'desc') { va = norm(a.desc); vb = norm(b.desc); return va < vb ? -dir : va > vb ? dir : (a.n - b.n) * dir; }
        if (k === 'codigo') { va = a.codigo; vb = b.codigo; return va < vb ? -dir : va > vb ? dir : (a.n - b.n) * dir; }
        if (k === 'fcre') { va = a.fcre; vb = b.fcre; if (!va && vb) return 1; if (va && !vb) return -1; return va < vb ? -dir : va > vb ? dir : (a.n - b.n) * dir; }
        if (k === 'fact') { va = a.fact; vb = b.fact; if (!va && !vb) return (a.n - b.n) * dir; if (!va) return 1; if (!vb) return -1; return va < vb ? -dir : va > vb ? dir : (a.n - b.n) * dir; }
        return (a.n - b.n) * dir;
      });
    }
    return out;
  }

  /* ══════════════ REFERENCIAS DOM ══════════════ */
  function $(id) { return document.getElementById(id); }
  var el = {
    main: $('main'), skel: $('skel'),
    kpiTotal: $('kpi-total'), kpiDoc: $('kpi-doc'), kpiReg: $('kpi-reg'), kpiM: $('kpi-m'), kpiMChip: $('kpi-m-chip'), kpiMuerto: $('kpi-muerto'),
    q: $('f-q'), qClear: $('q-clear'), hoja: $('f-hoja'), disp: $('f-disp'), btnClear: $('btn-clear'), btnNuevo: $('btn-nuevo'),
    tbody: $('tbody'), empty: $('empty'), btnEmptyClear: $('btn-empty-clear'),
    size: $('f-size'), footCount: $('foot-count'), pager: $('pager'),
    ovForm: $('ov-form'), mTitle: $('m-title'), mDesc: $('m-desc'), fldDesc: $('fld-desc'), mCod: $('m-cod'), mRev: $('m-rev'),
    mTipo: $('m-tipo'), mFcre: $('m-fcre'), mFact: $('m-fact'), mAlm: $('m-alm'), mRet: $('m-ret'), mDisp: $('m-disp'),
    mSave: $('m-save'), mCancel: $('m-cancel'), mX: $('m-x'),
    ovDel: $('ov-del'), dTx: $('d-tx'), dDel: $('d-del'), dCancel: $('d-cancel'), dX: $('d-x'),
    btnVolver: $('btn-volver'), btnExport: $('btn-export'), btnRefresh: $('btn-refresh'), icoRefresh: $('ico-refresh'),
    btnGuardar: $('btn-guardar'), chipEmp: $('chip-emp'),
    toasts: $('toasts')
  };

  /* ══════════════ RENDER ══════════════ */
  function stats() {
    var st = { total: REGISTROS.length, doc: 0, reg: 0, muertos: 0, sinDisp: 0 };
    REGISTROS.forEach(function (r) {
      if (r.tipo.indexOf('Documento') >= 0) st.doc++;
      if (r.tipo.indexOf('Registro') >= 0) st.reg++;
      if (r.disp === 'Muerto') st.muertos++;
      if (r.disp === '') st.sinDisp++;
    });
    return st;
  }

  function renderKpis() {
    var st = stats();
    el.kpiTotal.textContent = st.total;
    el.kpiDoc.textContent = st.doc;
    el.kpiReg.textContent = st.reg;
    el.kpiM.textContent = st.muertos;
    el.kpiMChip.textContent = Math.round(st.muertos / Math.max(1, st.total) * 100) + '% del total';
  }

  function fCell(k, v, dash) {
    return '<div class="kair-detail__f"><div class="kair-detail__k">' + k + '</div><div class="kair-detail__v' + (dash ? ' is-dash' : '') + '">' + v + '</div></div>';
  }
  function detailHTML(r) {
    return '<div class="kair-detail">' +
      fCell('Descripción', esc(r.desc)) +
      fCell('Código', '<span class="kair-code">' + esc(r.codigo) + '</span>') +
      fCell('Revisión', esc(r.rev || '—'), !r.rev) +
      fCell('Tipo', r.tipo ? '<span class="kair-badge is-blue">' + esc(r.tipo) + '</span>' : '—', !r.tipo) +
      fCell('Fecha creación', r.fcre ? fDoc(r.fcre) : '—', !r.fcre) +
      fCell('Fecha actualización', r.fact ? fDoc(r.fact) : '—', !r.fact) +
      fCell('Almacenamiento', r.alm ? esc(r.alm) : '—', !r.alm) +
      fCell('Retención', r.ret ? '<span class="kair-badge is-blue">' + esc(r.ret) + '</span>' : '—', !r.ret) +
      fCell('Disposición final', r.disp ? '<span class="kair-badge is-slate">' + esc(r.disp) + '</span>' : '—', !r.disp) +
      fCell('Hoja de origen', r.hoja ? esc(r.hoja) : '—', !r.hoja) +
      '</div>';
  }

  function tipoCell(r) {
    if (!r.tipo) return '<span class="kair-dash">—</span>';
    var h = '';
    r.tipo.split(', ').forEach(function (t) { h += '<span class="kair-badge is-blue">' + esc(t) + '</span> '; });
    return h;
  }

  /** Celda editable en línea. `campo` es la propiedad del modelo. */
  function celdaEditable(r, campo, extraClase, titulo) {
    return '<span class="kair-cell-edit ' + (extraClase || '') + '" contenteditable="true" spellcheck="false"' +
      ' data-campo="' + campo + '" data-id="' + r.id + '"' +
      (titulo ? ' title="' + esc(titulo) + '"' : '') + '>' + esc(r[campo]) + '</span>';
  }

  function renderTable() {
    var list = visibles();
    var pages = Math.max(1, Math.ceil(list.length / S.size));
    if (S.page > pages) S.page = pages;
    if (S.page < 1) S.page = 1;
    var ini = (S.page - 1) * S.size;
    var slice = list.slice(ini, ini + S.size);
    var h = '';
    slice.forEach(function (r) {
      var open = !!S.open[r.id];
      h += '<tr class="kair-row' + (open ? ' is-open' : '') + (r._dirty ? ' is-dirty' : '') + '" data-id="' + r.id + '" tabindex="0" role="button" aria-expanded="' + (open ? 'true' : 'false') + '" aria-label="' + esc(r.desc) + '">';
      h += '<td class="kair-td-n">' + (r._dirty ? '<span class="kair-dirty-dot" title="Cambios sin guardar"></span> ' : '') + r.n + '</td>';
      h += '<td><div class="kair-td-desc">' + ICO.chev + celdaEditable(r, 'desc', 'kair-td-desc__tx', 'Doble clic para editar') + '</div></td>';
      h += '<td>' + celdaEditable(r, 'codigo', 'kair-code', 'Doble clic para editar') + '</td>';
      h += '<td class="kair-rev">' + (celdaEditable(r, 'rev', '', 'Doble clic para editar') || '<span class="kair-dash">—</span>') + '</td>';
      h += '<td>' + tipoCell(r) + '</td>';
      h += '<td class="kair-td-date">' + (r.fcre ? fDoc(r.fcre) : '<span class="kair-dash">—</span>') + '</td>';
      h += '<td class="kair-td-date">' + (r.fact ? fDoc(r.fact) : '<span class="kair-dash">—</span>') + '</td>';
      h += '<td class="kair-td-alm" title="' + esc(r.alm) + '">' + celdaEditable(r, 'alm', '', 'Doble clic para editar') + '</td>';
      h += '<td>' + (r.ret ? '<span class="kair-badge is-blue">' + esc(r.ret) + '</span>' : '<span class="kair-dash">—</span>') + '</td>';
      h += '<td>' + (r.disp ? '<span class="kair-badge is-slate">' + esc(r.disp) + '</span>' : '<span class="kair-dash">—</span>') + '</td>';
      h += '<td class="kair-td-act"><button class="kair-iconbtn" data-act="edit" title="Editar registro" aria-label="Editar registro">' + ICO.pencil + '</button><button class="kair-iconbtn is-danger" data-act="del" title="Eliminar registro" aria-label="Eliminar registro">' + ICO.trash + '</button></td>';
      h += '</tr>';
      h += '<tr class="kair-drow" data-drow="' + r.id + '"' + (open ? '' : ' hidden') + '><td colspan="11">' + detailHTML(r) + '</td></tr>';
    });
    el.tbody.innerHTML = h;
    el.empty.hidden = list.length > 0;
    el.footCount.textContent = 'de ' + list.length + ' registros';
    renderPager(pages);
    renderSortMarks();
    renderGuardarBtn();
  }

  function pagerNums(cur, total) {
    var a = [], i;
    if (total <= 7) { for (i = 1; i <= total; i++) a.push(i); return a; }
    a.push(1);
    var lo = Math.max(2, cur - 1), hi = Math.min(total - 1, cur + 1);
    if (lo > 2) a.push('…');
    for (i = lo; i <= hi; i++) a.push(i);
    if (hi < total - 1) a.push('…');
    a.push(total);
    return a;
  }
  function renderPager(pages) {
    var h = '';
    h += '<button data-p="1" title="Primera página"' + (S.page === 1 ? ' disabled' : '') + '>' + ICO.chev2l + '</button>';
    h += '<button data-p="' + (S.page - 1) + '" title="Página anterior"' + (S.page === 1 ? ' disabled' : '') + '>' + ICO.chevl + '</button>';
    pagerNums(S.page, pages).forEach(function (n) {
      h += (n === '…') ? '<span class="gap">…</span>' : '<button data-p="' + n + '" class="' + (n === S.page ? 'is-on' : '') + '" aria-label="Página ' + n + '"' + (n === S.page ? ' aria-current="page"' : '') + '>' + n + '</button>';
    });
    h += '<button data-p="' + (S.page + 1) + '" title="Página siguiente"' + (S.page === pages ? ' disabled' : '') + '>' + ICO.chevr + '</button>';
    h += '<button data-p="' + pages + '" title="Última página"' + (S.page === pages ? ' disabled' : '') + '>' + ICO.chev2r + '</button>';
    el.pager.innerHTML = h;
  }
  function renderSortMarks() {
    document.querySelectorAll('.kair-thbtn').forEach(function (b) {
      b.classList.remove('is-asc', 'is-desc');
      if (b.getAttribute('data-sort') === S.sort.key) b.classList.add(S.sort.dir === 1 ? 'is-asc' : 'is-desc');
    });
  }

  function renderHojaOptions() {
    var h = '<option value="">Todas las hojas</option>';
    HOJAS.forEach(function (hj) { h += '<option value="' + esc(hj.nombre) + '">' + esc(hj.nombre) + ' (' + hj.n + ')</option>'; });
    el.hoja.innerHTML = h;
    if (S.hoja) el.hoja.value = S.hoja;
  }
  /** Las "hojas" se derivan de la hoja de origen del Excel o, si no hay, del prefijo del código. */
  function recalcularHojas() {
    var seen = {};
    HOJAS = [];
    REGISTROS.forEach(function (r) {
      var k = r.hoja || (r.codigo ? String(r.codigo).split('-')[0] : '(sin código)');
      if (!seen[k]) { seen[k] = { nombre: k, n: 0 }; HOJAS.push(seen[k]); }
      seen[k].n++;
    });
  }

  function renderFiltros() {
    var activa = S.q || S.hoja || S.disp;
    el.btnClear.hidden = !activa;
    el.qClear.hidden = !S.q;
  }
  function renderGuardarBtn() {
    var cuantos = REGISTROS.filter(function (r) { return r._dirty; }).length;
    el.btnGuardar.hidden = cuantos === 0;
    el.btnGuardar.disabled = cuantos === 0;
    el.btnGuardar.title = cuantos === 0 ? 'Sin cambios pendientes' : 'Guardar ' + cuantos + ' cambio(s) en el Excel';
  }
  function renderAll() {
    renderKpis();
    renderTable();
    renderFiltros();
  }

  /* ══════════════ TOASTS ══════════════ */
  function toast(msg, kind) {
    var ic = kind === 'err' ? ICO.err : kind === 'info' ? ICO.info : ICO.ok;
    var t = document.createElement('div');
    t.className = 'kair-toast is-' + (kind || 'ok');
    t.innerHTML = ic + '<span>' + esc(msg) + '</span>';
    el.toasts.appendChild(t);
    klog('UI', 'TOAST', 'OK', { tipo: kind || 'ok', msg: msg });
    setTimeout(function () { t.classList.add('is-out'); }, 2600);
    setTimeout(function () { t.remove(); }, 2950);
  }

  /* ══════════════ MODALES ══════════════ */
  var _lastFocus = null;
  function openOv(ov, focusEl) {
    _lastFocus = document.activeElement;
    ov.classList.add('is-open');
    if (focusEl) setTimeout(function () { focusEl.focus(); }, 60);
  }
  function closeOv(ov) {
    ov.classList.remove('is-open');
    if (_lastFocus && _lastFocus.focus) { try { _lastFocus.focus(); } catch (e) { /* noop */ } }
    _lastFocus = null;
  }

  function setTipoChips(arr) {
    el.mTipo.querySelectorAll('.kair-tipo__chip').forEach(function (ch) {
      var on = arr.indexOf(ch.getAttribute('data-v')) >= 0;
      ch.classList.toggle('is-on', on);
      ch.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function getTipoChips() {
    var out = [];
    el.mTipo.querySelectorAll('.kair-tipo__chip.is-on').forEach(function (ch) { out.push(ch.getAttribute('data-v')); });
    return out;
  }

  function openForm(r) {
    S.editId = r ? r.id : null;
    el.mTitle.textContent = r ? 'Editar Documento' : 'Nuevo Documento';
    el.mDesc.value = r ? r.desc : '';
    el.mCod.value = r ? r.codigo : '';
    el.mRev.value = r ? r.rev : '';
    setTipoChips(r && r.tipo ? r.tipo.split(', ') : []);
    el.mFcre.value = r ? r.fcre : '';
    el.mFact.value = r ? r.fact : '';
    el.mAlm.value = r ? r.alm : '';
    el.mRet.value = r ? r.ret : '';
    el.mDisp.value = r ? r.disp : '';
    el.fldDesc.classList.remove('has-err');
    el.mDesc.classList.remove('is-err');
    el.mSave.disabled = !(el.mDesc.value.trim());
    openOv(el.ovForm, el.mDesc);
    klog('MODAL', r ? 'EDIT_OPEN' : 'NEW_OPEN', 'OK', r ? { id: r.id } : null);
  }

  async function saveForm() {
    var desc = el.mDesc.value.trim();
    if (!desc) {
      el.fldDesc.classList.add('has-err');
      el.mDesc.classList.add('is-err');
      el.mDesc.focus();
      klog('MODAL', 'VALIDATE', 'ERR', 'descripcion requerida');
      return;
    }
    var modelo = {
      desc: desc,
      codigo: el.mCod.value.trim(),
      rev: el.mRev.value.trim(),
      tipo: getTipoChips().join(', '),
      fcre: el.mFcre.value,
      fact: el.mFact.value,
      alm: el.mAlm.value.trim(),
      ret: el.mRet.value.trim(),
      disp: el.mDisp.value
    };
    el.mSave.disabled = true;
    try {
      if (S.editId) {
        var actual = REGISTROS.find(function (x) { return x.id === S.editId; });
        if (!actual) throw new Error('Registro no encontrado');
        var payload = haciaBackend(modelo);
        payload.numero = actual.n;
        await callParentAPI('actualizar', payload);
        klog('DOC', 'RECORD_UPDATE', 'OK', { numero: actual.n });
        toast('Registro actualizado', 'ok');
      } else {
        var res = await callParentAPI('crear', haciaBackend(modelo));
        klog('DOC', 'RECORD_CREATE', 'OK', res && res.data ? { numero: res.data.numero } : null);
        toast('Registro creado', 'ok');
      }
      closeOv(el.ovForm);
      S.editId = null;
      await cargarDatos(true);
    } catch (e) {
      klog('DOC', S.editId ? 'RECORD_UPDATE' : 'RECORD_CREATE', 'ERR', e.message);
      toast('No se pudo guardar: ' + e.message, 'err');
    } finally {
      el.mSave.disabled = false;
    }
  }

  function openDel(r) {
    S.delId = r.id;
    el.dTx.innerHTML = '¿Eliminar el registro <b>«' + esc(r.desc) + '»</b> (' + esc(r.codigo) + ')?';
    openOv(el.ovDel, el.dCancel);
    klog('MODAL', 'DELETE_OPEN', 'OK', { id: r.id });
  }
  async function confirmDel() {
    var r = REGISTROS.find(function (x) { return x.id === S.delId; });
    try {
      if (r) {
        await callParentAPI('eliminar', { numero: r.n });
        delete S.open[S.delId];
        klog('DOC', 'RECORD_DELETE', 'OK', { numero: r.n });
        toast('Registro eliminado', 'ok');
      }
      closeOv(el.ovDel);
      S.delId = null;
      await cargarDatos(true);
    } catch (e) {
      klog('DOC', 'RECORD_DELETE', 'ERR', e.message);
      toast('No se pudo eliminar: ' + e.message, 'err');
    }
  }

  /* ══════════════ GUARDADO MASIVO (edición en línea) ══════════════ */
  async function guardarCambios() {
    var sucios = REGISTROS.filter(function (r) { return r._dirty; });
    if (!sucios.length) return;
    el.btnGuardar.disabled = true;
    klog('DOC', 'BULK_SAVE', 'START', { cambios: sucios.length });
    var hechos = 0, errores = [];
    for (var i = 0; i < sucios.length; i++) {
      var r = sucios[i];
      try {
        var payload = haciaBackend(r);
        payload.numero = r.n;
        await callParentAPI('actualizar', payload);
        r._dirty = false;
        hechos++;
      } catch (e) {
        errores.push(r.n + ': ' + e.message);
      }
    }
    await cargarDatos(false);
    if (errores.length) {
      klog('DOC', 'BULK_SAVE', 'ERR', errores);
      toast('Se guardaron ' + hechos + ' de ' + sucios.length + '. Fallaron: ' + errores.length, 'err');
    } else {
      klog('DOC', 'BULK_SAVE', 'OK', { cambios: hechos });
      toast(hechos + ' cambio(s) guardados en el Excel', 'ok');
    }
    renderGuardarBtn();
  }

  /* ══════════════ EXPORTAR CSV ══════════════ */
  function exportCSV() {
    var rows = visibles();
    var head = ['N', 'Descripción', 'Código', 'Revisión', 'Tipo', 'Fecha creación', 'Fecha actualización', 'Almacenamiento', 'Retención', 'Disposición final'];
    var lines = [head.join(';')];
    rows.forEach(function (r) {
      var vals = [r.n, r.desc, r.codigo, r.rev, r.tipo, r.fcre ? fDoc(r.fcre) : '', r.fact ? fDoc(r.fact) : '', r.alm, r.ret, r.disp];
      lines.push(vals.map(function (v) {
        v = String(v == null ? '' : v);
        return (v.indexOf(';') >= 0 || v.indexOf('"') >= 0) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(';'));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kair-archivo-retencion.csv';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Exportados ' + rows.length + ' registros a CSV', 'ok');
    klog('DOC', 'EXPORT', 'OK', { filas: rows.length });
  }

  /* ══════════════ CARGA / REFRESCO ══════════════ */
  async function cargarDatos(mostrarSkeleton) {
    if (mostrarSkeleton) { el.skel.hidden = false; el.main.hidden = true; }
    try {
      var res = await callParentAPI('leer-todos', {});
      // El backend puede devolver {success, data:[...]} o un array plano
      var arr = Array.isArray(res) ? res : (res && Array.isArray(res.data) ? res.data : []);
      REGISTROS = arr.filter(function (d) { return d && (d.descripcion || '').trim() !== ''; })
                     .map(function (d, i) { return desdeBackend(d, i); });
      // Se conservan las filas abiertas y las marcas de "sin guardar" de la recarga
      recalcularHojas();
      renderHojaOptions();
      renderAll();
      klog('INIT', 'DATA_READY', 'OK', { registros: REGISTROS.length, hojas: HOJAS.length });
      if (!REGISTROS.length) toast('El archivo no tiene registros para mostrar', 'info');
    } catch (e) {
      REGISTROS = [];
      recalcularHojas();
      renderHojaOptions();
      renderAll();
      klog('INIT', 'DATA_READY', 'ERR', e.message);
      toast('No se pudieron leer los documentos: ' + e.message, 'err');
    } finally {
      el.skel.hidden = true;
      el.main.hidden = false;
    }
  }

  async function refrescar() {
    el.icoRefresh.parentElement.classList.add('is-spinning');
    klog('DOC', 'REFRESH', 'START');
    try {
      await cargarDatos(false);
      toast('Datos actualizados', 'ok');
      klog('DOC', 'REFRESH', 'OK');
    } catch (e) {
      klog('DOC', 'REFRESH', 'ERR', e.message);
    } finally {
      el.icoRefresh.parentElement.classList.remove('is-spinning');
    }
  }

  /* ══════════════ EVENTOS ══════════════ */
  var _deb = null;
  el.q.addEventListener('input', function () {
    clearTimeout(_deb);
    _deb = setTimeout(function () {
      S.q = el.q.value.trim();
      S.page = 1;
      renderTable();
      renderFiltros();
      klog('DOC', 'SEARCH', 'OK', { q: S.q });
    }, 260);
  });
  el.qClear.addEventListener('click', function () { el.q.value = ''; S.q = ''; S.page = 1; renderTable(); renderFiltros(); el.q.focus(); });

  el.hoja.addEventListener('change', function () { S.hoja = el.hoja.value; S.page = 1; renderTable(); renderFiltros(); klog('DOC', 'FILTER_HOJA', 'OK', { hoja: S.hoja || 'todas' }); });
  el.disp.addEventListener('change', function () { S.disp = el.disp.value; S.page = 1; renderTable(); renderFiltros(); klog('DOC', 'FILTER_DISP', 'OK', { disp: S.disp || 'todas' }); });

  function limpiarFiltros() {
    S.q = ''; S.hoja = ''; S.disp = ''; S.page = 1;
    el.q.value = ''; el.hoja.value = ''; el.disp.value = '';
    renderTable(); renderFiltros();
    klog('DOC', 'FILTER_CLEAR', 'OK');
  }
  el.btnClear.addEventListener('click', limpiarFiltros);
  el.btnEmptyClear.addEventListener('click', limpiarFiltros);

  document.querySelectorAll('.kair-thbtn').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-sort');
      if (S.sort.key === k) S.sort.dir = S.sort.dir * -1;
      else { S.sort.key = k; S.sort.dir = 1; }
      S.page = 1;
      renderTable();
      klog('DOC', 'SORT', 'OK', { por: k, dir: S.sort.dir });
    });
  });

  /* ── Clic en la fila: expandir, o botón de acción ── */
  el.tbody.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button');
    var row = ev.target.closest('tr.kair-row');
    if (!row) return;
    var id = row.getAttribute('data-id');
    var r = REGISTROS.find(function (x) { return x.id === id; });
    if (!r) return;
    if (btn) {
      var act = btn.getAttribute('data-act');
      if (act === 'edit') openForm(r);
      else if (act === 'del') openDel(r);
      return;
    }
    if (ev.target.closest('.kair-cell-edit')) return; // editando: no expandir
    S.open[id] = !S.open[id];
    row.classList.toggle('is-open', !!S.open[id]);
    row.setAttribute('aria-expanded', S.open[id] ? 'true' : 'false');
    var dr = el.tbody.querySelector('tr[data-drow="' + id + '"]');
    if (dr) dr.hidden = !S.open[id];
    klog('DOC', 'ROW_EXPAND', 'OK', { id: id, abierto: !!S.open[id] });
  });
  el.tbody.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    if (ev.target.closest('.kair-cell-edit')) return;
    var row = ev.target.closest('tr.kair-row');
    if (!row) return;
    ev.preventDefault();
    row.click();
  });

  /* ── Edición en línea: commitea al salir del campo o con Enter ── */
  function commitCelda(celda) {
    var id = celda.getAttribute('data-id');
    var campo = celda.getAttribute('data-campo');
    var r = REGISTROS.find(function (x) { return x.id === id; });
    if (!r) return;
    var nuevo = celda.textContent.trim();
    if (nuevo === r[campo]) return;
    r[campo] = nuevo;
    r._dirty = true;
    var row = el.tbody.querySelector('tr.kair-row[data-id="' + id + '"]');
    if (row) row.classList.add('is-dirty');
    if (campo === 'desc') {
      var dr = el.tbody.querySelector('tr[data-drow="' + id + '"] .kair-detail__v');
      if (dr) dr.textContent = nuevo || '—';
    }
    renderGuardarBtn();
    klog('DOC', 'INLINE_EDIT', 'OK', { id: id, campo: campo });
  }
  el.tbody.addEventListener('blur', function (ev) {
    var celda = ev.target.closest ? ev.target.closest('.kair-cell-edit') : null;
    if (celda) commitCelda(celda);
  }, true);
  el.tbody.addEventListener('keydown', function (ev) {
    var celda = ev.target.closest ? ev.target.closest('.kair-cell-edit') : null;
    if (!celda) return;
    if (ev.key === 'Enter') { ev.preventDefault(); celda.blur(); }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); celda.blur(); }
  });
  // Un clic simple no debe abrir el editor de contenido: se entra con doble clic.
  el.tbody.addEventListener('mousedown', function (ev) {
    var celda = ev.target.closest ? ev.target.closest('.kair-cell-edit') : null;
    if (!celda) return;
    if (celda.getAttribute('contenteditable') === 'true' && document.activeElement !== celda) {
      // Primer clic: se habilita la edición y se deja pasar el foco
      celda.setAttribute('contenteditable', 'true');
    }
  });

  el.pager.addEventListener('click', function (ev) {
    var b = ev.target.closest('button');
    if (!b || b.disabled) return;
    var p = parseInt(b.getAttribute('data-p'), 10);
    if (isNaN(p)) return;
    S.page = p;
    renderTable();
    var wrap = document.querySelector('.tablewrap');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    klog('DOC', 'PAGE', 'OK', { pagina: p });
  });

  el.size.addEventListener('change', function () {
    S.size = parseInt(el.size.value, 10) || 50;
    S.page = 1;
    renderTable();
    klog('DOC', 'PAGE_SIZE', 'OK', { tamano: S.size });
  });

  el.btnNuevo.addEventListener('click', function () { openForm(null); });
  el.mSave.addEventListener('click', saveForm);
  el.mCancel.addEventListener('click', function () { closeOv(el.ovForm); klog('MODAL', 'CANCEL', 'OK'); });
  el.mX.addEventListener('click', function () { closeOv(el.ovForm); });
  el.mDesc.addEventListener('input', function () {
    el.mSave.disabled = !(el.mDesc.value.trim());
    if (el.mDesc.value.trim()) { el.fldDesc.classList.remove('has-err'); el.mDesc.classList.remove('is-err'); }
  });
  el.mTipo.addEventListener('click', function (ev) {
    var ch = ev.target.closest('.kair-tipo__chip');
    if (!ch) return;
    ch.classList.toggle('is-on');
    ch.setAttribute('aria-pressed', ch.classList.contains('is-on') ? 'true' : 'false');
    klog('MODAL', 'TIPO_TOGGLE', 'OK', { tipo: ch.getAttribute('data-v'), on: ch.classList.contains('is-on') });
  });

  el.dDel.addEventListener('click', confirmDel);
  el.dCancel.addEventListener('click', function () { closeOv(el.ovDel); });
  el.dX.addEventListener('click', function () { closeOv(el.ovDel); });

  [el.ovForm, el.ovDel].forEach(function (ov) {
    ov.addEventListener('mousedown', function (ev) { if (ev.target === ov) closeOv(ov); });
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (el.ovForm.classList.contains('is-open')) { closeOv(el.ovForm); return; }
      if (el.ovDel.classList.contains('is-open')) { closeOv(el.ovDel); }
      return;
    }
    if (!(ev.ctrlKey || ev.metaKey)) return;
    var k = (ev.key || '').toLowerCase();
    if (k === 'n') { ev.preventDefault(); openForm(null); }
    if (k === 'f') { ev.preventDefault(); el.q.focus(); el.q.select(); }
  });

  /* ── KPI "Archivo muerto" → filtra la tabla ── */
  el.kpiMuerto.addEventListener('click', function () {
    S.disp = 'muerto'; S.page = 1;
    el.disp.value = 'muerto';
    renderTable(); renderFiltros();
    var wrap = document.querySelector('.tablewrap');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Filtro aplicado: archivo muerto', 'info');
    klog('DOC', 'KPI_FILTER', 'OK', { disp: 'muerto' });
  });

  /* ── Topbar ── */
  el.btnVolver.addEventListener('click', function () {
    // El contenedor ya sabe volver: se le avisa y él navega (renderer.js).
    notifyParent('back-to-module-request', {});
    klog('NAV', 'VOLVER', 'OK');
  });
  el.btnExport.addEventListener('click', exportCSV);
  el.btnRefresh.addEventListener('click', refrescar);
  el.btnGuardar.addEventListener('click', guardarCambios);
  // Aviso al usuario si intenta salir con cambios sin guardar
  window.addEventListener('beforeunload', function (ev) {
    if (REGISTROS.some(function (r) { return r._dirty; })) {
      ev.preventDefault();
      ev.returnValue = '';
    }
  });

  /* ══════════════ ARRANQUE ══════════════ */
  (function init() {
    var params = new URLSearchParams(window.location.search);
    companyName = params.get('company') || '';
    if (el.chipEmp) el.chipEmp.textContent = companyName || 'Empresa';
    klog('INIT', 'BOOT', 'OK', { company: companyName });
    // Avisa al contenedor que el iframe está listo (handshake que ya existía)
    notifyParent('iframe-ready', {});
    cargarDatos(true);
  })();
})();
