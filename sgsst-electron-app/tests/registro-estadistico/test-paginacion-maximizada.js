// test-paginacion-maximizada.js
//
// Defecto reportado con captura: la tabla de 3.2.3 (Registro y Análisis
// Estadístico) mostraba SIEMPRE 15 filas — "Mostrando 1–15 de 85" — también
// con la ventana maximizada, donde sobra pantalla y entrarían 50.
//
// Causa: el tamaño de página era un número fijo en el estado de la tabla
// (pageSize: 15) y nada lo reconsideraba al cambiar el tamaño de la ventana.
//
// Este test NO compara texto contra texto: EJECUTA el JS real del módulo con
// un DOM mínimo y dispara el redimensionamiento real, verificando:
//   · ventana chica (1100px)           → 15 filas
//   · maximizada por ANCHO (1904px)    → 50 filas
//   · de vuelta en ventana             → 15 filas
//   · al pasar a 50 estando en una página lejana → la página se recorta
//   · maximizada por el SISTEMA a 1280px → 50 filas (lee electronAPI.isMaximized)
//   · reabrir el módulo NO apila escuchas de resize (queda 1 sola)
//   · con la tabla desmontada no revienta
//
// Ejecución:  node tests/registro-estadistico/test-paginacion-maximizada.js
// Resultado:  Imprime OK/FAIL. Exit 0 = OK, 1 = FAIL.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const F_JS = path.join(ROOT, 'modules', 'gestion-salud', 'registro-estadistico', 'registro-estadistico.js');
const codigo = fs.readFileSync(F_JS, 'utf8');

/* ══════════════ DOM mínimo ══════════════ */

class Nodo {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this._html = '';
    this.style = {};
    this.dataset = {};
    this.options = [];
    this.value = '';
    this.textContent = '';
    this.listeners = {};
    this._set = new Set();
    this.classList = {
      add: (c) => { this._set.add(c); },
      remove: (c) => { this._set.delete(c); },
      toggle: (c) => { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); },
      contains: (c) => this._set.has(c),
    };
    this._botones = [];
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  appendChild(n) { this.options.push(n); return n; }
  removeChild(n) { const i = this.options.indexOf(n); if (i >= 0) this.options.splice(i, 1); }
  remove(i) { this.options.splice(i, 1); }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener(t, fn) {
    const l = this.listeners[t] || [];
    const i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  }
  setAttribute() {}
  getAttribute() { return null; }
  querySelector() { return null; }
  getElementsByTagName() { return []; }
  click() { (this.listeners.click || []).forEach((fn) => fn({ target: this })); }

  // La paginación arma botones con querySelectorAll('.k-page-btn'): los sintetizamos
  // desde el HTML que acaba de escribir, para poder tocarlos desde el test.
  querySelectorAll(sel) {
    if (sel === '.k-page-btn' && this._html) {
      const valores = [];
      const re = /data-p="([^"]+)"/g;
      let m;
      while ((m = re.exec(this._html)) !== null) valores.push(m[1]);
      this._botones = valores.map((v) => { const b = new Nodo('button'); b.dataset.p = v; return b; });
      return this._botones;
    }
    return [];
  }
}

const nodos = {};
function nodo(id) { if (!nodos[id]) nodos[id] = new Nodo(id); return nodos[id]; }

const winListeners = {};
let desmontado = false;
let maximizadaSistema = false;

function despacharResize() {
  (winListeners.resize || []).slice().forEach((fn) => fn());
}

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  innerWidth: 1100,
  innerHeight: 800,
  currentCompany: '',
  localStorage: { getItem: () => null, setItem: () => {} },
  navigator: { userAgent: 'test' },
  electronAPI: {
    isMaximized: () => Promise.resolve(maximizadaSistema),
  },
  document: {
    getElementById: (id) => (desmontado ? null : nodo(id)),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => new Nodo(tag),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new Nodo('body'),
    documentElement: new Nodo('html'),
  },
  addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
  removeEventListener: (t, fn) => {
    const l = winListeners[t] || [];
    const i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function cargar() {
  vm.runInContext(codigo, sandbox, { filename: 'registro-estadistico.js' });
}

// El estado de la ventana llega por IPC (promesa) + debounce de 150ms.
function esperar() {
  return new Promise((resolve) => setTimeout(resolve, 260));
}

function filas() {
  return (nodo('kTableBody').innerHTML.match(/data-record-idx=/g) || []).length;
}
function pie() {
  return nodo('kPagination').innerHTML;
}
function totalRegistros() {
  const m = /de (\d+) registros/.exec(pie());
  return m ? parseInt(m[1], 10) : 0;
}
function paginaActiva() {
  const m = /k-page-btn active" data-p="(\d+)"/.exec(pie());
  return m ? parseInt(m[1], 10) : 0;
}
function primeraFila() {
  const m = /Mostrando (\d+)/.exec(pie());
  return m ? parseInt(m[1], 10) : 0;
}
function irAPagina(valor) {
  const btn = nodo('kPagination')._botones.find((b) => b.dataset.p === String(valor));
  if (btn) btn.click();
  return !!btn;
}

/* ══════════════ Checks ══════════════ */

const checks = [];
function check(name, ok) { checks.push({ name: name, ok: !!ok }); }

(async function main() {
  /* ── 1. Carga en ventana chica: 15 filas (comportamiento previo) ── */
  sandbox.innerWidth = 1100;
  maximizadaSistema = false;
  cargar();
  await esperar();

  const total = totalRegistros();
  check('JS compila y carga sin errores', total > 0);
  check('datos de muestra con más de 50 filas (si no, el caso no se puede probar)', total > 50);
  check('ventana 1100px → 15 filas', filas() === 15);
  check('ventana 1100px → pie "Mostrando 1–15 de ' + total + '"', pie().indexOf('Mostrando 1–15 de ' + total) >= 0);
  check('quedó UNA sola escucha de resize', (winListeners.resize || []).length === 1);

  /* ── 2. Maximizada por ancho → 50 filas ── */
  sandbox.innerWidth = 1904;
  despacharResize();
  await esperar();
  check('maximizada por ancho (1904px) → 50 filas', filas() === 50);
  check('maximizada por ancho → pie "Mostrando 1–50 de ' + total + '"', pie().indexOf('Mostrando 1–50 de ' + total) >= 0);

  /* ── 3. Vuelta a ventana → 15 filas ── */
  sandbox.innerWidth = 1100;
  despacharResize();
  await esperar();
  check('vuelta a ventana (1100px) → 15 filas', filas() === 15);

  /* ── 4. Estar en una página lejana y maximizar: la página se recorta ── */
  let saltos = 0;
  while (irAPagina('next') && saltos < 20) saltos++;
  const paginaVieja = paginaActiva();
  check('se pudo navegar hasta la última página con 15 por página', paginaVieja > 2);
  sandbox.innerWidth = 1904;
  despacharResize();
  await esperar();
  const paginaNueva = paginaActiva();
  check('al pasar a 50 por página la página ' + paginaVieja + ' se recorta a la última posible (' + Math.ceil(total / 50) + ')',
    paginaNueva === Math.ceil(total / 50));
  check('la primera fila del pie corresponde a la página ' + paginaNueva + ' con 50 por página',
    primeraFila() === (paginaNueva - 1) * 50 + 1);
  check('el pie sigue siendo coherente con el total (' + total + ')',
    new RegExp('Mostrando \\d+–\\d+ de ' + total + ' registros').test(pie()));

  /* ── 5. Pantalla chica MAXIMIZADA por el sistema → 50 filas ── */
  sandbox.innerWidth = 1100;
  despacharResize();
  await esperar();
  irAPagina('1');   // dejamos la tabla en la primera página para comparar filas equivalentes

  sandbox.innerWidth = 1280;
  maximizadaSistema = false;
  despacharResize();
  await esperar();
  check('1280px sin maximizar → 15 filas en la página 1', filas() === 15 && paginaActiva() === 1);

  maximizadaSistema = true;
  despacharResize();
  await esperar();
  check('1280px CON la ventana maximizada por el sistema → 50 filas', filas() === 50);

  maximizadaSistema = false;
  despacharResize();
  await esperar();
  check('1280px la ventana deja de estar maximizada → 15 filas', filas() === 15);

  /* ── 5b. Abrir el módulo YA maximizada en pantalla chica (sin resize) ── */
  sandbox.innerWidth = 1280;
  maximizadaSistema = true;
  cargar();
  await esperar();
  check('abre con la ventana ya maximizada a 1280px → 50 filas sin ningún resize',
    filas() === 50);
  check('abre maximizada → pie "Mostrando 1–50 de ' + total + '"', pie().indexOf('Mostrando 1–50 de ' + total) >= 0);

  /* ── 6. Reabrir el módulo: no se apilan escuchas ni pinta la carga vieja ── */
  sandbox.innerWidth = 1100;
  maximizadaSistema = false;
  despacharResize();
  await esperar();

  sandbox.innerWidth = 1904;
  despacharResize();          // deja un temporizador pendiente en la carga ACTUAL
  irAPagina('next');          // ... y esa carga se queda en la página 2
  const paginaDeLaCargaVieja = paginaActiva();
  check('la carga previa llegó a la página ' + paginaDeLaCargaVieja + ' con 50 por página',
    paginaDeLaCargaVieja === 2);

  sandbox.innerWidth = 1100;
  cargar();                   // reapertura ANTES de que venza el temporizador viejo
  const pieDeLaCargaNueva = pie();
  check('la reapertura en 1100px pinta 15 filas en la página 1', filas() === 15 &&
    pieDeLaCargaNueva.indexOf('Mostrando 1–15 de ' + total) >= 0);

  await esperar();            // acá vence el temporizador de la carga que ya no está
  check('la carga vieja NO pinta encima de la nueva',
    pie() === pieDeLaCargaNueva && filas() === 15);
  check('al reabrir queda UNA sola escucha de resize', (winListeners.resize || []).length === 1);

  sandbox.innerWidth = 1904;
  despacharResize();
  await esperar();
  check('la carga vigente sigue reaccionando tras reabrir → 50 filas', filas() === 50);

  /* ── 7. Con la tabla desmontada no revienta ── */
  desmontado = true;
  let erro = false;
  try {
    sandbox.innerWidth = 1100;
    despacharResize();
    await esperar();
  } catch (e) {
    erro = true;
    console.log('       error: ' + e.message);
  }
  desmontado = false;
  check('con la tabla fuera del DOM no lanza error', !erro);

  /* ══════════════ Reporte ══════════════ */
  let failed = 0;
  checks.forEach((c) => {
    if (c.ok) {
      console.log('[OK  ] ' + c.name);
    } else {
      failed++;
      console.log('[FAIL] ' + c.name);
    }
  });
  console.log('');
  console.log((checks.length - failed) + '/' + checks.length + ' checks OK');
  if (failed === 0) console.log('✅ 3.2.3 paginación adaptativa: 15 en ventana / 50 maximizada');
  process.exit(failed === 0 ? 0 : 1);
})();
