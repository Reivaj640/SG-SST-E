/* ============================================================
 * K+AIR · Smoke test — Bandeja Integrada Premium v2 (📦752)
 * ============================================================
 * Valida estáticamente la migración al estilo premium v2 del diseño
 * objetivo (`kair-bandeja.html`): topbar con breadcrumb + segmentado
 * Agenda/Correo, KPI cards, sidebar premium, capa CSS premium y que NO
 * se rompió ningún anclaje del contrato DOM de `app.js`.
 *
 * Es un test de estructura (no de runtime): lee los archivos y verifica
 * patrones. Correr con: node main/test-bandeja-premium-v2.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'renderer', 'bandeja-integrada');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const premium = fs.readFileSync(path.join(dir, 'premium.css'), 'utf8');
const legacy = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const rendererJs = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');

const checks = [];
function check(name, ok) { checks.push({ name: name, ok: !!ok }); }

// ── 1. Shell premium (index.html) ────────────────────────────────
check('HTML: topbar premium .kair-top presente', /<header class="kair-top">/.test(html));
// 📦849 · Los guards de "lo que YA NO esta" tienen que mirar CODIGO, no
// comentarios: los comentarios de 849 nombran justamente lo eliminado
// (criticalThisMonth, "Integración correo"). Un guard que matchea su
// propio comentario de cambio no protege nada.
function soloCodigo(x) {
  return x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
const appCodigo = soloCodigo(app);

check('HTML: breadcrumb "Inicio > Bandeja integrada"', /kair-top__crumb[\s\S]*?Inicio[\s\S]*?Bandeja integrada/.test(html));
check('HTML: icono + H1 + subtítulo del módulo', /kair-top__icon/.test(html) && /kair-top__h1">Bandeja integrada</.test(html) && /kair-top__sub">/.test(html));
// 📦851 · Este check exigía el chip de fecha del topbar. Se eliminó: era el mismo
// dato dos veces en pantalla (el toolbar del calendario grande ya muestra el mes
// y el mini-calendar muestra el mes actual). El check se INVIERTE, no se borra:
// uno borrado es un hueco, uno invertido sigue impidiendo que reaparezca.
check('HTML: el chip de fecha redundante NO esta (#chip-fecha / .kair-chip-date)',
  !/id="chip-fecha"/.test(html) && !/kair-chip-date/.test(html));
// Que el toolbar del calendario grande conserve SU mes es otra cosa, y la
// comprueba test-bandeja-chip-851.js con mutation testing. No se alarga aqui
// un check que no puede morder.
check('HTML: segmentado Agenda/Correo', /class="kair-seg"/.test(html) && /id="tab-agenda"/.test(html) && /id="tab-correo"/.test(html));
// 📦849 · Los indicadores ya no son tarjetas arriba: viven en el sidebar
// ("Tu día"). La <section class="kpis"> se quitó para que la lista de
// correo use ese alto.
check('HTML: ya NO hay tira de tarjetas de indicadores (se movieron al sidebar)',
  !/<section class="kpis"/.test(html) && html.indexOf('id="kpi-strip"') < 0);
// 📦850 · El div de apertura ya no es idéntico: lleva `data-sidebar="on"` (el
// estado inicial de la columna plegable). Se toleran los atributos extra en vez
// de borrar el check — lo que protege es que el layout esté DENTRO de .kair-main,
// y eso sigue igual.
check('HTML: el layout principal sube directo al shell',
  /<div class="kair-layout" id="kair-layout"[^>]*>/.test(html));
check('HTML: sidebar sin tarjeta propia (cada bloque es card)', /<aside class="kair-sidebar" id="sidebar">/.test(html));
check('HTML: se eliminó el botón-flecha (#panel-toggle)', !/id="panel-toggle"/.test(html));

// ── 2. Contrato DOM crítico intacto ──────────────────────────────
const requiredIds = [
  'btn-back', 'btn-refresh', 'refresh-icon', 'btn-compose', 'btn-signature',
  'gmail-indicator', 'gmail-indicator-text', 'sidebar',
  'content-area', 'mail-list-container', 'mail-detail-container',
  'calendar-slide', 'footer-events-count', 'footer-company', 'footer-view',
  'modal-overlay', 'event-modal', 'toast-container', 'fv-overlay', 'fv-body',
  'fv-filename', 'fv-filesize', 'fv-ext-badge', 'fv-close-btn', 'fv-file-input'
];
const missing = requiredIds.filter((id) => html.indexOf('id="' + id + '"') < 0);
check('HTML: todos los IDs del contrato crítico presentes' + (missing.length ? ' (faltan: ' + missing.join(', ') + ')' : ''), missing.length === 0);
check('JS: el binding de #search-input quedó con guard', /var headerSearch = \$\("#search-input"\);\s*\n\s*if \(headerSearch\)/.test(app));
check('JS: NO quedan referencias sin guard a #panel-toggle', app.indexOf('$("#panel-toggle")') < 0);
check('JS: el segmentado fija el estado (setCalendarVisible)', /function setCalendarVisible\(visible\)/.test(app) && /tabAgenda\.addEventListener\("click", function \(\) \{ setCalendarVisible\(true\)/.test(app));

// ── 3. Render premium en app.js ──────────────────────────────────
// 📦849 · Los indicadores se pintan como filas (.tuday__i) en la sección
// "Tu día" del sidebar, no como tarjetas. calcularIndicadores() es la
// única fuente de los 3 datos.
check('JS: "Tu día" en el sidebar (tuday__i + tuday__n/tuday__c/tuday__s)',
  /class: "kair-card tuday"/.test(app) && /tuday__i/.test(app)
  && /tuday__n/.test(app) && /tuday__c/.test(app) && /tuday__s/.test(app));
check('JS: se retiró el markup legacy .kair-kpi-item', !/class: "kair-kpi-item"/.test(app));
check('JS: los 3 indicadores navegan (correos/reuniones/invitaciones)',
  /id: "kpi-correos"/.test(app) && /id: "kpi-reuniones"/.test(app) && /id: "kpi-invitaciones"/.test(app));
check('JS: calcularIndicadores() es la fuente única de los 3 datos',
  /function calcularIndicadores\(\)/.test(app) && /calcularIndicadores\(\)\.forEach/.test(app)
  && app.indexOf('renderKpiStrip') < 0);
check('JS: se retiró "Eventos críticos" y su código muerto (mira CODIGO, no comentarios)',
  appCodigo.indexOf('kpi-criticos') < 0 && appCodigo.indexOf('Eventos críticos') < 0
  && !/criticalThisMonth/.test(appCodigo) && !/criticalSub/.test(appCodigo)
  && !/critical = state\.events\.filter/.test(appCodigo)
  && !/kair-kpi__chip/.test(appCodigo));
check('JS: se retiró la tarjeta "Integración correo" (la reemplaza "Tu día")',
  app.indexOf('btn-abrir-bandeja') < 0 && app.indexOf('kair-card sidecard') < 0);
check('JS: mini-calendario premium (.mini__head/.mini__grid/.mini__d)', /class: "kair-card mini"/.test(app) && /mini__head/.test(app) && /mini__wd/.test(app) && /"mini__d"/.test(app));
check('JS: mini-calendario con hasta 3 puntos por día', /dayDots/.test(app) && /mini__dot/.test(app));
check('JS: "Tipos de evento" premium con contador', /class: "kair-card tipos"/.test(app) && /tipos__c/.test(app) && /tipos__hint/.test(app));
// 📦849 · La tarjeta "Integración correo" fue reemplazada por "Tu día".
check('JS: la sección "Tu día" reemplaza a la tarjeta de Integración correo (mira CODIGO)',
  /class: "kair-card tuday"/.test(app) && appCodigo.indexOf('btn-abrir-bandeja') < 0
  && appCodigo.indexOf('sidecard') < 0 && appCodigo.indexOf('Integración correo') < 0);
// 📦851 · Segundo check que exigía el chip (este miraba el JS, no el HTML).
// Los dos se invierten juntos: uno invertido protege que no vuelva, y dejar el
// otro afirmándolo significaba que reintroducir el chip a medias —el markup
// sí, el JS no— pasara verde.
check('JS: el codigo del chip de fecha tambien se elimino', appCodigo.indexOf('chipFecha') < 0);
check('JS: segmentado pintado por aria-selected', /tabAgenda\.setAttribute\("aria-selected"/.test(app));

// ── 4. Capa CSS premium ──────────────────────────────────────────
const legacyLink = html.indexOf('<link rel="stylesheet" href="styles.css');
const premiumLink = html.indexOf('<link rel="stylesheet" href="premium.css');
check('CSS: premium.css cargado DESPUÉS de styles.css', legacyLink >= 0 && premiumLink > legacyLink);
check('CSS: tokens premium v2 definidos (surface/blue/amber/sh)', /--kair-surface: #FFFFFF/.test(premium) && /--kair-blue: #2057B8/.test(premium) && /--kair-sh-sm/.test(premium));
check('CSS: remapeo de tokens legacy a premium', /--kair-primary: var\(--kair-blue\)/.test(premium) && /--kair-bg-card: var\(--kair-surface\)/.test(premium) && /--kair-text-muted: var\(--kair-text-2\)/.test(premium));
check('CSS: tipografía premium (Manrope + Inter)', /@import url\(/.test(premium) && /Manrope/.test(premium) && /Inter/.test(premium));
check('CSS: topbar y segmentado', /\.kair-top__crumb/.test(premium) && /\.kair-seg__b\[aria-selected="true"\]/.test(premium));
check('CSS: "Tu día" (tuday__i + tiles por color + fila vacía atenuada)',
  /\.tuday__i \{/.test(premium) && /\.tuday__ico--blue/.test(premium)
  && /\.tuday__ico--green/.test(premium) && /\.tuday__ico--amber/.test(premium)
  && /\.tuday__i\.is-vacio/.test(premium));
// 📦849 · Los estilos .kair-kpi* y .sidecard* se quitaron del CSS. Se
// comprueba sobre el ARCHIVO COMPLETO, no sobre un bloque.
check('CSS: se retiraron los estilos muertos (.kair-kpi* y .sidecard*)',
  !/^\s*\.kair-kpi/m.test(premium) && !/^\s*\.sidecard/m.test(premium));
check('CSS: sidebar (mini/tipos)', /\.mini__d\.is-today/.test(premium) && /\.tipos__i\.is-off/.test(premium));
check('CSS: correo (filas, carpetas, lector, reply)', /\.kair-mail-list-filter\[data-active="true"\]/.test(premium) && /\.kair-mail-row\[data-unread="true"\]/.test(premium) && /\.kair-mail-detail__reply-input/.test(premium));
check('CSS: fila con 3 columnas de contenido + barra de selección', /grid-template-columns: 20px 36px 1fr 62px 22px/.test(premium) && /\.kair-mail-row\[data-selected="true"\]::before/.test(premium));
check('CSS: agenda (toolbar, mes, semana/día, agenda, footer)', /\.kair-cal-toolbar__view\[data-active="true"\]/.test(premium) && /\.kair-month-cell\[data-today="true"\]/.test(premium) && /\.kair-agenda-item/.test(premium) && /\.kair-cal-footer/.test(premium));
check('CSS: modales, redactor y toasts premium', /\.kair-event-modal__title/.test(premium) && /\.compose-panel__title/.test(premium) && /\.kair-toast__title/.test(premium));
check('CSS: scrollbar + responsive premium', /::-webkit-scrollbar-thumb/.test(premium) && /@media \(max-width: 1280px\)/.test(premium));
check('CSS: legacy styles.css NO fue reescrito (sigue teniendo .email-row)', /\.email-row \{/.test(legacy));

// ── 5. Cache-bust ────────────────────────────────────────────────
const iframeMatch = rendererJs.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
const iframeV = iframeMatch ? parseInt(iframeMatch[1], 10) : 0;
check('Cache-bust: iframe ?v= bumpeado a >= 684 (actual: ' + iframeV + ')', iframeV >= 684);
check('Cache-bust: app.js con ?v= en index.html', /app\.js\?v=/.test(html));
check('Cache-bust: premium.css con ?v= en index.html', /premium\.css\?v=/.test(html));

// ── 6. Regresiones de la primera pasada (bugs reales vistos en pantalla) ──
// 6.a El layout legacy tenía 3 columnas (sidebar · botón-flecha · contenido).
//     Al retirar el botón-flecha, esa columna debe desaparecer: si queda, el
//     contenido se comprime en un carril de 26px y la bandeja se ve vacía.
const layoutBase = (premium.match(/\.kair-layout\s*\{[^}]*\}/) || [''])[0];
// 📦850 · Este check afirmaba el ancho LITERAL ("250px 1fr"). Con la columna
// lateral plegable el primer track pasó a ser "auto": lo mide el <aside>, que es
// lo que permite animarlo a 0. El comportamiento que este check protege NO es el
// número — es que haya EXACTAMENTE 2 columnas y que la segunda sea 1fr. Por eso se
// reescribió en vez de borrarse: un check borrado es un hueco, uno actualizado
// sigue siendo una red, y ahora cubre también el caso plegado.
const gridTracks = (layoutBase.match(/grid-template-columns:\s*([^;]+);/) || [, ''])[1]
  .trim().split(/\s+(?![^(]*\))/);
check('LAYOUT: .kair-layout declara 2 columnas (sidebar + contenido)',
  gridTracks.length === 2 && gridTracks[1] === '1fr' && gridTracks[0] !== '26px',
  'tracks=' + JSON.stringify(gridTracks));
check('LAYOUT: la columna lateral se mide con var(--side-w), no con un ancho fijo',
  /--side-w:\s*\d+px/.test(layoutBase) && /grid-template-columns:\s*(auto|var\(--side-w\))\s+1fr/.test(layoutBase),
  (layoutBase.match(/grid-template-columns:[^;]*/) || [''])[0].trim());
check('LAYOUT: no quedaron columnas del botón-flecha retirado', !/grid-template-columns:\s*(250px|224px)\s+26px\s+1fr/.test(premium) && !/grid-template-columns:\s*22px\s+1fr/.test(premium));
// 6.b El modal vive en el HTML con el atributo `hidden`; quien lo oculta es la
//     regla del navegador. Si la regla base declara `display`, el overlay queda
//     visible siempre (velo oscuro + blur tapando toda la bandeja).
const overlayBase = (premium.match(/\.kair-modal-overlay\s*\{[^}]*\}/) || [''])[0];
check('MODAL: la regla base de .kair-modal-overlay NO declara display', !!overlayBase && !/display\s*:/.test(overlayBase));
check('MODAL: el display:flex vive en :not([hidden])', /\.kair-modal-overlay:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/.test(premium));
// 6.c Los toasts contienen botones (Deshacer / Posponer): el contenedor no debe
//     capturar clicks, pero la píldora sí.
check('TOAST: .kair-toast captura clicks (botones Deshacer/Posponer)', /\.kair-toast\s*\{[^}]*pointer-events:\s*auto/.test(premium));

// ── Reporte ──────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Bandeja Integrada Premium v2 OK');
