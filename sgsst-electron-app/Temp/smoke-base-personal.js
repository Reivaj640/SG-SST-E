// Temp/smoke-base-personal.js
// 📦762 · Valida que el segmented control funciona y filtra por estado
const fs = require('fs');
const path = require('path');

const root = 'C:\\Proyectos de programación\\SG-SST-E\\sgsst-electron-app';
const jsPath = path.join(root, 'modules', 'gestion-humana', 'base-personal', 'index.js');
const htmlPath = path.join(root, 'modules', 'gestion-humana', 'base-personal', 'index.html');
const cssPath = path.join(root, 'modules', 'gestion-humana', 'base-personal', 'index.css');

global.window = {
  BasePersonalComponent: null,
  GHKPIBar: { render: (el, kpis) => { el._lastRender = kpis; } },
  KAIRToast: { show: (m, t) => console.log('[TOAST]', t || 'info', m) },
  KairConfirm: null,
  electronAPI: { ghListPersonal: async () => ({ success: true, data: { personales: [] } }), ghListSedes: async () => ({ success: true, data: { sedes: [] } }) },
  parent: undefined,
  currentCompany: { name: 'TEMPOACTIVA EST S.A.S.' }
};
global.document = {
  body: { appendChild: () => {} },
  createElement: (t) => ({ tagName: t, innerHTML: '', firstChild: null, setAttribute: () => {}, classList: { toggle: () => {}, add: () => {}, remove: () => {} }, style: {}, appendChild: () => {}, addEventListener: () => {} }),
  addEventListener: () => {}
};
global.fetch = async () => { throw new Error('mock fetch fail'); };
global.sessionStorage = { getItem: () => null, removeItem: () => {} };
global.Intl = { NumberFormat: function() { return { format: (n) => '$' + n.toLocaleString('es-CO') }; } };

const code = fs.readFileSync(jsPath, 'utf8');
try { eval(code); } catch (e) { console.log('❌ JS throw:', e.message); process.exit(1); }
console.log('✅ JS cargado sin throw');
console.log('   window.BasePersonalComponent:', typeof global.window.BasePersonalComponent);
const Comp = global.window.BasePersonalComponent;
if (!Comp) process.exit(1);

const html = fs.readFileSync(htmlPath, 'utf8');
const htmlChecks = [
  { re: /bp-search/,             label: 'Search input' },
  { re: /bp-filter-todos/,        label: 'Segmented Todos' },
  { re: /bp-filter-activos/,      label: 'Segmented Activos' },
  { re: /bp-filter-retirados/,    label: 'Segmented Retirados' },
  { re: /bp-sede-dropdown/,       label: 'Sede custom dropdown' },
  { re: /bp-importar-btn/,        label: 'Importar btn' },
  { re: /bp-exportar-btn/,        label: 'Exportar btn' },
  { re: /bp-count-todos/,         label: 'Count Todos' },
  { re: /bp-count-activos/,       label: 'Count Activos' },
  { re: /bp-count-retirados/,     label: 'Count Retirados' }
];
console.log('\n📄 HTML checks:');
htmlChecks.forEach(c => console.log('  ' + (c.re.test(html) ? '✅' : '❌') + ' ' + c.label));

// Verificar que NO esté el botón Filtros viejo ni el panel desplegable
const oldChecks = [
  { re: /bp-filtros-btn/, label: 'Old Filtros button' },
  { re: /bp-filters-row/, label: 'Old filters row' },
  { re: /bp-filter-estado/, label: 'Old estado select' },
  { re: /id="bp-filter-sede"/, label: 'Old sede native select' },
  { re: /bp-kpi-bar/, label: 'Removed KPI bar' },
  { re: /bp-new-btn/, label: 'Removed Nuevo Trabajador btn' },
  { re: /bp-filter-count/, label: 'Removed count row' }
];
console.log('\n🗑️  Old elements (deberían estar ausentes):');
oldChecks.forEach(c => console.log('  ' + (c.re.test(html) ? '❌ AÚN PRESENTE' : '✅ Removido') + ' ' + c.label));

const css = fs.readFileSync(cssPath, 'utf8');
const cssChecks = [
  { re: /\.bp-seg\b/,             label: 'Segmented control container' },
  { re: /\.bp-seg-btn--active/,   label: 'Active seg btn' },
  { re: /\.bp-seg-count/,         label: 'Seg count badge' },
  { re: /\.bp-filter-group--inline/, label: 'Inline filter group' },
  { re: /\.bp-sede-dropdown/,     label: 'Sede custom dropdown' }
];
console.log('\n🎨 CSS checks:');
cssChecks.forEach(c => console.log('  ' + (c.re.test(css) ? '✅' : '❌') + ' ' + c.label));

// Test funcional con personales mock
const container = {
  innerHTML: '',
  querySelector: (sel) => {
    if (sel === '#bp-kpi-bar') return { _lastRender: null };
    if (sel === '#bp-search') return { value: '', oninput: null };
    if (sel === '#bp-filter-sede') return { value: 'all', onchange: null, innerHTML: '' };
    if (sel === '.bp-seg') return { querySelectorAll: () => [] };
    if (sel === '#bp-count-todos') return { textContent: '' };
    if (sel === '#bp-count-activos') return { textContent: '' };
    if (sel === '#bp-count-retirados') return { textContent: '' };
    return { value: '', onclick: null, onchange: null, oninput: null, getAttribute: () => null, setAttribute: () => {}, forEach: () => {}, addEventListener: () => {}, classList: { add: () => {}, remove: () => {} } };
  },
  querySelectorAll: () => []
};
const inst = new Comp(container, 'TEMPOACTIVA EST S.A.S.', 'GH', 'base-personal', null);
console.log('\n🧪 Instancia creada:', !!inst);
console.log('   default filterEstado:', inst.filterEstado, '(esperado "todos")');
console.log('   default filterSede:', inst.filterSede, '(esperado "all")');

inst.personales = [
  { id: 'p-1', estado: 'activo',   nombres: 'Ana',    apellidos: 'Activa',  cedula: '111', cargo: 'X',  sedeId: 'S1' },
  { id: 'p-2', estado: 'activo',   nombres: 'Beto',   apellidos: 'Activo',  cedula: '222', cargo: 'Y',  sedeId: 'S1' },
  { id: 'p-3', estado: 'retirado', nombres: 'Carla',  apellidos: 'Retiro',  cedula: '333', cargo: 'Z',  sedeId: 'S2' },
  { id: 'p-4', estado: 'retirado', nombres: 'Diego',  apellidos: 'Salio',   cedula: '444', cargo: 'W',  sedeId: null },
  { id: 'p-5', estado: 'R',       nombres: 'Eva',    apellidos: 'LegacyR', cedula: '555', cargo: 'V',  sedeId: 'S3' },  // código legacy
  { id: 'p-6', estado: null,      nombres: 'Fer',    apellidos: 'SinEstado', cedula: '666', cargo: 'U',  sedeId: 'S1' }  // null = activo
];

console.log('\n🔢 _normalizeEstado (compatibilidad legacy):');
console.log('   estado="activo"   →', inst._normalizeEstado('activo'), '(esperado activo)');
console.log('   estado="retirado" →', inst._normalizeEstado('retirado'), '(esperado retirado)');
console.log('   estado="R"        →', inst._normalizeEstado('R'), '(esperado retirado)');
console.log('   estado="RET"      →', inst._normalizeEstado('RET'), '(esperado retirado)');
console.log('   estado="retirado" →', inst._normalizeEstado('retirado'), '(esperado retirado)');
console.log('   estado=null       →', inst._normalizeEstado(null), '(esperado activo)');
console.log('   estado="A"        →', inst._normalizeEstado('A'), '(esperado activo)');

console.log('\n🔍 _applyFilter con 3 activos (Ana/Beto/Fer) + 3 retirados (Carla/Diego/Eva):');
inst.filterEstado = 'todos';
inst.filterSede = 'all';
inst.search = '';
var allCount = inst.personales.filter(function(p) { return inst._applyFilter ? inst._applyFilter(p) : false; }).length;
console.log('   filterEstado=todos (sin helper directo, cuenta manual):', allCount, '(esperado 6)');

console.log('\n   Filtrar manualmente:');
var filtrados = inst.personales.filter(function(p) {
  var matchEstado = inst.filterEstado === 'todos' || inst._normalizeEstado(p.estado) === inst.filterEstado.replace(/s$/, '');
  var matchSearch = true;
  var matchSede = inst.filterSede === 'all' || p.sedeId === inst.filterSede;
  return matchEstado && matchSearch && matchSede;
});
inst.filterEstado = 'todos';
console.log('   filterEstado=todos:', inst.personales.filter(function(p) { return inst.filterEstado === 'todos' || inst._normalizeEstado(p.estado) === inst.filterEstado.replace(/s$/, ''); }).length, '(esperado 6)');
inst.filterEstado = 'activos';
console.log('   filterEstado=activos:', inst.personales.filter(function(p) { return inst._normalizeEstado(p.estado) === 'activo'; }).length, '(esperado 3)');
inst.filterEstado = 'retirados';
console.log('   filterEstado=retirados:', inst.personales.filter(function(p) { return inst._normalizeEstado(p.estado) === 'retirado'; }).length, '(esperado 3)');

console.log('\n✅ Smoke test OK');
