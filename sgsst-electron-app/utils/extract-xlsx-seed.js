/* Script: extract-xlsx-seed.js
   Lee el XLSX GI-FO-019, agrupa por sede/proceso/cargo y genera el seed JSON. */
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const XLSX_PATH = path.join(__dirname, 'GI-FO-019 MATRIZ DE PELIGROS ALC.xlsx');
const OUT_PATH = path.join(__dirname, '..', 'modules', 'gestion-peligros', 'identificacion-peligros', 'peligros-seed.json');

const wb = xlsx.readFile(XLSX_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });

// Columnas (basado en la inspección):
//  0: Sede | 1: Proceso | 2: Cargo | 3: Zona | 4: Actividades | 5: Tareas
//  6: Rutinaria (Si/No) | 7: Tipo | 8: Descripcion | 9: Efectos
// 10: Control fuente | 11: Control medio | 12: Control individuo
// 13: ND | 14: NE | 15: NP | 16: Interp NP | 17: NC | 18: NR | 19: Interp NR
// 20: Aceptabilidad | 21: Expuestos | 22: Peor consecuencia
// 23: Eliminación | 24: Sustitución | 25: Ingeniería | 26: Administrativos | 27: EPP

function v(row, c) { return (row[c] != null ? String(row[c]) : '').trim(); }
function n(row, c) { var x = parseFloat(row[c]); return isNaN(x) ? null : x; }
function upper(s) { return (s || '').toUpperCase(); }

var currentSede = null, currentSedeId = null;
var currentProceso = null, currentProcesoId = null;
var currentCargo = null, currentCargoId = null;
var sedeIdx = 1, procIdx = 1, cargoIdx = 1, pelIdx = 1;

var sedesMap = {};
var ordenSedes = [];

for (var i = 4; i < rows.length; i++) {
  var r = rows[i];
  if (!r) continue;

  // Sede nueva si col 0 no vacía
  var sedeName = v(r, 0);
  if (sedeName && upper(sedeName) !== 'SEDE') {
    currentSede = sedeName;
    currentSedeId = 'sed_' + (sedeIdx++);
    if (!sedesMap[currentSedeId]) {
      sedesMap[currentSedeId] = { id: currentSedeId, nombre: currentSede, procesos: {}, procesosOrden: [] };
      ordenSedes.push(currentSedeId);
    }
  }

  // Proceso nuevo
  var procName = v(r, 1);
  if (procName) {
    currentProceso = procName;
    currentProcesoId = 'pro_' + (procIdx++);
    if (!sedesMap[currentSedeId].procesos[currentProcesoId]) {
      sedesMap[currentSedeId].procesos[currentProcesoId] = {
        id: currentProcesoId, nombre: currentProceso, cargos: {}, cargosOrden: []
      };
      sedesMap[currentSedeId].procesosOrden.push(currentProcesoId);
    }
  }

  // Cargo nuevo
  var cargoName = v(r, 2);
  if (cargoName && upper(cargoName) !== 'CARGO') {
    currentCargo = cargoName;
    currentCargoId = 'car_' + (cargoIdx++);
    if (!sedesMap[currentSedeId].procesos[currentProcesoId].cargos[currentCargoId]) {
      sedesMap[currentSedeId].procesos[currentProcesoId].cargos[currentCargoId] = {
        id: currentCargoId,
        nombre: currentCargo,
        zona: v(r, 3),
        actividades: v(r, 4),
        tareas: v(r, 5),
        rutinaria: upper(v(r, 6)) === 'SI' ? true : (upper(v(r, 6)) === 'NO' ? false : null),
        peligros: []
      };
      sedesMap[currentSedeId].procesos[currentProcesoId].cargosOrden.push(currentCargoId);
    }
  }

  // Peligro (si hay tipo en col 7)
  var tipo = v(r, 7);
  if (!tipo) continue;

  var nd = n(r, 13), ne = n(r, 14), np = n(r, 15), nc = n(r, 17), nr = n(r, 18);
  var interpNp = v(r, 16);
  var interpNr = v(r, 19);
  var acept = v(r, 20);

  var pel = {
    id: 'pel_' + (pelIdx++),
    tipo: tipo,
    peligro: v(r, 8),
    efectosPosibles: v(r, 9),
    controlFuente: v(r, 10),
    controlMedio: v(r, 11),
    controlPersona: v(r, 12),
    nd: nd, ne: ne, np: np,
    npInterpretacion: interpNp,
    nc: nc, nr: nr,
    nrNivel: interpNr,
    nrLabel: acept,
    nrColor: '',
    expuestos: n(r, 21),
    peorConsecuencia: v(r, 22),
    medidaEliminacion: v(r, 23),
    medidaSustitucion: v(r, 24),
    medidaIngenieria: v(r, 25),
    medidaAdministrativos: v(r, 26),
    medidaEpp: v(r, 27),
    createdAt: '2026-06-22T00:00:00.000Z',
    updatedAt: '2026-06-22T00:00:00.000Z'
  };
  sedesMap[currentSedeId].procesos[currentProcesoId].cargos[currentCargoId].peligros.push(pel);
}

// Convertir maps a arrays
var sedesFinal = ordenSedes.map(function (sid) {
  var s = sedesMap[sid];
  return {
    id: s.id,
    nombre: s.nombre,
    procesos: s.procesosOrden.map(function (pid) {
      var p = s.procesos[pid];
      return {
        id: p.id,
        nombre: p.nombre,
        cargos: p.cargosOrden.map(function (cid) { return p.cargos[cid]; })
      };
    })
  };
});

var totalPeligros = 0;
sedesFinal.forEach(function (s) {
  s.procesos.forEach(function (p) {
    p.cargos.forEach(function (c) { totalPeligros += c.peligros.length; });
  });
});

var out = {
  version: 1,
  companyName: 'Demo',
  lastModified: '2026-06-22T00:00:00.000Z',
  metadata: {
    formatCode: 'GI-FO-019',
    version: 'V0',
    elaborado: '',
    revisado: '',
    aprobado: '',
    fecha: '2026-06-22'
  },
  _nextId: pelIdx,
  sedes: sedesFinal,
  stats: { total: totalPeligros, totalSedes: sedesFinal.length }
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
console.log('OK — sedes:', sedesFinal.length, '· peligros:', totalPeligros);
console.log('Escrito en:', OUT_PATH);
sedesFinal.forEach(function (s) {
  console.log(' -', s.nombre, ':', s.procesos.length, 'procesos');
  var pc = 0; s.procesos.forEach(function (p) { p.cargos.forEach(function (c) { pc += c.peligros.length; }); });
  console.log('   peligros:', pc);
});
