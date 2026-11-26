/* main/test-ausentismo-kpi-total.js
 * La cuarta card de "Medición del Ausentismo": "Total de Casos".
 *
 * EL PORQUÉ
 * ----------
 * Las tres cards del home (Casos Pendientes / Activos / Cerrados) salen del
 * handler `get-ausentismo-stats` (main.js), que cruza GI-FO-076 con PRI.xlsx.
 * Ese handler YA devuelve `total` —el denominador, 6+0+1 = 7— y la vista no
 * lo mostraba. Esta card pinta ese `total`.
 *
 * LO QUE SE VERIFICA
 * -------------------
 *   1. El HTML tiene la cuarta card (id `ausentismoTotal`, rótulo "Total de
 *      Casos") y la rejilla del KPI es de 4 columnas.
 *   2. El JS PINTA el valor. Aquí no basta con que el texto exista: se extrae
 *      `loadStats()` del ARCHIVO VIVO y se EJECUTA contra un DOM falso, con la
 *      respuesta real del handler. Se comprueba que la cuarta card recibe "7".
 *   3. El modo degradado (📦459) marca las CUATRO cards con "—" y con la marca
 *      de "no disponible": un KPI que muestra "0" cuando no se pudo leer el
 *      archivo miente, y por eso existe ese modo.
 *   4. Mutaciones: cada una tiene que hacer caer al menos un check. Un check que
 *      nunca se ve fallar no es un check.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'modules', 'gestion-salud', 'ausentismo');
const JS_PATH = path.join(DIR, 'medicion-ausentismo-home.js');
const HTML_PATH = path.join(DIR, 'medicion-ausentismo-home.html');

const IDS = ['ausentismoTotal', 'ausentismoPendientes', 'ausentismoActivos', 'ausentismoCerrados'];
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
// numero a `textContent` deja "7", no 7. Un DOM falso que no coerciona
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

// ── ejecutar loadStats() del archivo vivo contra un DOM falso ──────────────
async function ejecutar(jsSrc, respuesta) {
  const dom = {};
  IDS.forEach(function (id) { dom[id] = crearElemento(id); });

  const fuente = [
    extraer(jsSrc, 'safeSetTextContent'),
    extraer(jsSrc, 'markKpiAsUnavailable'),
    extraer(jsSrc, 'unmarkKpiAsUnavailable'),
    extraer(jsSrc, 'loadStats')
  ].join('\n\n');

  const ctx = {
    console: { log: function () {}, warn: function () {}, error: function () {} },
    document: {
      getElementById: function (id) { return dom[id] || null; }
    },
    window: {
      electronAPI: {
        getAusentismoStats: async function () { return respuesta; }
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
  return dom;
}

function marcada(el) {
  return !!(el && el.classList.contains('kpi-unavailable'));
}
function marcadaTarjeta(el) {
  return !!(el && el.parentElement && el.parentElement.classList.contains('kpi-card-unavailable'));
}

// ── los checks, sobre un par (js, html) cualquiera (asi se puede mutar) ───
async function correrCon(jsSrc, htmlSrc) {
  const c = [];
  function an(nombre, cond, extra) { c.push({ name: nombre, ok: !!cond, extra: extra || '' }); }

  // 1 · el markup
  an('HTML: la cuarta card existe con id ausentismoTotal',
    /id="ausentismoTotal"/.test(htmlSrc));
  an('HTML: la cuarta card se rotula "Total de Casos"',
    /id="ausentismoTotal"[^>]*>[^<]*<\/div>\s*<div class="stat-label">Total de Casos<\/div>/.test(htmlSrc));
  an('HTML: la rejilla del KPI tiene 5 columnas',
    /\.aus-kpis\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*1fr\)/.test(htmlSrc));
  const seccion = /<section class="aus-kpis">([\s\S]*?)<\/section>/.exec(htmlSrc);
  an('HTML: la seccion de KPIs tiene 5 tarjetas',
    !!seccion && (seccion[1].match(/class="stat-item/g) || []).length === 5,
    seccion ? String((seccion[1].match(/class="stat-item/g) || []).length) + ' tarjetas' : 'no se encontro la seccion');
  IDS.forEach(function (id) {
    an('HTML: el id ' + id + ' esta en el markup', htmlSrc.indexOf('id="' + id + '"') !== -1);
  });

  // 2 · el JS pinta el valor (ejecutado, no leido)
  const datos = await ejecutar(jsSrc, {
    success: true,
    data: { pendientes: 6, activos: 0, cerrados: 1, total: 7 }
  });
  an('JS: la cuarta card pinta el total (7)', datos.ausentismoTotal.textContent === '7',
    'leido: ' + JSON.stringify(datos.ausentismoTotal.textContent));
  an('JS: las otras tres cards siguen igual (6 / 0 / 1)',
    datos.ausentismoPendientes.textContent === '6' &&
    datos.ausentismoActivos.textContent === '0' &&
    datos.ausentismoCerrados.textContent === '1',
    'leido: ' + datos.ausentismoPendientes.textContent + ' / ' +
    datos.ausentismoActivos.textContent + ' / ' + datos.ausentismoCerrados.textContent);
  an('JS: con datos, ninguna card queda marcada como no disponible',
    !marcada(datos.ausentismoTotal) && !marcada(datos.ausentismoPendientes) &&
    !marcada(datos.ausentismoActivos) && !marcada(datos.ausentismoCerrados));

  // 3 · el total ausente no puede pintar "undefined"
  const sinTotal = await ejecutar(jsSrc, {
    success: true,
    data: { pendientes: 6, activos: 0, cerrados: 1 }
  });
  an('JS: si el handler no trae total, la card muestra 0 y no "undefined"',
    sinTotal.ausentismoTotal.textContent === '0',
    'leido: ' + JSON.stringify(sinTotal.ausentismoTotal.textContent));

  // 4 · el modo degradado: las CUATRO cards con raya y marcadas
  const degradado = await ejecutar(jsSrc, {
    success: true,
    data: { pendientes: 0, activos: 0, cerrados: 0, total: 0, _missingFile: true, _missingFileReason: 'not_found' }
  });
  an('JS: sin archivo, la cuarta card muestra la raya (no un 0)',
    degradado.ausentismoTotal.textContent === RAYA,
    'leido: ' + JSON.stringify(degradado.ausentismoTotal.textContent));
  an('JS: sin archivo, las cuatro cards quedan marcadas como no disponibles',
    IDS.every(function (id) { return marcada(degradado[id]); }),
    IDS.filter(function (id) { return !marcada(degradado[id]); }).join(', ') || 'las cuatro');
  an('JS: sin archivo, las cuatro tarjetas quedan marcadas (el aviso de la card)',
    IDS.every(function (id) { return marcadaTarjeta(degradado[id]); }));

  // 5 · sin respuesta (proxy caido) tambien es modo degradado
  const nulo = await ejecutar(jsSrc, null);
  an('JS: sin respuesta del todo, la cuarta card muestra la raya',
    nulo.ausentismoTotal.textContent === RAYA,
    'leido: ' + JSON.stringify(nulo.ausentismoTotal.textContent));
  an('JS: sin respuesta del todo, las cuatro cards quedan marcadas',
    IDS.every(function (id) { return marcada(nulo[id]); }));

  // 6 · el contrato del codigo
  an('JS: la cuarta card se pinta desde data.total',
    /const tVal = data\.total != null \? data\.total : '0'/.test(jsSrc));
  an('JS: la marca de "no disponible" se quita cuando los datos vuelven',
    /unmarkKpiAsUnavailable\('ausentismoTotal'\)/.test(jsSrc));

  return c;
}

// ── mutaciones: cada una tiene que hacer caer al menos un check ───────────
const jsReal = fs.readFileSync(JS_PATH, 'utf8');
const htmlReal = fs.readFileSync(HTML_PATH, 'utf8');

const MUTACIONES = [
  ['la cuarta card no se pinta',
    jsReal.replace("safeSetTextContent('ausentismoTotal', tVal, false);", ''),
    htmlReal],
  ['la cuarta card lee una clave que no existe',
    jsReal.replace('data.total', 'data.totl'),
    htmlReal],
  ['la cuarta card no se marca en el modo degradado',
    jsReal.replace("markKpiAsUnavailable('ausentismoTotal');", ''),
    htmlReal],
  ['la rejilla se queda en 4 columnas',
    jsReal,
    htmlReal.split('repeat(5, 1fr)').join('repeat(4, 1fr)')],
  ['la cuarta card desaparece del markup',
    jsReal,
    htmlReal.replace(/<div class="stat-item">\s*<div class="stat-value" id="ausentismoTotal">0<\/div>\s*<div class="stat-label">Total de Casos<\/div>\s*<\/div>\s*/, '')]
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
  console.log('  📦 · La cuarta card del home de ausentismo');
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
