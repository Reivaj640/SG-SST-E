// Temp/smoke-contratacion.js
// Verifica que el módulo de Contratación se cargue sin errores y que el HTML
// fallback sea correcto cuando fetch falla. Mock básico de window/electronAPI.
const fs = require('fs');
const path = require('path');

const root = 'C:\\Proyectos de programación\\SG-SST-E\\sgsst-electron-app';
const jsPath = path.join(root, 'modules', 'gestion-humana', 'contratacion', 'index.js');
const htmlPath = path.join(root, 'modules', 'gestion-humana', 'contratacion', 'index.html');
const cssPath = path.join(root, 'modules', 'gestion-humana', 'contratacion', 'index.css');

// Mock del entorno browser
global.window = {
  ContratacionComponent: null,
  GHKPIBar: { render: (el, kpis) => { el._lastRender = kpis; } },
  KAIRToast: { show: (msg, type) => console.log('[TOAST]', type || 'info', msg) },
  KairConfirm: null,
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
    appendChild: () => {}
  })
};
global.fetch = async () => { throw new Error('mock fetch fail'); };

// Cargar el módulo (lo expone a window.ContratacionComponent)
const code = fs.readFileSync(jsPath, 'utf8');
eval(code);

console.log('✅ JS cargado sin throw');
console.log('   window.ContratacionComponent:', typeof global.window.ContratacionComponent);

const Comp = global.window.ContratacionComponent;
console.log('   PASOS count:', Comp.PASOS.length);
console.log('   PASOS labels:', Comp.PASOS.map(p => p.label).join(' → '));

// Verificar HTML
const html = fs.readFileSync(htmlPath, 'utf8');
const checks = [
  { re: /ct-kpi-bar/,         label: 'KPI bar container' },
  { re: /ct-new-btn/,         label: 'New button' },
  { re: /ct-en-proceso/,      label: 'En Proceso grid' },
  { re: /ct-completados/,     label: 'Completados list' },
  { re: /Procesos de Contratación/, label: 'Section title' }
];
console.log('\n📄 HTML checks:');
checks.forEach(c => console.log('  ' + (c.re.test(html) ? '✅' : '❌') + ' ' + c.label));

// Verificar CSS
const css = fs.readFileSync(cssPath, 'utf8');
const cssChecks = [
  { re: /\.ct-cards-grid/,     label: 'Cards grid' },
  { re: /\.ct-card--en_proceso/, label: 'En proceso card variant' },
  { re: /\.ct-step--done/,     label: 'Step done' },
  { re: /\.ct-step--current/,  label: 'Step current' },
  { re: /\.ct-modal-backdrop/, label: 'Modal backdrop' },
  { re: /\.ct-form-grid/,      label: 'Form grid' },
  { re: /\.ct-step__expand/,   label: 'Step expand' }
];
console.log('\n🎨 CSS checks:');
cssChecks.forEach(c => console.log('  ' + (c.re.test(css) ? '✅' : '❌') + ' ' + c.label));

// Test: instanciar con mock container
const container = {
  innerHTML: '',
  querySelector: (sel) => {
    if (sel === '#ct-kpi-bar') return { _lastRender: null };
    if (sel === '#ct-en-proceso') return { _content: '' };
    if (sel === '#ct-completados') return { _content: '' };
    return { value: '', onclick: null, oninput: null, onchange: null, getAttribute: () => null, forEach: () => {} };
  },
  querySelectorAll: () => []
};
const inst = new Comp(container, 'TEMPOACTIVA EST S.A.S.', 'GH', 'contratacion', null);
console.log('\n🧪 Instancia creada:', !!inst);
console.log('   _kpis() con 0 contrataciones:', JSON.stringify({
  total: inst._kpis().total,
  enProceso: inst._kpis().enProceso,
  completados: inst._kpis().completados
}));

// Test KPIs con datos
inst.contrataciones = [
  { id: 'ct-1', nombres: 'A', apellidos: 'B', cargo: 'X', estado: 'en_proceso', pasoActual: 1, fechaIngreso: new Date().toISOString() },
  { id: 'ct-2', nombres: 'C', apellidos: 'D', cargo: 'Y', estado: 'en_proceso', pasoActual: 3, fechaIngreso: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'ct-3', nombres: 'E', apellidos: 'F', cargo: 'Z', estado: 'completado', pasoActual: 6, fechaIngreso: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: 'ct-4', nombres: 'G', apellidos: 'H', cargo: 'W', estado: 'cancelado', pasoActual: 1, fechaIngreso: new Date(Date.now() - 86400000 * 60).toISOString() }
];
const k = inst._kpis();
console.log('\n📊 KPIs con 4 contrataciones (1 cancelado no cuenta):');
console.log('   total:', k.total, '(esperado 3)');
console.log('   enProceso:', k.enProceso, '(esperado 2)');
console.log('   completados:', k.completados, '(esperado 1)');
console.log('   estaSemana:', k.estaSemana, '(esperado 2 — ct-1 hoy + ct-2 hace 3 días)');

// Test helpers
console.log('\n🛠️ Helpers:');
console.log('   _initials("María José", "López"):', inst._initials('María José', 'López'));
console.log('   _fmtCurrency(1300000):', inst._fmtCurrency(1300000));
console.log('   _fmtDate("2026-08-14"):', inst._fmtDate('2026-08-14'));

// Test renderEnProcesoCard
const card = inst._renderEnProcesoCard(inst.contrataciones[1]);
console.log('\n🎴 Card render (length):', card.length, 'chars');
console.log('   contiene paso 3/6:', card.includes('Paso 3/6'));
console.log('   contiene "Exámenes Médicos":', card.includes('Exámenes Médicos'));
console.log('   contiene "50%":', card.includes('50%'));
console.log('   contiene avatar bg hsl:', card.includes('hsl('));

// Test renderPasos con contratación completa
const ctFull = {
  pasoActual: 4,
  memoRecibido: 1, memoFecha: '2026-08-10', memoNotas: 'OK',
  contactoRealizado: 1, contactoFecha: '2026-08-12',
  examenesProgramados: 1, examenesFecha: '2026-08-13', examenesIps: 'IPS Compensar',
  documentosFirmados: 0,
  afiliacionesCompletadas: 0,
  s400Activado: 0,
  estado: 'en_proceso'
};
const pasos = inst._renderPasos(ctFull);
console.log('\n📋 Pasos render (length):', pasos.length, 'chars');
console.log('   pasos done (ct-step--done):', (pasos.match(/ct-step--done/g) || []).length, '(esperado 3)');
console.log('   paso current (ct-step--current):', (pasos.match(/ct-step--current/g) || []).length, '(esperado 1)');
console.log('   contiene "Memo / Correo":', pasos.includes('Memo / Correo'));
console.log('   contiene "Firma de Documentos":', pasos.includes('Firma de Documentos'));

console.log('\n✅ Smoke test OK');
