// =====================================================================
// 📦1095 (2026-11-23) — Lector del Excel oficial de ausentismo (PI/PG/GI-FO-076)
//
// Lee el archivo que la empresa ya usa (el entregable del 3.3.6) y lo
// convierte en filas normalizadas para la tabla `ausentismo_registros`.
//
// POR QUÉ UN LECTOR PROPIO Y NO EL PYTHON
// El Python (`Portear/src/actualizar_ausentismo.py`) es el que ESCRIBE el
// Excel. Para LEER hay dos formatos distintos en el mismo archivo:
//   - Hoja "Aseplus 2024" (y "2023 ", "2022"...): 25 columnas, encabezado en
//     la fila 7.
//   - Hoja "TD 2024": tablas dinamicas (resumenes), NO son datos.
// Y el nombre del archivo cambia por empresa: PI-FO-076, PG-..., GI-FO-076,
// A-FR-31. El mapeo se hace POR NOMBRE DE ENCABEZADO, no por posicion, para
// que las dos variantes (25 columnas y 13 columnas) se lean igual.
//
// MEDIDO (2026-11-23, Aseplus):
//   - "Aseplus 2024": ref A1:Y663, encabezado fila 7, 663 datos.
//   - "2023 ": ref A1:M196, encabezado fila 7, 13 columnas (formato viejo).
//   - "TD 2024" / "TD 2022": NO tienen columna CEDULA -> no son hojas de datos.
//
// Módulo PURO: no depende de Electron ni de la BD. Se puede correr con node
// pelado y probar en aislamiento.
// =====================================================================

const XLSX = require('xlsx');
const fs = require('fs');

// ─── Normalizacion de texto para comparar encabezados ──────────────────
function normalizar(txt) {
  return String(txt == null ? '' : txt)
    .replace(/[\u0300-\u036f]/g, '')      // quita tildes
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reglas de mapeo columna -> campo. El ORDEN importa: gana la primera regla
 * que calza con el encabezado y con la que todavia no tenga columna.
 * `nth` = cual de las apariciones de ese patron se toma (1 = la primera).
 */
const REGLAS = [
  { campo: 'mas_10_dias',      re: /^>\s*10/i,                          nth: 1 },
  { campo: 'diagnostico',      re: /descrip/i,                           nth: 1 },
  { campo: 'descripcion',      re: /descrip/i,                           nth: 2 },
  { campo: 'dias_incapacidad', re: /dias?\s*(de\s*)?incapacidad/i,       nth: 1 },
  { campo: 'fecha_inicio',     re: /f\.?\s*inicio|inicio\s*de\s*incap/i, nth: 1 },
  { campo: 'fecha_fin',        re: /f\.?\s*fin|finalizaci/i,             nth: 1 },
  { campo: 'tipo_incapacidad', re: /tipo\s*(de\s*)?incapacidad/i,        nth: 1 },
  { campo: 'clase_incapacidad',re: /clase\s*(de\s*)?incapacidad/i,       nth: 1 },
  { campo: 'concepto',         re: /concepto/i,                          nth: 1 },
  { campo: 'codigo',           re: /^c[oó]digo$/i,                      nth: 1 },
  { campo: 'cedula',           re: /c[ée]dula|documento\s+de\s+ident/i, nth: 1 },
  { campo: 'nombre',           re: /nombre/i,                            nth: 1 },
  { campo: 'cargo',            re: /cargo/i,                             nth: 1 },
  { campo: 'area',             re: /area|dpto|departamento/i,            nth: 1 },
  { campo: 'empresa_usuaria',  re: /empresa\s*usuaria/i,                 nth: 1 },
  { campo: 'empresa',          re: /empresa/i,                           nth: 1 },
  { campo: 'genero',           re: /g[ée]nero/i,                         nth: 1 },
  { campo: 'mes',              re: /^mes$/i,                             nth: 1 },
  { campo: 'anio',             re: /^a[nñ]o$/i,                          nth: 1 },
  { campo: 'entidad',          re: /entidad/i,                          nth: 1 },
  { campo: 'observaciones',    re: /observ/i,                            nth: 1 }
];

const MESES = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10,
  NOVIEMBRE: 11, DICIEMBRE: 12
};

/**
 * Arma el mapa campo -> indice de columna (0-based) a partir de los
 * encabezados de una fila. Una columna no se asigna dos veces.
 */
function mapearColumnas(encabezados) {
  const mapa = {};
  const usadas = new Set();
  for (const regla of REGLAS) {
    let vistas = 0;
    for (let i = 0; i < encabezados.length; i++) {
      if (usadas.has(i)) continue;
      const h = normalizar(encabezados[i]);
      if (!h) continue;
      if (!regla.re.test(h)) continue;
      vistas++;
      if (vistas < regla.nth) continue;
      mapa[regla.campo] = i;
      usadas.add(i);
      break;
    }
  }
  return mapa;
}

/**
 * Detecta la fila de encabezado de una hoja de datos.
 * Devuelve { filaHeader (1-based), mapa } o null si la hoja no es de datos.
 *
 * Es hoja de datos si tiene una columna de DIAS DE INCAPACIDAD **y** una de
 * CEDULA. Con las dos, las hojas TD (tablas dinamicas) quedan fuera.
 */
function detectarEncabezado(ws) {
  if (!ws || !ws['!ref']) return null;
  const rango = XLSX.utils.decode_range(ws['!ref']);
  const finFila = Math.min(rango.e.r, 12);   // el encabezado esta arriba
  for (let r = rango.s.r; r <= finFila; r++) {
    const encabezados = [];
    for (let c = rango.s.c; c <= rango.e.c; c++) {
      const celda = ws[XLSX.utils.encode_cell({ r, c })];
      encabezados.push(celda ? celda.v : '');
    }
    const normalizados = encabezados.map(normalizar);
    const tieneDias = normalizados.some(h => /dias?\s*(de\s*)?incapacidad/i.test(h));
    const tieneCedula = normalizados.some(h => /c[ée]dula|documento\s+de\s+ident/i.test(h));
    if (!tieneDias || !tieneCedula) continue;
    return { filaHeader: r + 1, mapa: mapearColumnas(encabezados) };
  }
  return null;
}

/** Convierte el valor de una celda a texto (o fecha ISO). */
function valorCelda(ws, fila, col) {
  const celda = ws[XLSX.utils.encode_cell({ r: fila, c: col })];
  if (!celda || celda.v === undefined || celda.v === null) return '';
  if (celda.v instanceof Date) return celda.v.toISOString().slice(0, 10);
  if (typeof celda.v === 'number') return celda.v;
  if (typeof celda.v === 'boolean') return celda.v ? 1 : 0;
  return String(celda.v).trim();
}

/** Serial de Excel -> 'YYYY-MM-DD'. */
function serialAFecha(serial) {
  if (typeof serial !== 'number' || !isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Texto a fecha ISO si parece una fecha; si no, null. */
function textoAFecha(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return serialAFecha(valor);
  const s = String(valor).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const d = String(Number(m[1])).padStart(2, '0');
    const mes = String(Number(m[2])).padStart(2, '0');
    return m[3] + '-' + mes + '-' + d;
  }
  return null;
}

/** Numero de mes (1-12) desde el texto del Excel ('ABRIL') o desde una fecha. */
function mesDesdeTexto(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return valor >= 1 && valor <= 12 ? valor : null;
  const s = normalizar(valor);
  if (MESES[s]) return MESES[s];
  const m = s.match(/^(\d{1,2})/);
  if (m) {
    const n = Number(m[1]);
    return (n >= 1 && n <= 12) ? n : null;
  }
  return null;
}

/** Anio de la hoja: 'Aseplus 2024' -> 2024; '2023 ' -> 2023. */
function anioDeHoja(nombreHoja) {
  const m = String(nombreHoja || '').match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

/** Lee una hoja de datos y devuelve las filas normalizadas. */
function leerHojaDatos(ws, nombreHoja) {
  const deteccion = detectarEncabezado(ws);
  if (!deteccion) return null;

  const { filaHeader, mapa } = deteccion;
  const rango = XLSX.utils.decode_range(ws['!ref']);
  const anioHoja = anioDeHoja(nombreHoja);
  const filas = [];

  const leer = (campo, indiceFila) => {
    if (mapa[campo] === undefined) return '';
    return valorCelda(ws, indiceFila, mapa[campo]);
  };

  for (let r = filaHeader; r <= rango.e.r; r++) {   // filaHeader es 1-based
    const indiceFila = r;                           // 0-based de la fila siguiente
    const cruda = {};
    let tieneAlgo = false;
    for (const campo of Object.keys(mapa)) {
      const v = leer(campo, indiceFila);
      cruda[campo] = v;
      if (v !== '' && v !== null && v !== undefined) tieneAlgo = true;
    }
    if (!tieneAlgo) continue;

    const cedula = String(cruda.cedula || '').replace(/[^\d]/g, '');
    const nombre = String(cruda.nombre || '').trim();
    if (!cedula && !nombre) continue;

    const fechaInicio = textoAFecha(cruda.fecha_inicio);
    const fechaFin = textoAFecha(cruda.fecha_fin);

    // Dias: el Excel los trae; si no, se calculan entre las fechas.
    let dias = Number(cruda.dias_incapacidad);
    if (!isFinite(dias) || dias <= 0) {
      if (fechaInicio && fechaFin) {
        const d1 = new Date(fechaInicio + 'T00:00:00Z').getTime();
        const d2 = new Date(fechaFin + 'T00:00:00Z').getTime();
        dias = Math.round((d2 - d1) / 86400000) + 1;
      } else {
        dias = 0;
      }
    }

    const anioColumna = Number(cruda.anio);
    const anio = (isFinite(anioColumna) && anioColumna > 1900) ? anioColumna : anioHoja;
    const mes = mesDesdeTexto(cruda.mes);
    const anioInc = fechaInicio ? Number(fechaInicio.slice(0, 4)) : null;
    const mesInc = fechaInicio ? Number(fechaInicio.slice(5, 7)) : null;

    filas.push({
      cedula: cedula,
      nombre: nombre,
      cargo: String(cruda.cargo || '').trim(),
      area: String(cruda.area || '').trim(),
      empresa_usuaria: String(cruda.empresa_usuaria || '').trim(),
      genero: String(cruda.genero || '').trim(),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      dias_incapacidad: dias,
      tipo_incapacidad: String(cruda.tipo_incapacidad || '').trim(),
      clase_incapacidad: String(cruda.clase_incapacidad || '').trim(),
      entidad: String(cruda.entidad || '').trim(),
      codigo: String(cruda.codigo || '').trim(),
      diagnostico: String(cruda.diagnostico || '').trim(),
      descripcion: String(cruda.descripcion || '').trim(),
      observaciones: String(cruda.observaciones || '').trim(),
      concepto: String(cruda.concepto || '').trim(),
      mas_10_dias: dias > 10 ? 1 : 0,
      anio: anio,
      mes: mes,
      anio_incapacidad: anioInc,
      mes_incapacidad: mesInc,
      excel_fila: r + 1,          // 1-based, como lo ve Excel
      excel_hoja: nombreHoja
    });
  }

  return { nombre: nombreHoja, anio: anioHoja, filaHeader: filaHeader, filas: filas };
}

/**
 * 📦1096 (2026-11-24) — Clave natural de un caso de incapacidad.
 *
 * MEDIDO: el archivo oficial trae el historico DOS veces. La hoja
 * "<Empresa> 2024" (25 columnas) trae TODOS los anios (2016-2026), y ademas
 * el archivo tiene las hojas "<anio>" sueltas (13 columnas) con los MISMOS
 * casos en el formato viejo. Sin deduplicar, el import metia 5 593 filas de
 * las cuales **1 985 eran duplicados exactos (35 %)**.
 *
 * La clave es persona + periodo + dias + codigo. Si no hay fechas no se puede
 * saber si son el mismo caso, asi que se anade la fila: dos casos sin fecha
 * nunca se fusionan.
 */
function _claveCaso(f) {
  var base = [
    f.cedula || '',
    f.fecha_inicio || '',
    f.fecha_fin || '',
    f.dias_incapacidad,
    f.codigo || ''
  ].join('|');
  if (f.fecha_inicio || f.fecha_fin) return base;
  return base + '|fila:' + f.excel_fila + ':' + (f.excel_hoja || '');
}

/**
 * 📦1096 — Deduplica las filas entre hojas.
 *
 * Gana la PRIMERA aparicion: la hoja de 25 columnas va antes que las sueltas
 * en el libro (medido en los 3 archivos), y es la que la app muestra hoy. La
 * fila conservada se COMPLETA con los campos que la repetida traia vacios
 * (un caso sin codigo en la hoja nueva puede tenerlo en la vieja).
 */
function _deduplicar(hojas) {
  var vistas = {};
  var duplicadas = 0;
  var resultado = [];

  for (var h = 0; h < hojas.length; h++) {
    var hoja = hojas[h];
    var conservadas = [];
    for (var i = 0; i < hoja.filas.length; i++) {
      var f = hoja.filas[i];
      var clave = _claveCaso(f);
      if (vistas[clave]) {
        duplicadas++;
        var previa = vistas[clave];
        for (var campo in f) {
          if (!Object.prototype.hasOwnProperty.call(f, campo)) continue;
          if (campo === 'excel_fila' || campo === 'excel_hoja') continue;
          var vacio = previa[campo] === '' || previa[campo] === null || previa[campo] === undefined;
          if (vacio && f[campo] !== '' && f[campo] !== null && f[campo] !== undefined) {
            previa[campo] = f[campo];
          }
        }
        continue;
      }
      vistas[clave] = f;
      conservadas.push(f);
    }
    if (conservadas.length) {
      resultado.push({
        nombre: hoja.nombre,
        anio: hoja.anio,
        filaHeader: hoja.filaHeader,
        filas: conservadas
      });
    }
  }

  return { hojas: resultado, duplicadas: duplicadas };
}

/**
 * Lee el archivo completo. Devuelve { hojas, total, avisos, duplicadas }.
 * `avisos` son cosas que el usuario debe saber (hojas sin datos, etc.).
 */
function leerArchivoAusentismo(filePath) {
  const avisos = [];
  const hojas = [];
  if (!filePath || !fs.existsSync(filePath)) {
    return { hojas: hojas, total: 0, avisos: ['No existe el archivo: ' + filePath] };
  }

  let libro;
  try {
    libro = XLSX.readFile(filePath, { cellDates: true });
  } catch (e) {
    return { hojas: hojas, total: 0, avisos: ['No se pudo leer el archivo: ' + e.message] };
  }

  for (const nombreHoja of libro.SheetNames) {
    const ws = libro.Sheets[nombreHoja];
    const leida = leerHojaDatos(ws, nombreHoja);
    if (!leida) continue;
    if (!leida.filas.length) {
      avisos.push('La hoja "' + nombreHoja + '" no tiene filas de datos.');
      continue;
    }
    hojas.push(leida);
  }

  // 📦1096 — Deduplicar entre hojas: el historico esta duplicado en el
  // archivo oficial (la hoja de 25 columnas trae todos los anios, y las
  // hojas sueltas "<anio>" traen los mismos casos en el formato viejo).
  var dedup = _deduplicar(hojas);
  var hojasUnicas = dedup.hojas;
  if (dedup.duplicadas) {
    avisos.push('Se descartaron ' + dedup.duplicadas + ' fila(s) repetidas: el archivo oficial trae ' +
      'el historico dos veces (la hoja del anio con todos los anios y las hojas sueltas por anio).');
  }

  if (!hojasUnicas.length) {
    avisos.push('No se encontró ninguna hoja de datos (con columna de días de incapacidad y de cédula).');
  }

  const total = hojasUnicas.reduce((acc, h) => acc + h.filas.length, 0);
  return { hojas: hojasUnicas, total: total, avisos: avisos, duplicadas: dedup.duplicadas };
}

module.exports = {
  leerArchivoAusentismo,
  leerHojaDatos,
  detectarEncabezado,
  mapearColumnas,
  normalizar,
  serialAFecha,
  textoAFecha,
  mesDesdeTexto,
  anioDeHoja,
  REGLAS,
  MESES,
  // 📦1096 — deduplicacion entre hojas
  _deduplicar: _deduplicar,
  _claveCaso: _claveCaso
};
