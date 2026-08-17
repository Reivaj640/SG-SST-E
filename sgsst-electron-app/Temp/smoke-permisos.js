// Temp/smoke-permisos.js
// Verifica estructura del módulo Permisos y Estados
const fs = require('fs');
const path = require('path');

const root = 'C:\\Proyectos de programación\\SG-SST-E\\sgsst-electron-app';
const jsPath   = path.join(root, 'modules', 'gestion-humana', 'permisos', 'index.js');
const htmlPath = path.join(root, 'modules', 'gestion-humana', 'permisos', 'index.html');
const cssPath  = path.join(root, 'modules', 'gestion-humana', 'permisos', 'index.css');

global.window = {
  PermisosComponent: null,
  GHKPIBar: { render: (el, kpis) => { el._lastRender = kpis; } },
  KAIRToast: { show: (msg, type) => console.log('[TOAST]', type || 'info', msg) },
  parent: undefined
};
global.document = {
  body: { appendChild: () => {} },
  createElement: (tag) => ({
    tagName: tag, innerHTML: '', firstChild: null,
    setAttribute: () => {}, classList: { toggle: () => {} },
    style: {}, appendChild: () => {}, addEventListener: () => {}
  })
};
global.fetch = async () => { throw new Error('mock fetch fail'); };

const code = fs.readFileSync(jsPath, 'utf8');
eval(code);

console.log('✅ JS cargado sin throw');
console.log('   window.PermisosComponent:', typeof global.window.PermisosComponent);
const Comp = global.window.PermisosComponent;

console.log('\n📋 TIPOS catalog:');
console.log('   total:', Comp.TIPOS.length, '(esperado 8)');
Comp.TIPOS.forEach(function (t) {
  console.log('   - ' + t.value + ' / ' + t.label + ' / desc: "' + t.desc + '"');
});

const html = fs.readFileSync(htmlPath, 'utf8');
const htmlChecks = [
  { re: /pe-kpi-bar/,           label: 'KPI bar container' },
  { re: /pe-nuevo/,             label: 'New button' },
  { re: /pe-filtro-tipo/,       label: 'Filtro tipo' },
  { re: /pe-filtro-estado/,     label: 'Filtro estado' },
  { re: /pe-cards/,             label: 'Cards grid' },
  { re: /pe-tipos-info/,        label: 'Tipos info container' },
  { re: /Tipos de Permisos y Licencias/, label: 'Info box title' }
];
console.log('\n📄 HTML checks:');
htmlChecks.forEach(c => console.log('  ' + (c.re.test(html) ? '✅' : '❌') + ' ' + c.label));

const css = fs.readFileSync(cssPath, 'utf8');
const cssChecks = [
  { re: /\.pe-info-box/,         label: 'Info box' },
  { re: /\.pe-tipo-info/,        label: 'Tipo info card' },
  { re: /\.pe-btn--outline/,     label: 'Outline button' },
  { re: /\.pe-btn--full/,        label: 'Full width button' },
  { re: /\.pe-status--activo/,   label: 'Status activo' },
  { re: /\.pe-status--finalizado/, label: 'Status finalizado' },
  { re: /\.pe-status--prorrogado/, label: 'Status prorrogado' },
  { re: /\.pe-modal-backdrop/,   label: 'Modal backdrop' },
  { re: /@media \(max-width: 1200px\)/, label: 'Responsive grid' }
];
console.log('\n🎨 CSS checks:');
cssChecks.forEach(c => console.log('  ' + (c.re.test(css) ? '✅' : '❌') + ' ' + c.label));

const container = {
  innerHTML: '',
  querySelector: (sel) => {
    if (sel === '#pe-kpi-bar') return { _lastRender: null };
    if (sel === '#pe-tipos-info') return null;
    return { value: '', onclick: null, onchange: null, getAttribute: () => null, forEach: () => {} };
  },
  querySelectorAll: () => []
};
const inst = new Comp(container, 'TEMPOACTIVA EST S.A.S.', 'GH', 'permisos', null);
console.log('\n🧪 Instancia creada:', !!inst);

inst.items = [
  { id: 'p-1', tipo: 'cita_medica',      estado: 'finalizado', fechaInicio: '2026-08-07', fechaFin: '2026-08-08', dias: 1,  motivo: 'Cita médica especialista', soporteUrl: '/docs/x.pdf', notas: '' },
  { id: 'p-2', tipo: 'permiso_personal', estado: 'activo',     fechaInicio: '2026-08-13', fechaFin: '2026-08-15', dias: 2,  motivo: 'Trámite personal', soporteUrl: '', notas: '' },
  { id: 'p-3', tipo: 'paternidad',       estado: 'activo',     fechaInicio: '2026-08-05', fechaFin: '2026-08-19', dias: 14, motivo: 'Nacimiento de hijo', soporteUrl: '/docs/r.pdf', notas: '' },
  { id: 'p-4', tipo: 'luto',             estado: 'finalizado', fechaInicio: '2026-08-06', fechaFin: '2026-08-11', dias: 5,  motivo: 'Fallecimiento de familiar', soporteUrl: '/docs/r.pdf', notas: '' },
  { id: 'p-5', tipo: 'incapacidad',      estado: 'finalizado', fechaInicio: '2026-08-07', fechaFin: '2026-08-10', dias: 3,  motivo: 'Lumbalgia', soporteUrl: '/docs/r.pdf', notas: '' },
  { id: 'p-6', tipo: 'maternidad',       estado: 'activo',     fechaInicio: '2026-08-13', fechaFin: '2026-12-17', dias: 126, motivo: 'Licencia de maternidad', soporteUrl: '', notas: '' }
];
const k = inst._kpis();
console.log('\n📊 KPIs con 6 permisos (3 activos, 3 finalizados):');
console.log('   activos:', k.activos, '(esperado 3)');
console.log('   incapacidades:', k.incapacidades, '(esperado 0 — todas finalizadas)');
console.log('   maternidad:', k.maternidad, '(esperado 1)');
console.log('   paternidad:', k.paternidad, '(esperado 1)');
console.log('   luto:', k.luto, '(esperado 0 — finalizado)');

console.log('\n🔍 _filtered():');
console.log('   sin filtros:', inst._filtered().length, '(esperado 6)');
inst.filtroTipo = 'paternidad';
console.log('   tipo=paternidad:', inst._filtered().length, '(esperado 1)');
inst.filtroTipo = 'all'; inst.filtroEstado = 'activo';
console.log('   estado=activo:', inst._filtered().length, '(esperado 3)');
inst.filtroEstado = 'all';

const card = inst._renderCard(inst.items[0]);
console.log('\n🎴 Card render (length):', card.length, 'chars');
console.log('   contiene "Cita Médica":', card.includes('Cita Médica'));
console.log('   contiene "Finalizado":', card.includes('Finalizado'));
console.log('   contiene "Fecha inicio:":', card.includes('Fecha inicio:'));
console.log('   contiene "Motivo:":', card.includes('Motivo:'));
console.log('   contiene "Soporte:":', card.includes('Soporte:'));
console.log('   no contiene "Finalizar" (estado=finalizado):', !card.includes('Finalizar Permiso'));

const cardActivo = inst._renderCard(inst.items[1]);
console.log('\n🎴 Card activo:');
console.log('   contiene "Finalizar Permiso":', cardActivo.includes('Finalizar Permiso'));
console.log('   clase outline:', cardActivo.includes('pe-btn--outline'));

console.log('\n✅ Smoke test OK');
