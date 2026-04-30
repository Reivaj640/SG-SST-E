// ============================================================
// K+AIR SG-SST - excel-bridge.js
// Módulo de lectura/escritura directa a Excel de origen
// Ubicación: main/excel-bridge.js
// Submódulo: 3.3.1 Frecuencia de la Accidentalidad
// ============================================================

const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

// ── Rutas de los archivos Excel de origen ──
// Estas rutas se resuelven dinámicamente basadas en la empresa seleccionada
// Se espera que los archivos estén en la carpeta 3.2.3 de cada empresa

let EXCEL_INDICADORES = null;
let EXCEL_CARACTERIZACION = null;

// ── Constantes ──
const HOJA_DATOS = "DATOS Y GRÁFICOS RESULTADO";
const MESES_LABELS = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];

// Mes (1-12) → columna de datos (columnas impares: 5, 7, 9, ...)
// Fórmula: columna = 3 + (mes * 2)
function mesAColumna(mes) { return 3 + mes * 2; }

// Filas de datos en la hoja según el mapa de celdas
const FILAS = {
  accidentesAT: 9,
  trabajadoresFreq: 10,
  diasPerdidos: 11,
  trabajadoresSev: 12,
  eventosMortales: 13,
  prevalenciaEL: 15,
  incidenciaEL: 17,
  eventosAusencia: 19,
  diasProgramados: 20,
};

const COLUMNA_META = 30; // Columna AD

// ── Utilidad: obtener valor numérico de celda ──
function obtenerValor(ws, fila, col) {
  const cell = ws.getCell(fila, col);
  if (cell.value === null || cell.value === undefined) return 0;
  if (typeof cell.value === "number") return cell.value;
  if (typeof cell.value === "object" && cell.value !== null && "result" in cell.value) {
    const r = cell.value.result;
    if (typeof r === "number") return r;
    if (typeof r === "string") { 
      const p = parseFloat(r); 
      return isNaN(p) ? 0 : p; 
    }
  }
  return 0;
}

// ── Configurar rutas de archivos para una empresa específica ──
function configurarRutas(companyRoot) {
  if (!companyRoot) {
    throw new Error("Ruta raíz de empresa no proporcionada");
  }
  
  // Buscar carpeta 3.2.3 dentro de "3. Gestión de la Salud"
  const gestionSaludDir = path.join(companyRoot, "3. Gestión de la Salud");
  
  if (!fs.existsSync(gestionSaludDir)) {
    throw new Error(`Carpeta no encontrada: ${gestionSaludDir}`);
  }
  
  const entries = fs.readdirSync(gestionSaludDir);
  const registro323Folder = entries.find(f => f.startsWith("3.2.3"));
  
  if (!registro323Folder) {
    throw new Error(`Carpeta 3.2.3 no encontrada en: ${gestionSaludDir}`);
  }
  
  const submoduleDir = path.join(gestionSaludDir, registro323Folder);
  const files = fs.readdirSync(submoduleDir);
  
  // Buscar archivos INDICADORES y Dashboard Caracterización
  const indicadoresFile = files.find(f => f.toLowerCase().includes("indicadores") && f.endsWith(".xlsx"));
  const caracterizacionFile = files.find(f => f.toLowerCase().includes("caracterización") && f.endsWith(".xlsx"));
  
  if (indicadoresFile) {
    EXCEL_INDICADORES = path.join(submoduleDir, indicadoresFile);
  }
  
  if (caracterizacionFile) {
    EXCEL_CARACTERIZACION = path.join(submoduleDir, caracterizacionFile);
  }
  
  return {
    indicadores: EXCEL_INDICADORES,
    caracterizacion: EXCEL_CARACTERIZACION
  };
}

// ── Configurar rutas CON Ruta específica del submódulo ──
function configurarRutasConRuta(submodulePath) {
  console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] ===== configurarRutasConRuta =====');
  console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] submodulePath:', submodulePath);
  
  if (!submodulePath) {
    console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] ERROR: Ruta no proporcionada');
    throw new Error("Ruta del submódulo no proporcionada");
  }
  
  const exists = fs.existsSync(submodulePath);
  console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] Carpeta existe:', exists);
  
  if (!exists) {
    console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] ERROR: Carpeta no existe');
    throw new Error("Carpeta no encontrada: " + submodulePath);
  }
  
  const files = fs.readdirSync(submodulePath);
  console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] Archivos en carpeta:', files.length);
  files.forEach(function(f) {
    console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE]   -', f);
  });
  
  // Priorizar INDICADORES 2024.xlsx sobre otros archivos
  const indicadoresFiles = files.filter(f => f.toLowerCase().includes("indicadores") && f.endsWith(".xlsx"));
  let indicadoresFile = indicadoresFiles.find(f => f.toLowerCase().includes("2024"));
  if (!indicadoresFile && indicadoresFiles.length > 0) {
    indicadoresFile = indicadoresFiles[0];
  }
  const caracterizacionFile = files.find(f => f.toLowerCase().includes("caracterización") && f.endsWith(".xlsx"));
  
  console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] indicadoresFile:', indicadoresFile);
  console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] caracterizacionFile:', caracterizacionFile);
  
  if (indicadoresFile) {
    EXCEL_INDICADORES = path.join(submodulePath, indicadoresFile);
    console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] EXCEL_INDICADORES:', EXCEL_INDICADORES);
  }
  
  if (caracterizacionFile) {
    EXCEL_CARACTERIZACION = path.join(submodulePath, caracterizacionFile);
    console.log('[FrecuenciaAccidentalidad][EXCEL-BRIDGE] EXCEL_CARACTERIZACION:', EXCEL_CARACTERIZACION);
  }
  
  return {
    indicadores: EXCEL_INDICADORES,
    caracterizacion: EXCEL_CARACTERIZACION
  };
}

// ============================================================
// LECTURA desde Excel de origen (INDICADORES)
// ============================================================

async function leerIndicadores() {
  if (!EXCEL_INDICADORES) {
    throw new Error("Ruta de INDICADORES no configurada");
  }
  
if (!fs.existsSync(EXCEL_INDICADORES)) {
    throw new Error("Archivo no encontrado: " + EXCEL_INDICADORES);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_INDICADORES);
  
  // Buscar hoja - probar múltiples nombres
  console.log('[EXCEL-BRIDGE] Buscando hoja en', EXCEL_INDICADORES);
  var hojaNombres = [
    "TASA DE ACCIDENTALIDAD",
    "DATOS Y GRÁFICOS RESULTADO", 
    "DATOS Y GRAFICOS RESULTADO", 
    "Datos", 
    "Frecuencia", 
    "Indicadores", 
    "Hoja1"
  ];
  var ws = null;
  
  for (var i = 0; i < hojaNombres.length; i++) {
    ws = workbook.getWorksheet(hojaNombres[i]);
    if (ws) {
      console.log('[EXCEL-BRIDGE] Hoja encontrada:', hojaNombres[i]);
      break;
    }
  }
  
  // Si no se encuentra, listar todas las hojas disponibles
  if (!ws) {
    console.log('[EXCEL-BRIDGE] Hojas disponibles en el libro:');
    workbook.eachSheet(function(hoja, id) {
      console.log('[EXCEL-BRIDGE]   -', hoja.name);
    });
    throw new Error("Hoja no encontrada.");
  }

  const metaFrecuencia = obtenerValor(ws, FILAS.accidentesAT, COLUMNA_META);
  const metaSeveridad = obtenerValor(ws, FILAS.diasPerdidos, COLUMNA_META);

  const frecuenciaMensual = [];
  const severidadMensual = [];
  const ausentismoMensual = [];
  const eventosMortalesMensual = [];
  let totalAT = 0;

  for (let mes = 1; mes <= 12; mes++) {
    const col = mesAColumna(mes);
const accidentes = obtenerValor(ws, FILAS.accidentesAT, col);
  const trabajadores = obtenerValor(ws, FILAS.trabajadoresFreq, col);
  const diasPerdidos = obtenerValor(ws, FILAS.diasPerdidos, col);
  const eventosAusencia = obtenerValor(ws, FILAS.eventosAusencia, col);
  const eventosMortalesMes = obtenerValor(ws, FILAS.eventosMortales, col);
    
    console.log(`[EXCEL-BRIDGE] Mes ${mes} (col ${col}): AT=${accidentes}, Trab=${trabajadores}, Dias=${diasPerdidos}, Aus=${eventosAusencia}`);

    // Cálculo de índices según fórmulas estándar
    const indiceFrecuencia = trabajadores > 0
      ? Math.round(((accidentes / trabajadores) * 100) * 10000) / 10000
      : 0;

    const indiceSeveridad = trabajadores > 0
      ? Math.round(((diasPerdidos / trabajadores) * 100) * 10000) / 10000
      : 0;

    const diasProgramados = obtenerValor(ws, FILAS.diasProgramados, col);
    const tasaAusentismo = diasProgramados > 0
      ? Math.round(((eventosAusencia / diasProgramados) * 100) * 10000) / 10000
      : 0;

    totalAT += accidentes;

    frecuenciaMensual.push({ 
      mes, 
      mesLabel: MESES_LABELS[mes-1], 
      accidentes, 
      trabajadores, 
      indiceFrecuencia 
    });
    
    severidadMensual.push({ 
      mes, 
      mesLabel: MESES_LABELS[mes-1], 
      diasPerdidos, 
      trabajadores, 
      indiceSeveridad 
    });
    
ausentismoMensual.push({
      mes,
      mesLabel: MESES_LABELS[mes-1],
      eventosAusencia,
      tasaAusentismo
    });

    eventosMortalesMensual.push({
      mes,
      mesLabel: MESES_LABELS[mes-1],
      eventosMortales: eventosMortalesMes
    });
  }

const mortalidad = obtenerValor(ws, FILAS.eventosMortales, 5);
  const prevalenciaEL = obtenerValor(ws, FILAS.prevalenciaEL, 5);
  const metaMortalidad = obtenerValor(ws, FILAS.eventosMortales, COLUMNA_META);

  return {
    success: true,
    data: {
      frecuenciaMensual,
      severidadMensual,
      ausentismoMensual,
      eventosMortalesMensual,
      config: {
        metaFrecuencia,
        metaSeveridad,
        metaMortalidad,
        mortalidad,
        prevalenciaEL
      },
      totalAT2024: totalAT,
    }
  };
}

// ============================================================
// LECTURA de Caracterización (Dashboard)
// ============================================================

async function leerCaracterizacion() {
  if (!EXCEL_CARACTERIZACION) {
    // Si no hay archivo de caracterización, retornar datos vacíos
    return {
      success: true,
      data: {
        historialAnual: [],
        severidadDesglose: [],
        severidadGenero: [],
        empresaDesglose: [],
        tipoEvento: [],
        mesHistorico: [],
        totalGeneral: 0
      }
    };
  }
  
  if (!fs.existsSync(EXCEL_CARACTERIZACION)) {
    throw new Error(`Archivo no encontrado: ${EXCEL_CARACTERIZACION}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_CARACTERIZACION);
  const ws = workbook.getWorksheet("Data");
  
  if (!ws) throw new Error("Hoja 'Data' no encontrada en Caracterización");

  const accidentes = [];
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  for (let row = 2; row <= ws.rowCount; row++) {
    const r = ws.getRow(row);
    const evento = String(r.getCell(3).value || "").trim();
    const fechaRaw = r.getCell(4).value;
    const sexo = String(r.getCell(11).value || "").trim();
    const severidad = String(r.getCell(15).value || "").trim();
    const empresa = String(r.getCell(2).value || "").trim();
    const tipoEvento = String(r.getCell(18).value || "").trim();

    let anio = 0, mes = "";
    if (fechaRaw) {
      const d = typeof fechaRaw === "object" && fechaRaw instanceof Date ? fechaRaw : new Date(fechaRaw);
      if (!isNaN(d.getFullYear())) {
        anio = d.getFullYear();
        mes = meses[d.getMonth()] || "";
      }
    }

    if (evento.toLowerCase() === "at" && anio > 0) {
      accidentes.push({ anio, severidad, sexo, empresa, tipoEvento, mes });
    }
  }

  // Desgloses
  const historialAnual = Object.entries(
    accidentes.reduce((acc, a) => { 
      acc[a.anio] = (acc[a.anio]||0) + 1; 
      return acc; 
    }, {})
  ).map(([a, t]) => ({ anio: parseInt(a), total: t })).sort((a,b) => a.anio - b.anio);

  const severidadDesglose = Object.entries(
    accidentes.reduce((acc, a) => { 
      const k = a.severidad || "(sin dato)"; 
      acc[k] = (acc[k]||0)+1; 
      return acc; 
    }, {})
  ).map(([s, t]) => ({ severidad: s, total: t }));

  const severidadGenero = Object.entries(
    accidentes.reduce((acc, a) => { 
      const k = a.severidad || "(sin dato)"; 
      if (!acc[k]) acc[k]={hombres:0,mujeres:0}; 
      if (a.sexo==="Hombre") acc[k].hombres++; 
      else if (a.sexo==="Mujer") acc[k].mujeres++; 
      return acc; 
    }, {})
  ).map(([s, d]) => ({ severidad: s, ...d, total: d.hombres+d.mujeres }));
  
  severidadGenero.push({ 
    severidad: "Total.", 
    hombres: severidadGenero.reduce((s,d)=>s+d.hombres,0), 
    mujeres: severidadGenero.reduce((s,d)=>s+d.mujeres,0), 
    total: accidentes.length 
  });

  const empresaDesglose = Object.entries(
    accidentes.reduce((acc, a) => { 
      const k = a.empresa || "(sin dato)"; 
      acc[k] = (acc[k]||0)+1; 
      return acc; 
    }, {})
  ).map(([e, t]) => ({ empresa: e, total: t }));

  const tipoEvento = Object.entries(
    accidentes.reduce((acc, a) => { 
      const k = a.tipoEvento || "(sin dato)"; 
      acc[k] = (acc[k]||0)+1; 
      return acc; 
    }, {})
  ).map(([t, c]) => ({ tipo: t, total: c }));

  const mesHistorico = Object.entries(
    accidentes.reduce((acc, a) => { 
      const k = a.mes || "(sin dato)"; 
      acc[k] = (acc[k]||0)+1; 
      return acc; 
    }, {})
  ).map(([m, t]) => ({ mes: m, total: t })).sort((a,b) => meses.indexOf(a.mes) - meses.indexOf(b.mes));

  return {
    success: true,
    data: { 
      historialAnual, 
      severidadDesglose, 
      severidadGenero, 
      empresaDesglose, 
      tipoEvento, 
      mesHistorico, 
      totalGeneral: accidentes.length 
    }
  };
}

// ============================================================
// ESCRITURA directa al Excel de origen
// ============================================================

async function escribirEnExcel(mes, campos) {
  if (mes < 1 || mes > 12) throw new Error("Mes debe ser 1-12");
  
  if (!EXCEL_INDICADORES) {
    throw new Error("Ruta de INDICADORES no configurada");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_INDICADORES);
  const ws = workbook.getWorksheet(HOJA_DATOS);
  
  if (!ws) throw new Error("Hoja no encontrada: " + HOJA_DATOS);

  const col = mesAColumna(mes);

  // Solo escribir en columnas impares (datos), NO en columnas pares (fórmulas)
  if (campos.accidentes !== undefined) ws.getCell(FILAS.accidentesAT, col).value = campos.accidentes;
  if (campos.trabajadores !== undefined) ws.getCell(FILAS.trabajadoresFreq, col).value = campos.trabajadores;
  if (campos.diasPerdidos !== undefined) ws.getCell(FILAS.diasPerdidos, col).value = campos.diasPerdidos;
  if (campos.eventosAusencia !== undefined) ws.getCell(FILAS.eventosAusencia, col).value = campos.eventosAusencia;

  // Valores anuales (se escriben en todos los meses)
  if (campos.eventosMortales !== undefined) {
    for (let m = 1; m <= 12; m++) {
      ws.getCell(FILAS.eventosMortales, mesAColumna(m)).value = campos.eventosMortales;
    }
  }
  
  if (campos.prevalenciaEL !== undefined) {
    for (let m = 1; m <= 12; m++) {
      ws.getCell(FILAS.prevalenciaEL, mesAColumna(m)).value = campos.prevalenciaEL;
    }
  }

  // Guardar IN-PLACE (sobrescribe el archivo original)
  await workbook.xlsx.writeFile(EXCEL_INDICADORES);

  return { 
    success: true, 
    data: { 
      mensaje: "Excel actualizado correctamente", 
      archivo: path.basename(EXCEL_INDICADORES) 
    } 
  };
}

// ============================================================
// ÍNDICE DE MORTALIDAD (Submódulo 3.3.3)
// ============================================================

// Filas específicas para Mortalidad
const FILAS_MORTALIDAD = {
  eventosMortales: 13,
  trabajadores: 14,
};

async function leerIndicadoresMortalidad() {
  if (!EXCEL_INDICADORES) {
    // Si no hay INDICADORES, retornar datos demo
    return {
      success: true,
      data: {
        eventos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        trabajadores: 150,
        meta: 0,
        frecuencia: 'Anual'
      }
    };
  }

  if (!fs.existsSync(EXCEL_INDICADORES)) {
    return {
      success: true,
      data: {
        eventos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        trabajadores: 150,
        meta: 0,
        frecuencia: 'Anual'
      }
    };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_INDICADORES);

  // Buscar hoja
  var hojaNombres = [
    "TASA DE MORTALIDAD",
    "DATOS Y GRÁFICOS RESULTADO",
    "DATOS Y GRAFICOS RESULTADO",
    "Mortalidad",
    "Hoja1"
  ];
  var ws = null;

  for (var i = 0; i < hojaNombres.length; i++) {
    ws = workbook.getWorksheet(hojaNombres[i]);
    if (ws) break;
  }

  if (!ws) {
    // Usar hoja por defecto
    ws = workbook.getWorksheet(1);
  }

  const meta = obtenerValor(ws, FILAS_MORTALIDAD.eventosMortales, COLUMNA_META);
  const trabajadores = obtenerValor(ws, FILAS_MORTALIDAD.trabajadores, 5) || 150;

  const eventos = [];
  for (let mes = 1; mes <= 12; mes++) {
    const col = mesAColumna(mes);
    const valor = obtenerValor(ws, FILAS_MORTALIDAD.eventosMortales, col);
    eventos.push(valor);
  }

  console.log('[EXCEL-BRIDGE Mortalidad] meta:', meta, 'trabajadores:', trabajadores, 'eventos:', eventos);

  return {
    success: true,
    data: {
      eventos: eventos,
      trabajadores: trabajadores,
      meta: meta,
      frecuencia: 'Anual'
    }
  };
}

async function escribirEnExcelMortalidad(mes, campos) {
  if (!EXCEL_INDICADORES) {
    throw new Error("Ruta de INDICADORES no configurada");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_INDICADORES);

  var hojaNombres = [
    "TASA DE MORTALIDAD",
    "DATOS Y GRÁFICOS RESULTADO",
    "DATOS Y GRAFICOS RESULTADO",
    "Mortalidad",
    "Hoja1"
  ];
  var ws = null;

  for (var i = 0; i < hojaNombres.length; i++) {
    ws = workbook.getWorksheet(hojaNombres[i]);
    if (ws) break;
  }

  if (!ws) {
    ws = workbook.getWorksheet(1);
  }

  if (!ws) throw new Error("Hoja no encontrada");

  // Escribir valores
  if (campos.eventos !== undefined) {
    const col = mes ? mesAColumna(mes) : 5;
    ws.getCell(FILAS_MORTALIDAD.eventosMortales, col).value = campos.eventos;
  }

  if (campos.trabajadores !== undefined) {
    const col = mes ? mesAColumna(mes) : 5;
    ws.getCell(FILAS_MORTALIDAD.trabajadores, col).value = campos.trabajadores;
  }

  // Guardar IN-PLACE
  await workbook.xlsx.writeFile(EXCEL_INDICADORES);

  return {
    success: true,
    data: {
      mensaje: "Excel actualizado correctamente",
      archivo: path.basename(EXCEL_INDICADORES)
    }
  };
}

// ── Exportar para usar en main.js ──
module.exports = {
  configurarRutas,
  configurarRutasConRuta,
  leerIndicadores,
  leerCaracterizacion,
  escribirEnExcel,
  leerIndicadoresMortalidad,
  escribirEnExcelMortalidad
};
