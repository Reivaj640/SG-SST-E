/* ============================================================
   K+AIR · Evaluaciones Médicas Ocupacionales (submódulo 3.1.4) — lógica
   ============================================================
   Rediseño premium v2 (📦762) sobre el prototipo `kair-evaluaciones-medicas.html`.

   DE DÓNDE SALE LA PANTALLA
   El prototipo llegó como documento HTML completo. Este componente NO se monta por
   iframe desde `renderer.js` (a diferencia de Archivo y Retención): recibe un
   contenedor del documento principal y **inyecta su propio marcado**
   (`marcadoVista()`), que viene embebido y lo genera `main/_armar-emo.js` a partir
   del prototipo. Los `id` de los nodos son los del prototipo: NO renombrar ninguno,
   la lógica los busca por id. Las CLASES sí cambiaron: todas llevan el prefijo
   privado `emo-`.

   POR QUÉ TODAS LAS CLASES LLEVAN PREFIJO `emo-`
   El prototipo reutilizaba nombres que ya existen en la app (`kair-card`,
   `kair-header`, `kair-modal`, `kair-table`) y otros que existen en Bootstrap
   (`modal`, `card`, `btn`, `overlay`). Inyectado en el documento principal eso choca
   en LAS DOS DIRECCIONES: la app descoloca el módulo y el módulo descoloca a la app.
   Por eso la hoja lleva TODOS los selectores bajo `.emo-scope` (incluidos los de
   etiqueta: sin eso le cambiaría el `body` a toda la aplicación) y las reglas de
   defensa contra Bootstrap están marcadas en `evaluaciones-medicas-v2.css`.

   DATOS — TODO CONTRA EL BACKEND REAL
   El prototipo traía un dataset de ejemplo y llamaba a
   `electronAPI.getEvaluacionesMedicas(empresa_id)` / `guardarCertificado(...)`, que
   NO EXISTEN. Acá se usa el puente real (`main/evaluaciones-medicas-bridge.js`):
     · evaluacionesMedicas.listar({ empresaId })
     · evaluacionesMedicas.guardar({ empresaId, certificado })
     · evaluacionesMedicas.eliminar({ empresaId, id })
     · getDocumentFolders / openPath → documentos de referencia (lo que ya existía)

   REGLA LEGAL QUE GOBIERNA EL DISEÑO (Res. 2346 de 2007, art. 12)
   Cada evaluación es un evento sanitario independiente: la renovación NO modifica ni
   borra el certificado anterior, agrega uno nuevo enlazado con `certificadoOrigen`.
   Por eso "Renovar" abre el formulario precargado y guarda un registro NUEVO, y el
   detalle muestra el historial del trabajador por cédula. El diagnóstico clínico no
   se archiva: solo el concepto de aptitud y las recomendaciones laborales.
   ============================================================ */
(function () {
  'use strict';

  var TAG = 'K+AIRMED';
  function klog(modulo, accion, status, extra) {
    var linea = '[' + TAG + '][' + modulo + '][' + accion + '][' + status + ']' + (extra ? ' ' + extra : '');
    if (status === 'ERR') console.warn(linea); else console.log(linea);
  }

  /* ══════════════ CATÁLOGOS (los del prototipo) ══════════════ */
  var TIPOS = [
    { nombre: 'Preingreso', hint: 'Antes de la vinculación', vence: false },
    { nombre: 'Periódico', hint: 'Control de vigencia anual', vence: true },
    { nombre: 'Cambio de Ocupación', hint: 'Al cambiar de cargo o tareas', vence: false },
    { nombre: 'Post-Incapacidad', hint: 'Al regresar tras incapacidad', vence: false },
    { nombre: 'Retorno al Trabajo', hint: 'Tras ausencia prolongada', vence: false },
    { nombre: 'Retiro', hint: 'Al terminar la vinculación', vence: false },
    { nombre: 'Seguimiento', hint: 'Control de recomendaciones', vence: false }
  ];
  /* `clave` es lo que se usa en la vista; `db` es el valor EXACTO que guarda la base.
     El puente valida contra esa lista, así que los dos tienen que coincidir. */
  var CONCEPTOS = [
    { clave: 'apto', db: 'APTO', etiqueta: 'Apto', chip: 'green', desc: 'Sin restricciones para el cargo', nivel: 'green' },
    { clave: 'recomendaciones', db: 'APTO CON RECOMENDACIONES', etiqueta: 'Apto con Recomendaciones', chip: 'amber', desc: 'Apto con medidas preventivas', nivel: 'amber' },
    { clave: 'aplazado', db: 'APLAZADO', etiqueta: 'Aplazado', chip: 'blue', desc: 'Requiere exámenes complementarios', nivel: 'blue' },
    { clave: 'noapto', db: 'NO APTO', etiqueta: 'No Apto', chip: 'red', desc: 'No autorizado para el cargo', nivel: 'red' }
  ];
  var DIAS_POR_VENCER = 30;

  /* ══════════════ ESTADO ══════════════ */
  var S = {
    busqueda: '', tipo: 'todos', estado: 'todos',
    orden: { clave: 'fechaExamen', dir: 'desc' },
    pagina: 1, porPagina: 8,
    modo: 'nueva', editandoId: null, cedulaDetalle: null,
    certificados: [], documentos: [],
    archivoFormulario: ''
  };

  var containerRef = null;   // contenedor que pasa renderer.js
  var marcadoRaiz = null;    // el div que inyectamos (los flotantes se mudan al body)
  var empresaId = 'default_company';
  var backCallback = null;

  /* ══════════════ BÚSQUEDA DENTRO DEL COMPONENTE ══════════════
     Las dos se reasignan en render() para buscar dentro del marcado inyectado y no en
     todo el documento. Respaldo por id para los nodos que se mudan al <body>. */
  var $ = function (sel) { return document.querySelector(sel); };
  var $all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function api() { return (typeof window !== 'undefined' && window.electronAPI) || null; }

  function getEmpresaId() {
    var c = (typeof window !== 'undefined' &&
      (window.currentCompany || (window.rendererState && window.rendererState.selectedCompany))) || '';
    return c || 'default_company';
  }

  /* ══════════════ HELPERS ══════════════ */
  function hoyISO() {
    var d = new Date();
    var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
    var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
    return d.getFullYear() + '-' + mm + '-' + dd;
  }
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fechaLarga(iso) {
    if (!iso) return '—';
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    return parseInt(p[2], 10) + ' de ' + (MESES[parseInt(p[1], 10) - 1] || '') + ' de ' + p[0];
  }
  function diasPara(iso) {
    if (!iso) return null;
    var f = new Date(iso + 'T00:00:00');
    if (isNaN(f.getTime())) return null;
    var h = new Date(hoyISO() + 'T00:00:00');
    return Math.round((f - h) / 86400000);
  }
  function textoDias(d) {
    if (d === null) return '';
    if (d === 0) return 'hoy';
    if (d > 0) return 'en ' + d + ' día' + (d === 1 ? '' : 's');
    return 'hace ' + Math.abs(d) + ' día' + (Math.abs(d) === 1 ? '' : 's');
  }
  function sumaAnio(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return '';
    return (parseInt(p[0], 10) + 1) + '-' + p[1] + '-' + p[2];
  }
  function escapeHtml(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function iniciales(nombre) {
    var p = String(nombre || '').trim().split(/\s+/);
    if (!p.length || !p[0]) return '?';
    return ((p[0][0] || '') + (p.length > 1 ? (p[p.length - 1][0] || '') : '')).toUpperCase();
  }
  function normalizarCedula(v) { return String(v == null ? '' : v).replace(/[.\s-]/g, ''); }
  function puntosCedula(v) {
    var n = normalizarCedula(v);
    if (!/^\d+$/.test(n)) return String(v || '');
    return n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function conceptoPorClave(clave) {
    for (var i = 0; i < CONCEPTOS.length; i++) if (CONCEPTOS[i].clave === clave) return CONCEPTOS[i];
    return null;
  }
  function conceptoPorDb(db) {
    var v = String(db || '').toUpperCase();
    for (var i = 0; i < CONCEPTOS.length; i++) if (CONCEPTOS[i].db === v) return CONCEPTOS[i];
    return null;
  }
  function tipoInfo(nombre) {
    for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i].nombre === nombre) return TIPOS[i];
    return { nombre: nombre || '', hint: '', vence: false };
  }
  function tipoVence(nombre) { return !!tipoInfo(nombre).vence; }

  /* ══════════════ ADAPTADOR: BACKEND ↔ VISTA ══════════════
     El puente devuelve columnas de la base (`fechaExamen`, `vencimiento`, `concepto`
     en mayúsculas, `certificadoOrigen`). La vista trabaja con la clave del concepto y
     con el estado de vigencia calculado. Toda lectura y escritura pasa por acá: si
     cambia el modelo, se cambia en UN solo lugar. */
  function estadoVigencia(cert) {
    if (cert.concepto === 'noapto') return 'no-apto';
    if (cert.concepto === 'aplazado') return 'aplazado';
    if (!cert.vencimiento) return 'sin-vencimiento';
    var d = diasPara(cert.vencimiento);
    if (d === null) return 'sin-vencimiento';
    if (d < 0) return 'vencido';
    if (d <= DIAS_POR_VENCER) return 'por-vencer';
    return 'vigente';
  }
  function desdeBackend(row) {
    var c = conceptoPorDb(row.concepto);
    return {
      id: row.id,
      trabajador: row.trabajador || '',
      cedula: row.cedula || '',
      cargo: row.cargo || '',
      area: row.area || '',
      tipo: row.tipo || '',
      ips: row.ips || '',
      fechaExamen: row.fechaExamen || '',
      vencimiento: row.vencimiento || '',
      concepto: c ? c.clave : 'apto',
      conceptoDb: row.concepto || 'APTO',
      recomendaciones: row.recomendaciones || '',
      archivo: row.archivo || '',
      certificadoOrigen: row.certificadoOrigen || '',
      creadoEn: row.creadoEn || '',
      actualizadoEn: row.actualizadoEn || ''
    };
  }
  function haciaBackend(cert) {
    var c = conceptoPorClave(cert.concepto);
    return {
      id: cert.id || undefined,
      trabajador: cert.trabajador,
      cedula: normalizarCedula(cert.cedula),
      cargo: cert.cargo || '',
      area: cert.area || '',
      tipo: cert.tipo,
      ips: cert.ips || '',
      fechaExamen: cert.fechaExamen,
      vencimiento: cert.vencimiento || '',
      concepto: c ? c.db : String(cert.conceptoDb || 'APTO'),
      recomendaciones: cert.recomendaciones || '',
      archivo: cert.archivo || '',
      certificadoOrigen: cert.certificadoOrigen || ''
    };
  }

  /* ══════════════ DATOS ══════════════ */
  async function cargarCertificados() {
    var a = api();
    if (!a || !a.evaluacionesMedicas) {
      klog('DATOS', 'LISTAR', 'ERR', 'electronAPI.evaluacionesMedicas no disponible');
      toast('No se pudo abrir la base de certificados.', 'err');
      return;
    }
    try {
      var res = await a.evaluacionesMedicas.listar({ empresaId: empresaId });
      if (res && res.success === false) throw new Error((res.error && res.error.message) || 'No se pudo leer la base');
      var filas = (res && Array.isArray(res.data)) ? res.data : [];
      S.certificados = filas.map(desdeBackend);
      klog('DATOS', 'LISTAR', 'OK', S.certificados.length + ' certificados');
    } catch (e) {
      klog('DATOS', 'LISTAR', 'ERR', e.message);
      toast('No se pudieron cargar los certificados: ' + e.message, 'err');
    }
  }

  async function guardarCertificado(cert) {
    var a = api();
    if (!a || !a.evaluacionesMedicas) throw new Error('La base de certificados no está disponible');
    var res = await a.evaluacionesMedicas.guardar({ empresaId: empresaId, certificado: haciaBackend(cert) });
    if (res && res.success === false) throw new Error((res.error && res.error.message) || 'No se pudo guardar');
    return res && res.data ? desdeBackend(res.data) : null;
  }

  /* ══════════════ TOASTS ══════════════ */
  function toast(msg, kind) {
    var box = $('#toasts');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'emo-toast emo-toast--' + (kind || 'info');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('emo-out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, 3600);
  }

  /* ══════════════ RESUMEN / KPIs ══════════════ */
  function resumen() {
    var r = { total: S.certificados.length, vigentes: 0, atencion: 0, criticos: 0, vencidos: 0, porVencer: 0 };
    S.certificados.forEach(function (c) {
      var e = estadoVigencia(c);
      if (e === 'vigente') r.vigentes++;
      else if (e === 'por-vencer') { r.vigentes++; r.atencion++; r.porVencer++; }
      else if (e === 'aplazado') r.atencion++;
      else if (e === 'vencido') { r.criticos++; r.vencidos++; }
      else if (e === 'no-apto') r.criticos++;
      else if (e === 'sin-vencimiento') r.vigentes++;
    });
    return r;
  }
  function chipConcepto(c) {
    var k = conceptoPorClave(c.concepto) || CONCEPTOS[0];
    return '<span class="emo-chip emo-chip--' + k.chip + '">' + escapeHtml(k.etiqueta) + '</span>';
  }
  function chipEstado(c) {
    var map = {
      'vigente': ['green', 'Vigente'], 'por-vencer': ['amber', 'Por vencer'],
      'vencido': ['red', 'Vencido'], 'aplazado': ['blue', 'Aplazado'],
      'no-apto': ['red', 'No apto'], 'sin-vencimiento': ['slate', 'Sin vencimiento']
    };
    var m = map[estadoVigencia(c)] || ['slate', '—'];
    return '<span class="emo-chip emo-chip--' + m[0] + '">' + m[1] + '</span>';
  }

  /* ══════════════ FILTROS / ORDEN ══════════════ */
  function filtrados() {
    var q = S.busqueda.trim().toLowerCase();
    var lista = S.certificados.filter(function (c) {
      if (S.tipo !== 'todos' && c.tipo !== S.tipo) return false;
      if (S.estado !== 'todos') {
        var e = estadoVigencia(c);
        if (S.estado === 'vigente' && !(e === 'vigente' || e === 'sin-vencimiento')) return false;
        if (S.estado === 'por-vencer' && e !== 'por-vencer') return false;
        if (S.estado === 'vencido' && e !== 'vencido') return false;
        if (S.estado === 'recomendaciones' && c.concepto !== 'recomendaciones') return false;
        if (S.estado === 'aplazado' && e !== 'aplazado') return false;
        if (S.estado === 'no-apto' && e !== 'no-apto') return false;
      }
      if (!q) return true;
      return (c.trabajador || '').toLowerCase().indexOf(q) >= 0 ||
        (c.cedula || '').indexOf(normalizarCedula(q)) >= 0 ||
        (c.cargo || '').toLowerCase().indexOf(q) >= 0 ||
        (c.area || '').toLowerCase().indexOf(q) >= 0 ||
        (c.ips || '').toLowerCase().indexOf(q) >= 0;
    });
    var clave = S.orden.clave, dir = S.orden.dir === 'asc' ? 1 : -1;
    lista.sort(function (a, b) {
      var va = a[clave] || '', vb = b[clave] || '';
      if (clave === 'concepto') {
        va = (conceptoPorClave(a.concepto) || {}).etiqueta || '';
        vb = (conceptoPorClave(b.concepto) || {}).etiqueta || '';
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return lista;
  }

  /* ══════════════ RENDER ══════════════ */
  function renderKPIs() {
    var r = resumen();
    var set = function (id, v) { var n = $('#' + id); if (n) n.textContent = v; };
    set('kpi-total', r.total);
    set('kpi-vigentes', r.vigentes);
    set('kpi-atencion', r.atencion);
    set('kpi-criticos', r.criticos);
    var v = $('#btn-ver-vencidos'); if (v) v.textContent = 'Ver vencidos (' + r.vencidos + ')';
    var p = $('#btn-ver-porvencer'); if (p) p.textContent = 'Ver por vencer (' + r.porVencer + ')';
  }

  function barras(sel, mapa) {
    var cont = $(sel);
    if (!cont) return;
    var claves = Object.keys(mapa);
    if (!claves.length) { cont.innerHTML = '<div class="emo-kair-inlineempty">Sin datos todavía</div>'; return; }
    var max = 1;
    claves.forEach(function (k) { if (mapa[k] > max) max = mapa[k]; });
    cont.innerHTML = claves.map(function (k) {
      return '<div class="emo-kair-chartrow"><span class="emo-kair-chartrow__label">' + escapeHtml(k) + '</span>' +
        '<span class="emo-kair-chartrow__track"><i style="width:' + Math.round(mapa[k] / max * 100) + '%"></i></span>' +
        '<span class="emo-kair-chartrow__val">' + mapa[k] + '</span></div>';
    }).join('');
  }

  function renderResumen() {
    var anios = {};
    S.certificados.forEach(function (c) {
      var y = (c.fechaExamen || '').slice(0, 4);
      if (y) anios[y] = (anios[y] || 0) + 1;
    });
    var porAnio = {};
    Object.keys(anios).sort().forEach(function (k) { porAnio[k] = anios[k]; });
    barras('#chart-anos', porAnio);

    var porConcepto = {}, porTipo = {};
    S.certificados.forEach(function (c) {
      var k = (conceptoPorClave(c.concepto) || {}).etiqueta || '—';
      porConcepto[k] = (porConcepto[k] || 0) + 1;
      if (c.tipo) porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1;
    });
    barras('#chart-concepto', porConcepto);
    barras('#chart-tipo', porTipo);

    var ult = S.certificados.slice().sort(function (a, b) {
      return (b.fechaExamen || '').localeCompare(a.fechaExamen || '');
    }).slice(0, 6);
    var box = $('#res-ultimos');
    if (box) {
      box.innerHTML = ult.length ? ult.map(function (c) {
        return '<button type="button" class="emo-kair-lastrow" data-ver="' + escapeHtml(c.id) + '">' +
          '<span class="emo-kair-avatar">' + escapeHtml(iniciales(c.trabajador)) + '</span>' +
          '<span class="emo-kair-lastrow__txt">' +
          '<span class="emo-kair-lastrow__name">' + escapeHtml(c.trabajador) + '</span>' +
          '<span class="emo-kair-lastrow__sub">' + escapeHtml(c.tipo) + ' · ' + escapeHtml(fechaLarga(c.fechaExamen)) + '</span></span>' +
          chipConcepto(c) + '</button>';
      }).join('') : '<div class="emo-kair-inlineempty">Todavía no hay certificados registrados</div>';
    }

    var alertas = S.certificados.filter(function (c) {
      var e = estadoVigencia(c);
      return e === 'vencido' || e === 'por-vencer';
    }).sort(function (a, b) { return (a.vencimiento || '').localeCompare(b.vencimiento || ''); });
    var al = $('#res-alertas');
    if (al) {
      al.innerHTML = alertas.length ? alertas.map(function (c) {
        var d = diasPara(c.vencimiento);
        return '<button type="button" class="emo-kair-alertrow ' + (d < 0 ? 'emo-kair-alertrow--red' : 'emo-kair-alertrow--amber') +
          '" data-ver="' + escapeHtml(c.id) + '">' +
          '<span class="emo-kair-alertrow__txt">' +
          '<span class="emo-kair-alertrow__name">' + escapeHtml(c.trabajador) + '</span>' +
          '<span class="emo-kair-alertrow__sub">' + escapeHtml(c.tipo) + ' · vence ' + escapeHtml(fechaLarga(c.vencimiento)) + '</span></span>' +
          '<span class="emo-kair-alertrow__dias">' + escapeHtml(textoDias(d)) + '</span></button>';
      }).join('') : '<div class="emo-kair-inlineempty">Sin certificados vencidos ni por vencer</div>';
    }
    var ok = $('#res-okbox');
    if (ok) ok.style.display = alertas.length ? 'none' : '';

    var c1 = $('#cnt-carpeta');
    if (c1) c1.textContent = S.documentos.length
      ? S.documentos.length + ' archivo' + (S.documentos.length === 1 ? '' : 's')
      : 'sin archivos';
    var c2 = $('#cnt-vencidos'); if (c2) c2.textContent = resumen().vencidos + ' vencidos';
    var c3 = $('#cnt-porvencer'); if (c3) c3.textContent = resumen().porVencer + ' por vencer';
  }

  function renderTabla() {
    var lista = filtrados();
    var total = lista.length;
    var paginas = Math.max(1, Math.ceil(total / S.porPagina));
    if (S.pagina > paginas) S.pagina = paginas;
    if (S.pagina < 1) S.pagina = 1;
    var ini = (S.pagina - 1) * S.porPagina;
    var filas = lista.slice(ini, ini + S.porPagina);

    var tb = $('#tbody-certificados');
    if (tb) {
      tb.innerHTML = filas.map(function (c) {
        return '<tr>' +
          '<td><div class="emo-workercell"><span class="emo-kair-avatar">' + escapeHtml(iniciales(c.trabajador)) + '</span>' +
          '<span><b>' + escapeHtml(c.trabajador) + '</b><small>CC ' + escapeHtml(puntosCedula(c.cedula)) + '</small></span></div></td>' +
          '<td><b>' + escapeHtml(c.cargo || '—') + '</b><small class="emo-kair-mut">' + escapeHtml(c.area || '—') + '</small></td>' +
          '<td>' + escapeHtml(c.tipo) + '</td>' +
          '<td>' + escapeHtml(c.ips || '—') + '</td>' +
          '<td><b>' + escapeHtml(fechaLarga(c.fechaExamen)) + '</b><small class="emo-kair-mut">' +
          (c.vencimiento ? 'vence ' + escapeHtml(fechaLarga(c.vencimiento)) : 'sin vencimiento') + '</small></td>' +
          '<td>' + chipConcepto(c) + ' ' + chipEstado(c) + '</td>' +
          '<td><div class="emo-row-actions">' +
          '<button type="button" class="emo-icon-btn" data-ver="' + escapeHtml(c.id) + '" title="Ver detalle">Ver</button>' +
          '<button type="button" class="emo-icon-btn" data-editar="' + escapeHtml(c.id) + '" title="Editar">Editar</button>' +
          '<button type="button" class="emo-icon-btn" data-renovar="' + escapeHtml(c.id) + '" title="Renovar">Renovar</button>' +
          '</div></td></tr>';
      }).join('');
    }
    var vacio = $('#empty-state');
    if (vacio) vacio.style.display = filas.length ? 'none' : '';
    var mobile = $('#mobilelist');
    if (mobile) {
      mobile.innerHTML = filas.map(function (c) {
        return '<button type="button" class="emo-kair-mcell" data-ver="' + escapeHtml(c.id) + '">' +
          '<span class="emo-kair-avatar">' + escapeHtml(iniciales(c.trabajador)) + '</span>' +
          '<span class="emo-kair-mcell__txt">' +
          '<b>' + escapeHtml(c.trabajador) + '</b>' +
          '<small>' + escapeHtml(c.tipo) + ' · ' + escapeHtml(fechaLarga(c.fechaExamen)) + '</small></span>' +
          chipEstado(c) + '</button>';
      }).join('');
    }

    var cont = $('#f-contador');
    if (cont) cont.textContent = total + ' certificado' + (total === 1 ? '' : 's');
    var info = $('#pagin-info');
    if (info) {
      info.textContent = total
        ? 'Mostrando ' + (ini + 1) + '–' + (ini + filas.length) + ' de ' + total
        : 'Sin resultados';
    }
    /* Paginación: el marcado del prototipo ya trae los botones anterior/siguiente, así
       que se usan esos y se deshabilitan en los extremos. */
    var pagin = $('#pagin');
    var prev = $('#pagin-prev'), next = $('#pagin-next');
    /* El marcado del prototipo trae `#pagin` con el atributo `hidden`: hay que
       mostrarlo cuando hay mas de una pagina, si no la paginacion queda invisible. */
    if (pagin) pagin.hidden = (paginas <= 1);
    if (prev) { prev.disabled = S.pagina <= 1; prev.setAttribute('data-pg', String(S.pagina - 1)); }
    if (next) { next.disabled = S.pagina >= paginas; next.setAttribute('data-pg', String(S.pagina + 1)); }
  }

  function renderTodo() {
    renderKPIs();
    renderResumen();
    renderTabla();
  }

  function irA(pantalla) {
    /* OJO: la visibilidad la gobierna la HOJA del prototipo, no los estilos en línea.
       `.emo-kair-screen{display:none}` es una regla de la hoja y le GANA al
       `style="display:block"` en línea (sin `!important` la regla no pierde contra el
       estilo en línea cuando el selector es tan específico). Resultado del primer
       intento: al cambiar de pestaña quedaban TODAS las pantallas ocultas. Se usa la
       clase que el propio CSS define, y se limpia cualquier `display` en línea previo. */
    ['resumen', 'certificados', 'detalle'].forEach(function (p) {
      var sec = $('#screen-' + p);
      if (!sec) return;
      sec.classList.toggle('emo-is-active', p === pantalla);
      sec.style.display = '';
    });
    var t1 = $('#tab-resumen'), t2 = $('#tab-certificados');
    if (t1) t1.classList.toggle('emo-is-active', pantalla === 'resumen');
    if (t2) t2.classList.toggle('emo-is-active', pantalla === 'certificados');
    klog('NAV', 'PANTALLA', 'OK', pantalla);
  }

  /* ══════════════ DETALLE ══════════════ */
  function certificadoPorId(id) {
    for (var i = 0; i < S.certificados.length; i++) {
      if (String(S.certificados[i].id) === String(id)) return S.certificados[i];
    }
    return null;
  }
  /** El certificado más reciente de un trabajador (por cédula). */
  function certificadoDeCedula(cedula) {
    var lista = S.certificados.filter(function (c) { return c.cedula === cedula; })
      .sort(function (a, b) { return (b.fechaExamen || '').localeCompare(a.fechaExamen || ''); });
    return lista.length ? lista[0] : null;
  }

  function abrirDetalle(id) {
    var c = certificadoPorId(id);
    if (!c) return;
    S.cedulaDetalle = c.cedula;
    var k = conceptoPorClave(c.concepto) || CONCEPTOS[0];
    var set = function (sel, v) { var n = $(sel); if (n) n.innerHTML = v; };
    set('#d-avatar', escapeHtml(iniciales(c.trabajador)));
    set('#d-nombre', escapeHtml(c.trabajador));
    set('#d-nombre2', escapeHtml(c.trabajador));
    set('#d-cedula', 'CC ' + escapeHtml(puntosCedula(c.cedula)));
    set('#d-cedula2', 'CC ' + escapeHtml(puntosCedula(c.cedula)));
    set('#d-cargo', escapeHtml(c.cargo || '—'));
    set('#d-cargo-chip', escapeHtml(c.cargo || '—'));
    set('#d-area', escapeHtml(c.area || '—'));
    set('#d-tipo', escapeHtml(c.tipo));
    set('#d-ips', escapeHtml(c.ips || '—'));
    set('#d-fecha', escapeHtml(fechaLarga(c.fechaExamen)));
    set('#d-fecha2', escapeHtml(fechaLarga(c.fechaExamen)));
    set('#d-vence', c.vencimiento ? escapeHtml(fechaLarga(c.vencimiento)) : 'No aplica');
    set('#d-concepto-chip', chipConcepto(c));
    set('#d-concepto-txt', '<b>' + escapeHtml(k.etiqueta) + '</b> — ' + escapeHtml(k.desc));
    set('#d-estado-chip', chipEstado(c));
    var rec = $('#d-recomendaciones');
    if (rec) rec.textContent = c.recomendaciones || 'Sin recomendaciones registradas.';
    var recWrap = $('#d-rec-wrap');
    if (recWrap) recWrap.style.display = c.recomendaciones ? '' : 'none';

    var ev = $('#d-evidencias');
    if (ev) {
      ev.innerHTML = c.archivo
        ? '<button type="button" class="emo-kair-docpill" data-abrir="' + escapeHtml(c.archivo) + '">' +
          escapeHtml(String(c.archivo).split(/[\\/]/).pop()) + '</button>'
        : '<span class="emo-kair-mut">Sin soporte archivado</span>';
    }

    /* Historial: TODOS los certificados del trabajador. La renovación agrega, no
       reemplaza (Res. 2346 de 2007 art. 12), así que este listado es la evidencia. */
    var hist = S.certificados.filter(function (x) { return x.cedula === c.cedula; })
      .sort(function (a, b) { return (b.fechaExamen || '').localeCompare(a.fechaExamen || ''); });
    var dh = $('#d-hist');
    if (dh) {
      dh.innerHTML = hist.map(function (x) {
        return '<button type="button" class="emo-kair-histrow' + (String(x.id) === String(c.id) ? ' emo-is-current' : '') +
          '" data-ver="' + escapeHtml(x.id) + '">' +
          '<span class="emo-kair-histrow__dot"></span>' +
          '<span class="emo-kair-histrow__txt"><b>' + escapeHtml(x.tipo) + '</b>' +
          '<small>' + escapeHtml(fechaLarga(x.fechaExamen)) + (x.certificadoOrigen ? ' · renovación' : '') + '</small></span>' +
          chipConcepto(x) + '</button>';
      }).join('');
    }
    irA('detalle');
    klog('DETALLE', 'ABRIR', 'OK', 'id=' + id + ' historial=' + hist.length);
  }

  /* ══════════════ FORMULARIO (nueva / editar / renovar) ══════════════ */
  function opcionesTipo(seleccionado) {
    return '<option value="">Selecciona…</option>' + TIPOS.map(function (t) {
      return '<option value="' + escapeHtml(t.nombre) + '"' + (t.nombre === seleccionado ? ' selected' : '') + '>' +
        escapeHtml(t.nombre) + '</option>';
    }).join('');
  }

  function abrirFormulario(modo, id) {
    S.modo = modo || 'nueva';
    S.editandoId = id || null;
    S.archivoFormulario = '';
    var base = id ? certificadoPorId(id) : null;

    var titulos = {
      nueva: ['Registrar Certificado de Aptitud', 'Certificado emitido por la IPS · Res. 2346 de 2007 / Res. 1843 de 2025'],
      editar: ['Editar Certificado de Aptitud', 'Corrige los datos del certificado. El certificado anterior se conserva.'],
      renovar: ['Renovar Certificado de Aptitud', 'Se archivará un certificado NUEVO y el anterior queda en el historial.']
    };
    var t = titulos[S.modo] || titulos.nueva;
    var mt = $('#modal-titulo'); if (mt) mt.textContent = t[0];
    var ms = $('#modal-subtitulo'); if (ms) ms.textContent = t[1];

    var val = function (sel, v) { var n = $(sel); if (n) n.value = v == null ? '' : v; };
    val('#rm-nombre', base ? base.trabajador : '');
    val('#rm-cedula', base ? puntosCedula(base.cedula) : '');
    val('#rm-cargo', base ? base.cargo : '');
    val('#rm-area', base ? base.area : '');
    val('#rm-ips', base ? base.ips : '');

    if (S.modo === 'editar' && base) {
      val('#rm-fecha', base.fechaExamen);
      val('#rm-vence', base.vencimiento || '');
      val('#rm-recomendaciones', base.recomendaciones || '');
    } else if (S.modo === 'renovar' && base) {
      val('#rm-fecha', hoyISO());
      val('#rm-vence', tipoVence(base.tipo) ? sumaAnio(hoyISO()) : '');
      val('#rm-recomendaciones', '');
    } else {
      val('#rm-fecha', hoyISO());
      val('#rm-vence', '');
      val('#rm-recomendaciones', '');
    }

    var selTipo = $('#rm-tipo');
    if (selTipo) {
      var tipo = (base ? base.tipo : '');
      selTipo.innerHTML = opcionesTipo(tipo);
      selTipo.value = tipo;
    }

    /* Radio-cards de concepto: botones con delegación de eventos. */
    var box = $('#rm-conceptos');
    if (box) {
      box.innerHTML = CONCEPTOS.map(function (c) {
        return '<button type="button" class="emo-kair-concepto" data-concepto-card="' + c.clave + '">' +
          '<span class="emo-kair-concepto__dot"></span>' +
          '<span><span class="emo-kair-concepto__name">' + escapeHtml(c.etiqueta) + '</span>' +
          '<span class="emo-kair-concepto__desc">' + escapeHtml(c.desc) + '</span></span>' +
          '</button>';
      }).join('');
    }
    marcarConcepto(S.modo === 'editar' && base ? base.concepto : (S.modo === 'renovar' ? 'apto' : ''));

    var ruta = $('#rm-ruta');
    if (ruta) {
      /* 📦767 — la pista refleja el archivo real (al editar) o la carpeta del
         año según la fecha del examen (registro nuevo). */
      if (base && base.archivo) {
        ruta.textContent = String(base.archivo).split(/[\\/]/).pop();
      } else {
        var fAnio = ((($('#rm-fecha') || {}).value) || hoyISO() || '').slice(0, 4);
        ruta.textContent = 'carpeta ' + (fAnio || String(new Date().getFullYear()));
      }
    }
    actualizarVencimiento();
    actualizarInterpretacion();
    validarFormulario();
    abrirOverlay('modal-cert');
    var foco = $('#rm-nombre');
    if (foco) setTimeout(function () { foco.focus(); }, 60);
    klog('FORM', 'ABRIR', 'OK', 'modo=' + S.modo + (id ? ' id=' + id : ''));
  }

  function marcarConcepto(clave) {
    $all('#rm-conceptos .emo-kair-concepto').forEach(function (c) {
      c.classList.toggle('emo-is-sel', c.getAttribute('data-concepto-card') === clave);
    });
  }
  function conceptoElegido() {
    var n = $('#rm-conceptos .emo-kair-concepto.emo-is-sel');
    return n ? n.getAttribute('data-concepto-card') : '';
  }

  /** El vencimiento solo aplica a los periódicos: se habilita u oculta solo. */
  function actualizarVencimiento() {
    var tipo = ($('#rm-tipo') || {}).value || '';
    var aplica = tipoVence(tipo);
    var campo = $('#rm-vence');
    if (campo) {
      campo.disabled = !aplica;
      if (!aplica) campo.value = '';
      else if (!campo.value) campo.value = sumaAnio(($('#rm-fecha') || {}).value || hoyISO());
    }
    var hint = $('#rm-vence-hint');
    if (hint) {
      hint.textContent = aplica
        ? 'Los periódicos vencen según protocolo (se sugiere +1 año).'
        : 'Solo los exámenes periódicos tienen vencimiento.';
    }
    var req = $('#rm-vence-req');
    if (req) req.style.display = aplica ? '' : 'none';
  }

  function actualizarInterpretacion() {
    var box = $('#rm-interp');
    if (!box) return;
    var c = conceptoPorClave(conceptoElegido());
    if (!c) {
      box.className = 'emo-interp';
      box.innerHTML = '<b>Selecciona el concepto</b> emitido por la IPS para ver la acción de gestión asociada.';
      return;
    }
    var gestiones = {
      apto: 'Archivar el certificado y mantener el control de vigencia si el examen es periódico.',
      recomendaciones: 'Implementar y hacer seguimiento de las recomendaciones en el puesto de trabajo.',
      aplazado: 'Coordinar con la IPS los exámenes complementarios antes de definir la aptitud.',
      noapto: 'No autorizar el cargo; gestionar reubicación o revisión con la IPS.'
    };
    box.className = 'emo-interp emo-interp--' + c.nivel;
    box.innerHTML = '<b>' + escapeHtml(c.db) + '</b> — ' + escapeHtml(gestiones[c.clave] || '');
    var lab = $('#rm-recom-label');
    if (lab) lab.style.display = (c.clave === 'recomendaciones') ? '' : 'none';
  }

  function validarFormulario() {
    var v = function (sel) { return (($(sel) || {}).value || '').trim(); };
    var tipo = v('#rm-tipo');
    var clave = conceptoElegido();
    var faltas = [];
    if (!v('#rm-nombre')) faltas.push('nombre');
    if (!v('#rm-cedula')) faltas.push('cédula');
    if (!v('#rm-cargo')) faltas.push('cargo');
    if (!tipo) faltas.push('tipo');
    if (!v('#rm-ips')) faltas.push('IPS');
    if (!v('#rm-fecha')) faltas.push('fecha');
    if (!clave) faltas.push('concepto');
    if (clave === 'recomendaciones' && !v('#rm-recomendaciones')) faltas.push('recomendaciones');
    if (tipoVence(tipo) && !v('#rm-vence')) faltas.push('vencimiento');
    if (v('#rm-vence') && v('#rm-fecha') && v('#rm-vence') < v('#rm-fecha')) faltas.push('orden de fechas');

    var btn = $('#rm-guardar');
    if (btn) btn.disabled = faltas.length > 0;
    var req = $('#rm-vence-req');
    if (req) req.style.display = tipoVence(tipo) ? '' : 'none';
    return faltas;
  }

  async function guardarFormulario() {
    var faltas = validarFormulario();
    if (faltas.length) { toast('Faltan datos: ' + faltas.join(', '), 'err'); return; }
    var btn = $('#rm-guardar');
    if (btn) btn.disabled = true;

    var tipo = ($('#rm-tipo') || {}).value || '';
    var cert = {
      trabajador: ($('#rm-nombre') || {}).value.trim(),
      cedula: ($('#rm-cedula') || {}).value.trim(),
      cargo: ($('#rm-cargo') || {}).value.trim(),
      area: (($('#rm-area') || {}).value || '').trim(),
      tipo: tipo,
      ips: ($('#rm-ips') || {}).value.trim(),
      fechaExamen: ($('#rm-fecha') || {}).value,
      vencimiento: tipoVence(tipo) ? (($('#rm-vence') || {}).value || '') : '',
      concepto: conceptoElegido(),
      recomendaciones: (($('#rm-recomendaciones') || {}).value || '').trim(),
      archivo: S.archivoFormulario || ''
    };

    try {
      if (S.modo === 'editar' && S.editandoId) {
        var actual = certificadoPorId(S.editandoId);
        cert.id = S.editandoId;
        cert.archivo = (actual && actual.archivo) || S.archivoFormulario || '';
        cert.certificadoOrigen = (actual && actual.certificadoOrigen) || '';
        var guardado = await guardarCertificado(cert);
        if (guardado) {
          for (var i = 0; i < S.certificados.length; i++) {
            if (String(S.certificados[i].id) === String(guardado.id)) S.certificados[i] = guardado;
          }
        }
        toast('Certificado actualizado.', 'ok');
        klog('FORM', 'EDITAR', 'OK', 'id=' + S.editandoId);
        cerrarOverlay('modal-cert');
        renderTodo();
        if (guardado) abrirDetalle(guardado.id);
      } else {
        /* Nueva y renovar: SIEMPRE un registro nuevo. El anterior NO se toca. */
        if (S.modo === 'renovar' && S.editandoId) cert.certificadoOrigen = S.editandoId;
        var nuevo = await guardarCertificado(cert);
        if (nuevo) S.certificados.unshift(nuevo);
        toast(S.modo === 'renovar'
          ? 'Certificado renovado. El anterior queda en el historial.'
          : 'Certificado archivado.', 'ok');
        klog('FORM', S.modo === 'renovar' ? 'RENOVAR' : 'CREAR', 'OK', 'nuevo id=' + ((nuevo && nuevo.id) || '?'));
        cerrarOverlay('modal-cert');
        renderTodo();
        if (nuevo) abrirDetalle(nuevo.id);
      }
    } catch (e) {
      klog('FORM', 'GUARDAR', 'ERR', e.message);
      toast('No se pudo guardar: ' + e.message, 'err');
      if (btn) btn.disabled = false;
    }
  }

  /* 📦766 — Adjuntar el certificado que entrega la IPS. Antes se elegía entre
     los archivos que ya estaban en la carpeta del módulo; ahora se abre el
     diálogo nativo de archivos y el puente copia el PDF a la ruta del backend
     por año (…/3.1.4.1. Certificados de Aptitud Medica/<AÑO del examen>/),
     creando las carpetas si hacen falta. El año sale de la fecha del examen. */
  async function adjuntarCertificado() {
    var a = api();
    var ruta = $('#rm-ruta');
    if (!a || !a.evaluacionesMedicas || typeof a.evaluacionesMedicas.adjuntar !== 'function') {
      toast('Este canal de archivos no está disponible.', 'err');
      return;
    }
    try {
      var fecha = (($('#rm-fecha') || {}).value || '');
      var anio = (fecha.length >= 4) ? fecha.slice(0, 4) : String(new Date().getFullYear());
      var res = await a.evaluacionesMedicas.adjuntar({ empresaId: empresaId, anio: anio });
      if (!res) return;
      if (res.success === false) {
        if (res.error && res.error.code === 'CANCELADO') return; // el usuario cerró el diálogo
        toast('No se pudo adjuntar: ' + ((res.error && res.error.message) || 'error desconocido'), 'err');
        klog('FORM', 'ADJUNTAR', 'ERR', (res.error && res.error.code) || 'unknown');
        return;
      }
      S.archivoFormulario = res.path;
      if (ruta) ruta.textContent = res.fileName || String(res.path).split(/[\\/]/).pop();
      toast('Certificado guardado en la carpeta ' + anio + ': ' + (res.fileName || ''), 'ok');
      klog('FORM', 'ADJUNTAR', 'OK', res.path);
      /* 📦768 — leer el PDF adjuntado y pre-llenar lo que falte del formulario */
      await rellenarDesdePdf(res.path);
    } catch (e) {
      klog('FORM', 'ADJUNTAR', 'ERR', e.message);
      toast('No se pudo adjuntar: ' + e.message, 'err');
    }
  }

  /* 📦768 — el puente extrae los datos del certificado (misma lectura de PDF que
     usa restricciones médicas) y acá se pre-llenan SOLO los campos vacíos: lo que
     el usuario ya haya escrito no se toca. */
  async function rellenarDesdePdf(pdfPath) {
    var a = api();
    if (!a || !a.evaluacionesMedicas || typeof a.evaluacionesMedicas.extraer !== 'function') return;
    try {
      var res = await a.evaluacionesMedicas.extraer({ pdfPath: pdfPath });
      if (!res || res.success !== true || !res.data) {
        if (res && res.error && res.error.code === 'FORMATO_NO_RECONOCIDO') {
          toast(res.error.message, 'info');
        }
        return;
      }
      var d = res.data;
      var llenados = [];
      var siVacio = function (sel, valor, etiqueta) {
        var n = $(sel);
        if (n && valor && !n.value) { n.value = valor; llenados.push(etiqueta); }
      };
      siVacio('#rm-nombre', d.trabajador, 'nombre');
      siVacio('#rm-cedula', d.cedula ? puntosCedula(d.cedula) : '', 'cédula');
      siVacio('#rm-cargo', d.cargo, 'cargo');
      siVacio('#rm-ips', d.ips, 'IPS');
      siVacio('#rm-recomendaciones', d.recomendaciones, 'recomendaciones');

      var f = $('#rm-fecha');
      if (f && d.fechaExamen) {
        /* La fecha viene pre-llenada con HOY por defecto: el dato del PDF gana
           sobre ese valor, pero no sobre una fecha que el usuario haya elegido. */
        if (!f.value || f.value === hoyISO()) {
          f.value = d.fechaExamen;
          llenados.push('fecha');
        }
      }
      var selTipo = $('#rm-tipo');
      if (selTipo && d.tipo && !selTipo.value) {
        var opt = null;
        for (var i = 0; i < selTipo.options.length; i++) {
          if (selTipo.options[i].value === d.tipo) { opt = selTipo.options[i]; break; }
        }
        if (opt) { selTipo.value = d.tipo; llenados.push('tipo'); }
      }
      if (d.conceptoDb && !conceptoElegido()) {
        var c = null;
        for (var j = 0; j < CONCEPTOS.length; j++) { if (CONCEPTOS[j].db === d.conceptoDb) { c = CONCEPTOS[j]; break; } }
        if (c) { marcarConcepto(c.clave); llenados.push('concepto'); }
      }
      if (llenados.length) {
        actualizarVencimiento();
        actualizarInterpretacion();
        validarFormulario();
        toast('Datos leídos del PDF: ' + (d.trabajador || d.cedula || 'certificado') + ' · ' + llenados.join(', '), 'ok');
        klog('FORM', 'EXTRAER', 'OK', llenados.join(','));
      }
    } catch (e) {
      klog('FORM', 'EXTRAER', 'ERR', e.message);
    }
  }

  /* ══════════════ OVERLAYS (pila + Esc) ══════════════ */
  var pila = [];
  /* 📦767-fix — la visibilidad la controla la CAPA overlay (.emo-kair-overlay +
     .emo-is-open en el CSS), no el modal interno. Si nos pasan el id del modal
     interno (ej. 'modal-cert'), resolvemos su capa padre para no repetir el bug
     donde el formulario "abría" (llegaba al log) pero nunca se mostraba. */
  function _capaOverlay(id) {
    var el = $('#' + id);
    if (!el) return null;
    if (el.classList.contains('emo-kair-modal') && el.parentElement &&
        el.parentElement.classList.contains('emo-kair-overlay')) {
      return el.parentElement;
    }
    return el;
  }
  function abrirOverlay(id) {
    var el = _capaOverlay(id);
    if (!el) return;
    el.classList.remove('emo-hidden');
    el.classList.add('emo-is-open');
    if (pila.indexOf(id) === -1) pila.push(id);
  }
  function cerrarOverlay(id) {
    var el = _capaOverlay(id);
    if (!el) return;
    el.classList.add('emo-hidden');
    el.classList.remove('emo-is-open');
    pila = pila.filter(function (x) { return x !== id; });
  }
  function overlayTope() { return pila.length ? pila[pila.length - 1] : null; }

  /* ══════════════ MARCO NORMATIVO / DOCUMENTO ══════════════ */
  function abrirMarco() {
    var d = $('#drawer-marco'); if (d) d.classList.add('emo-is-open');
    var b = $('#backdrop-marco'); if (b) b.classList.remove('emo-hidden');
    klog('MARCO', 'ABRIR', 'OK');
  }
  function cerrarMarco() {
    var d = $('#drawer-marco'); if (d) d.classList.remove('emo-is-open');
    var b = $('#backdrop-marco'); if (b) b.classList.add('emo-hidden');
  }
  function abrirDocumento() {
    var o = $('#overlay-doc'); if (o) o.classList.remove('emo-hidden');
    var m = $('#modal-doc'); if (m) m.classList.remove('emo-hidden');
  }
  function cerrarDocumento() {
    var o = $('#overlay-doc'); if (o) o.classList.add('emo-hidden');
    var m = $('#modal-doc'); if (m) m.classList.add('emo-hidden');
  }

  /* ══════════════ EXPORTAR / IMPRIMIR / COPIAR ══════════════ */
  function exportarCSV() {
    var lista = filtrados();
    if (!lista.length) { toast('No hay certificados para exportar con los filtros actuales.', 'info'); return; }
    var filas = [['Trabajador', 'Cedula', 'Cargo', 'Area', 'Tipo', 'IPS', 'Fecha examen',
      'Vencimiento', 'Concepto', 'Estado', 'Recomendaciones']];
    lista.forEach(function (c) {
      var k = conceptoPorClave(c.concepto) || {};
      filas.push([c.trabajador, puntosCedula(c.cedula), c.cargo, c.area, c.tipo, c.ips, c.fechaExamen,
        c.vencimiento, k.etiqueta || c.concepto, estadoVigencia(c), c.recomendaciones]);
    });
    var csv = filas.map(function (f) {
      return f.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'evaluaciones-medicas-' + hoyISO() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    toast('Se exportaron ' + lista.length + ' certificados.', 'ok');
    klog('EXPORT', 'CSV', 'OK', lista.length + ' filas');
  }

  function imprimirMarco() {
    var cont = $('#drawer-marco');
    if (!cont) return;
    var w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { toast('El sistema bloqueó la ventana de impresión.', 'err'); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8">' +
      '<title>Marco Normativo · Evaluaciones Médicas</title>' +
      '<style>body{font-family:system-ui,sans-serif;padding:32px;line-height:1.6;color:#14213D}' +
      'h1{font-size:20px}h2{font-size:15px;margin-top:22px}small{color:#748096}' +
      '.emo-drawer__close,.emo-drawer__foot{display:none}</style></head><body>' +
      cont.innerHTML + '</body></html>');
    w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 350);
  }

  function copiarMarco() {
    var cont = $('#drawer-marco');
    if (!cont) return;
    var texto = cont.innerText || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto)
        .then(function () { toast('Marco normativo copiado.', 'ok'); })
        .catch(function () { toast('No se pudo copiar.', 'err'); });
    } else {
      toast('No se pudo copiar.', 'err');
    }
  }

  /* ══════════════ DOCUMENTOS DE REFERENCIA (lo que ya existía) ══════════════ */
  async function cargarDocumentosReferencia() {
    var a = api();
    if (!a || !a.getDocumentFolders) return;
    try {
      var res = await a.getDocumentFolders({
        companyName: empresaId, moduleName: 'Gestión de la Salud', submoduleName: '3.1.4 Evaluaciones médicas'
      });
      if (res && res.success) {
        S.documentos = Array.isArray(res.files) ? res.files : [];
        klog('DOCS', 'LISTAR', 'OK', S.documentos.length + ' archivos');
      }
    } catch (e) {
      klog('DOCS', 'LISTAR', 'ERR', e.message);
    }
  }

  function abrirRuta(ruta) {
    var a = api();
    if (!ruta) return;
    if (a && a.openPath) { a.openPath(ruta); klog('DOCS', 'ABRIR', 'OK', ruta); }
    else toast('No se puede abrir el archivo.', 'err');
  }

  /* ══════════════ EVENTOS ══════════════ */
  function onClick(ev) {
    var t = ev.target;
    var buscar = function (attr) { return t.closest ? t.closest('[' + attr + ']') : null; };
    var el;

    /* 📦767-fix — las capas usan las clases emo-kair-overlay / emo-kair-backdrop;
       con las viejas (emo-overlay / emo-backdrop) el clic en el fondo nunca cerraba. */
    if (t.classList && (t.classList.contains('emo-kair-overlay') || t.classList.contains('emo-kair-backdrop') || t.classList.contains('emo-overlay') || t.classList.contains('emo-backdrop'))) {
      var oid = t.getAttribute('id');
      if (oid === 'backdrop-marco') cerrarMarco();
      else if (oid === 'overlay-doc') cerrarDocumento();
      else cerrarOverlay(oid);
      return;
    }

    if ((el = buscar('data-cerrar'))) {
      var que = el.getAttribute('data-cerrar');
      if (que === 'marco') cerrarMarco();
      else if (que === 'doc') cerrarDocumento();
      else cerrarOverlay(que);
      return;
    }
    if ((el = buscar('data-ver'))) { abrirDetalle(el.getAttribute('data-ver')); return; }
    if ((el = buscar('data-editar'))) { abrirFormulario('editar', el.getAttribute('data-editar')); return; }
    if ((el = buscar('data-renovar'))) { abrirFormulario('renovar', el.getAttribute('data-renovar')); return; }
    if ((el = buscar('data-abrir'))) { abrirRuta(el.getAttribute('data-abrir')); return; }
    if ((el = buscar('data-concepto-card'))) {
      marcarConcepto(el.getAttribute('data-concepto-card'));
      actualizarInterpretacion();
      validarFormulario();
      return;
    }
    if ((el = buscar('data-tab'))) { irA(el.getAttribute('data-tab')); return; }
    if ((el = buscar('data-sort'))) {
      var clave = el.getAttribute('data-sort');
      if (S.orden.clave === clave) S.orden.dir = S.orden.dir === 'asc' ? 'desc' : 'asc';
      else { S.orden.clave = clave; S.orden.dir = 'asc'; }
      renderTabla();
      return;
    }
    if ((el = buscar('data-jump'))) {
      var destino = el.getAttribute('data-jump');
      S.estado = (destino === 'criticos') ? 'no-apto' : (destino === 'atencion' ? 'por-vencer' : 'vigente');
      S.pagina = 1;
      var fe = $('#f-estado'); if (fe) fe.value = S.estado;
      irA('certificados');
      renderTabla();
      return;
    }
    if ((el = buscar('data-pg'))) {
      var p = parseInt(el.getAttribute('data-pg'), 10);
      if (!isNaN(p)) { S.pagina = p; renderTabla(); }
      return;
    }
  }

  function onKeydown(ev) {
    if (ev.key === 'Escape') {
      if (pila.length) { cerrarOverlay(overlayTope()); return; }
      var d = $('#drawer-marco');
      if (d && d.classList.contains('emo-is-open')) { cerrarMarco(); return; }
      var o = $('#overlay-doc');
      if (o && !o.classList.contains('emo-hidden')) cerrarDocumento();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'n' || ev.key === 'N')) {
      ev.preventDefault();
      abrirFormulario('nueva', null);
    }
  }

  /* ══════════════ MARCADO (lo genera `main/_armar-emo.js`) ══════════════ */
  var MARKUP_RAW = `<header class="emo-kair-header">
    <div class="emo-kair-header__id">
      <div class="emo-kair-header__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M12 10v6"/><path d="M9 13h6"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>
      </div>
      <div>
        <div class="emo-kair-header__crumb">K+AIR · Gestión de la Salud · 3.1.4</div>
        <h1 class="emo-kair-header__title">Evaluaciones Médicas Ocupacionales</h1>
        <div class="emo-kair-header__sub">Certificados de aptitud emitidos por la IPS · control de vigencia y soporte SG-SST</div>
      </div>
    </div>
    <div class="emo-kair-header__actions">
      <span class="emo-kair-empchip" title="Empresa activa">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
        Tempoactiva
      </span>
      <button class="emo-kair-btn emo-kair-btn--ghost" id="btn-volver-panel" type="button" aria-label="Volver al Panel de Control">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        Volver
      </button>
      <button class="emo-kair-btn emo-kair-btn--soft" id="btn-marco" type="button" aria-haspopup="dialog" aria-controls="drawer-marco">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/></svg>
        Marco Normativo
      </button>
      <button class="emo-kair-btn emo-kair-btn--primary" id="btn-nuevo" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        Registrar Certificado
      </button>
    </div>
  </header>

  
  <nav class="emo-kair-tabs" role="tablist" aria-label="Secciones del submódulo">
    <button class="emo-kair-tab emo-is-active" id="tab-resumen" data-tab="resumen" role="tab" aria-selected="true" aria-controls="screen-resumen" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
      Resumen
    </button>
    <button class="emo-kair-tab" id="tab-certificados" data-tab="certificados" role="tab" aria-selected="false" aria-controls="screen-certificados" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9.5 13.5l1.8 1.8 3.5-3.6"/></svg>
      Certificados de Aptitud
    </button>
  </nav>

  <main class="emo-kair-main">

    
    <section class="emo-kair-screen emo-is-active" id="screen-resumen" aria-label="Resumen de gestión de la salud">

      
      <div class="emo-kair-kpis" role="list" aria-label="Indicadores del módulo">
        <div class="emo-kair-kpi" role="listitem">
          <div class="emo-kair-kpi__icon emo-kair-kpi__icon--blue" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M12 10v6"/><path d="M9 13h6"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>
          </div>
          <div>
            <div class="emo-kair-kpi__value" id="kpi-total">0</div>
            <div class="emo-kair-kpi__label">Total certificados</div>
          </div>
        </div>
        <button class="emo-kair-kpi" role="listitem" type="button" data-jump="vigente" title="Ver certificados vigentes">
          <div class="emo-kair-kpi__icon emo-kair-kpi__icon--green" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/></svg>
          </div>
          <div>
            <div class="emo-kair-kpi__value" id="kpi-vigentes">0</div>
            <div class="emo-kair-kpi__label">Aptos y vigentes</div>
          </div>
        </button>
        <button class="emo-kair-kpi" role="listitem" type="button" data-jump="atencion" title="Ver certificados que requieren atención">
          <div class="emo-kair-kpi__icon emo-kair-kpi__icon--amber" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          </div>
          <div>
            <div class="emo-kair-kpi__value" id="kpi-atencion">0</div>
            <div class="emo-kair-kpi__label">Requieren atención</div>
          </div>
        </button>
        <button class="emo-kair-kpi" role="listitem" type="button" data-jump="criticos" title="Ver certificados vencidos o no aptos">
          <div class="emo-kair-kpi__icon emo-kair-kpi__icon--red" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div>
            <div class="emo-kair-kpi__value" id="kpi-criticos">0</div>
            <div class="emo-kair-kpi__label">Vencidos o no aptos</div>
          </div>
        </button>
      </div>

      
      <div class="emo-kair-rgrid">
        <div class="emo-kair-card">
          <div class="emo-kair-card__head">
            <div>
              <div class="emo-kair-card__title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                Control de Vigencia
              </div>
              <div class="emo-kair-card__hint">Certificados periódicos con vencimiento en los próximos 30 días o vencidos</div>
            </div>
          </div>
          <div id="res-alertas"></div>
          <div class="emo-kair-okbox" id="res-okbox" hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.4 2.4 4.6-5"/></svg>
            Todos los certificados periódicos están vigentes.
          </div>
          <div class="emo-kair-alertfoot">
            <button class="emo-kair-btn emo-kair-btn--ghost emo-kair-btn--sm" id="btn-ver-vencidos" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/></svg>
              Ver vencidos (<span id="cnt-vencidos">0</span>)
            </button>
            <button class="emo-kair-btn emo-kair-btn--soft emo-kair-btn--sm" id="btn-ver-porvencer" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              Ver por vencer (<span id="cnt-porvencer">0</span>)
            </button>
          </div>
        </div>

        <div class="emo-kair-card">
          <div class="emo-kair-card__head">
            <div>
              <div class="emo-kair-card__title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                Documentos de Referencia
              </div>
              <div class="emo-kair-card__hint">Procedimiento corporativo y archivo de soporte</div>
            </div>
          </div>
          <div style="padding-top:14px">
            <button class="emo-kair-doctile" id="tile-doc" type="button" aria-haspopup="dialog">
              <div class="emo-kair-doctile__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              </div>
              <div class="emo-kair-doctile__txt">
                <div class="emo-kair-doctile__name">GI-PR-006 · Realización de Exámenes Ocupacionales</div>
                <div class="emo-kair-doctile__sub">Procedimiento · REV.07 · Abril 30 de 2025 · Res. 1843 de 2025</div>
              </div>
              <svg class="emo-kair-doctile__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button class="emo-kair-doctile" id="tile-carpeta" type="button">
              <div class="emo-kair-doctile__icon emo-kair-doctile__icon--green" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              </div>
              <div class="emo-kair-doctile__txt">
                <div class="emo-kair-doctile__name">3.1.4.1 Certificados de Aptitud Médica</div>
                <div class="emo-kair-doctile__sub"><span id="cnt-carpeta">0</span> certificados archivados en el expediente</div>
              </div>
              <svg class="emo-kair-doctile__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </div>

      
      <div class="emo-kair-rgrid emo-kair-rgrid--eq">
        <div class="emo-kair-card">
          <div class="emo-kair-card__head">
            <div class="emo-kair-card__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v10"/><path d="M3 17V7"/><path d="M12 3v18"/><path d="M3 7h18"/><path d="M3 17h18"/></svg>
              Concepto de Aptitud
            </div>
            <span class="emo-kair-chip emo-kair-chip--neutral">Res. 2346 de 2007</span>
          </div>
          <div class="emo-kair-chartwrap" id="chart-concepto"></div>
        </div>
        <div class="emo-kair-card">
          <div class="emo-kair-card__head">
            <div class="emo-kair-card__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/></svg>
              Tipo de Evaluación
            </div>
            <span class="emo-kair-chip emo-kair-chip--neutral">GI-PR-006</span>
          </div>
          <div class="emo-kair-chartwrap" id="chart-tipo"></div>
        </div>
      </div>

      
      <div class="emo-kair-rgrid emo-kair-rgrid--eq">
        <div class="emo-kair-card">
          <div class="emo-kair-card__head">
            <div class="emo-kair-card__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M12 12v4"/></svg>
              Últimos Certificados Registrados
            </div>
          </div>
          <div id="res-ultimos" style="padding-top:6px"></div>
          <div class="emo-kair-lastfoot">
            <button class="emo-kair-linkbtn" id="btn-ver-todos" type="button">Ver todos los certificados →</button>
          </div>
        </div>
        <div class="emo-kair-card">
          <div class="emo-kair-card__head">
            <div class="emo-kair-card__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="8" width="3" height="10" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/></svg>
              Distribución por Año
            </div>
            <span class="emo-kair-chip emo-kair-chip--neutral">Exámenes realizados</span>
          </div>
          <div class="emo-kair-chartsvg" id="chart-anos"></div>
        </div>
      </div>

    </section>


    
    <section class="emo-kair-screen" id="screen-certificados" aria-label="Lista de certificados de aptitud médica">

      <div class="emo-kair-card">
        <div class="emo-kair-filters" role="search" aria-label="Filtros del listado">
          <div class="emo-kair-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input type="search" class="emo-kair-input" id="f-buscar" placeholder="Buscar trabajador por nombre, cédula o cargo…" aria-label="Buscar trabajador">
          </div>
          <select class="emo-kair-select" id="f-tipo" aria-label="Filtrar por tipo de evaluación">
            <option value="todos">Tipo · Todos</option>
          </select>
          <select class="emo-kair-select" id="f-estado" aria-label="Filtrar por estado">
            <option value="todos">Estado · Todos</option>
            <option value="vigente">Vigente</option>
            <option value="porvencer">Por vencer</option>
            <option value="vencido">Vencido</option>
            <option value="recomendaciones">Con recomendaciones</option>
            <option value="aplazado">Aplazado</option>
            <option value="noapto">No apto</option>
            <option value="historico">Histórico</option>
          </select>
          <div class="emo-kair-filters__count">
            <span id="f-contador" aria-live="polite">0 certificados</span>
            <button class="emo-kair-linkbtn" id="f-limpiar" type="button" hidden>Limpiar filtros</button>
            <button class="emo-kair-btn emo-kair-btn--ghost emo-kair-btn--sm" id="btn-exportar" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
              Exportar CSV
            </button>
          </div>
        </div>

        <div class="emo-kair-tablewrap">
          <table class="emo-kair-table" aria-describedby="f-contador">
            <thead>
              <tr>
                <th data-sort="trabajador" aria-sort="none">Trabajador <span class="emo-kair-sort" data-arrow="trabajador"></span></th>
                <th>Cargo · Área</th>
                <th>Tipo de Examen</th>
                <th>IPS</th>
                <th data-sort="fecha_examen" aria-sort="descending">Fecha · Vencimiento <span class="emo-kair-sort" data-arrow="fecha_examen">▼</span></th>
                <th>Concepto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="tbody-certificados"></tbody>
          </table>
        </div>

        <div class="emo-kair-mobilelist" id="mobilelist" aria-label="Listado de certificados"></div>

        <div class="emo-kair-empty" id="empty-state" aria-live="polite">
          <div class="emo-kair-empty__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M12 10v6"/><path d="M9 13h6"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>
          </div>
          <div class="emo-kair-empty__title">Sin resultados</div>
          <p>Ningún certificado coincide con la búsqueda o los filtros activos.<br>Ajusta los criterios o registra un nuevo certificado de aptitud.</p>
        </div>

        <div class="emo-kair-pagin" id="pagin" hidden>
          <span id="pagin-info">Página 1 de 1</span>
          <div class="emo-kair-pagin__btns">
            <button class="emo-kair-btn emo-kair-btn--ghost emo-kair-btn--sm" id="pagin-prev" type="button">← Anterior</button>
            <button class="emo-kair-btn emo-kair-btn--ghost emo-kair-btn--sm" id="pagin-next" type="button">Siguiente →</button>
          </div>
        </div>
      </div>
    </section>

    
    <section class="emo-kair-screen" id="screen-detalle" aria-label="Ficha del certificado de aptitud">
      <div class="emo-kair-backline">
        <button class="emo-kair-btn emo-kair-btn--ghost emo-kair-btn--sm" id="btn-volver-lista" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Volver a la Lista
        </button>
      </div>

      
      <div class="emo-kair-detailhero">
        <div class="emo-kair-detailhero__id">
          <div class="emo-kair-detailhero__avatar" id="d-avatar">—</div>
          <div>
            <div class="emo-kair-detailhero__name" id="d-nombre">—</div>
            <div class="emo-kair-detailhero__meta">
              <span>CC: <b id="d-cedula">—</b></span>
              <span id="d-cargo-chip" class="emo-kair-chip emo-kair-chip--blue">—</span>
              <span>Examen: <b id="d-fecha">—</b></span>
            </div>
          </div>
        </div>
        <div class="emo-kair-detailhero__score">
          <span class="emo-kair-chip" id="d-concepto-chip">—</span>
          <span class="emo-kair-chip" id="d-estado-chip">—</span>
          <button class="emo-kair-btn emo-kair-btn--primary emo-kair-btn--sm" id="btn-renovar-detalle" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-2.6-6.3"/><path d="M21 3v6h-6"/></svg>
            Renovar Certificado
          </button>
          <button class="emo-kair-btn emo-kair-btn--soft emo-kair-btn--sm" id="btn-editar-detalle" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>
            Editar
          </button>
        </div>
      </div>

      <div class="emo-kair-detailgrid">
        <div style="display:flex;flex-direction:column;gap:16px">
          
          <div class="emo-kair-card emo-kair-secbox">
            <h3 class="emo-kair-secbox__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              Información General
            </h3>
            <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Trabajador</span><span class="emo-kair-inforow__v" id="d-nombre2">—</span></div>
            <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Cédula</span><span class="emo-kair-inforow__v" id="d-cedula2">—</span></div>
            <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Cargo</span><span class="emo-kair-inforow__v" id="d-cargo">—</span></div>
            <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Área</span><span class="emo-kair-inforow__v" id="d-area">—</span></div>
            <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Tipo de Evaluación</span><span class="emo-kair-inforow__v" id="d-tipo">—</span></div>
            <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">IPS que Emite</span><span class="emo-kair-inforow__v" id="d-ips">—</span></div>
            <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Fecha del Examen</span><span class="emo-kair-inforow__v" id="d-fecha2">—</span></div>
            <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Vencimiento</span><span class="emo-kair-inforow__v" id="d-vence">—</span></div>
          </div>

          
          <div class="emo-kair-card emo-kair-secbox">
            <h3 class="emo-kair-secbox__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>
              Concepto de Aptitud
            </h3>
            <div class="emo-kair-obsbox" id="d-concepto-txt">—</div>
            <div id="d-rec-wrap" style="margin-top:12px">
              <div style="font-size:12.5px;font-weight:600;color:var(--kair-text-2);margin-bottom:6px">Recomendaciones al empleador</div>
              <div class="emo-kair-obsbox" id="d-recomendaciones">—</div>
            </div>
            <div class="emo-kair-note emo-kair-note--warn" style="margin-top:12px">
              <b>Confidencialidad:</b> el diagnóstico clínico permanece en la historia clínica ocupacional de la IPS. La empresa archiva únicamente el concepto de aptitud y las recomendaciones laborales.
            </div>
          </div>

          
          <div class="emo-kair-card emo-kair-secbox">
            <h3 class="emo-kair-secbox__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              Soporte Archivado
            </h3>
            <div class="emo-kair-evrows" id="d-evidencias"></div>
          </div>
        </div>

        
        <div class="emo-kair-card emo-kair-secbox">
          <h3 class="emo-kair-secbox__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Historial del Trabajador
          </h3>
          <div id="d-hist"></div>
          <div class="emo-kair-note" style="margin-top:12px">
            Cada evaluación médica ocupacional es un evento sanitario independiente: el certificado anterior <b>no se modifica ni se elimina</b>, la renovación agrega un nuevo certificado al expediente (Res. 2346 de 2007).
          </div>
        </div>
      </div>
    </section>

  </main>


  
  <div class="emo-kair-backdrop" id="backdrop-marco"></div>
  <aside class="emo-kair-drawer" id="drawer-marco" role="dialog" aria-modal="true" aria-label="Marco normativo y ciclo de gestión" tabindex="-1">
    <div class="emo-kair-drawer__head">
      <h2>Marco Normativo</h2>
      <p>Evaluaciones médicas ocupacionales · ciclo de aptitud</p>
      <button class="emo-kair-drawer__close" id="marco-close" type="button" aria-label="Cerrar marco normativo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="emo-kair-drawer__body">
      <div class="emo-kair-formula">
        <div class="emo-kair-formula__label">Base legal</div>
        <div class="emo-kair-formula__calc">Res. 2346/2007 · Res. 1843/2025</div>
        <div style="font-size:11.5px;opacity:.85;margin-top:4px">Evaluaciones médicas ocupacionales y conceptos de aptitud</div>
      </div>

      <h3 class="emo-kair-sec-title">Tipos de Evaluación · GI-PR-006</h3>

      <div class="emo-kair-typerow">
        <span class="emo-kair-typerow__num">1</span>
        <span class="emo-kair-typerow__txt"><span class="emo-kair-typerow__name">Preingreso</span><span class="emo-kair-typerow__hint">Antes de la vinculación del trabajador</span></span>
      </div>
      <div class="emo-kair-typerow">
        <span class="emo-kair-typerow__num">2</span>
        <span class="emo-kair-typerow__txt"><span class="emo-kair-typerow__name">Periódico</span><span class="emo-kair-typerow__hint">Control de vigencia anual según protocolo</span></span>
      </div>
      <div class="emo-kair-typerow">
        <span class="emo-kair-typerow__num">3</span>
        <span class="emo-kair-typerow__txt"><span class="emo-kair-typerow__name">Cambio de Ocupación</span><span class="emo-kair-typerow__hint">Al cambiar de cargo o de tareas</span></span>
      </div>
      <div class="emo-kair-typerow">
        <span class="emo-kair-typerow__num">4</span>
        <span class="emo-kair-typerow__txt"><span class="emo-kair-typerow__name">Post-Incapacidad</span><span class="emo-kair-typerow__hint">Al regresar tras una incapacidad</span></span>
      </div>
      <div class="emo-kair-typerow">
        <span class="emo-kair-typerow__num">5</span>
        <span class="emo-kair-typerow__txt"><span class="emo-kair-typerow__name">Retorno al Trabajo</span><span class="emo-kair-typerow__hint">Tras ausencia prolongada</span></span>
      </div>
      <div class="emo-kair-typerow">
        <span class="emo-kair-typerow__num">6</span>
        <span class="emo-kair-typerow__txt"><span class="emo-kair-typerow__name">Retiro</span><span class="emo-kair-typerow__hint">Al terminar la vinculación</span></span>
      </div>
      <div class="emo-kair-typerow">
        <span class="emo-kair-typerow__num">7</span>
        <span class="emo-kair-typerow__txt"><span class="emo-kair-typerow__name">Seguimiento</span><span class="emo-kair-typerow__hint">Control de recomendaciones vigentes</span></span>
      </div>

      <h3 class="emo-kair-sec-title" style="margin-top:20px">Conceptos de Aptitud</h3>

      <div class="emo-kair-level emo-kair-level--green">
        <div class="emo-kair-level__top">
          <span class="emo-kair-level__range">APTO</span>
          <span class="emo-kair-chip emo-kair-chip--green">Sin restricciones</span>
        </div>
        <div class="emo-kair-level__result"><b>Gestión:</b> archivar certificado y mantener control de vigencia si es periódico.</div>
      </div>

      <div class="emo-kair-level emo-kair-level--amber">
        <div class="emo-kair-level__top">
          <span class="emo-kair-level__range">APTO CON RECOMENDACIONES</span>
          <span class="emo-kair-chip emo-kair-chip--amber">Medidas preventivas</span>
        </div>
        <div class="emo-kair-level__result"><b>Gestión:</b> implementar y hacer seguimiento de las recomendaciones en el puesto de trabajo.</div>
      </div>

      <div class="emo-kair-level emo-kair-level--blue">
        <div class="emo-kair-level__top">
          <span class="emo-kair-level__range">APLAZADO</span>
          <span class="emo-kair-chip emo-kair-chip--blue">Exámenes complementarios</span>
        </div>
        <div class="emo-kair-level__result"><b>Gestión:</b> coordinar con la IPS los exámenes faltantes antes de definir la aptitud.</div>
      </div>

      <div class="emo-kair-level emo-kair-level--red">
        <div class="emo-kair-level__top">
          <span class="emo-kair-level__range">NO APTO</span>
          <span class="emo-kair-chip emo-kair-chip--red">Requiere gestión</span>
        </div>
        <div class="emo-kair-level__result"><b>Gestión:</b> no autorizar el cargo; gestionar reubicación o revisión con la IPS.</div>
      </div>

      <h3 class="emo-kair-sec-title" style="margin-top:20px">Gestión de Vigencia</h3>

      <div class="emo-kair-level emo-kair-level--green">
        <div class="emo-kair-level__top"><span class="emo-kair-level__range">VIGENTE</span><span class="emo-kair-chip emo-kair-chip--green">&gt; 30 días</span></div>
      </div>
      <div class="emo-kair-level emo-kair-level--amber">
        <div class="emo-kair-level__top"><span class="emo-kair-level__range">POR VENCER</span><span class="emo-kair-chip emo-kair-chip--amber">≤ 30 días</span></div>
        <div class="emo-kair-level__result">Programar la re-evaluación con la IPS.</div>
      </div>
      <div class="emo-kair-level emo-kair-level--red">
        <div class="emo-kair-level__top"><span class="emo-kair-level__range">VENCIDO</span><span class="emo-kair-chip emo-kair-chip--red">Acción inmediata</span></div>
        <div class="emo-kair-level__result">El certificado periódico no cubre al trabajador: renovar con la IPS.</div>
      </div>

      <div class="emo-kair-note">
        <b>Nota legal:</b> los certificados de aptitud constituyen evidencia del SG-SST (Decreto 1072 de 2015 · Res. 0312 de 2019, numeral 3.1.4). El diagnóstico clínico no se archiva en la empresa: la historia clínica ocupacional es reservada y su custodia corresponde a la IPS (Res. 2346 de 2007, art. 12).
      </div>
    </div>
    <div class="emo-kair-drawer__foot">
      <button class="emo-kair-btn emo-kair-btn--ghost" id="marco-imprimir" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
        Imprimir
      </button>
      <button class="emo-kair-btn emo-kair-btn--primary" id="marco-copiar" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copiar
      </button>
    </div>
  </aside>


  
  <div class="emo-kair-overlay" id="overlay-modal">
    <div class="emo-kair-modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" id="modal-cert">
      <div class="emo-kair-modal__head">
        <div>
          <h2 id="modal-titulo">Registrar Certificado de Aptitud</h2>
          <p id="modal-subtitulo">Certificado emitido por la IPS · Res. 2346 de 2007 / Res. 1843 de 2025</p>
        </div>
        <button class="emo-kair-iconbtn" id="modal-close" type="button" aria-label="Cerrar registro">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="emo-kair-modal__body">
        
        <div>
          <h3 class="emo-kair-modal__coltitle">Datos del Trabajador</h3>
          <div class="emo-kair-field" id="fw-nombre">
            <label for="rm-nombre">Nombre Completo <b>*</b></label>
            <input type="text" class="emo-kair-input" id="rm-nombre" placeholder="Ej: Carlos Andrés Rojas" autocomplete="off">
            <div class="emo-kair-field__error">Ingresa el nombre completo del trabajador.</div>
          </div>
          <div class="emo-kair-field__row">
            <div class="emo-kair-field" id="fw-cedula">
              <label for="rm-cedula">Cédula <b>*</b></label>
              <input type="text" class="emo-kair-input" id="rm-cedula" placeholder="1.023.456.789" autocomplete="off">
              <div class="emo-kair-field__error">Ingresa la cédula del trabajador.</div>
            </div>
            <div class="emo-kair-field" id="fw-cargo">
              <label for="rm-cargo">Cargo <b>*</b></label>
              <input type="text" class="emo-kair-input" id="rm-cargo" placeholder="Operador de Producción" autocomplete="off">
              <div class="emo-kair-field__error">Ingresa el cargo actual.</div>
            </div>
          </div>
          <div class="emo-kair-field">
            <label for="rm-area">Área / Proceso</label>
            <input type="text" class="emo-kair-input" id="rm-area" placeholder="Producción" autocomplete="off">
          </div>

          <h3 class="emo-kair-modal__coltitle" style="margin-top:20px">Datos del Examen</h3>
          <div class="emo-kair-field__row">
            <div class="emo-kair-field" id="fw-tipo">
              <label for="rm-tipo">Tipo de Evaluación <b>*</b></label>
              <select class="emo-kair-select" id="rm-tipo" style="width:100%">
                <option value="">Selecciona…</option>
              </select>
              <div class="emo-kair-field__error">Selecciona el tipo de evaluación.</div>
            </div>
            <div class="emo-kair-field" id="fw-ips">
              <label for="rm-ips">IPS que Emite <b>*</b></label>
              <input type="text" class="emo-kair-input" id="rm-ips" list="ips-list" placeholder="Nombre de la IPS" autocomplete="off">
              <datalist id="ips-list">
                <option value="IPS Salud Ocupacional del Caribe"></option>
                <option value="Comfama — Salud Ocupacional"></option>
                <option value="Sura Salud Ocupacional"></option>
              </datalist>
              <div class="emo-kair-field__error">Ingresa la IPS que emitió el certificado.</div>
            </div>
          </div>
          <div class="emo-kair-field__row">
            <div class="emo-kair-field" id="fw-fecha">
              <label for="rm-fecha">Fecha del Examen <b>*</b></label>
              <input type="date" class="emo-kair-input" id="rm-fecha" autocomplete="off">
              <div class="emo-kair-field__error">Selecciona la fecha del examen.</div>
            </div>
            <div class="emo-kair-field" id="fw-vence">
              <label for="rm-vence">Vencimiento <span id="rm-vence-req">(periódicos)</span></label>
              <input type="date" class="emo-kair-input" id="rm-vence" autocomplete="off">
              <div class="emo-kair-field__hint" id="rm-vence-hint">Los periódicos vencen según protocolo (se sugiere +1 año).</div>
              <div class="emo-kair-field__error">Ingresa el vencimiento del certificado periódico.</div>
            </div>
          </div>

          <h3 class="emo-kair-modal__coltitle" style="margin-top:20px">Soporte Documental</h3>
          <div class="emo-kair-field">
            <label>Ruta de archivo</label>
            <div class="emo-kair-routebox">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              <span>3.1.4.1. Certificados de Aptitud Medica/<b id="rm-ruta">sin archivo</b></span>
            </div>
          </div>
          <div class="emo-kair-evlist" id="rm-lista"></div>
          <button class="emo-kair-btn emo-kair-btn--ghost emo-kair-btn--sm" id="rm-agregar" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Adjuntar certificado escaneado
          </button>
        </div>

        
        <div>
          <h3 class="emo-kair-modal__coltitle">Concepto de Aptitud <b style="color:var(--kair-red)">*</b></h3>
          <div class="emo-kair-field" id="fw-concepto">
            <div class="emo-kair-conceptos" id="rm-conceptos"></div>
            <div class="emo-kair-field__error">Selecciona el concepto emitido por la IPS.</div>
          </div>
          <div class="emo-kair-interp emo-is-error" id="rm-interp" aria-live="polite">
            <b>Selecciona el concepto</b> emitido por la IPS para ver la acción de gestión asociada.
          </div>
          <div class="emo-kair-field" style="margin-top:16px" id="fw-recom">
            <label for="rm-recomendaciones" id="rm-recom-label">Recomendaciones al Empleador</label>
            <textarea class="emo-kair-input" id="rm-recomendaciones" placeholder="Ej: uso de lentes filtrantes, pausas activas cada 2 horas, evitar carga manual &gt; 10 kg…"></textarea>
            <div class="emo-kair-field__error">Describe las recomendaciones emitidas por la IPS.</div>
            <div class="emo-kair-field__hint">Obligatorias cuando el concepto es “Apto con Recomendaciones”. Nunca registres diagnósticos clínicos.</div>
          </div>
        </div>
      </div>

      <div class="emo-kair-modal__foot">
        <button class="emo-kair-btn emo-kair-btn--ghost" id="rm-cancelar" type="button">Cancelar</button>
        <button class="emo-kair-btn emo-kair-btn--primary" id="rm-guardar" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
          Guardar y Archivar
        </button>
      </div>
    </div>
  </div>

  
  <div class="emo-kair-overlay" id="overlay-doc">
    <div class="emo-kair-modal emo-kair-modal--sm" role="dialog" aria-modal="true" aria-labelledby="doc-titulo" id="modal-doc">
      <div class="emo-kair-modal__head">
        <div>
          <h2 id="doc-titulo">Documento de Referencia</h2>
          <p>Procedimiento corporativo de exámenes ocupacionales</p>
        </div>
        <button class="emo-kair-iconbtn" id="doc-close" type="button" aria-label="Cerrar ficha del documento">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="emo-kair-modal__body">
        <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Código</span><span class="emo-kair-inforow__v">GI-PR-006</span></div>
        <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Revisión</span><span class="emo-kair-inforow__v">REV.07</span></div>
        <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Fecha de Revisión</span><span class="emo-kair-inforow__v">Abril 30 de 2025</span></div>
        <div class="emo-kair-inforow"><span class="emo-kair-inforow__k">Proceso</span><span class="emo-kair-inforow__v">Gestión Gerencial</span></div>
        <div style="margin-top:14px">
          <div style="font-size:12.5px;font-weight:600;color:var(--kair-text-2);margin-bottom:6px">Objeto</div>
          <div class="emo-kair-obsbox">Garantizar que las condiciones de salud de los trabajadores sean aptas para desarrollar sus labores de manera segura y prevenir el deterioro de su salud, de acuerdo con los requisitos establecidos en la Resolución 1843 de 2025.</div>
        </div>
        <div style="margin-top:14px">
          <div style="font-size:12.5px;font-weight:600;color:var(--kair-text-2);margin-bottom:6px">Alcance · Exámenes ocupacionales</div>
          <div class="emo-kair-obsbox">Preingreso · Ingreso · Periódicos · Cambio de ocupación · Post-incapacidad · Retorno al trabajo · Seguimiento</div>
        </div>
        <div class="emo-kair-note" style="margin-top:14px">
          <b>Integración:</b> la apertura del documento original (.docx) se realizará con el visor de Electron al conectar el contrato IPC (Fase 0).
        </div>
      </div>
      <div class="emo-kair-modal__foot">
        <button class="emo-kair-btn emo-kair-btn--primary" id="doc-cerrar" type="button">Cerrar</button>
      </div>
    </div>
  </div>

  
  <div class="emo-kair-toasts" id="toasts" aria-live="polite"></div>`;

  function marcadoVista() {
    return MARKUP_RAW || '<div class="emo-kair-inlineempty">Falta el marcado del módulo.</div>';
  }

  /* ══════════════ API PÚBLICA DEL COMPONENTE ══════════════ */
  function EvaluacionesMedicasView(container, companyName, moduleName, submoduleName, backToModuleCallback) {
    containerRef = container;
    backCallback = backToModuleCallback;
    empresaId = companyName || getEmpresaId();
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.submoduleName = submoduleName;
  }

  EvaluacionesMedicasView.prototype.render = async function () {
    var host = this.container;
    if (!host) { klog('MODULO', 'INIT', 'ERR', 'sin contenedor'); return; }

    /* El marcado se inyecta: el componente corre en el documento principal, no dentro
       de un iframe, así que su HTML nunca se carga solo. */
    host.innerHTML = '';
    marcadoRaiz = document.createElement('div');
    marcadoRaiz.className = 'emo-scope';
    marcadoRaiz.id = 'emo-root';
    marcadoRaiz.innerHTML = marcadoVista();
    host.appendChild(marcadoRaiz);

    /* Las búsquedas quedan dentro del componente. Respaldo por id para los nodos que
       se mudan al <body>. */
    $ = function (sel) {
      var n = marcadoRaiz.querySelector(sel);
      if (n) return n;
      if (sel.charAt(0) === '#') return document.getElementById(sel.slice(1));
      return null;
    };
    $all = function (sel) {
      var dentro = Array.prototype.slice.call(marcadoRaiz.querySelectorAll(sel));
      if (dentro.length) return dentro;
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    };

    /* Los modales, el cajón y los avisos se mudan al <body>: son `position: fixed` y
       dentro de un contenedor con flex/transform `fixed` se comporta como `absolute`.
       Conservan la clase del módulo para no perder los estilos. */
    Array.prototype.forEach.call(
      marcadoRaiz.querySelectorAll('.emo-overlay, .emo-drawer, .emo-backdrop, .emo-toasts'),
      function (n) { n.classList.add('emo-scope'); document.body.appendChild(n); }
    );

    var faltantes = [];
    var on = function (sel, evento, fn) {
      var n = $(sel);
      if (!n) { faltantes.push(sel); return; }
      n.addEventListener(evento, fn);
    };

    /* Encabezado y navegación */
    on('#btn-nuevo', 'click', function () { abrirFormulario('nueva', null); });
    on('#btn-exportar', 'click', exportarCSV);
    on('#btn-marco', 'click', abrirMarco);
    on('#tab-resumen', 'click', function () { irA('resumen'); });
    on('#tab-certificados', 'click', function () { irA('certificados'); });
    on('#btn-volver-panel', 'click', function () {
      if (typeof backCallback === 'function') backCallback();
      else toast('No se pudo volver: falta el enlace con el panel del módulo.', 'err');
    });
    on('#btn-volver-lista', 'click', function () { irA('certificados'); });
    on('#btn-ver-todos', 'click', function () {
      S.tipo = 'todos'; S.estado = 'todos'; S.busqueda = ''; S.pagina = 1;
      var b = $('#f-buscar'); if (b) b.value = '';
      var te = $('#f-tipo'); if (te) te.value = 'todos';
      var es = $('#f-estado'); if (es) es.value = 'todos';
      irA('certificados');
      renderTabla();
    });
    on('#btn-ver-vencidos', 'click', function () {
      S.estado = 'vencido'; S.pagina = 1;
      var es = $('#f-estado'); if (es) es.value = 'vencido';
      irA('certificados'); renderTabla();
    });
    on('#btn-ver-porvencer', 'click', function () {
      S.estado = 'por-vencer'; S.pagina = 1;
      var es = $('#f-estado'); if (es) es.value = 'por-vencer';
      irA('certificados'); renderTabla();
    });

    /* Detalle: editar y renovar toman el certificado más reciente del trabajador */
    on('#btn-editar-detalle', 'click', function () {
      var c = certificadoDeCedula(S.cedulaDetalle);
      if (c) abrirFormulario('editar', c.id);
    });
    on('#btn-renovar-detalle', 'click', function () {
      var c = certificadoDeCedula(S.cedulaDetalle);
      if (c) abrirFormulario('renovar', c.id);
    });

    /* Filtros */
    on('#f-buscar', 'input', function () { S.busqueda = this.value; S.pagina = 1; renderTabla(); });
    on('#f-tipo', 'change', function () { S.tipo = this.value; S.pagina = 1; renderTabla(); });
    on('#f-estado', 'change', function () { S.estado = this.value; S.pagina = 1; renderTabla(); });
    on('#f-limpiar', 'click', function () {
      S.busqueda = ''; S.tipo = 'todos'; S.estado = 'todos'; S.pagina = 1;
      var b = $('#f-buscar'); if (b) b.value = '';
      var te = $('#f-tipo'); if (te) te.value = 'todos';
      var es = $('#f-estado'); if (es) es.value = 'todos';
      renderTabla();
    });

    /* Marco normativo y documento de referencia */
    on('#marco-close', 'click', cerrarMarco);
    on('#marco-imprimir', 'click', imprimirMarco);
    on('#marco-copiar', 'click', copiarMarco);
    on('#doc-close', 'click', cerrarDocumento);
    on('#doc-cerrar', 'click', cerrarDocumento);
    on('#tile-doc', 'click', abrirDocumento);
    on('#tile-carpeta', 'click', function () {
      if (S.documentos.length && S.documentos[0].path) abrirRuta(S.documentos[0].path);
      else toast('Todavía no hay archivos en la carpeta del módulo.', 'info');
    });

    /* Formulario */
    on('#modal-close', 'click', function () { cerrarOverlay('modal-cert'); });
    on('#rm-cancelar', 'click', function () { cerrarOverlay('modal-cert'); });
    on('#rm-guardar', 'click', guardarFormulario);
    on('#rm-agregar', 'click', adjuntarCertificado);
    on('#rm-tipo', 'change', function () { actualizarVencimiento(); validarFormulario(); });
    on('#rm-fecha', 'change', function () {
      var v = $('#rm-vence');
      if (v && tipoVence((($('#rm-tipo') || {}).value || '')) && !v.value) v.value = sumaAnio(this.value);
      /* 📦767 — la pista de archivo sigue el año de la fecha elegida */
      var r = $('#rm-ruta');
      if (r && !S.archivoFormulario) {
        r.textContent = 'carpeta ' + (this.value || '').slice(0, 4);
      }
      validarFormulario();
    });
    ['#rm-nombre', '#rm-cedula', '#rm-cargo', '#rm-area', '#rm-ips', '#rm-recomendaciones', '#rm-vence']
      .forEach(function (sel) {
        on(sel, 'input', validarFormulario);
        on(sel, 'change', validarFormulario);
      });

    /* Opciones de los selectores */
    var selTipo = $('#rm-tipo'); if (selTipo) selTipo.innerHTML = opcionesTipo('');
    var filtroTipo = $('#f-tipo');
    if (filtroTipo) {
      filtroTipo.innerHTML = '<option value="todos">Tipo · Todos</option>' + TIPOS.map(function (t) {
        return '<option value="' + escapeHtml(t.nombre) + '">' + escapeHtml(t.nombre) + '</option>';
      }).join('');
    }
    var filtroEstado = $('#f-estado');
    if (filtroEstado) {
      filtroEstado.innerHTML = '<option value="todos">Estado · Todos</option>' +
        '<option value="vigente">Vigente</option><option value="por-vencer">Por vencer</option>' +
        '<option value="vencido">Vencido</option><option value="recomendaciones">Con recomendaciones</option>' +
        '<option value="aplazado">Aplazado</option><option value="no-apto">No apto</option>';
    }

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    this._onClick = onClick;
    this._onKeydown = onKeydown;

    await cargarCertificados();
    await cargarDocumentosReferencia();
    renderTodo();
    irA('resumen');
    if (faltantes.length) klog('MODULO', 'BIND', 'ERR', 'sin encontrar: ' + faltantes.join(', '));
    klog('MODULO', 'INIT', 'OK', 'empresa=' + empresaId + ' · certificados=' + S.certificados.length);
  };

  EvaluacionesMedicasView.prototype.destroy = function () {
    if (this._onClick) document.removeEventListener('click', this._onClick);
    if (this._onKeydown) document.removeEventListener('keydown', this._onKeydown);
    ['modal-cert', 'modal-doc', 'overlay-doc', 'overlay-modal', 'drawer-marco', 'backdrop-marco', 'toasts']
      .forEach(function (id) {
        var n = document.getElementById(id);
        if (n && n.parentNode) n.parentNode.removeChild(n);
      });
    marcadoRaiz = null;
    containerRef = null;
    pila = [];
    klog('MODULO', 'DESTROY', 'OK');
  };

  window.EvaluacionesMedicasView = EvaluacionesMedicasView;
  // Alias con el nombre viejo: `renderer.js` y el portal lo buscan así.
  window.EvaluacionesMedicasComponent = EvaluacionesMedicasView;
})();
