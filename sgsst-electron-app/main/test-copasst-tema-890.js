// 890 · El modo oscuro del Portal y del Generador de Actas del COPASST.
//
// ── Por que este test existe ──────────────────────────────────────────────
// El modulo 1.1.5 "Gestion del COPASST" se compone de dos pantallas que se
// inyectan en el DOM del shell (no son iframes, asi que el tema llega solo) y
// ninguna de las dos tenia una sola regla por tema. No le faltaban estilos
// oscuros: le sobraban colores escritos a mano.
//
// Los tres sintomas que el owner reporto, con su causa:
//
// 1. "Realizar Nueva Acta" en crema con el texto gris encima.
//    `.copasst-portal__main-action` tomaba su fondo de `--cp-bg-card`, un token
//    local del portal fijo en `#ffffff`. Su rotulo ya leia `--kair-ink`, que en
//    oscuro es `#e9ecef`. Texto casi blanco sobre blanco.
//
// 2. "Volver al Menu" blanco.
//    `.copasst-portal__back { background: #fff }` con el color escrito a mano.
//
// 3. El formulario con tarjetas claras, titulos casi blancos y inputs blancos.
//    Peor todavia: `showRealizarActasInterface()` inyecta un `<style>` en el
//    shell, y ese `<style>` abria un `:root` con `--widget-bg-color: #ffffff`.
//    Un `:root` que no esta en el `<head>` sigue siendo el `<html>`, asi que
//    ese valor se leia en los 44 lugares de `styles.css` que lo usan, y como la
//    hoja entra despues ganaba por orden contra `[data-theme="dark"]` (empate
//    0,1,0). Mientras el formulario estaba abierto, el shell entero se leia con
//    superficies blancas.
//
// El bloque oscuro que el formulario si tenia era codigo muerto: sus 13
// selectores pedian `.copasst-actas-container[data-theme="dark"]`, pero el
// atributo nunca se pone en ese elemento, vive en el `<html>`. Y solo
// contemplaba "dark", asi que el modo manual se habria quedado claro igual.
//
// ── Que hace ───────────────────────────────────────────────────────────────
// Lee los cinco archivos del modulo y verifica tres cosas:
//
//   A. Que el portal y el formulario resuelvan su superficie por token.
//   B. Que el bloque oscuro use `[data-theme^="dark"]`, que cubre `dark`
//      (sistema) y `dark-legacy` (manual) en una sola regla.
//   C. Que el EOL de cada archivo siga siendo el que tenia antes.
//
// No mide color computado: eso lo hace el arnes del navegador. Aqui se
// comprueba que las reglas existan, esten bien scopeadas y lleguen al archivo.

const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');

const REL = {
  idx: 'index.html',
  homeCss: 'modules/recursos/copasst/copasst-home.css',
  homeHtml: 'modules/recursos/copasst/copasst-home.html',
  logicJs: 'modules/recursos/copasst/copasst-logic.js',
  portalJs: 'modules/recursos/copasst/copasst-portal-logic.js',
  viewHtml: 'modules/recursos/copasst/copasst-view.html',
  viewerJs: 'modules/recursos/copasst/copasst-viewer.js'
};

// Sello vigente. El del JS subio a v3 porque el contraste de "+ Agregar tema"
// lo piso el navegador, no una revision.
const SELLO_JS = 'COPASST-20261014-v3-dark890';
const SELLO_HTML = 'COPASST-20261014-v2-dark890';
const SELLO_VIEJO = 'COPASST-20260915-v1-premium';

// ── El <style> que el formulario inyecta en el shell ───────────────────────
// Se recorta por el `style.textContent = \`...\``, sin parsear CSS: lo que
// importa es que ningun selector de clase salga sin su contenedor.
function styleDelFormulario(js) {
  const m = /style\.textContent\s*=\s*`([\s\S]*?)`;/.exec(js);
  return m ? m[1] : null;
}

// Selectores que empiezan por una clase del modulo pero no llevan el
// contenedor delante. Devuelve la lista para poder reportarla.
function selectoresSinContenedor(css) {
  const out = [];
  if (!css) return ['<style> no encontrado'];
  const re = /(^|})\s*([^{}@]+?)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    for (const s of m[2].split(',').map((x) => x.trim()).filter(Boolean)) {
      if (/^\.(acta|pres-header|header-)/.test(s) && !/\.copasst-actas-container/.test(s)) out.push(s);
    }
  }
  return out;
}

// Los comentarios no son CSS. Sin quitarlos, el bloque del formulario que
// EXPLICA el bug menciona el selector muerto y el check lo tomaria por vivo.
function sinComentarios(txt) {
  return String(txt).replace(/\/\*[\s\S]*?\*\//g, '');
}

// Una regla del bloque oscuro: `[data-theme^="dark"] <contenedor> <algo> {`.
// El `algo` puede ser la primera parte de una lista de selectores, asi que
// despues del ultimo viene `{` o `,`.
function reglaOscura(css, sufijo) {
  const re = new RegExp('\\[data-theme\\^="dark"\\]\\s*\\.copasst-actas-container\\s+' + sufijo + '\\s*[{,]');
  const m = re.exec(css);
  if (!m) return null;
  // El cuerpo de la regla es lo que va hasta la llave de cierre.
  const desde = m.index + m[0].length;
  const fin = css.indexOf('}', desde);
  return fin === -1 ? null : css.slice(desde, fin);
}

// ── EOL ────────────────────────────────────────────────────────────────────
function eol(txt) {
  return {
    crlf: (txt.match(/\r\n/g) || []).length,
    lf: (txt.match(/(?<!\r)\n/g) || []).length
  };
}

// ── Unicode prohibido en codigo y documentacion ────────────────────────────
const PROHIBIDO = /[\u1100-\u11FF\u2E80-\u2FFF\u3000-\u9FFF\uAC00-\uD7AF\u0400-\u04FF\u3040-\u30FF]/;

let ok = 0, malos = 0;
function chk(nombre, cond, detalle) {
  if (cond) { ok++; return true; }
  malos++;
  console.log('  FALLA  ' + nombre + (detalle ? '\n         ' + detalle : ''));
  return false;
}

// ── Todas las condiciones, en una funcion, para que las mutaciones puedan
//    ejecutarla contra una versionfalse de cada archivo.
function correrCon(f) {
  const jsLimpio = sinComentarios(f.logicJs);
  const style = styleDelFormulario(jsLimpio);
  const sueltos = selectoresSinContenedor(style);

  // A. El portal resuelve su superficie por token.
  const A =
    !/var\(--cp-bg-card\)/.test(f.homeCss) &&
    /\.copasst-portal__main-action\s*\{[^}]*background:\s*var\(--kair-card,\s*#ffffff\)/.test(f.homeCss) &&
    /\.copasst-portal__main-action-icon\s*\{[^}]*background:\s*var\(--kair-slate-soft\)/.test(f.homeCss) &&
    /\[data-theme\^="dark"\]\s*\.copasst-portal__main-action\s*\{[^}]*border-color:\s*var\(--kair-line\)/.test(f.homeCss) &&
    /\[data-theme\^="dark"\]\s*\.copasst-portal__back\s*\{[^}]*background:\s*var\(--kair-card\)/.test(f.homeCss) &&
    /\[data-theme\^="dark"\]\s*\.copasst-portal__pill\s*\{[^}]*--kair-green-soft/.test(f.homeCss) &&
    /\[data-theme\^="dark"\]\s*\.copasst-portal__top-icon\s*\{[^}]*--kair-blue-soft/.test(f.homeCss) &&
    /\[data-theme\^="dark"\]\s*\.copasst-portal__action-desc\s*\{[^}]*color:\s*var\(--kair-muted\)/.test(f.homeCss) &&
    /\[data-theme\^="dark"\]\s*\.copasst-portal__main-action-icon--success\s*\{/.test(f.homeCss) &&
    // La primaria se repinta con el azul oscuro: con --kair-blue (#5da2ff) el
    // blanco decia 2.56:1, por debajo del 4.5:1 de WCAG 1.4.3. Se exige que el
    // PRIMER stop sea --kair-blue-ink, no solo que la palabra aparezca.
    /\[data-theme\^="dark"\]\s*\.copasst-portal__main-action--primary\s*\{[^}]*linear-gradient\(135deg,\s*var\(--kair-blue-ink\)\s*0%/.test(f.homeCss) &&
    // Ningun selector del bloque oscuro puede ser pelado: `[data-theme="dark"]`
    // no matchea dark-legacy, que es el modo manual.
    !/\[data-theme="dark"\]\s*\.copasst-portal__/.test(f.homeCss) &&
    !/\[data-theme="dark-legacy"\]\s*\.copasst-portal__/.test(f.homeCss);

  // B. El formulario: sin :root global, sin codigo muerto, todo prefijado.
  const rQuitar = reglaOscura(style, '\.acta-btn-remove');
  const rFoco = reglaOscura(style, '\.acta-form-group input:focus');
  const rPrimario = reglaOscura(style, '\.pres-header \.header-action--primary');
  const rExito = reglaOscura(style, '\.pres-header \.header-action--success');
  const B =
    !/^\s*:root\s*\{/m.test(jsLimpio) &&
    !/\.copasst-actas-container\[data-theme=/.test(jsLimpio) &&
    /\.copasst-actas-container\s*\{[^}]*--widget-bg-color:\s*var\(--kair-card/.test(f.logicJs) &&
    sueltos.length === 0 &&
    // Las superficies por token: #ffffff ES --kair-card en claro, asi que el
    // claro queda identico y el oscuro sale gratis.
    !/background:\s*(white|#fff)\s*;/.test(style || '') &&
    /\.copasst-actas-container \.acta-card\s*\{[^}]*background:\s*var\(--kair-card/.test(style || '') &&
    /\.copasst-actas-container \.acta-form-group input,\s*\.copasst-actas-container \.acta-form-group textarea\s*\{[^}]*background:\s*var\(--kair-card/.test(style || '') &&
    /\.copasst-actas-container \.acta-btn-add\s*\{[^}]*background:\s*var\(--kair-card/.test(style || '') &&
    /\.copasst-actas-container \.pres-header \.header-back-btn\s*\{[^}]*background:\s*var\(--kair-card/.test(style || '') &&
    // Los tres botones de acento cambian a texto oscuro: --kair-blue sube a
    // #5da2ff y el blanco encima daba 2.56:1; --kair-mint daba 1.75:1.
    !!rPrimario && /color:\s*#0b1f33/.test(rPrimario) &&
    !!rExito && /color:\s*#0a2a1c/.test(rExito) &&
    // "+ Agregar tema" es texto normal: 3.95:1 con --kair-blue, 5.02:1 con
    // --kair-blue-text.
    !!reglaOscura(style, '\.acta-btn-add') &&
    /--kair-blue-text/.test(reglaOscura(style, '\.acta-btn-add')) &&
    // El boton de quitar es texto, no un componente de 3:1.
    !!rQuitar && /--kair-red-soft/.test(rQuitar) &&
    // El halo del focus tiene que verse en oscuro.
    !!rFoco && /rgba\(93,\s*162,\s*255,\s*0\.30\)/.test(rFoco) &&
    // El wrapper deja ver el fondo del shell en vez de pintar una banda.
    /\[data-theme\^="dark"\] \.copasst-actas-container \.acta-form-wrapper\s*\{\s*background:\s*transparent/.test(style || '');

  // C. Cache-bust en los tres niveles: documento, script y CSS. Sin el sello en
  // el nivel de arriba, Electron sirve el archivo viejo y el fix nunca llega.
  const C =
    f.idx.indexOf('copasst-logic.js?v=' + SELLO_JS) !== -1 &&
    f.idx.indexOf('copasst-portal-logic.js?v=' + SELLO_HTML) !== -1 &&
    f.portalJs.indexOf('copasst-home.html?v=' + SELLO_HTML) !== -1 &&
    f.portalJs.indexOf('copasst-home.js?v=' + SELLO_HTML) !== -1 &&
    f.homeHtml.indexOf('copasst-home.css?v=' + SELLO_HTML) !== -1 &&
    [f.idx, f.portalJs, f.homeHtml].every((t) => t.indexOf(SELLO_VIEJO) === -1);

  // D. EOL. El CSS del portal es MIXTO a proposito: el bloque legacy es CRLF y
  // el premium del final es LF. Normalizarlo seria un diff entero.
  const eLogica = eol(f.logicJs);
  const eCss = eol(f.homeCss);
  const eIdx = eol(f.idx);
  const ePortal = eol(f.portalJs);
  const eHome = eol(f.homeHtml);
  const D =
    eLogica.lf === 0 && eLogica.crlf > 500 &&
    eCss.crlf > 250 && eCss.lf > 150 &&
    eIdx.crlf === 0 && ePortal.crlf === 0 && eHome.crlf === 0;

  // E. Nada de CJK, cirilico ni hangul.
  const E = ![f.idx, f.homeCss, f.homeHtml, f.logicJs, f.portalJs, f.viewHtml, f.viewerJs]
    .some((t) => PROHIBIDO.test(t));

  // F. El Repositorio de Actas, que es un iframe. NO es lo que el owner
  // reporto, pero es la tercera pantalla del mismo submódulo y estaba rota por
  // el mismo motivo de fondo: un sincronizador propio que no entiende lo que
  // renderer.js manda de verdad.
  //
  // renderer.js:1743-1759 escribe el atributo YA RESUELTO en contentDocument y
  // DESPUES manda `theme-changed` con {theme, effectiveTheme}. El sincronizador
  // viejo traducía eso con la forma {theme, mode} de `scripts/theme-manager.js`,
  // un archivo que no esta cargado en el shell: `mode` llegaba undefined y con
  // theme 'system' devolvia null -> removeAttribute, o sea BORRABA el 'dark' que
  // el paso anterior habia puesto. El postMessage es asincrono, asi que ganaba
  // el paso que rompia.
  const viewerLimpio = sinComentarios(f.viewerJs);
  const F =
    /kair-iframe-theme\.js\?v=/.test(f.viewHtml) &&
    /copasst-view\.css\?v=/.test(f.viewHtml) &&
    !/_resolveThemeValue/.test(viewerLimpio) &&
    !/_applyThemeToHtml/.test(viewerLimpio) &&
    !/_themeMessageHandler/.test(viewerLimpio) &&
    !/_themeObserver/.test(viewerLimpio) &&
    /kairIframeApplyTheme/.test(viewerLimpio) &&
    // Los dos que montan la vista (portal nuevo y visor heredado) piden el
    // HTML con sello: sin el, Electron sirve la copia vieja del cache y el
    // modulo compartido nunca se descarga.
    [f.portalJs, f.logicJs].every((t) => /copasst-view\.html\?v=/.test(t)) &&
    eol(f.viewHtml).lf === 0 && eol(f.viewerJs).lf === 0;

  return { ok: A && B && C && D && E && F, sueltos, style: !!style, eolCss: eCss, eolLogica: eLogica };
}

// ── Checks con nombre ──────────────────────────────────────────────────────
const original = {};
for (const [k, rel] of Object.entries(REL)) original[k] = leer(rel);

console.log('=== 890 · Modo oscuro del Portal y del Generador de Actas del COPASST ===\n');
console.log('-- A. El portal resuelve su superficie por token --');
chk('A1 la tarjeta grande no toma el blanco del token local --cp-bg-card',
  !/var\(--cp-bg-card\)/.test(original.homeCss));
chk('A2 .copasst-portal__main-action usa --kair-card',
  /\.copasst-portal__main-action\s*\{[^}]*background:\s*var\(--kair-card,\s*#ffffff\)/.test(original.homeCss));
chk('A3 el icono de la tarjeta usa --kair-slate-soft (#f1f3f5 exacto)',
  /\.copasst-portal__main-action-icon\s*\{[^}]*background:\s*var\(--kair-slate-soft\)/.test(original.homeCss));
chk('A4 el bloque oscuro de la tarjeta grande pone el borde de --kair-line',
  /\[data-theme\^="dark"\]\s*\.copasst-portal__main-action\s*\{[^}]*border-color:\s*var\(--kair-line\)/.test(original.homeCss));
chk('A5 "Volver al Menu" se pinta con --kair-card en oscuro',
  /\[data-theme\^="dark"\]\s*\.copasst-portal__back\s*\{[^}]*background:\s*var\(--kair-card\)/.test(original.homeCss));
chk('A6 la pastilla de estado usa su propio tinte verde',
  /\[data-theme\^="dark"\]\s*\.copasst-portal__pill\s*\{[^}]*--kair-green-soft/.test(original.homeCss));
chk('A7 el icono del encabezado usa --kair-blue-soft',
  /\[data-theme\^="dark"\]\s*\.copasst-portal__top-icon\s*\{[^}]*--kair-blue-soft/.test(original.homeCss));
chk('A8 la descripcion de las tarjetas usa --kair-muted (era #6c757d fijo)',
  /\[data-theme\^="dark"\]\s*\.copasst-portal__action-desc\s*\{[^}]*color:\s*var\(--kair-muted\)/.test(original.homeCss));
chk('A9 la tarjeta azul arranca el degradado en el azul oscuro, no en #5da2ff',
  /\[data-theme\^="dark"\]\s*\.copasst-portal__main-action--primary\s*\{[^}]*linear-gradient\(135deg,\s*var\(--kair-blue-ink\)\s*0%/.test(original.homeCss));
chk('A10 ningun selector oscuro del portal es pelado (no cubre dark-legacy)',
  !/\[data-theme="dark"\]\s*\.copasst-portal__/.test(original.homeCss) &&
  !/\[data-theme="dark-legacy"\]\s*\.copasst-portal__/.test(original.homeCss));

console.log('\n-- B. El formulario deja de escribir en el shell --');
const style890 = styleDelFormulario(sinComentarios(original.logicJs));
chk('B1 el <style> del formulario existe', !!style890);
chk('B2 no queda ningun :root en copasst-logic.js (era la fuga de --widget-bg-color)',
  !/^\s*:root\s*\{/m.test(sinComentarios(original.logicJs)));
chk('B3 el :root se movio al contenedor y por token',
  /\.copasst-actas-container\s*\{[^}]*--widget-bg-color:\s*var\(--kair-card/.test(original.logicJs));
chk('B4 el bloque muerto .copasst-actas-container[data-theme= ya no esta',
  !/\.copasst-actas-container\[data-theme=/.test(sinComentarios(original.logicJs)));
const sueltos890 = selectoresSinContenedor(style890);
chk('B5 todo selector del formulario lleva .copasst-actas-container delante',
  sueltos890.length === 0, sueltos890.join(' | '));
chk('B6 ninguna superficie del formulario queda en blanco fijo',
  !/background:\s*(white|#fff)\s*;/.test(style890 || ''));
chk('B7 .acta-card toma su fondo de --kair-card',
  /\.copasst-actas-container \.acta-card\s*\{[^}]*background:\s*var\(--kair-card/.test(style890 || ''));
chk('B8 los input y textareas toman su fondo de --kair-card',
  /\.copasst-actas-container \.acta-form-group input,\s*\.copasst-actas-container \.acta-form-group textarea\s*\{[^}]*background:\s*var\(--kair-card/.test(style890 || ''));
chk('B9 "+ Agregar tema" toma su fondo de --kair-card',
  /\.copasst-actas-container \.acta-btn-add\s*\{[^}]*background:\s*var\(--kair-card/.test(style890 || ''));
chk('B10 "Volver" toma su fondo de --kair-card',
  /\.copasst-actas-container \.pres-header \.header-back-btn\s*\{[^}]*background:\s*var\(--kair-card/.test(style890 || ''));
chk('B11 el boton azul pasa a texto oscuro en oscuro (era 2.56:1)',
  /color:\s*#0b1f33/.test(reglaOscura(style890, '\\.pres-header \\.header-action--primary') || ''));
chk('B12 el boton verde pasa a texto oscuro en oscuro (era 1.75:1)',
  /color:\s*#0a2a1c/.test(reglaOscura(style890, '\\.pres-header \\.header-action--success') || ''));
chk('B13 "+ Agregar tema" usa --kair-blue-text (era 3.95:1 con --kair-blue)',
  /--kair-blue-text/.test(reglaOscura(style890, '\\.acta-btn-add') || ''));
chk('B14 el boton de quitar pasa a su propio tinte en oscuro',
  /--kair-red-soft/.test(reglaOscura(style890, '\\.acta-btn-remove') || ''));
chk('B15 el halo del focus se ve en oscuro',
  /rgba\(93,\s*162,\s*255,\s*0\.30\)/.test(reglaOscura(style890, '\\.acta-form-group input:focus') || ''));
chk('B16 el wrapper no pinta una banda mas oscura que el shell',
  /\[data-theme\^="dark"\] \.copasst-actas-container \.acta-form-wrapper\s*\{\s*background:\s*transparent/.test(style890 || ''));

console.log('\n-- C. Cache-bust en los tres niveles --');
chk('C1 index.html pide copasst-logic.js con sello vigente',
  original.idx.indexOf('copasst-logic.js?v=' + SELLO_JS) !== -1);
chk('C2 index.html pide copasst-portal-logic.js con sello vigente',
  original.idx.indexOf('copasst-portal-logic.js?v=' + SELLO_HTML) !== -1);
chk('C3 el portal pide el HTML del home con sello',
  original.portalJs.indexOf('copasst-home.html?v=' + SELLO_HTML) !== -1);
chk('C4 el portal pide el JS del home con sello',
  original.portalJs.indexOf('copasst-home.js?v=' + SELLO_HTML) !== -1);
chk('C5 el HTML del home pide su CSS con sello',
  original.homeHtml.indexOf('copasst-home.css?v=' + SELLO_HTML) !== -1);
chk('C6 no sobrevive ningun sello de la version anterior',
  [original.idx, original.portalJs, original.homeHtml].every((t) => t.indexOf(SELLO_VIEJO) === -1));

console.log('\n-- D. EOL intacto --');
const eL = eol(original.logicJs);
const eC = eol(original.homeCss);
const eI = eol(original.idx);
const eP = eol(original.portalJs);
const eH = eol(original.homeHtml);
chk('D1 copasst-logic.js sigue CRLF puro',
  eL.lf === 0 && eL.crlf > 500, `CRLF=${eL.crlf} LF=${eL.lf}`);
chk('D2 copasst-home.css sigue MIXTO: el legacy CRLF no se normalizo',
  eC.crlf > 250 && eC.lf > 150, `CRLF=${eC.crlf} LF=${eC.lf}`);
chk('D3 index.html sigue LF', eI.crlf === 0 && eI.lf > 0);
chk('D4 copasst-portal-logic.js sigue LF', eP.crlf === 0 && eP.lf > 0);
chk('D5 copasst-home.html sigue LF', eH.crlf === 0 && eH.lf > 0);

console.log('\n-- E. Sin CJK, cirilico ni hangul --');
chk('E1 los siete archivos estan limpios',
  ![original.idx, original.homeCss, original.homeHtml, original.logicJs,
    original.portalJs, original.viewHtml, original.viewerJs]
    .some((t) => PROHIBIDO.test(t)));

console.log('\n-- F. El Repositorio de Actas (iframe) sincroniza por el modulo compartido --');
const viewerLimpio890 = sinComentarios(original.viewerJs);
chk('F1 la vista carga kair-iframe-theme.js con cache-bust',
  /kair-iframe-theme\.js\?v=/.test(original.viewHtml));
chk('F2 la vista pide su CSS con cache-bust',
  /copasst-view\.css\?v=/.test(original.viewHtml));
chk('F3 el traductor roto _resolveThemeValue ya no existe',
  !/_resolveThemeValue/.test(viewerLimpio890));
chk('F4 el aplicador roto _applyThemeToHtml ya no existe',
  !/_applyThemeToHtml/.test(viewerLimpio890));
chk('F5 la vista ya no mete su propio listener de tema (el que borraba el atributo)',
  !/_themeMessageHandler/.test(viewerLimpio890));
chk('F6 la vista ya no monta el MutationObserver de tema',
  !/_themeObserver/.test(viewerLimpio890));
chk('F7 el punto de entrada delega en kairIframeApplyTheme',
  /kairIframeApplyTheme/.test(viewerLimpio890));
chk('F8 los dos que montan la vista piden el HTML con sello',
  [original.portalJs, original.logicJs].every((t) => /copasst-view\.html\?v=/.test(t)));
chk('F9 copasst-view.html y copasst-viewer.js siguen CRLF puro',
  eol(original.viewHtml).lf === 0 && eol(original.viewerJs).lf === 0);

// ── Mutaciones: el test tiene que morder ───────────────────────────────────
// Cada una rompe UNA cosa y el test tiene que ponerse rojo. Una mutacion que no
// rompe nada no es una mutacion: es un mutante vacio, y cuenta como fallo.
const MUTACIONES = [
  ['A1 el portal vuelve al blanco del token local (el bug del texto gris)',
   () => ({
     ...original,
     homeCss: original.homeCss.replace(
       'background: var(--kair-card, #ffffff);',
       'background: var(--cp-bg-card);')
   })],
  ['A5 "Volver al Menu" pierde su regla oscura',
   () => ({
     ...original,
     homeCss: original.homeCss.replace(
       /\[data-theme\^="dark"\] \.copasst-portal__back\s*\{[^}]*\}/, '.copasst-portal__back { }')
   })],
  ['A9 la tarjeta azul vuelve al degradado claro (#5da2ff sobre texto blanco)',
   () => ({
     ...original,
     homeCss: original.homeCss.replace(
       /\[data-theme\^="dark"\] \.copasst-portal__main-action--primary\s*\{[^}]*\}/,
       '[data-theme^="dark"] .copasst-portal__main-action--primary {\n  background: linear-gradient(135deg, var(--kair-blue) 0%, var(--kair-blue-ink) 100%);\n}')
   })],
  ['A10 el bloque oscuro se vuelve pelado y dark-legacy se queda claro',
   () => ({
     ...original,
     homeCss: original.homeCss.replace('[data-theme^="dark"] .copasst-portal__back', '[data-theme="dark"] .copasst-portal__back')
   })],
  ['B2 el :root global vuelve al formulario (la fuga de --widget-bg-color)',
   () => ({
     ...original,
     logicJs: original.logicJs.replace('.copasst-actas-container { --primary-color', ':root { --primary-color')
   })],
  ['B3 --widget-bg-color vuelve a valer #ffffff fijo',
   () => ({
     ...original,
     logicJs: original.logicJs.replace('--widget-bg-color: var(--kair-card, #ffffff)', '--widget-bg-color: #ffffff')
   })],
  ['B4 el bloque muerto vuelve a pedir el atributo en el contenedor',
   () => ({
     ...original,
     logicJs: original.logicJs.replace(
       /\[data-theme\^="dark"\] \.copasst-actas-container \.acta-btn-remove/g,
       '.copasst-actas-container[data-theme="dark"] .acta-btn-remove')
   })],
  ['B5 un selector del formulario vuelve a salir sin su contenedor',
   () => ({
     ...original,
     logicJs: original.logicJs.replace('.copasst-actas-container .acta-card-title {', '.acta-card-title {')
   })],
  ['B7 la tarjeta del acta vuelve al blanco fijo',
   () => ({
     ...original,
     logicJs: original.logicJs.replace(
       '.copasst-actas-container .acta-card { background: var(--kair-card, #ffffff);',
       '.copasst-actas-container .acta-card { background: white;')
   })],
  ['B13 "+ Agregar tema" vuelve a --kair-blue (3.95:1)',
   () => ({
     ...original,
     logicJs: original.logicJs.replace(
       '[data-theme^="dark"] .copasst-actas-container .acta-btn-add {\r\n  color: var(--kair-blue-text);',
       '[data-theme^="dark"] .copasst-actas-container .acta-btn-add {\r\n  color: var(--kair-blue);')
   })],
  ['B11 el boton azul vuelve al texto blanco en oscuro',
   () => ({
     ...original,
     logicJs: original.logicJs.replace('  color: #0b1f33; box-shadow: none;', '  color: #fff;')
   })],
  ['C1 copasst-logic.js pierde el cache-bust y el fix no llega',
   () => ({ ...original, idx: original.idx.replace('copasst-logic.js?v=' + SELLO_JS, 'copasst-logic.js') })],
  ['C3 el portal pide el home sin sello',
   () => ({
     ...original,
     portalJs: original.portalJs.replace('copasst-home.html?v=' + SELLO_HTML, 'copasst-home.html')
   })],
  ['C5 el HTML del home pide su CSS sin sello',
   () => ({
     ...original,
     homeHtml: original.homeHtml.replace('copasst-home.css?v=' + SELLO_HTML, 'copasst-home.css')
   })],
  ['D1 copasst-logic.js se normaliza a LF (EOL roto)',
   () => ({ ...original, logicJs: original.logicJs.replace(/\r\n/g, '\n') })],
  ['D2 copasst-home.css se normaliza a CRLF (EOL roto)',
   () => ({ ...original, homeCss: original.homeCss.replace(/(?<!\r)\n/g, '\r\n') })],
  ['E1 se cuela un caracter prohibido en el CSS',
   () => ({ ...original, homeCss: original.homeCss.replace('.copasst-portal {', '.copasst-portal { /* 中文 */') })],
  ['F1 la vista del repositorio deja de cargar el modulo de tema',
   () => ({
     ...original,
     viewHtml: original.viewHtml.replace(/\s*<script src="\.\.\/\.\.\/\.\.\/shared\/kair-iframe-theme\.js\?v=[^"]*"><\/script>\r\n/, '\r\n')
   })],
  ['F2 la vista del repositorio pide su CSS sin sello',
   () => ({ ...original, viewHtml: original.viewHtml.replace('copasst-view.css?v=', 'copasst-view.css') })],
  ['F3 vuelve el traductor que borraba el tema en oscuro (el bug real del repositorio)',
   () => ({
     ...original,
     viewerJs: original.viewerJs.replace(
       '    function _teardownThemeSync() {',
       '    function _resolveThemeValue(theme, mode) {\r\n' +
         "        if (theme !== 'dark') return null;\r\n" +
         "        return mode === 'dark' ? 'dark-legacy' : 'dark';\r\n" +
         '    }\r\n\r\n' +
         '    function _teardownThemeSync() {')
   })],
  ['F5 la vista vuelve a meter su propio listener de tema',
   () => ({
     ...original,
     viewerJs: original.viewerJs.replace(
       '    function _teardownThemeSync() {',
       '    window.addEventListener("message", function (e) {\r\n' +
         "        if (e.data && e.data.type === 'theme-changed') _state._themeMessageHandler = e.data;\r\n" +
         '    });\r\n\r\n' +
         '    function _teardownThemeSync() {')
   })],
  ['F8 el portal pide el HTML del repositorio sin sello',
   () => ({
     ...original,
     portalJs: original.portalJs.replace('copasst-view.html?v=COPASST-20261014-v4-dark890&', 'copasst-view.html?')
   })],
  ['F9 copasst-viewer.js se normaliza a LF (EOL roto)',
   () => ({ ...original, viewerJs: original.viewerJs.replace(/\r\n/g, '\n') })]
];

console.log('\n-- Mutaciones (cada una tiene que poner el test en rojo) --');
let mutOk = 0, vacias = 0;
for (const [nombre, hacer] of MUTACIONES) {
  const antes = correrCon(original).ok;
  const despues = correrCon(hacer()).ok;
  if (!antes) {
    console.log('  FALLA  la linea base ya estaba roja, la mutacion no prueba nada: ' + nombre);
    vacias++;
  } else if (despues) {
    console.log('  FALLA  mutante vacio (el test paso en verde): ' + nombre);
    vacias++;
  } else {
    mutOk++;
    console.log('  ok     ' + nombre);
  }
}

console.log('\n=== ' + ok + ' checks OK, ' + malos + ' fallas ===');
console.log('=== ' + mutOk + '/' + MUTACIONES.length + ' mutaciones muerden, ' + vacias + ' vacias ===');

if (malos > 0 || vacias > 0 || mutOk !== MUTACIONES.length) process.exit(1);