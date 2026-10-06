'use strict';
// 📦840 · El hero del Inicio ocupaba una fila sola, arriba de las 4 cards de
// indicadores: dos bandas y ~184px de alto que no aportaban nada. Ahora
// comparten fila mediante un wrapper .kair-dash-top.
//
// Lo que este test protege:
//
//   1) El wrapper existe y CUELGA de los dos. Si cuelgan de .kair-page otra
//      vez, el grid no puede alinearlos y el layout vuelve al anterior.
//   2) El reparto de ancho existe (1fr / 2.15fr) y hay responsive.
//   3) EL HERO NO CAMBIÓ DENTRO. El owner pidió explícitamente conservar
//      estructura y posiciones de sus elementos internos. Este es el punto
//      que más fácil se rompe sin darse cuenta.
//   4) Los textos se acortaron, pero el dato sigue ahí.
//   5) El cache-bust se bumpeó (si no, el navegador sirve el CSS viejo).
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const RENDERER = path.join(APP, 'renderer.js');
const CSS = path.join(APP, 'shared', 'kair-premium.css');
const INDEX = path.join(APP, 'index.html');

const r = fs.readFileSync(RENDERER, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
const html = fs.readFileSync(INDEX, 'utf8');

// Los comentarios explican el "por qué" y mencionan el código viejo. Una
// guarda que lee el crudo se casa con el comentario y queda verde con el bug
// puesto, así que se filtran las líneas de comentario completo.
function soloCodigo(t) {
  return t.split(/\r?\n/).filter(l => l.trim().indexOf('//') !== 0).join('\n');
}
const codR = soloCodigo(r);
const codC = soloCodigo(css);

const checks = [];
const ok = (n, c, e) => checks.push({ name: n, ok: !!c, extra: e });

// ══ 1) El wrapper existe y ambos cuelgan de él ══
ok('1) se crea el wrapper .kair-dash-top',
  /const dashTop = document\.createElement\('div'\);/.test(codR) &&
  /dashTop\.className = 'kair-dash-top'/.test(codR));
ok('1) el hero cuelga del wrapper, no de la pagina',
  /dashTop\.appendChild\(dashHero\)/.test(codR));
ok('1) las cards de KPI cuelgan del wrapper, no de la pagina',
  /dashTop\.appendChild\(dashKpiSlot\)/.test(codR));
ok('1) y ya NO se cuelgan directo de la pagina (seria el layout viejo)',
  !/dashPage\.appendChild\(dashHero\)/.test(codR) &&
  !/dashPage\.appendChild\(dashKpiSlot\)/.test(codR));
ok('1) el wrapper se inserta antes que el hero (orden del DOM)',
  codR.indexOf('dashPage.appendChild(dashTop)') > 0 &&
  codR.indexOf('dashPage.appendChild(dashTop)') < codR.indexOf('dashTop.appendChild(dashHero)'));
ok('1) los ids que usa el render siguen intactos',
  /id = 'hero'/.test(r) && /id = 'kpi-slot'/.test(r));

// ══ 2) El hero se oculta en modo ventana y vuelve desde 1400px ══
// La app abre en 1200px, asi que el estado por defecto es "sin hero, 4 cards
// en fila a todo lo ancho". El hero solo entra cuando hay ancho de sobra.
ok('2) por defecto el hero está OCULTO',
  /\.kair-dash-top>\.kair-hero\{display:none\}/.test(codC));
ok('2) y por defecto el wrapper es una sola columna (las cards toman todo)',
  /\.kair-dash-top\{display:grid;grid-template-columns:1fr;/.test(codC));
ok('2) el hero reaparece a partir de 1400px',
  /@media \(min-width:1400px\)\{[\s\S]*?\.kair-dash-top>\.kair-hero\{display:flex/.test(codC));
ok('2) y ahi sí se reparte 1fr / 2.15fr con el hero al lado',
  /@media \(min-width:1400px\)\{[\s\S]*?grid-template-columns:minmax\(300px,1fr\) 2\.15fr/.test(codC));
ok('2) en ventana chica el hero sigue oculto y las cards pasan a 2x2',
  /@media \(max-width:1100px\)\{[\s\S]*?\.kair-grid-kpis\{grid-template-columns:1fr 1fr\}/.test(codC) &&
  !/max-width:1400px\)\s*\{[^}]*kair-dash-top/.test(codC),
  'quedó un remiendo del modo ventana');
ok('2) el grid de KPIs conserva sus 4 columnas como estado normal',
  /\.kair-premium \.kair-grid-kpis\{display:grid;grid-template-columns:repeat\(4,1fr\)/.test(codC));
ok('2) el hero visible recupera su margen y alto (ya no empuja la fila)',
  /\.kair-dash-top>\.kair-hero\{display:flex;margin-top:0;min-height:0\}/.test(codC));
ok('2) ambos bloques se estiran a la misma altura',
  /\.kair-dash-top\{[^}]*align-items:stretch/.test(codC));

// ══ 3) EL HERO NO CAMBIÓ DENTRO ══
// El owner pidió conservar estructura y posiciones de los elementos internos.
// Estos son los 7 nodos del hero + la geometría que los coloca.
// El markup del hero es lo que el owner pidio no tocar. Se acota al
// innerHTML de dashHero: buscar el nombre de la clase en TODO el archivo
// no sirve, porque el mismo nombre sobrevive en renderDashHero.
const iHeroHtml = r.indexOf('dashHero.innerHTML');
const markupHero = r.slice(iHeroHtml, r.indexOf('dashTop.appendChild(dashHero)', iHeroHtml));
ok('3) se localizó el markup del hero para inspeccionarlo', markupHero.length > 200,
  'largo=' + markupHero.length);
const INTERNO = [
  ['el label superior', 'kair-hero__label'],
  ['el contenedor row', 'kair-hero__row'],
  ['el título', 'kair-hero__title'],
  ['el subtítulo', 'kair-hero__sub'],
  ['el botón de acción', 'kair-hero__cta'],
  ['el bloque aside', 'kair-hero__aside'],
  ['el porcentaje', 'kair-hero__pct'],
  ['la etiqueta del porcentaje', 'kair-hero__pct-label'],
  ['la barra del meter', 'kair-hero__meter'],
  ['el relleno del meter', 'kair-hero__meter-fill']
];
INTERNO.forEach(x => {
  const enMarkup = markupHero.indexOf(x[1]) !== -1;
  const enCss = css.indexOf('.kair-premium .' + x[1]) !== -1;
  ok('3) el hero conserva ' + x[0] + ' (.kair-' + x[1] + ')',
    enMarkup && enCss,
    !enMarkup ? 'falta en el markup del hero' : (!enCss ? 'falta en el CSS' : ''));
});
// La geometría interna: el row es flex con space-between y el aside a la
// derecha, el aside en columna. Si eso cambia, las posiciones internas cambian.
ok('3) el row sigue siendo flex con space-between (aside a la derecha)',
  /\.kair-premium \.kair-hero__row\{display:flex;align-items:flex-end;justify-content:space-between/.test(codC));
ok('3) el aside sigue siendo columna alineada a la derecha',
  /\.kair-premium \.kair-hero__aside\{display:flex;flex-direction:column;align-items:flex-end/.test(codC));
ok('3) el aside sigue sin encogerse (flex-shrink:0)',
  /\.kair-premium \.kair-hero__aside\{[^}]*flex-shrink:0/.test(codC));
// El marcado del hero no se toco: mismo orden de los hijos del row.
const iRow = r.indexOf('<div class="kair-hero__row">');
const bloque = r.slice(iRow, iRow + 620);
const orden = ['kair-hero__title', 'kair-hero__sub', 'kair-hero__cta', 'kair-hero__aside', 'kair-hero__pct', 'kair-hero__pct-label', 'kair-hero__meter'];
let ordenOk = iRow > 0, previa = -1;
orden.forEach(c => {
  const p = bloque.indexOf(c);
  if (p < previa) ordenOk = false;
  previa = p;
});
ok('3) el orden de los elementos internos del hero no cambió',
  ordenOk && orden.every(c => bloque.indexOf(c) !== -1));

// ══ 4) Los textos se acortaron pero conservan el dato ══
const iHero = codR.indexOf('function renderDashHero');
const cuerpo = codR.slice(iHero, codR.indexOf('function renderDashKpis'));
ok('4) el titulo ya no mete la frase larga de antes',
  cuerpo.indexOf('Tu sistema requiere atención') === -1 &&
  /crit \+ ' frentes críticos por gestionar'/.test(cuerpo));
ok('4) el sub ya no repite "prioriza los N frentes críticos"',
  cuerpo.indexOf('Prioriza los') === -1);
ok('4) pero el sub sigue con plan, documentos vencidos y accidentes',
  /'Plan ' \+ plan \+ '% · '/.test(cuerpo) &&
  /documento vencido/.test(cuerpo) &&
  /accidente/.test(cuerpo));
ok('4) el porcentaje y el meter se siguen pintando',
  /pctEl\.textContent = String\(crit\)/.test(cuerpo) &&
  /meterEl\.style\.width/.test(cuerpo));

// ══ 5) Cache-bust ══
ok('5) kair-premium.css tiene el ?v= nuevo en index.html',
  /kair-premium\.css\?v=20261002-hero-oculto/.test(html));
ok('5) renderer.js tiene el ?v= nuevo en index.html',
  /renderer\.js\?v=20261006-admin-empresas-2/.test(html));

let failed = 0;
console.log('\n=======================================');
console.log('  📦840 · El hero comparte fila con las 4 cards');
console.log('=======================================');
checks.forEach(c => {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
