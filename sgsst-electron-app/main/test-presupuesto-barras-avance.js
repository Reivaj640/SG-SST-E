// test-presupuesto-barras-avance.js
// Las 3 métricas de la vista de gestión de presupuesto deben seguir el patrón
// de las tarjetas de Recursos (rótulo → valor → descripción → barra).
//
// ── Por qué este test existe ────────────────────────────────────────────────
// `shared/kair-components.css` define `.kair-metric-card` como "KPI con título
// + valor + progress bar", y `design_system.md` lo dice igual. Las tarjetas de
// Recursos (recursos-home.js → renderMetricCard) lo cumplen. Las 3 de la vista
// de presupuesto se construyeron a mano y quedaron con solo 2 de las 4 piezas:
// el rótulo y el valor. Sin descripción y sin barra, el usuario ve tres cifras
// sin contexto y sin avance, que es justo lo que el patrón evita.
//
// Qué comprueba, todo por CONTENIDO (nunca por número de línea: un control que
// apunta a una posición se rompe en cuanto el documento crece):
//   1. Las 3 tarjetas tienen las 4 piezas, con el orden del patrón.
//   2. Los ids de valor, descripción y barra existen y son únicos.
//   3. updateSummary() escribe el ancho de las 3 barras y el texto de las 2
//      descripciones.
//   4. El ancho se acota a 0-100 (una sobre-ejecución no puede desbordarla).
//   5. El semáforo es el de Recursos: >=70 verde, >=40 ámbar, <40 rojo, y las
//      clases se QUITAN antes de volver a ponerlas.
//   6. El HERO no se tocó: sigue con su score y no le colgaron barra ni
//      descripción.
//   7. La barra del saldo usa un token del design system, no un color fijo.
//
// Uso: node main/test-presupuesto-barras-avance.js

'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const GESTION = path.join(RAIZ, 'modules', 'recursos', 'presupuesto', 'presupuesto-gestion.html');
const COMPONENTES = path.join(RAIZ, 'shared', 'kair-components.css');

const checks = [];
function ok(n, c, e) { checks.push({ name: n, ok: !!c, extra: e }); }

const html = fs.readFileSync(GESTION, 'utf8');
const css = fs.readFileSync(COMPONENTES, 'utf8');

// ── 1) Las 4 piezas, en el orden del patrón ─────────────────────────────────
function tarjetaCompleta(valorId, descId, barraId) {
  const re = new RegExp(
    '<div class="kair-metric-card[^"]*"[^>]*>\\s*' +
    '<div class="kair-metric-head">[^<]*</div>\\s*' +
    '<div class="kair-metric-value" id="' + valorId + '">[^<]*</div>\\s*' +
    '<p class="kair-metric-desc" id="' + descId + '">[^<]*</p>\\s*' +
    '<div class="kair-progress"><i id="' + barraId + '"[^>]*></i></div>\\s*' +
    '</div>'
  );
  return re.test(html);
}

ok('1) la tarjeta de Presupuesto Total tiene rótulo, valor, descripción y barra',
  tarjetaCompleta('totalPresupuesto', 'descTotalPresupuesto', 'barraTotalPresupuesto'));
ok('1) la tarjeta de Ejecutado tiene rótulo, valor, descripción y barra',
  tarjetaCompleta('totalEmpresa', 'descEjecutado', 'barraEjecutado'));
ok('1) la tarjeta de Saldo Disponible tiene rótulo, valor, descripción y barra',
  tarjetaCompleta('saldoDisponible', 'descSaldo', 'barraSaldo'));

// ── 2) Los ids existen y son únicos ─────────────────────────────────────────
const IDS = ['descTotalPresupuesto', 'barraTotalPresupuesto', 'descEjecutado',
  'barraEjecutado', 'descSaldo', 'barraSaldo', 'cardEjecutado'];
const repetidos = IDS.filter((id) => (html.match(new RegExp('id="' + id + '"', 'g')) || []).length !== 1);
ok('2) cada id de descripción y barra existe exactamente una vez',
  repetidos.length === 0, repetidos.join(', '));

// ── 3) updateSummary() rellena las barras y las descripciones ──────────────
const fn = html.split('function updateSummary()')[1] || '';
const cuerpo = fn.split('function ')[0];
ok('3) updateSummary() escribe el ancho de las 3 barras',
  ['barraTotalPresupuesto', 'barraEjecutado', 'barraSaldo']
    .every((id) => cuerpo.indexOf("getElementById('" + id + "').style.width") !== -1));
ok('3) updateSummary() escribe el texto de las 2 descripciones',
  ['descEjecutado', 'descSaldo']
    .every((id) => cuerpo.indexOf("getElementById('" + id + "').textContent") !== -1));

// ── 4) El ancho se acota a 0-100 ────────────────────────────────────────────
ok('4) el ancho se acota (Math.min 100 y Math.max 0)',
  /Math\.max\(0,\s*Math\.min\(100,/.test(cuerpo));

// ── 5) El semáforo es el de Recursos y se recalcula limpio ─────────────────
ok('5) el semáforo quita las dos variantes antes de volver a ponerlas',
  /classList\.remove\([^)]*--warning[^)]*--danger/.test(cuerpo));
ok('5) el semáforo usa los umbrales 40 (rojo) y 70 (ámbar)',
  /pctEjecucion\s*<\s*40/.test(cuerpo) && /pctEjecucion\s*<\s*70/.test(cuerpo));
ok('5) el design system tiene las variantes de color de la barra',
  /\.kair-metric-card--danger\s+\.kair-progress\s+i/.test(css) &&
  /\.kair-metric-card--warning\s+\.kair-progress\s+i/.test(css));

// ── 6) El hero no se tocó ───────────────────────────────────────────────────
// El bloque del hero va del inicio del hero hasta la primera tarjeta de
// métrica: así el corte no depende de cuántos <div> anidados tenga el hero.
const iHero = html.indexOf('<div class="kair-hero-card">');
const iCards = html.indexOf('<div class="kair-metric-card');
const hero = (iHero !== -1 && iCards > iHero) ? html.slice(iHero, iCards) : '';
ok('6) el hero conserva su score (% de cumplimiento)',
  /pres-hero-score/.test(hero) && /id="totalArl"/.test(hero), 'hero=' + hero.length + ' chars');
ok('6) al hero no le colgaron barra ni descripción',
  hero.indexOf('kair-progress') === -1 && hero.indexOf('kair-metric-desc') === -1);

// ── 7) La barra del saldo usa un token, no un color fijo ───────────────────
const reglaSaldo = (html.match(/\.kair-metric-card--saldo[^{]*\{[^}]*\}/) || [''])[0];
ok('7) la barra del saldo usa el token --kair-slate',
  /var\(--kair-slate\)/.test(reglaSaldo), reglaSaldo.trim());
ok('7) la barra del saldo no lleva un color fijo',
  !/#[0-9a-fA-F]{3,8}\b/.test(reglaSaldo), reglaSaldo.trim());

let failed = 0;
console.log('\n=======================================');
checks.forEach((c) => {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
