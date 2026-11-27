'use strict';
// 📦1109 · El sidebar de dos niveles: al entrar solo las dos secciones, y al
// elegir una, solo sus módulos.
//
// POR QUÉ ESTE TEST EXISTE: hasta 📦1109 el menú era una lista plana de 8
// tarjetas bajo un solo título. Ahora hay DOS vistas posibles del mismo menú
// (raíz con las secciones, y sección con sus módulos) y una flecha que
// cambia de nivel. Lo que se protege acá es lo que un cambio de "un par de
// líneas" rompe sin que se note en pantalla hasta que alguien entra a la
// app: el orden de los módulos dentro de cada sección, que una sección no
// se llene de módulos de la otra, que "Salir" siga siendo el último renglón
// siempre, y que el filtro por empresa (activeModules) siga mandando.
//
// Se ejecuta la función REAL en un vm con un DOM mínimo, no se mira el
// texto: si mañana alguien reescribe createSidebarButtons, el test juzga lo
// que el menú de verdad pinta.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(APP, 'renderer.js'), 'utf8');

const checks = [];
const ok = (n, c, e) => checks.push({ n: n, c: !!c, e: e || '' });

// ── Recortes del fuente (mismo método que test-sidebar-nav-843) ──
function recorte(t, marcador) {
  const i = t.indexOf(marcador);
  if (i < 0) return null;
  let n = 0, fin = -1, ab = false;
  for (let k = t.indexOf('{', i); k < t.length; k++) {
    if (t[k] === '{') { n++; ab = true; }
    else if (t[k] === '}') { n--; if (ab && n === 0) { fin = k; break; } }
  }
  return ab ? t.slice(i, fin + 1) : null;
}

// Un arreglo literal se recorta hasta el primer `];`. Los arreglos anidados
// (modulos: [ ... ]) cierran con `]` seguido de coma o salto, nunca de `;`.
function recorteArreglo(t, marcador) {
  const i = t.indexOf(marcador);
  if (i < 0) return null;
  const f = t.indexOf('];', i);
  return f < 0 ? null : t.slice(i, f + 2);
}

// ── DOM mínimo: solo lo que createSidebarButtons usa ──
function nuevoElemento(tag) {
  return {
    tag: tag,
    children: [],
    atributos: {},
    className: '',
    textContent: '',
    _html: '',
    listeners: {},
    setAttribute: function (k, v) { this.atributos[k] = v; },
    getAttribute: function (k) { return this.atributos[k]; },
    appendChild: function (c) { this.children.push(c); return c; },
    addEventListener: function (t, fn) {
      (this.listeners[t] = this.listeners[t] || []).push(fn);
    },
    clic: function () { (this.listeners.click || []).forEach(function (f) { f(); }); },
    set innerHTML(v) { this._html = v; this.children = []; },
    get innerHTML() { return this._html; },
    classList: { add: function () { }, remove: function () { }, contains: function () { return false; } }
  };
}

function crearEscena() {
  const llamadas = [];
  const menu = nuevoElemento('ul');

  const c = {
    console: { log: function () { }, warn: function () { }, info: function () { } },
    document: { createElement: nuevoElemento },
    sidebarMenu: menu,
    window: {},
    currentCompany: 'Tempoactiva',
    SIDEBAR_ICONS: {
      users: '', file_text: '', heart_pulse: '', alert_triangle: '', siren: '',
      shield_check: '', trending_up: '', log_out: '', user_plus: ''
    },
    _salirDeSubmodulo: function (motivo) { llamadas.push('salir:' + motivo); },
    setActiveSidebarButton: function (el) { llamadas.push('activo:' + el.getAttribute('data-module')); },
    showModuleContent: function (nombre) { llamadas.push('abrir:' + nombre); },
    showCustomAlert: function (msg) { llamadas.push('aviso:' + msg); },
    handleLogout: function () { llamadas.push('logout'); }
  };
  c.globalThis = c;
  vm.createContext(c);

  const botones = recorteArreglo(src, 'const SIDEBAR_BUTTONS =');
  const secciones = recorteArreglo(src, 'const SIDEBAR_SECCIONES =');
  const funcion = recorte(src, 'function createSidebarButtons(');
  if (!botones || !secciones || !funcion) {
    console.error('no se pudo recortar SIDEBAR_BUTTONS / SIDEBAR_SECCIONES / createSidebarButtons');
    process.exit(1);
  }

  vm.runInContext(
    'var _sidebarSeccion = null;\n'
    + 'var _sidebarFiltro = null;\n'
    + botones + '\n'
    + secciones + '\n'
    + funcion + '\n'
    // Mandos para que la prueba pueda mover el menú de nivel desde afuera.
    + '__armar = function (filtro) { createSidebarButtons(filtro); };\n'
    + '__irA = function (id) { _sidebarSeccion = id; };\n'
    + '__raiz = function () { _sidebarSeccion = null; };\n'
    + '__nivel = function () { return _sidebarSeccion; };\n',
    c
  );

  return {
    menu: menu,
    llamadas: llamadas,
    armar: function (filtro) { c.__armar(filtro === undefined ? null : filtro); },
    irA: function (id) { c.__irA(id); },
    raiz: function () { c.__raiz(); },
    nivel: function () { return c.__nivel(); },
    empresa: function (v) { c.currentCompany = v; }
  };
}

// ── Lectura del menú armado ──
function headerDel(menu) {
  return menu.children.find(function (li) { return li.className === 'kair-nav-section-header-li'; });
}

function tarjetasDel(menu) {
  return menu.children
    .filter(function (li) {
      return li.className === 'kair-nav-card-li' || li.className === 'kair-nav-footer-li';
    })
    .map(function (li) { return li.children[0]; });
}

function modulosDe(menu) {
  return tarjetasDel(menu)
    .filter(function (t) { return t.atributos['data-module'] && t.atributos['data-module'] !== 'Salir'; })
    .map(function (t) { return t.atributos['data-module']; });
}

function seccionesDe(menu) {
  return tarjetasDel(menu)
    .filter(function (t) { return t.atributos['data-seccion']; })
    .map(function (t) { return t.atributos['data-seccion']; });
}

function ultimoEsSalir(menu) {
  const ts = tarjetasDel(menu);
  const ultimo = ts[ts.length - 1];
  return !!ultimo && ultimo.atributos['data-module'] === 'Salir'
    && ultimo.className.indexOf('kair-nav-card--footer') >= 0;
}

const SST = ['Recursos', 'Gestión Integral', 'Gestión de la Salud',
  'Gestión de Peligros y Riesgos', 'Gestión de Amenazas',
  'Verificación', 'Mejoramiento'];

// ══ 1) RAÍZ: solo las dos secciones ══
{
  const e = crearEscena();
  e.armar(null);

  const h = headerDel(e.menu);
  ok('1) la raíz conserva el título "Módulos del Sistema"',
    h && h.innerHTML.indexOf('Módulos del Sistema') >= 0);

  ok('2) la raíz pinta exactamente dos secciones',
    JSON.stringify(seccionesDe(e.menu)) === '["sst","gh"]',
    JSON.stringify(seccionesDe(e.menu)));

  const ts = tarjetasDel(e.menu);
  const titulos = ts.filter(t => t.atributos['data-seccion'])
    .map(t => t.children.find(x => x.className === 'kair-nav-card__text').children[0].textContent);
  ok('3) los títulos son "Seguridad y Salud en el Trabajo" y "Gestión Humana"',
    JSON.stringify(titulos) ===
    JSON.stringify(['Seguridad y Salud en el Trabajo', 'Gestión Humana']),
    JSON.stringify(titulos));

  ok('4) la raíz NO lista ningún módulo (ninguna tarjeta con data-module salvo Salir)',
    modulosDe(e.menu).length === 0, JSON.stringify(modulosDe(e.menu)));

  ok('5) "Salir" sigue siendo el último renglón', ultimoEsSalir(e.menu));
}

// ══ 2) ENTRAR A SST: solo sus siete módulos, con la flecha de vuelta ══
{
  const e = crearEscena();
  e.armar(null);
  tarjetasDel(e.menu).find(t => t.atributos['data-seccion'] === 'sst').clic();

  ok('6) al tocar la sección el menú cambia de nivel', e.nivel() === 'sst', String(e.nivel()));

  const h = headerDel(e.menu);
  const caja = h && h.children[0];
  ok('7) el título pasa al nombre de la sección',
    !!caja && caja.className.indexOf('kair-nav-section-header--back') >= 0 &&
    caja.children.some(x => x.className === 'kair-nav-section-header__text'
      && x.textContent === 'Seguridad y Salud en el Trabajo'),
    caja && caja.className);

  const flecha = caja && caja.children.find(x => x.className === 'kair-nav-back');
  ok('8) aparece la flecha de vuelta', !!flecha);

  ok('9) los siete módulos SST salen en su orden, sin mezclarse',
    JSON.stringify(modulosDe(e.menu)) === JSON.stringify(SST),
    JSON.stringify(modulosDe(e.menu)));

  ok('10) dentro de SST NO aparece la tarjeta Gestión Humana',
    modulosDe(e.menu).indexOf('Gestión Humana') < 0);

  ok('11) las dos secciones ya no se ven', seccionesDe(e.menu).length === 0,
    JSON.stringify(seccionesDe(e.menu)));

  ok('12) "Salir" sigue siendo el último renglón', ultimoEsSalir(e.menu));

  // La flecha vuelve a la raíz
  flecha.clic();
  ok('13) la flecha devuelve a las dos secciones', e.nivel() === null
    && JSON.stringify(seccionesDe(e.menu)) === '["sst","gh"]',
    String(e.nivel()) + ' ' + JSON.stringify(seccionesDe(e.menu)));
}

// ══ 3) ENTRAR A GESTIÓN HUMANA: solo su tarjeta ══
{
  const e = crearEscena();
  e.armar(null);
  tarjetasDel(e.menu).find(t => t.atributos['data-seccion'] === 'gh').clic();

  ok('14) GH lista únicamente la tarjeta Gestión Humana',
    JSON.stringify(modulosDe(e.menu)) === JSON.stringify(['Gestión Humana']),
    JSON.stringify(modulosDe(e.menu)));

  ok('15) y no se le cuelan módulos de SST',
    SST.every(n => modulosDe(e.menu).indexOf(n) < 0));

  const caja = headerDel(e.menu).children[0];
  const texto = caja.children.find(x => x.className === 'kair-nav-section-header__text');
  ok('16) el título de GH es el de la sección',
    texto && texto.textContent === 'Gestión Humana', texto && texto.textContent);
}

// ══ 4) EL CLIC DE MÓDULO SIGUE NAVEGANDO IGUAL (contrato 📦843) ══
{
  const e = crearEscena();
  e.armar(null);
  tarjetasDel(e.menu).find(t => t.atributos['data-seccion'] === 'sst').clic();
  e.llamadas.length = 0;

  tarjetasDel(e.menu).find(t => t.atributos['data-module'] === 'Recursos').clic();
  ok('17) el clic de módulo sale del submódulo, marca y abre, en ese orden',
    JSON.stringify(e.llamadas) ===
    JSON.stringify(['salir:sidebar → Recursos', 'activo:Recursos', 'abrir:Recursos']),
    JSON.stringify(e.llamadas));

  e.llamadas.length = 0;
  e.empresa(null);
  tarjetasDel(e.menu).find(t => t.atributos['data-module'] === 'Verificación').clic();
  ok('18) sin empresa sigue avisando en vez de abrir',
    e.llamadas.length === 1 && e.llamadas[0].indexOf('aviso:') === 0,
    JSON.stringify(e.llamadas));

  e.llamadas.length = 0;
  tarjetasDel(e.menu).find(t => t.atributos['data-module'] === 'Salir').clic();
  ok('19) "Salir" sigue cerrando la sesión', JSON.stringify(e.llamadas) === '["logout"]',
    JSON.stringify(e.llamadas));
}

// ══ 5) FILTRO POR EMPRESA (activeModules) ══
{
  const e = crearEscena();
  e.armar(['Recursos', 'Gestión Humana']);
  ok('20) con las dos disponibles, la raíz muestra las dos secciones',
    JSON.stringify(seccionesDe(e.menu)) === '["sst","gh"]',
    JSON.stringify(seccionesDe(e.menu)));

  e.irA('sst');
  e.armar(['Recursos', 'Gestión Humana']);
  ok('21) dentro de SST solo sobrevive el módulo filtrado',
    JSON.stringify(modulosDe(e.menu)) === JSON.stringify(['Recursos']),
    JSON.stringify(modulosDe(e.menu)));

  e.raiz();
  e.armar(['Recursos']);
  ok('22) si GH no tiene ningún módulo activo, su sección no se pinta',
    JSON.stringify(seccionesDe(e.menu)) === '["sst"]',
    JSON.stringify(seccionesDe(e.menu)));

  // Una sección pedida que el filtro dejó vacía no puede quedar en pantalla:
  // el menú tiene que volver solo a la raíz.
  e.irA('gh');
  e.armar(['Recursos']);
  ok('23) una sección vacía devuelve el menú a la raíz en vez de quedar muda',
    e.nivel() === null && headerDel(e.menu).innerHTML.indexOf('Módulos del Sistema') >= 0,
    String(e.nivel()));

  ok('24) "Salir" sale siempre, filtrado o no', ultimoEsSalir(e.menu));
}

// ══ 6) ARCHIVOS: EOL, cache-bust y estilos de la flecha ══
{
  const leer = f => fs.readFileSync(path.join(APP, f), 'utf8');
  const rend = leer('renderer.js');
  const css = leer('shared/kair-sidebar.css');
  const idx = leer('index.html');

  ok('25) renderer.js conserva su EOL CRLF puro',
    /\r\n/.test(rend) && !/[^\r]\n/.test(rend));
  ok('26) kair-sidebar.css conserva su EOL LF puro', !/\r/.test(css));
  ok('27) index.html conserva su EOL LF puro', !/\r/.test(idx));

  ok('28) index.html versiona renderer.js',
    /renderer\.js\?v=\d{8}-[a-z0-9-]+/.test(idx),
    (/(?<=renderer\.js\?v=)[^"]+/.exec(idx) || [''])[0]);
  ok('29) index.html versiona kair-sidebar.css con el formato SIDEBAR-AAAAMMDD-...',
    /shared\/kair-sidebar\.css\?v=SIDEBAR-\d{8}-[a-z0-9-]+/.test(idx),
    (/(?<=kair-sidebar\.css\?v=)[^"]+/.exec(idx) || [''])[0]);

  ok('30) la hoja del sidebar estiliza la flecha de vuelta',
    /\.kair-nav-back\s*\{/.test(css) && /\.kair-nav-section-header--back\s*\{/.test(css));
  ok('31) la flecha usa tokens del design system, sin colores escritos a mano',
    /\.kair-nav-back\s*\{[^}]*var\(--kair-[^)]+\)/.test(css));

  ok('32) el marcado produce las clases que usa la flecha',
    rend.indexOf('kair-nav-back') >= 0 && rend.indexOf('kair-nav-section-header--back') >= 0);
  ok('33) renderer.js sigue produciendo las clases que exige el 📦884',
    ['kair-nav-card', 'kair-nav-card__title', 'kair-nav-card__subtitle',
      'kair-nav-card__icon', 'kair-nav-section-header', 'kair-nav-card--footer']
      .every(cl => rend.indexOf(cl) >= 0));
}

// ══ Resumen ══
let fallidos = 0;
console.log('\n=======================================');
console.log('  📦1109 · Sidebar de dos niveles (secciones -> modulos)');
console.log('=======================================');
checks.forEach(ch => {
  if (!ch.c) fallidos++;
  console.log((ch.c ? 'OK  ' : 'FAIL') + '  ' + ch.n + (ch.e ? '  [' + ch.e + ']' : ''));
});
console.log('---');
console.log((checks.length - fallidos) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(fallidos === 0 ? 0 : 1);
