/* ============================================================
 * K+AIR · Smoke test — Bandeja Integrada: toolbar compacta (📦754)
 * ============================================================
 * Valida estáticamente la compactación del panel de correos:
 *   ANTES: 5 filas de "chrome" antes del primer correo
 *          [Redactar | Sincronizar] / [buscador] / 3 filas de carpetas.
 *   AHORA: 2 filas
 *          [Redactar | ⟳ | buscador | orden] / [chips desplazables | Más ▾].
 *
 * Es un test de estructura (no de runtime): lee los archivos y verifica
 * patrones. Correr con: node main/test-bandeja-toolbar-compacta.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'renderer', 'bandeja-integrada');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const premium = fs.readFileSync(path.join(dir, 'premium.css'), 'utf8');
const rendererJs = fs.readFileSync(path.join(__dirname, '..', 'renderer.js'), 'utf8');

const checks = [];
function check(name, ok) { checks.push({ name: name, ok: !!ok }); }

// ── 1. Toolbar de una sola fila (JS) ─────────────────────────────
check('JS: existe el contenedor .kair-mail-toolbar', /const toolbar = el\("div", \{ class: "kair-mail-toolbar" \}\)/.test(app));
check('JS: la toolbar recibe los 3 bloques (acciones + buscador + orden)',
  /toolbar\.appendChild\(composeBar\)/.test(app) &&
  /toolbar\.appendChild\(searchContainer\)/.test(app) &&
  /toolbar\.appendChild\(sortBtn\)/.test(app));
check('JS: la toolbar entra al panel una sola vez', (app.match(/container\.appendChild\(toolbar\)/g) || []).length === 1);

// El bloque de acciones ya NO contiene el selector de orden (se movió al final de la fila)
const composeBarBlock = (app.match(/composeBar\.innerHTML = `[\s\S]*?`;/) || [''])[0];
check('JS: composeBar solo tiene Redactar + Sincronizar',
  /mail-compose-btn/.test(composeBarBlock) && /mail-refresh/.test(composeBarBlock) && !/mail-sort-toggle/.test(composeBarBlock));
check('JS: el botón de orden vive fuera de composeBar (.kair-mail-sort-btn)',
  /const sortBtn = el\("button", \{[\s\S]{0,200}class: "kair-mail-sort-btn"/.test(app) && /id: "mail-sort-toggle"/.test(app));
// 📦755 — BUG REAL: el helper el() ignoraba `id`, así que el botón de orden quedaba SIN id
// y el handler que lo busca con $("#mail-sort-toggle") nunca se enganchaba (no respondía).
check('FIX 📦755: el helper el() soporta id (si no, el botón de orden no se engancha)',
  /else if \(k === "id"\) node\.id = v;/.test(app) &&
  /\$\("#mail-sort-toggle", container\)/.test(app));
check('FIX 📦755: el helper el() soporta hidden', /else if \(k === "hidden"\) node\.hidden = v === true;/.test(app));
check('JS: el tooltip del orden dice el orden actual', /title: "Orden: " \+ sortLabel/.test(app));
check('JS: el orden no-default queda marcado (data-active)',
  /"data-active": sortBy === "recent" \? "false" : "true"/.test(app));

// ── 2. Buscador integrado a la fila ──────────────────────────────
check('JS: el buscador ya no lleva padding/borde propios', !/class: "kair-mail-search", style: \{ padding/.test(app));
check('JS: wrapper del buscador con clase propia + flexible',
  /kair-mail-search__wrap/.test(app) && /flex: "1 1 auto", minWidth: "0"/.test(app));
check('JS: updateOperatorChips encuentra el wrapper por clase (con fallback)',
  /querySelector\("\.kair-mail-search__wrap"\) \|\| container\.querySelector\("div\[style\*='position: relative'\]"\)/.test(app));

// ── 3. Fila de carpetas: Recibidos + Enviados + menú "Más" ───────
check('JS: a la vista solo quedan Recibidos y Enviados',
  /const PRIMARY_FILTERS = \["all", "sent"\]/.test(app));
check('JS: el filtro de carpeta se extrajo a applyFilter()', /const applyFilter = \(f\) => \{/.test(app));
check('JS: applyFilter lo usan los chips y el menú "Más"',
  (app.match(/applyFilter\(f\)/g) || []).length >= 2);
check('JS: fila de carpetas con wrapper propio (.kair-mail-filter-row)',
  /const filterRow = el\("div", \{ class: "kair-mail-filter-row" \}\)/.test(app) && /container\.appendChild\(filterRow\)/.test(app));
check('JS: el botón "Más" queda FUERA de la tira de chips',
  /filterRow\.appendChild\(filters\);\s*\n\s*filterRow\.appendChild\(moreWrap\);/.test(app));
check('JS: menú de vistas/carpetas (.kair-mail-folders-menu)',
  /const menu = el\("div", \{ class: "kair-mail-folders-menu" \}\)/.test(app) && /class: "kair-mail-folders-menu__item"/.test(app));
check('JS: el menú se oculta con hidden (el helper el() no lo soporta)', /menu\.hidden = true;/.test(app));
check('JS: el botón "Más" muestra la vista activa', /activeSecondary \? activeSecondary\.label : "Más"/.test(app));
// 📦754-fix7 — No leídos / Marcados / Reuniones se MUEVEN al menú "Más"
const menuIds = ['unread', 'flagged', 'meeting', 'drafts', 'trash', 'spam', 'starred', 'important', 'archive'];
check('JS: el menú "Más" contiene 9 filtros (3 vistas + 6 carpetas)',
  menuIds.every((id) => app.indexOf('id: "' + id + '"') >= 0));
check('JS: separador entre vistas rápidas y carpetas', /kair-mail-folders-menu__sep/.test(app));
check('JS: el separador se inserta antes de la primera carpeta',
  /if \(!sepInserted && f\.isFolder\)/.test(app));

// ── 4. Listeners del menú: uno solo, global (sin leaks por re-render) ──
check('JS: handlers del menú definidos', /function handleFoldersMenuOutsideClick\(e\)/.test(app) && /function handleFoldersMenuEscape\(e\)/.test(app));
check('JS: se registran UNA sola vez',
  (app.match(/document\.addEventListener\('click', handleFoldersMenuOutsideClick\)/g) || []).length === 1 &&
  (app.match(/document\.addEventListener\('keydown', handleFoldersMenuEscape\)/g) || []).length === 1);
check('JS: NO se registran listeners de documento dentro del render de la lista',
  !/filters\.addEventListener\("click"/.test(app) && !/moreWrap\.addEventListener/.test(app));
check('JS: destroy() los remueve',
  /document\.removeEventListener\('click', handleFoldersMenuOutsideClick\)/.test(app) &&
  /document\.removeEventListener\('keydown', handleFoldersMenuEscape\)/.test(app));
check('JS: el click afuera NO cierra si fue dentro del wrapper',
  /if \(wrap && !wrap\.contains\(e\.target\)\) menus\[i\]\.hidden = true;/.test(app));

// ── 5. CSS de la toolbar compacta ────────────────────────────────
check('CSS: .kair-mail-toolbar (fila flex)', /\.kair-mail-toolbar\s*\{[^}]*display:\s*flex/.test(premium));
check('CSS: .kair-mail-compose-bar sin padding propio', /\.kair-mail-compose-bar\s*\{[^}]*padding:\s*0;/.test(premium));
check('CSS: botones secundarios solo con icono',
  /\.kair-mail-compose-bar__btn:not\(:first-child\) span\s*\{\s*display:\s*none;\s*\}/.test(premium) &&
  /\.kair-mail-sort-btn span\s*\{\s*display:\s*none;\s*\}/.test(premium));
check('CSS: botones de 32px de alto (más bajos que antes)', (premium.match(/height:\s*32px;/g) || []).length >= 2);
check('CSS: .kair-mail-sort-btn con estado activo', /\.kair-mail-sort-btn\[data-active="true"\]/.test(premium));
check('CSS: .kair-mail-search ocupa el ancho flexible', /\.kair-mail-search\s*\{[^}]*flex:\s*1 1 auto/.test(premium));
check('CSS: .kair-mail-filter-row es una fila flex (con wrap de seguridad)',
  /\.kair-mail-filter-row\s*\{[^}]*display:\s*flex/.test(premium) &&
  /\.kair-mail-filter-row\s*\{[^}]*flex-wrap:\s*wrap/.test(premium) &&
  // El wrapper de chips no aporta caja: los chips son items de la fila
  /\.kair-mail-list-filters\s*\{\s*display:\s*contents;\s*\}/.test(premium));
// fix6 — sin tira con desplazamiento: con 388px de panel cortaba un chip a la mitad
check('CSS: la tira de chips ya NO tiene scroll horizontal (nada cortado)',
  !/\.kair-mail-list-filters\s*\{[^}]*overflow-x:\s*auto/.test(premium) &&
  !/\.kair-mail-list-filters\s*\{[^}]*flex-wrap:\s*nowrap/.test(premium));
check('CSS: los chips no se comprimen (flex-shrink: 0)', /\.kair-mail-list-filter\s*\{[^}]*flex-shrink:\s*0/.test(premium));
check('CSS: menú "Más" con items y separador',
  /\.kair-mail-folders-menu__item/.test(premium) && /\.kair-mail-folders-menu__label/.test(premium) &&
  /\.kair-mail-folders-menu__sep/.test(premium));
// Con 9 items el menú puede ser más alto que la ventana: guarda con scroll interno
check('CSS: el menú tiene tope de altura + scroll propio',
  /\.kair-mail-folders-menu:not\(\[hidden\]\)\s*\{[^}]*max-height/.test(premium) &&
  /\.kair-mail-folders-menu:not\(\[hidden\]\)\s*\{[^}]*overflow-y:\s*auto/.test(premium));

// ── 6.b El menú "Más" se ancla a LA FILA (no al botón) ────────────
// Si se anclara al botón, al envolver el botón a la 2ª línea el menú de 198px se
// saldría del panel por la izquierda (o por la derecha si el botón queda al final).
const filterRowBase = (premium.match(/\.kair-mail-filter-row\s*\{[^}]*\}/) || [''])[0];
check('MENU: la fila de carpetas es el bloque contenedor del menú', /position:\s*relative/.test(filterRowBase));
check('MENU: el botón "Más" ya no es el bloque contenedor',
  !/\.kair-mail-more\s*\{[^}]*position:\s*relative/.test(premium));
check('JS: etiqueta corta "Recibidos" (la tab de arriba ya dice "Bandeja de entrada")',
  /\{ id: "all", label: "Recibidos", icon: D\.ICONS\.inbox, isFolder: true, folder: "INBOX" \}/.test(app) &&
  app.indexOf('label: "Bandeja de entrada"') < 0);

// ── 6. PITFALL CRÍTICO: `display` + `[hidden]` ───────────────────
// Si la regla base del menú declara `display`, pisa el `[hidden] { display:none }`
// del navegador y el menú queda ABIERTO siempre tapando la lista de correos.
const menuBase = (premium.match(/\.kair-mail-folders-menu\s*\{[^}]*\}/) || [''])[0];
check('MENU: la regla base de .kair-mail-folders-menu NO declara display', !!menuBase && !/display\s*:/.test(menuBase));
check('MENU: el display:flex vive en :not([hidden])', /\.kair-mail-folders-menu:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex/.test(premium));

// ── 7. El menú abre hacia la izquierda (el botón está pegado al borde) ──
const menuPos = (premium.match(/\.kair-mail-folders-menu\s*\{[^}]*\}/) || [''])[0];
check('MENU: anclado a la derecha (no se sale del panel)', /right:\s*0/.test(menuPos) && /position:\s*absolute/.test(menuPos));

// ── 8. Contrato DOM: nada de lo que usa app.js desapareció ───────
check('DOM: siguen los ids de la fila de correo',
  /"mail-compose-btn"/.test(app) && /"mail-refresh"/.test(app) && /"mail-sort-toggle"/.test(app) && /"mail-search-input"/.test(app));
check('DOM: la lista conserva .kair-scroll (el buscador hace querySelectorAll de .kair-mail-row)',
  /class: "kair-scroll/.test(app) && /querySelectorAll\("\.kair-mail-row"\)/.test(app));

// ── 9. Cache-bust ────────────────────────────────────────────────
// (El valor exacto avanza con cada cambio; acá solo se valida que sea >= fix7
//  o el tag posterior de paginación, para no romper el test en cada bump.)
const iframeMatch = rendererJs.match(/bandeja-integrada\/index\.html\?v=(\d+)/);
const iframeV = iframeMatch ? parseInt(iframeMatch[1], 10) : 0;
check('Cache-bust: iframe ?v= >= 693 (actual: ' + iframeV + ')', iframeV >= 693);
const premiumV = (html.match(/premium\.css\?v=([\w.-]+)/) || [])[1] || '';
check('Cache-bust: premium.css con ?v= (actual: ' + premiumV + ')',
  /toolbar-compacta-fix7|paginacion-correos/.test(premiumV));
const appV = (html.match(/app\.js\?v=([\w.-]+)/) || [])[1] || '';
check('Cache-bust: app.js con ?v= (actual: ' + appV + ')',
  /toolbar-compacta-fix7|paginacion-correos/.test(appV));

// ── Reporte ──────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Bandeja Integrada — toolbar compacta OK');
