/* ==========================================================================
   K+AIR — Prueba de humo: 4.1.2 Identificación de Peligros · premium v2
   Tokenización completa del CSS + theme-aware JS (2026-09-20)
   Uso: node main/test-identificacion-peligros.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MOD = path.join(ROOT, 'modules', 'gestion-peligros', 'identificacion-peligros');
const CSS = fs.readFileSync(path.join(MOD, 'kair-matriz-peligros.css'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const RENDERER = fs.readFileSync(path.join(ROOT, 'renderer.js'), 'utf8');
const FILES = {
  entry: fs.readFileSync(path.join(MOD, 'kair-matriz-peligros.js'), 'utf8'),
  header: fs.readFileSync(path.join(MOD, 'kair-matriz-peligros-header.js'), 'utf8'),
  matriz: fs.readFileSync(path.join(MOD, 'kair-matriz-peligros-matriz.js'), 'utf8'),
  indicadores: fs.readFileSync(path.join(MOD, 'kair-matriz-peligros-indicadores.js'), 'utf8'),
  priorizacion: fs.readFileSync(path.join(MOD, 'kair-matriz-peligros-priorizacion.js'), 'utf8'),
  editor: fs.readFileSync(path.join(MOD, 'kair-matriz-peligros-editor.js'), 'utf8'),
  utils: fs.readFileSync(path.join(MOD, 'kair-matriz-peligros-utils.js'), 'utf8'),
  service: fs.readFileSync(path.join(MOD, 'kair-matriz-peligros-service.js'), 'utf8')
};

let pass = 0, fail = 0;
const fails = [];
const BRIDGE = fs.readFileSync(path.join(__dirname, 'identificacion-peligros-bridge.js'), 'utf8');
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; fails.push(name); console.log('  FAIL:', name); }
}

/* ── 1. Tokens nuevos presentes en .km-wrapper ── */
['--km-hover', '--km-surface', '--km-surface-alt', '--km-track', '--km-zebra',
 '--km-row-hover', '--km-superth-bg', '--km-superth-text', '--km-superth-border',
 '--km-solid', '--km-amber-bg', '--km-amber-bg-soft', '--km-amber-bg-close',
 '--km-amber-border', '--km-amber-accent', '--km-amber-text', '--km-amber-text-strong',
 '--km-amber-text-deep', '--km-amber-icon', '--km-info-bg-a', '--km-info-bg-b',
 '--km-info-border', '--km-info-text', '--km-info-icon', '--km-primary-line',
 '--km-line-verde', '--km-line-amarillo', '--km-line-rojo',
 '--km-chart-verde', '--km-chart-azul', '--km-chart-morado', '--km-chart-amarillo',
 '--km-chart-naranja', '--km-chart-rojo', '--km-chart-cyan', '--km-chart-rosa',
 '--km-chart-gris', '--km-mx-neutral', '--km-mx-aceptable', '--km-mx-tolerable',
 '--km-mx-noaceptable'].forEach(t => {
  check('token ' + t, CSS.includes(t + ':'));
});

/* ── 2. Modo oscuro: re-definición de tokens (ambos atributos) ── */
check('dark usa [data-theme^="dark"]', CSS.includes('[data-theme^="dark"] .km-wrapper {'));
const darkBlock = CSS.split('[data-theme^="dark"] .km-wrapper {')[1] || '';
check('dark: --km-zebra re-definido', /--km-zebra:\s*#1f2940/.test(darkBlock));
check('dark: --km-track re-definido', /--km-track:\s*#2a3446/.test(darkBlock));
check('dark: --km-amber-bg re-definido', /--km-amber-bg:\s*#33270e/.test(darkBlock));
check('dark: --km-surface re-definido', /--km-surface:\s*#1a2334/.test(darkBlock));
check('dark: --km-hover re-definido', /--km-hover:\s*#2a3446/.test(darkBlock));
check('dark: --km-mx-noaceptable atenuado', /--km-mx-noaceptable:\s*#3d1d1d/.test(darkBlock));
check('dark: --km-solid azul', /--km-solid:\s*#2f5fa8/.test(darkBlock));

/* ── 3. Reglas de especificidad oscuras (gaps cubiertos) ── */
check('dark: .km-btn--warning redeclarado', /\[data-theme\^="dark"\] \.km-wrapper \.km-btn--warning\s*\{/.test(CSS));
check('dark: .km-prior-tab cubierto', /\[data-theme\^="dark"\] \.km-wrapper \.km-prior-tab\s*\{/.test(CSS));
check('dark: .km-prior-tab--active cubierto', /\[data-theme\^="dark"\] \.km-wrapper \.km-prior-tab--active\s*\{/.test(CSS));

/* ── 4. Sin colores sueltos en secciones claras ── */
const WHITELIST = /#fff\b|#ffffff/i;
const cssLines = CSS.split('\n');
let inDark = false, inDarkRule = false, darkDepth = 0, leaks = [];
cssLines.forEach((line, i) => {
  if (/^\s*\/\* =+/.test(line) && line.includes('DARK MODE')) inDark = true;
  /* línea que ABRE una regla dark: sus líneas de declaración siguientes
     también son oscuras aunque no repitan el selector */
  if (/\[data-theme\^="dark"\]/.test(line)) inDarkRule = true;
  if (inDarkRule) {
    darkDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (darkDepth <= 0) { inDarkRule = false; darkDepth = 0; }
    return;
  }
  if (/--km-/.test(line)) return;               /* definiciones de token */
  if (inDark) return;                            /* todo el bloque oscuro */
  if (/\.km-toast--/.test(line)) return;         /* toasts semánticos oscuros por diseño */
  const m = line.match(/#[0-9a-fA-F]{3,8}\b/);
  if (m && !WHITELIST.test(line)) leaks.push((i + 1) + ': ' + line.trim());
});
check('sin colores sueltos en claro (sección dark excluida)', leaks.length === 0);
if (leaks.length) console.log('  leaks:', leaks.slice(0, 8));

/* ── 5. Integridad estructural del CSS ── */
check('llaves balanceadas', CSS.split('{').length === CSS.split('}').length);
check('sin :root global', !/:root\s*\{/.test(CSS));
check('sin selector universal global', !/(^|\})\s*\*\s*\{/.test(CSS.replace(/\*\|/g, '')));
check('EOL LF (sin CR)', !CSS.includes('\r'));

/* ── 6. Donut: rail con clase + sin atributos stroke muertos ── */
check('indicadores: km-donut__track en el SVG', FILES.indicadores.includes('class="km-donut__track"'));
check('indicadores: sin stroke="#f1f5f9"', !FILES.indicadores.includes('stroke="#f1f5f9"'));
check('indicadores: sin stroke="#dc2626" (clase pisa atributo)', !FILES.indicadores.includes('stroke="#dc2626"'));
check('indicadores: sin stroke="#16a34a" (clase pisa atributo)', !FILES.indicadores.includes('stroke="#16a34a"'));
check('css: regla .km-donut__track existe', /\.km-wrapper \.km-donut__track\s*\{/.test(CSS));

/* ── 7. Colores inline theme-aware ── */
check('matriz: aviso usa #b07c1a (resuelve fuera del wrapper)', FILES.matriz.includes('color:#b07c1a'));
check('matriz: sin #b45309 inline', !FILES.matriz.includes('#b45309'));
check('priorizacion: matriz de calor con tokens', FILES.priorizacion.includes('var(--km-mx-noaceptable)'));
['#f8fafc', '#fee2e2', '#fff8e1', '#d4edda'].forEach(h => {
  check('priorizacion: sin ' + h + ' inline', !FILES.priorizacion.includes("'" + h + "'") && !FILES.priorizacion.includes('"' + h));
});

/* ── 8. Iconos: 0 Font Awesome, Bootstrap local ── */
Object.keys(FILES).forEach(k => {
  check('js ' + k + ': sin clases fa-', !/class="fa[\s-]/.test(FILES[k]));
});
check('index.html carga bootstrap-icons local', INDEX.includes('assets/css/bootstrap-icons.css'));

/* ── 9. Cableado intacto ── */
check('renderer.js monta KairMatrizPeligros en 4.1.2', RENDERER.includes('submoduleName === "4.1.2 Identificación de Peligros"') && RENDERER.includes('window.KairMatrizPeligros'));
check('index.html: 8 scripts del módulo incluidos',
  (INDEX.match(/identificacion-peligros\/kair-matriz-peligros[\w-]*\.js/g) || []).length === 8);
check('index.html: cache-bust v3-header', INDEX.includes('kair-matriz-peligros.css?v=20260921-premium-v7-volver'));

/* ── 9b. Header System v2 (miga de pan + card + tabs separadas) ── */
check('header: miga de pan en el marcado', FILES.header.includes('km-header-card__breadcrumb'));
check('header: barra de pestañas separada', FILES.header.includes('km-header-tabs'));
check('header: badge de conteo en pestaña', FILES.header.includes('data-tab-badge'));
check('header: iconos SVG inline (sin bi del header)', !FILES.header.includes('class="bi ') && FILES.header.includes('<svg viewBox='));
check('header: API updateBadge', FILES.header.includes('Header.updateBadge'));
check('css: .km-header-tabs existe', /\.km-wrapper \.km-header-tabs\s*\{/.test(CSS));
check('css: vieja .km-header-card__tabs eliminada', !CSS.includes('.km-header-card__tabs'));
check('css: estilos de breadcrumb', /\.km-wrapper \.km-bc-current\s*\{/.test(CSS));
check('css: dark cubre .km-header-tabs', /\[data-theme\^="dark"\] \.km-wrapper \.km-header-tab(active)?\b/.test(CSS));
check('entry: _headerOpts con módulo y código', FILES.entry.includes('_headerOpts'));
check('entry: escucha km:matriz-loaded para el badge', FILES.entry.includes('km:matriz-loaded') && FILES.entry.includes('updateBadge'));
check('matriz: emite km:matriz-loaded con total', FILES.matriz.includes("km:matriz-loaded"));
check('entry: render inicial monta AMBOS nodos (card + tabs)', FILES.entry.includes('while (headerEl.firstChild)'));
check('index.html: 8 scripts del módulo con cache-bust v4', (INDEX.match(/identificacion-peligros\/kair-matriz-peligros[\w-]*\.js\?v=20260921-premium-v7-volver/g) || []).length === 8);
check('header: SIN tarjeta y SIN empresa (Volver conservado)', !FILES.header.includes('km-header-card__company') && FILES.header.includes('data-action="back"'));
check('header: subtítulo con código GI-FO-019', FILES.header.includes('(GI-FO-019)'));
check('css: .km-header-card transparente', /\.km-wrapper \.km-header-card \{[^}]*background: transparent;/.test(CSS));
check('css: dark mantiene header transparente', /\[data-theme\^="dark"\] \.km-wrapper \.km-header-card \{ background: transparent/.test(CSS));

check('index.html: cache-bust v3-header', INDEX.includes('kair-matriz-peligros.css?v=20260921-premium-v7-volver'));

/* ── 9c. Primera carga automática (📦794) ── */
check('bridge: detecta primera carga (local vacío + Excel con datos)', BRIDGE.includes('var firstPopulate = mergeEmptyMode') && BRIDGE.includes('existing.sedes.length === 0'));
check('bridge: primera carga puebla TODO (cae al modo crear)', BRIDGE.includes('mergeEmptyMode && !firstPopulate'));
check('bridge: resultado marca firstPopulate', BRIDGE.includes("firstPopulate ? 'first-populate' : 'append'") && BRIDGE.includes('firstPopulate: firstPopulate'));
check('bridge: parse único del Excel (sin doble lectura en import)', (BRIDGE.split('_parseMatrizXlsx(filePath)').length - 1) === 2);
check('service: re-lee tras primera carga', FILES.service.includes('filled > 0 || firstPopulate'));
check('service: propaga firstPopulate al resultado', FILES.service.includes('fresh.data.firstPopulate = firstPopulate'));
check('matriz: aviso en pantalla de primera carga', FILES.matriz.includes('Matriz cargada desde el Excel') && FILES.matriz.includes('read.data.firstPopulate'));

/* ── 10. Sintaxis JS ── */
Object.keys(FILES).forEach(k => {
  try {
    execSync('node --check "' + path.join(MOD, 'kair-matriz-peligros' + (k === 'entry' ? '' : '-' + k)) + '.js"');
    check('node --check ' + k, true);
  } catch (e) {
    check('node --check ' + k, false);
  }
});

console.log('\n[K+AIR PELIGROS v2] ' + pass + '/' + (pass + fail) + ' checks');
if (fail) { console.log('FALLARON:', fails.join(' | ')); process.exit(1); }
console.log('TODO OK');
