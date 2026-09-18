/* ============================================================
   K+AIR · Evaluación y Selección de Proveedores y Contratistas
   (submódulo 2.10.1) — lógica premium v2
   ============================================================
   Rediseño premium v2 (📦770) sobre el prototipo
   `previews/_proto-2.9.2-evaluacion-seleccion.html`.

   DE DÓNDE SALE LA PANTALLA
   El prototipo llegó como documento HTML completo. Este componente recibe un
   contenedor del documento principal e INYECTA su marcado (igual que EMO 📦762).
   NO se monta por iframe.

   POR QUÉ TODAS LAS CLASES LLEVAN PREFIJO evs-
   El prototipo reusaba nombres que ya existen en la app y en Bootstrap
   (badge/card/toast/overlay — choque documentado en 📦761). La hoja lleva TODOS
   los selectores bajo .evs-scope y las reglas de etiqueta también (si no, le
   cambiaría el body a toda la aplicación).

   DATOS — TODO CONTRA LOS SERVICIOS REALES (sin datos de ejemplo):
     · window.AsociadosServiceES.getAll/create/update
     · window.EvaluacionesServiceES.getSelectionEvals/getReevaluations/
       createSelectionEval/createReevaluation
     · window.NoConformidadesServiceES.getAll/create/updateEstado
   Los servicios persisten solos (backend IPC con localStorage de respaldo).
   Mapeo de nombres: razonSocial→nombre, producto→objeto,
   tipo PROVEEDOR/CONTRATISTA→Proveedor/Contratista, criterios→scores,
   fechaDeteccion ISO→dd/mm/aaaa.
   ============================================================ */
(function () {
  'use strict';

  var TAG = 'K+AIREVS';
  function klog(modulo, accion, status, extra) {
    var linea = '[' + TAG + '][' + modulo + '][' + accion + '][' + status + ']' + (extra ? ' ' + extra : '');
    if (status === 'ERR') console.warn(linea); else console.log(linea);
  }

  /* Marcador global del nodo raíz inyectado (lo usan $, $$ y el ESC) */
  var marcadoRaiz = null;
  var backCb = null;

  /* ══════════════ Lógica pura + catálogos (del prototipo) ══════════════ */
/*__PURE_START__*/
var ASOCIADOS = [];

/* Matriz de Selección — 6 criterios (Promedio por Criterio de Selección) */
var CRIT_SEL = [
  { id:'precio',         nombre:'Precio',         p1:'Precios por encima del mercado',   p3:'Precios competitivos',    p5:'Mejores precios del mercado' },
  { id:'disponibilidad', nombre:'Disponibilidad', p1:'No tiene stock disponible',        p3:'Disponibilidad parcial',  p5:'Disponibilidad inmediata' },
  { id:'experiencia',    nombre:'Experiencia',    p1:'Sin experiencia acreditada',       p3:'Experiencia limitada',    p5:'Amplia experiencia acreditada' },
  { id:'calidad',        nombre:'Calidad',        p1:'No cumple estándares',             p3:'Problemas parciales',     p5:'Sin problemas' },
  { id:'marca',          nombre:'Marca',          p1:'Marcas sin reconocimiento',        p3:'Marcas reconocidas',      p5:'Marcas líderes del mercado' },
  { id:'reqLegales',     nombre:'Req. Legales',   p1:'Documentación legal incompleta',   p3:'Documentación con rezagos', p5:'Cumplimiento legal al día' }
];

/* Matriz de Reevaluación Anual — criterios literales de la captura (fila 4 y 5-6 completados de forma coherente) */
var CRIT_REE = [
  { id:'calidad',     nombre:'Calidad',                p1:'No cumple estándares',                    p3:'Problemas parciales',       p5:'Sin problemas' },
  { id:'tiempo',      nombre:'Tiempo de entrega',      p1:'Mayor a 4 días',                          p3:'1-2 días después',          p5:'En tiempo' },
  { id:'cantidades',  nombre:'Cantidades pactadas',    p1:'No cumple',                               p3:'Parcial con justificación', p5:'Cumple' },
  { id:'facturacion', nombre:'Calidad de facturación', p1:'No aceptan devoluciones ni correcciones', p3:'Con errores reparables',    p5:'Facturación sin errores' },
  { id:'precio',      nombre:'Precio',                 p1:'Muy por encima del mercado',              p3:'Ajustado al mercado',       p5:'Mejores precios del mercado' },
  { id:'normativo',   nombre:'Cumplimiento normativo', p1:'Sin certificados ni soporte',             p3:'Cumple con rezagos',        p5:'Cumple y documenta todo' }
];

/* Evaluaciones literales 18/09/2026 en el orden exacto de la captura — puntajes verificados:
   E1 22/6=3.67 Bueno · E2 14/6=2.33 Deficiente · E3 26/6=4.33 Bueno · E4 26/6=4.33 Bueno (→ Mantuvo) */
var EVALUACIONES = [];

/* No conformidades literales de la captura */
var NCS = [];

function puntajeEval(ev){
  var t = 0, n = 0, k;
  for (k in ev.scores){ if (ev.scores[k] != null){ t += ev.scores[k]; n++; } }
  return n ? t / n : 0;
}
function clasifDe(p){ return p >= 3.1 ? 'Bueno' : (p >= 2.6 ? 'Regular' : 'Deficiente'); }
function fmt2(x){ return x.toFixed(2); }
function fmt1(x){ return x.toFixed(1); }
function pctRound(part, total){ return total ? Math.round(part / total * 100) : 0; }
function criterioColor(p){ return p >= 4.1 ? 'green' : (p >= 2.6 ? 'amber' : 'red'); }

function estadoAsociado(asociadoId, evaluaciones){
  var last = null, i;
  for (i = 0; i < evaluaciones.length; i++){
    if (evaluaciones[i].asociadoId === asociadoId) last = evaluaciones[i];
  }
  if (!last) return { estado:'Sin evaluar', clasif:null };
  var c = clasifDe(puntajeEval(last));
  return { estado: c === 'Deficiente' ? 'Rechazado' : 'Aprobado', clasif:c };
}
function promsSeleccion(evaluaciones){
  var sel = evaluaciones.filter(function(e){ return e.clase === 'Selección'; });
  var out = {};
  CRIT_SEL.forEach(function(c){
    var t = 0, n = 0;
    sel.forEach(function(e){ if (e.scores[c.id] != null){ t += e.scores[c.id]; n++; } });
    out[c.id] = n ? t / n : 0;
  });
  return out;
}
function distribucionEvaluaciones(evaluaciones){
  var d = { Bueno:0, Regular:0, Deficiente:0 };
  evaluaciones.forEach(function(e){ d[clasifDe(puntajeEval(e))]++; });
  return d;
}
function ultimaEvalDe(asociadoId, evaluaciones){
  var last = null;
  evaluaciones.forEach(function(e){ if (e.asociadoId === asociadoId) last = e; });
  return last;
}
function evalDeClase(asociadoId, clase, evaluaciones){
  var last = null;
  evaluaciones.forEach(function(e){ if (e.asociadoId === asociadoId && e.clase === clase) last = e; });
  return last;
}
function tendenciaDeEv(ev, evaluaciones){
  if (!ev || ev.clase !== 'Reevaluación') return { txt:'—', cls:'mut' };
  var idx = evaluaciones.indexOf(ev), prev = null, i;
  for (i = idx - 1; i >= 0; i--){
    if (evaluaciones[i].asociadoId === ev.asociadoId){ prev = evaluaciones[i]; break; }
  }
  if (!prev) return { txt:'—', cls:'mut' };
  var p1 = puntajeEval(ev), p0 = puntajeEval(prev);
  if (p1 > p0 + 0.005) return { txt:'↑ Mejoró', cls:'up' };
  if (p1 < p0 - 0.005) return { txt:'↓ Bajó', cls:'down' };
  return { txt:'→ Mantuvo', cls:'same' };
}
function tendenciaDe(asociadoId, evaluaciones){
  var rees = evaluaciones.filter(function(e){ return e.asociadoId === asociadoId && e.clase === 'Reevaluación'; });
  if (!rees.length) return { txt:'—', cls:'mut' };
  return tendenciaDeEv(rees[rees.length - 1], evaluaciones);
}
function resumenAsociados(asociados, evaluaciones){
  /* fila por asociado: selección, reevaluación, tendencia, clasificación (última eval) */
  return asociados.map(function(a){
    var sel = evalDeClase(a.id, 'Selección', evaluaciones);
    var ree = evalDeClase(a.id, 'Reevaluación', evaluaciones);
    var ult = ultimaEvalDe(a.id, evaluaciones);
    return {
      asociado:a,
      selPct: sel ? puntajeEval(sel) : null,
      reePct: ree ? puntajeEval(ree) : null,
      ultPct: ult ? puntajeEval(ult) : null,
      fecha: ult ? ult.fecha : null,
      clasif: ult ? clasifDe(puntajeEval(ult)) : null,
      tendencia: tendenciaDe(a.id, evaluaciones)
    };
  });
}
function kpis(asociados, evaluaciones, ncs, ahora){
  var pendientes = 0;
  asociados.forEach(function(a){
    var tiene = evaluaciones.some(function(e){ return e.asociadoId === a.id && e.clase === 'Selección'; });
    if (!tiene) pendientes++;
  });
  var mes = ahora ? (ahora.getMonth() + 1) + '/' + ahora.getFullYear() : null;
  var reesMes = 0;
  evaluaciones.forEach(function(e){
    if (e.clase !== 'Reevaluación' || !mes) return;
    var p = e.fecha.split('/'); /* dd/mm/yyyy */
    if (p.length === 3 && parseInt(p[1], 10) + '/' + parseInt(p[2], 10) === mes) reesMes++;
  });
  var ncActivas = ncs.filter(function(n){ return n.estado === 'Abierta' || n.estado === 'En seguimiento'; }).length;
  return { asociados:asociados.length, pendientes:pendientes, reevaluacionesMes:reesMes, ncActivas:ncActivas };
}
/*__PURE_END__*/

  /* ─── Fecha ISO → dd/mm/aaaa (el prototipo muestra dd/mm/aaaa y los
     servicios guardan ISO) ─── */
  function isoADDMMAAAA(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
  }
  function estadoNCLocal(e) {
    e = String(e || '').toUpperCase();
    if (e === 'CERRADA') return 'Cerrada';
    if (e.indexOf('SEGUI') !== -1) return 'En seguimiento';
    return 'Abierta';
  }
  function svcSeguro(nombre) {
    try { return window[nombre] || null; } catch (e) { return null; }
  }
  /* Vuelca los servicios reales en los arreglos que consume la UI.
     Mapeo de nombres: razonSocial→nombre, producto→objeto,
     tipo PROVEEDOR/CONTRATISTA→Proveedor/Contratista, criterios→scores. */
  function volcarServiciosALocal() {
    ASOCIADOS = []; EVALUACIONES = []; NCS = [];
    var as = svcSeguro('AsociadosServiceES');
    if (as && as.getAll) {
      (as.getAll() || []).forEach(function (a) {
        ASOCIADOS.push({
          id: a.id,
          nombre: a.razonSocial || a.nombre || '—',
          nit: a.nit || '',
          tipo: (a.tipo === 'CONTRATISTA' || a.tipo === 'Contratista') ? 'Contratista' : 'Proveedor',
          objeto: a.producto || a.objeto || ''
        });
      });
    }
    var ev = svcSeguro('EvaluacionesServiceES');
    if (ev) {
      if (ev.getSelectionEvals) (ev.getSelectionEvals() || []).forEach(function (e) {
        EVALUACIONES.push({ id: e.id, asociadoId: e.asociadoId, clase: 'Selección',
          fecha: isoADDMMAAAA(e.fecha), scores: e.criterios || {} });
      });
      if (ev.getReevaluations) (ev.getReevaluations() || []).forEach(function (e) {
        EVALUACIONES.push({ id: e.id, asociadoId: e.asociadoId, clase: 'Reevaluación',
          fecha: isoADDMMAAAA(e.fecha), scores: e.criterios || {} });
      });
    }
    var nc = svcSeguro('NoConformidadesServiceES');
    if (nc && nc.getAll) {
      (nc.getAll() || []).forEach(function (n) {
        NCS.push({
          id: n.id, no: 0,
          fecha: isoADDMMAAAA(n.fechaDeteccion || n.fecha),
          asociadoId: n.asociadoId,
          descripcion: n.descripcion || '',
          estado: estadoNCLocal(n.estado),
          responsable: n.responsableSeguimiento || n.responsable || ''
        });
      });
      NCS.sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); });
      NCS.forEach(function (n, i) { n.no = i + 1; });
    }
  }

  /* ══════════════ Componente ══════════════ */
  function EvaluacionSeleccionComponent(container, moduleName, submoduleTitle, backToModuleCallback, currentCompany) {
    this.container = container;
    this.moduleName = moduleName;
    this.submoduleTitle = submoduleTitle;
    backCb = backToModuleCallback;
    this.companyName = currentCompany || window.currentCompany || '';
  }

  EvaluacionSeleccionComponent.prototype.render = async function () {
    var host = this.container;
    if (!host) { klog('MODULO', 'INIT', 'ERR', 'sin contenedor'); return; }

    host.innerHTML = '';
    marcadoRaiz = document.createElement('div');
    marcadoRaiz.className = 'evs-scope';
    marcadoRaiz.id = 'evs-root';
    marcadoRaiz.innerHTML = MARKUP_RAW;
    host.appendChild(marcadoRaiz);

    /* Overlays y avisos: position:fixed → se mudan al body (dentro de un
       contenedor con transform se comportan como absolute). */
    Array.prototype.forEach.call(
      marcadoRaiz.querySelectorAll('.evs-overlay, .evs-toasts'),
      function (n) { n.classList.add('evs-scope'); document.body.appendChild(n); }
    );

    iniciarInterfaz();
    klog('MODULO', 'INIT', 'OK', '2.10.1 premium v2');
  };

  /* ══════════════ Interfaz (capa DOM del prototipo, adaptada) ══════════════ */
  function iniciarInterfaz() {
  /* ─── Carga inicial: los servicios con backend resuelven async (el primer
     getAll devuelve [] y llena su cache cuando la promesa resuelve). Por eso
     se vuelca dos veces: al arranque y de nuevo pasados ~450 ms. ─── */
  function cargarDatosIniciales() {
    try { var s1 = svcSeguro('AsociadosServiceES'); if (s1 && s1.getAll) s1.getAll(); } catch (e) {}
    try { var s2 = svcSeguro('EvaluacionesServiceES'); if (s2) { s2.getSelectionEvals(); s2.getReevaluations(); } } catch (e) {}
    try { var s3 = svcSeguro('NoConformidadesServiceES'); if (s3 && s3.getAll) s3.getAll(); } catch (e) {}
    volcarServiciosALocal();
    renderAll();
    setTab('dash');
    setTimeout(function () {
      volcarServiciosALocal();
      renderAll();
    }, 450);
  }



/* ═══════════════════════════════════════════════════════════════
   LÓGICA DE UI (DOM) — máquina de vistas + renders
   ═══════════════════════════════════════════════════════════════ */
var $ = function(s){
    var n = marcadoRaiz.querySelector(s);
    if (n) return n;
    /* Los overlays se mudan al <body>: el id en el selector YA lleva el
       prefijo (el paso 4b prefijó todos), se busca tal cual. */
    if (s.charAt(0) === '#') return document.getElementById(s.slice(1));
    return null;
  };
var $$ = function(s){
    if (s === '.evs-overlay') return Array.prototype.slice.call(document.querySelectorAll('.evs-overlay'));
    return Array.prototype.slice.call(marcadoRaiz.querySelectorAll(s));
  };
function PV_LOG(mod, acc, st, extra){
  console.log('[K+AIRPROV][' + mod + '][' + acc + '][' + st + ']' + (extra ? ' ' + extra : ''));
}
function esc(s){
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Iconos ─── */
var ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
var ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
var ICON_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.7-3.4 3.4-5.3 7-5.3s6.3 1.9 7 5.3"/></svg>';
var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>';
var ICON_ERR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>';
var ICON_INFO2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>';
var ICON_DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></svg>';
var ICON_FLAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4c4-2 7 2 11 0v9c-4 2-7-2-11 0"/></svg>';

/* ─── Toasts ─── */
function toast(msg, kind, ms){
  var box = $('#evs-toasts');
  var el = document.createElement('div');
  el.className = 'evs-toast evs-toast--' + (kind || 'info');
  el.innerHTML = (kind === 'ok' ? ICON_OK : kind === 'err' ? ICON_ERR : ICON_INFO2) + '<span>' + esc(msg) + '</span>';
  box.appendChild(el);
  setTimeout(function(){
    el.classList.add('evs-out');
    setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  }, ms || 3200);
}

/* ─── Estado ─── */
var state = {
  tab:'dash',
  evalSel:null, reeSel:null,
  evalScores:{}, reeScores:{},
  regQ:'', regTipo:'Todos',
  ncQ:'', ncFiltro:'Todas',
  repTipo:'Todos', repCls:'Todas', repDesde:'', repHasta:'',
  editAsocId:null,
  alertDismissed:false
};

function hoyDDMMAAAA(){
  var d = new Date();
  return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
}
function hoyISO(){
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function asocPorId(id){
  var out = null;
  ASOCIADOS.forEach(function(a){ if (a.id === id) out = a; });
  return out;
}
function asocNombre(id){
  var a = asocPorId(id);
  return a ? a.nombre : '—';
}
function badgeClasif(c){
  if (!c) return '<span class="evs-trend evs-trend--mut">—</span>';
  var map = { 'Bueno':'evs-badge--green', 'Regular':'evs-badge--amber', 'Deficiente':'evs-badge--red' };
  return '<span class="evs-badge ' + (map[c] || 'evs-badge--slate') + '">' + esc(c) + '</span>';
}
function badgeClase(e){
  if (!e) return '<span class="evs-trend evs-trend--mut">—</span>';
  var map = { 'Bueno':'evs-badge--green', 'Regular':'evs-badge--amber', 'Deficiente':'evs-badge--red' };
  return '<span class="evs-badge ' + (map[e] || 'evs-badge--slate') + '">' + esc(e) + '</span>';
}
function badgeEstadoNC(e){
  var map = { 'Abierta':'evs-badge--red', 'En seguimiento':'evs-badge--amber', 'Cerrada':'evs-badge--green' };
  return '<span class="evs-badge ' + (map[e] || 'evs-badge--slate') + '"><span class="evs-dot"></span>' + esc(e) + '</span>';
}
function trendHTML(t){
  return '<span class="evs-trend evs-trend--' + t.cls + '">' + esc(t.txt) + '</span>';
}

/* ─── Navegación de vistas ─── */
function setTab(tab){
  state.tab = tab;
  $$('.evs-pv-tab').forEach(function(t){
    var on = t.getAttribute('data-tab') === tab;
    t.classList.toggle('evs-is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('.evs-kair-view').forEach(function(v){ v.classList.add('evs-is-hidden'); });
  $('#evs-view-' + tab).classList.remove('evs-is-hidden');
  $('#evs-btn-reportar-nc').classList.toggle('evs-is-hidden', tab !== 'nc');
  var activa = marcadoRaiz.querySelector('.evs-pv-tab[data-tab="' + tab + '"]');
  if (activa && activa.scrollIntoView){
    try { activa.scrollIntoView({ block:'nearest', inline:'nearest' }); } catch(e){ activa.scrollIntoView(); }
  }
  PV_LOG('NAV', 'TAB', 'OK', tab);
}

/* ─── Recalculo global (KPIs + dashboard + registro + reportes) ─── */
function renderKpis(){
  var k = kpis(ASOCIADOS, EVALUACIONES, NCS, new Date());
  $('#evs-kv-asociados').textContent = k.asociados;
  $('#evs-kv-pendientes').textContent = k.pendientes;
  $('#evs-kv-reevaluaciones').textContent = k.reevaluacionesMes;
  $('#evs-kv-nc').textContent = k.ncActivas;
  PV_LOG('KPI', 'RENDER', 'OK', 'asoc=' + k.asociados + ' pend=' + k.pendientes + ' ree=' + k.reevaluacionesMes + ' nc=' + k.ncActivas);
}
function renderAlerta(){
  var deficientes = [];
  ASOCIADOS.forEach(function(a){
    var st = estadoAsociado(a.id, EVALUACIONES);
    if (st.clasif === 'Deficiente') deficientes.push(a.nombre);
  });
  var box = $('#evs-alert-def');
  if (deficientes.length && !state.alertDismissed){
    $('#evs-alert-def-txt').innerHTML = '<b>' + esc(deficientes[0]) + '</b>' + esc(' — Clasificación DEFICIENTE. Asociado rechazado.');
    box.classList.remove('evs-is-hidden');
    PV_LOG('ALERTA', 'DEFICIENTE', 'OK', deficientes.join(', '));
  } else {
    box.classList.add('evs-is-hidden');
  }
}
function renderDistribucion(){
  var d = distribucionEvaluaciones(EVALUACIONES);
  var total = EVALUACIONES.length;
  var fill = function(el, n){
    var pct = pctRound(n, total);
    var e = $(el);
    e.style.width = pct + '%';
    e.textContent = n > 0 ? n + ' (' + pct + '%)' : '';
  };
  fill('#evs-dist-bueno', d.Bueno);
  fill('#evs-dist-regular', d.Regular);
  fill('#evs-dist-deficiente', d.Deficiente);
  PV_LOG('DASH', 'DISTRIBUCION', 'OK', 'b=' + d.Bueno + ' r=' + d.Regular + ' d=' + d.Deficiente + ' total=' + total);
}
function renderCriteriosBars(containerSel, proms){
  var h = '';
  CRIT_SEL.forEach(function(c){
    var p = proms[c.id] || 0;
    var color = criterioColor(p);
    h += '<div class="evs-crit-row"><span class="evs-crit-k">' + esc(c.nombre) + '</span>' +
      '<div class="evs-crit-track"><div class="evs-crit-fill evs-crit-fill--' + color + '" style="width:' + Math.min(100, p / 5 * 100) + '%">' + fmt1(p) + '</div></div></div>';
  });
  $(containerSel).innerHTML = h;
}
function renderCriterios(){
  renderCriteriosBars('#evs-crit-bars', promsSeleccion(EVALUACIONES));
}
function renderRecientes(){
  var tb = $('#evs-tb-recientes'), h = '';
  EVALUACIONES.forEach(function(e){
    var a = asocPorId(e.asociadoId);
    var p = puntajeEval(e);
    h += '<tr>' +
      '<td class="evs-cell-strong">' + esc(a ? a.nombre : '—') + '</td>' +
      '<td class="evs-cell-mut">' + esc(a ? a.tipo : '—') + '</td>' +
      '<td class="evs-cell-mut">' + esc(e.fecha) + '</td>' +
      '<td class="evs-num evs-pt-val">' + fmt2(p) + '</td>' +
      '<td>' + badgeClasif(clasifDe(p)) + '</td>' +
      '</tr>';
  });
  tb.innerHTML = h;
  $('#evs-chip-recientes').textContent = EVALUACIONES.length + (EVALUACIONES.length === 1 ? ' evaluación' : ' evaluaciones');
}
function renderDashboard(){
  renderKpis();
  renderAlerta();
  renderDistribucion();
  renderCriterios();
  renderRecientes();
}

/* ══════════ RENDER: REGISTRO ══════════ */
function registroFiltrado(){
  var q = state.regQ.toLowerCase();
  return ASOCIADOS.filter(function(a){
    if (state.regTipo !== 'Todos' && a.tipo !== state.regTipo) return false;
    if (!q) return true;
    return (a.nombre + ' ' + a.nit + ' ' + (a.objeto || '')).toLowerCase().indexOf(q) !== -1;
  });
}
function renderRegistro(){
  var rows = registroFiltrado();
  var h = '';
  rows.forEach(function(a){
    var st = estadoAsociado(a.id, EVALUACIONES);
    h += '<tr>' +
      '<td class="evs-cell-strong">' + esc(a.nombre) + '</td>' +
      '<td class="evs-cell-mut" style="font-family:var(--kair-mono);font-size:12.5px">' + esc(a.nit) + '</td>' +
      '<td><span class="evs-badge evs-badge--blue">' + esc(a.tipo) + '</span></td>' +
      '<td class="evs-desc-cell">' + esc(a.objeto || '—') + '</td>' +
      '<td>' + badgeClasif(st.clasif) + '</td>' +
      '<td>' + (st.estado === 'Rechazado'
        ? '<span class="evs-badge evs-badge--red"><span class="evs-dot"></span>Rechazado</span>'
        : st.estado === 'Aprobado'
          ? '<span class="evs-badge evs-badge--green"><span class="evs-dot"></span>Aprobado</span>'
          : '<span class="evs-badge evs-badge--slate">Sin evaluar</span>') + '</td>' +
      '<td><div class="evs-row-actions">' +
        '<button type="button" class="evs-icon-btn" data-edit-asoc="' + a.id + '" aria-label="Editar ' + esc(a.nombre) + '" title="Editar">' + ICON_EDIT + '</button>' +
        '</div></td>' +
      '</tr>';
  });
  $('#evs-tb-registro').innerHTML = h;
  $('#evs-count-registro').textContent = 'Mostrando ' + rows.length + ' de ' + ASOCIADOS.length + ' asociados';
  $('#evs-empty-registro').classList.toggle('evs-is-hidden', rows.length > 0);
  PV_LOG('REG', 'RENDER', 'OK', rows.length + '/' + ASOCIADOS.length);
}

/* ─── Modal Nuevo/Editar Asociado ─── */
function abrirModalAsoc(editId){
  state.editAsocId = editId || null;
  var esEdicion = !!editId;
  $('#evs-m-asoc-t').textContent = esEdicion ? 'Editar Asociado' : 'Nuevo Asociado';
  if (esEdicion){
    var a = asocPorId(editId);
    $('#evs-f-asoc-nombre').value = a.nombre;
    $('#evs-f-asoc-nit').value = a.nit;
    $('#evs-f-asoc-tipo').value = a.tipo;
    $('#evs-f-asoc-objeto').value = a.objeto || '';
  } else {
    $('#evs-f-asoc-nombre').value = '';
    $('#evs-f-asoc-nit').value = '';
    $('#evs-f-asoc-tipo').value = 'Proveedor';
    $('#evs-f-asoc-objeto').value = '';
  }
  validarFormAsoc();
  openOverlay('modal-asoc');
  PV_LOG('REG', 'MODAL_ASOC', 'OK', esEdicion ? 'editar=' + editId : 'nuevo');
}
function validarFormAsoc(){
  var okN = $('#evs-f-asoc-nombre').value.trim().length > 0;
  var okI = $('#evs-f-asoc-nit').value.trim().length > 0;
  $('#evs-ff-asoc-nombre').classList.toggle('evs-is-bad', !okN);
  $('#evs-ff-asoc-nit').classList.toggle('evs-is-bad', !okI);
  $('#evs-f-asoc-nombre').classList.toggle('evs-is-err', !okN);
  $('#evs-f-asoc-nit').classList.toggle('evs-is-err', !okI);
  $('#evs-btn-guardar-asoc').disabled = !(okN && okI);
}
function guardarAsoc(){
  var nombre = $('#evs-f-asoc-nombre').value.trim();
  var nit = $('#evs-f-asoc-nit').value.trim();
  var tipo = $('#evs-f-asoc-tipo').value;
  var objeto = $('#evs-f-asoc-objeto').value.trim();
  if (!nombre || !nit) return;
  if (state.editAsocId){
    var a = asocPorId(state.editAsocId);
    a.nombre = nombre; a.nit = nit; a.tipo = tipo; a.objeto = objeto;
    try { window.AsociadosServiceES.update(a.id, { razonSocial: nombre, nit: nit, tipo: (tipo || '').toUpperCase(), producto: objeto }); } catch (e) { klog('DATOS', 'ASOC_UPDATE', 'ERR', e.message); }
    PV_LOG('REG', 'ASOC_UPDATE', 'OK', a.id);
    toast('Asociado actualizado correctamente.', 'ok');
  } else {
    var nuevo = { id: 'tmp-' + Date.now(), nombre: nombre, nit: nit, tipo: tipo, objeto: objeto };
    try {
      var creado = window.AsociadosServiceES.create({ razonSocial: nombre, nit: nit, tipo: (tipo || '').toUpperCase(), producto: objeto });
      nuevo.id = creado && creado.id ? creado.id : nuevo.id;
    } catch (e) { klog('DATOS', 'ASOC_CREATE', 'ERR', e.message); }
    ASOCIADOS.push(nuevo);
    PV_LOG('REG', 'ASOC_CREATE', 'OK', nuevo.id);
    toast('Asociado registrado correctamente.', 'ok');
  }
  /* PUNTO DE INTEGRACIÓN: window.electronAPI.createAsociado({...}) / updateAsociado({ id, ... }) */
  closeOverlay('modal-asoc');
  renderAll();
}

/* ══════════ MODALES (overlay) ══════════ */
function openOverlay(id){
  if (id.indexOf('evs-') !== 0) id = 'evs-' + id;
  $('#evs-' + id.slice(4)).classList.remove('evs-is-hidden');
  var f = $('#' + id).querySelector('input,select,textarea,button');
  if (f) f.focus();
}
function closeOverlay(id){
  $('#' + id).classList.add('evs-is-hidden');
}
function anyOverlayOpen(){
  return $$('.evs-overlay').filter(function(o){ return !o.classList.contains('evs-is-hidden'); }).length > 0;
}

/* ══════════ RENDER: EVALUACIÓN + REEVALUACIÓN ══════════ */
function poblarSelect(selId, placeholder){
  var sel = $(selId);
  var h = '<option value="">' + placeholder + '</option>';
  ASOCIADOS.forEach(function(a){
    h += '<option value="' + a.id + '">' + esc(a.nombre + ' (' + a.nit + ') — ' + a.tipo) + '</option>';
  });
  sel.innerHTML = h;
}
function asocCardHTML(a){
  if (!a) return '';
  return '<div class="evs-asoc-card">' +
    '<div class="evs-asoc-av">' + ICON_USER + '</div>' +
    '<div class="evs-asoc-body"><div class="evs-asoc-nm">' + esc(a.nombre) + '</div>' +
    '<div class="evs-asoc-meta">' + esc(a.tipo + ' · NIT: ' + a.nit + (a.objeto ? ' · ' + a.objeto : '')) + '</div></div>' +
    '<div class="evs-asoc-side"><span class="evs-badge evs-badge--blue">' + esc(a.tipo) + '</span></div>' +
    '</div>';
}
function historialHTML(asociadoId, conTendencia){
  var evs = EVALUACIONES.filter(function(e){ return e.asociadoId === asociadoId; });
  if (!evs.length){
    return '<div class="evs-empty-block" style="padding:26px 20px"><div class="evs-empty-t">Sin evaluaciones registradas</div>' +
      '<div class="evs-empty-d">Complete la matriz para registrar la primera evaluación.</div></div>';
  }
  var h = '<div class="evs-hist-rows">';
  evs.forEach(function(e){
    var p = puntajeEval(e);
    h += '<div class="evs-hist-row">' +
      '<span class="evs-hist-fech">' + esc(e.fecha) + '</span>' +
      '<span class="evs-hist-clase">' + esc(e.clase) + '</span>' +
      '<span class="evs-hist-pt">' + fmt2(p) + '</span>' +
      badgeClase(clasifDe(p)) +
      '<span class="evs-hist-spacer"></span>' +
      (conTendencia && e.clase === 'Reevaluación' ? trendHTML(tendenciaDeEv(e, EVALUACIONES)) : '') +
      '</div>';
  });
  return h + '</div>';
}
function matrizHTML(criterios, scores, prefijo){
  var h = '<div class="evs-tbl-scroll"><table class="evs-mz-tbl" style="min-width:780px"><thead><tr>' +
    '<th style="width:24%">Criterio</th><th class="evs-ctr">Puntaje 1</th><th class="evs-ctr">Puntaje 3</th><th class="evs-ctr">Puntaje 5</th><th class="evs-ctr" style="width:170px">Seleccionar</th>' +
    '</tr></thead><tbody>';
  criterios.forEach(function(c, i){
    var v = scores[c.id] != null ? scores[c.id] : null;
    h += '<tr>' +
      '<td><div class="evs-mz-crit"><span class="evs-mz-n">' + (i + 1) + '</span><span class="evs-mz-nm">' + esc(c.nombre) + '</span></div></td>' +
      '<td class="evs-ctr evs-mz-desc' + (v === 1 ? '" style="color:var(--kair-text);font-weight:600' : '') + '">' + esc(c.p1) + '</td>' +
      '<td class="evs-ctr evs-mz-desc' + (v === 3 ? '" style="color:var(--kair-text);font-weight:600' : '') + '">' + esc(c.p3) + '</td>' +
      '<td class="evs-ctr evs-mz-desc' + (v === 5 ? '" style="color:var(--kair-text);font-weight:600' : '') + '">' + esc(c.p5) + '</td>' +
      '<td><div class="evs-mz-pick" role="group" aria-label="' + esc(c.nombre) + '">' +
        [1, 3, 5].map(function(n){
          return '<button type="button" class="evs-pv-opt' + (v === n ? ' is-on' : '') + '" data-mz="' + prefijo + '" data-crit="' + c.id + '" data-val="' + n + '" aria-pressed="' + (v === n ? 'true' : 'false') + '" aria-label="' + esc(c.nombre) + ': ' + n + '">' + n + '</button>';
        }).join('') +
      '</div></td>' +
      '</tr>';
  });
  return h + '</tbody></table></div>';
}
function matrizLegendHTML(){
  return '<div class="evs-legend-chips">' +
    '<span class="evs-lg-chip evs-lg-chip--green"><span class="evs-dot"></span>Bueno (3.1 - 5.0)</span>' +
    '<span class="evs-lg-chip evs-lg-chip--amber"><span class="evs-dot"></span>Regular (2.6 - 3.0)</span>' +
    '<span class="evs-lg-chip evs-lg-chip--red"><span class="evs-dot"></span>Deficiente (1.0 - 2.5)</span>' +
    '</div>';
}
function matrizFootHTML(prefijo, ctaTxt){
  return '<div class="evs-mz-foot">' +
    '<span class="evs-mz-score">Puntaje: <b id="' + prefijo + '-puntaje">—</b></span>' +
    '<span id="' + prefijo + '-clasif">' + '<span class="evs-trend evs-trend--mut">—</span>' + '</span>' +
    '<span class="evs-spacer"></span>' +
    '<button type="button" class="evs-btn evs-btn-primary" id="btn-' + prefijo + '-reg" disabled>' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' +
    ctaTxt + '</button>' +
    '</div>';
}
function bodyEvaluacionHTML(a, criterios, scores, prefijo, ctaTxt, tituloMatriz){
  if (!a){
    return '<div class="evs-card"><div class="evs-empty-block">' +
      '<div class="evs-empty-ico">' + ICON_USER + '</div>' +
      '<div class="evs-empty-t">Seleccione un asociado para comenzar</div>' +
      '<div class="evs-empty-d">Elija un asociado en el selector superior para cargar su historial y completar la matriz.</div>' +
      '</div></div>';
  }
  return asocCardHTML(a) +
    '<div class="evs-card" style="margin-bottom:16px">' +
    '<div class="evs-card-h"><h2 class="evs-card-t">Historial de Evaluaciones</h2><span class="evs-chip evs-chip--slate">' + EVALUACIONES.filter(function(e){ return e.asociadoId === a.id; }).length + '</span></div>' +
    historialHTML(a.id, prefijo === 'ree') +
    '</div>' +
    '<div class="evs-card">' +
    '<div class="evs-card-h"><h2 class="evs-card-t">' + esc(tituloMatriz) + '</h2></div>' +
    matrizLegendHTML() +
    matrizHTML(criterios, scores, prefijo) +
    matrizFootHTML(prefijo, ctaTxt) +
    '</div>';
}
function renderEval(){
  poblarSelect('#evs-sel-eval', 'Seleccione…');
  if (state.evalSel && !asocPorId(state.evalSel)) state.evalSel = null;
  $('#evs-sel-eval').value = state.evalSel || '';
  var a = state.evalSel ? asocPorId(state.evalSel) : null;
  $('#evs-eval-body').innerHTML = bodyEvaluacionHTML(a, CRIT_SEL, state.evalScores, 'eval', 'Registrar Evaluación', 'Matriz de Selección');
  if (a) refrescarMatrizFoot('eval', CRIT_SEL, state.evalScores);
}
function renderRee(){
  poblarSelect('#evs-sel-ree', 'Seleccione…');
  if (state.reeSel && !asocPorId(state.reeSel)) state.reeSel = null;
  $('#evs-sel-ree').value = state.reeSel || '';
  var a = state.reeSel ? asocPorId(state.reeSel) : null;
  $('#evs-ree-body').innerHTML = bodyEvaluacionHTML(a, CRIT_REE, state.reeScores, 'ree', 'Registrar Reevaluación', 'Matriz de Reevaluación Anual');
  if (a) refrescarMatrizFoot('ree', CRIT_REE, state.reeScores);
}
function refrescarMatrizFoot(prefijo, criterios, scores){
  var done = criterios.every(function(c){ return scores[c.id] != null; });
  var btn = $('#evs-btn-' + prefijo + '-reg');
  if (done){
    var temp = { scores:scores };
    var p = puntajeEval(temp);
    $('#' + prefijo + '-puntaje').textContent = fmt2(p);
    $('#' + prefijo + '-clasif').innerHTML = badgeClasif(clasifDe(p));
    btn.disabled = false;
  } else {
    $('#' + prefijo + '-puntaje').textContent = '—';
    $('#' + prefijo + '-clasif').innerHTML = '<span class="evs-trend evs-trend--mut">—</span>';
    btn.disabled = true;
  }
}
function pickMatriz(prefijo, critId, val, criterios, scores){
  if (scores[critId] === val){ delete scores[critId]; }
  else { scores[critId] = val; }
  $$('[data-mz="' + prefijo + '"]').forEach(function(b){
    var c = b.getAttribute('data-crit'), v = parseInt(b.getAttribute('data-val'), 10);
    var on = scores[c] === v;
    b.classList.toggle('evs-is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  PV_LOG('MATRIZ', 'PICK', 'OK', prefijo + ' ' + critId + '=' + val);
  refrescarMatrizFoot(prefijo, criterios, scores);
}
function registrarEvaluacion(clase){
  var prefijo = clase === 'Selección' ? 'eval' : 'ree';
  var asociadoId = clase === 'Selección' ? state.evalSel : state.reeSel;
  var criterios = clase === 'Selección' ? CRIT_SEL : CRIT_REE;
  var scores = clase === 'Selección' ? state.evalScores : state.reeScores;
  var a = asocPorId(asociadoId);
  if (!a) return;
  var btn = $('#evs-btn-' + prefijo + '-reg');
  btn.disabled = true;
  btn.innerHTML = '<svg class="evs-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg> Registrando…';
  setTimeout(function(){
    var ev = { id: 'tmp-' + Date.now(), asociadoId: asociadoId, clase: clase, fecha: hoyDDMMAAAA(), scores: JSON.parse(JSON.stringify(scores)) };
    try {
      var srv = window.EvaluacionesServiceES;
      var creada = clase === 'Selección'
        ? srv.createSelectionEval({ asociadoId: asociadoId, criterios: JSON.parse(JSON.stringify(scores)), observaciones: '' })
        : srv.createReevaluation({ asociadoId: asociadoId, criterios: JSON.parse(JSON.stringify(scores)), observaciones: '' });
      if (creada && creada.id) ev.id = creada.id;
      if (creada && creada.fecha) ev.fecha = isoADDMMAAAA(creada.fecha);
    } catch (e) { klog('DATOS', 'EVAL_CREATE', 'ERR', e.message); }
    EVALUACIONES.push(ev);
    /* PUNTO DE INTEGRACIÓN: window.electronAPI.registrarEvaluacion({ asociadoId, clase, scores }) */
    var p = puntajeEval(ev);
    PV_LOG(clase === 'Selección' ? 'EVAL' : 'REE', 'REGISTRAR', 'OK', ev.id + ' ' + a.nombre + ' puntaje=' + fmt2(p) + ' clasif=' + clasifDe(p));
    if (clase === 'Selección'){ state.evalScores = {}; } else { state.reeScores = {}; }
    toast((clase === 'Selección' ? 'Evaluación' : 'Reevaluación') + ' registrada correctamente.', 'ok');
    renderAll();
  }, 900);
}

/* ══════════ RENDER: NO CONFORMIDADES ══════════ */
function ncFiltradas(){
  var q = state.ncQ.toLowerCase();
  return NCS.filter(function(n){
    if (state.ncFiltro === 'Abiertas' && n.estado !== 'Abierta') return false;
    if (state.ncFiltro === 'En seguimiento' && n.estado !== 'En seguimiento') return false;
    if (state.ncFiltro === 'Cerradas' && n.estado !== 'Cerrada') return false;
    if (!q) return true;
    return (asocNombre(n.asociadoId) + ' ' + n.descripcion + ' ' + n.responsable).toLowerCase().indexOf(q) !== -1;
  });
}
function renderNC(){
  var rows = ncFiltradas();
  var h = '';
  rows.forEach(function(n){
    var accion;
    if (n.estado === 'Abierta'){
      accion = '<button type="button" class="evs-btn evs-btn-amber" data-nc-seg="' + n.id + '">Iniciar seguimiento</button>';
    } else if (n.estado === 'En seguimiento'){
      accion = '<button type="button" class="evs-btn evs-btn-green" data-nc-cerrar="' + n.id + '">Cerrar NC</button>';
    } else {
      accion = '<span class="evs-trend evs-trend--mut">Cerrada</span>';
    }
    h += '<tr>' +
      '<td class="evs-cell-mut">' + n.no + '</td>' +
      '<td class="evs-cell-mut">' + esc(n.fecha) + '</td>' +
      '<td class="evs-cell-strong">' + esc(asocNombre(n.asociadoId)) + '</td>' +
      '<td class="evs-desc-cell">' + esc(n.descripcion) + '</td>' +
      '<td>' + badgeEstadoNC(n.estado) + '</td>' +
      '<td class="evs-cell-mut">' + esc(n.responsable) + '</td>' +
      '<td><div class="evs-row-actions" style="justify-content:flex-start">' + accion + '</div></td>' +
      '</tr>';
  });
  $('#evs-tb-nc').innerHTML = h;
  $('#evs-count-nc').textContent = 'Mostrando ' + rows.length + ' de ' + NCS.length + ' no conformidades';
  $('#evs-empty-nc').classList.toggle('evs-is-hidden', rows.length > 0);
  PV_LOG('NC', 'RENDER', 'OK', state.ncFiltro + ' ' + rows.length + '/' + NCS.length);
}
function abrirModalNC(){
  var sel = $('#evs-f-nc-asoc');
  var h = '<option value="">Seleccione…</option>';
  ASOCIADOS.forEach(function(a){
    h += '<option value="' + a.id + '">' + esc(a.nombre) + '</option>';
  });
  sel.innerHTML = h;
  $('#evs-f-nc-fecha').value = hoyISO();
  $('#evs-f-nc-resp').value = '';
  $('#evs-f-nc-desc').value = '';
  validarFormNC();
  openOverlay('modal-nc');
  PV_LOG('NC', 'MODAL_REPORTAR', 'OK');
}
function validarFormNC(){
  var okA = $('#evs-f-nc-asoc').value.length > 0;
  var okF = $('#evs-f-nc-fecha').value.length > 0;
  var okR = $('#evs-f-nc-resp').value.trim().length > 0;
  var okD = $('#evs-f-nc-desc').value.trim().length > 0;
  $('#evs-ff-nc-asoc').classList.toggle('evs-is-bad', !okA);
  $('#evs-ff-nc-fecha').classList.toggle('evs-is-bad', !okF);
  $('#evs-ff-nc-resp').classList.toggle('evs-is-bad', !okR);
  $('#evs-ff-nc-desc').classList.toggle('evs-is-bad', !okD);
  $('#evs-btn-guardar-nc').disabled = !(okA && okF && okR && okD);
}
function guardarNC(){
  var asociadoId = $('#evs-f-nc-asoc').value;
  var fecha = $('#evs-f-nc-fecha').value;
  var resp = $('#evs-f-nc-resp').value.trim();
  var desc = $('#evs-f-nc-desc').value.trim();
  if (!asociadoId || !fecha || !resp || !desc) return;
  var p = fecha.split('-');
  var fechaDD = p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : fecha;
  var nc = { id: 'tmp-' + Date.now(), no: NCS.length ? Math.max.apply(null, NCS.map(function(n){ return n.no; })) + 1 : 1,
      fecha: fechaDD, asociadoId: asociadoId, descripcion: desc, estado: 'Abierta', responsable: resp };
    try {
      var creadaNC = window.NoConformidadesServiceES.create({ asociadoId: asociadoId, fechaDeteccion: fecha, descripcion: desc, responsableSeguimiento: resp });
      if (creadaNC && creadaNC.id) nc.id = creadaNC.id;
    } catch (e) { klog('DATOS', 'NC_CREATE', 'ERR', e.message); }
    NCS.push(nc);
  /* PUNTO DE INTEGRACIÓN: window.electronAPI.reportarNC({ asociadoId, fecha, descripcion, responsable }) */
  PV_LOG('NC', 'REPORTAR', 'OK', nc.id + ' asoc=' + asociadoId);
  toast('No conformidad reportada correctamente.', 'ok');
  closeOverlay('modal-nc');
  renderAll();
}
function iniciarSeguimientoNC(id){
  var nc = null;
  NCS.forEach(function(n){ if (n.id === id) nc = n; });
  if (!nc) return;
  nc.estado = 'En seguimiento';
  try { window.NoConformidadesServiceES.updateEstado(id, 'EN_SEGUIMIENTO'); } catch (e) { klog('DATOS', 'NC_ESTADO', 'ERR', e.message); }
  /* PUNTO DE INTEGRACIÓN: window.electronAPI.iniciarSeguimientoNC({ id }) */
  PV_LOG('NC', 'SEGUIMIENTO', 'OK', id);
  toast('Seguimiento iniciado para «' + asocNombre(nc.asociadoId) + '».', 'info');
  renderAll();
}
function cerrarNC(id){
  var nc = null;
  NCS.forEach(function(n){ if (n.id === id) nc = n; });
  if (!nc) return;
  nc.estado = 'Cerrada';
  try { window.NoConformidadesServiceES.updateEstado(id, 'CERRADA'); } catch (e) { klog('DATOS', 'NC_ESTADO', 'ERR', e.message); }
  /* PUNTO DE INTEGRACIÓN: window.electronAPI.cerrarNC({ id }) */
  PV_LOG('NC', 'CERRAR', 'OK', id);
  toast('No conformidad cerrada correctamente.', 'ok');
  renderAll();
}

/* ══════════ RENDER: REPORTES ══════════ */
function fechaISOdeDD(fechaDD){
  var p = fechaDD.split('/');
  return p.length === 3 ? p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2) : '';
}
function reportesFiltrados(){
  return resumenAsociados(ASOCIADOS, EVALUACIONES).filter(function(r){
    if (state.repTipo !== 'Todos' && r.asociado.tipo !== state.repTipo) return false;
    if (state.repCls !== 'Todas' && r.clasif !== state.repCls) return false;
    if (state.repDesde && r.fecha && fechaISOdeDD(r.fecha) < state.repDesde) return false;
    if (state.repHasta && r.fecha && fechaISOdeDD(r.fecha) > state.repHasta) return false;
    return true;
  });
}
function renderReportes(){
  var rows = reportesFiltrados()
    .filter(function(r){ return r.clasif; })
    .sort(function(a, b){ return b.ultPct - a.ultPct || a.asociado.nombre.localeCompare(b.asociado.nombre); });
  var total = rows.length;
  var nb = rows.filter(function(r){ return r.clasif === 'Bueno'; }).length;
  var nr = rows.filter(function(r){ return r.clasif === 'Regular'; }).length;
  var nd = rows.filter(function(r){ return r.clasif === 'Deficiente'; }).length;
  $('#evs-rk-total').textContent = total;
  $('#evs-rk-bueno').textContent = pctRound(nb, total) + '%';
  $('#evs-rk-deficiente').textContent = pctRound(nd, total) + '%';
  renderDonut(total, nb, nr, nd);
  $('#evs-dl-bueno').textContent = nb + ' (' + pctRound(nb, total) + '%)';
  $('#evs-dl-regular').textContent = nr + ' (' + pctRound(nr, total) + '%)';
  $('#evs-dl-def').textContent = nd + ' (' + pctRound(nd, total) + '%)';
  var h = '';
  rows.forEach(function(r){
    var selEv = evalDeClase(r.asociado.id, 'Selección', EVALUACIONES);
    h += '<tr>' +
      '<td class="evs-cell-strong">' + esc(r.asociado.nombre) + '</td>' +
      '<td><span class="evs-badge evs-badge--blue">' + esc(r.asociado.tipo) + '</span></td>' +
      '<td class="evs-num evs-cell-mut">' + (r.selPct != null ? fmt1(r.selPct) : '—') + '</td>' +
      '<td class="evs-num evs-cell-mut">' + (r.reePct != null ? fmt1(r.reePct) : '—') + '</td>' +
      '<td>' + trendHTML(r.tendencia) + '</td>' +
      '<td>' + badgeClasif(r.clasif) + '</td>' +
      '<td class="evs-cell-mut">' + esc(r.fecha || '—') + '</td>' +
      '</tr>';
  });
  $('#evs-tb-rep').innerHTML = h;
  $('#evs-empty-rep').classList.toggle('evs-is-hidden', rows.length > 0);
  var proms = promsSeleccion(EVALUACIONES.filter(function(e){
    var a = asocPorId(e.asociadoId);
    return a && rows.some(function(r){ return r.asociado.id === a.id; });
  }));
  renderCriteriosBars('#evs-crit-bars-rep', proms);
  PV_LOG('REP', 'RENDER', 'OK', 'total=' + total + ' b=' + nb + ' r=' + nr + ' d=' + nd);
}
function renderDonut(total, nb, nr, nd){
  var C = 2 * Math.PI * 39;
  var segs = [
    { el:'#evs-donut-bueno', n:nb },
    { el:'#evs-donut-regular', n:nr },
    { el:'#evs-donut-def', n:nd }
  ];
  var offset = 0;
  segs.forEach(function(s){
    var len = total ? C * s.n / total : 0;
    var el = $(s.el);
    el.setAttribute('stroke-dasharray', len + ' ' + C);
    el.setAttribute('stroke-dashoffset', -offset);
    offset += len;
  });
  $('#evs-donut-total').textContent = total;
}
function exportarCSV(){
  var rows = reportesFiltrados().filter(function(r){ return r.clasif; });
  var lineas = ['Nombre;NIT;Tipo;Seleccion;Reevaluacion;Tendencia;Clasificacion;Fecha'];
  rows.forEach(function(r){
    lineas.push([r.asociado.nombre, r.asociado.nit, r.asociado.tipo,
      r.selPct != null ? fmt1(r.selPct) : '', r.reePct != null ? fmt1(r.reePct) : '',
      r.tendencia.txt, r.clasif, r.fecha || ''].map(function(v){ return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'));
  });
  var blob = new Blob(['\ufeff' + lineas.join('\r\n')], { type:'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'kair-reportes-evaluaciones.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 400);
  /* PUNTO DE INTEGRACIÓN: window.electronAPI.exportarReporte({ filtros }) */
  PV_LOG('REP', 'EXPORT', 'OK', rows.length + ' filas');
  toast('Reporte exportado (' + rows.length + ' registros).', 'ok');
}

/* ══════════ RENDER GLOBAL ══════════ */
function renderAll(){
  renderDashboard();
  renderRegistro();
  renderEval();
  renderRee();
  renderNC();
  renderReportes();
}

/* ══════════ EVENTOS ══════════ */
function debounce(fn, ms){
  var t;
  return function(){
    var args = arguments, self = this;
    clearTimeout(t);
    t = setTimeout(function(){ fn.apply(self, args); }, ms || 260);
  };
}

$$('.evs-pv-tab').forEach(function(t){
  t.addEventListener('click', function(){ setTab(t.getAttribute('data-tab')); });
});

/* KPIs navegables */
$('#evs-kpi-pendientes').addEventListener('click', function(){ setTab('eval'); PV_LOG('NAV', 'KPI', 'OK', 'eval'); });
$('#evs-kpi-reevaluaciones').addEventListener('click', function(){ setTab('ree'); PV_LOG('NAV', 'KPI', 'OK', 'ree'); });
$('#evs-kpi-nc').addEventListener('click', function(){
  state.ncFiltro = 'Abiertas';
  syncNcChips();
  setTab('nc');
  renderNC();
  PV_LOG('NAV', 'KPI', 'OK', 'nc-abiertas');
});

/* Alerta deficiente */
$('#evs-alert-def-x').addEventListener('click', function(){
  state.alertDismissed = true;
  $('#evs-alert-def').classList.add('evs-is-hidden');
  PV_LOG('ALERTA', 'DISMISS', 'OK');
});

/* Registro */
var onRegQ = debounce(function(){
  state.regQ = $('#evs-q-reg').value;
  $('#evs-search-reg').classList.toggle('evs-has-val', state.regQ.length > 0);
  renderRegistro();
}, 260);
$('#evs-q-reg').addEventListener('input', onRegQ);
$('#evs-q-reg-x').addEventListener('click', function(){
  $('#evs-q-reg').value = '';
  state.regQ = '';
  $('#evs-search-reg').classList.remove('evs-has-val');
  renderRegistro();
});
$('#evs-f-reg-tipo').addEventListener('change', function(){
  state.regTipo = this.value;
  renderRegistro();
});
$('#evs-btn-nuevo-asoc').addEventListener('click', function(){ abrirModalAsoc(null); });
$('#evs-tb-registro').addEventListener('click', function(ev){
  var btn = ev.target.closest('[data-edit-asoc]');
  if (btn) abrirModalAsoc(btn.getAttribute('data-edit-asoc'));
});
$('#evs-f-asoc-nombre').addEventListener('input', validarFormAsoc);
$('#evs-f-asoc-nit').addEventListener('input', validarFormAsoc);
$('#evs-btn-guardar-asoc').addEventListener('click', guardarAsoc);

/* Evaluación */
$('#evs-sel-eval').addEventListener('change', function(){
  state.evalSel = this.value || null;
  state.evalScores = {};
  renderEval();
  PV_LOG('EVAL', 'SELECT', 'OK', state.evalSel || 'ninguno');
});
$('#evs-eval-body').addEventListener('click', function(ev){
  var opt = ev.target.closest('[data-mz="eval"]');
  if (opt){ pickMatriz('eval', opt.getAttribute('data-crit'), parseInt(opt.getAttribute('data-val'), 10), CRIT_SEL, state.evalScores); return; }
  if (ev.target.closest('#evs-btn-eval-reg')) registrarEvaluacion('Selección');
});

/* Reevaluación */
$('#evs-sel-ree').addEventListener('change', function(){
  state.reeSel = this.value || null;
  state.reeScores = {};
  renderRee();
  PV_LOG('REE', 'SELECT', 'OK', state.reeSel || 'ninguno');
});
$('#evs-ree-body').addEventListener('click', function(ev){
  var opt = ev.target.closest('[data-mz="ree"]');
  if (opt){ pickMatriz('ree', opt.getAttribute('data-crit'), parseInt(opt.getAttribute('data-val'), 10), CRIT_REE, state.reeScores); return; }
  if (ev.target.closest('#evs-btn-ree-reg')) registrarEvaluacion('Reevaluación');
});

/* No conformidades */
var onNcQ = debounce(function(){
  state.ncQ = $('#evs-q-nc').value;
  $('#evs-search-nc').classList.toggle('evs-has-val', state.ncQ.length > 0);
  renderNC();
}, 260);
$('#evs-q-nc').addEventListener('input', onNcQ);
$('#evs-q-nc-x').addEventListener('click', function(){
  $('#evs-q-nc').value = '';
  state.ncQ = '';
  $('#evs-search-nc').classList.remove('evs-has-val');
  renderNC();
});
function syncNcChips(){
  $$('.evs-filt-chip').forEach(function(c){
    var on = c.getAttribute('data-ncf') === state.ncFiltro;
    c.classList.toggle('evs-is-on', on);
    c.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
$$('.evs-filt-chip').forEach(function(c){
  c.addEventListener('click', function(){
    state.ncFiltro = c.getAttribute('data-ncf');
    syncNcChips();
    renderNC();
  });
});
$('#evs-tb-nc').addEventListener('click', function(ev){
  var seg = ev.target.closest('[data-nc-seg]');
  if (seg){ iniciarSeguimientoNC(seg.getAttribute('data-nc-seg')); return; }
  var cer = ev.target.closest('[data-nc-cerrar]');
  if (cer) cerrarNC(cer.getAttribute('data-nc-cerrar'));
});
$('#evs-btn-reportar-nc').addEventListener('click', abrirModalNC);
$('#evs-f-nc-asoc').addEventListener('change', validarFormNC);
$('#evs-f-nc-fecha').addEventListener('change', validarFormNC);
$('#evs-f-nc-resp').addEventListener('input', validarFormNC);
$('#evs-f-nc-desc').addEventListener('input', validarFormNC);
$('#evs-btn-guardar-nc').addEventListener('click', guardarNC);

/* Reportes */
$('#evs-f-rep-tipo').addEventListener('change', function(){ state.repTipo = this.value; renderReportes(); });
$('#evs-f-rep-cls').addEventListener('change', function(){ state.repCls = this.value; renderReportes(); });
$('#evs-f-rep-desde').addEventListener('change', function(){ state.repDesde = this.value; renderReportes(); });
$('#evs-f-rep-hasta').addEventListener('change', function(){ state.repHasta = this.value; renderReportes(); });
$('#evs-btn-exportar').addEventListener('click', exportarCSV);

/* Volver + overlays + teclado */
$('#evs-btn-volver').addEventListener('click', function(){
  /* PUNTO DE INTEGRACIÓN: window.electronAPI.volver() → navegación al módulo contenedor */
  PV_LOG('NAV', 'VOLVER', 'OK');
  toast('Volver al menú principal (integración pendiente).', 'info');
});
$$('[data-close]').forEach(function(b){
  b.addEventListener('click', function(){ closeOverlay(b.getAttribute('data-close')); });
});
$$('.evs-overlay').forEach(function(o){
  o.addEventListener('mousedown', function(ev){ if (ev.target === o) closeOverlay(o.id); });
});
if (!document.__evsEscBound) { document.__evsEscBound = true;
  document.addEventListener('keydown', function(ev){
  if (ev.key === 'Escape' && anyOverlayOpen()){
    $$('.evs-overlay').forEach(function(o){ if (!o.classList.contains('evs-is-hidden')) closeOverlay(o.id); });
    PV_LOG('UI', 'ESC', 'OK');
  }
  });
  }

/* ══════════ INIT ══════════ */
  cargarDatosIniciales();
  }

  var MARKUP_RAW = "\n</head>\n<body>\n<div class=\"evs-kair-app\">\n  <!-- ══════════ TOPBAR ══════════ -->\n  <header class=\"evs-pv-topbar\">\n    <div class=\"evs-pv-badge-ico\" aria-hidden=\"true\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8\" r=\"3.2\"/><path d=\"M3.5 19c.6-3 2.9-4.7 5.5-4.7s4.9 1.7 5.5 4.7\"/><circle cx=\"17\" cy=\"9\" r=\"2.4\"/><path d=\"M15.4 13.6c2.3.2 4.3 1.6 4.9 4.2\"/></svg>\n    </div>\n    <div class=\"evs-pv-titles\">\n      <h1 class=\"evs-pv-title\">Evaluación y Selección de Proveedores y Contratistas</h1>\n      <p class=\"evs-pv-sub\">Gestión de asociados y evaluación de proveedores y contratistas SG-SST.</p>\n    </div>\n    <div class=\"evs-pv-actions\">\n      <span class=\"evs-chip-emp\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16\"/><path d=\"M15 9h4a1 1 0 0 1 1 1v11\"/><path d=\"M2 21h20\"/><path d=\"M7 8h4M7 12h4M7 16h4\"/></svg>Tempoactiva</span>\n      <button type=\"button\" class=\"evs-btn evs-btn-warn evs-is-hidden\" id=\"evs-btn-reportar-nc\" aria-label=\"Reportar no conformidad\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>\n        Reportar NC\n      </button>\n      <button type=\"button\" class=\"evs-btn evs-btn-ghost\" id=\"evs-btn-volver\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 12H5\"/><path d=\"m11 18-6-6 6-6\"/></svg>\n        Volver\n      </button>\n    </div>\n  </header>\n\n  <!-- ══════════ TABS ══════════ -->\n  <nav class=\"evs-pv-tabs\" role=\"tablist\" aria-label=\"Secciones del módulo\">\n    <button type=\"button\" class=\"evs-pv-tab evs-is-active\" data-tab=\"dash\" role=\"tab\" aria-selected=\"true\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"8\" height=\"8\" rx=\"1.5\"/><rect x=\"13\" y=\"3\" width=\"8\" height=\"5\" rx=\"1.5\"/><rect x=\"13\" y=\"10\" width=\"8\" height=\"11\" rx=\"1.5\"/><rect x=\"3\" y=\"13\" width=\"8\" height=\"8\" rx=\"1.5\"/></svg>\n      Dashboard\n    </button>\n    <button type=\"button\" class=\"evs-pv-tab\" data-tab=\"reg\" role=\"tab\" aria-selected=\"false\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3.8 19c.5-2.8 2.6-4.5 5.2-4.5s4.7 1.7 5.2 4.5\"/><path d=\"M16.5 4.5v5M14 7h5\"/></svg>\n      Registro\n    </button>\n    <button type=\"button\" class=\"evs-pv-tab\" data-tab=\"eval\" role=\"tab\" aria-selected=\"false\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"m9 12.5 2 2 4.5-4.5\"/></svg>\n      Evaluación\n    </button>\n    <button type=\"button\" class=\"evs-pv-tab\" data-tab=\"ree\" role=\"tab\" aria-selected=\"false\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12a9 9 0 1 1-2.6-6.4\"/><path d=\"M21 3v6h-6\"/></svg>\n      Reevaluación\n    </button>\n    <button type=\"button\" class=\"evs-pv-tab\" data-tab=\"nc\" role=\"tab\" aria-selected=\"false\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>\n      No Conformidades\n    </button>\n    <button type=\"button\" class=\"evs-pv-tab\" data-tab=\"rep\" role=\"tab\" aria-selected=\"false\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z\"/><path d=\"M14 3v5h5\"/><path d=\"M9 13h6M9 17h4\"/></svg>\n      Reportes\n    </button>\n  </nav>\n\n  <!-- ══════════ VIEW: DASHBOARD ══════════ -->\n  <section id=\"evs-view-dash\" class=\"evs-kair-view\" role=\"tabpanel\" aria-label=\"Dashboard\">\n    <div class=\"evs-kpi-strip\">\n      <div class=\"evs-kpi-card\" id=\"evs-kpi-asociados\">\n        <div class=\"evs-kpi-ico evs-kpi-ico--blue\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8\" r=\"3.2\"/><path d=\"M3.5 19c.6-3 2.9-4.7 5.5-4.7s4.9 1.7 5.5 4.7\"/><circle cx=\"17\" cy=\"9\" r=\"2.4\"/><path d=\"M15.4 13.6c2.3.2 4.3 1.6 4.9 4.2\"/></svg></div>\n        <div class=\"evs-kpi-body\"><div class=\"evs-kpi-val\" id=\"evs-kv-asociados\">0</div><div class=\"evs-kpi-lbl\">Asociados registrados</div></div>\n      </div>\n      <button type=\"button\" class=\"evs-kpi-card evs-is-click\" id=\"evs-kpi-pendientes\" aria-label=\"Ir a Evaluación\">\n        <div class=\"evs-kpi-ico evs-kpi-ico--amber\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M12 7.5V12l3 2\"/></svg></div>\n        <div class=\"evs-kpi-body\"><div class=\"evs-kpi-val\" id=\"evs-kv-pendientes\">0</div><div class=\"evs-kpi-lbl\">Evaluaciones pendientes</div></div>\n      </button>\n      <button type=\"button\" class=\"evs-kpi-card evs-is-click\" id=\"evs-kpi-reevaluaciones\" aria-label=\"Ir a Reevaluación\">\n        <div class=\"evs-kpi-ico evs-kpi-ico--blue\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12a9 9 0 1 1-2.6-6.4\"/><path d=\"M21 3v6h-6\"/></svg></div>\n        <div class=\"evs-kpi-body\"><div class=\"evs-kpi-val\" id=\"evs-kv-reevaluaciones\">0</div><div class=\"evs-kpi-lbl\">Reevaluaciones del mes</div></div>\n      </button>\n      <button type=\"button\" class=\"evs-kpi-card evs-is-click\" id=\"evs-kpi-nc\" aria-label=\"Ir a No Conformidades\">\n        <div class=\"evs-kpi-ico evs-kpi-ico--red\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg></div>\n        <div class=\"evs-kpi-body\"><div class=\"evs-kpi-val\" id=\"evs-kv-nc\">0</div><div class=\"evs-kpi-lbl\">No conformidades activas</div></div>\n      </button>\n    </div>\n\n    <div class=\"evs-pv-alert\" id=\"evs-alert-def\" role=\"alert\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>\n      <span class=\"evs-pv-alert-t\" id=\"evs-alert-def-txt\"></span>\n      <button type=\"button\" class=\"evs-pv-alert-x\" id=\"evs-alert-def-x\" aria-label=\"Cerrar alerta\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg>\n      </button>\n    </div>\n\n    <div class=\"evs-dash-grid\">\n      <div class=\"evs-card\">\n        <div class=\"evs-card-h\"><h2 class=\"evs-card-t\">Distribución por Estado</h2></div>\n        <div class=\"evs-card-b\">\n          <div class=\"evs-dist-rows\">\n            <div class=\"evs-dist-row\"><span class=\"evs-dist-k\">Bueno</span><div class=\"evs-dist-track\"><div class=\"evs-dist-fill evs-dist-fill--green\" id=\"evs-dist-bueno\" style=\"width:0%\"></div></div></div>\n            <div class=\"evs-dist-row\"><span class=\"evs-dist-k\">Regular</span><div class=\"evs-dist-track\"><div class=\"evs-dist-fill evs-dist-fill--amber\" id=\"evs-dist-regular\" style=\"width:0%\"></div></div></div>\n            <div class=\"evs-dist-row\"><span class=\"evs-dist-k\">Deficiente</span><div class=\"evs-dist-track\"><div class=\"evs-dist-fill evs-dist-fill--red\" id=\"evs-dist-deficiente\" style=\"width:0%\"></div></div></div>\n          </div>\n        </div>\n      </div>\n      <div class=\"evs-card\">\n        <div class=\"evs-card-h\"><h2 class=\"evs-card-t\">Promedio por Criterio de Selección</h2></div>\n        <div class=\"evs-card-b\"><div class=\"evs-crit-rows\" id=\"evs-crit-bars\"></div></div>\n      </div>\n    </div>\n\n    <div class=\"evs-card\">\n      <div class=\"evs-card-h\"><h2 class=\"evs-card-t\">Evaluaciones Recientes</h2><span class=\"evs-chip evs-chip--slate\" id=\"evs-chip-recientes\">0</span></div>\n      <div class=\"evs-tbl-scroll\" style=\"max-height:340px\">\n        <table class=\"evs-pv-tbl\" style=\"min-width:760px\">\n          <thead><tr><th>Nombre</th><th>Tipo</th><th>Fecha</th><th class=\"evs-num\">Puntaje</th><th>Estado</th></tr></thead>\n          <tbody id=\"evs-tb-recientes\"></tbody>\n        </table>\n      </div>\n    </div>\n  </section>\n\n  <!-- ══════════ VIEW: REGISTRO ══════════ -->\n  <section id=\"evs-view-reg\" class=\"evs-kair-view evs-is-hidden\" role=\"tabpanel\" aria-label=\"Registro de asociados\">\n    <div class=\"evs-card\">\n      <div class=\"evs-tbl-toolbar\">\n        <div class=\"evs-search\" id=\"evs-search-reg\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.2-3.2\"/></svg>\n          <input type=\"text\" id=\"evs-q-reg\" placeholder=\"Buscar por nombre, NIT u objeto…\" aria-label=\"Buscar asociados\">\n          <button type=\"button\" class=\"evs-search-x\" id=\"evs-q-reg-x\" aria-label=\"Limpiar búsqueda\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg>\n          </button>\n        </div>\n        <select class=\"evs-f-ctrl\" id=\"evs-f-reg-tipo\" style=\"width:auto;min-width:150px\" aria-label=\"Filtrar por tipo\">\n          <option value=\"Todos\">Todos los tipos</option>\n          <option value=\"Proveedor\">Proveedor</option>\n          <option value=\"Contratista\">Contratista</option>\n        </select>\n        <span style=\"flex:1\"></span>\n        <button type=\"button\" class=\"evs-btn evs-btn-primary\" id=\"evs-btn-nuevo-asoc\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 5v14M5 12h14\"/></svg>\n          Nuevo Asociado\n        </button>\n      </div>\n      <div class=\"evs-tbl-scroll\" style=\"max-height:520px\">\n        <table class=\"evs-pv-tbl\" style=\"min-width:900px\">\n          <thead><tr><th>Nombre</th><th>NIT</th><th>Tipo</th><th>Objeto o alcance</th><th>Clasificación</th><th>Estado</th><th class=\"evs-num\">Acciones</th></tr></thead>\n          <tbody id=\"evs-tb-registro\"></tbody>\n        </table>\n      </div>\n      <div class=\"evs-tbl-toolbar\" style=\"border-top:1px solid var(--kair-border);border-bottom:0\">\n        <span class=\"evs-tbl-count\" id=\"evs-count-registro\"></span>\n      </div>\n      <div class=\"evs-empty-block evs-is-hidden\" id=\"evs-empty-registro\">\n        <div class=\"evs-empty-ico\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8\" r=\"3.2\"/><path d=\"M3.5 19c.6-3 2.9-4.7 5.5-4.7s4.9 1.7 5.5 4.7\"/><circle cx=\"17\" cy=\"9\" r=\"2.4\"/><path d=\"M15.4 13.6c2.3.2 4.3 1.6 4.9 4.2\"/></svg></div>\n        <div class=\"evs-empty-t\">No se encontraron asociados</div>\n        <div class=\"evs-empty-d\">Ajuste la búsqueda o el filtro de tipo, o registre un nuevo asociado.</div>\n      </div>\n    </div>\n  </section>\n\n  <!-- ══════════ VIEW: EVALUACIÓN ══════════ -->\n  <section id=\"evs-view-eval\" class=\"evs-kair-view evs-is-hidden\" role=\"tabpanel\" aria-label=\"Evaluación de asociados\">\n    <div class=\"evs-sel-row\">\n      <span class=\"evs-sel-label\">Seleccione el asociado a evaluar <span class=\"evs-req\">*</span></span>\n      <div class=\"evs-sel-pick\"><select class=\"evs-f-ctrl\" id=\"evs-sel-eval\" aria-label=\"Asociado a evaluar\"></select></div>\n    </div>\n    <div id=\"evs-eval-body\"></div>\n  </section>\n\n  <!-- ══════════ VIEW: REEVALUACIÓN ══════════ -->\n  <section id=\"evs-view-ree\" class=\"evs-kair-view evs-is-hidden\" role=\"tabpanel\" aria-label=\"Reevaluación anual de asociados\">\n    <div class=\"evs-sel-row\">\n      <span class=\"evs-sel-label\">Seleccione el asociado a reevaluar <span class=\"evs-req\">*</span></span>\n      <div class=\"evs-sel-pick\"><select class=\"evs-f-ctrl\" id=\"evs-sel-ree\" aria-label=\"Asociado a reevaluar\"></select></div>\n    </div>\n    <div id=\"evs-ree-body\"></div>\n  </section>\n\n  <!-- ══════════ VIEW: NO CONFORMIDADES ══════════ -->\n  <section id=\"evs-view-nc\" class=\"evs-kair-view evs-is-hidden\" role=\"tabpanel\" aria-label=\"No conformidades\">\n    <div class=\"evs-card\">\n      <div class=\"evs-tbl-toolbar\">\n        <div class=\"evs-search\" id=\"evs-search-nc\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.2-3.2\"/></svg>\n          <input type=\"text\" id=\"evs-q-nc\" placeholder=\"Buscar…\" aria-label=\"Buscar no conformidades\">\n          <button type=\"button\" class=\"evs-search-x\" id=\"evs-q-nc-x\" aria-label=\"Limpiar búsqueda\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg>\n          </button>\n        </div>\n        <div class=\"evs-filt-chips\" role=\"group\" aria-label=\"Filtrar por estado\">\n          <button type=\"button\" class=\"evs-filt-chip evs-is-on\" data-ncf=\"Todas\">Todas</button>\n          <button type=\"button\" class=\"evs-filt-chip\" data-ncf=\"Abiertas\">Abiertas</button>\n          <button type=\"button\" class=\"evs-filt-chip\" data-ncf=\"En seguimiento\">En seguimiento</button>\n          <button type=\"button\" class=\"evs-filt-chip\" data-ncf=\"Cerradas\">Cerradas</button>\n        </div>\n      </div>\n      <div class=\"evs-tbl-scroll\" style=\"max-height:520px\">\n        <table class=\"evs-pv-tbl\" style=\"min-width:980px\">\n          <thead><tr><th>No.</th><th>Fecha</th><th>Asociado</th><th>Descripción</th><th>Estado</th><th>Responsable</th><th class=\"evs-num\">Acciones</th></tr></thead>\n          <tbody id=\"evs-tb-nc\"></tbody>\n        </table>\n      </div>\n      <div class=\"evs-tbl-toolbar\" style=\"border-top:1px solid var(--kair-border);border-bottom:0\">\n        <span class=\"evs-tbl-count\" id=\"evs-count-nc\"></span>\n      </div>\n      <div class=\"evs-empty-block evs-is-hidden\" id=\"evs-empty-nc\">\n        <div class=\"evs-empty-ico\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg></div>\n        <div class=\"evs-empty-t\">No hay no conformidades</div>\n        <div class=\"evs-empty-d\">No se encontraron registros para el filtro o la búsqueda actual.</div>\n      </div>\n    </div>\n  </section>\n\n  <!-- ══════════ VIEW: REPORTES ══════════ -->\n  <section id=\"evs-view-rep\" class=\"evs-kair-view evs-is-hidden\" role=\"tabpanel\" aria-label=\"Reportes de evaluaciones\">\n    <div class=\"evs-card\" style=\"margin-bottom:16px\">\n      <div class=\"evs-card-b\">\n        <div class=\"evs-rep-filters\">\n          <div class=\"evs-f-field\">\n            <label class=\"evs-f-label\" for=\"f-rep-tipo\">Tipo de asociado</label>\n            <select class=\"evs-f-ctrl\" id=\"evs-f-rep-tipo\">\n              <option value=\"Todos\">Todos</option>\n              <option value=\"Proveedor\">Proveedor</option>\n              <option value=\"Contratista\">Contratista</option>\n            </select>\n          </div>\n          <div class=\"evs-f-field\">\n            <label class=\"evs-f-label\" for=\"f-rep-cls\">Clasificación</label>\n            <select class=\"evs-f-ctrl\" id=\"evs-f-rep-cls\">\n              <option value=\"Todas\">Todas</option>\n              <option value=\"Bueno\">Bueno</option>\n              <option value=\"Regular\">Regular</option>\n              <option value=\"Deficiente\">Deficiente</option>\n            </select>\n          </div>\n          <div class=\"evs-f-field\">\n            <label class=\"evs-f-label\" for=\"f-rep-desde\">Desde</label>\n            <input type=\"date\" class=\"evs-f-ctrl\" id=\"evs-f-rep-desde\">\n          </div>\n          <div class=\"evs-f-field\">\n            <label class=\"evs-f-label\" for=\"f-rep-hasta\">Hasta</label>\n            <input type=\"date\" class=\"evs-f-ctrl\" id=\"evs-f-rep-hasta\">\n          </div>\n        </div>\n      </div>\n    </div>\n\n    <div class=\"evs-big-kpis\">\n      <div class=\"evs-big-kpi evs-big-kpi--blue\"><div class=\"evs-big-kpi-v\" id=\"evs-rk-total\">0</div><div class=\"evs-big-kpi-l\">Total Evaluados</div></div>\n      <div class=\"evs-big-kpi evs-big-kpi--green\"><div class=\"evs-big-kpi-v\" id=\"evs-rk-bueno\">0%</div><div class=\"evs-big-kpi-l\">Clasificación Bueno</div></div>\n      <div class=\"evs-big-kpi evs-big-kpi--red\"><div class=\"evs-big-kpi-v\" id=\"evs-rk-deficiente\">0%</div><div class=\"evs-big-kpi-l\">Clasificación Deficiente</div></div>\n    </div>\n\n    <div class=\"evs-rep-grid\">\n      <div class=\"evs-card\">\n        <div class=\"evs-card-h\"><h2 class=\"evs-card-t\">Clasificación General</h2></div>\n        <div class=\"evs-donut-wrap\">\n          <div class=\"evs-donut-box\">\n            <svg viewBox=\"0 0 100 100\" role=\"img\" aria-label=\"Distribución de clasificación\">\n              <circle class=\"evs-donut-track\" cx=\"50\" cy=\"50\" r=\"39\"></circle>\n              <circle class=\"evs-donut-seg\" id=\"evs-donut-bueno\" cx=\"50\" cy=\"50\" r=\"39\" stroke=\"var(--kair-green)\" stroke-dasharray=\"0 245.044\" transform=\"rotate(-90 50 50)\"></circle>\n              <circle class=\"evs-donut-seg\" id=\"evs-donut-regular\" cx=\"50\" cy=\"50\" r=\"39\" stroke=\"var(--kair-amber)\" stroke-dasharray=\"0 245.044\" transform=\"rotate(-90 50 50)\"></circle>\n              <circle class=\"evs-donut-seg\" id=\"evs-donut-def\" cx=\"50\" cy=\"50\" r=\"39\" stroke=\"var(--kair-red)\" stroke-dasharray=\"0 245.044\" transform=\"rotate(-90 50 50)\"></circle>\n            </svg>\n            <div class=\"evs-donut-center\"><div class=\"evs-donut-val\" id=\"evs-donut-total\">0</div><div class=\"evs-donut-cap\">Total</div></div>\n          </div>\n          <div class=\"evs-donut-legend\">\n            <div class=\"evs-dl-row\"><span class=\"evs-dl-dot\" style=\"background:var(--kair-green)\"></span><span class=\"evs-dl-k\">Bueno</span><span class=\"evs-dl-v\" id=\"evs-dl-bueno\">0 (0%)</span></div>\n            <div class=\"evs-dl-row\"><span class=\"evs-dl-dot\" style=\"background:var(--kair-amber)\"></span><span class=\"evs-dl-k\">Regular</span><span class=\"evs-dl-v\" id=\"evs-dl-regular\">0 (0%)</span></div>\n            <div class=\"evs-dl-row\"><span class=\"evs-dl-dot\" style=\"background:var(--kair-red)\"></span><span class=\"evs-dl-k\">Deficiente</span><span class=\"evs-dl-v\" id=\"evs-dl-def\">0 (0%)</span></div>\n          </div>\n        </div>\n      </div>\n      <div class=\"evs-card\">\n        <div class=\"evs-card-h\">\n          <h2 class=\"evs-card-t\">Detalle de Evaluaciones</h2>\n          <button type=\"button\" class=\"evs-btn evs-btn-outline\" id=\"evs-btn-exportar\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v12\"/><path d=\"m7 10 5 5 5-5\"/><path d=\"M4 21h16\"/></svg>\n            Exportar\n          </button>\n        </div>\n        <div class=\"evs-tbl-scroll\" style=\"max-height:320px\">\n          <table class=\"evs-pv-tbl\" style=\"min-width:820px\">\n            <thead><tr><th>Nombre</th><th>Tipo</th><th class=\"evs-num\">Selección</th><th class=\"evs-num\">Reevaluación</th><th>Tendencia</th><th>Clasificación</th><th>Fecha</th></tr></thead>\n            <tbody id=\"evs-tb-rep\"></tbody>\n          </table>\n        </div>\n        <div class=\"evs-empty-block evs-is-hidden\" id=\"evs-empty-rep\">\n          <div class=\"evs-empty-ico\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z\"/><path d=\"M14 3v5h5\"/></svg></div>\n          <div class=\"evs-empty-t\">Sin resultados</div>\n          <div class=\"evs-empty-d\">Ningún asociado coincide con los filtros seleccionados.</div>\n        </div>\n      </div>\n    </div>\n\n    <div class=\"evs-card\">\n      <div class=\"evs-card-h\"><h2 class=\"evs-card-t\">Criterios de Selección</h2><span class=\"evs-chip evs-chip--slate\" id=\"evs-chip-crit-rep\">Promedio general</span></div>\n      <div class=\"evs-card-b\"><div class=\"evs-crit-rows\" id=\"evs-crit-bars-rep\"></div></div>\n    </div>\n  </section>\n\n  <!-- ══════════ MODALES ══════════ -->\n  <div class=\"evs-overlay evs-is-hidden\" id=\"evs-modal-asoc\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"m-asoc-t\">\n    <div class=\"evs-modal evs-m-form\">\n      <div class=\"evs-form-head\">\n        <div class=\"evs-form-ico\" id=\"evs-m-asoc-ico\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"8\" r=\"3.2\"/><path d=\"M3.5 19c.6-3 2.9-4.7 5.5-4.7s4.9 1.7 5.5 4.7\"/><circle cx=\"17\" cy=\"9\" r=\"2.4\"/><path d=\"M15.4 13.6c2.3.2 4.3 1.6 4.9 4.2\"/></svg>\n        </div>\n        <h2 class=\"evs-form-title\" id=\"evs-m-asoc-t\">Nuevo Asociado</h2>\n        <span class=\"evs-form-sub\">Datos del asociado</span>\n      </div>\n      <div class=\"evs-modal-b\">\n        <div class=\"evs-f-grid\">\n          <div class=\"evs-f-field evs-f-field--full\" id=\"evs-ff-asoc-nombre\">\n            <label class=\"evs-f-label\" for=\"f-asoc-nombre\">Nombre o razón social <span class=\"evs-req\">*</span></label>\n            <input type=\"text\" class=\"evs-f-ctrl\" id=\"evs-f-asoc-nombre\" placeholder=\"Ej.: Suministros Industriales SAS\">\n            <span class=\"evs-f-hint\">El nombre es obligatorio.</span>\n          </div>\n          <div class=\"evs-f-field\" id=\"evs-ff-asoc-nit\">\n            <label class=\"evs-f-label\" for=\"f-asoc-nit\">NIT <span class=\"evs-req\">*</span></label>\n            <input type=\"text\" class=\"evs-f-ctrl\" id=\"evs-f-asoc-nit\" placeholder=\"Ej.: 900123456-1\">\n            <span class=\"evs-f-hint\">El NIT es obligatorio.</span>\n          </div>\n          <div class=\"evs-f-field\">\n            <label class=\"evs-f-label\" for=\"f-asoc-tipo\">Tipo de asociado <span class=\"evs-req\">*</span></label>\n            <select class=\"evs-f-ctrl\" id=\"evs-f-asoc-tipo\">\n              <option value=\"Proveedor\">Proveedor</option>\n              <option value=\"Contratista\">Contratista</option>\n            </select>\n          </div>\n          <div class=\"evs-f-field evs-f-field--full\">\n            <label class=\"evs-f-label\" for=\"f-asoc-objeto\">Objeto o alcance</label>\n            <textarea class=\"evs-f-ctrl\" id=\"evs-f-asoc-objeto\" placeholder=\"Ej.: Elementos de protección personal (EPP)\"></textarea>\n          </div>\n        </div>\n      </div>\n      <div class=\"evs-modal-f\">\n        <span class=\"evs-lead\" id=\"evs-m-asoc-hint\">Los campos con * son obligatorios.</span>\n        <button type=\"button\" class=\"evs-btn evs-btn-ghost\" data-close=\"modal-asoc\">Cancelar</button>\n        <button type=\"button\" class=\"evs-btn evs-btn-primary\" id=\"evs-btn-guardar-asoc\" disabled>\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z\"/><path d=\"M17 21v-8H7v8M7 3v5h8\"/></svg>\n          Guardar\n        </button>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"evs-overlay evs-is-hidden\" id=\"evs-modal-nc\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"m-nc-t\">\n    <div class=\"evs-modal evs-m-form\">\n      <div class=\"evs-form-head\">\n        <div class=\"evs-form-ico\" style=\"background:var(--kair-amber-soft);color:var(--kair-amber-d)\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>\n        </div>\n        <h2 class=\"evs-form-title\" id=\"evs-m-nc-t\">Reportar No Conformidad</h2>\n        <span class=\"evs-form-sub\">Nueva NC</span>\n      </div>\n      <div class=\"evs-modal-b\">\n        <div class=\"evs-f-grid\">\n          <div class=\"evs-f-field evs-f-field--full\" id=\"evs-ff-nc-asoc\">\n            <label class=\"evs-f-label\" for=\"f-nc-asoc\">Asociado <span class=\"evs-req\">*</span></label>\n            <select class=\"evs-f-ctrl\" id=\"evs-f-nc-asoc\"></select>\n            <span class=\"evs-f-hint\">Seleccione el asociado.</span>\n          </div>\n          <div class=\"evs-f-field\" id=\"evs-ff-nc-fecha\">\n            <label class=\"evs-f-label\" for=\"f-nc-fecha\">Fecha <span class=\"evs-req\">*</span></label>\n            <input type=\"date\" class=\"evs-f-ctrl\" id=\"evs-f-nc-fecha\">\n            <span class=\"evs-f-hint\">La fecha es obligatoria.</span>\n          </div>\n          <div class=\"evs-f-field\" id=\"evs-ff-nc-resp\">\n            <label class=\"evs-f-label\" for=\"f-nc-resp\">Responsable <span class=\"evs-req\">*</span></label>\n            <input type=\"text\" class=\"evs-f-ctrl\" id=\"evs-f-nc-resp\" placeholder=\"Ej.: Ana Rodríguez\">\n            <span class=\"evs-f-hint\">El responsable es obligatorio.</span>\n          </div>\n          <div class=\"evs-f-field evs-f-field--full\" id=\"evs-ff-nc-desc\">\n            <label class=\"evs-f-label\" for=\"f-nc-desc\">Descripción de la no conformidad <span class=\"evs-req\">*</span></label>\n            <textarea class=\"evs-f-ctrl\" id=\"evs-f-nc-desc\" placeholder=\"Describa el incumplimiento detectado…\"></textarea>\n            <span class=\"evs-f-hint\">La descripción es obligatoria.</span>\n          </div>\n        </div>\n      </div>\n      <div class=\"evs-modal-f\">\n        <span class=\"evs-lead\">La NC se crea en estado Abierta.</span>\n        <button type=\"button\" class=\"evs-btn evs-btn-ghost\" data-close=\"modal-nc\">Cancelar</button>\n        <button type=\"button\" class=\"evs-btn evs-btn-amber\" id=\"evs-btn-guardar-nc\" disabled>\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.3 4.1 2.9 17a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>\n          Reportar\n        </button>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"evs-toasts\" id=\"evs-toasts\" aria-live=\"polite\"></div>\n</div>\n\n";

  window.EvaluacionSeleccionComponent = EvaluacionSeleccionComponent;
})();
