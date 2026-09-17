/* ============================================================
 * K+AIR · Smoke test — El gráfico NO se sale de su tarjeta (📦757 + 📦758)
 * ============================================================
 * Bug real reportado con captura: en "Ejecución del Plan Anual" (home de Gestión
 * Integral) se veían líneas y cuadros FUERA del cuadro contenedor.
 *
 * Causa 1 (📦757): el área del gráfico (`.kair-chart`) mide 130-170px de alto y su SVG
 * se posiciona absoluto ocupando toda la caja. Pero 3 módulos generaban el SVG con
 * `style="width:100%;height:auto;display:block"`: el estilo EN LÍNEA le gana al CSS, así
 * que el SVG quedaba más alto que su caja y se derramaba sobre el borde de la tarjeta.
 *
 * Causa 2 (📦758): aunque el SVG ya entraba en la caja, seguía viéndose mal: el texto
 * (título y "36%") se encimaba sobre las etiquetas de abajo. El SVG usaba
 * `preserveAspectRatio="none"`, es decir "estirá el dibujo para llenar la caja": al
 * cambiar el ancho de la tarjeta, TODO se deforma — el texto se estira a lo ancho y se
 * aplasta a lo alto, y las medidas internas (viewBox 690x170) dejan de coincidir con el
 * tamaño real de la caja. Una barra es una CAJA, no una forma libre: por eso los 3
 * gráficos de barras ahora se dibujan con cajas HTML (`.kair-bar-chart`), que se ven
 * exactas a cualquier ancho y nunca se salen.
 *
 * Valida: (1) ningún gráfico usa alto/ancho en línea que pelee con el CSS,
 * (2) ningún gráfico estira su dibujo con `preserveAspectRatio="none"`,
 * (3) los 3 gráficos de barras usan el componente HTML,
 * (4) el área del gráfico recorta lo que se dibuje dentro, (5) cache-bust.
 *
 * Correr con: node main/test-chart-overflow.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const components = fs.readFileSync(path.join(root, 'shared', 'kair-components.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const MODULOS = [
  'modules/gestion-integral/gestion-integral-home.js',
  'modules/gestion-peligros/gestion-peligros-home.js',
  'modules/gestion-salud/gestion-salud-home.js',
  'modules/recursos/recursos-home.js',
  'modules/gestion-amenazas/gestion-amenazas-home.js',
  'modules/mejoramiento/mejoramiento-home.js',
  'modules/verificacion/verificacion-home.js'
];

// Saca las líneas de comentario para no confundir código con documentación
function codeOnly(src) {
  return src.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
}
function readMod(rel) { return codeOnly(fs.readFileSync(path.join(root, rel), 'utf8')); }
function ruleBlock(css, selector) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = clean.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
}

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }

// ── 1. Ningún SVG de gráfico pone width/height en línea ──────────
let conAltoEnLinea = [];
MODULOS.forEach(function (rel) {
  if (/style="[^"]*height\s*:\s*auto/.test(readMod(rel))) conAltoEnLinea.push(rel);
});
check('JS: ningún gráfico usa height:auto en línea (peleaba con el CSS del área)', conAltoEnLinea.length === 0,
  conAltoEnLinea.join(', '));

let conAnchoEnLinea = [];
MODULOS.forEach(function (rel) {
  if (/<svg[^>]*style="[^"]*width\s*:/.test(readMod(rel))) conAnchoEnLinea.push(rel);
});
check('JS: ningún SVG fija su ancho en línea (lo pone el CSS)', conAnchoEnLinea.length === 0,
  conAnchoEnLinea.join(', '));

// ── 2. Ningún gráfico deforma su texto por estirar el dibujo ─────
// `preserveAspectRatio="none"` = "estirá el dibujo para llenar la caja": al cambiar el
// ancho de la tarjeta TODO se deforma (el texto se estira a lo ancho y se aplasta a lo
// alto). Para las barras se resolvió dibujándolas con cajas HTML; para el gráfico de
// líneas de Recursos, sacando los nombres de los meses del dibujo.
let conEstirado = [];
MODULOS.forEach(function (rel) {
  if (/preserveAspectRatio\s*=\s*["']none["']/.test(readMod(rel))) conEstirado.push(rel);
});
check('JS: ningún gráfico estira su dibujo con preserveAspectRatio="none" (deformaba el texto)',
  conEstirado.length === 0, conEstirado.join(', '));

let conTextoEnSvg = [];
MODULOS.forEach(function (rel) {
  if (/<svg[\s\S]{0,2000}?<text/.test(readMod(rel))) conTextoEnSvg.push(rel);
});
check('JS: ningún gráfico escribe texto DENTRO del dibujo (<text>): iba encima de las etiquetas',
  conTextoEnSvg.length === 0, conTextoEnSvg.join(', '));

// ── 3. Los 6 gráficos de barras usan el componente HTML ──────────
const GRAFICOS_BARRAS = [
  { rel: 'modules/gestion-integral/gestion-integral-home.js', nombre: 'Integral (Ejecución del Plan Anual)' },
  { rel: 'modules/gestion-peligros/gestion-peligros-home.js', nombre: 'Peligros (Cumplimiento por área)' },
  { rel: 'modules/gestion-salud/gestion-salud-home.js', nombre: 'Salud (Indicadores)' },
  { rel: 'modules/recursos/recursos-home.js', nombre: 'Recursos (Ejecución presupuestal)' },
  { rel: 'modules/gestion-amenazas/gestion-amenazas-home.js', nombre: 'Amenazas (Cobertura documental)' },
  { rel: 'modules/mejoramiento/mejoramiento-home.js', nombre: 'Mejoramiento (Acciones por estado)' },
  { rel: 'modules/verificacion/verificacion-home.js', nombre: 'Verificación (Cumplimiento por submódulo)' }
];
let sinComponente = [];
let sinCajaFlexible = [];
GRAFICOS_BARRAS.forEach(function (g) {
  const src = readMod(g.rel);
  if (src.indexOf('kair-bar-chart') < 0) sinComponente.push(g.nombre);
  if (src.indexOf('kair-chart--flow') < 0) sinCajaFlexible.push(g.nombre);
});
check('JS: los 7 homes dibujan sus barras con el componente HTML .kair-bar-chart',
  sinComponente.length === 0, sinComponente.join(', '));
check('JS: los 7 homes marcan la caja del gráfico con .kair-chart--flow (alto según contenido)',
  sinCajaFlexible.length === 0, sinCajaFlexible.join(', '));

// Ninguna barra se dibuja con la etiqueta de texto de SVG
let conTextoDeSvg = [];
GRAFICOS_BARRAS.forEach(function (g) {
  const src = readMod(g.rel);
  if (/<svg[\s\S]{0,900}?<text/.test(src)) conTextoDeSvg.push(g.rel);
});
check('JS: ninguna barra dibuja su texto con SVG <text> (ahí se encimaba)', conTextoDeSvg.length === 0,
  conTextoDeSvg.join(', '));

// ── 4. El componente de barras está en el design system ──────────
const barChart = ruleBlock(components, '.kair-bar-chart');
check('CSS: .kair-bar-chart existe en el design system premium', barChart.length > 0);
const barTrack = ruleBlock(components, '.kair-bar-chart__track');
check('CSS: la barra (track) recorta su relleno y tiene radio pill',
  /overflow:\s*hidden/.test(barTrack) && /border-radius:\s*var\(--kair-radius-pill/.test(barTrack));
const barRow = ruleBlock(components, '.kair-bar-chart__row');
check('CSS: cada fila es label + barra + valor en 3 columnas que NO se pisan',
  /grid-template-columns:/.test(barRow));
check('CSS: el valor no se parte en dos líneas (white-space: nowrap)',
  /white-space:\s*nowrap/.test(ruleBlock(components, '.kair-bar-chart__value')));
const barFlow = ruleBlock(components, '.kair-chart--flow');
check('CSS: .kair-chart--flow deja que el alto lo ponga el contenido (height: auto)',
  /height:\s*auto/.test(barFlow));

// ── 5. El área del gráfico recorta lo que se dibuja dentro ───────
const kairChart = ruleBlock(components, '.kair-chart');
check('CSS: .kair-chart recorta su contenido (overflow: hidden)', /overflow:\s*hidden/.test(kairChart));
check('CSS: .kair-chart tiene radio (las líneas no tocan las esquinas de la card)',
  /border-radius:\s*10px/.test(kairChart));
check('CSS: .kair-chart mantiene la altura acotada (clamp 130-170px)',
  /height:\s*clamp\(130px, 13vw, 170px\)/.test(kairChart));
check('CSS: .kair-chart sigue siendo el bloque contenedor del SVG (position: relative)',
  /position:\s*relative/.test(kairChart));

const chartSvg = ruleBlock(components, '.kair-chart svg');
check('CSS: el SVG ocupa toda la caja del gráfico (100% x 100% + inset 0)',
  /width:\s*100%/.test(chartSvg) && /height:\s*100%/.test(chartSvg) &&
  /position:\s*absolute/.test(chartSvg) && /inset:\s*0/.test(chartSvg));

// ── 6. Cache-bust de TODO lo que cambió ─────────────────────────
check('Cache-bust: kair-components.css con ?v= nuevo (📦758)',
  /kair-components\.css\?v=20260918-bar-chart-html/.test(html));

const homes = {
  'gestion-integral': 'GESTION-INTEGRAL-20260918-bar-chart-html',
  'gestion-peligros': 'GESTION-PELIGROS-20260918-bar-chart-html',
  'gestion-salud': 'GESTION-SALUD-20260918-bar-chart-html',
  'recursos': 'RECURSOS-20260918-bar-chart-html',
  'gestion-amenazas': 'GESTION-AMENAZAS-20260918-bar-chart-html',
  'verificacion': 'VERIFICACION-20260918-bar-chart-html',
  'mejoramiento': 'MEJORAMIENTO-20260918-bar-chart-html'
};
let sinBump = [];
Object.keys(homes).forEach(function (mod) {
  if (html.indexOf(homes[mod]) < 0) sinBump.push(mod);
});
check('Cache-bust: los 7 homes de módulo tienen ?v= actualizado (📦756 + 📦757 + 📦758)',
  sinBump.length === 0, sinBump.join(', '));
check('Cache-bust: styles.css y kair-skeleton.js siguen versionados',
  /styles\.css\?v=20260918-skeleton-encaje/.test(html) &&
  /kair-skeleton\.js\?v=20260918-skeleton-encaje/.test(html));

// ── Reporte ──────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ El gráfico no se sale de su tarjeta ni deforma su texto');
