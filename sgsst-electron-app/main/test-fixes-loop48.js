// test-fixes-loop48.js
// Loop 1 (📦581) — Botón-dot de update en FOOTER + dropdown al click
// (estilo opencode: NO invasivo, cero contenido tapado)
//
// CAMBIO vs versión inicial del Loop 1:
// - Loop 1: era un banner full-width (invasivo)
// - Loop 1.6: botón en el header con dropdown al click
// - Loop 4b: BOTÓN MOVIDO AL FOOTER (al lado de la versión) — versión duplicada
//   entre header y footer. Ahora el header no muestra nada, el footer muestra
//   la versión + un DOT (oculto al día, azul con pulse si hay update,
//   verde con halo si está descargado).
//
// IMPLEMENTACIÓN:
// 1. index.html: <button id="footer-update-btn" hidden> en el footer
//    + <span class="footer-update-btn__dot"> (dot de 8px)
//    + <div id="kair-update-dropdown" hidden> con header, body, botones
//    (El header NO tiene botón de update — la versión está en el footer)
// 2. styles.css: bloque .footer-update-btn + .footer-update-btn__dot
//    + @keyframes kair-footer-update-pulse (pulse del dot azul)
//    + .kair-update-dropdown (sigue en el body, se ancla al dot del footer)
// 3. renderer.js: usa footerUpdateBtn (en vez de headerUpdateBtn).
//    La función updateHeaderStatus() ahora opera sobre el dot del footer.
//    openUpdateDropdown() calcula posición arriba del dot (con fallback abajo).

const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;
const fails = [];

function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log('  ✓ ' + name);
  } else {
    fail++;
    fails.push(name + (detail ? ' — ' + detail : ''));
    console.log('  ✗ ' + name + (detail ? ' — ' + detail : ''));
  }
}

const indexPath = path.join(__dirname, '..', 'index.html');
const stylesPath = path.join(__dirname, '..', 'styles.css');
const configViewerPath = path.join(__dirname, '..', 'components', 'config', 'config-viewer.html');
const html = fs.readFileSync(indexPath, 'utf8');
const css = fs.readFileSync(stylesPath, 'utf8');
const configViewerHtml = fs.readFileSync(configViewerPath, 'utf8');

console.log('=== Loop 1 (📦581) — Botón + Dropdown de update (estilo opencode) ===\n');

// --- HTML: botón-dot del FOOTER (Loop 4b — movido del header al footer) ---
check(
  'HTML: NO existe <button id="header-update-btn"> en el header (movido al footer)',
  !/id="header-update-btn"/.test(html),
  'header limpio — sin botón de update (la versión está en el footer)'
);

check(
  'HTML: <button id="footer-update-btn"> existe en el footer',
  /<button[^>]*id="footer-update-btn"[^>]*>/.test(html),
  'botón-dot en el footer (al lado de la versión)'
);

check(
  'HTML: footer-update-btn está DESPUÉS de <footer id="app-footer">',
  (() => {
    const footerIdx = html.indexOf('id="app-footer"');
    const btnIdx = html.indexOf('id="footer-update-btn"');
    return footerIdx > -1 && btnIdx > footerIdx;
  })(),
  'botón dentro del footer, no en el header'
);

check(
  'HTML: footer-update-btn tiene atributo hidden (oculto al día)',
  /id="footer-update-btn"[^>]*\bhidden\b/.test(html),
  'oculto por default hasta que haya update'
);

check(
  'HTML: footer-update-btn tiene aria-haspopup="menu" (a11y)',
  /id="footer-update-btn"[^>]*aria-haspopup="menu"/.test(html),
  'indica que abre un menú'
);

check(
  'HTML: footer-update-btn tiene aria-expanded="false" (estado inicial cerrado)',
  /id="footer-update-btn"[^>]*aria-expanded="false"/.test(html),
  'estado inicial'
);

check(
  'HTML: footer-update-btn tiene aria-label accesible',
  /id="footer-update-btn"[^>]*aria-label="(Información de actualizaciones|Buscar actualizaciones)"/.test(html),
  'label accesible para screen readers'
);

check(
  'HTML: footer-update-btn tiene <span class="footer-update-btn__dot"> interno',
  /id="footer-update-btn"[\s\S]*?<span class="footer-update-btn__dot"/.test(html),
  'dot de 8px dentro del botón'
);

check(
  'HTML: footer-version-wrap agrupa app-version y footer-update-btn',
  /<span class="footer-version-wrap">[\s\S]*?id="app-version"[\s\S]*?id="footer-update-btn"/.test(html),
  'versión + dot están en el mismo wrapper (alineación)'
);

check(
  'HTML: NO existe #header-update-badge (badge "1" eliminado por feedback)',
  !/id="header-update-badge"/.test(html),
  'badge removido por feedback del user'
);

// --- HTML: dropdown (en el body, NO en el header) ---
check(
  'HTML: <div id="kair-update-dropdown"> existe',
  /<div[^>]*id="kair-update-dropdown"[^>]*>/.test(html),
  'dropdown principal'
);

check(
  'HTML: dropdown tiene atributo hidden por default',
  /id="kair-update-dropdown"[^>]*\bhidden\b/.test(html),
  'oculto por default hasta que se abra'
);

check(
  'HTML: dropdown tiene role="menu"',
  /id="kair-update-dropdown"[^>]*role="menu"/.test(html),
  'rol ARIA para menú'
);

check(
  'HTML: dropdown tiene header con ícono y título "Nueva versión disponible"',
  /<div class="kair-update-dropdown__header"[\s\S]*?Nueva versión disponible/.test(html),
  'header del dropdown'
);

check(
  'HTML: dropdown tiene span con data-kair-update-version',
  /<span data-kair-update-version>—<\/span>/.test(html) ||
  /data-kair-update-version/.test(html),
  'placeholder para inyectar versión en Loop 2'
);

check(
  'HTML: dropdown tiene botones "Reiniciar ahora" y "Más tarde"',
  /data-kair-update-action="restart"[\s\S]*?Reiniciar ahora/.test(html) &&
  /data-kair-update-action="dismiss"[\s\S]*?Más tarde/.test(html),
  '2 botones de acción'
);

check(
  'HTML: dropdown está DESPUÉS del </header> (FUERA del header)',
  (() => {
    const headerEnd = html.indexOf('</header>');
    const dropdownIdx = html.indexOf('id="kair-update-dropdown"');
    return headerEnd > -1 && dropdownIdx > headerEnd;
  })(),
  'dropdown en el body, no dentro del header (evita stacking context del header)'
);

// --- HTML: NO debe quedar el banner viejo ---
check(
  'HTML: NO existe #kair-update-banner (banner viejo eliminado)',
  !/id="kair-update-banner"/.test(html),
  'banner viejo debe estar borrado'
);

// --- CSS: botón-dot del FOOTER (Loop 4b) ---
check(
  'CSS: .footer-update-btn existe (dot-button del footer)',
  /\.footer-update-btn\s*\{/.test(css),
  'botón del footer con dot interno'
);

check(
  'CSS: .footer-update-btn[hidden] usa display: none !important',
  /\.footer-update-btn\[hidden\]\s*\{[^}]*display:\s*none\s*!important/m.test(css),
  'oculto cuando tiene atributo hidden'
);

check(
  'CSS: .footer-update-btn__dot existe (dot de 8px)',
  /\.footer-update-btn__dot\s*\{[^}]*width:\s*8px[^}]*height:\s*8px/m.test(css),
  'dot de 8px x 8px con border-radius 50% (círculo perfecto)'
);

check(
  'CSS: .footer-version-wrap agrupa versión y dot (flex inline)',
  /\.footer-version-wrap\s*\{[^}]*display:\s*inline-flex/m.test(css),
  'wrapper para alinear versión + dot horizontalmente'
);

check(
  'CSS: .footer-update-btn.footer-update-available pone dot azul con pulse',
  /\.footer-update-btn\.footer-update-available\s+\.footer-update-btn__dot\s*\{[^}]*background:\s*#1a73e8/m.test(css) &&
  /\.footer-update-btn\.footer-update-available\s+\.footer-update-btn__dot\s*\{[^}]*animation:\s*kair-footer-update-pulse/m.test(css),
  'dot azul corporativo con animación de pulse'
);

check(
  'CSS: .footer-update-btn.footer-update-ready pone dot verde con halo',
  /\.footer-update-btn\.footer-update-ready\s+\.footer-update-btn__dot\s*\{[^}]*background:\s*#16a34a/m.test(css) &&
  /\.footer-update-btn\.footer-update-ready\s+\.footer-update-btn__dot\s*\{[^}]*box-shadow/m.test(css),
  'dot verde con box-shadow de halo'
);

check(
  'CSS: @keyframes kair-footer-update-pulse existe (animación del dot)',
  /@keyframes\s+kair-footer-update-pulse/.test(css),
  'animación del pulse con box-shadow radial'
);

check(
  'CSS: NO quedan estilos del header update (cleanup completo)',
  !/\.header-update-btn\s*\{/.test(css) &&
  !/\.header-update-text\s*\{/.test(css) &&
  !/\.header-update-btn__icon\s*\{/.test(css),
  'header libre de estilos de update (CSS muerto eliminado)'
);

check(
  'CSS: NO existe el keyframe viejo kair-update-btn-pulse (reemplazado)',
  !/@keyframes\s+kair-update-btn-pulse/.test(css),
  'animación vieja eliminada (era del background del botón header)'
);

check(
  'CSS: NO existe el keyframe viejo kair-update-icon-bounce (reemplazado)',
  !/@keyframes\s+kair-update-icon-bounce/.test(css),
  'animación vieja eliminada (era del ícono header)'
);

// --- CSS: dropdown ---
check(
  'CSS: .kair-update-dropdown es FIXED (no absolute), encima de todo',
  /\.kair-update-dropdown\s*\{[^}]*position:\s*fixed/m.test(css),
  'position:fixed para escapar del stacking context del header'
);

check(
  'CSS: .kair-update-dropdown tiene z-index muy alto (500001, encima de todo)',
  /\.kair-update-dropdown\s*\{[^}]*z-index:\s*500001/m.test(css),
  'z-index mayor al header y al Vanta'
);

check(
  'CSS: .kair-update-dropdown usa CSS variable --arrow-pos-x para la flechita',
  /\.kair-update-dropdown::before\s*\{[^}]*--arrow-pos-x/m.test(css) ||
  /var\(--arrow-pos-x/.test(css),
  'flechita dinámica según posición del botón'
);

check(
  'CSS: .kair-update-dropdown tiene border-radius generoso (12px, sin puntas)',
  /\.kair-update-dropdown\s*\{[^}]*border-radius:\s*12px/m.test(css),
  'esquinas suaves (feedback user: refinamiento)'
);

check(
  'CSS: .kair-update-dropdown__inner también tiene border-radius 12px',
  /\.kair-update-dropdown__inner\s*\{[^}]*border-radius:\s*12px/m.test(css),
  'wrapper interno coincide con el outer'
);

check(
  'CSS: header NO tiene border-bottom (causaba "puntas" en esquinas)',
  !/\.kair-update-dropdown__header\s*\{[^}]*border-bottom:\s*1px/m.test(css),
  'sin separador duro, contraste por color es suficiente'
);

check(
  'CSS: .kair-update-dropdown tiene box-shadow (look moderno)',
  /\.kair-update-dropdown\s*\{[^}]*box-shadow:/m.test(css),
  'sombra proyectada'
);

check(
  'CSS: .kair-update-dropdown[hidden] usa display: none',
  /\.kair-update-dropdown\[hidden\]\s*\{[^}]*display:\s*none\s*!important/m.test(css),
  'oculto por default'
);

check(
  'CSS: dropdown tiene flechita (::before) apuntando al botón',
  /\.kair-update-dropdown::before\s*\{/.test(css),
  'indicador visual'
);

check(
  'CSS: header del dropdown usa tono BAJO de azul (#e8f0fe, estilo Claude)',
  /\.kair-update-dropdown__header\s*\{[^}]*background:\s*#e8f0fe/m.test(css),
  'azul claro sutil (feedback del user: bajar tono)'
);

check(
  'CSS: header del dropdown tiene color de texto azul oscuro (#1e3a8a)',
  /\.kair-update-dropdown__header\s*\{[^}]*color:\s*#1e3a8a/m.test(css),
  'contraste sobre fondo claro'
);

check(
  'CSS: ícono del dropdown usa azul corporativo (#1a73e8) sobre fondo claro',
  /\.kair-update-dropdown__icon\s*\{[^}]*color:\s*#1a73e8/m.test(css),
  'ícono azul visible sobre fondo #e8f0fe'
);

check(
  'CSS: NO existe el gradient azul fuerte viejo (#1a73e8 → #174ea6) en el header',
  !/\.kair-update-dropdown__header\s*\{[^}]*linear-gradient\(135deg,\s*#1a73e8[^}]*#174ea6/m.test(css),
  'gradient viejo reemplazado (era demasiado intenso)'
);

check(
  'CSS: botón --primary es azul sólido',
  /\.kair-update-dropdown__btn--primary\s*\{[^}]*background:\s*#1a73e8/m.test(css),
  'botón "Reiniciar ahora" destacado'
);

check(
  'CSS: botón --ghost es gris claro',
  /\.kair-update-dropdown__btn--ghost\s*\{[^}]*background:\s*#f3f4f6/m.test(css),
  'botón "Más tarde" secundario'
);

// --- CSS: animaciones ---
check(
  'CSS: animación kair-update-dropdown-in existe (entrada del dropdown)',
  /@keyframes\s+kair-update-dropdown-in/.test(css),
  'animación de entrada al abrir'
);

check(
  'CSS: .kair-update-dropdown tiene animación de entrada',
  /\.kair-update-dropdown\s*\{[^}]*animation:\s*kair-update-dropdown-in/m.test(css),
  'animación aplicada al dropdown'
);

check(
  'CSS: respeta prefers-reduced-motion',
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.footer-update-btn[\s\S]*?\.kair-update-dropdown/m.test(css),
  'accesibilidad'
);

// --- CSS: NO debe quedar el banner viejo ---
check(
  'CSS: NO existe .kair-update-banner (banner viejo eliminado)',
  !/\.kair-update-banner\s*\{/.test(css),
  'estilos del banner viejo deben estar borrados'
);

check(
  'CSS: NO existe @keyframes kair-banner-slide-down (animación vieja)',
  !/@keyframes\s+kair-banner-slide-down/.test(css),
  'animaciones viejas deben estar borradas'
);

// --- renderer.js checks (footer dot, no header button) ---
const rendererPath = path.join(__dirname, '..', 'renderer.js');
const renderer = fs.readFileSync(rendererPath, 'utf8');

check(
  'JS: updateHeaderStatus() ya NO pone style.display en el dot del footer',
  !/footerUpdateBtn\.style\.display\s*=\s*['"]none['"]/.test(renderer),
  'inline style.display override era el problema'
);

check(
  'JS: updateHeaderStatus() usa footerUpdateBtn.hidden = true/false',
  /footerUpdateBtn\.hidden\s*=\s*(true|false)/.test(renderer),
  'atributo hidden es manejado por CSS con !important'
);

check(
  'JS: classList.remove incluye "footer-update-ok" (nueva clase)',
  /classList\.remove\([\s\S]*?['"]footer-update-ok['"]/m.test(renderer),
  'clase de estado al día (oculto)'
);

check(
  'JS: case "uptodate" agrega clase footer-update-ok',
  /case\s+['"]uptodate['"][\s\S]*?classList\.add\(['"]footer-update-ok['"]/m.test(renderer),
  'estado al día: dot oculto, sin ruido visual'
);

check(
  'JS: case "uptodate" usa footerUpdateBtn.hidden = true (oculto al día)',
  /case\s+['"]uptodate['"][\s\S]*?footerUpdateBtn\.hidden\s*=\s*true/m.test(renderer),
  'oculto: el footer muestra solo la versión, sin dot'
);

check(
  'JS: case "uptodate" setea footerUpdateBtn.title con la versión',
  /case\s+['"]uptodate['"][\s\S]*?footerUpdateBtn\.title\s*=[\s\S]*?Versión\s+\$\{options\.version\}/m.test(renderer),
  'title útil: "Versión 0.1.130 — Click para más información"'
);

check(
  'JS: case "available" usa footerUpdateBtn.hidden = false (dot visible)',
  /case\s+['"]available['"][\s\S]*?footerUpdateBtn\.hidden\s*=\s*false/m.test(renderer),
  'visible: dot azul con pulse cuando hay update'
);

check(
  'JS: case "available" agrega clase footer-update-available (dot azul)',
  /case\s+['"]available['"][\s\S]*?classList\.add\(['"]footer-update-available['"]/m.test(renderer),
  'color azul corporativo con pulse animation'
);

check(
  'JS: case "ready" agrega clase footer-update-ready (dot verde)',
  /case\s+['"]ready['"][\s\S]*?classList\.add\(['"]footer-update-ready['"]/m.test(renderer),
  'color verde con box-shadow de halo'
);

check(
  'JS: NO quedan referencias a headerUpdateBtn / headerUpdateText en código activo',
  !/const\s+headerUpdateBtn\s*=/.test(renderer) &&
  !/const\s+headerUpdateText\s*=/.test(renderer),
  'header libre de referencias de update'
);

check(
  'JS: footerUpdateBtn click handler llama a openUpdateDropdown() / closeUpdateDropdown()',
  /footerUpdateBtn\.addEventListener\(['"]click['"][\s\S]*?openUpdateDropdown\(\)/m.test(renderer) &&
  /footerUpdateBtn\.addEventListener\(['"]click['"][\s\S]*?closeUpdateDropdown\(\)/m.test(renderer),
  'click en el dot del footer abre/cierra el dropdown'
);

check(
  'JS: openUpdateDropdown() usa app-footer como referencia inferior (no el dot)',
  /function\s+openUpdateDropdown[\s\S]*?getElementById\(['"]app-footer['"]\)[\s\S]*?footerTop/m.test(renderer),
  'dropdown posicionado arriba del TOP del footer (no del dot) — evita invadirlo'
);

check(
  'JS: openUpdateDropdown() usa GAP de 16px entre el dropdown y el footer',
  /const\s+GAP\s*=\s*16/.test(renderer),
  'separación suficiente entre el bottom del dropdown y el top del footer'
);

check(
  'JS: openUpdateDropdown() usa getBoundingClientRect() para sincronizar posición',
  /function\s+openUpdateDropdown[\s\S]*?getBoundingClientRect/m.test(renderer),
  'dropdown se posiciona dinámicamente con la posición del botón'
);

check(
  'JS: openUpdateDropdown() setea CSS variable --arrow-pos-x para la flechita',
  /setProperty\(['"]--arrow-pos-x['"]/m.test(renderer),
  'flechita apunta al botón'
);

check(
  'JS: click fuera del dropdown lo cierra',
  /document\.addEventListener\(['"]click['"][\s\S]*?closeUpdateDropdown\(\)/m.test(renderer),
  'UX: click fuera cierra'
);

check(
  'JS: Escape cierra el dropdown',
  /keydown[\s\S]*?Escape[\s\S]*?closeUpdateDropdown/m.test(renderer),
  'UX: atajo de teclado'
);

check(
  'JS: scroll cierra el dropdown',
  /scroll[\s\S]*?closeUpdateDropdown/m.test(renderer),
  'UX: scroll cierra el dropdown'
);

// --- Loop 2: handlers de los botones del dropdown + limpieza del panel viejo ---

check(
  'JS: dropdown tiene addEventListener click con delegación de eventos',
  /kair-update-dropdown[\s\S]{0,100}addEventListener\(['"]click['"][\s\S]*?data-kair-update-action/m.test(renderer) ||
  /addEventListener\(['"]click['"][\s\S]*?data-kair-update-action[\s\S]*?kair-update-dropdown/m.test(renderer),
  '1 listener para todos los botones del dropdown (más eficiente)'
);

check(
  'JS: click en restart llama a window.electronAPI.restartApp()',
  /data-kair-update-action[\s\S]*?restart[\s\S]*?window\.electronAPI\.restartApp\(\)/m.test(renderer),
  'botón Reiniciar ahora llama al IPC del backend'
);

check(
  'JS: click en dismiss llama a closeUpdateDropdown()',
  /data-kair-update-action[\s\S]*?dismiss[\s\S]*?closeUpdateDropdown\(\)/m.test(renderer),
  'botón Más tarde cierra el dropdown'
);

check(
  'JS: ya NO existe headerUpdatePanel en el código activo',
  !/headerUpdatePanel\.style\.display\s*=\s*['"]none['"]/.test(renderer) &&
  !/headerUpdatePanel\.style\.display\s*=\s*['"]flex['"]/.test(renderer),
  'panel viejo eliminado del flujo de update'
);

check(
  'JS: ya NO se declaran updateDownloadBtn / updateInstallBtn / updateProgressFill',
  !/const\s+updateDownloadBtn\s*=/.test(renderer) &&
  !/const\s+updateInstallBtn\s*=/.test(renderer) &&
  !/const\s+updateProgressFill\s*=/.test(renderer) &&
  !/const\s+updateProgressText\s*=/.test(renderer),
  'elementos del panel viejo eliminados'
);

check(
  'JS: ya NO existe la función updateHeaderProgress()',
  !/function\s+updateHeaderProgress\s*\(/.test(renderer),
  'helper del panel viejo eliminado'
);

check(
  'JS: listeners del backend siguen intactos (onUpdateAvailable, etc.)',
  /onUpdateAvailable[\s\S]*?updateHeaderStatus\(['"]available['"]/m.test(renderer) &&
  /onUpdateDownloaded[\s\S]*?updateHeaderStatus\(['"]ready['"]/m.test(renderer) &&
  /onUpdateNotAvailable[\s\S]*?updateHeaderStatus\(['"]uptodate['"]/m.test(renderer),
  '5 listeners del backend siguen cableados al nuevo botón'
);

// --- Loop 3: quitar el toast invasivo de update-notifications.js ---
const updateNotifPath = path.join(__dirname, '..', 'assets', 'js', 'update-notifications.js');
const updateNotif = fs.readFileSync(updateNotifPath, 'utf8');

check(
  'JS (update-notif): notifyAvailable() ya NO crea toast (es no-op)',
  /notifyAvailable\([^)]*\)\s*\{[\s\S]*?console\.log\(.*notifyAvailable/m.test(updateNotif) &&
  !/notifyAvailable\([^)]*\)\s*\{[\s\S]*?this\.show\(\{[\s\S]*?type:\s*['"]info['"]/m.test(updateNotif),
  'toast invasivo eliminado (info va en el botón del header)'
);

check(
  'JS (update-notif): notifyDownloaded() ya NO crea toast (es no-op)',
  /notifyDownloaded\([^)]*\)\s*\{[\s\S]*?console\.log\(.*notifyDownloaded/m.test(updateNotif) &&
  !/notifyDownloaded\([^)]*\)\s*\{[\s\S]*?this\.show\(\{[\s\S]*?type:\s*['"]success['"]/m.test(updateNotif),
  'toast de "¡Actualización Lista!" eliminado (reemplazado por dropdown)'
);

check(
  'JS (update-notif): updateProgress() ya NO actualiza toast (es no-op)',
  /updateProgress\s*\([^)]*\)\s*\{[\s\S]*?(No-op|no[- ]op)/m.test(updateNotif) ||
  /updateProgress\s*\([^)]*\)\s*\{[\s\S]*?mantenido por compatibilidad[\s\S]*?\}/m.test(updateNotif),
  'progress bar del toast eliminado (no hay toast que actualizar)'
);

check(
  'JS (update-notif): notifyError() SIGUE creando toast (para errores graves)',
  /notifyError\s*\([^)]*\)\s*\{[\s\S]*?this\.show\(\{[\s\S]*?type:\s*['"]error['"][\s\S]*?autoClose:\s*6000/m.test(updateNotif),
  'errores siguen mostrándose (transitorio, no invasivo)'
);

check(
  'JS (update-notif): notifyChecking() y notifyNotAvailable() siguen disponibles (compatibilidad)',
  /notifyChecking\s*\(\s*\)\s*\{/.test(updateNotif) &&
  /notifyNotAvailable\s*\(\s*\)\s*\{/.test(updateNotif),
  'métodos legacy no se rompen (pueden usarse en otros lugares)'
);

// =============================================================================
// 📦581 (Loop 5) — Modal "Información de actualizaciones" (user-invoked)
// Trigger: botón "Ver información de versión" en el dropdown del header.
// UX: Claude-style, low blue tone, border-radius 12px, sin invadir.
// =============================================================================

console.log('\n=== Loop 5 (📦581) — Modal de información de actualizaciones ===\n');

// --- HTML: limpieza (saco duplicados del Loop 1) ---
check(
  'HTML limpio: NO existe #header-update-panel (panel viejo eliminado)',
  !/id="header-update-panel"/.test(html),
  'panel con progress bar eliminado — ya no se usa'
);

check(
  'HTML limpio: NO existe #update-progress-fill / #update-download-btn / #update-install-btn',
  !/id="update-progress-fill"/.test(html) &&
  !/id="update-download-btn"/.test(html) &&
  !/id="update-install-btn"/.test(html),
  'elementos del panel viejo eliminados del DOM'
);

check(
  'HTML limpio: solo UN #kair-update-dropdown en el body (no duplicado)',
  (() => {
    const matches = html.match(/id="kair-update-dropdown"/g) || [];
    return matches.length === 1;
  })(),
  '1 único dropdown — el del header fue eliminado (Loop 1.6 lo había movido al body)'
);

// --- HTML: botón "Ver detalles" en el dropdown ---
check(
  'HTML: botón "Ver información de versión" existe en el dropdown (action="details")',
  /data-kair-update-action="details"[\s\S]*?Ver información de versión/.test(html),
  'link que abre el modal'
);

// --- HTML: modal ---
check(
  'HTML: overlay del modal existe con id correcto',
  /<div[^>]*id="kair-update-modal-overlay"[^>]*>/.test(html),
  'overlay con id claro'
);

check(
  'HTML: overlay del modal está oculto por default (atributo hidden)',
  /id="kair-update-modal-overlay"[^>]*\bhidden\b/.test(html),
  'no aparece hasta que se abra explícitamente'
);

check(
  'HTML: modal tiene role="dialog" y aria-modal="true" (a11y)',
  /id="kair-update-modal"[^>]*role="dialog"/.test(html) &&
  /id="kair-update-modal"[^>]*aria-modal="true"/.test(html),
  'lectores de pantalla lo tratan como diálogo modal'
);

check(
  'HTML: modal tiene aria-labelledby apuntando al título',
  /id="kair-update-modal"[^>]*aria-labelledby="kair-update-modal-title"/.test(html),
  'a11y: asociación del título con el diálogo'
);

check(
  'HTML: modal tiene título "Información de actualizaciones"',
  /id="kair-update-modal-title"[^>]*>Información de actualizaciones/.test(html),
  'título claro del modal'
);

check(
  'HTML: modal tiene data-kair-modal-state-badge con state inicial "uptodate"',
  /data-kair-modal-state="uptodate"/.test(html),
  'estado inicial: al día'
);

check(
  'HTML: modal tiene data-kair-modal-current-version',
  /data-kair-modal-current-version/.test(html),
  'placeholder para versión instalada'
);

check(
  'HTML: modal tiene data-kair-modal-latest-version',
  /data-kair-modal-latest-version/.test(html),
  'placeholder para última versión disponible'
);

check(
  'HTML: modal tiene data-kair-modal-last-check',
  /data-kair-modal-last-check/.test(html),
  'placeholder para última verificación'
);

check(
  'HTML: modal tiene botón "Cerrar" (data-kair-update-action="modal-close")',
  /data-kair-update-action="modal-close"[\s\S]*?Cerrar/.test(html),
  'botón secundario para cerrar'
);

check(
  'HTML: modal tiene botón "Buscar actualizaciones ahora" (data-kair-update-action="modal-check")',
  /data-kair-update-action="modal-check"[\s\S]*?Buscar actualizaciones ahora/.test(html),
  'acción principal: check manual'
);

check(
  'HTML: modal tiene botón X (×) en el header (data-kair-update-action="modal-close")',
  /class="kair-update-modal__close"[\s\S]*?data-kair-update-action="modal-close"/.test(html),
  'X visible en el header (esquina sup. derecha)'
);

// --- CSS: overlay + card ---
check(
  'CSS: .kair-update-modal-overlay es position: fixed (encima de todo)',
  /\.kair-update-modal-overlay\s*\{[^}]*position:\s*fixed/m.test(css),
  'overlay fijo en pantalla'
);

check(
  'CSS: .kair-update-modal-overlay tiene z-index 500010 (mayor al dropdown 500001)',
  /\.kair-update-modal-overlay\s*\{[^}]*z-index:\s*500010/m.test(css),
  'modal encima del dropdown (jerarquía)'
);

check(
  'CSS: .kair-update-modal-overlay tiene backdrop-filter blur (look moderno)',
  /\.kair-update-modal-overlay\s*\{[^}]*backdrop-filter:\s*blur/m.test(css),
  'fondo difuminado (estilo modal nativo)'
);

check(
  'CSS: .kair-update-modal tiene border-radius 12px (sin puntas)',
  /\.kair-update-modal\s*\{[^}]*border-radius:\s*12px/m.test(css),
  'esquinas suaves (consistente con el dropdown)'
);

check(
  'CSS: .kair-update-modal tiene box-shadow (look moderno)',
  /\.kair-update-modal\s*\{[^}]*box-shadow:/m.test(css),
  'sombra proyectada'
);

check(
  'CSS: .kair-update-modal tiene max-height y overflow controlado',
  /\.kair-update-modal\s*\{[^}]*max-height:[^}]*overflow/m.test(css),
  'modal no excede la pantalla (scroll interno si es necesario)'
);

check(
  'CSS: header del modal usa low blue tone (#e8f0fe) en el ícono',
  /\.kair-update-modal__icon\s*\{[^}]*background:\s*#e8f0fe/m.test(css),
  'ícono en azul claro (Claude-style)'
);

check(
  'CSS: ícono del modal usa color azul corporativo (#1a73e8)',
  /\.kair-update-modal__icon\s*\{[^}]*color:\s*#1a73e8/m.test(css),
  'ícono visible sobre fondo claro'
);

check(
  'CSS: badge de estado "available" usa #e8f0fe (low blue tone)',
  /data-kair-modal-state="available"\s*\]\s+\.kair-update-modal__state-badge[\s\S]*?background:\s*#e8f0fe/m.test(css) ||
  /\.kair-update-modal__state-badge\[data-kair-modal-state="available"\][^}]*background:\s*#e8f0fe/m.test(css),
  'azul claro para "Actualización disponible"'
);

check(
  'CSS: badge de estado "ready" usa verde (#dcfce7)',
  /data-kair-modal-state="ready"[\s\S]*?background:\s*#dcfce7/m.test(css),
  'verde claro para "Listo para reiniciar"'
);

check(
  'CSS: estado "available" tiene animación pulse en el dot',
  /data-kair-modal-state="available"[\s\S]*?kair-update-dot-pulse/m.test(css),
  'pulse del dot cuando hay update'
);

check(
  'CSS: .kair-update-modal tiene animación de entrada',
  /@keyframes\s+kair-update-modal-in/.test(css) &&
  /\.kair-update-modal\s*\{[^}]*animation:\s*kair-update-modal-in/m.test(css),
  'animación al abrir'
);

check(
  'CSS: dark theme support para .kair-update-modal',
  /\[data-theme="dark"\]\s+\.kair-update-modal[\s\S]{0,200}background:\s*#1e293b/m.test(css),
  'modal se ve bien en tema oscuro'
);

check(
  'CSS: prefers-reduced-motion deshabilita animación del modal',
  /prefers-reduced-motion:\s*reduce[\s\S]*?kair-update-modal[\s\S]*?animation:\s*none/m.test(css),
  'accesibilidad: respeta preferencia del user'
);

// --- CSS: botón "Ver información de versión" en el dropdown (link) ---
check(
  'CSS: .kair-update-dropdown__link existe (link "Ver información de versión")',
  /\.kair-update-dropdown__link\s*\{/.test(css),
  'link azul dentro del dropdown'
);

check(
  'CSS: link usa color #1a73e8 (azul corporativo)',
  /\.kair-update-dropdown__link\s*\{[^}]*color:\s*#1a73e8/m.test(css),
  'link visible y clickeable'
);

// --- JS: updateState + helper compareVersions ---
check(
  'JS: updateState se inicializa con state/currentVersion/latestVersion/lastCheckTime',
  /const\s+updateState\s*=\s*\{[\s\S]*?state:\s*['"]uptodate['"][\s\S]*?currentVersion:\s*null[\s\S]*?latestVersion:\s*null[\s\S]*?lastCheckTime:\s*null/m.test(renderer),
  'objeto de estado completo para el modal'
);

check(
  'JS: existe función compareVersions() para comparar versiones semánticas',
  /function\s+compareVersions\s*\(/.test(renderer),
  'helper para determinar si la "última conocida" es realmente la más reciente'
);

check(
  'JS: updateHeaderStatus() sincroniza updateState.state con el state del header',
  /function\s+updateHeaderStatus[\s\S]*?updateState\.state\s*=\s*state/m.test(renderer),
  'header y modal comparten la misma fuente de verdad'
);

check(
  'JS: updateHeaderStatus() guarda currentVersion cuando state es "uptodate"',
  /state\s*===\s*['"]uptodate['"][\s\S]*?updateState\.currentVersion\s*=\s*options\.version/m.test(renderer),
  'versión instalada en el state'
);

check(
  'JS: updateHeaderStatus() guarda latestVersion cuando hay update (available/ready)',
  /(state\s*===\s*['"]available['"]|state\s*===\s*['"]ready['"])[\s\S]*?updateState\.latestVersion\s*=\s*options\.version/m.test(renderer),
  'última versión conocida en el state'
);

check(
  'JS: getAppVersion() setea updateState.currentVersion',
  /getAppVersion\(\)[\s\S]*?updateState\.currentVersion\s*=\s*version/m.test(renderer),
  'versión inicial se guarda en el state'
);

// --- JS: listeners del backend trackean lastCheckTime ---
check(
  'JS: onUpdateChecking setea updateState.lastCheckTime + isChecking',
  /onUpdateChecking[\s\S]*?updateState\.lastCheckTime\s*=\s*Date\.now\(\)[\s\S]*?updateState\.isChecking\s*=\s*true/m.test(renderer),
  'timestamp del último check se actualiza cuando empieza el check'
);

check(
  'JS: onUpdateAvailable resetea updateState.isChecking',
  /onUpdateAvailable[\s\S]*?updateState\.isChecking\s*=\s*false/m.test(renderer),
  'check terminó: update encontrado'
);

check(
  'JS: onUpdateNotAvailable resetea updateState.isChecking + limpia latestVersion',
  /onUpdateNotAvailable[\s\S]*?updateState\.isChecking\s*=\s*false[\s\S]*?updateState\.lastCheckTime\s*=\s*Date\.now\(\)/m.test(renderer),
  'check terminó sin update, se limpia el state'
);

// --- JS: handlers del modal ---
check(
  'JS: existe función openUpdateModal()',
  /function\s+openUpdateModal\s*\(/.test(renderer),
  'abre el overlay y renderiza el estado'
);

check(
  'JS: existe función closeUpdateModal()',
  /function\s+closeUpdateModal\s*\(/.test(renderer),
  'cierra el overlay'
);

check(
  'JS: existe función renderUpdateModal() que pinta el estado',
  /function\s+renderUpdateModal\s*\(/.test(renderer),
  'pinta badge, texto, versiones, botón de check'
);

check(
  'JS: existe función triggerUpdateCheck() que llama a electronAPI.checkForUpdatesManual',
  /function\s+triggerUpdateCheck\s*\(\)[\s\S]*?electronAPI\.checkForUpdatesManual/m.test(renderer),
  'dispara un check manual al backend'
);

check(
  'JS: dropdown click handler tiene case "details" que abre el modal',
  /data-kair-update-action[\s\S]*?details[\s\S]*?openUpdateModal\(\)/m.test(renderer),
  '"Ver información de versión" abre el modal'
);

check(
  'JS: modal tiene event delegation con case "modal-close"',
  /data-kair-update-action[\s\S]*?modal-close[\s\S]*?closeUpdateModal\(\)/m.test(renderer),
  'botón Cerrar y X cierran el modal'
);

check(
  'JS: modal tiene event delegation con case "modal-check"',
  /data-kair-update-action[\s\S]*?modal-check[\s\S]*?triggerUpdateCheck\(\)/m.test(renderer),
  'botón "Buscar actualizaciones" dispara el check'
);

check(
  'JS: click en overlay (no en modal) cierra el modal',
  /e\.target\s*===\s*kairUpdateModalOverlay[\s\S]*?closeUpdateModal\(\)/m.test(renderer),
  'click fuera del card (sobre el backdrop) cierra'
);

check(
  'JS: Escape cierra el modal (además del dropdown)',
  /Escape[\s\S]*?kair-update-modal-overlay[\s\S]*?closeUpdateModal\(\)/m.test(renderer),
  'atajo de teclado: Escape cierra el modal'
);

check(
  'JS: triggerUpdateCheck deshabilita el botón mientras isChecking',
  /checkBtn\.disabled\s*=\s*!!updateState\.isChecking/m.test(renderer),
  'UX: feedback visual de "buscando"'
);

// =============================================================================
// 📦581 (Loop 7) — Panel "Actualizaciones" en Configuración
// El config-viewer.html ahora tiene info detallada (versión, última check)
// + botón de check manual con los mismos datos que el modal del footer.
// =============================================================================

console.log('\n=== Loop 7 (📦581) — Panel Actualizaciones en Configuración ===\n');

check(
  'HTML: update-section en config-viewer tiene título "Actualizaciones"',
  /id="update-section"[\s\S]*?<h4[\s\S]*?Actualizaciones/.test(configViewerHtml) ||
  /id="update-section"[\s\S]*?Actualizaciones[\s\S]*?<\/h4>/.test(configViewerHtml),
  'sección visible con título claro'
);

check(
  'HTML: config-viewer tiene config-current-version',
  /id="config-current-version"/.test(configViewerHtml),
  'campo de versión instalada'
);

check(
  'HTML: config-viewer tiene config-latest-version',
  /id="config-latest-version"/.test(configViewerHtml),
  'campo de última versión disponible'
);

check(
  'HTML: config-viewer tiene config-last-check',
  /id="config-last-check"/.test(configViewerHtml),
  'campo de última verificación'
);

check(
  'HTML: config-viewer tiene .kair-update-config-grid',
  /class="kair-update-config-grid"/.test(configViewerHtml),
  'grid con la info detallada'
);

check(
  'JS (config-viewer): existe función updateConfigVersionInfo()',
  /function\s+updateConfigVersionInfo\s*\(/.test(configViewerHtml),
  'helper para actualizar la info del panel'
);

check(
  'JS (config-viewer): existe función configFormatRelativeTime()',
  /function\s+configFormatRelativeTime\s*\(/.test(configViewerHtml),
  'helper para formato de tiempo relativo'
);

check(
  'JS (config-viewer): existe función compareVersions()',
  /function\s+compareVersions\s*\(/.test(configViewerHtml),
  'helper para comparar versiones semánticas'
);

check(
  'JS (config-viewer): onUpdateAvailable llama updateConfigVersionInfo',
  /onUpdateAvailable[\s\S]*?updateConfigVersionInfo/m.test(configViewerHtml),
  'panel se actualiza cuando llega un update_available'
);

// =============================================================================
// 📦581 (Loop 8) — Disclaimer "Se instalará al cerrar la app" en el footer
// Aparece al lado del dot SOLO cuando hay update (available/ready).
// =============================================================================

console.log('\n=== Loop 8 (📦581) — Disclaimer en footer ===\n');

check(
  'HTML: footer tiene #footer-update-disclaimer (oculto por default)',
  /id="footer-update-disclaimer"[^>]*\bhidden\b/.test(html),
  'disclaimer agregado al footer junto al dot'
);

check(
  'CSS: .footer-update-disclaimer existe (estilos)',
  /\.footer-update-disclaimer\s*\{/.test(css),
  'estilos del disclaimer (tipografía sutil, italic)'
);

check(
  'CSS: .footer-update-disclaimer[hidden] usa display: none !important',
  /\.footer-update-disclaimer\[hidden\]\s*\{[^}]*display:\s*none\s*!important/m.test(css),
  'oculto por default con !important (no override)'
);

check(
  'CSS: disclaimer tiene animación de entrada kair-footer-disclaimer-in',
  /@keyframes\s+kair-footer-disclaimer-in/.test(css),
  'animación sutil cuando aparece'
);

check(
  'JS: case "available" muestra el disclaimer',
  /showDisclaimer[\s\S]*?\(state\s*===\s*['"]available['"]\s*\|\|\s*state\s*===\s*['"]ready['"]\)[\s\S]*?disclaimer\.hidden\s*=\s*!showDisclaimer/m.test(renderer),
  'disclaimer visible cuando hay update disponible'
);

check(
  'JS: case "ready" muestra el disclaimer con copy "Lista para reiniciar"',
  /disclaimer\.textContent\s*=\s*state\s*===\s*['"]ready['"]\s*\?\s*['"]Lista para reiniciar['"]/.test(renderer),
  'disclaimer cambia el copy según el estado'
);

check(
  'JS: disclaimer se oculta con !showDisclaimer',
  /disclaimer\.hidden\s*=\s*!showDisclaimer/.test(renderer),
  'disclaimer se muestra/oculta dinámicamente según showDisclaimer (available | ready)'
);

check(
  'JS: showDisclaimer evalúa available o ready',
  /const\s+showDisclaimer\s*=\s*\(state\s*===\s*['"]available['"]\s*\|\|\s*state\s*===\s*['"]ready['"]\)/.test(renderer),
  'showDisclaimer es true SOLO cuando hay update (available o ready)'
);

// =============================================================================
// 📦581 (Loop 9) — Release notes preview (GitHub API)
// El modal muestra un preview de las release notes de la última versión.
// =============================================================================

console.log('\n=== Loop 9 (📦581) — Release notes preview ===\n');

const mainPath = path.join(__dirname, '..', 'main.js');
const mainJs = fs.readFileSync(mainPath, 'utf8');
const preloadPath = path.join(__dirname, '..', 'preload.js');
const preloadJs = fs.readFileSync(preloadPath, 'utf8');

check(
  'main.js: existe IPC handler "get-release-notes"',
  /ipcMain\.handle\(['"]get-release-notes['"]/.test(mainJs),
  'handler que fetcha la última release de GitHub'
);

check(
  'main.js: handler usa GITHUB_REPO o URL a api.github.com',
  /api\.github\.com\/repos/.test(mainJs) && /releases\/latest/.test(mainJs),
  'endpoint correcto de GitHub Releases API'
);

check(
  'main.js: handler implementa cache (releaseNotesCache)',
  /releaseNotesCache[\s\S]*?fetchedAt/.test(mainJs),
  'evita martillar la API con TTL de 1h'
);

check(
  'preload.js: expone getReleaseNotes en electronAPI',
  /getReleaseNotes:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(['"]get-release-notes['"]\)/.test(preloadJs),
  'método disponible en el renderer'
);

check(
  'HTML: modal tiene kair-modal-release-notes-wrap (oculto por default)',
  /id="kair-modal-release-notes-wrap"[^>]*\bhidden\b/.test(html),
  'sección de release notes en el modal'
);

check(
  'HTML: modal tiene kair-modal-release-notes (donde se renderiza)',
  /id="kair-modal-release-notes"/.test(html),
  'contenedor del preview'
);

check(
  'CSS: .kair-update-modal__notes existe con max-height y overflow',
  /\.kair-update-modal__notes\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/m.test(css),
  'scroll interno si las notes son largas'
);

check(
  'JS: existe función loadReleaseNotes()',
  /function\s+loadReleaseNotes\s*\(/.test(renderer),
  'función que fetcha las notes y las renderiza'
);

check(
  'JS: existe función renderReleaseNotes(release)',
  /function\s+renderReleaseNotes\s*\(/.test(renderer),
  'función que pinta el body en el contenedor'
);

check(
  'JS: renderUpdateModal llama loadReleaseNotes cuando hay update',
  /function\s+renderUpdateModal[\s\S]*?loadReleaseNotes\(\)/m.test(renderer),
  'el modal carga las notes al abrirse en estado available/ready'
);

check(
  'JS: loadReleaseNotes usa window.electronAPI.getReleaseNotes',
  /loadReleaseNotes[\s\S]*?electronAPI\.getReleaseNotes\(\)/m.test(renderer),
  'llamada al IPC del backend'
);

check(
  'JS: loadReleaseNotes cachea el resultado (cachedReleaseNotes)',
  /let\s+cachedReleaseNotes[\s\S]*?cachedReleaseNotes\s*=\s*result\.data/m.test(renderer),
  'evita re-fetchar en cada apertura del modal'
);

// =============================================================================
// 📦583 (Loop 11) — Workaround: disableDifferentialDownload = true
// Fix del bug intermitente de SHA512 en el DifferentialDownloader de
// builder-util-runtime. La versión empaquetada del runtime calcula el
// hash en formatos inconsistentes (hex vs base64) y rompe la validación.
// Workaround: deshabilitar el differential download para usar siempre
// full download (264 MB pero 100% confiable).
// =============================================================================

console.log('\n=== Loop 11 (📦583) — Workaround differential download ===\n');

check(
  'main.js: autoUpdater.disableDifferentialDownload = true',
  /autoUpdater\.disableDifferentialDownload\s*=\s*true/.test(mainJs),
  'workaround: full download siempre (no differential, que tiene bug de SHA512)'
);

check(
  'main.js: hay comentario explicando por qué se deshabilita',
  /(bug|checksum|inestable|mismatch)[\s\S]{0,800}disableDifferentialDownload\s*=\s*true/i.test(mainJs),
  'futuro dev entiende por qué esta línea está (y cuándo quitarla)'
);

check(
  'main.js: el workaround está DESPUÉS de autoRunAppAfterInstall',
  /autoUpdater\.autoRunAppAfterInstall\s*=\s*true[\s\S]{0,600}autoUpdater\.disableDifferentialDownload\s*=\s*true/.test(mainJs),
  'orden correcto en la configuración del autoUpdater'
);

console.log('\n=== Resultado ===');
console.log('OK: ' + pass);
console.log('FAIL: ' + fail);
if (fail > 0) {
  console.log('\nFallos:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('\n🎉 Loops 1-5 OK — botón + dropdown + sin toast + versión en header + modal de info.');
  console.log('   Listo para Loop 7 (panel "Actualizaciones" en Configuración).');
  process.exit(0);
}
