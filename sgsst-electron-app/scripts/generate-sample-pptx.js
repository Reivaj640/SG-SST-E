// scripts/generate-sample-pptx.js
// Genera un PPTX de prueba con contenido SG-SST realista, usado por
// el botón temporal "Probar preview PPTX" en Bandeja Integrada durante
// la integración de @file-viewer/web.
//
// Uso:  node scripts/generate-sample-pptx.js
// Salida: assets/samples/sample-sgsst.pptx

const path = require('path');
const fs = require('fs');
const PptxGenJS = require('pptxgenjs');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'samples');
const OUT_FILE = path.join(OUT_DIR, 'sample-sgsst.pptx');

const COLOR_PRIMARY   = '1F4E79'; // azul corporativo oscuro
const COLOR_SECONDARY = '2E75B6'; // azul medio
const COLOR_ACCENT    = 'E07B00'; // naranja acento
const COLOR_LIGHT     = 'F2F2F2';
const COLOR_TEXT      = '262626';

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';   // 13.33 x 7.5 in
pptx.title  = 'SG-SST K+AIR — Presentación institucional';
pptx.author = 'K+AIR (sample)';
pptx.company = 'K+AIR / SGSST-E';
pptx.subject = 'Sistema de Gestión de Seguridad y Salud en el Trabajo';

// ===== Slide 1 — Portada =====
{
  const s = pptx.addSlide();
  s.background = { color: COLOR_PRIMARY };
  s.addShape('rect', { x: 0, y: 5.6, w: 13.33, h: 1.9, fill: { color: COLOR_ACCENT } });
  s.addText('SISTEMA DE GESTIÓN DE SEGURIDAD\nY SALUD EN EL TRABAJO', {
    x: 0.6, y: 1.4, w: 12.1, h: 2.2,
    fontSize: 40, fontFace: 'Calibri', bold: true, color: 'FFFFFF', align: 'left', valign: 'middle'
  });
  s.addText('Presentación institucional — sample K+AIR', {
    x: 0.6, y: 3.6, w: 12.1, h: 0.6,
    fontSize: 18, fontFace: 'Calibri', color: 'F2F2F2', align: 'left', valign: 'middle'
  });
  s.addText('Generada automáticamente · @file-viewer preview demo', {
    x: 0.6, y: 5.8, w: 12.1, h: 0.5,
    fontSize: 14, fontFace: 'Calibri', color: 'FFFFFF', italic: true
  });
  s.addText('Decreto 1072 de 2015 · Resolución 0312 de 2019', {
    x: 0.6, y: 6.3, w: 12.1, h: 0.4,
    fontSize: 12, fontFace: 'Calibri', color: 'FFFFFF'
  });
}

// ===== Slide 2 — Tabla de contenido =====
{
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: COLOR_PRIMARY } });
  s.addText('Contenido', { x: 0.5, y: 0, w: 12.5, h: 0.9, fontSize: 28, bold: true, color: 'FFFFFF', valign: 'middle' });
  const items = [
    '1. Marco legal y normativo',
    '2. Política de Seguridad y Salud en el Trabajo',
    '3. Objetivos del SG-SST',
    '4. Estructura organizacional',
    '5. Roles y responsabilidades',
    '6. Ciclo PHVA del sistema',
    '7. Indicadores de gestión',
    '8. Conclusiones'
  ];
  s.addText(items.map(t => ({ text: t, options: { breakLine: true, fontSize: 18, color: COLOR_TEXT, paraSpaceAfter: 6 } })),
    { x: 0.8, y: 1.4, w: 11.7, h: 5.6, valign: 'top' });
}

// ===== Slide 3 — Marco legal =====
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: COLOR_PRIMARY } });
  s.addText('1. Marco legal y normativo', { x: 0.5, y: 0, w: 12.5, h: 0.9, fontSize: 26, bold: true, color: 'FFFFFF', valign: 'middle' });

  const rows = [
    [{ text: 'Norma', options: { bold: true, color: 'FFFFFF', fill: { color: COLOR_SECONDARY } } },
     { text: 'Objeto', options: { bold: true, color: 'FFFFFF', fill: { color: COLOR_SECONDARY } } },
     { text: 'Año', options: { bold: true, color: 'FFFFFF', fill: { color: COLOR_SECONDARY } } }],
    ['Decreto 1072', 'Decreto Único Reglamentario del Sector Trabajo', '2015'],
    ['Resolución 0312', 'Estándares Mínimos del SG-SST', '2019'],
    ['Ley 1562', 'Modifica el Sistema de Riesgos Laborales', '2012'],
    ['Decreto 1295', 'Organización y administración del Sistema General de Riesgos', '1994'],
    ['Circular 070', 'Implementación del SG-SST en PyMES', '2024']
  ];
  s.addTable(rows, {
    x: 0.6, y: 1.3, w: 12.1, h: 4.5,
    fontSize: 14, color: COLOR_TEXT, fontFace: 'Calibri',
    border: { type: 'solid', color: 'BFBFBF', pt: 0.5 },
    rowH: 0.5
  });
  s.addText('Fuente: Ministerio del Trabajo, Ministerio de Salud y Protección Social.', {
    x: 0.6, y: 6.5, w: 12.1, h: 0.4, fontSize: 11, italic: true, color: '595959'
  });
}

// ===== Slide 4 — Política SST =====
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: COLOR_PRIMARY } });
  s.addText('2. Política de Seguridad y Salud en el Trabajo', { x: 0.5, y: 0, w: 12.5, h: 0.9, fontSize: 24, bold: true, color: 'FFFFFF', valign: 'middle' });

  s.addShape('roundRect', { x: 0.8, y: 1.4, w: 11.7, h: 4.5, fill: { color: COLOR_LIGHT }, line: { color: COLOR_SECONDARY, width: 1.5 }, rectRadius: 0.1 });
  s.addText('"La organización se compromete a proteger la seguridad y la salud de todos los trabajadores, mediante la prevención de los accidentes de trabajo y las enfermedades laborales, la asignación de recursos necesarios, la mejora continua del sistema y el cumplimiento de la normatividad vigente."', {
    x: 1.2, y: 1.7, w: 10.9, h: 4.0,
    fontSize: 18, italic: true, color: COLOR_TEXT, valign: 'middle', align: 'justify'
  });
  s.addText('— Aprobada por la alta dirección · Revisión anual', {
    x: 0.8, y: 6.1, w: 11.7, h: 0.5, fontSize: 14, color: '595959', align: 'right'
  });
}

// ===== Slide 5 — Objetivos =====
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: COLOR_PRIMARY } });
  s.addText('3. Objetivos del SG-SST', { x: 0.5, y: 0, w: 12.5, h: 0.9, fontSize: 26, bold: true, color: 'FFFFFF', valign: 'middle' });

  const objs = [
    ['General',     'Proteger la seguridad y salud de los trabajadores, mediante la prevención de accidentes y enfermedades laborales.'],
    ['Específicos', 'Cumplir la normatividad legal vigente en materia de riesgos laborales.'],
    ['',            'Identificar, evaluar y controlar los riesgos presentes en los puestos de trabajo.'],
    ['',            'Promover una cultura de autocuidado y prevención en todos los niveles.'],
    ['',            'Mejorar continuamente la eficacia del sistema de gestión.']
  ];
  let y = 1.3;
  objs.forEach(([k, v]) => {
    if (k) {
      s.addShape('rect', { x: 0.6, y, w: 2.0, h: 0.55, fill: { color: COLOR_ACCENT } });
      s.addText(k, { x: 0.7, y, w: 1.9, h: 0.55, fontSize: 14, bold: true, color: 'FFFFFF', valign: 'middle' });
    }
    s.addText(v, { x: 2.8, y, w: 10.0, h: 0.55, fontSize: 14, color: COLOR_TEXT, valign: 'middle' });
    y += 0.75;
  });
}

// ===== Slide 6 — Ciclo PHVA =====
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: COLOR_PRIMARY } });
  s.addText('6. Ciclo PHVA del sistema', { x: 0.5, y: 0, w: 12.5, h: 0.9, fontSize: 26, bold: true, color: 'FFFFFF', valign: 'middle' });

  const stages = [
    { name: 'PLANEAR',   desc: 'Política, objetivos, plan de trabajo, identificación de riesgos.', color: '2E75B6' },
    { name: 'HACER',     desc: 'Ejecución del plan, capacitaciones, inspecciones, auditorías.',  color: '70AD47' },
    { name: 'VERIFICAR', desc: 'Medición de indicadores, auditorías internas, revisión por la dirección.', color: 'E07B00' },
    { name: 'ACTUAR',    desc: 'Acciones correctivas, preventivas y de mejora continua.',         color: 'C00000' }
  ];
  const w = 2.9, h = 3.6, gap = 0.25;
  const totalW = stages.length * w + (stages.length - 1) * gap;
  let x = (13.33 - totalW) / 2;
  stages.forEach((st, i) => {
    s.addShape('roundRect', { x, y: 1.4, w, h, fill: { color: st.color }, line: { color: 'FFFFFF', width: 1.5 }, rectRadius: 0.08 });
    s.addText(st.name, { x, y: 1.5, w, h: 0.7, fontSize: 22, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
    s.addText(st.desc, { x: x + 0.15, y: 2.3, w: w - 0.3, h: 2.6, fontSize: 12, color: 'FFFFFF', align: 'center', valign: 'top' });
    x += w + gap;
  });
  s.addText('Decreto 1072 / Resolución 0312 — el SG-SST se gestiona como un sistema cíclico de mejora continua.', {
    x: 0.6, y: 5.5, w: 12.1, h: 0.6, fontSize: 12, italic: true, color: '595959', align: 'center'
  });
}

// ===== Slide 7 — Indicadores =====
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: COLOR_PRIMARY } });
  s.addText('7. Indicadores de gestión', { x: 0.5, y: 0, w: 12.5, h: 0.9, fontSize: 26, bold: true, color: 'FFFFFF', valign: 'middle' });

  const rows = [
    [{ text: 'Indicador', options: { bold: true, color: 'FFFFFF', fill: { color: COLOR_SECONDARY } } },
     { text: 'Fórmula', options: { bold: true, color: 'FFFFFF', fill: { color: COLOR_SECONDARY } } },
     { text: 'Meta', options: { bold: true, color: 'FFFFFF', fill: { color: COLOR_SECONDARY } } },
     { text: 'Frecuencia', options: { bold: true, color: 'FFFFFF', fill: { color: COLOR_SECONDARY } } }],
    ['Tasa de accidentalidad (ILI)',  '(# AT / # trabajadores) × 100',  '< 2.0', 'Mensual'],
    ['Severidad de accidentes',       '(# días incapacidad / # AT)',   '< 5.0', 'Mensual'],
    ['Cobertura de capacitaciones',   '(# capacitados / # trabajadores) × 100', '> 95%', 'Trimestral'],
    ['Cumplimiento del plan de trabajo', '(# actividades ejecutadas / # programadas) × 100', '> 90%', 'Trimestral'],
    ['Resultados de auditoría',       '(# hallazgos cerrados / # hallazgos totales) × 100', '> 85%', 'Anual']
  ];
  s.addTable(rows, {
    x: 0.6, y: 1.3, w: 12.1, h: 4.5,
    fontSize: 13, color: COLOR_TEXT, fontFace: 'Calibri',
    border: { type: 'solid', color: 'BFBFBF', pt: 0.5 },
    rowH: 0.5
  });
}

// ===== Slide 8 — Cierre =====
{
  const s = pptx.addSlide();
  s.background = { color: COLOR_PRIMARY };
  s.addText('Conclusiones', { x: 0.6, y: 0.8, w: 12.1, h: 1.0, fontSize: 36, bold: true, color: 'FFFFFF', align: 'left' });
  s.addShape('rect', { x: 0.6, y: 1.95, w: 1.5, h: 0.08, fill: { color: COLOR_ACCENT } });
  s.addText([
    { text: 'El SG-SST no es un documento: es un sistema vivo, auditado y mejorado cada año.', options: { breakLine: true, paraSpaceAfter: 18 } },
    { text: 'La prevención es tarea de todos — desde la alta dirección hasta el último colaborador.', options: { breakLine: true, paraSpaceAfter: 18 } },
    { text: 'Los indicadores solo importan cuando disparan decisiones y acciones concretas.', options: { breakLine: true, paraSpaceAfter: 18 } },
    { text: 'K+AIR centraliza la operación del SG-SST: archivos, indicadores, evidencias y auditorías en un solo lugar.', options: {} }
  ], {
    x: 0.8, y: 2.4, w: 11.7, h: 4.0, fontSize: 18, color: 'FFFFFF', valign: 'top', align: 'left'
  });
  s.addText('— Fin de la presentación —', {
    x: 0.6, y: 6.7, w: 12.1, h: 0.4, fontSize: 14, italic: true, color: 'F2F2F2', align: 'center'
  });
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  await pptx.writeFile({ fileName: OUT_FILE });
  const stat = fs.statSync(OUT_FILE);
  console.log('OK — PPTX generado:');
  console.log('   ' + OUT_FILE);
  console.log('   ' + stat.size.toLocaleString() + ' bytes');
})();
