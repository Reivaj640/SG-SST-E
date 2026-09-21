/* ============================================================
 * K+AIR · Smoke test — El gráfico se VE BIEN: proporción y encaje (📦758)
 * ============================================================
 * Reporte del user con captura en "Ejecución del Plan Anual" (home de Gestión Integral):
 * en el gráfico se veía el "36 %" ENCIMA de la palabra "ejecutadas" y el dibujo deformado.
 *
 * Causa: las barras se dibujaban con `<svg preserveAspectRatio="none">` dentro de una caja
 * de ancho variable. "none" significa "estirá el dibujo para llenar la caja": al cambiar
 * el ancho de la tarjeta, TODO se deforma — el texto se estira a lo ancho y se aplasta a
 * lo alto, y las posiciones internas (medidas en un lienzo de 690px) dejan de coincidir
 * con el tamaño real. Resultado: texto montado sobre texto.
 *
 * Solución: una barra es una CAJA, no una forma libre. Los gráficos de barras ahora se
 * dibujan con cajas HTML (.kair-bar-chart): label + barra + valor en 3 columnas de una
 * rejilla, así nunca se pisan; el ancho de relleno es un porcentaje real; y el alto lo
 * pone el contenido.
 *
 * Este test NO compara texto contra texto: EJECUTA el código real de cada home con un
 * DOM mínimo y revisa el HTML que produce + las reglas CSS que lo dimensionan.
 *
 * Correr con: node main/test-grafico-se-ve-bien.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

// ── DOM mínimo: los homes dibujan el gráfico con innerHTML y 1-2 consultas ──────
class NodoFalso {
  constructor() { this._html = ''; this.innerHTML = ''; this.style = {}; this.dataset = {}; }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  appendChild() {} setAttribute() {} addEventListener() {} removeEventListener() {}
  querySelectorAll() { return []; } querySelector() { return null; }
  getElementsByTagName() { return []; }
  classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
}

const nodos = {};
function nodoPara(id) {
  if (!nodos[id]) nodos[id] = new NodoFalso();
  return nodos[id];
}

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Math: Math,
  Date: Date,
  JSON: JSON,
  Number: Number,
  String: String,
  isFinite: isFinite,
  document: {
    getElementById: function (id) { return nodoPara(id); },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {},
    createElement: function () { return new NodoFalso(); },
    body: new NodoFalso(),
    documentElement: new NodoFalso()
  },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  navigator: { userAgent: 'test' }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const CARGA = {};
function cargarHome(rel) {
  if (CARGA[rel]) return;
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(src, sandbox, { filename: rel });
  CARGA[rel] = true;
}
function instanciar(nombreClase) {
  const Ctor = sandbox[nombreClase];
  if (typeof Ctor !== 'function') throw new Error('No cargué la clase ' + nombreClase);
  return new Ctor(new NodoFalso(), 'Modulo', ['1.1.1 Uno'], 'Empresa');
}
// Llama al método real del home y devuelve el HTML del gráfico: unos lo escriben en su
// caja (innerHTML) y otros lo devuelven como texto.
function dibujar(clase, archivo, id, metodo, args) {
  cargarHome(archivo);
  const inst = instanciar(clase);
  inst.submodules = ['1.1.1 Uno', '1.1.2 Dos', '1.1.3 Tres', '1.1.4 Cuatro', '1.1.5 Cinco'];
  const devuelto = inst[metodo].apply(inst, args);
  if (typeof devuelto === 'string' && devuelto.indexOf('kair-bar-chart') >= 0) return devuelto;
  return id ? nodoPara(id).innerHTML : String(devuelto || '');
}
function dibujarAislado(archivo, clase, id, metodo, args) {
  if (id) nodoPara(id).innerHTML = '';
  return dibujar(clase, archivo, id, metodo, args);
}

const checks = [];
function check(name, ok, extra) { checks.push({ name: name, ok: !!ok, extra: extra }); }
function filasDe(html) {
  return html.match(/<div class="kair-bar-chart__row">[\s\S]*?<\/div>/g) || [];
}
function anchoDe(fila) {
  const m = fila.match(/kair-bar-chart__fill" style="width:([\d.]+)%/);
  return m ? parseFloat(m[1]) : null;
}
function labelDe(fila) {
  const m = fila.match(/kair-bar-chart__label">([^<]*)</);
  return m ? m[1] : null;
}
function valorDe(fila) {
  const m = fila.match(/kair-bar-chart__value">([\s\S]*?)<\/span>/);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

// ── 1. Gestión Integral · Ejecución del Plan Anual (el caso reportado) ─────────
const integral = dibujar('GestionIntegralHome', 'modules/gestion-integral/gestion-integral-home.js',
  'kair-chart-plan', 'renderChartPlan',
  [{ porcentajeAvance: 36, totalActividades: 106, actividadesEjecutadas: 38, actividadesPendientes: 68 }]);
check('Integral: usa el componente de barras HTML (no un dibujo estirado)',
  integral.indexOf('kair-bar-chart') >= 0 && integral.indexOf('<svg') < 0);
check('Integral: ya no dibuja texto dentro del gráfico (<text>)', integral.indexOf('<text') < 0);
check('Integral: el porcentaje va en su PROPIA caja, arriba (no sobre "ejecutadas")',
  /kair-bar-chart__head[\s\S]*kair-bar-chart__big">36%/.test(integral));
const filasIntegral = filasDe(integral);
check('Integral: 2 filas (avance + pendiente)', filasIntegral.length === 2, 'filas=' + filasIntegral.length);
check('Integral: la barra de avance mide 36% del ancho',
  filasIntegral[0] && Math.abs(anchoDe(filasIntegral[0]) - 36) < 0.6,
  'ancho=' + (filasIntegral[0] ? anchoDe(filasIntegral[0]) : 'n/a'));
check('Integral: la barra de pendiente completa el 100%',
  filasIntegral[1] && Math.abs(anchoDe(filasIntegral[1]) - 64) < 0.6,
  'ancho=' + (filasIntegral[1] ? anchoDe(filasIntegral[1]) : 'n/a'));
check('Integral: la fila dice cuántas actividades ejecutadas y el total',
  valorDe(filasIntegral[0]) === '38 / 106', 'valor=' + valorDe(filasIntegral[0]));
check('Integral: el resumen de abajo sigue existiendo (ejecutadas / pendientes / totales)',
  /kair-bar-chart__foot[\s\S]*38<\/strong> ejecutadas[\s\S]*68<\/strong> pendientes[\s\S]*106<\/strong> totales/.test(integral));
check('Integral: datos raros no rompen el dibujo (vacío → 0%, pasado de 100 → 100%)',
  filasDe(dibujarAislado('modules/gestion-integral/gestion-integral-home.js', 'GestionIntegralHome',
    'kair-chart-plan', 'renderChartPlan', [{}])).length === 2 &&
  dibujarAislado('modules/gestion-integral/gestion-integral-home.js', 'GestionIntegralHome',
    'kair-chart-plan', 'renderChartPlan',
    [{ porcentajeAvance: 250, totalActividades: 3, actividadesEjecutadas: 9, actividadesPendientes: 0 }])
    .indexOf('width:100.0%') >= 0);

// ── 2. Gestión de Peligros · Cumplimiento por área ────────────────────────────
const peligros = dibujar('GestionPeligrosHome', 'modules/gestion-peligros/gestion-peligros-home.js',
  'kair-chart-peligros', 'renderChartPeligros',
  [{ inspecciones: { total: 24, realizadas: 18 }, mantenimiento: { total: 12, completados: 3 }, peligros: { total: 60, evaluados: 60 }, mediciones: { total: 0, realizadas: 0 } }]);
const filasPeligros = filasDe(peligros);
check('Peligros: 4 filas (Inspecciones · Mantenimiento · Peligros · Mediciones)', filasPeligros.length === 4,
  'filas=' + filasPeligros.length);
check('Peligros: cada fila muestra su valor y su total',
  valorDe(filasPeligros[0]) === '18 / 24' && valorDe(filasPeligros[2]) === '60 / 60',
  valorDe(filasPeligros[0]) + ' | ' + valorDe(filasPeligros[2]));
check('Peligros: los porcentajes son reales (18/24 = 75%, 3/12 = 25%)',
  Math.abs(anchoDe(filasPeligros[0]) - 75) < 0.6 && Math.abs(anchoDe(filasPeligros[1]) - 25) < 0.6,
  anchoDe(filasPeligros[0]) + '% | ' + anchoDe(filasPeligros[1]) + '%');
check('Peligros: sin datos (0 de 0) la barra no queda invisible ni negativa',
  anchoDe(filasPeligros[3]) === 0, 'ancho=' + anchoDe(filasPeligros[3]));
check('Peligros: cada fila usa su color propio (azul, verde, ámbar, rojo)',
  peligros.indexOf('--kair-blue') > 0 && peligros.indexOf('--kair-mint') > 0 &&
  peligros.indexOf('--kair-amber') > 0 && peligros.indexOf('--kair-red') > 0);
check('Peligros: sin dibujo estirado ni texto dentro del gráfico',
  peligros.indexOf('<svg') < 0 && peligros.indexOf('<text') < 0);

// ── 3. Gestión de la Salud · Indicadores ─────────────────────────────────────
const salud = dibujar('GestionSaludHome', 'modules/gestion-salud/gestion-salud-home.js',
  'kair-chart-salud', 'renderChartSalud',
  [{ frecuencia: 12.45, severidad: 6.2, prevalencia: 3.1, incidencia: 1.55 }]);
const filasSalud = filasDe(salud);
check('Salud: 4 filas (Frecuencia · Severidad · Prevalencia · Incidencia)', filasSalud.length === 4,
  'filas=' + filasSalud.length);
check('Salud: los valores salen con 2 decimales',
  valorDe(filasSalud[0]) === '12.45' && valorDe(filasSalud[3]) === '1.55',
  valorDe(filasSalud[0]) + ' | ' + valorDe(filasSalud[3]));
check('Salud: la barra más alta llega al 100% y las demás en proporción',
  Math.abs(anchoDe(filasSalud[0]) - 100) < 0.6 && Math.abs(anchoDe(filasSalud[1]) - 49.8) < 1,
  anchoDe(filasSalud[0]) + '% | ' + anchoDe(filasSalud[1]) + '%');
check('Salud: sin dibujo estirado ni texto dentro del gráfico',
  salud.indexOf('<svg') < 0 && salud.indexOf('<text') < 0);
check('Salud: valores en 0 no rompen el dibujo',
  filasDe(dibujarAislado('modules/gestion-salud/gestion-salud-home.js', 'GestionSaludHome',
    'kair-chart-salud', 'renderChartSalud', [{}])).length === 4);

// ── 4. Gestión de Amenazas · Cobertura documental ────────────────────────────
const amenazas = dibujar('GestionAmenazasHome', 'modules/gestion-amenazas/gestion-amenazas-home.js',
  null, 'renderChartAmenazas', [{ '1.1.1': { archivos: 10 }, '1.1.2': { archivos: 0 }, '1.1.3': { archivos: 0 }, '1.1.4': { archivos: 0 }, '1.1.5': { archivos: 0 } }]);
const filasAmenazas = filasDe(amenazas);
check('Amenazas: una fila por submódulo (5)', filasAmenazas.length === 5, 'filas=' + filasAmenazas.length);
check('Amenazas: el submódulo sin archivos lo dice (0 archivos) y no dibuja barra',
  valorDe(filasAmenazas[1]) === '0 archivos' && anchoDe(filasAmenazas[1]) === 0,
  valorDe(filasAmenazas[1]) + ' | ' + anchoDe(filasAmenazas[1]));
check('Amenazas: el submódulo con más archivos llega al 100%',
  Math.abs(anchoDe(filasAmenazas[0]) - 100) < 0.6, 'ancho=' + anchoDe(filasAmenazas[0]));
check('Amenazas: sin dibujo estirado ni texto dentro del gráfico',
  amenazas.indexOf('<svg') < 0 && amenazas.indexOf('<text') < 0);

// ── 5. Mejoramiento · Acciones por estado ────────────────────────────────────
const mejoramiento = dibujar('MejoramientoHome', 'modules/mejoramiento/mejoramiento-home.js',
  null, 'renderChartMejoramiento', [6, 4, 21, 2]);
const filasMejoramiento = filasDe(mejoramiento);
check('Mejoramiento: 4 filas (Abiertas · En proceso · Cerradas · Vencidas)',
  filasMejoramiento.length === 4, 'filas=' + filasMejoramiento.length);
check('Mejoramiento: muestra el valor y su porcentaje del total',
  valorDe(filasMejoramiento[2]) === '21 (64%)', 'valor=' + valorDe(filasMejoramiento[2]));
check('Mejoramiento: sin dibujo estirado ni texto dentro del gráfico',
  mejoramiento.indexOf('<svg') < 0 && mejoramiento.indexOf('<text') < 0);

// ── 6. Verificación · Cumplimiento por submódulo ─────────────────────────────
const verificacion = dibujar('VerificacionHome', 'modules/verificacion/verificacion-home.js',
  null, 'renderChartVerificacion',
  [[{ code: '4.1.1', completados: 8, total: 10 }, { code: '4.1.2', completados: 3, total: 12 },
    { code: '4.1.3', completados: 15, total: 15 }, { code: '4.1.4', completados: 1, total: 9 }]]);
const filasVerificacion = filasDe(verificacion);
check('Verificación: una fila por submódulo (4)', filasVerificacion.length === 4, 'filas=' + filasVerificacion.length);
check('Verificación: muestra completados/total y el porcentaje',
  valorDe(filasVerificacion[0]) === '8/10 (80%)', 'valor=' + valorDe(filasVerificacion[0]));
check('Verificación: sin dibujo estirado ni texto dentro del gráfico',
  verificacion.indexOf('<svg') < 0 && verificacion.indexOf('<text') < 0);

// ── 7. Recursos · Ejecución presupuestal (gráfico de líneas) ─────────────────
const recursos = dibujar('RecursosHome', 'modules/recursos/recursos-home.js',
  'kair-chart-presupuesto', 'renderChartPresupuesto',
  [{ planeado: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120], ejecutado: [5, 25, 20, 55, 40, 75, 60, 90, 70, 105, 95, 115] }]);
check('Recursos: el dibujo de líneas ya no se estira (sin preserveAspectRatio="none")',
  recursos.indexOf('preserveAspectRatio') < 0);
check('Recursos: los 12 meses son texto normal debajo del dibujo, no parte del dibujo',
  /kair-bar-chart__months/.test(recursos) && (recursos.match(/<span>(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)<\/span>/g) || []).length === 12 &&
  recursos.indexOf('<text') < 0);
check('Recursos: el dibujo en sí sigue existiendo (planeado punteado + ejecutado sólido)',
  (recursos.match(/<path /g) || []).length === 3);

// ── 8. Las reglas CSS que hacen que nada se pise ─────────────────────────────
const css = fs.readFileSync(path.join(root, 'shared', 'kair-components.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
function regla(sel) {
  const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
}
const fila = regla('.kair-bar-chart__row');
check('CSS: la fila es una rejilla (label | barra | valor) → las 3 cajas no se pisan',
  /display:\s*grid/.test(fila) && /grid-template-columns:\s*minmax\(64px, 0\.85fr\) minmax\(64px, 2\.4fr\) max-content/.test(fila));
check('CSS: la etiqueta y el valor nunca se parten en dos líneas',
  /white-space:\s*nowrap/.test(regla('.kair-bar-chart__label')) &&
  /white-space:\s*nowrap/.test(regla('.kair-bar-chart__value')));
check('CSS: el valor queda alineado a la derecha y con números de ancho fijo',
  /text-align:\s*right/.test(regla('.kair-bar-chart__value')) &&
  /tabular-nums/.test(regla('.kair-bar-chart__value')));
check('CSS: la barra tiene alto propio (no depende del texto)',
  /height:\s*clamp\(16px, 1\.7vw, 22px\)/.test(regla('.kair-bar-chart__track')));
check('CSS: la caja del gráfico de barras ya no tiene un alto fijo que lo aplaste',
  /height:\s*auto/.test(regla('.kair-chart--flow')));
check('CSS: la caja del gráfico recorta como red de seguridad',
  /overflow:\s*hidden/.test(regla('.kair-chart')));

// ── Reporte ──────────────────────────────────────────────────────────────────
let failed = 0;
checks.forEach(function (c) {
  if (c.ok) { console.log('[OK  ] ' + c.name); }
  else { failed++; console.log('[FAIL] ' + c.name + (c.extra ? ' → ' + c.extra : '')); }
});
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
if (failed) { console.log('❌ ' + failed + ' checks FALLARON'); process.exit(1); }
console.log('✅ Los gráficos se dibujan proporcionados y sin texto encimado');
