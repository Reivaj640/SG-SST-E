/* ============================================================
 * K+AIR · Smoke test — Encaje del ESQUELETO con el contenido real (📦756)
 * ============================================================
 * Valida que el bloque sombreado que se ve mientras cargan los datos ocupe
 * EXACTAMENTE el mismo espacio que el contenido que lo reemplaza, en cada
 * módulo y submódulo. Si el esqueleto tiene otro radio / padding / alto / gap,
 * al llegar los datos todo salta de lugar.
 *
 * Es un test de estructura (no de runtime): lee los archivos y compara las
 * medidas reales contra las del esqueleto.
 * Correr con: node main/test-skeleton-encaje.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skeleton = fs.readFileSync(path.join(root, 'shared', 'kair-skeleton.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const components = fs.readFileSync(path.join(root, 'shared', 'kair-components.css'), 'utf8');
const mantCss = fs.readFileSync(path.join(root, 'modules', 'gestion-peligros', 'mantenimiento', 'mantenimiento.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const HOMES = [
  'modules/gestion-amenazas/gestion-amenazas-home.js',
  'modules/gestion-integral/gestion-integral-home.js',
  'modules/gestion-peligros/gestion-peligros-home.js',
  'modules/gestion-salud/gestion-salud-home.js',
  'modules/mejoramiento/mejoramiento-home.js',
  'modules/verificacion/verificacion-home.js',
  'modules/recursos/recursos-home.js'
];
const homeSrc = {};
HOMES.forEach(function (h) {
  homeSrc[h] = fs.readFileSync(path.join(root, h), 'utf8');
});

// Helpers para extraer una medida de una regla CSS
// (se quitan los comentarios primero: los ejemplos de uso dentro de comentarios
//  contienen selectores y romperían la extracción de la regla real)
function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }
function ruleBlock(css, selector) {
  const clean = stripComments(css);
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
  const m = clean.match(re);
  return m ? m[1] : '';
}
function decl(block, prop) {
  const m = block.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
  return m ? m[1].trim() : '';
}
// Quita las líneas de comentario de JS (para no confundir código con ejemplos)
function codeOnly(src) {
  return src.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
}

const checks = [];
function check(name, ok) { checks.push({ name: name, ok: !!ok }); }

// ── 1. El generador de esqueleto del home existe y usa las clases REALES ──
check('JS: KairSkeleton.home() / homeHero / homeContent / homeModules existen',
  /function home\(opts\)/.test(skeleton) &&
  /function homeHero\(metrics\)/.test(skeleton) &&
  /function homeContent\(opts\)/.test(skeleton) &&
  /function homeModules\(count\)/.test(skeleton));
check('JS: el esqueleto del home usa .kair-health (contenedor real)',
  /'<section class="kair-health">'/.test(skeleton));
check('JS: el hero del esqueleto usa .kair-hero-card (misma tarjeta oscura)',
  /<article class="kair-hero-card">/.test(skeleton));
check('JS: las métricas del esqueleto usan .kair-metric-card',
  /<article class="kair-metric-card">/.test(skeleton));
check('JS: el esqueleto de contenido usa .kair-content + .kair-card + .kair-chart + .kair-legend',
  /<section class="kair-content">/.test(skeleton) &&
  /<article class="kair-card">/.test(skeleton) &&
  /<div class="kair-chart">/.test(skeleton) &&
  /<div class="kair-legend">/.test(skeleton));
check('JS: las filas laterales usan .kair-task + .kair-task-icon',
  /<div class="kair-task">/.test(skeleton) && /kair-task-icon/.test(skeleton));
check('JS: la grilla de submódulos usa .kair-modules + .kair-module-grid + .kair-module',
  /<section class="kair-modules">/.test(skeleton) &&
  /<div class="kair-module-grid">/.test(skeleton) &&
  /<article class="kair-module">/.test(skeleton));
check('JS: los nuevos generadores están en la API pública',
  /home: home,/.test(skeleton) && /metricStrip: metricStrip,/.test(skeleton) && /taskRows: taskRows,/.test(skeleton));
check('JS: versión del helper subida a 1.1.0', /version: '1\.1\.0'/.test(skeleton));

// ── 2. Los 7 homes usan el esqueleto que encaja ──────────────────
let homesOk = 0;
HOMES.forEach(function (h) {
  const src = codeOnly(homeSrc[h]);
  if (/mainArea\.innerHTML = KairSkeleton\.home\(/.test(src) &&
      !/KairSkeleton\.kpiStrip\(/.test(src)) homesOk++;
});
check('HOMES: los 7 módulos usan KairSkeleton.home() (no kpiStrip) — ' + homesOk + '/7',
  homesOk === HOMES.length);

// ── 3. El CSS del esqueleto coincide con las tarjetas reales ─────
const ksStrip = ruleBlock(styles, '.ks-kpi-strip');
const ksCard = ruleBlock(styles, '.ks-kpi-card');
const kairHealth = ruleBlock(components, '.kair-health');
const kairMetric = ruleBlock(components, '.kair-metric-card');

check('CSS: .ks-kpi-strip usa el MISMO gutter lateral que .kair-health',
  decl(ksStrip, 'padding') === decl(kairHealth, 'padding') &&
  decl(ksStrip, 'padding') === '0 clamp(4px, 0.6vw, 8px)');
check('CSS: .ks-kpi-strip usa el MISMO gap que .kair-health',
  decl(ksStrip, 'gap') === 'var(--ks-kpi-gap, ' + decl(kairHealth, 'gap') + ')');
check('CSS: .ks-kpi-strip ya no tiene el margin-bottom 24px suelto',
  decl(ksStrip, 'margin-bottom') === 'var(--ks-kpi-mb, 0)');
check('CSS: .ks-kpi-card hereda el radio real (--kair-radius-card 20px)',
  /--ks-kpi-radius, var\(--kair-radius-card, 20px\)/.test(ksCard));
check('CSS: .ks-kpi-card es columna (igual que .kair-metric-card)',
  /flex-direction:\s*column/.test(ksCard) && /flex-direction:\s*column/.test(kairMetric));
check('CSS: .ks-kpi-card usa el alto mínimo real (clamp 110-140)',
  /--ks-kpi-minh, clamp\(110px, 10vw, 140px\)/.test(ksCard) &&
  /min-height:\s*clamp\(110px, 10vw, 140px\)/.test(kairMetric));
check('CSS: .ks-kpi-card usa el borde real (--kair-line)',
  /1px solid var\(--kair-line/.test(ksCard) && /1px solid var\(--kair-line\)/.test(kairMetric));
check('CSS: .ks-chart usa radio/padding reales de .kair-card',
  /--kair-radius-card, 20px/.test(ruleBlock(styles, '.ks-chart')) &&
  /clamp\(14px, 1\.5vw, 20px\)/.test(ruleBlock(styles, '.ks-chart')));
check('CSS: .ks-card usa radio/borde reales de .kair-card',
  /--kair-radius-card, 20px/.test(ruleBlock(styles, '.ks-card')) &&
  /var\(--kair-line/.test(ruleBlock(styles, '.ks-card')));
check('CSS: el esqueleto expone variables para que un submódulo lo alinee',
  /--ks-kpi-min,/.test(ksStrip) && /--ks-kpi-radius,/.test(ksCard) &&
  /--ks-kpi-pad,/.test(ksCard) && /--ks-kpi-text,/.test(ksCard));

// ── 4. Submódulo Mantenimiento: esqueleto alineado a SUS tarjetas ──
const mntKpis = ruleBlock(mantCss, '.kair-mnt-kpis');
const mntCard = ruleBlock(mantCss, '.kair-mnt-kpi-card');
const mntOverride = ruleBlock(mantCss, '#kair-mnt-resumen-content .ks-kpi-strip,\n#kair-mnt-cronograma-kpis .ks-kpi-strip,\n.kair-mnt-kpis .ks-kpi-strip');
check('MNT: las tarjetas reales son más chicas y centradas (180px, centrado)',
  /minmax\(180px, 1fr\)/.test(mntKpis) && /text-align:\s*center/.test(mntCard));
check('MNT: el esqueleto se alinea con esas medidas por variables',
  /--ks-kpi-min:\s*180px/.test(mantCss) &&
  /--ks-kpi-text:\s*center/.test(mantCss) &&
  /--ks-kpi-radius:\s*var\(--kair-mnt-radius-lg\)/.test(mantCss));
check('MNT: usa los MISMOS tokens de espacio que las tarjetas reales',
  /--ks-kpi-gap:\s*var\(--kair-mnt-space-4\)/.test(mantCss) &&
  /--ks-kpi-pad:\s*var\(--kair-mnt-space-4\) var\(--kair-mnt-space-5\)/.test(mantCss));
check('MNT: el override apunta a los 3 contenedores que reciben el esqueleto',
  (mntOverride.length > 0) || /#kair-mnt-resumen-content \.ks-kpi-strip/.test(mantCss));

// ── 5. Cache-bust ────────────────────────────────────────────────
check('Cache-bust: styles.css con ?v= nuevo',
  /styles\.css\?v=20260918-skeleton-encaje/.test(html));
check('Cache-bust: kair-skeleton.js ahora TIENE ?v= (antes se cargaba sin versión)',
  /kair-skeleton\.js\?v=20260918-skeleton-encaje/.test(html));

// ── Reporte ──────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Encaje del esqueleto OK');
