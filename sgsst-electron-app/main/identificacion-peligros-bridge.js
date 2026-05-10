/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
Bridge — JSON CRUD + Motor GTC-45 (ND×NE=NP, NP×NC=NR)
Persistencia: JSON en {userData}/identificacion-peligros-data/
Export Excel: Fase 2 (Python openpyxl)
========================================================================== */
var path = require('path');
var fs = require('fs');
var xlsx = require('xlsx');

var _app = null;
var _getCompanyRootPath = null;

/* ─── GTC-45 Constantes ─────────────────────────────────────────────────── */

var ND_OPTIONS = [
  { value: 0, label: 'Muy Alto (se ha comprobado que el riesgo existe)' },
  { value: 1, label: 'Alto' },
  { value: 2, label: 'Medio' },
  { value: 3, label: 'Bajo' },
  { value: 4, label: 'Muy Bajo' },
  { value: 5, label: 'No existe' }
];

var NE_OPTIONS = [
  { value: 1, label: 'Esporádica (<1h/sem o <1vez/sem)' },
  { value: 2, label: 'Intermitente (1-4h/sem o 1-4veces/sem)' },
  { value: 3, label: 'Permanente (>4h/sem o >4veces/sem)' },
  { value: 4, label: 'Continua (8h/día o más)' }
];

var NC_OPTIONS = [
  { value: 10, label: 'Lesiones sin incapacidad' },
  { value: 20, label: 'Lesiones con incapacidad temporal' },
  { value: 40, label: 'Lesiones con incapacidad permanente parcial' },
  { value: 60, label: 'Lesiones con incapacidad permanente total' },
  { value: 80, label: 'Muerte' },
  { value: 100, label: 'Muerte múltiple' }
];

var TIPOS_PELIGRO = [
  'Físico', 'Químico', 'Biológico', 'Psicosocial',
  'Ergonómico', 'Mecánico', 'Eléctrico', 'Locativo',
  'Fenómenos Naturales', 'Público'
];

var TIPO_NORMALIZE_MAP = [
  { pattern: /psicosocial|carga mental|carga física.*mental|acoso laboral|estrés laboral|monoton|contenido de la tarea|condiciones de la tarea/i, tipo: 'Psicosocial' },
  { pattern: /biológic|virus|bacterias|hongos|fluidos|excrementos|picaduras|mordeduras|síntomas grip|sintomas grip/i, tipo: 'Biológico' },
  { pattern: /ergonómic|postura|movimiento repetitivo|moviiento repetitivo|carga|sedente|esfuerzo|manipulación manual|musc|biomec/i, tipo: 'Ergonómico' },
  { pattern: /mecánic|maquina|herramienta|corte|pieza/i, tipo: 'Mecánico' },
  { pattern: /eléctric|alta.*tensión|baja.*tensión|estática|corto circuito/i, tipo: 'Eléctrico' },
  { pattern: /químic|quimic|sustancia|polvo|vapor|gas|derrame/i, tipo: 'Químico' },
  { pattern: /físic|ruido|iluminación|vibración|radiaci|temperatura|calor|frío|ultravioleta/i, tipo: 'Físico' },
  { pattern: /locativ|suelo|piso|escalera|puerta|pared|obra/i, tipo: 'Locativo' },
  { pattern: /fenómeno natural|inundación|sismo|terremoto|vendaval|tormenta|deslizamiento|precipitaciones|lluvia/i, tipo: 'Fenómenos Naturales' },
  { pattern: /público|robo|atraco|asalto|vandalismo|desorden público/i, tipo: 'Público' },
  { pattern: /altura|alturas/i, tipo: 'Mecánico' },
  { pattern: /incendio|fuego|trabajo.*caliente/i, tipo: 'Eléctrico' },
  { pattern: /tránsito|transito|accidente.*transit/i, tipo: 'Público' },
  { pattern: /desplazamiento|caída|caida|desnivel/i, tipo: 'Locativo' }
];

var NP_INTERPRETACION = [
  { min: 1, max: 5, label: 'Muy Bajo' },
  { min: 6, max: 10, label: 'Bajo' },
  { min: 11, max: 20, label: 'Medio' },
  { min: 21, max: 40, label: 'Alto' }
];

var NR_ACEPTABILIDAD = [
  { max: 10, nivel: 'I', label: 'Aceptable', color: 'verde' },
  { max: 40, nivel: 'II', label: 'Aceptable con control', color: 'amarillo' },
  { max: 120, nivel: 'III', label: 'Inaceptable nivel 1', color: 'naranja' },
  { max: 200, nivel: 'IV', label: 'Inaceptable nivel 2', color: 'rojo' },
  { max: Infinity, nivel: 'V', label: 'Inaceptable nivel 3', color: 'morado' }
];

/* ─── Motor GTC-45 ──────────────────────────────────────────────────────── */

function _calcularNP(nd, ne) {
  return (nd != null && ne != null) ? nd * ne : null;
}

function _calcularNR(np, nc) {
  return (np != null && nc != null) ? np * nc : null;
}

function _interpretarNP(np) {
  if (np == null) return '';
  for (var i = 0; i < NP_INTERPRETACION.length; i++) {
    if (np >= NP_INTERPRETACION[i].min && np <= NP_INTERPRETACION[i].max) {
      return NP_INTERPRETACION[i].label;
    }
  }
  return '';
}

function _interpretarNR(nr) {
  if (nr == null) return { nivel: '', label: '', color: '' };
  for (var i = 0; i < NR_ACEPTABILIDAD.length; i++) {
    if (nr <= NR_ACEPTABILIDAD[i].max) {
      return {
        nivel: NR_ACEPTABILIDAD[i].nivel,
        label: NR_ACEPTABILIDAD[i].label,
        color: NR_ACEPTABILIDAD[i].color
      };
    }
  }
  return { nivel: '', label: '', color: '' };
}

function _calcularPeligro(p) {
  var nd = p.nd != null ? Number(p.nd) : null;
  var ne = p.ne != null ? Number(p.ne) : null;
  var nc = p.nc != null ? Number(p.nc) : null;
  var np = _calcularNP(nd, ne);
  var nr = _calcularNR(np, nc);
  var interp = _interpretarNR(nr);
  return {
    np: np,
    nr: nr,
    npInterpretacion: _interpretarNP(np),
    nrNivel: interp.nivel,
    nrLabel: interp.label,
    nrColor: interp.color
  };
}

function _enriquecerPeligro(p) {
  var calc = _calcularPeligro(p);
  p.np = calc.np;
  p.nr = calc.nr;
  p.npInterpretacion = calc.npInterpretacion;
  p.nrNivel = calc.nrNivel;
  p.nrLabel = calc.nrLabel;
  p.nrColor = calc.nrColor;
  return p;
}

function _enriquecerMatriz(matriz) {
  if (!matriz || !matriz.sedes) return matriz;
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var pr = 0; pr < sede.procesos.length; pr++) {
      var proceso = sede.procesos[pr];
      if (!proceso.cargos) continue;
      for (var c = 0; c < proceso.cargos.length; c++) {
        var cargo = proceso.cargos[c];
        if (cargo.zona === undefined) cargo.zona = '';
        if (cargo.actividades === undefined) cargo.actividades = '';
        if (cargo.tareas === undefined) cargo.tareas = '';
        if (cargo.rutinaria === undefined) cargo.rutinaria = null;
        if (!cargo.peligros) continue;
        for (var pe = 0; pe < cargo.peligros.length; pe++) {
          var pel = cargo.peligros[pe];
        if (pel.expuestos === undefined || pel.expuestos === '') pel.expuestos = null;
 if (typeof pel.expuestos !== 'number' && pel.expuestos !== null) { var n = Number(pel.expuestos); pel.expuestos = isNaN(n) ? null : n; }
        if (pel.criterioEstablecido === undefined) pel.criterioEstablecido = '';
        if (pel.peorConsecuencia === undefined) pel.peorConsecuencia = '';
        _enriquecerPeligro(pel);
        }
      }
    }
  }
  return matriz;
}

/* ─── Estadísticas ──────────────────────────────────────────────────────── */

function _calcularStats(matriz) {
  var total = 0;
  var porAcept = { I: 0, II: 0, III: 0, IV: 0, V: 0 };
  var porTipo = {};
  var porSede = {};
  var porCargo = {};
  var maxNR = 0;
  var inaceptables = 0;
  var totalSedes = 0;
  var totalProcesos = 0;
  var totalCargos = 0;
  var evaluados = 0;

  if (!matriz || !matriz.sedes) {
    return { total: 0, porAcept: porAcept, porTipo: porTipo, porSede: porSede, porCargo: porCargo, maxNR: 0, inaceptables: 0, tasaInaceptable: 0, totalSedes: 0, totalProcesos: 0, totalCargos: 0, evaluados: 0, tasaEvaluados: 0 };
  }

  totalSedes = matriz.sedes.length;

  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    totalProcesos += sede.procesos.length;
    for (var pr = 0; pr < sede.procesos.length; pr++) {
      var proceso = sede.procesos[pr];
      if (!proceso.cargos) continue;
      totalCargos += proceso.cargos.length;
      for (var c = 0; c < proceso.cargos.length; c++) {
        var cargo = proceso.cargos[c];
        if (!cargo.peligros) continue;
        for (var pe = 0; pe < cargo.peligros.length; pe++) {
          var p = cargo.peligros[pe];
          total++;
          var nivel = p.nrNivel || 'I';
          if (porAcept[nivel] != null) porAcept[nivel]++;
          var tipo = p.tipo || 'Sin tipo';
          porTipo[tipo] = (porTipo[tipo] || 0) + 1;
          var sName = sede.nombre || 'Sin sede';
          porSede[sName] = (porSede[sName] || 0) + 1;
          var cKey = cargo.nombre + '@@' + sede.nombre;
          porCargo[cKey] = (porCargo[cKey] || 0) + 1;
          if (p.nr != null && p.nr > maxNR) maxNR = p.nr;
          if (nivel === 'IV' || nivel === 'V' || nivel === 'III') inaceptables++;
          if (p.nd != null && p.ne != null && p.nc != null) evaluados++;
        }
      }
    }
  }

  return {
    total: total,
    porAcept: porAcept,
    porTipo: porTipo,
    porSede: porSede,
    porCargo: porCargo,
    maxNR: maxNR,
    inaceptables: inaceptables,
    tasaInaceptable: total > 0 ? Math.round((inaceptables / total) * 100) : 0,
    totalSedes: totalSedes,
    totalProcesos: totalProcesos,
    totalCargos: totalCargos,
    evaluados: evaluados,
    tasaEvaluados: total > 0 ? Math.round((evaluados / total) * 100) : 0
  };
}

/* ─── Heat Map ND×NC ────────────────────────────────────────────────────── */

function _generarHeatMap(matriz) {
  var ndValues = [0, 1, 2, 3, 4, 5];
  var ncValues = [10, 20, 40, 60, 80, 100];
  var refNE = 2;
  var grid = [];

  for (var ndi = 0; ndi < ndValues.length; ndi++) {
    grid[ndi] = [];
    for (var nci = 0; nci < ncValues.length; nci++) {
      var np = ndValues[ndi] * refNE;
      var nr = np * ncValues[nci];
      var interp = _interpretarNR(nr);
      grid[ndi][nci] = { nd: ndValues[ndi], nc: ncValues[nci], np: np, nr: nr, nivel: interp.nivel, label: interp.label, color: interp.color, count: 0 };
    }
  }

  if (!matriz || !matriz.sedes) return grid;
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var pr = 0; pr < sede.procesos.length; pr++) {
      var proceso = sede.procesos[pr];
      if (!proceso.cargos) continue;
      for (var c = 0; c < proceso.cargos.length; c++) {
        var cargo = proceso.cargos[c];
        if (!cargo.peligros) continue;
        for (var pe = 0; pe < cargo.peligros.length; pe++) {
          var p = cargo.peligros[pe];
          if (p.nd == null || p.nc == null) continue;
          var ndIdx = ndValues.indexOf(Number(p.nd));
          var ncIdx = ncValues.indexOf(Number(p.nc));
          if (ndIdx >= 0 && ncIdx >= 0) {
            grid[ndIdx][ncIdx].count++;
          }
        }
      }
    }
  }

  return grid;
}

/* ─── Priorización ──────────────────────────────────────────────────────── */

function _generarPriorizacion(matriz) {
  var grupos = [
    { nivel: 'V', label: 'Inaceptable nivel 3', rango: '>200', color: 'morado', peligros: [] },
    { nivel: 'IV', label: 'Inaceptable nivel 2', rango: '121-200', color: 'rojo', peligros: [] },
    { nivel: 'III', label: 'Inaceptable nivel 1', rango: '41-120', color: 'naranja', peligros: [] },
    { nivel: 'II', label: 'Aceptable con control', rango: '11-40', color: 'amarillo', peligros: [] },
    { nivel: 'I', label: 'Aceptable', rango: '≤10', color: 'verde', peligros: [] }
  ];

  if (!matriz || !matriz.sedes) return grupos;
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var pr = 0; pr < sede.procesos.length; pr++) {
      var proceso = sede.procesos[pr];
      if (!proceso.cargos) continue;
      for (var c = 0; c < proceso.cargos.length; c++) {
        var cargo = proceso.cargos[c];
        if (!cargo.peligros) continue;
        for (var pe = 0; pe < cargo.peligros.length; pe++) {
          var p = cargo.peligros[pe];
          var nivel = p.nrNivel || 'I';
          for (var g = 0; g < grupos.length; g++) {
            if (grupos[g].nivel === nivel) {
grupos[g].peligros.push({
                  id: p.id,
                  tipo: p.tipo,
                  peligro: p.peligro,
                  efectosPosibles: p.efectosPosibles,
                  expuestos: p.expuestos != null ? p.expuestos : '',
                  sede: sede.nombre,
                  proceso: proceso.nombre,
                  cargo: cargo.nombre,
                  nd: p.nd,
                  ne: p.ne,
                  np: p.np,
                  nc: p.nc,
                  nr: p.nr,
                  npInterpretacion: p.npInterpretacion,
                  nrNivel: p.nrNivel,
                  nrLabel: p.nrLabel,
                  criterioEstablecido: p.criterioEstablecido || '',
                  fuente: p.fuente || '',
                  medio: p.medio || '',
                  individuo: p.individuo || '',
                  medidasExistenteFuente: p.medidasExistenteFuente || '',
                  medidasExistenteMedio: p.medidasExistenteMedio || '',
                  medidasExistenteIndividuo: p.medidasExistenteIndividuo || '',
                  medida: p.medidasIntervencion,
                  responsable: p.responsable,
                  plazo: p.plazo
                });
              break;
            }
          }
        }
      }
    }
  }

  return grupos;
}

/* ─── Notas Analíticas ──────────────────────────────────────────────────── */

function _generarNotasAnaliticas(matriz, stats) {
  var notas = [];
  if (!matriz || !matriz.sedes || !matriz.sedes.length) return notas;

  if (stats.inaceptables > 0) {
    notas.push(stats.inaceptables + ' peligro' + (stats.inaceptables > 1 ? 's' : '') + ' superan el nivel aceptable y requieren intervención inmediata.');
  }

  var sedesArr = Object.keys(stats.porSede);
  if (sedesArr.length > 1) {
    var maxSede = sedesArr[0];
    for (var i = 1; i < sedesArr.length; i++) {
      if (stats.porSede[sedesArr[i]] > stats.porSede[maxSede]) maxSede = sedesArr[i];
    }
    var pct = stats.total > 0 ? Math.round((stats.porSede[maxSede] / stats.total) * 100) : 0;
    notas.push('El ' + pct + '% de los peligros se concentran en la sede "' + maxSede + '".');
  }

  var tiposArr = Object.keys(stats.porTipo);
  if (tiposArr.length > 0) {
    var maxTipo = tiposArr[0];
    for (var j = 1; j < tiposArr.length; j++) {
      if (stats.porTipo[tiposArr[j]] > stats.porTipo[maxTipo]) maxTipo = tiposArr[j];
    }
    notas.push('El tipo de peligro más frecuente es "' + maxTipo + '" con ' + stats.porTipo[maxTipo] + ' registros.');
  }

  var cargosArr = Object.keys(stats.porCargo);
  if (cargosArr.length > 0) {
    var maxCargo = cargosArr[0];
    for (var k = 1; k < cargosArr.length; k++) {
      if (stats.porCargo[cargosArr[k]] > stats.porCargo[maxCargo]) maxCargo = cargosArr[k];
    }
    var cargoName = maxCargo.split('@@')[0];
    var cargoSede = maxCargo.split('@@')[1] || '';
    notas.push('El cargo "' + cargoName + '"' + (cargoSede ? ' en ' + cargoSede : '') + ' presenta ' + stats.porCargo[maxCargo] + ' peligros, el más alto del organigrama.');
  }

  if (stats.tasaInaceptable >= 30) {
    notas.push('La tasa de peligros inaceptables (' + stats.tasaInaceptable + '%) supera el 30%. Se recomienda priorizar medidas de intervención.');
  }

  return notas;
}

/* ─── JSON CRUD ─────────────────────────────────────────────────────────── */

function _getDataDir() {
  if (!_app) return null;
  var dataDir = path.join(_app.getPath('userData'), 'identificacion-peligros-data');
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) { return null; }
  }
  return dataDir;
}

function _getFilePath(companyName) {
  var dir = _getDataDir();
  if (!dir || !companyName) return null;
  var safe = companyName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ _-]/g, '_');
  return path.join(dir, safe + '-matriz.json');
}

function _readMatriz(companyName) {
  var filePath = _getFilePath(companyName);
  if (!filePath || !fs.existsSync(filePath)) {
    return _crearMatrizVacia(companyName);
  }
  try {
    var content = fs.readFileSync(filePath, 'utf8');
    var data = JSON.parse(content);
    if (!data.sedes) data.sedes = [];
    return data;
  } catch (e) {
    return _crearMatrizVacia(companyName);
  }
}

function _writeMatriz(companyName, matriz) {
  var filePath = _getFilePath(companyName);
  if (!filePath) return false;
  matriz.lastModified = new Date().toISOString();
  matriz.companyName = companyName;
  try {
    fs.writeFileSync(filePath, JSON.stringify(matriz, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

function _crearMatrizVacia(companyName) {
  return {
    version: 1,
    companyName: companyName || '',
    lastModified: new Date().toISOString(),
    metadata: {
      formatCode: 'GI-FO-019',
      version: 'V0',
      elaborado: '',
      revisado: '',
      aprobado: '',
      fecha: ''
    },
    _nextId: 1,
    sedes: []
  };
}

function _nextId(matriz, prefix) {
  if (!matriz._nextId) matriz._nextId = 1;
  var id = prefix + '_' + matriz._nextId;
  matriz._nextId++;
  return id;
}

function _findSede(matriz, sedeId) {
  for (var i = 0; i < matriz.sedes.length; i++) {
    if (matriz.sedes[i].id === sedeId) return { sede: matriz.sedes[i], index: i };
  }
  return null;
}

function _findProceso(matriz, procesoId) {
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var p = 0; p < sede.procesos.length; p++) {
      if (sede.procesos[p].id === procesoId) return { proceso: sede.procesos[p], sedeIndex: s, procIndex: p };
    }
  }
  return null;
}

function _findCargo(matriz, cargoId) {
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var p = 0; p < sede.procesos.length; p++) {
      var proc = sede.procesos[p];
      if (!proc.cargos) continue;
      for (var c = 0; c < proc.cargos.length; c++) {
        if (proc.cargos[c].id === cargoId) return { cargo: proc.cargos[c], sedeIndex: s, procIndex: p, cargoIndex: c };
      }
    }
  }
  return null;
}

function _findPeligro(matriz, peligroId) {
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var p = 0; p < sede.procesos.length; p++) {
      var proc = sede.procesos[p];
      if (!proc.cargos) continue;
      for (var c = 0; c < proc.cargos.length; c++) {
        var cargo = proc.cargos[c];
        if (!cargo.peligros) continue;
        for (var pe = 0; pe < cargo.peligros.length; pe++) {
          if (cargo.peligros[pe].id === peligroId) {
            return { peligro: cargo.peligros[pe], sedeIndex: s, procIndex: p, cargoIndex: c, peligroIndex: pe };
          }
        }
      }
    }
  }
  return null;
}

/* ─── Operaciones CRUD ──────────────────────────────────────────────────── */

function _addSede(matriz, nombre) {
  var id = _nextId(matriz, 'sed');
  var sede = { id: id, nombre: nombre || 'Nueva Sede', procesos: [] };
  matriz.sedes.push(sede);
  return sede;
}

function _addProceso(matriz, sedeId, nombre) {
  var found = _findSede(matriz, sedeId);
  if (!found) return null;
  var id = _nextId(matriz, 'pro');
  var proceso = { id: id, nombre: nombre || 'Nuevo Proceso', cargos: [] };
  if (!found.sede.procesos) found.sede.procesos = [];
  found.sede.procesos.push(proceso);
  return proceso;
}

function _addCargo(matriz, procesoId, nombre) {
  var found = _findProceso(matriz, procesoId);
  if (!found) return null;
  var id = _nextId(matriz, 'car');
  var cargo = { id: id, nombre: nombre || 'Nuevo Cargo', zona: '', actividades: '', tareas: '', rutinaria: null, peligros: [] };
  if (!found.proceso.cargos) found.proceso.cargos = [];
  found.proceso.cargos.push(cargo);
  return cargo;
}

function _addPeligro(matriz, cargoId, data) {
  var found = _findCargo(matriz, cargoId);
  if (!found) return null;
  var id = _nextId(matriz, 'pel');
  var peligro = {
    id: id,
    tipo: (data && data.tipo) || 'Físico',
    peligro: (data && data.peligro) || '',
    efectosPosibles: (data && data.efectosPosibles) || '',
    nd: (data && data.nd != null) ? Number(data.nd) : null,
    ne: (data && data.ne != null) ? Number(data.ne) : null,
    nc: (data && data.nc != null) ? Number(data.nc) : null,
    expuestos: (data && data.expuestos != null) ? Number(data.expuestos) : null,
  criterioEstablecido: (data && data.criterioEstablecido) || '',
  fuente: (data && data.fuente) || '',
  medio: (data && data.medio) || '',
  individuo: (data && data.individuo) || '',
  medidasExistenteFuente: (data && data.medidasExistenteFuente) || '',
  medidasExistenteMedio: (data && data.medidasExistenteMedio) || '',
  medidasExistenteIndividuo: (data && data.medidasExistenteIndividuo) || '',
    medidasIntervencion: (data && data.medidasIntervencion) || '',
    peorConsecuencia: (data && data.peorConsecuencia) || '',
    responsable: (data && data.responsable) || '',
  plazo: (data && data.plazo) || '',
  observaciones: (data && data.observaciones) || ''
  };
  _enriquecerPeligro(peligro);
  if (!found.cargo.peligros) found.cargo.peligros = [];
  found.cargo.peligros.push(peligro);
  return peligro;
}

function _updatePeligro(matriz, peligroId, cambios) {
  var found = _findPeligro(matriz, peligroId);
  if (!found) return null;
  var p = found.peligro;
  var editableFields = [
    'tipo', 'peligro', 'efectosPosibles', 'nd', 'ne', 'nc',
    'expuestos', 'criterioEstablecido', 'fuente', 'medio', 'individuo',
    'medidasExistenteFuente', 'medidasExistenteMedio', 'medidasExistenteIndividuo',
    'medidasIntervencion', 'peorConsecuencia', 'responsable', 'plazo', 'observaciones'
  ];
  for (var i = 0; i < editableFields.length; i++) {
    if (cambios[editableFields[i]] !== undefined) {
      var val = cambios[editableFields[i]];
      if (editableFields[i] === 'nd' || editableFields[i] === 'ne' || editableFields[i] === 'nc' || editableFields[i] === 'expuestos') {
        val = val != null ? Number(val) : null;
      }
      p[editableFields[i]] = val;
    }
  }
  _enriquecerPeligro(p);
  return p;
}

function _deletePeligro(matriz, peligroId) {
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var p = 0; p < sede.procesos.length; p++) {
      var proc = sede.procesos[p];
      if (!proc.cargos) continue;
      for (var c = 0; c < proc.cargos.length; c++) {
        var cargo = proc.cargos[c];
        if (!cargo.peligros) continue;
        for (var pe = cargo.peligros.length - 1; pe >= 0; pe--) {
          if (cargo.peligros[pe].id === peligroId) {
            cargo.peligros.splice(pe, 1);
            return true;
          }
        }
      }
    }
  }
  return false;
}

function _deleteCargo(matriz, cargoId) {
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var p = 0; p < sede.procesos.length; p++) {
      var proc = sede.procesos[p];
      if (!proc.cargos) continue;
      for (var c = proc.cargos.length - 1; c >= 0; c--) {
        if (proc.cargos[c].id === cargoId) {
          proc.cargos.splice(c, 1);
          return true;
        }
      }
    }
  }
  return false;
}

function _deleteProceso(matriz, procesoId) {
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var p = sede.procesos.length - 1; p >= 0; p--) {
      if (sede.procesos[p].id === procesoId) {
        sede.procesos.splice(p, 1);
        return true;
      }
    }
  }
  return false;
}

function _deleteSede(matriz, sedeId) {
  for (var i = matriz.sedes.length - 1; i >= 0; i--) {
    if (matriz.sedes[i].id === sedeId) {
      matriz.sedes.splice(i, 1);
      return true;
    }
  }
  return false;
}

function _renameSede(matriz, sedeId, nombre) {
  var found = _findSede(matriz, sedeId);
  if (!found) return false;
  found.sede.nombre = nombre;
  return true;
}

function _renameProceso(matriz, procesoId, nombre) {
  var found = _findProceso(matriz, procesoId);
  if (!found) return false;
  found.proceso.nombre = nombre;
  return true;
}

function _renameCargo(matriz, cargoId, nombre) {
  var found = _findCargo(matriz, cargoId);
  if (!found) return false;
  found.cargo.nombre = nombre;
  return true;
}

function _updateCargo(matriz, cargoId, cambios) {
  var found = _findCargo(matriz, cargoId);
  if (!found) return null;
  var c = found.cargo;
  var editableFields = ['zona', 'actividades', 'tareas', 'rutinaria'];
  for (var i = 0; i < editableFields.length; i++) {
    if (cambios[editableFields[i]] !== undefined) {
      c[editableFields[i]] = cambios[editableFields[i]];
    }
  }
  return c;
}

/* ─── Import XLSX ──────────────────────────────────────────────────────── */

function _getCompanyPeligrosDir(companyRoot) {
	var gestionDir = path.join(companyRoot, '4. Gestion de Peligros y Riesgos');
	if (!fs.existsSync(gestionDir)) {
		gestionDir = path.join(companyRoot, '4. Gestión de Peligros y Riesgos');
	}
	if (fs.existsSync(gestionDir)) {
		try {
			var entries = fs.readdirSync(gestionDir);
			var peligrosFolder = entries.find(function(f) { return f.startsWith('4.1.2'); });
			if (peligrosFolder) return path.join(gestionDir, peligrosFolder);
		} catch (e) { /* ignore */ }
	}
	var directPath = path.join(companyRoot, '4.1.2');
	if (fs.existsSync(directPath)) return directPath;
	if (fs.existsSync(companyRoot)) {
		try {
			var rootEntries = fs.readdirSync(companyRoot);
			var gestionFolder = rootEntries.find(function(f) { return f.startsWith('4.'); });
			if (gestionFolder) {
				var gestionFullPath = path.join(companyRoot, gestionFolder);
				var subEntries = fs.readdirSync(gestionFullPath);
				var pelFolder = subEntries.find(function(f) { return f.startsWith('4.1.2'); });
				if (pelFolder) return path.join(gestionFullPath, pelFolder);
			}
		} catch (e) { /* ignore */ }
	}
	return path.join(companyRoot, '4. Gestion de Peligros y Riesgos', '4.1.2 Identificación de Peligros');
}

function _findMatrizXlsx(dir) {
	if (!dir || !fs.existsSync(dir)) return null;
	var files = fs.readdirSync(dir);
	for (var i = 0; i < files.length; i++) {
		var f = files[i];
		var full = path.join(dir, f);
		try { if (!fs.statSync(full).isFile()) continue; } catch (e) { continue; }
		var lower = f.toLowerCase();
		if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
			var upper = f.toUpperCase();
			if (upper.indexOf('PELIGRO') !== -1 || upper.indexOf('MATRIZ') !== -1 || upper.indexOf('GTC') !== -1 || upper.indexOf('IDENTIFICACI') !== -1) {
				return full;
			}
		}
	}
	for (var j = 0; j < files.length; j++) {
		var f2 = files[j];
		var full2 = path.join(dir, f2);
		try { if (!fs.statSync(full2).isFile()) continue; } catch (e) { continue; }
		var lower2 = f2.toLowerCase();
		if (lower2.endsWith('.xlsx') || lower2.endsWith('.xls')) return full2;
	}
	return null;
}

function _parseMatrizXlsx(filePath) {
	var workbook = xlsx.readFile(filePath, { type: 'file' });
	var sheetName = null;
	for (var si = 0; si < workbook.SheetNames.length; si++) {
		var sn = workbook.SheetNames[si].toUpperCase();
		if (sn.indexOf('MATRIZ') !== -1 || sn.indexOf('PELIGRO') !== -1 || sn.indexOf('GTC') !== -1 || sn.indexOf('IDENTIFICACI') !== -1) {
			sheetName = workbook.SheetNames[si];
			break;
		}
	}
	if (!sheetName) sheetName = workbook.SheetNames[0];
	var ws = workbook.Sheets[sheetName];
	var rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  var HEADER_KEYWORDS = {
    sede: ['SEDE'],
    proceso: ['PROCESO', 'AREA', 'ÁREA'],
    cargo: ['CARGO', 'OCUPACION', 'OCUPACIÓN', 'PUESTO'],
    zona: ['ZONA', 'LUGAR', 'ZONA/LUGAR'],
    actividades: ['ACTIVIDADES'],
    tareas: ['TAREAS', 'TAREA'],
    rutinaria: ['RUTINARIA', 'RUTINARIO'],
    tipo: ['TIPO DE PELIGRO', 'TIPO DE RIESGO', 'CLASIFICACION', 'CLASIFICACIÓN', 'TIPO'],
    peligro: ['DESCRIPCION DEL PELIGRO', 'DESCRIPCIÓN DEL PELIGRO', 'FACTOR DE RIESGO', 'DESCRIPCION', 'DESCRIPCIÓN'],
    efectosPosibles: ['EFECTOS POSIBLES', 'EFECTO', 'POSIBLES DAÑOS', 'CONSECUENCIA'],
    nd: ['ND', 'NIVEL DE DEFICIENCIA'],
    ne: ['NE', 'NIVEL DE EXPOSICION', 'NIVEL DE EXPOSICIÓN'],
    np: ['NP', 'NIVEL DE PROBABILIDAD'],
    npInterpretacion: ['INTERPRETACION NP', 'INTERPRETACIÓN NP'],
    nc: ['NC', 'NIVEL DE CONSECUENCIA'],
    nr: ['NR', 'NIVEL DE RIESGO'],
    nrLabel: ['ACEPTABILIDAD', 'NIVEL DE RIESGO Y ACEPTABILIDAD'],
    criterioEstablecido: ['CRITERIO ESTABLECIDO', 'CRITERIO DE LAS CONSECUENCIAS', 'CRITERIOS PARA ESTABLECER CONTROLES', 'CRITERIOS'],
    fuente: ['FUENTE', 'MEDIDA FUENTE'],
    medio: ['MEDIO', 'MEDIDA MEDIO', 'MEDIO AMBIENTE', 'MEDIO DE TRANSMISION', 'MEDIO DE TRANSMISIÓN'],
    individuo: ['INDIVIDUO', 'MEDIDA INDIVIDUO', 'TRABAJADOR'],
    medidasExistenteFuente: ['MEDIDAS EXISTENTES FUENTE', 'MEDIDAS DE CONTROL FUENTE', 'CONTROL FUENTE'],
    medidasExistenteMedio: ['MEDIDAS EXISTENTES MEDIO', 'MEDIDAS DE CONTROL MEDIO', 'CONTROL MEDIO'],
    medidasExistenteIndividuo: ['MEDIDAS EXISTENTES INDIVIDUO', 'MEDIDAS DE CONTROL INDIVIDUO', 'CONTROL INDIVIDUO'],
    eliminacion: ['ELIMINACION', 'ELIMINACIÓN'],
    sustitucion: ['SUSTITUCION', 'SUSTITUCIÓN'],
    controlIngenieria: ['CONTROLES DE INGENIERÍA', 'CONTROLES DE INGENIERIA', 'CONTROL DE INGENIERÍA', 'CONTROL DE INGENIERIA'],
    senalizacion: ['SEÑALIZACIÓN', 'SEÑALIZACION', 'SEÑALIZACIÓN/ADVERTENCIA', 'SEÑALIZACION/ADVERTENCIA', 'SEÑALIZACIÓN. ADVERTENCIA', 'SEÑALIZACION. ADVERTENCIA'],
    epp: ['EPP', 'EQUIPOS DE PROTECCIÓN PERSONAL', 'EQUIPOS DE PROTECCION PERSONAL', 'EQUIPO DE PROTECCIÓN PERSONAL'],
    expuestos: ['NRO EXPUESTOS', 'NRO. EXPUESTOS', 'NÚMERO DE EXPUESTOS', 'NUMERO DE EXPUESTOS', 'EXPUESTOS'],
    peorConsecuencia: ['PEOR CONSECUENCIA'],
    responsable: ['RESPONSABLE'],
    plazo: ['PLAZO'],
    observaciones: ['OBSERVACIONES', 'OBSERVACION', 'OBSERVACIÓN']
  };

  var SKIP_FIELDS = { np: true, npInterpretacion: true, nr: true, nrLabel: true };
  var SUB_HEADER_FIELDS = { nd: true, ne: true, nc: true, nr: true, nrLabel: true, tipo: true, peligro: true, fuente: true, medio: true, individuo: true, np: true, npInterpretacion: true, expuestos: true, eliminacion: true, sustitucion: true, controlIngenieria: true, senalizacion: true, epp: true, peorConsecuencia: true };

  function _scanRow(row) {
    if (!row || !row.length) return { trial: {}, matches: 0 };
    var matches = 0;
    var trial = {};
    var cellScores = [];
    for (var c = 0; c < row.length; c++) {
      var cell = String(row[c] || '').toUpperCase().trim();
      if (!cell) continue;
      for (var field in HEADER_KEYWORDS) {
        var keywords = HEADER_KEYWORDS[field];
        var bestScore = 0;
        for (var k = 0; k < keywords.length; k++) {
          var kw = keywords[k];
          var score = 0;
          if (cell === kw) {
            score = 100;
          } else if (cell.indexOf(kw) !== -1 && kw.length >= cell.length * 0.3) {
            score = (kw.length / cell.length) * 70;
          } else if (kw.indexOf(cell) !== -1 && cell.length >= Math.min(kw.length * 0.5, 6)) {
            score = (cell.length / kw.length) * 50;
          }
          if (score > bestScore) bestScore = score;
        }
        if (bestScore > 0) {
          cellScores.push({ field: field, col: c, score: bestScore });
        }
      }
    }
    cellScores.sort(function(a, b) { return b.score - a.score; });
    var usedCols = {};
    for (var i = 0; i < cellScores.length; i++) {
      var cs = cellScores[i];
      if (trial[cs.field]) continue;
      if (usedCols[cs.col]) continue;
      if (cs.score < 15) continue;
      trial[cs.field] = cs.col;
      usedCols[cs.col] = true;
      matches++;
    }
    return { trial: trial, matches: matches };
  }

  var headerRowIdx = -1;
  var colMap = {};
  var groupRowIdx = -1;
  var groupTrial = {};

  for (var r = 0; r < Math.min(rows.length, 15); r++) {
    var scan = _scanRow(rows[r]);
    if (scan.matches >= 3 && (scan.trial.sede != null || scan.trial.proceso != null || scan.trial.cargo != null)) {
      groupRowIdx = r;
      groupTrial = scan.trial;
      break;
    }
  }

  if (groupRowIdx === -1) {
    return { success: false, error: 'No se encontró fila de encabezados GTC-45 en el archivo', rowsImported: 0, errors: [] };
  }

  colMap = {};
  for (var f in groupTrial) { colMap[f] = groupTrial[f]; }

  var subRowIdx = -1;
  for (var sr = groupRowIdx + 1; sr < Math.min(rows.length, groupRowIdx + 4); sr++) {
    var subScan = _scanRow(rows[sr]);
    var subFieldCount = 0;
    for (var sf in SUB_HEADER_FIELDS) {
      if (subScan.trial[sf] != null) subFieldCount++;
    }
    if (subFieldCount >= 3) {
      subRowIdx = sr;
      for (var sf2 in subScan.trial) {
        colMap[sf2] = subScan.trial[sf2];
      }
      break;
    }
  }

  headerRowIdx = groupRowIdx;
  var startRow = (subRowIdx !== -1) ? subRowIdx + 1 : groupRowIdx + 1;
	var sedesCreated = 0;
	var procesosCreated = 0;
	var cargosCreated = 0;
	var rowsImported = 0;
	var parseErrors = [];

	var lastSede = '';
	var lastProceso = '';
	var lastCargo = '';

	var matriz = _crearMatrizVacia('');
	var sedeMap = {};
	var procesoMap = {};
	var cargoMap = {};

	for (var dr = startRow; dr < rows.length; dr++) {
		var dataRow = rows[dr];
		if (!dataRow || !dataRow.length) continue;

		var sedeVal = colMap.sede != null ? String(dataRow[colMap.sede] || '').trim() : '';
		var procesoVal = colMap.proceso != null ? String(dataRow[colMap.proceso] || '').trim() : '';
		var cargoVal = colMap.cargo != null ? String(dataRow[colMap.cargo] || '').trim() : '';

		if (sedeVal) lastSede = sedeVal;
		else sedeVal = lastSede;
		if (procesoVal) lastProceso = procesoVal;
		else procesoVal = lastProceso;
		if (cargoVal) lastCargo = cargoVal;
		else cargoVal = lastCargo;

  var peligroVal = colMap.peligro != null ? String(dataRow[colMap.peligro] || '').trim() : '';
  var tipoVal = colMap.tipo != null ? String(dataRow[colMap.tipo] || '').trim() : '';
  if (!peligroVal && !tipoVal && !sedeVal && !procesoVal && !cargoVal) continue;
  if (!peligroVal && !tipoVal) continue;

  function _normalizarTipo(val) {
    if (!val) return null;
    for (var pt = 0; pt < TIPOS_PELIGRO.length; pt++) {
      if (val.toUpperCase() === TIPOS_PELIGRO[pt].toUpperCase()) return TIPOS_PELIGRO[pt];
    }
    for (var nm = 0; nm < TIPO_NORMALIZE_MAP.length; nm++) {
      if (TIPO_NORMALIZE_MAP[nm].pattern.test(val)) return TIPO_NORMALIZE_MAP[nm].tipo;
    }
    return null;
  }

  function _esTipoExacto(val) {
    if (!val) return false;
    for (var pt = 0; pt < TIPOS_PELIGRO.length; pt++) {
      if (val.toUpperCase() === TIPOS_PELIGRO[pt].toUpperCase()) return true;
    }
    return false;
  }

  var peligroEsTipoExacto = _esTipoExacto(peligroVal);
  var tipoEsTipoExacto = _esTipoExacto(tipoVal);

  if (peligroEsTipoExacto && !tipoEsTipoExacto) {
    var _swap = peligroVal;
    peligroVal = tipoVal;
    tipoVal = _swap;
  }

  var matchedTipo = _normalizarTipo(tipoVal);
  if (!matchedTipo) matchedTipo = tipoVal || 'Físico';

		if (!sedeVal) sedeVal = 'Sede Principal';
		if (!procesoVal) procesoVal = 'General';
		if (!cargoVal) cargoVal = 'General';

		var sedeKey = sedeVal;
		if (!sedeMap[sedeKey]) {
			var newSede = _addSede(matriz, sedeVal);
			sedeMap[sedeKey] = newSede.id;
			sedesCreated++;
		}

		var procesoKey = sedeKey + '|' + procesoVal;
		if (!procesoMap[procesoKey]) {
			var newProc = _addProceso(matriz, sedeMap[sedeKey], procesoVal);
			if (newProc) {
				procesoMap[procesoKey] = newProc.id;
				procesosCreated++;
			}
		}

  var cargoKey = procesoKey + '|' + cargoVal;
  if (!cargoMap[cargoKey]) {
    if (procesoMap[procesoKey]) {
      var newCargo = _addCargo(matriz, procesoMap[procesoKey], cargoVal);
      if (newCargo) {
        if (colMap.zona != null) newCargo.zona = String(dataRow[colMap.zona] || '').trim();
        if (colMap.actividades != null) newCargo.actividades = String(dataRow[colMap.actividades] || '').trim();
        if (colMap.tareas != null) newCargo.tareas = String(dataRow[colMap.tareas] || '').trim();
        if (colMap.rutinaria != null) {
          var rutVal = String(dataRow[colMap.rutinaria] || '').trim().toUpperCase();
          newCargo.rutinaria = (rutVal === 'SI' || rutVal === 'SÍ' || rutVal === '1' || rutVal === 'YES') ? true : (rutVal === 'NO' || rutVal === '0') ? false : null;
        }
        cargoMap[cargoKey] = newCargo.id;
        cargosCreated++;
      }
    }
  }

		function _getCell(field) {
			if (colMap[field] == null) return '';
			return String(dataRow[colMap[field]] || '').trim();
		}

		function _getNum(field) {
			var raw = _getCell(field);
			if (!raw) return null;
			var n = Number(raw);
			return isNaN(n) ? null : n;
		}

  var _intervParts = [];
  var _intervFields = ['eliminacion', 'sustitucion', 'controlIngenieria', 'senalizacion', 'epp'];
  for (var iv = 0; iv < _intervFields.length; iv++) {
    var ivVal = _getCell(_intervFields[iv]);
    if (ivVal) _intervParts.push(ivVal);
  }
  var _medidasIntervencion = _intervParts.length > 0 ? _intervParts.join('; ') : _getCell('medidasIntervencion');

  var peligroData = {
    tipo: matchedTipo,
    peligro: peligroVal,
    efectosPosibles: _getCell('efectosPosibles'),
    expuestos: _getNum('expuestos'),
    nd: _getNum('nd'),
    ne: _getNum('ne'),
    nc: _getNum('nc'),
    criterioEstablecido: _getCell('criterioEstablecido'),
    fuente: _getCell('fuente'),
    medio: _getCell('medio'),
    individuo: _getCell('individuo'),
    medidasExistenteFuente: _getCell('medidasExistenteFuente'),
    medidasExistenteMedio: _getCell('medidasExistenteMedio'),
    medidasExistenteIndividuo: _getCell('medidasExistenteIndividuo'),
    medidasIntervencion: _medidasIntervencion,
    peorConsecuencia: _getCell('peorConsecuencia'),
    responsable: _getCell('responsable'),
    plazo: _getCell('plazo'),
    observaciones: _getCell('observaciones')
  };

		if (peligroData.nd != null) {
			if (peligroData.nd < 0) peligroData.nd = 0;
			if (peligroData.nd > 5) peligroData.nd = 5;
		}
		if (peligroData.ne != null) {
			if (peligroData.ne < 1) peligroData.ne = 1;
			if (peligroData.ne > 4) peligroData.ne = 4;
		}
		if (peligroData.nc != null) {
			var ncValid = [10, 20, 40, 60, 80, 100];
			var ncClosest = null;
			var ncMinDiff = Infinity;
			for (var ni = 0; ni < ncValid.length; ni++) {
				var diff = Math.abs(peligroData.nc - ncValid[ni]);
				if (diff < ncMinDiff) { ncMinDiff = diff; ncClosest = ncValid[ni]; }
			}
			if (ncMinDiff <= 5) peligroData.nc = ncClosest;
			else if (peligroData.nc >= 80) peligroData.nc = 80;
			else if (peligroData.nc >= 60) peligroData.nc = 60;
			else if (peligroData.nc >= 40) peligroData.nc = 40;
			else if (peligroData.nc >= 20) peligroData.nc = 20;
			else peligroData.nc = 10;
		}

		if (cargoMap[cargoKey]) {
			_addPeligro(matriz, cargoMap[cargoKey], peligroData);
			rowsImported++;
		} else {
			parseErrors.push('Fila ' + (dr + 1) + ': no se pudo crear cargo para "' + cargoVal + '"');
		}
	}

	_enriquecerMatriz(matriz);

	return {
		success: true,
		matriz: matriz,
		rowsImported: rowsImported,
		sedesCreated: sedesCreated,
		procesosCreated: procesosCreated,
		cargosCreated: cargosCreated,
		errors: parseErrors
	};
}

/* ─── Registro de Handlers IPC ─────────────────────────────────────────── */

function registerIdentificacionPeligrosHandlers(app, deps) {
  _app = app;
  _getCompanyRootPath = (deps && deps.getCompanyRootPath) ? deps.getCompanyRootPath : null;

  var ipcMain = require('electron').ipcMain;

  ipcMain.handle('matriz-peligros:read', async function(_e, companyName) {
    try {
      var matriz = _readMatriz(companyName);
      _enriquecerMatriz(matriz);
      var stats = _calcularStats(matriz);
      return { success: true, data: { matriz: matriz, stats: stats } };
    } catch (e) {
      return { success: false, error: { code: 'READ_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:save', async function(_e, companyName, matrizData) {
    try {
      var ok = _writeMatriz(companyName, matrizData);
      if (!ok) return { success: false, error: { code: 'WRITE_ERROR', message: 'Error al guardar matriz' } };
      var fresh = _readMatriz(companyName);
      _enriquecerMatriz(fresh);
      return { success: true, data: { matriz: fresh } };
    } catch (e) {
      return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:add-sede', async function(_e, companyName, nombre) {
    try {
      var matriz = _readMatriz(companyName);
      var sede = _addSede(matriz, nombre);
      _writeMatriz(companyName, matriz);
      return { success: true, data: { id: sede.id, nombre: sede.nombre } };
    } catch (e) {
      return { success: false, error: { code: 'ADD_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:add-proceso', async function(_e, companyName, sedeId, nombre) {
    try {
      var matriz = _readMatriz(companyName);
      var proceso = _addProceso(matriz, sedeId, nombre);
      if (!proceso) return { success: false, error: { code: 'NOT_FOUND', message: 'Sede no encontrada' } };
      _writeMatriz(companyName, matriz);
      return { success: true, data: { id: proceso.id, nombre: proceso.nombre } };
    } catch (e) {
      return { success: false, error: { code: 'ADD_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:add-cargo', async function(_e, companyName, procesoId, nombre) {
    try {
      var matriz = _readMatriz(companyName);
      var cargo = _addCargo(matriz, procesoId, nombre);
      if (!cargo) return { success: false, error: { code: 'NOT_FOUND', message: 'Proceso no encontrado' } };
      _writeMatriz(companyName, matriz);
      return { success: true, data: { id: cargo.id, nombre: cargo.nombre } };
    } catch (e) {
      return { success: false, error: { code: 'ADD_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:add-peligro', async function(_e, companyName, cargoId, peligroData) {
    try {
      var matriz = _readMatriz(companyName);
      var peligro = _addPeligro(matriz, cargoId, peligroData);
      if (!peligro) return { success: false, error: { code: 'NOT_FOUND', message: 'Cargo no encontrado' } };
      _writeMatriz(companyName, matriz);
      return { success: true, data: peligro };
    } catch (e) {
      return { success: false, error: { code: 'ADD_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:update-peligro', async function(_e, companyName, peligroId, cambios) {
    try {
      var matriz = _readMatriz(companyName);
      var updated = _updatePeligro(matriz, peligroId, cambios);
      if (!updated) return { success: false, error: { code: 'NOT_FOUND', message: 'Peligro no encontrado' } };
      _writeMatriz(companyName, matriz);
      return { success: true, data: updated };
    } catch (e) {
      return { success: false, error: { code: 'UPDATE_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:delete-peligro', async function(_e, companyName, peligroId) {
    try {
      var matriz = _readMatriz(companyName);
      var ok = _deletePeligro(matriz, peligroId);
      if (!ok) return { success: false, error: { code: 'NOT_FOUND', message: 'Peligro no encontrado' } };
      _writeMatriz(companyName, matriz);
      return { success: true };
    } catch (e) {
      return { success: false, error: { code: 'DELETE_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:delete-cargo', async function(_e, companyName, cargoId) {
    try {
      var matriz = _readMatriz(companyName);
      var ok = _deleteCargo(matriz, cargoId);
      if (!ok) return { success: false, error: { code: 'NOT_FOUND', message: 'Cargo no encontrado' } };
      _writeMatriz(companyName, matriz);
      return { success: true };
    } catch (e) {
      return { success: false, error: { code: 'DELETE_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:delete-proceso', async function(_e, companyName, procesoId) {
    try {
      var matriz = _readMatriz(companyName);
      var ok = _deleteProceso(matriz, procesoId);
      if (!ok) return { success: false, error: { code: 'NOT_FOUND', message: 'Proceso no encontrado' } };
      _writeMatriz(companyName, matriz);
      return { success: true };
    } catch (e) {
      return { success: false, error: { code: 'DELETE_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:delete-sede', async function(_e, companyName, sedeId) {
    try {
      var matriz = _readMatriz(companyName);
      var ok = _deleteSede(matriz, sedeId);
      if (!ok) return { success: false, error: { code: 'NOT_FOUND', message: 'Sede no encontrada' } };
      _writeMatriz(companyName, matriz);
      return { success: true };
    } catch (e) {
      return { success: false, error: { code: 'DELETE_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:rename-sede', async function(_e, companyName, sedeId, nombre) {
    try {
      var matriz = _readMatriz(companyName);
      var ok = _renameSede(matriz, sedeId, nombre);
      if (!ok) return { success: false, error: { code: 'NOT_FOUND', message: 'Sede no encontrada' } };
      _writeMatriz(companyName, matriz);
      return { success: true };
    } catch (e) {
      return { success: false, error: { code: 'UPDATE_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:rename-proceso', async function(_e, companyName, procesoId, nombre) {
    try {
      var matriz = _readMatriz(companyName);
      var ok = _renameProceso(matriz, procesoId, nombre);
      if (!ok) return { success: false, error: { code: 'NOT_FOUND', message: 'Proceso no encontrado' } };
      _writeMatriz(companyName, matriz);
      return { success: true };
    } catch (e) {
      return { success: false, error: { code: 'UPDATE_ERROR', message: e.message } };
    }
  });

ipcMain.handle('matriz-peligros:rename-cargo', async function(_e, companyName, cargoId, nombre) {
  try {
    var matriz = _readMatriz(companyName);
    var ok = _renameCargo(matriz, cargoId, nombre);
    if (!ok) return { success: false, error: { code: 'NOT_FOUND', message: 'Cargo no encontrado' } };
    _writeMatriz(companyName, matriz);
    return { success: true };
  } catch (e) {
    return { success: false, error: { code: 'UPDATE_ERROR', message: e.message } };
  }
});

ipcMain.handle('matriz-peligros:update-cargo', async function(_e, companyName, cargoId, cambios) {
  try {
    var matriz = _readMatriz(companyName);
    var updated = _updateCargo(matriz, cargoId, cambios);
    if (!updated) return { success: false, error: { code: 'NOT_FOUND', message: 'Cargo no encontrado' } };
    _writeMatriz(companyName, matriz);
    return { success: true, data: updated };
  } catch (e) {
    return { success: false, error: { code: 'UPDATE_ERROR', message: e.message } };
  }
});

  ipcMain.handle('matriz-peligros:stats', async function(_e, companyName) {
    try {
      var matriz = _readMatriz(companyName);
      _enriquecerMatriz(matriz);
      var stats = _calcularStats(matriz);
      return { success: true, data: stats };
    } catch (e) {
      return { success: false, error: { code: 'STATS_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:heatmap', async function(_e, companyName) {
    try {
      var matriz = _readMatriz(companyName);
      _enriquecerMatriz(matriz);
      var heatmap = _generarHeatMap(matriz);
      return { success: true, data: heatmap };
    } catch (e) {
      return { success: false, error: { code: 'HEATMAP_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:priorizacion', async function(_e, companyName) {
    try {
      var matriz = _readMatriz(companyName);
      _enriquecerMatriz(matriz);
      var grupos = _generarPriorizacion(matriz);
      return { success: true, data: grupos };
    } catch (e) {
      return { success: false, error: { code: 'PRIOR_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:metadata', async function(_e, companyName) {
    try {
      var matriz = _readMatriz(companyName);
      return { success: true, data: matriz.metadata || {} };
    } catch (e) {
      return { success: false, error: { code: 'READ_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:update-metadata', async function(_e, companyName, metadata) {
    try {
      var matriz = _readMatriz(companyName);
      matriz.metadata = metadata;
      _writeMatriz(companyName, matriz);
      return { success: true };
    } catch (e) {
      return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:notas-analiticas', async function(_e, companyName) {
    try {
      var matriz = _readMatriz(companyName);
      _enriquecerMatriz(matriz);
      var stats = _calcularStats(matriz);
      var notas = _generarNotasAnaliticas(matriz, stats);
      return { success: true, data: notas };
    } catch (e) {
      return { success: false, error: { code: 'NOTAS_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:gtc45-options', async function() {
    return {
      success: true,
      data: {
        nd: ND_OPTIONS,
        ne: NE_OPTIONS,
        nc: NC_OPTIONS,
        tipos: TIPOS_PELIGRO
      }
    };
  });

  ipcMain.handle('matriz-peligros:discover-xlsx', async function(_e, companyName) {
    try {
var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
			if (!companyRoot) return { success: false, error: { code: 'NO_COMPANY', message: 'No se encontró la ruta de la empresa' } };
			var dir = _getCompanyPeligrosDir(companyRoot);
			var filePath = _findMatrizXlsx(dir);
      if (!filePath) return { success: true, data: { found: false, filePath: null, fileName: null } };
      return { success: true, data: { found: true, filePath: filePath, fileName: path.basename(filePath) } };
    } catch (e) {
      return { success: false, error: { code: 'DISCOVER_ERROR', message: e.message } };
    }
  });

  ipcMain.handle('matriz-peligros:import-xlsx', async function(_e, companyName, filePath) {
    try {
      if (!filePath) {
var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
			if (!companyRoot) return { success: false, error: { code: 'NO_COMPANY', message: 'No se encontró la ruta de la empresa' } };
			var dir = _getCompanyPeligrosDir(companyRoot);
			filePath = _findMatrizXlsx(dir);
      }
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'No se encontró archivo .xlsx en la carpeta 4.1.2 de la empresa' } };
      }
      var parsed = _parseMatrizXlsx(filePath);
      if (!parsed.success) {
        return { success: false, error: { code: 'PARSE_ERROR', message: parsed.error } };
      }
      var existing = _readMatriz(companyName);
      if (!existing.sedes) existing.sedes = [];
	var importSedes = parsed.matriz && parsed.matriz.sedes ? parsed.matriz.sedes : [];
	for (var s = 0; s < importSedes.length; s++) {
		var srcSede = importSedes[s];
        var existingSede = null;
        for (var es = 0; es < existing.sedes.length; es++) {
          if (existing.sedes[es].nombre === srcSede.nombre) { existingSede = existing.sedes[es]; break; }
        }
        if (!existingSede) {
          var newSede = _addSede(existing, srcSede.nombre);
          existingSede = newSede;
        }
	if (!existingSede.procesos) existingSede.procesos = [];
	if (!srcSede.procesos) continue;
	for (var p = 0; p < srcSede.procesos.length; p++) {
          var srcProc = srcSede.procesos[p];
          var existingProc = null;
          for (var ep = 0; ep < existingSede.procesos.length; ep++) {
            if (existingSede.procesos[ep].nombre === srcProc.nombre) { existingProc = existingSede.procesos[ep]; break; }
          }
          if (!existingProc) {
            var newProc = _addProceso(existing, existingSede.id, srcProc.nombre);
            existingProc = newProc;
          }
          if (!existingProc) continue;
	if (!existingProc.cargos) existingProc.cargos = [];
	if (!srcProc.cargos) continue;
	for (var c = 0; c < srcProc.cargos.length; c++) {
            var srcCargo = srcProc.cargos[c];
            var existingCargo = null;
            for (var ec = 0; ec < existingProc.cargos.length; ec++) {
              if (existingProc.cargos[ec].nombre === srcCargo.nombre) { existingCargo = existingProc.cargos[ec]; break; }
            }
            if (!existingCargo) {
              var newCargo = _addCargo(existing, existingProc.id, srcCargo.nombre);
              existingCargo = newCargo;
            }
            if (!existingCargo) continue;
            if (!existingCargo.peligros) existingCargo.peligros = [];
            if (!srcCargo.peligros) continue;
            for (var pe = 0; pe < srcCargo.peligros.length; pe++) {
              var srcPel = srcCargo.peligros[pe];
              var pelData = {
                tipo: srcPel.tipo, peligro: srcPel.peligro, efectosPosibles: srcPel.efectosPosibles,
                nd: srcPel.nd, ne: srcPel.ne, nc: srcPel.nc,
                expuestos: srcPel.expuestos, peorConsecuencia: srcPel.peorConsecuencia,
                criterioEstablecido: srcPel.criterioEstablecido, fuente: srcPel.fuente,
                medio: srcPel.medio, individuo: srcPel.individuo,
                medidasExistenteFuente: srcPel.medidasExistenteFuente, medidasExistenteMedio: srcPel.medidasExistenteMedio,
                medidasExistenteIndividuo: srcPel.medidasExistenteIndividuo, medidasIntervencion: srcPel.medidasIntervencion,
                responsable: srcPel.responsable, plazo: srcPel.plazo, observaciones: srcPel.observaciones
              };
              _addPeligro(existing, existingCargo.id, pelData);
            }
          }
        }
      }
      existing.lastModified = new Date().toISOString();
      _writeMatriz(companyName, existing);
      return {
        success: true,
        data: {
          rowsImported: parsed.rowsImported,
          sedesCreated: parsed.sedesCreated,
          procesosCreated: parsed.procesosCreated,
          cargosCreated: parsed.cargosCreated,
          errors: parsed.errors
        }
      };
    } catch (e) {
      return { success: false, error: { code: 'IMPORT_ERROR', message: e.message } };
    }
  });
}

module.exports = { registerIdentificacionPeligrosHandlers };
