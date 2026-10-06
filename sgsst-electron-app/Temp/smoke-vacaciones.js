// Temp/smoke-vacaciones.js
// Verifica estructura del módulo Vacaciones
const fs = require('fs');
const path = require('path');

const root = 'C:\\Proyectos de programación\\SG-SST-E\\sgsst-electron-app';
const jsPath   = path.join(root, 'modules', 'gestion-humana', 'vacaciones', 'index.js');
const htmlPath = path.join(root, 'modules', 'gestion-humana', 'vacaciones', 'index.html');
const cssPath  = path.join(root, 'modules', 'gestion-humana', 'vacaciones', 'index.css');

// Mock del entorno browser
global.window = {
  VacacionesComponent: null,
  GHKPIBar: { render: (el, kpis) => { el._lastRender = kpis; } },
  KAIRToast: { show: (msg, type) => console.log('[TOAST]', type || 'info', msg) },
  parent: undefined
};
global.document = {
  body: { appendChild: () => {} },
  createElement: (tag) => ({
    tagName: tag,
    innerHTML: '',
    firstChild: null,
    setAttribute: () => {},
    classList: { toggle: () => {} },
    style: {},
    appendChild: () => {},
    addEventListener: () => {}
  })
};
global.fetch = async () => { throw new Error('mock fetch fail'); };

const code = fs.readFileSync(jsPath, 'utf8');
eval(code);

console.log('✅ JS cargado sin throw');
console.log('   window.VacacionesComponent:', typeof global.window.VacacionesComponent);
const Comp = global.window.VacacionesComponent;

const html = fs.readFileSync(htmlPath, 'utf8');
const htmlChecks = [
  { re: /va-kpi-bar/,          label: 'KPI bar container' },
  { re: /va-listado-mes/,      label: 'Listado Mensual btn' },
  { re: /va-solicitar/,        label: 'Solicitar btn' },
  { re: /va-tabs/,             label: 'Tabs container' },
  { re: /va-table-wrap/,       label: 'Table wrap' },
  { re: /Flujo de Vacaciones/, label: 'Info box "Flujo de Vacaciones"' }
];
console.log('\n📄 HTML checks:');
htmlChecks.forEach(c => console.log('  ' + (c.re.test(html) ? '✅' : '❌') + ' ' + c.label));

const css = fs.readFileSync(cssPath, 'utf8');
const cssChecks = [
  { re: /\.va-info-box/,         label: 'Info box' },
  { re: /\.va-cliente-badge--pendiente/, label: 'Cliente badge pendiente' },
  { re: /\.va-cliente-badge--notificado/, label: 'Cliente badge notificado' },
  { re: /\.va-btn--icon\.success/, label: 'Success icon button' },
  { re: /\.va-btn--icon\.danger/,  label: 'Danger icon button' },
  { re: /\.va-btn--icon\.info/,    label: 'Info icon button' },
  { re: /\.va-modal-backdrop/,    label: 'Modal backdrop' }
];
console.log('\n🎨 CSS checks:');
cssChecks.forEach(c => console.log('  ' + (c.re.test(css) ? '✅' : '❌') + ' ' + c.label));

// Instanciar
const container = {
  innerHTML: '',
  querySelector: (sel) => {
    if (sel === '#va-kpi-bar') return { _lastRender: null };
    if (sel === '#va-tabs') return null;
    if (sel === '#va-table-wrap') return null;
    return { value: '', onclick: null, onchange: null, getAttribute: () => null, forEach: () => {} };
  },
  querySelectorAll: () => []
};
const inst = new Comp(container, 'TEMPOACTIVA EST S.A.S.', 'GH', 'vacaciones', null);
console.log('\n🧪 Instancia creada:', !!inst);

// KPIs con datos
inst.items = [
  { id: 'va-1', estado: 'solicitada', diasSolicitados: 8, fechaInicio: '2026-08-01', fechaFin: '2026-08-08', trabajadorId: 'bp-1', clienteNotificado: 0 },
  { id: 'va-2', estado: 'solicitada', diasSolicitados: 8, fechaInicio: '2026-08-15', fechaFin: '2026-08-22', trabajadorId: 'bp-2', clienteNotificado: 0 },
  { id: 'va-3', estado: 'aprobada',   diasSolicitados: 8, fechaInicio: '2026-08-14', fechaFin: '2026-08-21', trabajadorId: 'bp-3', clienteNotificado: 0 },
  { id: 'va-4', estado: 'aprobada',   diasSolicitados: 8, fechaInicio: '2026-08-21', fechaFin: '2026-08-28', trabajadorId: 'bp-4', clienteNotificado: 0 },
  { id: 'va-5', estado: 'disfrutada', diasSolicitados: 8, fechaInicio: '2026-07-17', fechaFin: '2026-07-24', trabajadorId: 'bp-5', clienteNotificado: 1 },
  { id: 'va-6', estado: 'disfrutada', diasSolicitados: 8, fechaInicio: '2026-07-24', fechaFin: '2026-07-31', trabajadorId: 'bp-6', clienteNotificado: 1 },
  { id: 'va-7', estado: 'disfrutada', diasSolicitados: 8, fechaInicio: '2026-07-31', fechaFin: '2026-08-07', trabajadorId: 'bp-7', clienteNotificado: 1 },
  { id: 'va-8', estado: 'disfrutada', diasSolicitados: 8, fechaInicio: '2026-08-07', fechaFin: '2026-08-14', trabajadorId: 'bp-8', clienteNotificado: 1 }
];
const k = inst._kpis();
console.log('\n📊 KPIs con 8 vacaciones (2 solicitadas, 2 aprobadas, 4 disfrutadas):');
console.log('   pendientes:', k.pendientes, '(esperado 2)');
console.log('   aprobadas:', k.aprobadas, '(esperado 2)');
console.log('   disfrutadas:', k.disfrutadas, '(esperado 4)');
console.log('   porNotificar:', k.porNotificar, '(esperado 2 — ambas aprobadas con clienteNotificado=0)');

// Count por estado (tabs)
console.log('\n🗂️ Tabs:');
console.log('   Todas:', inst._countByEstado('todas'), '(esperado 8)');
console.log('   Solicitada:', inst._countByEstado('solicitada'), '(esperado 2)');
console.log('   Aprobada:', inst._countByEstado('aprobada'), '(esperado 2)');
console.log('   Rechazada:', inst._countByEstado('rechazada'), '(esperado 0)');
console.log('   Disfrutada:', inst._countByEstado('disfrutada'), '(esperado 4)');

// Helpers
console.log('\n🛠️ Helpers:');
console.log('   _fmtDate("2026-08-14"):', inst._fmtDate('2026-08-14'));
console.log('   _isoToInputDate("2026-08-14T00:00:00.000Z"):', inst._isoToInputDate('2026-08-14T00:00:00.000Z'));
console.log('   _diffDias("2026-08-14", "2026-08-21"):', inst._diffDias('2026-08-14', '2026-08-21'), '(esperado 8)');

console.log('\n✅ Smoke test OK');
