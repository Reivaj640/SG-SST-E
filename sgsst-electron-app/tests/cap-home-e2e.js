// tests/cap-home-e2e.js
// E2E del home de Capacitaciones con jsdom (Node puro, sin Electron, sin display).
// 1) Lee cap-home.html, cap-home.css, kair-design-tokens.css, kair-components.css del disco
// 2) Construye un DOM con el CSS inyectado como <style> (mismo flujo que un <link> en navegador)
// 3) Verifica estructura, clases, reglas CSS y tokens
// 4) Imprime resumen pass/fail
//
// Uso:  node tests/cap-home-e2e.js
// Salida: consola estructurada con checks + ASCII layout

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(PROJECT_ROOT, 'modules/recursos/capacitaciones/cap-home.html');
const CSS_PATH = path.join(PROJECT_ROOT, 'modules/recursos/capacitaciones/cap-home.css');
const TOKENS_PATH = path.join(PROJECT_ROOT, 'shared/kair-design-tokens.css');
const COMPONENTS_PATH = path.join(PROJECT_ROOT, 'shared/kair-components.css');

const log = (msg) => console.log(`[cap-home-e2e] ${msg}`);
const K = (cond) => cond ? '✅' : '❌';

async function main() {
  log('Verificando archivos...');
  for (const f of [HTML_PATH, CSS_PATH, TOKENS_PATH, COMPONENTS_PATH]) {
    if (!fs.existsSync(f)) { console.error(`[cap-home-e2e] ❌ Falta: ${f}`); process.exit(1); }
  }
  log(`HTML: ${path.relative(PROJECT_ROOT, HTML_PATH)} (${fs.statSync(HTML_PATH).size} B)`);
  log(`CSS:  ${path.relative(PROJECT_ROOT, CSS_PATH)} (${fs.statSync(CSS_PATH).size} B)`);
  log(`TOK:  ${path.relative(PROJECT_ROOT, TOKENS_PATH)} (${fs.statSync(TOKENS_PATH).size} B)`);

  const htmlFragment = fs.readFileSync(HTML_PATH, 'utf8');
  // Quitar <link> tags del fragmento (los inyectamos inline como <style>)
  const htmlClean = htmlFragment.replace(/<link[^>]*>/g, '').trim();

  const tokensCss = fs.readFileSync(TOKENS_PATH, 'utf8');
  const componentsCss = fs.readFileSync(COMPONENTS_PATH, 'utf8');
  const capHomeCss = fs.readFileSync(CSS_PATH, 'utf8');

  const wrapperHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>K+AIR — Cap Home E2E</title>
  <style>${tokensCss}</style>
  <style>${componentsCss}</style>
  <style>${capHomeCss}</style>
</head>
<body>
  <header class="app-shell-mock">
    <div class="app-shell-mock__logo">K+AIR</div>
    <div class="app-shell-mock__crumb">Powered by GEST-IAR · TEMPOACTIVA</div>
  </header>
  <main id="cap-host"></main>
  <script>
    // Simula el fetch+innerHTML que hace capacitaciones-portal-logic.js
    document.getElementById('cap-host').innerHTML = ${JSON.stringify(htmlClean)};
    const yEl = document.getElementById('activeYear');
    if (yEl) yEl.textContent = String(new Date().getFullYear());
  </script>
</body>
</html>`;

  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => console.error('[jsdomError]', e.message));

  const dom = new JSDOM(wrapperHtml, { runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true });
  const { document } = dom.window;

  // --- Validaciones DOM ---
  log('--- DOM estructural ---');
  const checks = {
    host: !!document.getElementById('cap-host'),
    capHome: !!document.querySelector('.cap-home'),
    header: !!document.querySelector('.cap-home__header'),
    title: document.querySelector('.cap-home__title')?.textContent.trim(),
    sub: document.querySelector('.cap-home__sub')?.textContent.trim().slice(0, 60) + '…',
    crumb: document.querySelector('.cap-home__crumb')?.textContent.trim(),
    pillText: document.querySelector('.cap-home__pill')?.textContent.replace(/\s+/g, ' ').trim(),
    backText: document.querySelector('.cap-home__back')?.textContent.replace(/\s+/g, ' ').trim(),
    icon: !!document.querySelector('.cap-home__icon'),
    mainActions: !!document.querySelector('.cap-home__main-actions'),
    primaryCard: document.querySelector('.main-action-card.primary .action-title')?.textContent,
    secondaryCard: document.querySelector('.main-action-card:not(.primary) .action-title')?.textContent,
    cardsCount: document.querySelectorAll('.main-action-card').length,
    primaryHasGradient: !!document.querySelector('.main-action-card.primary'),
    secondaryHasIcon: !!document.querySelector('.main-action-card:not(.primary) .main-action-icon'),
    yearValue: document.getElementById('activeYear')?.textContent,
  };
  for (const [k, v] of Object.entries(checks)) log(`  ${k.padEnd(22)} ${K(!!v)} ${typeof v === 'string' ? v : ''}`);

  // --- Validaciones CSS ---
  log('--- CSS cap-home.css ---');
  const requiredRules = [
    /\.cap-home\s*\{/,
    /\.cap-home__header\s*\{/,
    /\.cap-home__title\s*\{/,
    /\.cap-home__sub\s*\{/,
    /\.cap-home__icon\s*\{/,
    /\.cap-home__crumb\s*\{/,
    /\.cap-home__pill\s*\{/,
    /\.cap-home__back\s*\{/,
    /\.cap-home__main-actions\s*\{/,
    /\.main-action-card\s*\{/,
    /\.main-action-card\.primary\s*\{/,
    /\.main-action-icon\s*\{/,
    /\.action-title\s*\{/,
    /\.action-desc\s*\{/,
    /\[data-theme\^="dark"\]\s+\.cap-home\s*\{/,
  ];
  const missing = requiredRules.filter(rx => !rx.test(capHomeCss));
  log(`  Reglas requeridas:    ${requiredRules.length - missing.length}/${requiredRules.length}`);
  if (missing.length) missing.forEach(rx => log(`  ⚠️  falta: ${rx}`));

  log('--- CSS kair-design-tokens.css ---');
  const tokenRequired = ['--kair-blue', '--kair-canvas', '--kair-line', '--kair-font-display', '--kair-muted', '--kair-ink', '--kair-soft', '--kair-radius-card', '--kair-blue-ink'];
  const tokensMissing = tokenRequired.filter(t => !tokensCss.includes(t));
  log(`  Tokens requeridos:    ${tokenRequired.length - tokensMissing.length}/${tokenRequired.length}`);
  if (tokensMissing.length) tokensMissing.forEach(t => log(`  ⚠️  falta: ${t}`));

  // --- Validaciones de links en cap-home.html ---
  log('--- Links en cap-home.html ---');
  const linkTags = htmlFragment.match(/<link[^>]+>/g) || [];
  log(`  Cantidad de <link>:   ${linkTags.length}`);
  linkTags.forEach(l => log(`  ${l.replace(/\s+/g, ' ').slice(0, 110)}`));
  const hasCapHomeCssLink = linkTags.some(l => l.includes('cap-home.css'));
  const hasTokensLink = linkTags.some(l => l.includes('kair-design-tokens.css'));
  log(`  ${K(hasCapHomeCssLink)} link a cap-home.css`);
  log(`  ${K(hasTokensLink)} link a kair-design-tokens.css`);

  // --- Computed style check (jsdom no aplica CSS real pero podemos inspeccionar el style) ---
  log('--- Verificación de estilos inline en clases ---');
  const cssBody = capHomeCss;
  const styleChecks = [
    { name: 'primary card gradient', ok: /\.main-action-card\.primary\s*\{[^}]*linear-gradient/.test(cssBody) },
    { name: 'primary card border transparent', ok: /\.main-action-card\.primary\s*\{[^}]*border-color:\s*transparent/.test(cssBody) },
    { name: 'main-actions grid', ok: /\.cap-home__main-actions\s*\{[^}]*display:\s*grid/.test(cssBody) },
    { name: 'main-actions 2 cols', ok: /\.cap-home__main-actions\s*\{[^}]*repeat\(2,\s*1fr\)/.test(cssBody) },
    { name: 'header flex space-between', ok: /\.cap-home__header\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/s.test(cssBody) },
    { name: 'pill flex', ok: /\.cap-home__pill\s*\{[^}]*display:\s*inline-flex/.test(cssBody) },
    { name: 'icon 44x44', ok: /\.cap-home__icon\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s.test(cssBody) },
    { name: 'back button', ok: /\.cap-home__back\s*\{[^}]*display:\s*inline-flex[^}]*cursor:\s*pointer/s.test(cssBody) },
    { name: 'dark mode override', ok: /\[data-theme\^="dark"\]\s+\.cap-home/.test(cssBody) },
    { name: 'dark mode pill', ok: /\[data-theme\^="dark"\]\s+\.cap-home__pill/.test(cssBody) },
    { name: 'dark mode primary', ok: /\[data-theme\^="dark"\]\s+\.main-action-card/.test(cssBody) },
  ];
  styleChecks.forEach(({ name, ok }) => log(`  ${K(ok)} ${name}`));

  // --- Validaciones funcionales (callbacks onclick) ---
  log('--- Callbacks onclick ---');
  const primaryOnclick = document.querySelector('.main-action-card.primary')?.getAttribute('onclick');
  const secondaryOnclick = document.querySelector('.main-action-card:not(.primary)')?.getAttribute('onclick');
  const backOnclick = document.querySelector('.cap-home__back')?.getAttribute('onclick');
  log(`  primary onclick:      "${primaryOnclick}"`);
  log(`  secondary onclick:    "${secondaryOnclick}"`);
  log(`  back onclick:         "${backOnclick}"`);

  // --- ASCII layout ---
  log('--- Layout esperado (post-fix) ---');
  console.log(`
┌────────────────────────────────────────────────────────────────────────┐
│  K+AIR · Powered by GEST-IAR · TEMPOACTIVA                              │
├────────────────────────────────────────────────────────────────────────┤
│  [🎓] Recursos/Capacitaciones              [✓ Año Activo: 2026] [←Volver]│
│        Capacitaciones                                                     │
│        Programa Anual de Capacitación en Seguridad y Salud…              │
│                                                                          │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐    │
│  │ [📅] VER CRONOGRAMA          │  │ [📋] CLONAR CRONOGRAMA        │    │
│  │ primary (gradient azul)      │  │ secundaria (blanca + ícon nja)│    │
│  │ Abrir cronograma del año…    │  │ Crear hoja del próximo año…    │    │
│  └──────────────────────────────┘  └──────────────────────────────┘    │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘`);

  // --- Resumen pass/fail ---
  const fails = [];
  if (!checks.host) fails.push('Host #cap-host vacío');
  if (!checks.capHome) fails.push('Falta .cap-home (root scoped)');
  if (!checks.header) fails.push('Falta .cap-home__header');
  if (checks.title !== 'Capacitaciones') fails.push(`Título incorrecto: "${checks.title}"`);
  if (!checks.crumb || !checks.crumb.includes('Recursos')) fails.push(`Breadcrumb incorrecto: "${checks.crumb}"`);
  if (!checks.pillText || !checks.pillText.includes('Año Activo')) fails.push(`Pill sin "Año Activo": "${checks.pillText}"`);
  if (!checks.backText || !checks.backText.includes('Volver')) fails.push(`Back sin "Volver": "${checks.backText}"`);
  if (!checks.mainActions) fails.push('Falta .cap-home__main-actions');
  if (checks.cardsCount !== 2) fails.push(`Esperaba 2 cards, encontré ${checks.cardsCount}`);
  if (!checks.primaryCard || !checks.primaryCard.includes('Ver Cronograma')) fails.push('Card primaria no es "Ver Cronograma"');
  if (!checks.secondaryCard || !checks.secondaryCard.includes('Clonar')) fails.push('Card secundaria no es "Clonar Cronograma"');
  if (!hasCapHomeCssLink) fails.push('Falta <link> a cap-home.css en cap-home.html');
  if (!hasTokensLink) fails.push('Falta <link> a kair-design-tokens.css en cap-home.html');
  if (primaryOnclick !== 'enterCronograma()') fails.push(`Primary onclick incorrecto: "${primaryOnclick}"`);
  if (secondaryOnclick !== 'cloneCronograma()') fails.push(`Secondary onclick incorrecto: "${secondaryOnclick}"`);
  if (backOnclick !== 'goBackToModule()') fails.push(`Back onclick incorrecto: "${backOnclick}"`);
  if (missing.length) fails.push(`${missing.length} reglas CSS faltantes en cap-home.css`);
  if (tokensMissing.length) fails.push(`${tokensMissing.length} tokens faltantes en kair-design-tokens.css`);
  if (styleChecks.filter(s => !s.ok).length) fails.push(`${styleChecks.filter(s => !s.ok).length} estilos CSS no encontrados`);

  console.log('');
  if (fails.length) {
    console.error(`❌ FALLOS: ${fails.length}`);
    fails.forEach(f => console.error(`   • ${f}`));
    process.exit(1);
  }
  console.log(`✅ Todos los checks DOM + CSS + tokens + callbacks pasaron.`);
  console.log(``);
  console.log(`📋 Resumen:`);
  console.log(`   • Estructura DOM:        OK (${checks.cardsCount} cards)`);
  console.log(`   • CSS cargado:           OK (${requiredRules.length - missing.length}/${requiredRules.length} reglas + ${tokenRequired.length - tokensMissing.length}/${tokenRequired.length} tokens)`);
  console.log(`   • Callbacks onclick:     OK (enterCronograma + cloneCronograma + goBackToModule)`);
  console.log(`   • Paths CSS:             OK (cap-home.css + kair-design-tokens.css)`);
  console.log(`   • Dark mode:             OK ([data-theme^="dark"] override presente)`);
  console.log(``);
  console.log(`📸 Para validación visual: abrir la app y navegar a Módulo Recursos → 1.2.1 Capacitaciones.`);
  console.log(`   El render debe coincidir con el home de Presupuesto (mismo patrón premium v2).`);
  process.exit(0);
}

main().catch(err => {
  console.error('[cap-home-e2e] ❌ Error inesperado:', err);
  process.exit(1);
});
