/* ============================================================
 * Test funcional — Reconexión de Inspecciones a la carpeta real
 * de la empresa (2026-09-21)
 *
 * NO toca la carpeta real de la empresa: copia el Excel y la
 * estructura a un directorio temporal y opera sobre la copia.
 *
 * Cubre:
 *   1. programa:obtener lee el Excel real (8 actividades, p/c, source excel)
 *   2. programa:actualizarActividad escribe 'c' en el mes + respaldo en backup/
 *   3. inspeccion:explorarHistorico lista sedes/fechas de "Inspeciones realizadas"
 *   4. inspeccion:listar importa inspecciones_data.json legado (idempotente)
 *   5. inspeccion:archivar guarda el formato en Inspeciones realizadas/<sede>/<fecha>/
 *   6. Fallback: empresa sin carpeta → libreta interna (source interno)
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');

const APP_ROOT = path.resolve(__dirname, '..');
const REAL_424 = 'G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\1. Tempoactiva Est SAS\\4. Gestión de Peligros y Riesgos\\4.2.4 Realización de inspecciones sistemáticas a las instalaciones, maquinaria o equipos';

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.log('  ✗ FALLO: ' + label); }
}
function section(s) { console.log('\n=== ' + s + ' ==='); }

/* Directorios temporales */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-insp-test-'));
const TMP_USERDATA = path.join(TMP, 'userdata');
const TMP_COMPANY = path.join(TMP, 'empresa');
fs.mkdirSync(TMP_USERDATA, { recursive: true });
fs.mkdirSync(TMP_COMPANY, { recursive: true });

/* Estructura temporal que imita la empresa real */
const GPR = path.join(TMP_COMPANY, '4. Gestión de Peligros y Riesgos');
const DIR_424 = path.join(GPR, '4.2.4 Realización de inspecciones sistemáticas a las instalaciones, maquinaria o equipos');
const DIR_HIST = path.join(DIR_424, 'Inspeciones realizadas');
fs.mkdirSync(DIR_424, { recursive: true });
fs.mkdirSync(path.join(DIR_HIST, 'Sede Caribe', '24-01-2019'), { recursive: true });
fs.mkdirSync(path.join(DIR_HIST, 'Bahia', '08-02-2019'), { recursive: true });

/* Copia del Excel REAL (para probar parseo con el archivo verdadero) */
fs.copyFileSync(path.join(REAL_424, 'PROGRAMA DE INSPECCIONES.xlsx'), path.join(DIR_424, 'PROGRAMA DE INSPECCIONES.xlsx'));

/* Archivos históricos de ejemplo */
fs.writeFileSync(path.join(DIR_HIST, 'Sede Caribe', '24-01-2019', 'IMG_20190124_113140.jpg'), 'fakejpg');
fs.writeFileSync(path.join(DIR_HIST, 'Sede Caribe', '24-01-2019', 'GI-FO-077 Informe.docx'), 'fakedocx');
fs.writeFileSync(path.join(DIR_HIST, 'Bahia', '08-02-2019', 'GI-OD-030 PROGRAMA.docx'), 'fakedocx');
fs.writeFileSync(path.join(DIR_424, 'GI-FO-026 1-2026.xlsx'), 'fake');
fs.writeFileSync(path.join(DIR_424, 'inspecciones_data.json'), JSON.stringify({
  inspections: [{ id: 'insp-1778020761732', type: 'EXTINTOR', format: 'GI-FO-026', location: 'Turipana', inspector: 'ja', date: '2026-05-05', status: 'DRAFT', items: 0, observations: '' }]
}));

/* Mock de electron */
const handlers = {};
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') {
    return {
      app: {
        getPath: () => TMP_USERDATA,
        getAppPath: () => APP_ROOT
      },
      ipcMain: { handle: function (ch, fn) { handlers[ch] = fn; } },
      BrowserWindow: { getAllWindows: () => [] },
      shell: { openPath: async () => '' }
    };
  }
  return origLoad.apply(this, arguments);
};

const bridge = require('./inspecciones-bridge');
bridge.registerInspeccionesHandlers({ getPath: () => TMP_USERDATA }, {
  getCompanyRootPath: async function (name) {
    if (name === 'Tempoactiva') return TMP_COMPANY;
    return null;
  }
});
Module._load = origLoad;

async function run() {
  section('1. programa:obtener lee el Excel real de la empresa');
  const progRes = await handlers['programa:obtener']({}, 2026, 'Tempoactiva');
  assert(progRes.success === true, 'respuesta success');
  const program = progRes.data.program;
  assert(program && program.source === 'excel', 'source === "excel"');
  assert(program.activities.length === 9, 'actividades detectadas: ' + program.activities.length + ' (esperado 9, las reales del Excel)');
  const first = program.activities[0];
  assert(typeof first.id === 'string' && first.id.indexOf('excel:Tempoactiva:2026:') === 0, 'id de actividad con prefijo excel: → ' + first.id);
  const withC = program.activities.filter(function (a) {
    return Object.keys(a.monthlySchedule).some(function (m) { return a.monthlySchedule[m] === 'c'; });
  });
  assert(withC.length >= 3, 'actividades con meses cumplidos (c): ' + withC.length);
  const gerencial = program.activities.filter(function (a) { return a.inspectionType === 'gerencial'; });
  const extintores = program.activities.filter(function (a) { return a.inspectionType === 'extintores'; });
  assert(gerencial.length >= 2, 'tipo gerencial detectado: ' + gerencial.length);
  assert(extintores.length >= 1, 'tipo extintores detectado: ' + extintores.length);
  console.log('  → actividades:', program.activities.map(function (a) { return a.row + ':' + (a.activity || '').slice(0, 30); }).join(' | '));

  section('2. programa:actualizarActividad escribe en el Excel + respaldo');
  const rowId = withC[0].id;
  const patch = { monthlySchedule: Object.assign({}, withC[0].monthlySchedule) };
  /* Marca 'c' un mes que estaba 'p' de esa actividad */
  let flipped = null;
  Object.keys(patch.monthlySchedule).forEach(function (m) {
    if (patch.monthlySchedule[m] === 'p' && !flipped) { patch.monthlySchedule[m] = 'c'; flipped = m; }
  });
  if (!flipped) { patch.monthlySchedule['Oct'] = 'c'; flipped = 'Oct'; }
  const updRes = await handlers['programa:actualizarActividad']({}, rowId, patch);
  assert(updRes.success === true, 'escritura success (' + flipped + ' → c)');
  const backups = fs.readdirSync(path.join(DIR_424, 'backup')).filter(function (f) { return f.indexOf('PROGRAMA') === 0; });
  assert(backups.length >= 1, 'respaldo creado en backup/: ' + backups.length + ' archivo(s)');
  /* Releer: el mes quedó 'c' y el cache se invalidó */
  const progRes2 = await handlers['programa:obtener']({}, 2026, 'Tempoactiva');
  const rowNum = parseInt(rowId.split(':')[3], 10);
  const reloaded = progRes2.data.program.activities.find(function (a) { return a.row === rowNum; });
  assert(reloaded && reloaded.monthlySchedule[flipped] === 'c', 'mes ' + flipped + ' releído como "c" tras la escritura');

  section('3. inspeccion:explorarHistorico lista el archivo por sede/fecha');
  const expRes = await handlers['inspeccion:explorarHistorico']({}, 'Tempoactiva');
  assert(expRes.success && expRes.data.found === true, 'carpeta encontrada');
  const entries = expRes.data.entries;
  const visita = entries.find(function (e) { return e.kind === 'visita' && e.sede === 'Sede Caribe'; });
  assert(!!visita, 'visita Sede Caribe listada');
  assert(visita && visita.photoCount === 1 && visita.files.length === 2, 'fotos/formatos contados: ' + (visita && visita.photoCount) + ' foto(s), ' + (visita && visita.files.length) + ' archivo(s)');
  assert(visita && /^2019-01-24/.test(visita.fecha), 'fecha parseada DD-MM-AAAA → ISO: ' + (visita && visita.fecha));
  const suelto = entries.find(function (e) { return e.kind === 'archivo' && /GI-FO-026/.test(e.files[0].name); });
  assert(!!suelto, 'formato suelto GI-FO-026 1-2026 listado');
  assert(entries[0].fecha >= entries[entries.length - 1].fecha || entries[entries.length - 1].fecha === null, 'ordenado por fecha desc');

  section('4. inspeccion:listar importa el legado de la carpeta (idempotente)');
  const listRes1 = await handlers['inspeccion:listar']({}, { companyId: 'Tempoactiva', companyName: 'Tempoactiva' });
  const legacy1 = listRes1.data.inspections.filter(function (i) { return i.sourceFolder === true; });
  assert(legacy1.length === 1, '1 registro legado importado');
  assert(legacy1[0] && legacy1[0].type === 'extintores' && legacy1[0].site === 'Turipana', 'mapeo tipo/sede del legado: ' + (legacy1[0] && legacy1[0].type));
  const listRes2 = await handlers['inspeccion:listar']({}, { companyId: 'Tempoactiva', companyName: 'Tempoactiva' });
  const legacy2 = listRes2.data.inspections.filter(function (i) { return i.sourceFolder === true; });
  assert(legacy2.length === 1, 'segunda llamada NO duplica (idempotente)');

  section('5. inspeccion:archivar guarda el formato en la carpeta de la empresa');
  const createRes = await handlers['inspeccion:crear']({}, {
    type: 'extintores', date: '2026-09-21', performedBy: 'Prueba Tester',
    site: 'Sede Prueba', companyId: 'Tempoactiva', companyName: 'Tempoactiva',
    data: { rows: [{ ubicacion: 'Entrada', numero: '1', tipo: 'PQS', capacidad: '10lb' }] }
  });
  assert(createRes.success, 'inspección de prueba creada');
  const archRes = await handlers['inspeccion:archivar']({}, { id: createRes.data.inspection.id, companyId: 'Tempoactiva' });
  assert(archRes.success === true, 'archivado success');
  assert(archRes.data && fs.existsSync(archRes.data.path), 'archivo existe en: ' + (archRes.data && archRes.data.path));
  assert(archRes.data && archRes.data.path.indexOf('Inspeciones realizadas') !== -1 && archRes.data.path.indexOf('Sede Prueba') !== -1, 'ruta dentro de Inspeciones realizadas/<sede>/');

  section('6. Fallback: empresa SIN carpeta usa la libreta interna');
  const progRes3 = await handlers['programa:obtener']({}, 2026, 'EmpresaSinCarpeta');
  assert(progRes3.success && progRes3.data.program.activities.length === 9, 'programa interno por defecto (9 actividades)');
  assert(progRes3.data.program.source !== 'excel', 'source NO es excel');
  const progRes4 = await handlers['programa:obtener']({}, 2026, 'default');
  assert(progRes4.success, 'empresa default también funciona (fallback)');

  /* Limpieza */
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ }

  console.log('\n──────────────────────────────');
  console.log('RESULTADO: ' + passed + ' OK · ' + failed + ' FALLOS');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(function (e) {
  console.error('ERROR INESPERADO:', e);
  process.exit(1);
});
