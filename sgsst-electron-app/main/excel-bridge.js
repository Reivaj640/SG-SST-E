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

// ── Detección dinámica de filas por etiquetas en columna D ──
// Cada empresa puede tener un layout diferente (offset de filas).
// Escanea la hoja y mapea las etiquetas de columna D a los números de fila
// correctos, con fallback a FILAS si no detecta.
function detectarFilas(ws) {
	var detectadas = {};
	var trabajadoresCount = 0;

	for (var row = 1; row <= 30; row++) {
		var dVal = String(ws.getCell(row, 4).value || '').trim();
		if (!dVal) continue;

		var dLower = dVal.toLowerCase();

		if (dLower === 'a.t') {
			if (!detectadas.accidentesAT) {
				detectadas.accidentesAT = row;
			} else if (!detectadas.atMortalidad) {
				detectadas.atMortalidad = row;
			}
		} else if (dLower.startsWith('n\u00b0 trabajadores') || dLower.startsWith('n° trabajadores')) {
			trabajadoresCount++;
			if (trabajadoresCount === 1) {
				detectadas.trabajadoresFreq = row;
			} else if (trabajadoresCount === 2) {
				detectadas.trabajadoresSev = row;
			} else if (!detectadas.trabajadoresMortalidad) {
				detectadas.trabajadoresMortalidad = row;
			}
		} else if (dLower.includes('días perdidos') || dLower.includes('dias perdidos')) {
			detectadas.diasPerdidos = row;
		} else if (dLower.includes('eventos mortales') || dLower.includes('evento mortal')) {
			detectadas.eventosMortales = row;
		} else if (dLower.includes('eventos ausencia') || dLower.includes('evento ausencia')) {
			detectadas.eventosAusencia = row;
		} else if (dLower.includes('días programados') || dLower.includes('dias programados')) {
			detectadas.diasProgramados = row;
		} else if (dLower.includes('casos nuevos y antiguos')) {
			detectadas.prevalenciaEL = row;
		} else if (dLower.includes('casos nuevos') && !dLower.includes('antiguos')) {
			detectadas.incidenciaEL = row;
		}
	}

	var resultado = {};
	resultado.accidentesAT = detectadas.accidentesAT || FILAS.accidentesAT;
	resultado.trabajadoresFreq = detectadas.trabajadoresFreq || FILAS.trabajadoresFreq;
	resultado.diasPerdidos = detectadas.diasPerdidos || FILAS.diasPerdidos;
	resultado.trabajadoresSev = detectadas.trabajadoresSev || FILAS.trabajadoresSev;
	resultado.eventosMortales = detectadas.eventosMortales || FILAS.eventosMortales;
	resultado.prevalenciaEL = detectadas.prevalenciaEL || FILAS.prevalenciaEL;
	resultado.incidenciaEL = detectadas.incidenciaEL || FILAS.incidenciaEL;
	resultado.eventosAusencia = detectadas.eventosAusencia || FILAS.eventosAusencia;
	resultado.diasProgramados = detectadas.diasProgramados || FILAS.diasProgramados;

	resultado.trabajadoresMortalidad = detectadas.trabajadoresMortalidad || detectadas.atMortalidad || (resultado.eventosMortales + 1);

	console.log('[EXCEL-BRIDGE] Filas detectadas:', JSON.stringify(resultado));

	return resultado;
}

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
function listarIndicadoresFiles(submodulePath) {
  if (!submodulePath || !fs.existsSync(submodulePath)) {
    return [];
  }
  const files = fs.readdirSync(submodulePath);
  const indicadoresFiles = files.filter(f => f.toLowerCase().includes("indicadores") && f.endsWith(".xlsx"));
  return indicadoresFiles.map(f => {
    const yearMatch = f.match(/(20\d{2})/);
    return {
      fileName: f,
      year: yearMatch ? parseInt(yearMatch[1]) : null,
      filePath: path.join(submodulePath, f)
    };
  }).sort((a, b) => (b.year || 0) - (a.year || 0));
}

function configurarRutasConRuta(submodulePath, year) {
  console.log('[EXCEL-BRIDGE] ===== configurarRutasConRuta =====');
  console.log('[EXCEL-BRIDGE] submodulePath:', submodulePath, '| year:', year);

  if (!submodulePath) {
    throw new Error("Ruta del submódulo no proporcionada");
  }

  if (!fs.existsSync(submodulePath)) {
    throw new Error("Carpeta no encontrada: " + submodulePath);
  }

  const files = fs.readdirSync(submodulePath);
  const indicadoresFiles = files.filter(f => f.toLowerCase().includes("indicadores") && f.endsWith(".xlsx"));

  let indicadoresFile = null;

  if (year) {
    indicadoresFile = indicadoresFiles.find(f => f.includes(String(year)));
  }

  if (!indicadoresFile) {
    const currentYear = new Date().getFullYear();
    indicadoresFile = indicadoresFiles.find(f => f.includes(String(currentYear)));
  }

  if (!indicadoresFile && indicadoresFiles.length > 0) {
    const withYear = indicadoresFiles.filter(f => f.match(/20\d{2}/));
    if (withYear.length > 0) {
      withYear.sort((a, b) => {
        const ya = parseInt(a.match(/20\d{2}/)[0]);
        const yb = parseInt(b.match(/20\d{2}/)[0]);
        return yb - ya;
      });
      indicadoresFile = withYear[0];
    } else {
      indicadoresFile = indicadoresFiles[0];
    }
  }

  const availableFiles = listarIndicadoresFiles(submodulePath);
  const caracterizacionFile = files.find(f => f.toLowerCase().includes("caracterización") && f.endsWith(".xlsx"));

  console.log('[EXCEL-BRIDGE] indicadoresFile:', indicadoresFile);
  console.log('[EXCEL-BRIDGE] availableFiles:', availableFiles.length);

  if (indicadoresFile) {
    EXCEL_INDICADORES = path.join(submodulePath, indicadoresFile);
  } else {
    EXCEL_INDICADORES = null;
  }

  if (caracterizacionFile) {
    EXCEL_CARACTERIZACION = path.join(submodulePath, caracterizacionFile);
  }

  return {
    indicadores: EXCEL_INDICADORES,
    caracterizacion: EXCEL_CARACTERIZACION,
    selectedFile: indicadoresFile || null,
    availableFiles: availableFiles
  };
}

// ============================================================
// LECTURA desde Excel de origen (INDICADORES)
// ============================================================
// LECTURA desde Excel de origen (INDICADORES)
// ============================================================

async function leerIndicadores(rutaOverride) {
var ruta = rutaOverride || EXCEL_INDICADORES;
if (!ruta) {
throw new Error("Ruta de INDICADORES no configurada");
}

if (!fs.existsSync(ruta)) {
throw new Error("Archivo no encontrado: " + ruta);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(ruta);
  
  // Buscar hoja - probar múltiples nombres
  console.log('[EXCEL-BRIDGE] Buscando hoja en', ruta);
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

	const filas = detectarFilas(ws);

	const metaFrecuencia = obtenerValor(ws, filas.accidentesAT, COLUMNA_META);
	const metaSeveridad = obtenerValor(ws, filas.diasPerdidos, COLUMNA_META);

	const frecuenciaMensual = [];
	const severidadMensual = [];
	const ausentismoMensual = [];
	const eventosMortalesMensual = [];
	let totalAT = 0;

	for (let mes = 1; mes <= 12; mes++) {
		const col = mesAColumna(mes);
		const accidentes = obtenerValor(ws, filas.accidentesAT, col);
		const trabajadores = obtenerValor(ws, filas.trabajadoresFreq, col);
		const diasPerdidos = obtenerValor(ws, filas.diasPerdidos, col);
		const eventosAusencia = obtenerValor(ws, filas.eventosAusencia, col);
		const eventosMortalesMes = obtenerValor(ws, filas.eventosMortales, col);

		console.log(`[EXCEL-BRIDGE] Mes ${mes} (col ${col}): AT=${accidentes}, Trab=${trabajadores}, Dias=${diasPerdidos}, Aus=${eventosAusencia}`);

		const indiceFrecuencia = trabajadores > 0
			? Math.round(((accidentes / trabajadores) * 100) * 10000) / 10000
			: 0;

		const indiceSeveridad = trabajadores > 0
			? Math.round((((diasPerdidos + 0) / trabajadores) * 100) * 10000) / 10000
			: 0;

		const diasProgramados = obtenerValor(ws, filas.diasProgramados, col);
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
			diasCargados: 0,
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

	const mortalidad = obtenerValor(ws, filas.eventosMortales, 5);
	const prevalenciaEL = obtenerValor(ws, filas.prevalenciaEL, 5);
	const metaMortalidad = obtenerValor(ws, filas.eventosMortales, COLUMNA_META);

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

async function leerCaracterizacion(rutaOverride) {
var ruta = rutaOverride || EXCEL_CARACTERIZACION;
if (!ruta) {
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

if (!fs.existsSync(ruta)) {
throw new Error(`Archivo no encontrado: ${ruta}`);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(ruta);
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

async function escribirEnExcel(mes, campos, rutaOverride) {
if (mes < 1 || mes > 12) throw new Error("Mes debe ser 1-12");

var ruta = rutaOverride || EXCEL_INDICADORES;
if (!ruta) {
throw new Error("Ruta de INDICADORES no configurada");
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(ruta);
  const ws = workbook.getWorksheet(HOJA_DATOS);
  
	if (!ws) throw new Error("Hoja no encontrada: " + HOJA_DATOS);

	const filas = detectarFilas(ws);

	const col = mesAColumna(mes);

	// Solo escribir en columnas impares (datos), NO en columnas pares (fórmulas)
	if (campos.accidentes !== undefined) ws.getCell(filas.accidentesAT, col).value = campos.accidentes;
	if (campos.trabajadores !== undefined) ws.getCell(filas.trabajadoresFreq, col).value = campos.trabajadores;
	if (campos.diasPerdidos !== undefined) ws.getCell(filas.diasPerdidos, col).value = campos.diasPerdidos;
	if (campos.eventosAusencia !== undefined) ws.getCell(filas.eventosAusencia, col).value = campos.eventosAusencia;

	// Valores anuales (se escriben en todos los meses)
	if (campos.eventosMortales !== undefined) {
		for (let m = 1; m <= 12; m++) {
			ws.getCell(filas.eventosMortales, mesAColumna(m)).value = campos.eventosMortales;
		}
	}

	if (campos.prevalenciaEL !== undefined) {
		for (let m = 1; m <= 12; m++) {
			ws.getCell(filas.prevalenciaEL, mesAColumna(m)).value = campos.prevalenciaEL;
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

async function leerIndicadoresMortalidad(rutaOverride) {
var ruta = rutaOverride || EXCEL_INDICADORES;
if (!ruta) {
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

if (!fs.existsSync(ruta)) {
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
await workbook.xlsx.readFile(ruta);

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

	const filas = detectarFilas(ws);

	const meta = obtenerValor(ws, filas.eventosMortales, COLUMNA_META);
	const trabajadores = obtenerValor(ws, filas.trabajadoresMortalidad, 5) || 150;

	const eventos = [];
	for (let mes = 1; mes <= 12; mes++) {
		const col = mesAColumna(mes);
		const valor = obtenerValor(ws, filas.eventosMortales, col);
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

async function escribirEnExcelMortalidad(mes, campos, rutaOverride) {
var ruta = rutaOverride || EXCEL_INDICADORES;
if (!ruta) {
throw new Error("Ruta de INDICADORES no configurada");
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(ruta);

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

	const filas = detectarFilas(ws);

	// Escribir valores
	if (campos.eventos !== undefined) {
		const col = mes ? mesAColumna(mes) : 5;
		ws.getCell(filas.eventosMortales, col).value = campos.eventos;
	}

	if (campos.trabajadores !== undefined) {
		const col = mes ? mesAColumna(mes) : 5;
		ws.getCell(filas.trabajadoresMortalidad, col).value = campos.trabajadores;
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

// ============================================================
// CONTAR AT POR MES desde Registro Estadístico 3.2.3 (para auto-fill)
// ============================================================

function _mesToNumber(mesStr) {
  var s = String(mesStr).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  var mapa = {
    'enero': 1, 'feb': 2, 'febrero': 2, 'mar': 3, 'marzo': 3,
    'abr': 4, 'abril': 4, 'may': 5, 'mayo': 5, 'jun': 6, 'junio': 6,
    'jul': 7, 'julio': 7, 'ago': 8, 'agosto': 8, 'sep': 9, 'septiembre': 9,
    'oct': 10, 'octubre': 10, 'nov': 11, 'noviembre': 11, 'dic': 12, 'diciembre': 12
  };
  if (mapa[s]) return mapa[s];
  var n = parseInt(s);
  return (n >= 1 && n <= 12) ? n : 0;
}

async function contarATPorMes(year, rutaRegistro) {
  if (!rutaRegistro) {
    console.warn('[EXCEL-BRIDGE] contarATPorMes: no se proporcionó ruta de registro');
    return { success: true, data: { mensual: {}, total: 0 } };
  }

  if (!fs.existsSync(rutaRegistro)) {
    console.warn('[EXCEL-BRIDGE] contarATPorMes: archivo no encontrado:', rutaRegistro);
    return { success: true, data: { mensual: {}, total: 0 } };
  }

  const XLSX = require('xlsx');
  const wb = XLSX.readFile(rutaRegistro);
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { success: true, data: { mensual: {}, total: 0 } };

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length < 2) return { success: true, data: { mensual: {}, total: 0 } };

  // Detectar fila de encabezados (buscar "Año", "Evento", "Mes" en primeras 10 filas)
  var headerIdx = 0;
  for (var i = 0; i < Math.min(10, rows.length); i++) {
    var row = rows[i];
    if (row.some(function(c) {
      var s = String(c).trim().toLowerCase();
      return s === 'año' || s === 'evento' || s === 'mes';
    })) {
      headerIdx = i;
      break;
    }
  }

  var headers = rows[headerIdx].map(function(h) { return String(h).trim(); });
  var iAnio = headers.findIndex(function(h) { return h.toLowerCase() === 'año'; });
  var iEvento = headers.findIndex(function(h) { return h.toLowerCase() === 'evento'; });
  var iMes = headers.findIndex(function(h) { return h.toLowerCase() === 'mes'; });
  var iFecha = headers.findIndex(function(h) { return h.toLowerCase().indexOf('fecha') >= 0; });

  var mensual = {};
  var total = 0;

  for (var r = headerIdx + 1; r < rows.length; r++) {
    var row = rows[r];
    var anioVal = parseInt(String(row[iAnio] || '').trim());
    if (!anioVal || anioVal < 2000) continue;

    var evento = String(row[iEvento] || '').trim().toLowerCase();
    if (evento !== 'at') continue;

    // Intentar por columna "Mes" primero
    var mesNum = 0;
    if (iMes >= 0) {
      mesNum = _mesToNumber(row[iMes]);
    }
    // Si no hay mes o es 0, intentar extraer de la fecha
    if (mesNum === 0 && iFecha >= 0) {
      var fechaVal = row[iFecha];
      if (typeof fechaVal === 'number') {
        var d = XLSX.SSF.parse_date_code(Math.floor(fechaVal));
        if (d) mesNum = d.m;
      } else if (fechaVal) {
        var parsed = new Date(String(fechaVal));
        if (!isNaN(parsed.getMonth())) mesNum = parsed.getMonth() + 1;
      }
    }

    // Filtrar por año
    if (anioVal !== year) continue;

    if (mesNum >= 1 && mesNum <= 12) {
      mensual[mesNum] = (mensual[mesNum] || 0) + 1;
      total++;
    }
  }

  console.log('[EXCEL-BRIDGE] contarATPorMes year=' + year + ' total=' + total, mensual);
  return { success: true, data: { mensual: mensual, total: total } };
}

// ── Exportar para usar en main.js ──
module.exports = {
  configurarRutas,
  configurarRutasConRuta,
  listarIndicadoresFiles,
  leerIndicadores,
  leerCaracterizacion,
  contarATPorMes,
  escribirEnExcel,
  leerIndicadoresMortalidad,
  escribirEnExcelMortalidad
};
