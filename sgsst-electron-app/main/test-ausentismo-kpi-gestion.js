/* main/test-ausentismo-kpi-gestion.js
 * La quinta card de "Medición del Ausentismo": "Gestantes en Seguimiento",
 * y la ampliación del tamaño del home cuando la ventana está maximizada.
 *
 * EL PORQUÉ
 * ----------
 * Las cuatro primeras cards cuentan casos de ausentismo y salen del Excel
 * GI-FO-076 (handler `get-ausentismo-stats`). La quinta cuenta gestantes con
 * seguimiento activo y sale de OTRA fuente: la base SQLite de gestaciones
 * (bridge `gestacion-bridge.js`, handler `gestacion:getStats`).
 *
 * Por eso la carga es independiente: si SQLite no abre, la quinta card
 * muestra la raya y las cuatro de ausentismo siguen con sus números reales.
 * Un solo `try` compartido haría que un fallo de SQLite dejara las cinco en
 * raya, y eso miente: los casos de ausentismo sí se pudieron leer.
 *
 * LO QUE SE VERIFICA
 * -------------------
 *   1. El markup: la quinta card (id `gestionActivas`), su rótulo, su línea
 *      de detalle y el acento rosa que la distingue de las otras cuatro.
 *   2. El JS PINTA los valores: se extrae `loadGestionStats()` del ARCHIVO
 *      VIVO y se EJECUTA contra un DOM falso. No basta con que el texto
 *      exista en el archivo.
 *   3. La independencia: un fallo de gestión NO toca las cuatro cards de
 *      ausentismo.
 *   4. El tamaño: el home sube su tope de ancho y escala la tipografía con el
 *      ancho del iframe, y la rejilla de cinco cards se reparte por anchos.
 *   5. Mutaciones: cada una tiene que hacer caer al menos un check. Un check
 *      que nunca se ve fallar no es un check.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'ausentismo');
const JS_PATH = path.join(DIR, 'medicion-ausentismo-home.js');
const HTML_PATH = path.join(DIR, 'medicion-ausentismo-home.html');

const IDS_AUS = ['ausentismoTotal', 'ausentismoPendientes', 'ausentismoActivos', 'ausentismoCerrados'];
const ID_GESTION = 'gestionActivas';
const ID_DETALLE = 'gestionDetalle';
const RAYA = '\u2014'; // "—"

const checks = [];
function chk(name, cond, extra) {
  checks.push({ name: name, ok: !!cond, extra: extra || '' });
}

// ── extraer una funcion del archivo por nombre, emparejando llaves ─────────
// Se emparejan llaves contando niveles. Las llaves de `${...}` dentro de una
// plantilla se abren y se cierran, asi que no desbalancean el conteo.
function extraer(src, nombre) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + nombre + '\\s*\\(');
  const m = re.exec(src);
  if (!m) throw new Error('no se encontro la funcion ' + nombre);
  let i = src.indexOf('{', m.index);
  if (i < 0) throw new Error('la funcion ' + nombre + ' no tiene cuerpo');
  let nivel = 0;
  let fin = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') nivel++;
    else if (c === '}') {
      nivel--;
      if (nivel === 0) { fin = i + 1; break; }
    }
  }
  if (fin < 0) throw new Error('llaves sin cerrar en ' + nombre);
  return src.slice(m.index, fin);
}

// ── un elemento falso con lo que las funciones del home necesitan ──────────
// El `textContent` se coerciona a texto, como hace el DOM real: asignar un
// numero a `textContent` deja "4", no 4. Un DOM falso que no coerciona
// hace fallar a un codigo que en la app funciona.
function crearElemento(id) {
  const clases = new Set();
  const clasesPadre = new Set();
  const attrs = {};
  let texto = '';
  return {
    id: id,
    get textContent() { return texto; },
    set textContent(v) { texto = String(v); },
    attrs: attrs,
    classList: {
      add: function (c) { clases.add(c); },
      remove: function (c) { clases.delete(c); },
      contains: function (c) { return clases.has(c); }
    },
    parentElement: {
      classList: {
        add: function (c) { clasesPadre.add(c); },
        remove: function (c) { clasesPadre.delete(c); },
        contains: function (c) { return clasesPadre.has(c); }
      }
    },
    setAttribute: function (n, v) { attrs[n] = v; },
    removeAttribute: function (n) { delete attrs[n]; }
  };
}

// ── ejecutar el JS del archivo vivo contra un DOM falso ───────────────────
// `respuestaAus` es lo que contesta el handler de ausentismo.
// `respuestaGes` es lo que contesta el handler de gestion; con
// `modoGestion: 'lanza'` la base revienta con una excepcion.
async function ejecutar(jsSrc, respuestaAus, respuestaGes, modoGestion) {
  const dom = {};
  IDS_AUS.concat([ID_GESTION, ID_DETALLE]).forEach(function (id) { dom[id] = crearElemento(id); });

  const fuente = [
    extraer(jsSrc, 'safeSetTextContent'),
    extraer(jsSrc, 'markKpiAsUnavailable'),
    extraer(jsSrc, 'unmarkKpiAsUnavailable'),
    extraer(jsSrc, 'loadStats'),
    extraer(jsSrc, 'loadGestionStats')
  ].join('\n\n');

  const ctx = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    document: {
      getElementById: function (id) { return dom[id] || null; }
    },
    window: {
      electronAPI: {
        getAusentismoStats: async function () { return respuestaAus; },
        gestacionGetStats: async function () {
          if (modoGestion === 'lanza') throw new Error('base de datos no disponible');
          return respuestaGes;
        }
      }
    },
    getCompanyName: function () { return 'EMPRESA PRUEBA'; },
    ipcInvokeViaParent: async function () { return null; },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  vm.createContext(ctx);
  vm.runInContext(fuente, ctx);
  await ctx.loadStats();
  await ctx.loadGestionStats();
  return dom;
}

function marcada(el) {
  return !!(el && el.classList.contains('kpi-unavailable'));
}
function marcadaTarjeta(el) {
  return !!(el && el.parentElement && el.parentElement.classList.contains('kpi-card-unavailable'));
}
function titulo(el) {
  return (el && el.attrs && el.attrs.title) || '';
}

// ── los checks, sobre un par (js, html) cualquiera (asi se puede mutar) ───
async function correrCon(jsSrc, htmlSrc) {
  const c = [];
  function an(nombre, cond, extra) { c.push({ name: nombre, ok: !!cond, extra: extra || '' }); }

  // 1 · el markup
  an('HTML: la quinta card existe con id gestionActivas',
    htmlSrc.indexOf('id="' + ID_GESTION + '"') !== -1);
  an('HTML: la quinta card se rotula "Gestantes en Seguimiento"',
    /id="gestionActivas"[^>]*>[^<]*<\/div>\s*<div class="stat-label">Gestantes en Seguimiento<\/div>/.test(htmlSrc));
  an('HTML: la quinta card trae la linea de detalle (id gestionDetalle)',
    htmlSrc.indexOf('id="' + ID_DETALLE + '"') !== -1);
  an('HTML: la quinta card se distingue con el acento rosa (stat-item--gestion)',
    /class="stat-item stat-item--gestion"/.test(htmlSrc));
  an('HTML: el acento rosa usa el token --aus-pink (no un color suelto)',
    /\.stat-item--gestion\s*\{[^}]*--aus-pink/.test(htmlSrc));
  an('HTML: la rejilla del KPI tiene 5 columnas',
    /\.aus-kpis\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*1fr\)/.test(htmlSrc));
  const seccion = /<section class="aus-kpis">([\s\S]*?)<\/section>/.exec(htmlSrc);
  const nTarjetas = seccion ? (seccion[1].match(/class="stat-item/g) || []).length : 0;
  an('HTML: la seccion de KPIs tiene 5 tarjetas', nTarjetas === 5, nTarjetas + ' tarjetas');
  IDS_AUS.concat([ID_GESTION]).forEach(function (id) {
    an('HTML: el id ' + id + ' esta en el marcado', htmlSrc.indexOf('id="' + id + '"') !== -1);
  });

  // 2 · el JS pinta los valores (ejecutado, no leido)
  const ok = await ejecutar(jsSrc,
    { success: true, data: { pendientes: 6, activos: 0, cerrados: 1, total: 7 } },
    { success: true, data: { total: 9, activas: 4, enLicencia: 2, altoRiesgo: 2, proxLicencia: 1, cerradas: 3 } });
  an('JS: la quinta card pinta las gestantes en seguimiento (4)',
    ok[ID_GESTION].textContent === '4', 'leido: ' + JSON.stringify(ok[ID_GESTION].textContent));
  an('JS: la linea de detalle dice cuantas estan en alto riesgo (2 en alto riesgo)',
    ok[ID_DETALLE].textContent === '2 en alto riesgo', 'leido: ' + JSON.stringify(ok[ID_DETALLE].textContent));
  an('JS: con datos, la quinta card no queda marcada como no disponible',
    !marcada(ok[ID_GESTION]) && !marcadaTarjeta(ok[ID_GESTION]));

  const sinAlto = await ejecutar(jsSrc,
    { success: true, data: { pendientes: 6, activos: 0, cerrados: 1, total: 7 } },
    { success: true, data: { total: 5, activas: 5, enLicencia: 0, altoRiesgo: 0, proxLicencia: 0, cerradas: 0 } });
  an('JS: sin casos de alto riesgo, la linea de detalle lo dice',
    sinAlto[ID_DETALLE].textContent === 'Sin casos de alto riesgo',
    'leido: ' + JSON.stringify(sinAlto[ID_DETALLE].textContent));

  const sinActivas = await ejecutar(jsSrc,
    { success: true, data: { pendientes: 6, activos: 0, cerrados: 1, total: 7 } },
    { success: true, data: { total: 5, enLicencia: 0, altoRiesgo: 0, proxLicencia: 0, cerradas: 0 } });
  an('JS: si el handler no trae activas, la card muestra 0 y no "undefined"',
    sinActivas[ID_GESTION].textContent === '0',
    'leido: ' + JSON.stringify(sinActivas[ID_GESTION].textContent));

  // 3 · el modo degradado de gestion, y SU INDEPENDENCIA
  const nulo = await ejecutar(jsSrc,
    { success: true, data: { pendientes: 6, activos: 0, cerrados: 1, total: 7 } },
    null);
  an('JS: sin respuesta de gestion, la quinta card muestra la raya (no un 0)',
    nulo[ID_GESTION].textContent === RAYA, 'leido: ' + JSON.stringify(nulo[ID_GESTION].textContent));
  an('JS: sin respuesta de gestion, la linea de detalle muestra la raya',
    nulo[ID_DETALLE].textContent === RAYA, 'leido: ' + JSON.stringify(nulo[ID_DETALLE].textContent));
  an('JS: sin respuesta de gestion, la quinta card queda marcada como no disponible',
    marcada(nulo[ID_GESTION]) && marcadaTarjeta(nulo[ID_GESTION]));
  an('JS: el aviso de la quinta card NO es el del archivo de ausentismo',
    titulo(nulo[ID_GESTION]).length > 0 && !/ausentismo/i.test(titulo(nulo[ID_GESTION])),
    'titulo: ' + titulo(nulo[ID_GESTION]));

  const falla = await ejecutar(jsSrc,
    { success: true, data: { pendientes: 6, activos: 0, cerrados: 1, total: 7 } },
    null, 'lanza');
  an('JS: si la base revienta, la quinta card muestra la raya',
    falla[ID_GESTION].textContent === RAYA, 'leido: ' + JSON.stringify(falla[ID_GESTION].textContent));
  an('JS: si la base revienta, la quinta card queda marcada como no disponible',
    marcada(falla[ID_GESTION]) && marcadaTarjeta(falla[ID_GESTION]));

  // 4 · LA INDEPENDENCIA: un fallo de gestion no puede tocar las otras cuatro
  an('JS: sin respuesta de gestion, las CUATRO cards de ausentismo siguen con sus numeros (6 / 0 / 1)',
    nulo.ausentismoPendientes.textContent === '6' &&
    nulo.ausentismoActivos.textContent === '0' &&
    nulo.ausentismoCerrados.textContent === '1' &&
    nulo.ausentismoTotal.textContent === '7',
    'leido: ' + nulo.ausentismoTotal.textContent + ' / ' + nulo.ausentismoPendientes.textContent + ' / ' +
    nulo.ausentismoActivos.textContent + ' / ' + nulo.ausentismoCerrados.textContent);
  an('JS: sin respuesta de gestion, las cuatro cards de ausentismo NO se marcan como no disponibles',
    !marcada(nulo.ausentismoTotal) && !marcada(nulo.ausentismoPendientes) &&
    !marcada(nulo.ausentismoActivos) && !marcada(nulo.ausentismoCerrados));
  an('JS: si la base revienta, las CUATRO cards de ausentismo siguen con sus numeros',
    falla.ausentismoPendientes.textContent === '6' && falla.ausentismoCerrados.textContent === '1',
    'leido: ' + falla.ausentismoPendientes.textContent + ' / ' + falla.ausentismoCerrados.textContent);

  // 5 · el contrato del codigo
  an('JS: la quinta card se pide con el canal gestacionGetStats',
    /gestacionGetStats/.test(jsSrc) && /ipcInvokeViaParent\('gestacionGetStats'/.test(jsSrc));
  an('JS: la quinta card se pinta desde data.activas',
    /data\.activas != null \? data\.activas : 0/.test(jsSrc));
  an('JS: la carga de gestion es APARTE (existe loadGestionStats y se llama desde el portal)',
    /function loadGestionStats\s*\(/.test(jsSrc) && /loadGestionStats\(\)\.catch/.test(jsSrc));
  an('JS: la carga de ausentismo NO pinta la quinta card',
    !/safeSetTextContent\('gestionActivas'[^)]*\)/.test(
      extraer(jsSrc, 'loadStats')));
  an('JS: la quinta card se marca con su propio motivo en el modo degradado',
    /markKpiAsUnavailable\('gestionActivas',\s*MOTIVO\)/.test(jsSrc));

  // 6 · el tamano: el home aprovecha la ventana maximizada
  an('CSS: el main sube su tope de ancho a 1680px',
    /\.aus-main\s*\{[^}]*max-width:\s*1680px/.test(htmlSrc));
  an('CSS: la raiz escala la tipografia con el ancho de la ventana (clamp con tope)',
    /html\s*\{\s*font-size:\s*clamp\(16px,[^;]*20px\)[^}]*\}/.test(htmlSrc));
  an('CSS: el valor de la card esta en rem (escala con la raiz)',
    /\.stat-value\s*\{[^}]*font-size:\s*2rem/.test(htmlSrc));
  an('CSS: el rotulo de la card esta en rem (escala con la raiz)',
    /\.stat-label\s*\{[^}]*font-size:\s*0\.8125rem/.test(htmlSrc));
  an('CSS: el titulo de la vista esta en rem (escala con la raiz)',
    /\.aus-title\s*\{[^}]*font-size:\s*1\.25rem/.test(htmlSrc));
  an('CSS: las descripciones de las tarjetas estan en rem (escala con la raiz)',
    /\.action-desc\s*\{[^}]*font-size:\s*0\.85rem/.test(htmlSrc));
  an('CSS: no queda ninguna escala por variable (una escala con vw NO es valida)',
    !/--aus-scale/.test(htmlSrc) && !/var\(--aus-scale\)/.test(htmlSrc));
  an('CSS: la rejilla de cinco cards se reparte en 5 / 3 / 2 / 1 segun el ancho',
    /@media \(max-width: 1200px\)\s*\{\s*\.aus-kpis \{ grid-template-columns: repeat\(3, 1fr\); \}/.test(htmlSrc) &&
    /@media \(max-width: 820px\)\s*\{\s*\.aus-kpis \{ grid-template-columns: repeat\(2, 1fr\); \}/.test(htmlSrc) &&
    /\.aus-kpis \{ grid-template-columns: 1fr; \}/.test(htmlSrc));
  an('CSS: las herramientas usan un ancho minimo mayor (300px)',
    /\.actions-grid\s*\{[^}]*minmax\(300px,\s*1fr\)/.test(htmlSrc));

  return c;
}

// ── mutaciones: cada una tiene que hacer caer al menos un check ───────────
const jsReal = fs.readFileSync(JS_PATH, 'utf8');
const htmlReal = fs.readFileSync(HTML_PATH, 'utf8');

const MUTACIONES = [
  ['la quinta card no se pinta',
    jsReal.split("safeSetTextContent('gestionActivas', String(activas), false);").join(''),
    htmlReal],
  ['la quinta card lee una clave que no existe',
    jsReal.split('data.activas').join('data.activa'),
    htmlReal],
  ['la quinta card no se marca en el modo degradado',
    jsReal.split("markKpiAsUnavailable('gestionActivas', MOTIVO);").join(''),
    htmlReal],
  ['la carga de ausentismo se come la quinta card',
    jsReal.split("safeSetTextContent('ausentismoTotal', tVal, false);")
      .join("safeSetTextContent('ausentismoTotal', tVal, false);\n            safeSetTextContent('gestionActivas', '99', false);"),
    htmlReal],
  ['la carga de gestion nunca se llama',
    jsReal.split('loadGestionStats().catch').join('nadaQueLlamar().catch'),
    htmlReal],
  ['la quinta card desaparece del markup',
    jsReal,
    htmlReal.split(/\s*<div class="stat-item stat-item--gestion">[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/).join('\n        </section>')],
  ['la rejilla se queda en 4 columnas',
    jsReal,
    htmlReal.split('repeat(5, 1fr)').join('repeat(4, 1fr)')],
  ['el main vuelve al tope de 1120px',
    jsReal,
    htmlReal.split('max-width: 1680px').join('max-width: 1120px')],
  ['la escala tipografica desaparece',
    jsReal,
    htmlReal.split('html { font-size: clamp(16px, calc(0.95vw + 4px), 20px); }').join('')],
  ['la escala vuelve a ser una variable (invalida: vw + numero)',
    jsReal,
    htmlReal.split('html { font-size: clamp(16px, calc(0.95vw + 4px), 20px); }')
      .join('--aus-scale: clamp(1, calc(0.0333vw + 0.7), 1.3);\n        html { font-size: clamp(16px, calc(0.95vw + 4px), 20px); }')],
  ['la tipografia se queda en px (no escala con la raiz)',
    jsReal,
    htmlReal.split('.stat-value {').join('.stat-value { /* px */').split('font-size: 2rem;').join('font-size: 32px;')],
];

(async function () {
  const base = await correrCon(jsReal, htmlReal);
  base.forEach(function (c) { chk(c.name, c.ok, c.extra); });

  for (const m of MUTACIONES) {
    const nombre = m[0];
    const mutJs = m[1];
    const mutHtml = m[2];
    if (mutJs === jsReal && mutHtml === htmlReal) {
      chk('MUTANTE detectado: ' + nombre, false, 'la mutacion no cambio el codigo (patron desfasado)');
      continue;
    }
    let fallo = false;
    try {
      const res = await correrCon(mutJs, mutHtml);
      fallo = res.some(function (c) { return !c.ok; });
    } catch (e) {
      fallo = true; // el mutante lanzo: tambien es detectado
    }
    chk('MUTANTE detectado: ' + nombre, fallo);
  }

  correr();
})();

// ── salida ─────────────────────────────────────────────────────────────────
function correr() {
  let failed = 0;
  console.log('\n=======================================');
  console.log('  📦 · La quinta card del home de ausentismo y su tamano');
  console.log('=======================================');
  checks.forEach(function (c) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}
