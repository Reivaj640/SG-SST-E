// Temp/smoke-afiliaciones.js
const fs = require('fs');
const path = require('path');

const root = 'C:\\Proyectos de programación\\SG-SST-E\\sgsst-electron-app';
const jsPath   = path.join(root, 'modules', 'gestion-humana', 'afiliaciones', 'index.js');
const htmlPath = path.join(root, 'modules', 'gestion-humana', 'afiliaciones', 'index.html');
const cssPath  = path.join(root, 'modules', 'gestion-humana', 'afiliaciones', 'index.css');

global.window = {
  AfiliacionesComponent: null,
  GHKPIBar: { render: (el, kpis) => { el._lastRender = kpis; } },
  KAIRToast: { show: (m, t) => console.log('[TOAST]', t || 'info', m) },
  parent: undefined
};
global.document = {
  body: { appendChild: () => {} },
  createElement: (t) => ({ tagName: t, innerHTML: '', firstChild: null, setAttribute: () => {}, classList: { toggle: () => {} }, style: {}, appendChild: () => {}, addEventListener: () => {} })
};
global.fetch = async () => { throw new Error('mock fetch fail'); };

const code = fs.readFileSync(jsPath, 'utf8');
eval(code);

console.log('✅ JS cargado sin throw');
console.log('   window.AfiliacionesComponent:', typeof global.window.AfiliacionesComponent);
const Comp = global.window.AfiliacionesComponent;

const html = fs.readFileSync(htmlPath, 'utf8');
const htmlChecks = [
  { re: /af-kpi-bar/,            label: 'KPI bar container' },
  { re: /af-filter-todos/,        label: 'Filtro Todos' },
  { re: /af-filter-activos/,      label: 'Filtro Activos' },
  { re: /af-filter-retirados/,    label: 'Filtro Retirados' },
  { re: /af-search/,              label: 'Search input' },
  { re: /af-table-wrap/,          label: 'Table wrap' }
];
console.log('\n📄 HTML checks:');
htmlChecks.forEach(c => console.log('  ' + (c.re.test(html) ? '✅' : '❌') + ' ' + c.label));

const css = fs.readFileSync(cssPath, 'utf8');
const cssChecks = [
  { re: /\.af-seg\b/,                  label: 'Segmented control container' },
  { re: /\.af-seg-btn--active/,        label: 'Active seg btn' },
  { re: /\.af-seg-count/,              label: 'Seg count badge' },
  { re: /\.af-badge--ok/,               label: 'Badge OK' },
  { re: /\.af-row-action/,             label: 'Row action button' },
  { re: /\.af-modal-backdrop/,         label: 'Modal backdrop' },
  { re: /\.af-profile__avatar/,        label: 'Profile avatar' },
  { re: /\.af-affil-grid/,             label: 'Affiliations grid' }
];
console.log('\n🎨 CSS checks:');
cssChecks.forEach(c => console.log('  ' + (c.re.test(css) ? '✅' : '❌') + ' ' + c.label));

const container = {
  innerHTML: '',
  querySelector: (sel) => {
    if (sel === '#af-kpi-bar') return { _lastRender: null };
    return { value: '', onclick: null, onchange: null, oninput: null, getAttribute: () => null, forEach: () => {} };
  },
  querySelectorAll: () => []
};
const inst = new Comp(container, 'TEMPOACTIVA EST S.A.S.', 'GH', 'afiliaciones', null);
console.log('\n🧪 Instancia creada:', !!inst);

inst.personales = [
  { id: 'p-1', nombres: 'Carlos', apellidos: 'Beltrán',  estado: 'activo',    cedula: '14014064', cargo: 'Recepcionista',  sedeId: 'Comfamiliar Atlántico',  eps: 'Sura EPS',       epsFecha: '2022-11-04', pension: 'Colpensiones',   pensionFecha: '2024-08-07', arl: 'Bolívar',       arlFecha: '2026-04-04', cajaCompensacion: 'Cajacopi',     cajaFecha: '2026-04-04' },
  { id: 'p-2', nombres: 'Claudia', apellidos: 'Beltrán', estado: 'activo',    cedula: '14786623', cargo: 'Salvavidas',     sedeId: 'Sede Cartagena',          eps: 'Compensar',     epsFecha: '2023-04-02', pension: 'Colpensiones',   pensionFecha: '2022-06-02', arl: 'Colmena',       arlFecha: '2025-01-03', cajaCompensacion: 'Comfamiliar Atlántico', cajaFecha: '2023-01-09' },
  { id: 'p-3', nombres: 'Luz',    apellidos: 'Beltrán', estado: 'activo',    cedula: '13008817', cargo: 'Coordinador SST', sedeId: 'Sede Cartagena',         eps: 'Nueva EPS',      epsFecha: '2024-10-04', pension: 'Old Mutual',     pensionFecha: '2022-11-12', arl: 'Positiva',      arlFecha: '2026-01-27', cajaCompensacion: 'Cajacopi',     cajaFecha: '2023-10-11' },
  { id: 'p-4', nombres: 'Miguel', apellidos: 'Beltrán', estado: 'retirado',  cedula: '14307132', cargo: 'Salvavidas',     sedeId: 'Comfamiliar Atlántico',  eps: 'Sura EPS',       epsFecha: '2023-02-25', pension: 'Porvenir',       pensionFecha: '2023-01-16', arl: 'Positiva',      arlFecha: '2023-10-11', cajaCompensacion: 'Comfamiliar Atlántico', cajaFecha: '2023-06-06' },
  { id: 'p-5', nombres: 'Juan',   apellidos: 'Sin EPS', estado: 'retirado',  cedula: '11111111', cargo: 'Operario',        sedeId: 'Sede Principal',          eps: null,              pension: 'Porvenir',       pensionFecha: '2022-03-18', arl: 'Colmena',       arlFecha: '2023-04-03', cajaCompensacion: 'Comfenalco',    cajaFecha: '2023-09-18' }
];
const k = inst._kpis();
console.log('\n📊 KPIs con 5 personales (4 completos, 1 sin EPS):');
console.log('   completos:', k.completos, '(esperado 4)');
console.log('   sinEps:', k.sinEps, '(esperado 1)');
console.log('   sinPension:', k.sinPension, '(esperado 0)');
console.log('   sinArl:', k.sinArl, '(esperado 0)');
console.log('   sinCaja:', k.sinCaja, '(esperado 0)');

console.log('\n🔍 _filtered() con 3 activos + 2 retirados:');
inst.filter = 'todos';
console.log('   filter=todos:', inst._filtered().length, '(esperado 5)');
inst.filter = 'activos';
console.log('   filter=activos:', inst._filtered().length, '(esperado 3)');
inst.filter = 'retirados';
console.log('   filter=retirados:', inst._filtered().length, '(esperado 2)');
inst.filter = 'todos';
inst.search = 'beltrán';
console.log('   search=beltrán:', inst._filtered().length, '(esperado 4)');
inst.search = '';

console.log('\n🔢 _countByEstado():');
var c = inst._countByEstado();
console.log('   todos:', c.todos, '(esperado 5)');
console.log('   activos:', c.activos, '(esperado 3)');
console.log('   retirados:', c.retirados, '(esperado 2)');

const card = inst._renderRow(inst.personales[0]);
console.log('\n🎴 Card render (Carlos Beltrán completo):');
console.log('   length:', card.length, 'chars');
console.log('   contiene "Carlos":', card.includes('Carlos'));
console.log('   contiene "Sura EPS":', card.includes('Sura EPS'));
console.log('   contiene fecha 2022:', card.includes('2022'));
console.log('   contiene 4/4:', card.includes('4/4'));
console.log('   contiene "fa-eye":', card.includes('fa-eye'));
console.log('   data-ver:', /data-ver="[^"]+"/.test(card));

const cardIncompleto = inst._renderRow(inst.personales[4]);
console.log('\n🎴 Card incompleto (Juan Sin EPS):');
console.log('   contiene "Incompleto":', cardIncompleto.includes('Incompleto'));
console.log('   contiene "—":', cardIncompleto.includes('—'));

console.log('\n✅ Smoke test OK');
