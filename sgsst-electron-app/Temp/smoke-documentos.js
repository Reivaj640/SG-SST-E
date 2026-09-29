// Temp/smoke-documentos.js
// 📦763 · Valida que el componente Documentos carga con los 2 nuevos modales
const fs = require('fs');
const path = require('path');

const root = 'C:\\Proyectos de programación\\SG-SST-E\\sgsst-electron-app';
const jsPath   = path.join(root, 'modules', 'gestion-humana', 'documentos', 'index.js');
const htmlPath = path.join(root, 'modules', 'gestion-humana', 'documentos', 'index.html');
const cssPath  = path.join(root, 'modules', 'gestion-humana', 'documentos', 'index.css');

global.window = {
  DocumentosComponent: null,
  GHKPIBar: { render: (el, kpis) => { el._lastRender = kpis; } },
  KAIRToast: { show: (m, t) => console.log('[TOAST]', t || 'info', m) },
  KairConfirm: null,
  parent: undefined,
  currentCompany: { name: 'TEMPOACTIVA EST S.A.S.' },
  devicePixelRatio: 1
};
global.document = {
  body: { appendChild: () => {}, style: {} },
  createElement: (t) => ({ tagName: t, innerHTML: '', firstChild: null, setAttribute: () => {}, classList: { toggle: () => {}, add: () => {}, remove: () => {} }, style: {}, appendChild: () => {}, addEventListener: () => {}, getContext: () => ({ scale: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fillRect: () => {}, fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '' }), toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=', getBoundingClientRect: () => ({ left: 0, top: 0, right: 600, bottom: 200, width: 600, height: 200 }), clientWidth: 600, clientHeight: 200, width: 600, height: 200 }),
  addEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => []
};
global.fetch = async () => { throw new Error('mock fetch fail'); };
global.Intl = { NumberFormat: function() { return { format: (n) => '$' + n }; } };

const code = fs.readFileSync(jsPath, 'utf8');
try { eval(code); } catch (e) { console.log('❌ JS throw:', e.message, '\n' + e.stack); process.exit(1); }
console.log('✅ JS cargado sin throw');
console.log('   window.DocumentosComponent:', typeof global.window.DocumentosComponent);
const Comp = global.window.DocumentosComponent;
if (!Comp) process.exit(1);

const html = fs.readFileSync(htmlPath, 'utf8');
const htmlChecks = [
  { re: /doc-kpi-bar/,          label: 'KPI bar container' },
  { re: /doc-generar-btn|doc-generar/,  label: 'Generar button' },
  { re: /doc-generar-modal/,    label: 'Modal Generar' },
  { re: /doc-gen-trabajador/,   label: 'Modal: Trabajador select' },
  { re: /doc-gen-tipos/,        label: 'Modal: Tipos wrapper' },
  { re: /doc-gen-confirm/,      label: 'Modal: Generar y Firmar button' },
  { re: /doc-firma-modal/,      label: 'Modal Firma' },
  { re: /doc-firma-canvas/,     label: 'Canvas firma' },
  { re: /doc-firma-confirm/,    label: 'Firma: Guardar button' },
  { re: /doc-firma-limpiar/,    label: 'Firma: Limpiar button' }
];
console.log('\n📄 HTML checks:');
htmlChecks.forEach(c => console.log('  ' + (c.re.test(html) ? '✅' : '❌') + ' ' + c.label));

const css = fs.readFileSync(cssPath, 'utf8');
const cssChecks = [
  { re: /\.doc-modal\b/,                label: 'Modal container' },
  { re: /\.doc-modal__backdrop/,        label: 'Modal backdrop' },
  { re: /\.doc-modal__panel--generar/,  label: 'Generar panel' },
  { re: /\.doc-modal__panel--firma/,    label: 'Firma panel' },
  { re: /\.doc-gen-tipo\b/,             label: 'Tipo card' },
  { re: /\.doc-gen-tipo--selected/,     label: 'Tipo card selected' },
  { re: /\.doc-firma__canvas-wrap/,     label: 'Firma canvas wrap' },
  { re: /\.doc-firma__canvas\b/,        label: 'Firma canvas style' },
  { re: /\.doc-firma__placeholder/,     label: 'Firma placeholder' },
  { re: /\.doc-firma__meta/,            label: 'Firma meta info' },
  { re: /\.doc-field__select/,          label: 'Field select' }
];
console.log('\n🎨 CSS checks:');
cssChecks.forEach(c => console.log('  ' + (c.re.test(css) ? '✅' : '❌') + ' ' + c.label));

// Instancia el componente
const container = {
  innerHTML: '',
  querySelector: (sel) => {
    if (sel === '#doc-kpi-bar') return { _lastRender: null };
    if (sel === '#doc-generar-modal' || sel === '#doc-firma-modal') return {
      setAttribute: () => {}, removeAttribute: () => {}, querySelector: () => null, querySelectorAll: () => []
    };
    if (sel === '.doc-modal__backdrop') return { onclick: null };
    return { value: '', onclick: null, onchange: null, oninput: null, innerHTML: '', setAttribute: () => {}, querySelector: () => null, querySelectorAll: () => [] };
  },
  querySelectorAll: () => []
};
const inst = new Comp(container, 'TEMPOACTIVA EST S.A.S.', 'GH', 'documentos', null);
console.log('\n🧪 Instancia creada:', !!inst);

// Verificar TIPOS
console.log('\n📋 TIPOS de documentos (7 esperados):');
const tipos = Comp.TIPOS;
console.log('   total:', tipos.length, '(esperado 7)');
tipos.forEach(function(t) {
  console.log('   -', t.value, '·', t.label);
});

// Verificar KPIs
inst.items = [
  { id: 'd-1', estado: 'firmado',   tipo: 'autorizacion_datos' },
  { id: 'd-2', estado: 'pendiente', tipo: 'contrato' },
  { id: 'd-3', estado: 'firmado',   tipo: 'induccion' }
];
var k = inst._kpis();
console.log('\n📊 KPIs:');
console.log('   total:', k.total, '(esperado 3)');
console.log('   firmados:', k.firmados, '(esperado 2)');
console.log('   pendientes:', k.pendientes, '(esperado 1)');
console.log('   tiposDisponibles:', k.tiposDisponibles, '(esperado 7)');

console.log('\n✅ Smoke test OK');
