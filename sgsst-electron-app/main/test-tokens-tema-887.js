'use strict';
// 📦887 · Los tokens --kair-* por fin tienen tema, y el módulo Recursos deja de
// quedarse blanco en los dos modos oscuros.
//
// LA CAUSA, que es lo que este test existe para no repetir. El home de Recursos
// se estiliza con clases `kair-*` que viven en shared/kair-components.css y leen
// `--kair-*` de shared/kair-design-tokens.css. Ese segundo archivo DEFINÍA la
// paleta y nada más: treinta tokens de color en `:root` y CERO variantes. El
// primero tampoco tenía ni una regla de tema. O sea que no faltaban estilos
// oscuros: el color nunca se definía por tema.
//
// Hay tres cosas que un test de "existe el bloque oscuro" NO comprobaría:
//
//   1. COBERTURA. Si alguien define 25 tokens y deja 5 sin contraparte, el bloque
//      "existe" y la mitad de la pantalla sigue blanca. Este test extrae los
//      tokens de color de `:root` y exige que cada uno tenga su variante.
//
//   2. QUE EL TEMA CLARO NO SE TOCARA. Es un bloque aditivo: si alguien "arregla"
//      el oscuro editando `:root`, rompe el tema claro de toda la app. Se
//      comprueba contra los valores originales, uno por uno.
//
//   3. QUE EL CONTRASTE SIGA PASANDO. Si alguien sube la superficie más clara y
//      no ajusta el texto, el bloque sigue completo y el texto se vuelve ilegible.
//      Se recalcula contra la superficie real, componiendo el velo.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const leer = p => fs.readFileSync(p, 'utf8');
const soloCodigo = t => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function lum(h) {
  const c = rgb(h).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
// Compone rgba() sobre fondo opaco antes de medir. Sin esto se mide el color de
// la regla y no el que ve el ojo.
function sobre(hex, alfa) {
  return '#' + rgb(hex)
    .map(v => Math.round(v * (1 - alfa) + 255 * alfa).toString(16).padStart(2, '0'))
    .join('');
}
function bloque(css, sel) {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{');
  const m = re.exec(css);
  if (!m) return '';
  const j = css.indexOf('\n}', m.index);
  return j < 0 ? '' : css.slice(m.index, j);
}

const MIN_UI = 3.0;   // WCAG 1.4.11, componente de interfaz
const MIN_TEXTO = 4.5; // WCAG 1.4.3, texto normal

const RUTAS = {
  tokens: 'shared/kair-design-tokens.css',
  components: 'shared/kair-components.css',
  home: 'modules/recursos/recursos-home.js',
  sidebar: 'shared/kair-sidebar.css',
  premium: 'shared/kair-premium.css',
  idx: 'index.html',
};
const NOMBRES = RUTAS;

// Los valores del tema claro, uno por uno. Si alguno cambia, el tema claro cambio
// y este paquete era aditivo.
const CLARO_INVARIANTE = {
  '--kair-canvas': '#fbfcfb', '--kair-card': '#ffffff', '--kair-soft': '#f3f6f6',
  '--kair-ink': '#14213d', '--kair-muted': '#748096', '--kair-faint': '#aab1bd',
  '--kair-line': '#e8ebee', '--kair-line-soft': '#eef0f1',
  '--kair-blue': '#2057b8', '--kair-blue-ink': '#172c4c',
  '--kair-mint': '#1bb888', '--kair-amber': '#e7a224', '--kair-red': '#da5563',
};

const fallidos = [];
const registro = [];

function evaluar(F) {
  const c = { n: 0, f: 0 };
  const chk = (cond, nombre, detalle) => {
    c.n++;
    registro.push({ n: nombre, c: !!cond });
    if (!cond) { c.f++; fallidos.push(nombre + (detalle ? ' :: ' + detalle : '')); }
  };
  const tok = soloCodigo(F.tokens);
  const comp = soloCodigo(F.components);
  const home = soloCodigo(F.home);

  const raiz = bloque(tok, ':root');
  const dark = bloque(tok, '[data-theme="dark"]');
  const legacy = bloque(tok, '[data-theme="dark-legacy"]');
  chk(raiz.length > 0 && dark.length > 0 && legacy.length > 0,
    'existen los tres bloques: :root, dark y dark-legacy');

  const val = (b, t) => {
    const m = new RegExp(t + ':\\s*(#[0-9a-fA-F]{3,8})').exec(b);
    return m ? m[1].toLowerCase() : '';
  };

  // ── 1 · COBERTURA. Todo token de COLOR de :root tiene que existir en los dos
  //     bloques oscuros. Un token de tipografía o de radio no necesita variante.
  const deColor = [...raiz.matchAll(/(--kair-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)]
    .map(m => m[1]);
  chk(deColor.length >= 25, 'se encontraron los tokens de color de :root', String(deColor.length));
  const faltanDark = deColor.filter(t => val(dark, t) === '');
  const faltanLegacy = deColor.filter(t => val(legacy, t) === '');
  chk(faltanDark.length === 0,
    'todo token de color de :root tiene variante en dark',
    faltanDark.join(', '));
  chk(faltanLegacy.length === 0,
    'todo token de color de :root tiene variante en dark-legacy',
    faltanLegacy.join(', '));

  // Y el valor oscuro tiene que SER DISTINTO del claro. Si coinciden, el bloque
  // esta completo pero no cambia nada: el bug vuelve por la puerta de atras.
  const igualesDark = deColor.filter(t => val(dark, t) === val(raiz, t));
  const igualesLegacy = deColor.filter(t => val(legacy, t) === val(raiz, t));
  chk(igualesDark.length === 0, 'ningún token oscuro es igual al claro (dark)', igualesDark.join(', '));
  chk(igualesLegacy.length === 0, 'ningún token oscuro es igual al claro (legacy)', igualesLegacy.join(', '));

  // ── 2 · EL TEMA CLARO NO SE TOCÓ ──────────────────────────────────────────
  for (const [t, v] of Object.entries(CLARO_INVARIANTE)) {
    chk(val(raiz, t) === v, 'el tema claro conserva ' + t + ' = ' + v,
      'ahora vale ' + val(raiz, t));
  }

  // ── 3 · CONTRASTE, recalculado contra la superficie real ──────────────────
  // La tarjeta lleva velo de blanco al 5 % sobre el fondo del area: es lo que el
  // 885 introdujo y lo que se mide, no el color plano.
  const PARES = [
    ['ink', MIN_TEXTO], ['text', MIN_TEXTO], ['muted', MIN_TEXTO],
    ['faint', MIN_TEXTO], ['text-2', MIN_TEXTO], ['text-3', MIN_TEXTO],
  ];
  for (const [nombre, bloqueTema, shellFondo, velo] of [
    ['dark', dark, '#2d3748', 0.05],
    ['dark-legacy', legacy, '#1e1e1e', 0.05],
  ]) {
    const card = sobre(shellFondo, velo);
    const canvas = nombre === 'dark' ? '#1a202c' : '#121212';
    chk(val(bloqueTema, '--kair-card').toLowerCase() === card.toLowerCase(),
      'la tarjeta de ' + nombre + ' es el velo del 5 % sobre el fondo del shell',
      val(bloqueTema, '--kair-card') + ' vs ' + card);

    let peor = Infinity, donde = '';
    for (const [tokNombre, min] of PARES) {
      const fg = val(bloqueTema, '--kair-' + tokNombre);
      if (!fg) continue;
      const r = ratio(fg, card);
      if (r < peor) { peor = r; donde = '--kair-' + tokNombre + ' ' + fg + ' sobre ' + card; }
      chk(r >= min, 'en ' + nombre + ', --kair-' + tokNombre + ' pasa ' + min + ':1 sobre la tarjeta',
        fg + ' -> ' + r.toFixed(2));
      const rc = ratio(fg, canvas);
      chk(rc >= min, 'en ' + nombre + ', --kair-' + tokNombre + ' pasa ' + min + ':1 sobre el fondo',
        fg + ' -> ' + rc.toFixed(2));
    }
    chk(peor >= MIN_TEXTO, 'el peor texto de ' + nombre + ' pasa AA contra la tarjeta',
      donde + ' = ' + peor.toFixed(2));

    // Los chips: el texto va sobre SU tinte, no sobre la tarjeta.
    for (const [color, soft] of [
      ['--kair-green-text', '--kair-green-soft'],
      ['--kair-amber-text', '--kair-amber-soft'],
      ['--kair-red-text', '--kair-red-soft'],
      ['--kair-blue-text', '--kair-blue-soft'],
      ['--kair-violet', '--kair-violet-soft'],
    ]) {
      const fg = val(bloqueTema, color), bg = val(bloqueTema, soft);
      if (!fg || !bg) { chk(false, nombre + ': existe ' + color + ' y ' + soft, fg + ' / ' + bg); continue; }
      chk(ratio(fg, bg) >= MIN_TEXTO,
        'en ' + nombre + ', ' + color + ' pasa AA sobre su propio tinte',
        fg + ' sobre ' + bg + ' = ' + ratio(fg, bg).toFixed(2));
    }

    // El acento es un componente de interfaz: 3:1.
    const azul = val(bloqueTema, '--kair-blue');
    chk(ratio(azul, card) >= MIN_UI, 'en ' + nombre + ', --kair-blue pasa 3:1 contra la tarjeta',
      azul + ' -> ' + ratio(azul, card).toFixed(2));
  }

  // ── 4 · Los once SELECTORES de kair-components.css que estaban a mano ─────
  const osc = comp.match(/\[data-theme\^="dark"\][^{]*\{[^}]*\}/g) || [];
  chk(osc.length >= 11, 'kair-components.css tiene bloque oscuro para cada literal', String(osc.length));
  const LITERALES = ['kair-btn-ghost', 'kair-status-pill--ok', 'kair-status-pill--warn',
    'kair-status-pill--danger', 'kair-metric-head', 'kair-metric-value small',
    'kair-progress', 'kair-tabs', 'kair-tab-active', 'kair-chart', 'kair-module:hover'];
  for (const sel of LITERALES) {
    chk(osc.some(b => b.includes(sel)), 'regla oscura para ' + sel);
  }

  // Los chips y el grafico no pueden volver a su literal de claro.
  chk(!osc.some(b => /background:\s*#(fff|ffffff|eff7f5|fff5e6|f0eaff|e9f3ff)\b/i.test(b)),
    'ninguna regla oscura vuelve a poner un fondo claro literal');
  chk(!osc.some(b => /color:\s*#(637189|8791a1|536177)\b/i.test(b)),
    'ninguna regla oscura vuelve a poner un gris de texto de claro');

  // ── 5 · SIN !important. Con especificidad alcanza y el 885 lo prohibió. ────
  chk(!/!important/.test(tok.slice(tok.indexOf('[data-theme'))),
    'ningún token oscuro lleva !important');
  chk(!/!important/.test(comp.slice(comp.indexOf('[data-theme^="dark"]'))),
    'ninguna regla oscura de components lleva !important');

  // ── 6 · EL INLINE DEL HOME. Un estilo en linea gana a cualquier hoja de
  //     estilo: por mucho token que se defina, un #8791a1 puesto en el
  //     atributo style se queda gris sobre la tarjeta oscura.
  chk(!/#8791a1/.test(home), 'el "/" de las metric cards ya no es un literal');
  chk(home.includes('color:var(--kair-text-3)'), 'el "/" de las metric cards lee el token');
  chk(!/bg:\s*'#/.test(home), 'los iconos del radar ya no traen fondo literal');
  chk(!/color:\s*'#/.test(home), 'los iconos del radar ya no traen color literal');
  chk(!/stroke="#d4dae3"/.test(home), 'la linea "Planeado" del grafico ya no es literal');
  chk(!/stroke="#2057b8"/.test(home), 'la serie ejecutada del grafico ya no es literal');
  chk(!/stop-color="#2057b8"/.test(home), 'el degradado del grafico ya no es literal');
  chk(home.includes('var(--kair-blue)'), 'el grafico pinta su serie con el token del acento');
  chk(home.includes('var(--kair-violet-soft)'), 'el icono morado del radar usa su token');
  chk(home.includes('var(--kair-violet)'), 'el icono morado del radar usa su token de texto');

  // ── 7 · 884 Y 885 SIGUEN MANDANDO ─────────────────────────────────────────
  // Sus selectores son mas especificos que un [data-theme] de atributo. Si
  // alguien los cambiara por algo mas corto, este paquete los pisaria.
  chk(/\[data-theme\^="dark"\]\s*#sidebar/.test(soloCodigo(F.sidebar)),
    '884: el bloque del sidebar sigue scopeado a #sidebar');
  chk(/\[data-theme="dark"\]\s*\.kair-premium/.test(soloCodigo(F.premium)),
    '885: el bloque del panel sigue scopeado a .kair-premium');

  // ── 8 · CACHE-BUST ────────────────────────────────────────────────────────
  // Se valida el FORMATO del token, no su numero de paquete: atarlo al literal
  // hacia que cualquier bumpee posterior tumbe este test (le paso a
  // test-chart-overflow.js con el check vecino de kair-components.css).
  for (const f of [
    'shared/kair-design-tokens.css',
    'shared/kair-components.css',
    'modules/recursos/recursos-home.js',
  ]) {
    const m = F.idx.match(new RegExp(f.replace(/[/.]/g, '\\$&') + '\\?v=([A-Za-z0-9-]+)'));
    // El prefijo en MAYUSCULAS es opcional: en las hojas compartidas el repo
    // mezcla los dos estilos (`styles.css?v=20261014-scrollbar886` y
    // `kair-sidebar.css?v=SIDEBAR-20261014-dark-tokens884`). Lo que no se negocia
    // es que el valor lleve la fecha de 8 digitos y un descriptor.
    chk(!!m && /^(?:[A-Z][A-Z-]*-)?\d{8}-[A-Za-z0-9-]+$/.test(m[1]),
      'cache-bust con formato [PREFIJO-]AAAAMMDD-desc en ' + f,
      m ? 'leido: ' + m[1] : 'no se encontro el enlace');
  }

  // ── 8b · LA TRAMPA DE LA CASCADA ───────────────────────────────────────────
  // Dos CSS de modulo abren un `:root` con la paleta CLARA y se cargan DESPUES
  // de kair-design-tokens.css. Con `:root` y `[data-theme="dark"]` empatados en
  // (0,1,0) gana el ultimo y `--kair-card` vuelve a `#ffffff` en oscuro: es lo
  // que dejo las tarjetas de Recursos blancas con el rotulo gris encima.
  // El bloque oscuro tiene que valer (0,2,0), o sea llevar `:root` adentro.
  const bloqueOscuro = F.tokens.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const tema of ['dark', 'dark-legacy']) {
    chk(bloqueOscuro.includes('[data-theme="' + tema + '"]'),
      'el tema ' + tema + ' sigue declarando su bloque');
    chk(new RegExp('\\[data-theme="' + tema + '"\\],\\s*\\n:root\\[data-theme="' + tema + '"\\]').test(bloqueOscuro),
      'el bloque ' + tema + ' sube a (0,2,0) con :root[data-theme=...]',
      'sin eso cualquier :root tardio le pisa --kair-card');
  }

  // ── 9 · ALFABETOS QUE ESTE REPO PROHIBE ──────────────────────────────────
  const malo = /[\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\uAC00-\uD7FF\u0400-\u04FF]/;
  for (const clave of ['tokens', 'components', 'home', 'sidebar', 'premium', 'idx']) {
    const hit = F[clave].match(malo);
    chk(!hit, 'sin CJK/cirílico/hangul en ' + NOMBRES[clave],
      hit ? 'U+' + hit[0].codePointAt(0).toString(16) : '');
  }

  return c;
}

// ── Checks ──────────────────────────────────────────────────────────────────
const checks = [];
for (const [nombre, rel] of Object.entries(RUTAS)) {
  const t = leer(path.join(APP, rel));
  checks.push({ n: rel + ' conserva su EOL LF', c: !/\r\n/.test(t), e: '' });
}

function fuentes() {
  const leido = {};
  for (const [nombre, rel] of Object.entries(RUTAS)) leido[nombre] = leer(path.join(APP, rel));
  return leido;
}

const F0 = fuentes();
const base = evaluar(F0);
for (const r of registro) checks.push({ n: r.n, c: r.c, e: '' });

// ── Mutaciones ──────────────────────────────────────────────────────────────
function clonar(o) { return JSON.parse(JSON.stringify(o)); }

const MUT = [
  ['se quita el bloque dark de los tokens',
    f => { f.tokens = f.tokens.replace('[data-theme="dark"],', '[data-theme-quelsea="dark"],'); }],
  ['se quita el bloque dark-legacy de los tokens',
    f => { f.tokens = f.tokens.replace('[data-theme="dark-legacy"],', '[data-theme-quelsea="dark-legacy"],'); }],
  ['un token de color se queda sin variante oscura',
    f => { f.tokens = f.tokens.replace('    --kair-muted:  #adb5bd;', '    --kair-muted-osc: #adb5bd;'); }],
  ['la variante oscura deja de ser distinta del claro',
    f => { f.tokens = f.tokens.replace('--kair-faint:  #9fb0c4;', '--kair-faint:  #aab1bd;'); }],
  ['el texto auxiliar baja de AA',
    f => { f.tokens = f.tokens.replace('--kair-faint:  #9fb0c4;', '--kair-faint:  #6b7280;'); }],
  ['el texto secundario baja de AA',
    f => { f.tokens = f.tokens.replace('--kair-muted:  #adb5bd;', '--kair-muted:  #5c6675;'); }],
  ['la tarjeta se oscurece sin ajustar el texto',
    f => { f.tokens = f.tokens.replace('--kair-card:   #384151;', '--kair-card:   #10151d;'); }],
  ['alguien "arregla" el oscuro editando el tema claro',
    f => { f.tokens = f.tokens.replace('--kair-card:   #ffffff;', '--kair-card:   #1a202c;'); }],
  ['un chip de estado deja de contrastar con su tinte',
    f => { f.tokens = f.tokens.replace('--kair-green-text: #5ee0a8;', '--kair-green-text: #2f6b52;'); }],
  ['el acento azul baja de 3:1',
    f => { f.tokens = f.tokens.replace('--kair-blue:      #5da2ff;', '--kair-blue:      #3a5578;'); }],
  ['se borran las reglas oscuras de components',
    f => { f.components = f.components.split('[data-theme^="dark"] .kair-btn-ghost')[0]; }],
  ['una regla oscura vuelve a poner fondo blanco',
    f => { f.components = f.components.replace('background: var(--kair-soft);', 'background: #fff;'); }],
  ['alguien mete un !important para ganar',
    // Se apunta a la regla DEL BLOQUE OSCURO con su selector completo: el mismo
    // texto (`color: var(--kair-faint);`) aparece antes en `.kair-breadcrumb
    // span`, que es de la zona clara, y el replace se comeria esa.
    f => {
      f.components = f.components.replace(
        '[data-theme^="dark"] .kair-metric-card .kair-metric-head { color: var(--kair-faint); }',
        '[data-theme^="dark"] .kair-metric-card .kair-metric-head { color: var(--kair-faint) !important; }');
    }],
  ['884 pierde el scope del sidebar',
    f => { f.sidebar = f.sidebar.replace('[data-theme^="dark"] #sidebar', '[data-theme="dark"] .sidebar'); }],
  ['885 pierde el scope del panel',
    f => { f.premium = f.premium.replace('[data-theme="dark"] .kair-premium', '.kair-premium'); }],
  ['el "/" de las metric vuelve a un literal gris',
    f => { f.home = f.home.replace('color:var(--kair-text-3)', 'color:#8791a1'); }],
  ['los iconos del radar vuelven a literales',
    f => { f.home = f.home.replace("bg: 'var(--kair-violet-soft)', color: 'var(--kair-violet)'", "bg: '#f0eaff', color: '#6b3fb8'"); }],
  ['se cuela un caracter prohibido',
    f => { f.tokens = f.tokens.replace('[data-theme="dark"],', '[data-theme="dark"] /* ' + String.fromCharCode(0x443) + ' */,'); }],
  ['se quita el cache-bust de los tokens',
    f => { f.idx = f.idx.replace(/kair-design-tokens\.css\?v=[A-Za-z0-9-]+/, 'kair-design-tokens.css'); }],
  ['el cache-bust de components se queda sin fecha',
    f => { f.idx = f.idx.replace(/kair-components\.css\?v=[A-Za-z0-9-]+/, 'kair-components.css?v=cacheviejo'); }],
  ['el bloque oscuro vuelve a (0,1,0) y le gana un :root tardio',
    f => {
      f.tokens = f.tokens
        .replace('[data-theme="dark"],\n:root[data-theme="dark"] {', '[data-theme="dark"] {')
        .replace('[data-theme="dark-legacy"],\n:root[data-theme="dark-legacy"] {', '[data-theme="dark-legacy"] {');
    }],
  ['se quita solo el selector :root del tema legacy',
    f => { f.tokens = f.tokens.replace(':root[data-theme="dark-legacy"] {', '[data-theme="dark-legacy"] {'); }],
];

let mutDetectados = 0, mutVacios = 0;
MUT.forEach(m => {
  const nombre = m[0];
  const f = clonar(F0);
  try { m[1](f); } catch (e) { console.log('FAIL MUTANTE LANZO ' + nombre + ': ' + e.message); mutVacios++; return; }
  const antes = JSON.stringify([f.tokens, f.components, f.home, f.sidebar, f.premium, f.idx]);
  const ref = JSON.stringify([F0.tokens, F0.components, F0.home, F0.sidebar, F0.premium, F0.idx]);
  if (antes === ref) { mutVacios++; console.log('FAIL MUTANTE VACIO ' + nombre); return; }
  fallidos.length = 0; registro.length = 0;
  const r = evaluar(f);
  if (r.f > 0) mutDetectados++;
  else console.log('FAIL MUTANTE NO DETECTADO ' + nombre);
});

checks.push({ n: 'mutaciones: ' + mutDetectados + '/' + MUT.length + ' detectadas', c: mutDetectados === MUT.length, e: '' });
checks.push({ n: 'mutaciones vacias: ' + mutVacios, c: mutVacios === 0, e: '' });
checks.push({ n: 'checks base: ' + (base.n - base.f) + '/' + base.n, c: base.f === 0, e: '' });

const bad = checks.filter(c => !c.c);
checks.forEach(c => { if (!c.c) console.log('FAIL ' + c.n); });
// El desglose se imprime siempre, no solo cuando algo falla: los numeros de
// checks base y de mutaciones son los que van a la documentacion.
console.log((checks.length - bad.length) + '/' + checks.length + ' OK  ' +
  '(base ' + (base.n - base.f) + '/' + base.n + ', mutaciones ' + mutDetectados + '/' + MUT.length +
  ', vacias ' + mutVacios + ')');
process.exit(bad.length === 0 ? 0 : 1);