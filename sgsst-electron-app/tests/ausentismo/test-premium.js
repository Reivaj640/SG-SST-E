const fs = require('fs');
const path = require('path');

const checks = [];
function ok(name, condition) { checks.push({ name, ok: !!condition }); }

const dir = path.join(__dirname, '..', '..', 'modules', 'gestion-salud', 'ausentismo');
const homeHtml = fs.readFileSync(path.join(dir, 'medicion-ausentismo-home.html'), 'utf8');
const homeJs = fs.readFileSync(path.join(dir, 'medicion-ausentismo-home.js'), 'utf8');
const compJs = fs.readFileSync(path.join(dir, 'medicion-ausentismo.js'), 'utf8');

// ============ HOME (iframe) — premium v2 ============
ok('HOME: Header System v2', /class="aus-header-v2"/.test(homeHtml));
ok('HOME: breadcrumb', /aus-breadcrumb/.test(homeHtml));
ok('HOME: icon chip', /aus-header-icon/.test(homeHtml));
ok('HOME: titulo Manrope', /--aus-font-display:\s*'Manrope'/.test(homeHtml));
ok('HOME: paleta canonica azul', /--aus-primary:\s*#2057b8/.test(homeHtml));
ok('HOME: canvas canonico', /--aus-bg:\s*#fbfcfb/.test(homeHtml));
ok('HOME: dark en los 2 atributos', /\[data-theme\^="dark"\]/.test(homeHtml));
ok('HOME: SVG inline (sin FA en el marcado)', !/<i class="fa[srlb]? fa-/.test(homeHtml));
ok('HOME: NO quedan iconos Font Awesome', !/fa-arrow-left|fa-file-medical|fa-folder-open|fa-heartbeat|fa-chart-line|fa-file-contract|fa-user-search|fa-person-pregnant|fa-calendar-check/.test(homeHtml));
ok('HOME: mantiene los 3 IDs de KPI', /id="ausentismoPendientes"/.test(homeHtml) && /id="ausentismoActivos"/.test(homeHtml) && /id="ausentismoCerrados"/.test(homeHtml));
ok('HOME: mantiene .stat-value/.stat-item (JS)', /class="stat-value"/.test(homeHtml) && /class="stat-item"/.test(homeHtml));
ok('HOME: mantiene kpi-unavailable (JS)', /\.stat-value\.kpi-unavailable/.test(homeHtml));
ok('HOME: mantiene los onclick del portal', ['goBackToModule()', 'registrarAusentismo()', 'verAusentismo()', 'seguimientoIncapacidades()', 'verEstadisticas()', 'generarInforme()', 'consultaTrabajadores()', 'seguimientoGestacion()'].every(f => homeHtml.indexOf('onclick="' + f + '"') !== -1));
ok('HOME: conserva estilos de loading/status', /\.km-loading-spinner/.test(homeHtml) && /\.status-message--empleado/.test(homeHtml) && /\.km-empleado-card__name/.test(homeHtml));

// ============ HOME JS — sincronizacion de tema ============
ok('HOME JS: initThemeSync existe', /function initThemeSync\(\)/.test(homeJs));
ok('HOME JS: pide el tema al padre', /get-theme-request/.test(homeJs));
ok('HOME JS: escucha theme-changed', /theme-changed/.test(homeJs));
ok('HOME JS: aplica dark-legacy vs dark', /dark-legacy/.test(homeJs) && /'dark'/.test(homeJs));
ok('HOME JS: llama initThemeSync en DOMContentLoaded', /initThemeSync\(\);/.test(homeJs));

// ============ COMPONENTE — blindaje de fugas ============
// Extraer los bloques de estilos inyectados
const lines = compJs.split('\n');
const blocks = [];
for (let i = 0; i < lines.length; i++) {
  if (/textContent\s*=\s*`\s*$/.test(lines[i])) {
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*`;?\s*$/.test(lines[j])) { blocks.push(lines.slice(i + 1, j).join('\n')); break; }
    }
  }
}
ok('COMP: encuentra los 6 bloques de estilos', blocks.length === 6);
const allCss = blocks.join('\n');

ok('COMP: NO hay :root global en los bloques', !blocks.some(b => /^\s*:root\s*\{/m.test(b)));
ok('COMP: NO hay reset * global', !blocks.some(b => /^\s*\*\s*\{/m.test(b)));
ok('COMP: NO hay body global', !blocks.some(b => /^\s*body\s*\{/m.test(b)));
ok('COMP: NO hay selector textarea suelto', !blocks.some(b => /^\s*textarea\s*\{/m.test(b)));
ok('COMP: NO hay selector select suelto', !blocks.some(b => /^\s*select\s*\{/m.test(b)));
ok('COMP: .seguimiento-panel scopeado', /\.aus-scope\s+\.seguimiento-panel\s*\{/.test(allCss));
ok('COMP: .seguimiento-backdrop scopeado', /\.aus-scope\s+\.seguimiento-backdrop/.test(allCss));
ok('COMP: .sp-form-control scopeado', /\.aus-scope[\s\S]{0,300}?select\.sp-form-control\.is-empty/.test(allCss));
ok('COMP: .sp-form-control.is-empty scopeado (regla base)', /\.aus-scope[\s\S]{0,300}?\.sp-form-control\.is-empty\s*\{/.test(allCss));
ok('COMP: .es-tabs-header scopeado', /\.aus-scope\s+\.es-tabs-header/.test(allCss));
ok('COMP: .ausentismo-table-wrapper scopeado (scrollbar)', /\.aus-scope\s+\.ausentismo-table-wrapper::-webkit-scrollbar/.test(allCss));
ok('COMP: .ausentismo-table-wrapper scopeado', /\.aus-scope\s+\.ausentismo-table-wrapper/.test(allCss));
ok('COMP: tokens --sp-* viven en .aus-scope', /\.aus-scope\s*\{[\s\S]*?--sp-primary:/.test(allCss));
ok('COMP: llaves balanceadas en cada bloque', blocks.every(b => (b.match(/\{/g) || []).length === (b.match(/\}/g) || []).length));

// keyframes renombrados
ok('COMP: @keyframes ausFadeIn', /@keyframes ausFadeIn/.test(compJs));
ok('COMP: @keyframes ausSlideDown', /@keyframes ausSlideDown/.test(compJs));
ok('COMP: @keyframes ausSlideUp', /@keyframes ausSlideUp/.test(compJs));
ok('COMP: NO queda @keyframes fadeIn suelto', !/@keyframes fadeIn\b/.test(compJs));
ok('COMP: NO queda @keyframes slideDown suelto', !/@keyframes slideDown\b/.test(compJs));
ok('COMP: NO queda @keyframes slideUp suelto', !/@keyframes slideUp\b/.test(compJs));
ok('COMP: spFadeIn/esFadeIn intactos', /@keyframes spFadeIn/.test(compJs) && /@keyframes esFadeIn/.test(compJs));

// clase aus-scope aplicada
ok('COMP: contenedor recibe aus-scope', /this\.container\.classList\.add\('aus-scope'\)/.test(compJs));
const bodyScopes = (compJs.match(/\.classList\.add\('aus-scope'\)/g) || []).length;
ok('COMP: 7 lugares reciben aus-scope (contenedor + 6 body)', bodyScopes === 7);

// ============ VISTAS PREMIUM (Registrar / Ver) ============
ok('PREMIUM: helper _injectPremiumViewsStyles existe', /_injectPremiumViewsStyles\(\)\s*\{/.test(compJs));
ok('PREMIUM: tokens --aus-* bajo .aus-scope', /\.aus-scope\s*\{[\s\S]{0,400}?--aus-primary:\s*#2057b8/.test(compJs));
ok('PREMIUM: dark para --aus-*', /\[data-theme\^="dark"\]\s+\.aus-scope\s*\{[\s\S]{0,400}?--aus-primary:\s*#6ea8fe/.test(compJs));
ok('PREMIUM: card', /\.aus-scope\s+\.aus-card/.test(compJs));
ok('PREMIUM: header de vista', /\.aus-scope\s+\.aus-view-header/.test(compJs));
ok('PREMIUM: form grid', /\.aus-scope\s+\.aus-form-grid/.test(compJs));
ok('PREMIUM: input', /\.aus-scope\s+\.aus-input/.test(compJs));
ok('PREMIUM: filtros', /\.aus-scope\s+\.aus-filters/.test(compJs));
ok('PREMIUM: tabla', /\.aus-scope\s+\.ausentismo-table\s+thead\s+th/.test(compJs));
ok('PREMIUM: badge', /\.aus-scope\s+\.aus-badge--blue/.test(compJs));
ok('PREMIUM: icon buttons', /\.aus-scope\s+\.aus-icon-btn/.test(compJs));
ok('PREMIUM: estado vacio', /\.aus-scope\s+\.aus-empty/.test(compJs));
// Transiciones y animaciones (modernizadas)
ok('ANIM: card con entrada animada', /@keyframes ausCardIn/.test(compJs) && /\.aus-card\s*\{[\s\S]{0,400}?animation:\s*ausCardIn/.test(compJs));
ok('ANIM: boton con "lift" al hover (restaurado del original)', /\.aus-btn:hover:not\(:disabled\)\s*\{[\s\S]{0,220}?transform:\s*translateY\(-1px\)/.test(compJs));
ok('ANIM: transition del boton incluye transform y box-shadow', /\.aus-btn\s*\{[\s\S]{0,400}?transition:[^;]*transform[^;]*box-shadow/.test(compJs));
ok('ANIM: active vuelve a translateY(0)', /\.aus-btn:active:not\(:disabled\)\s*\{\s*transform:\s*translateY\(0\)/.test(compJs));
ok('ANIM: input con transition de foco', /\.aus-input\s*\{[\s\S]{0,400}?transition:\s*border-color[^;]*box-shadow/.test(compJs));
ok('ANIM: respeta prefers-reduced-motion', /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]{0,300}?\.aus-card\s*\{\s*animation:\s*none/.test(compJs));
ok('ANIM: NO quedan @keyframes genericos en las vistas', !/@keyframes (fadeIn|slideUp|slideDown)\b/.test(compJs));

// Rangos de las 2 vistas
function rangoVista(reDef) {
  const idx = lines.findIndex(l => reDef.test(l));
  if (idx === -1) return null;
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^    (async\s+)?[a-zA-Z_$][\w$]*\s*\(/.test(lines[i])) return lines.slice(idx, i).join('\n');
  }
  return lines.slice(idx).join('\n');
}
const registrar = rangoVista(/^    async renderRegistrarAusentismoView\(/) || '';
const ver = rangoVista(/^    renderVerAusentismoView\(/) || '';
ok('VISTA Registrar: sin iconos Font Awesome', !/fas fa-|bi bi-/.test(registrar));
ok('VISTA Registrar: sin colores hardcodeados', !/#174ea6|#64748B|#dee2e6|#f8f9fa|#1E293B|#e2e8f0/i.test(registrar));
ok('VISTA Registrar: usa aus-card', /aus-card/.test(registrar));
ok('VISTA Registrar: usa aus-form-grid', /aus-form-grid/.test(registrar));
ok('VISTA Registrar: usa aus-input', /aus-input/.test(registrar));
ok('VISTA Registrar: usa aus-btn', /aus-btn/.test(registrar));
ok('VISTA Registrar: conserva los 15 IDs del form', ['cedula-input','nombre-input','cargo-input','departamento-input','empresa-usuaria-input','genero-select','clase-incapacidad-select','tipo-incapacidad-select','entidad-input','fecha-inicio-input','fecha-fin-input','codigo-input','descripcion-input','limpiar-btn','registrar-btn'].every(id => registrar.indexOf('id="' + id + '"') !== -1));
ok('VISTA Registrar: conserva .registrar-ausentismo-form', /registrar-ausentismo-form/.test(registrar));
ok('VISTA Registrar: conserva id form-status', /form-status/.test(registrar));

ok('VISTA Ver: sin iconos Font Awesome', !/fas fa-|bi bi-/.test(ver));
ok('VISTA Ver: sin colores hardcodeados', !/#174ea6|#64748B|#dee2e6|#f8f9fa|#1E293B|#e2e8f0/i.test(ver));
ok('VISTA Ver: usa aus-card', /aus-card/.test(ver));
ok('VISTA Ver: usa aus-filters', /aus-filters/.test(ver));
ok('VISTA Ver: usa ausentismo-table', /ausentismo-table/.test(ver));
ok('VISTA Ver: conserva los IDs de filtros', ['searchFilter','yearFilter','monthFilter','typeFilter','applyFiltersBtn','clearFiltersBtn'].every(id => ver.indexOf('id="' + id + '"') !== -1));
ok('VISTA Ver: conserva ausentismoTableBody', /ausentismoTableBody/.test(ver));
ok('VISTA Ver: conserva el target del FAB', /ausentismo-table-scroll/.test(ver));

// Filas de la tabla
ok('FILAS: sin colores hardcodeados', !/badgeColor = '#dbeafe'/.test(compJs));
ok('FILAS: badge con clase premium', /aus-badge \$\{badgeClass\}/.test(compJs));
ok('FILAS: botones con clase premium', /aus-icon-btn aus-icon-btn--edit btn-ausentismo-edit/.test(compJs) && /aus-icon-btn aus-icon-btn--danger btn-ausentismo-delete/.test(compJs));
ok('FILAS: conserva las clases de delegacion', /btn-ausentismo-edit, button\.btn-ausentismo-delete/.test(compJs));
ok('FILAS: empty state premium', /class="aus-empty"/.test(compJs));

// ============ SEGUIMIENTO DE INCAPACIDADES ============
const seguimiento = rangoVista(/^    async renderSeguimientoIncapacidadesView\(/) || '';
ok('SEGUIMIENTO: sin iconos Font Awesome', !/fas fa-|bi bi-/.test(seguimiento));
ok('SEGUIMIENTO: sin colores hardcodeados', !/#174ea6|#64748B|#dee2e6|#f8f9fa|#1E293B|#e2e8f0|#F8FAFC/i.test(seguimiento));
ok('SEGUIMIENTO: usa aus-view-header', /aus-view-header/.test(seguimiento));
ok('SEGUIMIENTO: usa aus-kpis', /aus-kpis/.test(seguimiento));
ok('SEGUIMIENTO: usa aus-kpi', /aus-kpi__icon/.test(seguimiento));
ok('SEGUIMIENTO: usa aus-filters', /aus-filters/.test(seguimiento));
ok('SEGUIMIENTO: usa ausentismo-table', /ausentismo-table/.test(seguimiento));
ok('SEGUIMIENTO: NO inyecta Font Awesome CDN', !/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/.test(compJs));
ok('SEGUIMIENTO: conserva los IDs de filtros', ['seguimientoSearchInput','seguimientoEstadoFilter','seguimientoTipoFilter','seguimientoYearFilter','seguimientoMonthFilter','seguimientoFilterBtn','seguimientoClearBtn'].every(id => seguimiento.indexOf('id="' + id + '"') !== -1));
ok('SEGUIMIENTO: conserva seguimientoTableBody', /seguimientoTableBody/.test(seguimiento));

// Filas del seguimiento
ok('SEGUIMIENTO filas: avatar premium', /class="aus-avatar"/.test(compJs));
ok('SEGUIMIENTO filas: badge premium', /aus-badge \$\{tipo === 'ARL' \? 'aus-badge--amber' : 'aus-badge--green'\}/.test(compJs));
ok('SEGUIMIENTO filas: progress premium', /aus-progress__bar/.test(compJs));
ok('SEGUIMIENTO filas: estado badge premium', /aus-badge--gray/.test(compJs));
ok('SEGUIMIENTO filas: acciones con aus-icon-btn', /aus-icon-btn" title="Ver Detalles"/.test(compJs));
ok('SEGUIMIENTO: PRI badge con SVG', /sp-pri-badge is-pri"[\s\S]{0,200}?<svg/.test(compJs));
// Regresión: el backdrop se monta en <body> con .aus-scope EN SÍ MISMO,
// así que los selectores deben cubrir la forma "self" además de la descendiente.
ok('SEGUIMIENTO: backdrop cubre la forma self (base)', /\.aus-scope\.seguimiento-backdrop\s*\{/.test(compJs));
ok('SEGUIMIENTO: backdrop cubre la forma self (.active)', /\.aus-scope\.seguimiento-backdrop\.active\s*\{/.test(compJs));
ok('SEGUIMIENTO: panel visible cubre la forma self', /\.aus-scope\.seguimiento-backdrop\.active \.seguimiento-panel/.test(compJs));

// ============ ESTADÍSTICAS ============
const estadisticas = rangoVista(/^    renderEstadisticasView\(/) || '';
ok('ESTADISTICAS: sin iconos Font Awesome', !/fas fa-|bi bi-/.test(estadisticas));
ok('ESTADISTICAS: CSS usa tokens --aus-*', /\.aus-scope \.estadisticas-dashboard[\s\S]{0,400}?var\(--aus-primary\)/.test(compJs));
ok('ESTADISTICAS: header premium', /dashboardIcon\.className = 'aus-view-icon'/.test(estadisticas));
ok('ESTADISTICAS: titulo premium', /dashboardTitle\.className = 'aus-view-title'/.test(estadisticas));
ok('ESTADISTICAS: botones de filtro premium', /applyStatsFiltersBtn" class="aus-btn aus-btn--primary"/.test(estadisticas) && /clearStatsFiltersBtn" class="aus-btn"/.test(estadisticas));
ok('ESTADISTICAS: conserva los IDs de filtros', ['applyStatsFiltersBtn','clearStatsFiltersBtn'].every(id => estadisticas.indexOf('id="' + id + '"') !== -1));
ok('ESTADISTICAS: radios premium (20px)', /\.aus-scope \.estadisticas-dashboard \.k-stats-ribbon\{[\s\S]{0,300}?border-radius: 20px/.test(compJs));

// ============ Consulta de Trabajadores (iframe) ============
const consulta = fs.readFileSync(path.join(dir, 'consulta-trabajadores.html'), 'utf8');
ok('CONSULTA: tokens canonicos', /--ct-primary:\s*#2057b8/.test(consulta));
ok('CONSULTA: dark en los 2 atributos', /\[data-theme\^="dark"\]/.test(consulta));
ok('CONSULTA: Header System v2', /ct-header-v2/.test(consulta) && /ct-header-icon/.test(consulta));
ok('CONSULTA: sin iconos Font Awesome', !/<i class="fa[srlb]? fa-/.test(consulta));
// Regresión 📦762: al reemplazar un <i> por un <svg>, la regla de tamaño que
// apuntaba a `i` deja de aplicar y el <svg> se estira a todo el contenedor.
ok('CONSULTA: empty state cubre svg (no solo i)', /\.ct-empty-state i,\s*\.ct-empty-state svg\s*\{[\s\S]{0,200}?width:\s*3rem/.test(consulta));
ok('CONSULTA: search-title cubre svg', /\.ct-search-title svg/.test(consulta));
ok('CONSULTA: modal header cubre svg', /\.ct-modal-header h3 svg/.test(consulta));

// ============ Generar Informe (iframe) ============
const informe = fs.readFileSync(path.join(dir, 'informe-pri-builder.html'), 'utf8');
ok('INFORME: sin CDN (offline)', !/cdnjs|fonts\.googleapis/.test(informe));
ok('INFORME: tokens canonicos', /--primary:\s*#2057b8/.test(informe));
ok('INFORME: dark en los 2 atributos', /\[data-theme\^="dark"\]/.test(informe));
ok('INFORME: Header System v2', /builder-icon/.test(informe) && /builder-h2/.test(informe));

// ============ Reporte ============
var failed = 0;
checks.forEach(function (c) {
  console.log((c.ok ? '\u2705' : '\u274C') + ' ' + c.name);
  if (!c.ok) failed++;
});
console.log('\n' + checks.length + ' checks, ' + (checks.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
