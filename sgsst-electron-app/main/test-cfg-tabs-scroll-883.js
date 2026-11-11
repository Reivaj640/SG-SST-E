'use strict';
// 📦883 · Las tabs de Configuración ya no dibujan barra vertical.
//
// Lo que se veía en pantalla era una barrita de scroll en el extremo derecho de
// la fila de tabs, con las flechitas de Windows. No hacía falta para nada: las
// tabs se navegan en horizontal y no tienen nada que scrollear en vertical.
//
// LA CAUSA, que es la parte que vale preservar. En CSS, cuando un eje vale
// `visible` y el otro no, la especificación obliga a que el `visible` se
// convierta en `auto`. O sea: declarar SOLO `overflow-x: auto` convierte la
// barra de tabs en un contenedor que scrollea en los DOS ejes, y cualquier
// desborde de un píxel —el borde inferior, un tab que estira, un
// pseudo-elemento— alcanza para pintar la barrita. Por eso el arreglo es
// declarar `overflow-y: hidden` explícito, y no "sacarle el overflow".
//
// Y hay una trampa que este test existe para no repetir: `.settings-top-nav` y
// `.kair-config .cfg-tabs` aplican al MISMO elemento (`<nav class="cfg-tabs
// settings-top-nav">`), y la segunda gana por especificidad (0,0,2,0 contra
// 0,0,1,0). Arreglar solo una deja el bug vivo. Los dos checks existen por eso.
//
// El `overflow-x: auto` SE QUEDA: en una ventana angosta las seis tabs no caben
// y sin desplazamiento horizontal las últimas serían inalcanzables.
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');

// La FECHA en que 📦883 (2026-10-14) subió el token del iframe de
// Configuración. Esto NO es un sello de cache-bust: es un hecho histórico, no
// se bumpea, así que puede quedar escrito. Lo que se bumpea es el token vivo,
// y por eso los checks de acá miran la FECHA y no el texto del sello.
const PISO_TOKEN_883 = 20261014;

function leer(p) { return fs.readFileSync(p, 'utf8'); }

// Comentarios fuera: un guard que matchea su propio comentario no guarda nada.
// El `//` solo se corta cuando NO va precedido de `:`, para no romper `https://`.
function soloCodigo(t) {
  return t
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Saca el bloque de una regla CSS a partir de su selector de apertura.
// Se usa para poder mirar DENTRO de .settings-top-nav y no matchear el nombre
// de la regla desde un comentario o desde la otra regla que la duplica.
function cuerpoRegla(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}');
  const m = re.exec(css);
  return m ? m[1] : '';
}

const fallidos = [];
const registro = [];

// ── evaluar ─────────────────────────────────────────────────────────────────
function evaluar(F) {
  const c = { n: 0, f: 0 };
  const chk = (cond, nombre, detalle) => {
    c.n++;
    registro.push({ n: nombre, c: !!cond });
    if (!cond) { c.f++; fallidos.push(nombre + (detalle ? ' :: ' + detalle : '')); }
  };

  const cfg = soloCodigo(F.cfg);
  const ren = soloCodigo(F.ren);
  const idx = soloCodigo(F.idx);

  // 1 · El arreglo: `overflow-y: hidden` en las DOS reglas del elemento.
  const nav = cuerpoRegla(cfg, '.settings-top-nav');
  const tabs = cuerpoRegla(cfg, '.kair-config .cfg-tabs');

  chk(nav.length > 0, 'existe la regla .settings-top-nav');
  chk(tabs.length > 0, 'existe la regla .kair-config .cfg-tabs');

  chk(/overflow-y\s*:\s*hidden/.test(nav),
    '.settings-top-nav declara overflow-y: hidden', nav.slice(0, 160));
  chk(/overflow-y\s*:\s*hidden/.test(tabs),
    '.kair-config .cfg-tabs declara overflow-y: hidden', tabs.slice(0, 160));

  // 2 · El horizontal SE QUEDA. Si alguien "arregla" el bug quitando los dos,
  //    en una ventana angosta las últimas tabs quedan inalcanzables.
  chk(/overflow-x\s*:\s*auto/.test(nav),
    '.settings-top-nav conserva overflow-x: auto');
  chk(/overflow-x\s*:\s*auto/.test(tabs),
    '.kair-config .cfg-tabs conserva overflow-x: auto');

  // 3 · El elemento HTML lleva las DOS clases. Si alguien le quita una, el
  //    reparto de reglas cambia y hay que darse cuenta.
  chk(/class="[^"]*settings-top-nav[^"]*"/.test(cfg) && /class="[^"]*cfg-tabs[^"]*"/.test(cfg),
    'el nav de las tabs lleva las dos clases');
  chk(/role="tablist"/.test(cfg), 'el nav conserva role="tablist"');

  // 4 · Cache-bust del iframe. Sin el bump, el navegador sigue con la versión
  //    vieja y el arreglo parece que no se hizo.
  const token = (/config-viewer\.html\?v=([^'"]+)/.exec(ren) || [])[1] || '';
  chk(token.length > 0, 'el iframe de Configuración lleva token de cache-bust');
  chk(/^\d{8}-[a-z0-9-]+$/.test(token), 'el token tiene formato AAAAMMDD-descripcion', token);
  chk(token !== '20261006-oauth-embebido', 'el token NO es el viejo de 868', token);

  // 5 · Que el arreglo exista en la versión que el shell pide. Si el token no
  //    cambiara, el usuario vería el bug aunque el CSS esté bien en el repo.
  //
  //    📦883 (2026-10-14) subió el token de `20261006-oauth-embebido` a
  //    `20261014-cfg-tabs883`. Después lo volvieron a subir 📦927-928
  //    (20261022) y 📦1042 (20261107), así que el sello YA NO dice
  //    "cfg-tabs883". Exigir ese texto rompía con cada bumpeo posterior y
  //    dejaba la mutación correspondiente VACÍA, sin avisar (PROMPT.md,
  //    trampa 28).
  //
  //    Lo que sobrevive —y es lo que de verdad protege el arreglo— es la FECHA:
  //    el token no puede retroceder a uno anterior a 883, porque con un token
  //    viejo el navegador vuelve a pedir la versión sin el `overflow-y:
  //    hidden`. Mismo criterio que test-anexos-1042.js: se vigila el
  //    INVARIANTE, no el texto del sello.
  const fechaToken = /(\d{8})/.exec(token);
  chk(!!fechaToken && Number(fechaToken[1]) >= PISO_TOKEN_883,
    'el token del iframe no retrocede al de antes de 883', token);

  // 6 · Ejes explícitos, no heredados. El patrón correcto en TODO el archivo es
  //    declarar overflow-x y overflow-y juntos; un `overflow: auto` suelto
  //    reintroduciría el bug por otra puerta.
  chk(!/\boverflow\s*:\s*auto/.test(nav), 'no se reintroduce con overflow: auto en la nav');
  chk(!/\boverflow\s*:\s*auto/.test(tabs), 'no se reintroduce con overflow: auto en las tabs');

  return c;
}

// ── Checks ──────────────────────────────────────────────────────────────────
const checks = [];

const cfgPath = path.join(APP, 'components', 'config', 'config-viewer.html');
const renPath = path.join(APP, 'renderer.js');
const idxPath = path.join(APP, 'index.html');

function fuentes() {
  return { cfg: leer(cfgPath), ren: leer(renPath), idx: leer(idxPath) };
}

// El EOL va FUERA de evaluar(): es una propiedad de los bytes del archivo.
const cfgBytes = leer(cfgPath);
checks.push({
  n: 'config-viewer.html conserva su EOL LF',
  c: !/\r\n/.test(cfgBytes),
  e: ''
});
const renBytes = leer(renPath);
checks.push({
  n: 'renderer.js conserva su EOL CRLF',
  c: /\r\n/.test(renBytes) && !/[^\r]\n/.test(renBytes),
  e: ''
});

const F0 = fuentes();
const base = evaluar(F0);
for (const r of registro) checks.push({ n: r.n, c: r.c, e: '' });

// ── Mutaciones ──────────────────────────────────────────────────────────────
function clonar(o) { return JSON.parse(JSON.stringify(o)); }

// Reescribe el `?v=` del iframe de Configuración. Las mutaciones se derivan
// con ESTA función y no con un literal: el token vivo cambia con cada
// bumpeo y una mutación atada a un texto viejo se vuelve vacía sin avisar
// (PROMPT.md, trampa 28). Con el regex, la mutación muerde siempre, sea cual
// sea el token que haya vivo.
function conToken(ren, nuevo) {
  return ren.replace(/(config-viewer\.html\?v=)[^'"]+/, (m, pre) => pre + nuevo);
}

const MUT = [
  ['se quita el overflow-y de .settings-top-nav',
    f => { f.cfg = f.cfg.replace('.settings-top-nav', '.settings-top-nav-X').replace('overflow-y: hidden;', 'X'); }],
  ['se quita el overflow-y de .kair-config .cfg-tabs',
    f => { f.cfg = f.cfg.replace('.kair-config .cfg-tabs {', '.kair-config .cfg-tabs-X {'); }],
  ['se quita el overflow-x: se pierde el desplazamiento horizontal',
    f => { f.cfg = f.cfg.replace(/overflow-x:\s*auto/g, 'overflow-x: visible'); }],
  ['se reintroduce el bug con overflow: auto a secas',
    f => { f.cfg = f.cfg.replace('overflow-x: auto;\n            /* 📦883', 'overflow: auto;\n            /* 📦883'); }],
  ['se le quita la clase cfg-tabs al nav',
    f => { f.cfg = f.cfg.replace('class="cfg-tabs settings-top-nav"', 'class="settings-top-nav"'); }],
  ['se le quita el role tablist',
    f => { f.cfg = f.cfg.replace('role="tablist"', ''); }],
  ['el iframe se queda con el token viejo de 868',
    f => { f.ren = conToken(f.ren, '20261006-oauth-embebido'); }],
  ['el token del iframe queda sin formato de fecha',
    f => { f.ren = conToken(f.ren, 'sin-fecha'); }]
];

let mutDetectados = 0, mutVacios = 0;
MUT.forEach(m => {
  const nombre = m[0];
  const f = clonar(F0);
  try { m[1](f); } catch (e) { console.log('FAIL MUTANTE LANZO ' + nombre + ': ' + e.message); mutVacios++; return; }

  const antes = JSON.stringify([f.cfg, f.ren]);
  const ref = JSON.stringify([F0.cfg, F0.ren]);
  if (antes === ref) { mutVacios++; console.log('FAIL MUTANTE VACIO ' + nombre); return; }

  fallidos.length = 0;
  registro.length = 0;
  const r = evaluar(f);
  if (r.f > 0) mutDetectados++;
  else console.log('FAIL MUTANTE NO DETECTADO ' + nombre);
});

checks.push({ n: 'mutaciones: ' + mutDetectados + '/' + MUT.length + ' detectadas', c: mutDetectados === MUT.length, e: '' });
checks.push({ n: 'mutaciones vacias: ' + mutVacios, c: mutVacios === 0, e: '' });
checks.push({ n: 'checks base: ' + (base.n - base.f) + '/' + base.n, c: base.f === 0, e: '' });

const bad = checks.filter(c => !c.c);
checks.forEach(c => { if (!c.c) console.log('FAIL ' + c.n); });
console.log((checks.length - bad.length) + '/' + checks.length + ' OK');
process.exit(bad.length === 0 ? 0 : 1);