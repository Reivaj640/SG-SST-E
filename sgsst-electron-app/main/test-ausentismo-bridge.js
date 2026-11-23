// test-ausentismo-bridge.js
// 📦1095 (2026-11-23) — Tests FUNCIONALES del bridge de ausentismo (3.3.6)
// (main/ausentismo-bridge.js) contra better-sqlite3 en memoria.
//
// Patrón del repo: mock de `electron` antes del require (Module._resolveFilename,
// como test-medprev-programas-bridge.js) + db en memoria.
//
// NOTA de ejecución: better-sqlite3 está compilado con el ABI de Electron, así
// que este test se corre con electron-as-node:
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe main/test-ausentismo-bridge.js
//
// Qué cubre:
//   1. Schema aplicado dos veces (idempotente) y columnas del contrato.
//   2. Registro de los 7 canales.
//   3. registrar: inserta, calcula días/derivadas, valida la cédula.
//   4. listar: filtra por año, origen y cédula.
//   5. buscarPorCedula: normaliza "32.840.309" -> "32840309".
//   6. eliminar: borra y la segunda vez NOT_FOUND.
//   7. Importar el Excel oficial: lee las DOS variantes de hoja de datos
//      (25 columnas "Empresa <anio>" y 13 columnas "<anio>") y DESCARTA las
//      hojas TD (tablas dinámicas, sin columna de cédula).
//   8. Importar es idempotente: reimportar no duplica y no toca lo de la app.
//   9. Aislamiento multi-empresa.
//  10. buscarEmpleado contra base_personal.
//  11. El exportador de Python existe y tiene el contrato esperado.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const checks = [];
function ok(name, cond, extra) { checks.push({ name: name, ok: !!cond, extra: extra }); }

// ---------- Mock de electron ANTES de require del bridge ----------
const handlers = {};
global._mockIpcMain = {
  handle: function (ch, fn) { handlers[ch] = fn; },
  removeHandler: function (ch) { delete handlers[ch]; }
};
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'electron') return 'electron-mock';
  return origResolve.call(this, request, ...args);
};
require.cache['electron-mock'] = { id: 'electron-mock', filename: 'electron-mock', loaded: true, exports: { ipcMain: global._mockIpcMain } };

const bridge = require('./ausentismo-bridge.js');
const importador = require('./ausentismo-import.js');

// ---------- 1) Schema ----------
const Database = require('better-sqlite3');
const db = new Database(':memory:');
try {
  db.exec(bridge.SCHEMA_SQL);
  db.exec(bridge.SCHEMA_SQL); // segunda pasada: idempotente, no revienta
  ok('1) schema aplica dos veces (idempotente)', true);
} catch (e) {
  console.error('FAIL SCHEMA:', e.message);
  process.exit(1);
}

const columnas = db.prepare('PRAGMA table_info(ausentismo_registros)').all().map(c => c.name);
const CONTRATO = [
  'id', 'empresa_id', 'cedula', 'nombre', 'cargo', 'area',
  'fecha_inicio', 'fecha_fin', 'dias_incapacidad',
  'tipo_incapacidad', 'clase_incapacidad', 'entidad', 'diagnostico', 'observaciones',
  'mas_10_dias', 'anio_incapacidad', 'mes_incapacidad', 'concepto', 'descripcion',
  'anio', 'mes', 'origen', 'excel_fila', 'excel_archivo', 'excel_row_json',
  'creado_en', 'actualizado_en'
];
const faltan = CONTRATO.filter(c => columnas.indexOf(c) === -1);
ok('1) el schema tiene todas las columnas del contrato', faltan.length === 0, faltan.join(', '));

// ---------- 2) Canales ----------
// El bridge registra los handlers cuando se llama registerAusentismoHandlers,
// así que primero se registra y DESPUÉS se mira que quedaron los 7.
bridge.registerAusentismoHandlers({}, { getDb: () => db });

const CANALES = [
  'ausentismo:registrar', 'ausentismo:listar', 'ausentismo:buscarPorCedula',
  'ausentismo:eliminar', 'ausentismo:importarExcel', 'ausentismo:exportarExcel',
  'ausentismo:buscarEmpleado', 'ausentismo:marcarExportado', 'ausentismo:importarOficial'
];
const noRegistrados = CANALES.filter(c => !handlers[c]);
ok('2) los 9 canales quedaron registrados', noRegistrados.length === 0, noRegistrados.join(', '));

// ---------- 3) registrar ----------
(async function () {
  const sinCedula = await handlers['ausentismo:registrar']({}, { empresaId: 'Aseplus', datos: { nombre: 'X' } });
  ok('3) registrar sin cédula se rechaza', sinCedula.success === false && sinCedula.error.code === 'VALIDATION',
    JSON.stringify(sinCedula));

  const reg = await handlers['ausentismo:registrar']({}, {
    empresaId: 'Aseplus',
    datos: {
      cedula: '1.044.392.755', nombre: 'JUAN TEST', cargo: 'Oficios', area: 'Turipana',
      fechaInicio: '2026-01-10', fechaFin: '2026-01-21', diasIncapacidad: '12',
      tipoIncapacidad: 'ENFERMEDAD GENERAL', claseIncapacidad: 'EPS', entidad: 'SURA',
      diagnostico: 'Gripe', observaciones: 'prueba'
    }
  });
  ok('3) registrar devuelve success', reg.success === true, JSON.stringify(reg).slice(0, 200));
  ok('3) la cédula se normaliza (puntos y comas fuera)', reg.data && reg.data.cedula === '1044392755', reg.data && reg.data.cedula);
  ok('3) los días se respetan (12)', reg.data && reg.data.dias_incapacidad === 12, reg.data && reg.data.dias_incapacidad);
  ok('3) mas_10_dias se calcula (12 días -> 1)', reg.data && reg.data.mas_10_dias === 1, reg.data && reg.data.mas_10_dias);
  ok('3) anio/mes de la incapacidad se derivan (2026/1)', reg.data && reg.data.anio === 2026 && reg.data.mes_incapacidad === 1,
    reg.data && (reg.data.anio + '/' + reg.data.mes_incapacidad));
  ok('3) el origen de un registro creado en la app es "app"', reg.data && reg.data.origen === 'app', reg.data && reg.data.origen);

  const idApp = reg.data.id;

  // días calculados cuando no vienen
  const reg2 = await handlers['ausentismo:registrar']({}, {
    empresaId: 'Aseplus',
    datos: { cedula: '999', nombre: 'SIN DIAS', fechaInicio: '2026-02-01', fechaFin: '2026-02-05' }
  });
  ok('3) sin días, se calculan entre las fechas (5)', reg2.data.dias_incapacidad === 5, reg2.data.dias_incapacidad);

  // ---------- 4) listar ----------
  const lista = await handlers['ausentismo:listar']({}, { empresaId: 'Aseplus' });
  ok('4) listar devuelve los 2 registros de la empresa', lista.success && lista.data.length === 2, lista.data && lista.data.length);

  const lista2025 = await handlers['ausentismo:listar']({}, { empresaId: 'Aseplus', anio: 2025 });
  ok('4) listar filtra por año (2025 -> 0)', lista2025.success && lista2025.data.length === 0, lista2025.data && lista2025.data.length);
  const listaApp = await handlers['ausentismo:listar']({}, { empresaId: 'Aseplus', origen: 'app' });
  ok('4) listar filtra por origen (app -> 2)', listaApp.success && listaApp.data.length === 2, listaApp.data && listaApp.data.length);

  // ---------- 5) buscarPorCedula ----------
  const busca = await handlers['ausentismo:buscarPorCedula']({}, { empresaId: 'Aseplus', cedula: '1.044.392.755' });
  ok('5) buscarPorCedula normaliza el formato', busca.success && busca.data.length === 1, busca.data && busca.data.length);
  const buscaMal = await handlers['ausentismo:buscarPorCedula']({}, { empresaId: 'Aseplus', cedula: '' });
  ok('5) buscarPorCedula sin cédula se rechaza', buscaMal.success === false && buscaMal.error.code === 'NO_CEDULA');

  // ---------- 6) eliminar ----------
  const del = await handlers['ausentismo:eliminar']({}, { empresaId: 'Aseplus', id: reg2.data.id });
  ok('6) eliminar borra el registro', del.success && del.data.eliminados === 1, JSON.stringify(del));
  const del2 = await handlers['ausentismo:eliminar']({}, { empresaId: 'Aseplus', id: reg2.data.id });
  ok('6) eliminar dos veces -> NOT_FOUND', del2.success === false && del2.error.code === 'NOT_FOUND');

  // ---------- 6b) marcarExportado ----------
  const marc = await handlers['ausentismo:marcarExportado']({}, { empresaId: 'Aseplus', id: idApp });
  ok('6) marcarExportado marca la fila', marc.success && marc.data.actualizados === 1, JSON.stringify(marc));
  const filaMarcada = db.prepare('SELECT exportado_excel_en FROM ausentismo_registros WHERE id = ?').get(idApp);
  ok('6) la fila queda con exportado_excel_en', !!filaMarcada.exportado_excel_en, filaMarcada.exportado_excel_en);
  const marcNo = await handlers['ausentismo:marcarExportado']({}, { empresaId: 'Aseplus', id: 'no-existe' });
  ok('6) marcarExportado de un id que no existe -> NOT_FOUND', marcNo.success === false && marcNo.error.code === 'NOT_FOUND');

  // ---------- 7) Importar el Excel oficial ----------
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-aus-'));
  const xlsxPath = path.join(dir, 'PI-FO-076 PRUEBA.xlsx');
  const XLSX = require('xlsx');

  const CABECERAS_25 = ['No', 'EMPRESA', 'NOMBRE', 'CEDULA', 'Columna1', 'CARGO', 'EMPRESA USUARIA',
    'ÁREA O DPTO', 'GENERO', 'MES', 'N° DIAS DE INCAPACIDAD', 'CLASE DE INCAPACIDAD', 'TIPO DE INCAPACIDAD',
    'ENTIDAD', 'AÑO', 'F. INICIO', 'F. FIN', 'CODIGO', 'DESCRIPCION', '> 10 Dias', 'D. T. P.',
    'A. Inc.', 'M. Inc.', 'Concepto', 'Descripción'];

  const CABECERAS_13 = ['No', 'NOMBRE', 'CEDULA', 'CARGO', 'MES', 'N° DIAS DE INCAPACIDAD',
    'CLASE DE INCAPACIDAD', 'TIPO DE INCAPACIDAD', 'ENTIDAD', 'F. INICIO', 'F. FIN', 'CODIGO', 'DESCRIPCION'];

  function hoja(titulo, cabeceras, filas) {
    const datos = [];
    for (let i = 0; i < 6; i++) datos.push([]);
    datos.push(cabeceras);
    filas.forEach(f => datos.push(f));
    const ws = XLSX.utils.aoa_to_sheet(datos);
    return ws;
  }

  const libro = XLSX.utils.book_new();
  // Formato nuevo: 25 columnas, encabezado en la fila 7.
  XLSX.utils.book_append_sheet(libro, hoja('PRUEBA 2024', CABECERAS_25, [
    ['1', 'PRUEBA', 'PERSONA UNO', '111', '111', 'Operativo', 'CLIENTE X', 'SEDE', 'HOMBRE', 'ENERO', '15', 'EPS',
      'ENFERMEDAD GENERAL', 'SURA', '2024', 45292, 45306, 'J00X', 'Ansiedad mixta', '', '', '', '', '', ''],
    ['2', 'PRUEBA', 'PERSONA DOS', '222', '222', 'Operativo', 'CLIENTE X', 'SEDE', 'MUJER', 'FEBRERO', '3', 'ARL',
      'ACCIDENTE DE TRABAJO', 'ARL POSITIVA', '2024', 45323, 45325, 'S826', 'Caida', '', '', '', '', '', '']
  ]), 'PRUEBA 2024');
  // Hoja TD: tablas dinamicas. Tiene "N° DIAS DE INCAPACIDAD" pero NO cédula -> se descarta.
  const td = hoja('TD 2024', ['MES', 'N° DIAS DE INCAPACIDAD', 'Total'], [['ENERO', 18, 18]]);
  XLSX.utils.book_append_sheet(libro, td, 'TD 2024');
  // Formato viejo: 13 columnas, mismo encabezado en la fila 7.
  XLSX.utils.book_append_sheet(libro, hoja('2023', CABECERAS_13, [
    ['1', 'PERSONA TRES', '333', 'Operativo', 'MARZO', '8', 'EPS', 'ENFERMEDAD GENERAL', 'SURA',
      44932, 44939, 'F412', 'Trastorno mixto']
  ]), '2023');
  XLSX.writeFile(libro, xlsxPath);

  const leido = importador.leerArchivoAusentismo(xlsxPath);
  ok('7) el lector encuentra 2 hojas de datos (ignora la TD)', leido.hojas.length === 2, leido.hojas.map(h => h.nombre).join(' | '));
  ok('7) el lector trae 3 filas', leido.total === 3, leido.total);

  const imp = await handlers['ausentismo:importarExcel']({}, { empresaId: 'Aseplus', filePath: xlsxPath });
  ok('7) importar devuelve success', imp.success === true, JSON.stringify(imp).slice(0, 200));
  ok('7) importar trae las 3 filas', imp.success && imp.data.importadas === 3, imp.data && imp.data.importadas);
  ok('7) el conteo por año reparte 2 en 2024 y 1 en 2023',
    imp.success && imp.data.por_anio['2024'] === 2 && imp.data.por_anio['2023'] === 1,
    JSON.stringify(imp.data && imp.data.por_anio));

  const trasImport = await handlers['ausentismo:listar']({}, { empresaId: 'Aseplus', origen: 'import_excel' });
  ok('7) las filas importadas quedan en la tabla', trasImport.data.length === 3, trasImport.data.length);

  const f2024 = trasImport.data.find(f => f.anio === 2024 && f.cedula === '111');
  ok('7) formato de 25 columnas: nombre', f2024 && f2024.nombre === 'PERSONA UNO', f2024 && f2024.nombre);
  ok('7) formato de 25 columnas: área', f2024 && f2024.area === 'SEDE', f2024 && f2024.area);
  ok('7) formato de 25 columnas: días', f2024 && f2024.dias_incapacidad === 15, f2024 && f2024.dias_incapacidad);
  ok('7) formato de 25 columnas: fecha de inicio (serial -> ISO)', f2024 && f2024.fecha_inicio === '2024-01-01', f2024 && f2024.fecha_inicio);
  ok('7) formato de 25 columnas: fecha de fin', f2024 && f2024.fecha_fin === '2024-01-15', f2024 && f2024.fecha_fin);
  ok('7) formato de 25 columnas: tipo/clase/entidad', f2024 && f2024.tipo_incapacidad === 'ENFERMEDAD GENERAL' && f2024.clase_incapacidad === 'EPS' && f2024.entidad === 'SURA',
    f2024 && (f2024.tipo_incapacidad + '/' + f2024.clase_incapacidad + '/' + f2024.entidad));
  ok('7) formato de 25 columnas: código CIE-10', f2024 && f2024.codigo === 'J00X', f2024 && f2024.codigo);
  ok('7) formato de 25 columnas: mes en número (ENERO -> 1)', f2024 && f2024.mes === 1, f2024 && f2024.mes);
  ok('7) mas_10_dias se calcula (15 días -> 1)', f2024 && f2024.mas_10_dias === 1, f2024 && f2024.mas_10_dias);
  ok('7) se guarda la fila cruda del Excel (trazabilidad)', f2024 && !!f2024.excel_row_json, f2024 && f2024.excel_row_json && f2024.excel_row_json.slice(0, 40));
  ok('7) se guarda el archivo y la fila de origen', f2024 && f2024.excel_fila === 8 && f2024.excel_archivo === 'PI-FO-076 PRUEBA.xlsx',
    f2024 && (f2024.excel_fila + ' / ' + f2024.excel_archivo));

  const f2023 = trasImport.data.find(f => f.anio === 2023 && f.cedula === '333');
  ok('7) formato de 13 columnas: nombre', f2023 && f2023.nombre === 'PERSONA TRES', f2023 && f2023.nombre);
  ok('7) formato de 13 columnas: días', f2023 && f2023.dias_incapacidad === 8, f2023 && f2023.dias_incapacidad);
  ok('7) formato de 13 columnas: el año sale de la hoja (2023)', f2023 && f2023.anio === 2023, f2023 && f2023.anio);
  // Serial 44932 en Excel = 2023-01-06 (2023-01-01 es 44927).
  ok('7) formato de 13 columnas: fecha de inicio', f2023 && f2023.fecha_inicio === '2023-01-06', f2023 && f2023.fecha_inicio);

  // ---------- 8) Importar es idempotente ----------
  const imp2 = await handlers['ausentismo:importarExcel']({}, { empresaId: 'Aseplus', filePath: xlsxPath });
  ok('8) reimportar vuelve a traer 3 (no 6)', imp2.success && imp2.data.importadas === 3, imp2.data && imp2.data.importadas);
  const trasReimport = await handlers['ausentismo:listar']({}, { empresaId: 'Aseplus', origen: 'import_excel' });
  ok('8) reimportar NO duplica (siguen siendo 3)', trasReimport.data.length === 3, trasReimport.data.length);
  const appTras = await handlers['ausentismo:listar']({}, { empresaId: 'Aseplus', origen: 'app' });
  ok('8) reimportar NO toca los registros de la app', appTras.data.length === 1, appTras.data.length);

  // ---------- 9) Aislamiento multi-empresa ----------
  const impOtro = await handlers['ausentismo:importarExcel']({}, { empresaId: 'Temposum', filePath: xlsxPath });
  ok('9) otra empresa importa su propia copia', impOtro.success && impOtro.data.importadas === 3, impOtro.data && impOtro.data.importadas);
  const deAseplus = await handlers['ausentismo:listar']({}, { empresaId: 'Aseplus' });
  const deTemposum = await handlers['ausentismo:listar']({}, { empresaId: 'Temposum' });
  ok('9) las empresas no se mezclan (Aseplus 4, Temposum 3)',
    deAseplus.data.length === 4 && deTemposum.data.length === 3,
    deAseplus.data.length + ' / ' + deTemposum.data.length);

  // ---------- 10) buscarEmpleado (base_personal) ----------
  db.exec('CREATE TABLE base_personal (id TEXT, cedula TEXT, nombre TEXT, cargo TEXT, area TEXT)');
  db.prepare("INSERT INTO base_personal VALUES ('p1','1044392755','PERSONA BASE','OPERATIVO','SEDE')").run();
  const emp = await handlers['ausentismo:buscarEmpleado']({}, { cedula: '1.044.392.755' });
  ok('10) buscarEmpleado encuentra en base_personal (normaliza la cédula)',
    emp.success && emp.data && emp.data.nombre === 'PERSONA BASE', JSON.stringify(emp.data));
  const empNo = await handlers['ausentismo:buscarEmpleado']({}, { cedula: '000' });
  ok('10) buscarEmpleado devuelve null si no está', empNo.success && empNo.data === null, JSON.stringify(empNo.data));

  // ---------- 11) El exportador de Python ----------
  const scriptPy = path.join(__dirname, '..', 'Portear', 'src', 'exportar_ausentismo.py');
  ok('11) existe el exportador de Python', fs.existsSync(scriptPy), scriptPy);
  if (fs.existsSync(scriptPy)) {
    const src = fs.readFileSync(scriptPy, 'utf8');
    ok('11) el exportador NO toca el archivo original (dice que es una copia)',
      /copia/i.test(src) && !/shutil\.rmtree|os\.remove\(archivo\)/.test(src));
    ok('11) el exportador devuelve filas_por_id para marcar lo exportado', /filas_por_id/.test(src));
    ok('11) el exportador crea la hoja del año si no existe', /create_sheet/.test(src));
  }

  // ---------- Resumen ----------
  let failed = 0;
  console.log('\n=======================================');
  checks.forEach(c => {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
})();
