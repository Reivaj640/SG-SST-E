/* ==========================================================================
K+AIR â€” MÃ³dulo 4.1.2 IdentificaciÃ³n de Peligros
Bridge â€” JSON CRUD + Motor GTC-45 (NDÃ—NE=NP, NPÃ—NC=NR)
Persistencia: JSON en {userData}/identificacion-peligros-data/
Auto-Sync XLSX: Export Excel con ExcelJS (backup + rollback)
========================================================================== */
var path = require('path');
var fs = require('fs');
var xlsx = require('xlsx');
var ExcelJS = require('exceljs');

var _app = null;
var _getCompanyRootPath = null;

/* â”€â”€â”€ GTC-45 Constantes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* F439.8 (2026-06-24): GTC-45 Tabla 5 (ND), Tabla 7 (NE), Tabla 6 (NC).
   Antes estos arrays estaban INVERTIDOS (ND=0=Muy Alto) o tenían 6 valores
   incorrectos (NC). Ahora se alinean al estándar GTC-45. */
var ND_OPTIONS = [
  { value: 0, label: 'No existe' },
  { value: 1, label: 'Muy Bajo' },
  { value: 2, label: 'Bajo' },
  { value: 3, label: 'Medio' },
  { value: 4, label: 'Alto' },
  { value: 5, label: 'Muy Alto' }
];

var NE_OPTIONS = [
  { value: 1, label: 'Esporádica (<1h/sem o <1vez/sem)' },
  { value: 2, label: 'Ocasional (1-4h/sem o 1-4veces/sem)' },
  { value: 3, label: 'Frecuente (>4h/sem o >4veces/sem)' },
  { value: 4, label: 'Continua (8h/día o más)' }
];

/* GTC-45 Tabla 6 — Niveles de Consecuencia (NC).
   Solo 4 valores oficiales:
   10 → Leve (L) - Lesiones que no requieren incapacidad
   25 → Grave (G) - Lesiones con incapacidad laboral temporal
   60 → Muy Grave (MG) - Incapacidad permanente parcial o invalidez
   100 → Mortal/Catastrófico (M) - Muerte(s) */
var NC_OPTIONS = [
  { value: 10,  label: '10 — Leve (L)' },
  { value: 25,  label: '25 — Grave (G)' },
  { value: 60,  label: '60 — Muy Grave (MG)' },
  { value: 100, label: '100 — Mortal/Catastrófico (M)' }
];

var TIPOS_PELIGRO = [
  'FÃ­sico', 'QuÃ­mico', 'BiolÃ³gico', 'Psicosocial',
  'ErgonÃ³mico', 'MecÃ¡nico', 'ElÃ©ctrico', 'Locativo',
  'FenÃ³menos Naturales', 'PÃºblico'
];

var TIPO_NORMALIZE_MAP = [
  { pattern: /psicosocial|carga mental|carga fÃ­sica.*mental|acoso laboral|estrÃ©s laboral|monoton|contenido de la tarea|condiciones de la tarea/i, tipo: 'Psicosocial' },
  { pattern: /biolÃ³gic|virus|bacterias|hongos|fluidos|excrementos|picaduras|mordeduras|sÃ­ntomas grip|sintomas grip/i, tipo: 'BiolÃ³gico' },
  { pattern: /ergonÃ³mic|postura|movimiento repetitivo|moviiento repetitivo|carga|sedente|esfuerzo|manipulaciÃ³n manual|musc|biomec/i, tipo: 'ErgonÃ³mico' },
  { pattern: /mecÃ¡nic|maquina|herramienta|corte|pieza/i, tipo: 'MecÃ¡nico' },
  { pattern: /elÃ©ctric|alta.*tensiÃ³n|baja.*tensiÃ³n|estÃ¡tica|corto circuito/i, tipo: 'ElÃ©ctrico' },
  { pattern: /quÃ­mic|quimic|sustancia|polvo|vapor|gas|derrame/i, tipo: 'QuÃ­mico' },
  { pattern: /fÃ­sic|ruido|iluminaciÃ³n|vibraciÃ³n|radiaci|temperatura|calor|frÃ­o|ultravioleta/i, tipo: 'FÃ­sico' },
  { pattern: /locativ|suelo|piso|escalera|puerta|pared|obra/i, tipo: 'Locativo' },
  { pattern: /fenÃ³meno natural|inundaciÃ³n|sismo|terremoto|vendaval|tormenta|deslizamiento|precipitaciones|lluvia/i, tipo: 'FenÃ³menos Naturales' },
  { pattern: /pÃºblico|robo|atraco|asalto|vandalismo|desorden pÃºblico/i, tipo: 'PÃºblico' },
  { pattern: /altura|alturas/i, tipo: 'MecÃ¡nico' },
  { pattern: /incendio|fuego|trabajo.*caliente/i, tipo: 'ElÃ©ctrico' },
  { pattern: /trÃ¡nsito|transito|accidente.*transit/i, tipo: 'PÃºblico' },
  { pattern: /desplazamiento|caÃ­da|caida|desnivel/i, tipo: 'Locativo' }
];

/* F439.7 (2026-06-24): GTC-45 Tabla 23 — Nivel de Probabilidad (NP = ND × NE).
   Rangos oficiales:
     NP 0-4   → Bajo
     NP 5-8   → Medio
     NP 9-40  → Alto */
var NP_INTERPRETACION = [
  { min: 0,  max: 4,  label: 'Bajo' },
  { min: 5,  max: 8,  label: 'Medio' },
  { min: 9,  max: 40, label: 'Alto' }
];

/* F439.7 (2026-06-24): GTC-45 Tabla 25 — Aceptabilidad del Riesgo.
   Convención: I = mejor (Aceptable), V = peor (No aceptable nivel 2).
   Rangos oficiales:
     NR ≤ 20       → Nivel I  — Aceptable
     NR 21-100     → Nivel II — Aceptable con control específico
     NR 101-300    → Nivel III — Mejorable (No aceptable)
     NR 301-600    → Nivel IV — No aceptable nivel 1
     NR > 600      → Nivel V  — No aceptable nivel 2 (catastrófico) */
var NR_ACEPTABILIDAD = [
  { max: 20,     nivel: 'I',   label: 'Aceptable',                        color: 'verde' },
  { max: 100,    nivel: 'II',  label: 'Aceptable con control específico', color: 'azul' },
  { max: 300,    nivel: 'III', label: 'Mejorable (No aceptable)',         color: 'amarillo' },
  { max: 600,    nivel: 'IV',  label: 'No aceptable nivel 1',             color: 'naranja' },
  { max: Infinity, nivel: 'V', label: 'No aceptable nivel 2',             color: 'rojo' }
];

/* â”€â”€â”€ Motor GTC-45 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
        /* F439.2 (2026-06-24): migrar JSON viejo para que tenga los alias
           que usan el editor y la tabla de la matriz. Si el JSON ya
           tiene controlFuente/Medio/Persona, no los piso (puede que el
           usuario los haya editado a propÃ³sito). Solo lleno los vacÃ­os. */
        if (pel.controlFuente === undefined) pel.controlFuente = pel.fuente || '';
        if (pel.controlMedio === undefined) pel.controlMedio = pel.medio || '';
        if (pel.controlPersona === undefined) pel.controlPersona = pel.individuo || '';
        /* Si el JSON viejo solo tiene medidasIntervencion (joined), no
           podemos reconstruir las 5 individuales con certeza (puede haber
           '; ' dentro del texto). Solo las llenamos si vienen vacÃ­as. */
        if (!pel.medidaEliminacion && !pel.medidaSustitucion && !pel.medidaIngenieria &&
            !pel.medidaAdministrativos && !pel.medidaEpp && pel.medidasIntervencion) {
          /* Dejar las individuales vacÃ­as para no inventar datos; el joined
             ya estÃ¡ disponible en medidasIntervencion si la tabla quiere
             mostrarlo. */
        }
        _enriquecerPeligro(pel);
        }
      }
    }
  }
  return matriz;
}

/* â”€â”€â”€ EstadÃ­sticas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
  /* 📦448 (2026-06-25) — Nuevos agregados para los 5 KPIs adicionales
     del módulo 4.1.2 (cobertura de controles, NR distribución, top
     cargos, tareas rutinarias, expuestos por sede × nivel). El frontend
     (kair-matriz-peligros-indicadores.js) lee estos campos para
     alimentar los nuevos visuales del grid 2 columnas. */
  var totalExpuestos = 0;
  var controlesFuente = 0, controlesMedio = 0, controlesPersona = 0;
  var expuestosPorSede = {};
  var nrDistribucion = { '0-20': 0, '21-100': 0, '101-300': 0, '301-600': 0, '>600': 0 };
  var nrSuma = 0, nrCount = 0, nrMaxCalc = 0;
  var porCargoSimple = {};
  var rutinariaDist = { si: 0, no: 0, sinClasificar: 0 };

  if (!matriz || !matriz.sedes) {
return {
      total: 0,
      porAcept: porAcept,
      porTipo: porTipo,
      porSede: porSede,
      porCargo: porCargo,
      maxNR: maxNR,
      inaceptables: inaceptables,
      tasaInaceptable: 0,
      totalSedes: 0,
      totalProcesos: 0,
      totalCargos: 0,
      evaluados: 0,
      tasaEvaluados: 0,
      /* 📦448 — defaults vacíos */
      totalExpuestos: 0,
      porNivel: Object.assign({}, porAcept),
      cobertura: {
        fuente:  { count: 0, total: 0, pct: 0 },
        medio:   { count: 0, total: 0, pct: 0 },
        persona: { count: 0, total: 0, pct: 0 }
      },
      expuestosPorSede: {},
      nrDistribucion: nrDistribucion,
      nrPromedio: 0,
      nrMax: 0,
      topCargos: [],
      rutinariaDist: rutinariaDist,
      concentracionCritAltos: { count: 0, total: 0, pct: 0, criticos: 0, altos: 0 },
      expuestosPorSedePct: {}
    };
  }

  totalSedes = matriz.sedes.length;

  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    totalProcesos += sede.procesos.length;
    var sName = sede.nombre || 'Sin sede';
    var sExp = { total: 0, porNivel: { I: 0, II: 0, III: 0, IV: 0, V: 0 } };
    for (var pr = 0; pr < sede.procesos.length; pr++) {
      var proceso = sede.procesos[pr];
      if (!proceso.cargos) continue;
      totalCargos += proceso.cargos.length;
      for (var c = 0; c < proceso.cargos.length; c++) {
        var cargo = proceso.cargos[c];
        /* 📦448 — Rutinaria se evalúa por CARGO (la tarea es rutinaria o
           no, no por peligro individual). Sumamos 1 al bucket del cargo. */
        if (cargo.rutinaria === true) rutinariaDist.si++;
        else if (cargo.rutinaria === false) rutinariaDist.no++;
        else rutinariaDist.sinClasificar++;
        if (!cargo.peligros) continue;
        for (var pe = 0; pe < cargo.peligros.length; pe++) {
          var p = cargo.peligros[pe];
          total++;
          var nivel = p.nrNivel || 'I';
          if (porAcept[nivel] != null) porAcept[nivel]++;
          if (sExp.porNivel[nivel] != null) sExp.porNivel[nivel]++;
          var tipo = p.tipo || 'Sin tipo';
          porTipo[tipo] = (porTipo[tipo] || 0) + 1;
          porSede[sName] = (porSede[sName] || 0) + 1;
          var cKey = cargo.nombre + '@@' + sede.nombre;
          porCargo[cKey] = (porCargo[cKey] || 0) + 1;
          /* 📦448 — Conteo simple por cargo (sin sede, para el top 5) */
          if (cargo.nombre) porCargoSimple[cargo.nombre] = (porCargoSimple[cargo.nombre] || 0) + 1;
          if (p.nr != null && p.nr > maxNR) maxNR = p.nr;
          if (nivel === 'IV' || nivel === 'V' || nivel === 'III') inaceptables++;
          if (p.nd != null && p.ne != null && p.nc != null) evaluados++;
          /* 📦448 — Cobertura de controles (jerarquía GTC-45) */
          if (p.controlFuente && String(p.controlFuente).trim() !== '') controlesFuente++;
          if (p.controlMedio && String(p.controlMedio).trim() !== '') controlesMedio++;
          if (p.controlPersona && String(p.controlPersona).trim() !== '') controlesPersona++;
          /* 📦448 — Expuestos por sede */
          if (p.expuestos != null && p.expuestos !== '') {
            var exp = Number(p.expuestos) || 0;
            totalExpuestos += exp;
            sExp.total += exp;
          }
          /* 📦448 — Distribución NR en bins oficiales GTC-45 */
          if (p.nr != null && p.nr !== '') {
            var n = Number(p.nr) || 0;
            nrSuma += n;
            nrCount++;
            if (n > nrMaxCalc) nrMaxCalc = n;
            if (n > 600) nrDistribucion['>600']++;
            else if (n > 300) nrDistribucion['301-600']++;
            else if (n > 100) nrDistribucion['101-300']++;
            else if (n > 20)  nrDistribucion['21-100']++;
            else              nrDistribucion['0-20']++;
          }
        }
      }
    }
    if (sExp.total > 0 || total > 0) expuestosPorSede[sName] = sExp;
  }

  /* 📦448 — Top 5 cargos con más peligros (orden descendente) */
  var topCargosArr = Object.keys(porCargoSimple).map(function (k) {
    return { nombre: k, count: porCargoSimple[k] };
  });
  topCargosArr.sort(function (a, b) { return b.count - a.count; });
  var topCargos = topCargosArr.slice(0, 5);

  /* 📦448 — Concentración de riesgo Nivel I + II (críticos + altos).
     KPI crítico para SG-SST — la Resolución 0312 mide este % en auditorías.
     Se calcula desde porAcept, que ya está poblado en el loop principal. */
  var criticos = porAcept.I || 0;
  var altos = porAcept.II || 0;
  var concentracionCritAltos = {
    count: criticos + altos,
    total: total,
    pct: total > 0 ? Math.round(((criticos + altos) / total) * 100) : 0,
    criticos: criticos,
    altos: altos
  };

  /* 📦448 — % de expuestos por sede (respecto al total de expuestos).
     Complementa el stacked bar con la perspectiva porcentual: "¿qué %
     de la fuerza laboral está en cada sede?" */
  var expuestosPorSedePct = {};
  Object.keys(expuestosPorSede).forEach(function (sede) {
    var c = expuestosPorSede[sede].total;
    expuestosPorSedePct[sede] = {
      count: c,
      pct: totalExpuestos > 0 ? Math.round((c / totalExpuestos) * 100) : 0
    };
  });

  var nrPromedio = nrCount > 0 ? Math.round(nrSuma / nrCount) : 0;

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
    tasaEvaluados: total > 0 ? Math.round((evaluados / total) * 100) : 0,
    /* 📦448 — Nuevos campos */
    totalExpuestos: totalExpuestos,
    /* Alias de porAcept (el frontend indicadores.js lee porNivel) */
    porNivel: Object.assign({}, porAcept),
    cobertura: {
      fuente:  { count: controlesFuente,   total: total, pct: total > 0 ? Math.round((controlesFuente   / total) * 100) : 0 },
      medio:   { count: controlesMedio,    total: total, pct: total > 0 ? Math.round((controlesMedio    / total) * 100) : 0 },
      persona: { count: controlesPersona,  total: total, pct: total > 0 ? Math.round((controlesPersona  / total) * 100) : 0 }
    },
    expuestosPorSede: expuestosPorSede,
    nrDistribucion: nrDistribucion,
    nrPromedio: nrPromedio,
    nrMax: nrMaxCalc,
    topCargos: topCargos,
    rutinariaDist: rutinariaDist,
    concentracionCritAltos: concentracionCritAltos,
    expuestosPorSedePct: expuestosPorSedePct
  };
}

/* â”€â”€â”€ Heat Map NDÃ—NC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function _generarHeatMap(matriz) {
  var ndValues = [0, 1, 2, 3, 4, 5];
  /* F439.8 (2026-06-24): GTC-45 Tabla 6 — Valores oficiales de NC.
     4 niveles oficiales en vez de los 6 incorrectos que tenía la versión vieja. */
  var ncValues = [10, 25, 60, 100];
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

/* â”€â”€â”€ PriorizaciÃ³n â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function _generarPriorizacion(matriz) {
  var grupos = [
    { nivel: 'V', label: 'Inaceptable nivel 3', rango: '>200', color: 'morado', peligros: [] },
    { nivel: 'IV', label: 'Inaceptable nivel 2', rango: '121-200', color: 'rojo', peligros: [] },
    { nivel: 'III', label: 'Inaceptable nivel 1', rango: '41-120', color: 'naranja', peligros: [] },
    { nivel: 'II', label: 'Aceptable con control', rango: '11-40', color: 'amarillo', peligros: [] },
    { nivel: 'I', label: 'Aceptable', rango: 'â‰¤10', color: 'verde', peligros: [] }
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

/* â”€â”€â”€ Notas AnalÃ­ticas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function _generarNotasAnaliticas(matriz, stats) {
  var notas = [];
  if (!matriz || !matriz.sedes || !matriz.sedes.length) return notas;

  if (stats.inaceptables > 0) {
    notas.push(stats.inaceptables + ' peligro' + (stats.inaceptables > 1 ? 's' : '') + ' superan el nivel aceptable y requieren intervenciÃ³n inmediata.');
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
    notas.push('El tipo de peligro mÃ¡s frecuente es "' + maxTipo + '" con ' + stats.porTipo[maxTipo] + ' registros.');
  }

  var cargosArr = Object.keys(stats.porCargo);
  if (cargosArr.length > 0) {
    var maxCargo = cargosArr[0];
    for (var k = 1; k < cargosArr.length; k++) {
      if (stats.porCargo[cargosArr[k]] > stats.porCargo[maxCargo]) maxCargo = cargosArr[k];
    }
    var cargoName = maxCargo.split('@@')[0];
    var cargoSede = maxCargo.split('@@')[1] || '';
    notas.push('El cargo "' + cargoName + '"' + (cargoSede ? ' en ' + cargoSede : '') + ' presenta ' + stats.porCargo[maxCargo] + ' peligros, el mÃ¡s alto del organigrama.');
  }

  if (stats.tasaInaceptable >= 30) {
    notas.push('La tasa de peligros inaceptables (' + stats.tasaInaceptable + '%) supera el 30%. Se recomienda priorizar medidas de intervenciÃ³n.');
  }

  return notas;
}

/* â”€â”€â”€ JSON CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
  var safe = companyName.replace(/[^a-zA-Z0-9Ã¡Ã©Ã­Ã³ÃºÃÃ‰ÃÃ“ÃšÃ±Ã‘ _-]/g, '_');
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
    sourceXlsxPath: null,
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

/* â”€â”€â”€ Operaciones CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
    tipo: (data && data.tipo) || 'FÃ­sico',
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
    /* F439.5 (2026-06-24): los 5 campos individuales de intervenciÃ³n
       que el editor usa (medidaEliminacion, medidaSustitucion, etc.).
       Antes solo se copiaban en el parser pero _addPeligro los
       descartaba al construir el objeto peligro. Resultado: las
       columnas MEDIDA FUENTE/MEDIO/INDIVIDUO de la tabla siempre
       quedaban vacÃ­as aunque el Excel tuviera los datos. */
    medidaEliminacion: (data && data.medidaEliminacion) || '',
    medidaSustitucion: (data && data.medidaSustitucion) || '',
    medidaIngenieria: (data && data.medidaIngenieria) || '',
    medidaAdministrativos: (data && data.medidaAdministrativos) || '',
    medidaEpp: (data && data.medidaEpp) || '',
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
    'controlFuente', 'controlMedio', 'controlPersona',
    'medidasExistenteFuente', 'medidasExistenteMedio', 'medidasExistenteIndividuo',
    'medidasIntervencion',
    'medidaEliminacion', 'medidaSustitucion', 'medidaIngenieria', 'medidaAdministrativos', 'medidaEpp',
    'peorConsecuencia', 'responsable', 'plazo', 'observaciones'
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
  /* F439.2 (2026-06-24): mantener alias en sincronÃ­a. Si llega controlFuente
     vÃ­a el editor, reflejarlo tambiÃ©n en fuente (y viceversa) para que ambas
     vistas (matriz y editor) vean siempre el mismo dato. Igual para las 5
     medidas de intervenciÃ³n que el editor envÃ­a separadas vs el JSON viejo
     que las tenÃ­a unidas en medidasIntervencion. */
  if (cambios.controlFuente !== undefined && cambios.fuente === undefined) p.fuente = p.controlFuente;
  if (cambios.fuente !== undefined && cambios.controlFuente === undefined) p.controlFuente = p.fuente;
  if (cambios.controlMedio !== undefined && cambios.medio === undefined) p.medio = p.controlMedio;
  if (cambios.medio !== undefined && cambios.controlMedio === undefined) p.controlMedio = p.medio;
  if (cambios.controlPersona !== undefined && cambios.individuo === undefined) p.individuo = p.controlPersona;
  if (cambios.individuo !== undefined && cambios.controlPersona === undefined) p.controlPersona = p.individuo;
  /* Re-armar medidasIntervencion a partir de las 5 medidas individuales
     si el editor las mandÃ³ separadas. */
  if (cambios.medidaEliminacion !== undefined || cambios.medidaSustitucion !== undefined ||
      cambios.medidaIngenieria !== undefined || cambios.medidaAdministrativos !== undefined ||
      cambios.medidaEpp !== undefined) {
    var parts = [p.medidaEliminacion, p.medidaSustitucion, p.medidaIngenieria, p.medidaAdministrativos, p.medidaEpp];
    p.medidasIntervencion = parts.filter(Boolean).join('; ');
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

/* â”€â”€â”€ Import XLSX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function _getCompanyPeligrosDir(companyRoot) {
	var gestionDir = path.join(companyRoot, '4. Gestion de Peligros y Riesgos');
	if (!fs.existsSync(gestionDir)) {
		gestionDir = path.join(companyRoot, '4. GestiÃ³n de Peligros y Riesgos');
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
	return path.join(companyRoot, '4. Gestion de Peligros y Riesgos', '4.1.2 IdentificaciÃ³n de Peligros');
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

/* â”€â”€â”€ XLSX Auto-Sync: Backup, Flatten, Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

var _xlsxWriteQueues = {};
function _serializedXlsxWrite(filePath, writeFn) {
  var key = filePath.toLowerCase();
  if (!_xlsxWriteQueues[key]) _xlsxWriteQueues[key] = Promise.resolve();
  _xlsxWriteQueues[key] = _xlsxWriteQueues[key].catch(function() {}).then(writeFn);
  return _xlsxWriteQueues[key];
}

function _createXlsxBackup(filePath, dir) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  var backupDir = path.join(dir || path.dirname(filePath), 'backup');
  if (!fs.existsSync(backupDir)) { try { fs.mkdirSync(backupDir, { recursive: true }); } catch (e) { return null; } }
  var ts = new Date().toISOString().replace(/[:.]/g, '-');
  var backupPath = path.join(backupDir, path.basename(filePath) + '_' + ts + '.bak');
  try { fs.copyFileSync(filePath, backupPath); return backupPath; } catch (e) { return null; }
}

var XLSX_COL_HEADERS = [
  'SEDE', 'PROCESO', 'CARGO', 'ZONA', 'ACTIVIDADES', 'TAREAS', 'RUTINARIA',
  'TIPO DE PELIGRO', 'DESCRIPCION DEL PELIGRO', 'EFECTOS POSIBLES',
  'NRO. EXPUESTOS', 'PEOR CONSECUENCIA',
  'ND', 'NE', 'NP', 'INTERPRETACION NP', 'NC', 'NR',
  'NIVEL DE RIESGO', 'ACEPTABILIDAD',
  'CRITERIO ESTABLECIDO',
  'FUENTE', 'MEDIO', 'INDIVIDUO',
  'MEDIDAS EXISTENTES FUENTE', 'MEDIDAS EXISTENTES MEDIO', 'MEDIDAS EXISTENTES INDIVIDUO',
  'MEDIDA INTERVENCION', 'RESPONSABLE', 'PLAZO', 'OBSERVACIONES'
];

function _flattenMatrizToRows(matriz) {
  var rows = [];
  if (!matriz || !matriz.sedes) return rows;
  for (var s = 0; s < matriz.sedes.length; s++) {
    var sede = matriz.sedes[s];
    if (!sede.procesos) continue;
    for (var p = 0; p < sede.procesos.length; p++) {
      var proc = sede.procesos[p];
      if (!proc.cargos) continue;
      for (var c = 0; c < proc.cargos.length; c++) {
        var cargo = proc.cargos[c];
        if (!cargo.peligros || !cargo.peligros.length) continue;
        for (var pe = 0; pe < cargo.peligros.length; pe++) {
          var pel = cargo.peligros[pe];
          rows.push({
            sede: sede.nombre || '',
            proceso: proc.nombre || '',
            cargo: cargo.nombre || '',
            zona: cargo.zona || '',
            actividades: cargo.actividades || '',
            tareas: cargo.tareas || '',
            rutinaria: cargo.rutinaria != null ? (cargo.rutinaria ? 'Si' : 'No') : '',
            tipo: pel.tipo || '',
            peligro: pel.peligro || '',
            efectosPosibles: pel.efectosPosibles || '',
            expuestos: pel.expuestos != null ? pel.expuestos : '',
            peorConsecuencia: pel.peorConsecuencia || '',
            nd: pel.nd != null ? pel.nd : '',
            ne: pel.ne != null ? pel.ne : '',
            np: pel.np != null ? pel.np : '',
            npInterpretacion: pel.npInterpretacion || '',
            nc: pel.nc != null ? pel.nc : '',
            nr: pel.nr != null ? pel.nr : '',
            nrNivel: pel.nrNivel || '',
            nrLabel: pel.nrLabel || '',
            criterioEstablecido: pel.criterioEstablecido || '',
            fuente: pel.fuente || '',
            medio: pel.medio || '',
            individuo: pel.individuo || '',
            medidasExistenteFuente: pel.medidasExistenteFuente || '',
            medidasExistenteMedio: pel.medidasExistenteMedio || '',
            medidasExistenteIndividuo: pel.medidasExistenteIndividuo || '',
            medidasIntervencion: pel.medidasIntervencion || '',
            responsable: pel.responsable || '',
            plazo: pel.plazo || '',
            observaciones: pel.observaciones || ''
          });
        }
      }
    }
  }
  return rows;
}

var XLSX_FIELD_ORDER = [
  'sede', 'proceso', 'cargo', 'zona', 'actividades', 'tareas', 'rutinaria',
  'tipo', 'peligro', 'efectosPosibles', 'expuestos', 'peorConsecuencia',
  'nd', 'ne', 'np', 'npInterpretacion', 'nc', 'nr', 'nrNivel', 'nrLabel',
  'criterioEstablecido', 'fuente', 'medio', 'individuo',
  'medidasExistenteFuente', 'medidasExistenteMedio', 'medidasExistenteIndividuo',
  'medidasIntervencion', 'responsable', 'plazo', 'observaciones'
];

var HEADER_KEYWORDS = {
  sede: ['SEDE'],
  proceso: ['PROCESO'],
  cargo: ['CARGO', 'OCUPACION', 'OCUPACIÓN', 'PUESTO'],
  zona: ['ZONA', 'LUGAR', 'ZONA/LUGAR'],
  actividades: ['ACTIVIDADES'],
  tareas: ['TAREAS', 'TAREA'],
  rutinaria: ['RUTINARIA', 'RUTINARIO'],
  tipo: ['TIPO DE PELIGRO', 'TIPO DE RIESGO', 'CLASIFICACION DEL PELIGRO', 'CLASIFICACIÓN DEL PELIGRO'],
  peligro: ['DESCRIPCION DEL PELIGRO', 'DESCRIPCIÓN DEL PELIGRO', 'FACTOR DE RIESGO', 'PELIGRO / ASPECTO', 'PELIGRO/ASPECTO'],
  efectosPosibles: ['EFECTOS POSIBLES', 'EFECTO POSIBLE', 'POSIBLES DAÑOS', 'CONSECUENCIA'],
  nd: ['ND', 'NIVEL DE DEFICIENCIA'],
  ne: ['NE', 'NIVEL DE EXPOSICION', 'NIVEL DE EXPOSICIÓN'],
  np: ['NP', 'NIVEL DE PROBABILIDAD'],
  npInterpretacion: ['INTERPRETACION NP', 'INTERPRETACIÓN NP'],
  nc: ['NC', 'NIVEL DE CONSECUENCIA'],
  nr: ['NR', 'NIVEL DE RIESGO'],
  nrLabel: ['ACEPTABILIDAD', 'NIVEL DE RIESGO Y ACEPTABILIDAD'],
  criterioEstablecido: ['CRITERIO ESTABLECIDO', 'CRITERIO DE LAS CONSECUENCIAS'],
  fuente: ['FUENTE', 'MEDIDA FUENTE'],
  medio: ['MEDIO', 'MEDIDA MEDIO', 'MEDIO AMBIENTE', 'MEDIO DE TRANSMISION', 'MEDIO DE TRANSMISIÓN'],
  individuo: ['INDIVIDUO', 'PERSONA', 'MEDIDA INDIVIDUO', 'TRABAJADOR'],
  medidasExistenteFuente: ['MEDIDAS EXISTENTES FUENTE', 'MEDIDAS DE CONTROL FUENTE', 'CONTROL FUENTE'],
  medidasExistenteMedio: ['MEDIDAS EXISTENTES MEDIO', 'MEDIDAS DE CONTROL MEDIO', 'CONTROL MEDIO'],
  medidasExistenteIndividuo: ['MEDIDAS EXISTENTES INDIVIDUO', 'MEDIDAS DE CONTROL INDIVIDUO', 'CONTROL INDIVIDUO'],
  eliminacion: ['ELIMINACION', 'ELIMINACIÓN'],
  sustitucion: ['SUSTITUCION', 'SUSTITUCIÓN'],
  controlIngenieria: ['CONTROLES DE INGENIERÍA', 'CONTROLES DE INGENIERIA', 'CONTROL DE INGENIERÍA', 'CONTROL DE INGENIERIA'],
  senalizacion: ['CONTROLES ADM', 'SEÑALIZACIÓN', 'SEÑALIZACION', 'SEÑALIZACIÓN/ADVERTENCIA', 'SEÑALIZACION/ADVERTENCIA', 'SEÑALIZACIÓN. ADVERTENCIA', 'SEÑALIZACION. ADVERTENCIA'],
  epp: ['EPP', 'EQUIPOS DE PROTECCIÓN PERSONAL', 'EQUIPOS DE PROTECCION PERSONAL', 'EQUIPO DE PROTECCIÓN PERSONAL'],
  expuestos: ['NRO EXPUESTOS', 'NRO. EXPUESTOS', 'NÚMERO DE EXPUESTOS', 'NUMERO DE EXPUESTOS', 'EXPUESTOS'],
  peorConsecuencia: ['PEOR CONSECUENCIA'],
  responsable: ['RESPONSABLE'],
  plazo: ['PLAZO'],
  observaciones: ['OBSERVACIONES', 'OBSERVACION', 'OBSERVACIÓN']
};

async function _createNewXlsxFile(xlsxPath, matriz) {
  var workbook = new ExcelJS.Workbook();
  var ws = workbook.addWorksheet('Matriz de Peligros');

  var headerRow = ws.addRow(XLSX_COL_HEADERS);
  headerRow.eachCell(function(cell) {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174EA6' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
  });

  var rows = _flattenMatrizToRows(matriz);
  for (var i = 0; i < rows.length; i++) {
    var rowData = rows[i];
    var values = [];
    for (var f = 0; f < XLSX_FIELD_ORDER.length; f++) {
      values.push(rowData[XLSX_FIELD_ORDER[f]]);
    }
    var dataRow = ws.addRow(values);
    dataRow.eachCell(function(cell) {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });
  }

  for (var c = 1; c <= XLSX_COL_HEADERS.length; c++) {
    ws.getColumn(c).width = 18;
  }

  var dir = path.dirname(xlsxPath);
  if (!fs.existsSync(dir)) { try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {} }

  await workbook.xlsx.writeFile(xlsxPath);
  return rows.length;
}

async function _exportMatrizToXlsx(xlsxPath, matriz) {
  var dir = path.dirname(xlsxPath);
  if (!fs.existsSync(dir)) { try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {} }

  if (!fs.existsSync(xlsxPath)) {
    return await _createNewXlsxFile(xlsxPath, matriz);
  }

  var backupPath = _createXlsxBackup(xlsxPath, dir);

  try {
    var workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);

    var ws = null;
    for (var si = 0; si < workbook.worksheets.length; si++) {
      var sn = workbook.worksheets[si].name.toUpperCase();
      if (sn.indexOf('MATRIZ') !== -1 || sn.indexOf('PELIGRO') !== -1 || sn.indexOf('GTC') !== -1 || sn.indexOf('IDENTIFICACI') !== -1) {
        ws = workbook.worksheets[si];
        break;
      }
    }
    if (!ws) ws = workbook.getWorksheet(1);
    if (!ws) {
      if (backupPath && fs.existsSync(backupPath)) { try { fs.unlinkSync(backupPath); } catch (e) {} }
      return await _createNewXlsxFile(xlsxPath, matriz);
    }

    var headerRowNum = -1;
    var colMap = {};
    ws.eachRow(function(row, rowNumber) {
      if (headerRowNum > 0) return;
      row.eachCell(function(cell, colNumber) {
        var cellText = String(cell.value || '').toUpperCase().trim();
        if (!cellText) return;
        for (var fi = 0; fi < XLSX_FIELD_ORDER.length; fi++) {
          var fieldName = XLSX_FIELD_ORDER[fi];
          var keywords = HEADER_KEYWORDS[fieldName];
          if (!keywords) continue;
          if (colMap[fieldName]) continue;
          for (var ki = 0; ki < keywords.length; ki++) {
            if (cellText === keywords[ki] || cellText.indexOf(keywords[ki]) !== -1) {
              colMap[fieldName] = colNumber;
              headerRowNum = rowNumber;
              break;
            }
          }
        }
      });
    });

    if (headerRowNum < 0) {
      if (backupPath && fs.existsSync(backupPath)) { try { fs.unlinkSync(backupPath); } catch (e) {} }
      return await _createNewXlsxFile(xlsxPath, matriz);
    }

    var dataStartRow = headerRowNum + 1;
    var rows = _flattenMatrizToRows(matriz);
    var existingRowCount = ws.rowCount - headerRowNum;

    for (var ri = 0; ri < rows.length; ri++) {
      var rowNum = dataStartRow + ri;
      var rowData = rows[ri];
      for (var fi2 = 0; fi2 < XLSX_FIELD_ORDER.length; fi2++) {
        var fn = XLSX_FIELD_ORDER[fi2];
        var colNum = colMap[fn];
        if (!colNum) continue;
        var cellVal = rowData[fn];
        if (cellVal === '') cellVal = null;
        try {
          var existingCell = ws.getCell(rowNum, colNum);
          if (existingCell) {
            existingCell.value = cellVal;
          } else {
            ws.getCell(rowNum, colNum).value = cellVal;
          }
        } catch (e2) {
          try { ws.getCell(rowNum, colNum).value = cellVal; } catch (e3) {}
        }
      }
      var dataRow = ws.getRow(rowNum);
      try {
        dataRow.eachCell(function(cell) {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
        });
      } catch (e4) {}
    }

    if (existingRowCount > rows.length) {
      for (var delRi = rows.length; delRi < existingRowCount; delRi++) {
        try {
          var delRow = ws.getRow(dataStartRow + rows.length);
          if (delRow) {
            delRow.eachCell(function(cell) { cell.value = null; });
          }
        } catch (e5) { break; }
      }
    }

    await workbook.xlsx.writeFile(xlsxPath);

    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.unlinkSync(backupPath); } catch (e) {}
    }

    return rows.length;
  } catch (e) {
    if (backupPath && fs.existsSync(backupPath)) {
      try { fs.copyFileSync(backupPath, xlsxPath); } catch (re) {}
    }
    throw e;
  }
}

function _parseSingleSheet(ws, defaultSedeName, startIdx) {
	var rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
	var sourceRowOffset = (typeof startIdx === 'number') ? startIdx : 0;

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
    return { success: false, error: 'No se encontrÃ³ fila de encabezados GTC-45 en el archivo', rowsImported: 0, errors: [] };
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
      /* Solo agregar campos del sub-row que NO fueron asignados por el group-row.
         Esto evita que matches parciales del sub-scan (score bajo) sobrescriban
         matches correctos del group-row (score alto).
         Ej: group-scan "PELIGRO / ASPECTO" â†’ col 5 (score 100)
             sub-scan "DESCRIPCIÃ“N" matchea parcialmente "DESCRIPCIÓN DEL PELIGRO" â†’ col 30 (score 23.91)
             Sin este fix, el sub-scan sobrescribirÃ­a col 5 con col 30 (incorrecto). */
      for (var sf2 in subScan.trial) {
        if (SUB_HEADER_FIELDS[sf2] && colMap[sf2] === undefined) {
          colMap[sf2] = subScan.trial[sf2];
        }
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
  if (!matchedTipo) matchedTipo = tipoVal || 'FÃ­sico';

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
  var _intervValues = {};
  for (var iv = 0; iv < _intervFields.length; iv++) {
    var ivVal = _getCell(_intervFields[iv]);
    _intervValues[_intervFields[iv]] = ivVal;
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
    /* F439.2 (2026-06-24): alias con nombres del editor (controlFuente/
       controlMedio/controlPersona) para que tanto la tabla de la matriz
       como el editor puedan leer los mismos datos. Antes la tabla
       buscaba estos nombres pero no existÃ­an en el JSON, mostrando
       campos vacÃ­os aunque el Excel sÃ­ tuviera datos. */
    controlFuente: _getCell('fuente'),
    controlMedio: _getCell('medio'),
    controlPersona: _getCell('individuo'),
    medidasExistenteFuente: _getCell('medidasExistenteFuente'),
    medidasExistenteMedio: _getCell('medidasExistenteMedio'),
    medidasExistenteIndividuo: _getCell('medidasExistenteIndividuo'),
    medidasIntervencion: _medidasIntervencion,
    /* Campos individuales de intervenciÃ³n (alias para el editor/tabla).
       El editor usa 'medidaEliminacion' etc. en vez de medidasIntervencion
       (que es un string joined). Mantenemos ambos para compatibilidad. */
    medidaEliminacion: _intervValues.eliminacion || '',
    medidaSustitucion: _intervValues.sustitucion || '',
    medidaIngenieria: _intervValues.controlIngenieria || '',
    medidaAdministrativos: _intervValues.senalizacion || '',
    medidaEpp: _intervValues.epp || '',
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
			/* F439.8 (2026-06-24): GTC-45 Tabla 6 — solo 4 valores oficiales:
			   10 (Leve), 25 (Grave), 60 (Muy grave), 100 (Mortal). */
			var ncValid = [10, 25, 60, 100];
			var ncClosest = null;
			var ncMinDiff = Infinity;
			for (var ni = 0; ni < ncValid.length; ni++) {
				var diff = Math.abs(peligroData.nc - ncValid[ni]);
				if (diff < ncMinDiff) { ncMinDiff = diff; ncClosest = ncValid[ni]; }
			}
			if (ncMinDiff <= 5) peligroData.nc = ncClosest;
			else if (peligroData.nc >= 100) peligroData.nc = 100;
			else if (peligroData.nc >= 60) peligroData.nc = 60;
			else if (peligroData.nc >= 25) peligroData.nc = 25;
			else peligroData.nc = 10;
		}

		if (cargoMap[cargoKey]) {
			_addPeligro(matriz, cargoMap[cargoKey], peligroData);
			rowsImported++;
		} else {
			parseErrors.push('Fila ' + (dr + 1) + ': no se pudo crear cargo para "' + cargoVal + '"');
		}

		/* === SEGUNDO PELIGRO EN LA MISMA FILA (cols 29-35) ===
		   Formato K+AIR/Tempoactiva: cada fila tiene 2 peligros combinados.
		   Grupo A (cols 0-25): peligro principal + clasificaciÃ³n + controles + evaluaciÃ³n
		   Grupo B (cols 29-35): segundo peligro + tipo + fuente + aceptabilidad + medidas
		   Usamos offsets fijos para evitar colisiones con keywords del grupo A */
		var p2Peligro = dataRow[30] != null ? String(dataRow[30] || '').trim() : '';
		var p2Tipo = dataRow[31] != null ? String(dataRow[31] || '').trim() : '';
		if (p2Peligro || p2Tipo) {
			var p2MatchedTipo = _normalizarTipo(p2Tipo);
			if (!p2MatchedTipo) p2MatchedTipo = p2Tipo || 'FÃ­sico';
			var p2Data = {
				tipo: p2MatchedTipo,
				peligro: p2Peligro,
				efectosPosibles: '',
				expuestos: null,
				nd: _getNum('nd'),
				ne: _getNum('ne'),
				nc: _getNum('nc'),
				criterioEstablecido: '',
				fuente: dataRow[32] != null ? String(dataRow[32] || '').trim() : '',
				medio: '',
				individuo: '',
				medidasExistenteFuente: '',
				medidasExistenteMedio: '',
				medidasExistenteIndividuo: '',
				medidasIntervencion: dataRow[35] != null ? String(dataRow[35] || '').trim() : '',
				peorConsecuencia: '',
				responsable: '',
				plazo: '',
				observaciones: ''
			};
			/* Aceptabilidad del grupo B â†’ nrLabel si existe */
			var p2Acept = dataRow[33] != null ? String(dataRow[33] || '').trim() : '';
			if (p2Acept) p2Data.nrLabel = p2Acept;

			/* Reutilizar validaciones de nd/ne/nc del peligro 1 */
			if (p2Data.nd != null) {
				if (p2Data.nd < 0) p2Data.nd = 0;
				if (p2Data.nd > 5) p2Data.nd = 5;
			}
			if (p2Data.ne != null) {
				if (p2Data.ne < 1) p2Data.ne = 1;
				if (p2Data.ne > 4) p2Data.ne = 4;
			}
			if (p2Data.nc != null) {
				/* F439.8 (2026-06-24): GTC-45 Tabla 6 — solo 4 valores oficiales */
				var ncValid = [10, 25, 60, 100];
				var ncClosest = null;
				var ncMinDiff = Infinity;
				for (var ni = 0; ni < ncValid.length; ni++) {
					var diff = Math.abs(p2Data.nc - ncValid[ni]);
					if (diff < ncMinDiff) { ncMinDiff = diff; ncClosest = ncValid[ni]; }
				}
				if (ncMinDiff <= 5) p2Data.nc = ncClosest;
				else if (p2Data.nc >= 100) p2Data.nc = 100;
				else if (p2Data.nc >= 60) p2Data.nc = 60;
				else if (p2Data.nc >= 25) p2Data.nc = 25;
				else p2Data.nc = 10;
			}

			if (cargoMap[cargoKey]) {
				_addPeligro(matriz, cargoMap[cargoKey], p2Data);
				rowsImported++;
			}
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
		errors: parseErrors,
		sourceRowOffset: sourceRowOffset,
		defaultSedeName: defaultSedeName,
		hasSedeColumn: (colMap.sede != null)
	};
}

function _parseMatrizXlsx(filePath) {
	var workbook = xlsx.readFile(filePath, { type: 'file' });

	/* Determinar quÃ© hojas procesar:
	   - Si hay UNA hoja, usar esa
	   - Si hay VARIAS, procesarlas TODAS y usar el nombre de cada hoja como "sede"
	     (a menos que la hoja tenga su propia columna "sede") */
	var targetSheets = [];
	for (var si = 0; si < workbook.SheetNames.length; si++) {
		var sn = workbook.SheetNames[si];
		var snUpper = sn.toUpperCase();
		/* Filtrar hojas de instrucciones/readme/legales */
		if (snUpper.indexOf('INSTRUCCIONES') !== -1) continue;
		if (snUpper.indexOf('README') !== -1) continue;
		if (snUpper.indexOf('LEEME') !== -1) continue;
		targetSheets.push(sn);
	}
	if (targetSheets.length === 0) targetSheets = [workbook.SheetNames[0]];

	/* Matriz combinada de todas las hojas */
	var matrizFinal = _crearMatrizVacia('');
	var totalRows = 0;
	var totalSedes = 0;
	var totalProcesos = 0;
	var totalCargos = 0;
	var allErrors = [];

	for (var shi = 0; shi < targetSheets.length; shi++) {
		var sheetName = targetSheets[shi];
		var ws = workbook.Sheets[sheetName];
		if (!ws) continue;

		var singleResult = _parseSingleSheet(ws, sheetName, 0);
		if (!singleResult || !singleResult.matriz) continue;

		/* Mezclar las sedes de esta hoja en la matriz final */
		for (var sdi = 0; sdi < singleResult.matriz.sedes.length; sdi++) {
			var srcSede = singleResult.matriz.sedes[sdi];
			/* Si la hoja NO tiene columna sede propia, usar el nombre de la hoja */
			if (!singleResult.hasSedeColumn && srcSede.nombre === 'Sede Principal') {
				srcSede.nombre = singleResult.defaultSedeName || sheetName;
			}
			matrizFinal.sedes.push(srcSede);
		}

		totalRows += singleResult.rowsImported;
		totalSedes += singleResult.sedesCreated;
		totalProcesos += singleResult.procesosCreated;
		totalCargos += singleResult.cargosCreated;
		if (singleResult.errors && singleResult.errors.length) {
			allErrors = allErrors.concat(singleResult.errors);
		}
	}

	/* Recalcular _nextId para que no haya colisiones */
	matrizFinal._nextId = 1;
	for (var fi = 0; fi < matrizFinal.sedes.length; fi++) {
		var fSede = matrizFinal.sedes[fi];
		if (!fSede.id || parseInt(fSede.id.split('_')[1]) >= matrizFinal._nextId) {
			matrizFinal._nextId = parseInt(fSede.id.split('_')[1]) + 1;
		}
		for (var pi = 0; pi < (fSede.procesos || []).length; pi++) {
			var fProc = fSede.procesos[pi];
			if (!fProc.id || parseInt(fProc.id.split('_')[1]) >= matrizFinal._nextId) {
				matrizFinal._nextId = parseInt(fProc.id.split('_')[1]) + 1;
			}
			for (var ci = 0; ci < (fProc.cargos || []).length; ci++) {
				var fCar = fProc.cargos[ci];
				if (!fCar.id || parseInt(fCar.id.split('_')[1]) >= matrizFinal._nextId) {
					matrizFinal._nextId = parseInt(fCar.id.split('_')[1]) + 1;
				}
				for (var pei = 0; pei < (fCar.peligros || []).length; pei++) {
					var fPel = fCar.peligros[pei];
					if (!fPel.id || parseInt(fPel.id.split('_')[1]) >= matrizFinal._nextId) {
						matrizFinal._nextId = parseInt(fPel.id.split('_')[1]) + 1;
					}
				}
			}
		}
	}

	_enriquecerMatriz(matrizFinal);

	return {
		success: true,
		matriz: matrizFinal,
		rowsImported: totalRows,
		sedesCreated: totalSedes,
		procesosCreated: totalProcesos,
		cargosCreated: totalCargos,
		errors: allErrors,
		sheetsProcessed: targetSheets.length
	};
}

/* â”€â”€â”€ Registro de Handlers IPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
			if (!companyRoot) return { success: false, error: { code: 'NO_COMPANY', message: 'No se encontrÃ³ la ruta de la empresa' } };
			var dir = _getCompanyPeligrosDir(companyRoot);
			var filePath = _findMatrizXlsx(dir);
      if (!filePath) return { success: true, data: { found: false, filePath: null, fileName: null } };
      return { success: true, data: { found: true, filePath: filePath, fileName: path.basename(filePath) } };
    } catch (e) {
      return { success: false, error: { code: 'DISCOVER_ERROR', message: e.message } };
    }
  });

  /* F439.3 (2026-06-24): helpers para merge-empty. Buscan entidades por nombre
   (case-insensitive + trim) porque el Excel puede traer pequeÃ±as variaciones. */
function _isEmpty(v) {
  return v == null || String(v).trim() === '';
}
function _normName(n) { return String(n || '').toLowerCase().trim(); }
function _findSedeByName(matriz, nombre) {
  if (!matriz || !matriz.sedes) return null;
  var n = _normName(nombre);
  for (var i = 0; i < matriz.sedes.length; i++) {
    if (_normName(matriz.sedes[i].nombre) === n) return matriz.sedes[i];
  }
  return null;
}
function _findProcesoByName(sede, nombre) {
  if (!sede || !sede.procesos) return null;
  var n = _normName(nombre);
  for (var i = 0; i < sede.procesos.length; i++) {
    if (_normName(sede.procesos[i].nombre) === n) return sede.procesos[i];
  }
  return null;
}
function _findCargoByName(proceso, nombre) {
  if (!proceso || !proceso.cargos) return null;
  var n = _normName(nombre);
  for (var i = 0; i < proceso.cargos.length; i++) {
    if (_normName(proceso.cargos[i].nombre) === n) return proceso.cargos[i];
  }
  return null;
}
function _findPeligroByName(cargo, nombre) {
  if (!cargo || !cargo.peligros) return null;
  var n = _normName(nombre);
  for (var i = 0; i < cargo.peligros.length; i++) {
    if (_normName(cargo.peligros[i].peligro) === n) return cargo.peligros[i];
  }
  return null;
}

ipcMain.handle('matriz-peligros:import-xlsx', async function(_e, companyName, filePath, opts) {
    try {
      opts = opts || {};
      var replaceMode = opts.replace === true; /* default: REEMPLAZAR */
      var mergeEmptyMode = opts.mode === 'merge-empty';
      if (!filePath) {
var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
			if (!companyRoot) return { success: false, error: { code: 'NO_COMPANY', message: 'No se encontrÃ³ la ruta de la empresa' } };
			var dir = _getCompanyPeligrosDir(companyRoot);
			filePath = _findMatrizXlsx(dir);
      }
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'No se encontrÃ³ archivo .xlsx en la carpeta 4.1.2 de la empresa' } };
      }
      if (mergeEmptyMode) {
        /* F439.3 (2026-06-24): modo merge-empty. Lee el Excel y para cada
           peligro existente en el JSON, completa SOLO los campos vacÃ­os
           con el valor del Excel. No sobrescribe nada que ya tenga
           contenido, asÃ­ es seguro correrlo varias veces. */
        var parsed = _parseMatrizXlsx(filePath);
        if (!parsed.success) {
          console.log('[KM_DEBUG] merge-empty: parse FAILED, error=', parsed.error);
          return { success: false, error: parsed.error };
        }
        var existing = _readMatriz(companyName);
        if (!existing || !existing.sedes) existing = { sedes: [] };
        var fieldsFilled = 0;
        var debugLog = {
          sedesMatched: 0, procesosMatched: 0, cargosMatched: 0, peligrosMatched: 0,
          excelSedes: parsed.matriz && parsed.matriz.sedes ? parsed.matriz.sedes.length : 0,
          jsonSedes: existing.sedes.length,
          excelSedeNames: (parsed.matriz && parsed.matriz.sedes ? parsed.matriz.sedes.map(function(s){return s.nombre;}) : []),
          jsonSedeNames: existing.sedes.map(function(s){return s.nombre;})
        };
        /* Itera sobre los peligros del JSON, busca el equivalente en
           el Excel por (sede/proceso/cargo/peligro) y completa vacÃ­os. */
        for (var si = 0; si < existing.sedes.length; si++) {
          var exSede = existing.sedes[si];
          var srcSede = _findSedeByName(parsed.matriz, exSede.nombre);
          if (!srcSede) { continue; }
          debugLog.sedesMatched++;
          for (var pi = 0; pi < (exSede.procesos || []).length; pi++) {
            var exProc = exSede.procesos[pi];
            var srcProc = _findProcesoByName(srcSede, exProc.nombre);
            if (!srcProc) { continue; }
            debugLog.procesosMatched++;
            for (var ci = 0; ci < (exProc.cargos || []).length; ci++) {
              var exCargo = exProc.cargos[ci];
              var srcCargo = _findCargoByName(srcProc, exCargo.nombre);
              if (srcCargo) debugLog.cargosMatched++;
              if (srcCargo) {
                /* Campos del cargo: solo completa si estÃ¡n vacÃ­os */
                if (_isEmpty(exCargo.zona) && !_isEmpty(srcCargo.zona)) { exCargo.zona = srcCargo.zona; fieldsFilled++; }
                if (_isEmpty(exCargo.actividades) && !_isEmpty(srcCargo.actividades)) { exCargo.actividades = srcCargo.actividades; fieldsFilled++; }
                if (_isEmpty(exCargo.tareas) && !_isEmpty(srcCargo.tareas)) { exCargo.tareas = srcCargo.tareas; fieldsFilled++; }
              }
              for (var pei = 0; pei < (exCargo.peligros || []).length; pei++) {
                var exPel = exCargo.peligros[pei];
                var srcPel = _findPeligroByName(srcCargo, exPel.peligro);
                if (!srcPel) { continue; }
                debugLog.peligrosMatched++;
                /* Campos del peligro: solo completa vacÃ­os */
                var pelFields = ['tipo','peligro','efectosPosibles','peorConsecuencia',
                                 'fuente','medio','individuo','controlFuente','controlMedio','controlPersona',
                                 'medidasExistenteFuente','medidasExistenteMedio','medidasExistenteIndividuo',
                                 'medidasIntervencion',
                                 'medidaEliminacion','medidaSustitucion','medidaIngenieria',
                                 'medidaAdministrativos','medidaEpp',
                                 'responsable','plazo','observaciones','criterioEstablecido',
                                 /* 📦443 (2026-06-25): añadir también los campos numéricos
                                    de evaluación para que el merge-empty los complete.
                                    Antes solo se rellenaban los textuales y las medidas;
                                    nd/ne/nc/np/nr/expuestos quedaban null aunque el Excel
                                    sí tuviera esos valores, lo que hacía que columnas como
                                    "Nivel de exposición" aparecieran vacías en la tabla. */
                                 'nd','ne','nc','np','nr','npInterpretacion','nrNivel','nrLabel',
                                 'expuestos'];
                for (var fi = 0; fi < pelFields.length; fi++) {
                  var fn = pelFields[fi];
                  if (_isEmpty(exPel[fn]) && !_isEmpty(srcPel[fn])) { exPel[fn] = srcPel[fn]; fieldsFilled++; }
                }
              }
            }
          }
        }
        _writeMatriz(companyName, existing);
        console.log('[KM_DEBUG] merge-empty result:', JSON.stringify(debugLog), 'fieldsFilled=', fieldsFilled);
        return {
          success: true,
          data: {
            mode: 'merge-empty',
            fieldsFilled: fieldsFilled,
            debug: debugLog,
            message: fieldsFilled === 0
              ? 'No se encontraron campos vacÃ­os para llenar. Debug: ' +
                'Excel sedes=' + debugLog.excelSedes +
                ' (' + (debugLog.excelSedeNames || []).join(',') + '), ' +
                'JSON sedes=' + debugLog.jsonSedes +
                ' (' + (debugLog.jsonSedeNames || []).join(',') + '), ' +
                'matches: sedes=' + debugLog.sedesMatched +
                ' procesos=' + debugLog.procesosMatched +
                ' cargos=' + debugLog.cargosMatched +
                ' peligros=' + debugLog.peligrosMatched
              : 'Campos vacÃ­os completados: ' + fieldsFilled
          }
        };
      }
      var parsed = _parseMatrizXlsx(filePath);
      if (!parsed.success) {
        return { success: false, error: { code: 'PARSE_ERROR', message: parsed.error } };
      }

      /* En modo REEMPLAZAR (default): crear matriz nueva preservando solo metadata */
      var existing = _readMatriz(companyName);
      var target;
      if (replaceMode) {
        target = _crearMatrizVacia(companyName);
        target.metadata = existing.metadata || target.metadata;
      } else {
        target = existing;
        if (!target.sedes) target.sedes = [];
      }

	var importSedes = parsed.matriz && parsed.matriz.sedes ? parsed.matriz.sedes : [];
	for (var s = 0; s < importSedes.length; s++) {
		var srcSede = importSedes[s];
        var existingSede = null;
        if (!replaceMode) {
          for (var es = 0; es < target.sedes.length; es++) {
            if (target.sedes[es].nombre === srcSede.nombre) { existingSede = target.sedes[es]; break; }
          }
        }
        if (!existingSede) {
          var newSede = _addSede(target, srcSede.nombre);
          existingSede = newSede;
        }
	if (!existingSede.procesos) existingSede.procesos = [];
	if (!srcSede.procesos) continue;
	for (var p = 0; p < srcSede.procesos.length; p++) {
          var srcProc = srcSede.procesos[p];
          var existingProc = null;
          if (!replaceMode) {
            for (var ep = 0; ep < existingSede.procesos.length; ep++) {
              if (existingSede.procesos[ep].nombre === srcProc.nombre) { existingProc = existingSede.procesos[ep]; break; }
            }
          }
          if (!existingProc) {
            var newProc = _addProceso(target, existingSede.id, srcProc.nombre);
            existingProc = newProc;
          }
          if (!existingProc) continue;
	if (!existingProc.cargos) existingProc.cargos = [];
	if (!srcProc.cargos) continue;
	for (var c = 0; c < srcProc.cargos.length; c++) {
            var srcCargo = srcProc.cargos[c];
            var existingCargo = null;
            if (!replaceMode) {
              for (var ec = 0; ec < existingProc.cargos.length; ec++) {
                if (existingProc.cargos[ec].nombre === srcCargo.nombre) { existingCargo = existingProc.cargos[ec]; break; }
              }
            }
            if (!existingCargo) {
              var newCargo = _addCargo(target, existingProc.id, srcCargo.nombre);
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
              _addPeligro(target, existingCargo.id, pelData);
            }
          }
        }
      }
  target.lastModified = new Date().toISOString();
  target.sourceXlsxPath = filePath;
  _writeMatriz(companyName, target);
      return {
        success: true,
        data: {
          mode: replaceMode ? 'replace' : 'append',
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

  ipcMain.handle('matriz-peligros:sync-xlsx', async function(_e, companyName) {
    try {
      var matriz = _readMatriz(companyName);
      _enriquecerMatriz(matriz);

      var xlsxPath = matriz.sourceXlsxPath;
      if (!xlsxPath || !fs.existsSync(xlsxPath)) {
        var companyRoot = _getCompanyRootPath ? await _getCompanyRootPath(companyName) : null;
        if (!companyRoot) return { success: false, error: { code: 'NO_COMPANY', message: 'No se encontrÃ³ la ruta de la empresa' } };
        var dir = _getCompanyPeligrosDir(companyRoot);
        xlsxPath = _findMatrizXlsx(dir);

        if (!xlsxPath) {
          var safe = (companyName || '').replace(/[^a-zA-Z0-9Ã¡Ã©Ã­Ã³ÃºÃÃ‰ÃÃ“ÃšÃ±Ã‘ _-]/g, '_');
          xlsxPath = path.join(dir, safe + '-Matriz-Peligros.xlsx');
        }

        matriz.sourceXlsxPath = xlsxPath;
        _writeMatriz(companyName, matriz);
      }

      var capturedPath = xlsxPath;
      var capturedMatriz = matriz;

      return await _serializedXlsxWrite(xlsxPath, async function() {
        var rowsWritten = await _exportMatrizToXlsx(capturedPath, capturedMatriz);
        return { success: true, data: { filePath: capturedPath, rowsWritten: rowsWritten } };
      });
    } catch (e) {
      return { success: false, error: { code: 'SYNC_ERROR', message: e.message } };
    }
  });

  /* â”€â”€â”€ Reset: limpia la matriz a estado vacÃ­o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
     Para F1: vacÃ­a sedes/peligros pero preserva metadata.
     En F4 se reemplazarÃ¡ por carga de 48 peligros seed (doc Â§14). */
  ipcMain.handle('matriz-peligros:reset', async function(_e, companyName) {
    try {
      var current = _readMatriz(companyName);
      var empty = {
        version: 1,
        companyName: companyName,
        lastModified: new Date().toISOString(),
        metadata: current.metadata || {
          formatCode: 'GI-FO-019',
          version: 'V0',
          elaborado: '', revisado: '', aprobado: '', fecha: ''
        },
        _nextId: 1,
        sedes: [],
        sourceXlsxPath: null
      };
      var ok = _writeMatriz(companyName, empty);
      if (!ok) return { success: false, error: { code: 'WRITE_ERROR', message: 'Error al resetear matriz' } };
      var fresh = _readMatriz(companyName);
      _enriquecerMatriz(fresh);
      var stats = _calcularStats(fresh);
      return { success: true, data: { matriz: fresh, stats: stats } };
    } catch (e) {
      return { success: false, error: { code: 'RESET_ERROR', message: e.message } };
    }
  });
}

module.exports = { registerIdentificacionPeligrosHandlers };
