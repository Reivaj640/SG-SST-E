/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — REVISIÓN POR LA ALTA DIRECCIÓN
 * Bridge IPC · Backend Process
 * Patrón: registerHandlers(app, deps) — igual que inspecciones-bridge.js
 * =====================================================================
 */

const { ipcMain, app, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Dependencia inyectada en registerHandlers ──────────────────────
var _getCompanyRootPath = null;
var _getDb = null;

// ─── Helpers de filesystem ──────────────────────────────────────────

/**
 * Resuelve la ruta del módulo 6.1.3 dentro de la carpeta de la empresa
 * (Google Drive / OneDrive / local). Misma estrategia inteligente que
 * identificacion-peligros-bridge.js:
 *   1. Buscar "6. Verificación" / "6. Verificacion"
 *   2. Buscar subcarpeta que empiece con "6.1.3"
 *   3. Si no existe ninguna, devolver la ruta esperada (se creará al guardar)
 *
 * FALLBACK: Si la empresa no está configurada (no se encuentra en
 * config.companyPaths), usa la ruta local en userData como antes.
 * @param {string} empresaId - Identificador o nombre de la empresa
 * @returns {string|null} Ruta absoluta al directorio del módulo 6.1.3
 */
function _getEmpresaDir(empresaId) {
  if (!empresaId) {
    // Fallback a userData si no hay empresa
    const userData = app.getPath('userData');
    return path.join(userData, 'empresas', 'default', '6.1.3');
  }

  var companyRoot = null;
  // Resolver companyRoot síncronamente leyendo config.json directamente.
  // getCompanyRootPath (inyectado vía deps) es async; como esta función
  // es llamada desde parsers y generadores síncronos, leemos el config
  // local con fs.readFileSync — archivo local, milisegundos.
  try {
    var configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      var cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      var normalized = String(empresaId).toLowerCase().trim();
      var companyKey = Object.keys(cfg.companyPaths || {}).find(function(k) {
        return String(k).toLowerCase().trim() === normalized;
      });
      if (companyKey) {
        companyRoot = cfg.companyPaths[companyKey].root || cfg.companyPaths[companyKey].ruta_base || null;
      }
    }
  } catch (e) { /* ignore */ }

  // Fallback a userData si no se pudo resolver la ruta de la empresa
  if (!companyRoot || !fs.existsSync(companyRoot)) {
    const userData = app.getPath('userData');
    return path.join(userData, 'empresas', empresaId, '6.1.3');
  }

  // Variantes con/sin tildes del nombre de la carpeta "6. Verificación"
  var verifVariants = ['6. Verificación', '6. Verificacion'];
  for (var i = 0; i < verifVariants.length; i++) {
    var verifDir = path.join(companyRoot, verifVariants[i]);
    if (fs.existsSync(verifDir)) {
      try {
        var entries = fs.readdirSync(verifDir);
        // Buscar subcarpeta que empiece con "6.1.3" (puede tener sufijos)
        var subfolder = entries.find(function(f) {
          return f.indexOf('6.1.3') === 0 && fs.statSync(path.join(verifDir, f)).isDirectory();
        });
        if (subfolder) return path.join(verifDir, subfolder);
        // Si no hay subcarpeta 6.1.3 pero existe "6. Verificación", usar esa raíz
        return verifDir;
      } catch (e) { /* ignore */ }
    }
  }

  // Búsqueda alternativa: scan recursivo de cualquier carpeta que contenga "6.1.3"
  try {
    var rootEntries = fs.readdirSync(companyRoot);
    var verifFolder = rootEntries.find(function(f) {
      return /^6\.\s*Verific/i.test(f) && fs.statSync(path.join(companyRoot, f)).isDirectory();
    });
    if (verifFolder) {
      var folder = path.join(companyRoot, verifFolder);
      var subEntries = fs.readdirSync(folder);
      var sub = subEntries.find(function(f) { return f.indexOf('6.1.3') === 0; });
      if (sub) return path.join(folder, sub);
      return folder;
    }
  } catch (e) { /* ignore */ }

  // Fallback: devolver la ruta esperada (se creará al guardar)
  return path.join(companyRoot, '6. Verificación', '6.1.3 Revisión del alta Dirección');
}

function _ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Auto-import desde XLSX oficiales cuando los JSON locales no existen.
 * Escanea la carpeta del módulo 6.1.3 buscando archivos que empiecen
 * con los prefijos G-FO-006, G-FO-009, G-FO-001, GG-FO-005 y los
 * parsea a JSON usando los parsers existentes. Solo se ejecuta si
 * el JSON correspondiente no existe (no sobreescribe datos del usuario).
 * @param {string} dir - Carpeta del módulo 6.1.3 dentro de la empresa
 * @returns {Object} Resumen: { gfo006: N, gfo009: N, gfo001: N, ggfo005: N }
 */
function _autoImportXlsx(dir) {
  var result = { gfo006: 0, gfo009: 0, gfo001: 0, ggfo005: 0 };
  if (!XLSX || !dir || !fs.existsSync(dir)) return result;

  try {
    var entries = fs.readdirSync(dir);

    /* Genera IDs a partir del nombre de archivo (e.g. "G-FO-006 ... 2024.xlsx" → RG-2024-NN).
       Usado solo para G-FO-006; los demás formatos conservan el ID que devuelve su parser. */
    function _inferIdFromFilename(currentResults, filename) {
      var yearMatch = filename.match(/(\d{4})/);
      var year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
      var num = String(currentResults.length + 1).padStart(2, '0');
      return { id: 'RG-' + year + '-' + num, periodo: year };
    }

    /* Procesa un formato: filtra archivos por prefijo, los parsea y los guarda en JSON. */
    function _processTemplate(opts) {
      var files = entries.filter(function(f) {
        return new RegExp('^' + opts.prefix, 'i').test(f) && /\.(xlsx|xls)$/i.test(f);
      });
      // jsonName puede ser distinto del prefix: los archivos en Drive usan
      // "GG-FO-006" pero el JSON local se llama "G-FO-006.json" para
      // mantener compatibilidad con los handlers existentes.
      var jsonPath = path.join(dir, opts.jsonName || (opts.prefix + '.json'));
      if (files.length === 0 || fs.existsSync(jsonPath)) return 0;

      var results = [];
      files.forEach(function(f) {
        try {
          var wb = XLSX.readFile(path.join(dir, f), { cellDates: true });
          var parsed = opts.parser(wb);
          if (Array.isArray(parsed)) {
            results = results.concat(parsed);
          } else {
            if (opts.prefix === 'GG-FO-006') {
              /* Caso especial: G-FO-006 produce una revisión por archivo,
                 con ID inferido del nombre del archivo */
              var meta = _inferIdFromFilename(results, f);
              parsed.id = meta.id;
              parsed.periodo = meta.periodo;
              parsed.estado = 'Realizada';
              parsed.fecha = parsed.fecha || new Date().toISOString().split('T')[0];
              parsed.progreso = 100;
            }
            results.push(parsed);
          }
        } catch (e) {
          console.error('[K+AIRSST][6.1.3][AUTO_IMPORT][' + opts.prefix + ']', f, e.message);
        }
      });
      if (results.length > 0) {
        _writeJson(jsonPath, results);
        console.log('[K+AIRSST][6.1.3][AUTO_IMPORT] ' + opts.prefix + ': ' + results.length + ' ' + opts.label + ' importados');
      }
      return results.length;
    }

    result.gfo006 = _processTemplate({ prefix: 'GG-FO-006', jsonName: 'G-FO-006.json', parser: _parserGFO006, label: 'revisiones' });
    result.gfo009 = _processTemplate({ prefix: 'GG-FO-009', jsonName: 'G-FO-009.json', parser: _parserGFO009, label: 'actas' });
    result.gfo001 = _processTemplate({ prefix: 'GG-FO-001', jsonName: 'G-FO-001.json', parser: _parserGFO001, label: 'indicadores' });
    result.ggfo005 = _processTemplate({ prefix: 'GG-FO-005', jsonName: 'GG-FO-005.json', parser: _parserGGFO005, label: 'documentos' });
  } catch (e) {
    console.error('[K+AIRSST][6.1.3][AUTO_IMPORT][ERROR]', e.message);
  }
  return result;
}

function _readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('[K+AIRSST][6.1.3][READ_JSON][ERROR]', filePath, e.message);
    return null;
  }
}

function _writeJson(filePath, data) {
  _ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Generadores de ID ──────────────────────────────────────────────

function _generateRevisionId(empresaId) {
  const dir = _getEmpresaDir(empresaId);
  const filePath = path.join(dir, 'G-FO-006.json');
  const items = _readJson(filePath) || [];
  const year = new Date().getFullYear();
  const yearItems = items.filter(function(r) { return r.id && r.id.indexOf('RG-' + year) === 0; });
  const nextNum = yearItems.length + 1;
  return 'RG-' + year + '-' + String(nextNum).padStart(2, '0');
}

function _generateIndicadorId(empresaId) {
  const dir = _getEmpresaDir(empresaId);
  const filePath = path.join(dir, 'G-FO-001.json');
  const items = _readJson(filePath) || [];
  const nextNum = items.length + 1;
  return 'IND-' + String(nextNum).padStart(3, '0');
}

function _generateActaNumero(empresaId) {
  const dir = _getEmpresaDir(empresaId);
  const filePath = path.join(dir, 'G-FO-009.json');
  const items = _readJson(filePath) || [];
  const year = new Date().getFullYear();
  const yearItems = items.filter(function(a) {
    return a.fecha && new Date(a.fecha).getFullYear() === year;
  });
  return yearItems.length + 1;
}

// ─── Las 12 secciones canónicas del G-FO-006 ───────────────────────

var SECCIONES_CANONICAS = [
  { numero: 1, titulo: 'Lectura del acta anterior' },
  { numero: 2, titulo: 'Revisión de componentes organizacionales' },
  { numero: 3, titulo: 'Auditorías internas' },
  { numero: 4, titulo: 'Requisitos legales' },
  { numero: 5, titulo: 'Participación y consulta' },
  { numero: 6, titulo: 'Investigación de incidentes' },
  { numero: 7, titulo: 'Acciones del acta anterior' },
  { numero: 8, titulo: 'Cambios que pueden afectar el SG-SST' },
  { numero: 9, titulo: 'Recursos' },
  { numero: 10, titulo: 'Gestión de riesgos' },
  { numero: 11, titulo: 'Actividades pendientes' },
  { numero: 12, titulo: 'Conclusiones, recomendaciones y acciones tomadas' }
];

function _createSeccionesVacias() {
  return SECCIONES_CANONICAS.map(function(s) {
    return {
      numero: s.numero,
      titulo: s.titulo,
      contenido: '',
      subTemas: [],
      acciones: []
    };
  });
}

// ─── Validaciones de negocio ────────────────────────────────────────

var ESTADOS_REVISION = ['Borrador', 'Programada', 'Realizada', 'Cerrada'];

function _validarTransicionEstado(estadoActual, nuevoEstado) {
  var transicionesPermitidas = {
    'Borrador': ['Programada'],
    'Programada': ['Borrador', 'Realizada'],
    'Realizada': ['Cerrada', 'Programada'],
    'Cerrada': ['Realizada']
  };
  var permitidos = transicionesPermitidas[estadoActual] || [];
  return permitidos.indexOf(nuevoEstado) !== -1;
}

function _validarRevisionParaCerrar(revision) {
  var errores = [];
  if (!revision.secciones || revision.secciones.length < 12) {
    errores.push('Faltan secciones canónicas');
  } else {
    var vacias = revision.secciones.filter(function(s) { return !s.contenido || s.contenido.trim() === ''; });
    if (vacias.length > 0) {
      var nums = vacias.map(function(s) { return s.numero; });
      errores.push('Las secciones ' + nums.join(', ') + ' están vacías');
    }
  }
  if (!revision.proximaRevision) {
    errores.push('Debe definir la próxima revisión');
  }
  if (!revision.porEmpresa || revision.porEmpresa.length === 0) {
    errores.push('Debe haber al menos un participante por la empresa');
  }
  return errores;
}

// ─── Parsers XLSX → JSON ───────────────────────────────────────────

var XLSX;
try { XLSX = require('xlsx'); } catch (e) { console.warn('[K+AIRSST][6.1.3][INIT][WARN] xlsx no disponible, exportación deshabilitada'); }

function _getPlantillaPath(tipoPlantilla) {
  var map = {
    'G-FO-001': 'G-FO-001.xlsx',
    'G-FO-006': 'G-FO-006.xlsx',
    'G-FO-009': 'G-FO-009.xlsx',
    'GG-FO-005': 'GG-FO-005.xlsx'
  };
  return path.join(app.getPath('userData'), 'plantillas', '6.1.3', map[tipoPlantilla] || '');
}

function _getPlantillaSourcePath(tipoPlantilla) {
  var map = {
    'G-FO-001': 'G-FO-001 DESPLIEGUE ESTRATEGICO.xls',
    'G-FO-006': 'G-FO-006 REVISION GERENCIAL 03.xlsx',
    'G-FO-009': 'G-FO-009 ACTA DE REUNION GERENCIAL.xlsx',
    'GG-FO-005': 'GG-FO-005 REGISTRO DE DOCUMENTOS INTERNOS Y EXTRENOS.xlsx'
  };
  var appPath = app.getAppPath();
  return path.join(appPath, 'utils', map[tipoPlantilla] || '');
}

function _getCellValue(sheet, cellRef) {
  var cell = sheet[cellRef];
  if (!cell) return '';
  return String(cell.v || '');
}

function _getMergedCellValue(sheet, row, colStart) {
  var cellRef = XLSX.utils.encode_cell({ r: row - 1, c: colStart });
  var cell = sheet[cellRef];
  if (!cell) return '';
  return String(cell.v || '');
}

function _getMergedRangeText(sheet, row, colStart, colEnd) {
  var parts = [];
  for (var c = colStart; c <= colEnd; c++) {
    var ref = XLSX.utils.encode_cell({ r: row - 1, c: c });
    var cell = sheet[ref];
    if (cell && cell.v) parts.push(String(cell.v));
  }
  return parts.join(' ').trim();
}

// ─── Parser G-FO-001: Despliegue Estratégico (22×7) ───────────────
// Fila 6: encabezados | Filas 7-22: datos (16 indicadores)
// Columnas: A=Política Integral, B=Objetivo, C=Indicador, D=Fórmula, E=Meta, F=Frecuencia, G=Responsable

function _parserGFO001(workbook) {
  var sheetName = workbook.SheetNames[0];
  var sheet = workbook.Sheets[sheetName];
  var indicadores = [];

  for (var i = 7; i <= 22; i++) {
    var objetivo = _getMergedCellValue(sheet, i, 1);
    if (!objetivo) continue;
    indicadores.push({
      id: _generateIndicadorId('temp'),
      politicaIntegral: _getMergedCellValue(sheet, i, 0),
      objetivoEstrategico: objetivo,
      indicador: _getMergedCellValue(sheet, i, 2),
      formula: _getMergedCellValue(sheet, i, 3),
      meta: _getMergedCellValue(sheet, i, 4),
      frecuencia: _getMergedCellValue(sheet, i, 5),
      responsable: _getMergedCellValue(sheet, i, 6),
      categoria: 'Cumplimiento',
      mediciones: []
    });
  }
  return indicadores;
}

// ─── Parser GI-FO-044 OBJETIVOS Y METAS DEL SST ─────────────────────
// Estructura: Fila 5 encabezados | Fila 6+ datos
// Columnas: B=Objetivo, C=Indicador, D=Fórmula, E=Meta, F=Frecuencia, G=Responsable
// (Sin columna Política — la política vive en su propia vista)
//
// Esta es la fuente de verdad real: el módulo 2.2.1 Objetivos SST escribe
// en este archivo desde el editor visual. Reutilizar el mismo archivo en
// 6.1.3 garantiza que ambas vistas estén sincronizadas.

function _parserGFO044ObjetivosSST(workbook) {
  var sheetName = workbook.SheetNames[0];
  var sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet['!ref']) return [];
  var range = XLSX.utils.decode_range(sheet['!ref']);

  var indicadores = [];
  /* Iterar desde fila 6 (1-based) hasta el final — sin límite fijo. */
  for (var r = 5; r <= range.e.r; r++) {
    var rowIdx = r + 1; /* 0-based → 1-based */
    var objetivoCell = XLSX.utils.encode_cell({ r: r, c: 1 });
    var indicadorCell = XLSX.utils.encode_cell({ r: r, c: 2 });
    var formulaCell   = XLSX.utils.encode_cell({ r: r, c: 3 });
    var metaCell      = XLSX.utils.encode_cell({ r: r, c: 4 });
    var frecCell      = XLSX.utils.encode_cell({ r: r, c: 5 });
    var respCell      = XLSX.utils.encode_cell({ r: r, c: 6 });

    var objetivoCellObj = sheet[objetivoCell];
    var objetivo = objetivoCellObj && objetivoCellObj.v != null ? String(objetivoCellObj.v).trim() : '';
    if (!objetivo) continue;

    function _val(cellRef) {
      var c = sheet[cellRef];
      return c && c.v != null ? String(c.v).trim() : '';
    }

    indicadores.push({
      objetivoEstrategico: objetivo,
      indicador: _val(indicadorCell),
      formula: _val(formulaCell),
      meta: _val(metaCell),
      frecuencia: _val(frecCell),
      responsable: _val(respCell),
      /* Sin política — la vista 6.1.3 ya no la refleja */
      /* Fila de origen, útil para diagnóstico */
      _origenFila: rowIdx
    });
  }
  return indicadores;
}

/**
 * Busca el Excel "GI-FO-044 OBJETIVOS Y METAS DEL SST" dentro de la carpeta
 * raíz de la empresa.
 *
 * Estrategia robusta (dos pasadas + ruta directa al submódulo):
 *   0. Ruta directa: prefiere la carpeta "2.2.1 Objetivos SST" si existe.
 *      Esta es la fuente ÚNICA que edita el módulo 2.2.1 — más confiable
 *      que buscar por nombre de archivo.
 *   1. Pasada completa del árbol buscando SOLO matches EXACTOS del nombre
 *      "GI-FO-044 OBJETIVOS Y METAS DEL SST". Entre múltiples matches, gana
 *      el de fecha de modificación más reciente.
 *   2. Si no hay exacto, pasada completa buscando matches FLEXIBLES
 *      (excluyendo explícitamente archivos tipo "anexo"/"modelo"/"guía"
 *      que son plantillas ministeriales viejas, no fuentes vivas).
 *
 * NOTA: Hacemos dos pasadas separadas porque la primera pasada de un DFS
 * puede encontrar un match flexible ("ANEXO 21 MODELO OBJETIVOS_Y_METAS")
 * en una carpeta hermana antes de llegar al match exacto en la carpeta
 * destino. El bug original era exactamente ese.
 *
 * @param {string} companyRoot - Ruta raíz de la empresa (Drive local)
 * @returns {string|null} Ruta absoluta al Excel o null si no existe
 */
function _resolverExcelObjetivosSST(companyRoot) {
  if (!companyRoot || !fs.existsSync(companyRoot)) {
    console.warn('[K+AIRSST][6.1.3][SEED_INDICADORES] companyRoot inválido o no existe:', companyRoot);
    return null;
  }

  var MAX_DEPTH = 5;
  var SKIP_DIRS = new Set(['.git', 'node_modules', '.cache', '.tmp', '__pycache__',
    'venv', '.venv', '.idea', '.vscode', 'dist', 'build']);

  function _isExactObjetivosFile(name) {
    if (name.startsWith('~$')) return false;
    if (!/\.(xlsx|xls)$/i.test(name)) return false;
    var upper = name.toUpperCase();
    return upper.indexOf('GI-FO-044 OBJETIVOS Y METAS DEL SST') !== -1;
  }

  function _isFlexibleObjetivosFile(name) {
    if (name.startsWith('~$')) return false;
    if (!/\.(xlsx|xls)$/i.test(name)) return false;
    var lower = name.toLowerCase();
    if (lower.indexOf('objetivos') === -1) return false;
    /* Excluir plantillas ministeriales viejas (tienen estructura distinta) */
    if (lower.indexOf('anexo') !== -1) return false;
    if (lower.indexOf('modelo') !== -1) return false;
    if (lower.indexOf('guia') !== -1) return false;
    return (lower.indexOf('metas') !== -1) || (lower.indexOf('sst') !== -1);
  }

  /**
   * Recorre TODO el árbol (max depth) aplicando visit(name, fullPath) a
   * cada archivo .xls/.xlsx que pase el filtro. No corta al primer match.
   */
  function _walkTree(dir, depth, visit) {
    if (depth > MAX_DEPTH) return;
    var entries;
    try { entries = fs.readdirSync(dir); } catch (e) { return; }
    for (var i = 0; i < entries.length; i++) {
      var f = entries[i];
      var full = path.join(dir, f);
      if (!f.startsWith('~$') && /\.(xlsx|xls)$/i.test(f)) {
        try { visit(f, full); } catch (e) { /* ignore */ }
      }
      if (!f.startsWith('.') && !SKIP_DIRS.has(f)) {
        try {
          if (fs.statSync(full).isDirectory()) _walkTree(full, depth + 1, visit);
        } catch (e) { /* ignore */ }
      }
    }
  }

  /* ─── PASO 0: ruta directa al submódulo 2.2.1 ─── */
  var submoduleFolder = _findSubmoduleFolder(companyRoot, '2.2.1');
  if (submoduleFolder) {
    try {
      var smEntries = fs.readdirSync(submoduleFolder);
      for (var s = 0; s < smEntries.length; s++) {
        if (_isExactObjetivosFile(smEntries[s])) {
          var directPath = path.join(submoduleFolder, smEntries[s]);
          console.log('[K+AIRSST][6.1.3][SEED_INDICADORES] GI-FO-044 desde submódulo 2.2.1:', directPath);
          return directPath;
        }
      }
    } catch (e) { /* ignore */ }
  }

  /* ─── PASO 1: pasada completa solo EXACTO, desempatando por mtime ─── */
  var exactCandidates = [];
  _walkTree(companyRoot, 0, function(name, full) {
    if (_isExactObjetivosFile(name)) exactCandidates.push(full);
  });
  if (exactCandidates.length > 0) {
    /* Preferir el archivo modificado más recientemente */
    exactCandidates.sort(function(a, b) {
      try {
        var ma = fs.statSync(a).mtime.getTime();
        var mb = fs.statSync(b).mtime.getTime();
        return mb - ma;
      } catch (e) { return 0; }
    });
    console.log('[K+AIRSST][6.1.3][SEED_INDICADORES] GI-FO-044 EXACTO ('
      + exactCandidates.length + ' candidatos, el más reciente): ' + exactCandidates[0]);
    return exactCandidates[0];
  }

  /* ─── PASO 2: pasada completa FLEXIBLE (excluyendo plantillas) ─── */
  var flexibleCandidates = [];
  _walkTree(companyRoot, 0, function(name, full) {
    if (_isFlexibleObjetivosFile(name)) flexibleCandidates.push(full);
  });
  if (flexibleCandidates.length > 0) {
    /* Preferir el más reciente */
    flexibleCandidates.sort(function(a, b) {
      try {
        var ma = fs.statSync(a).mtime.getTime();
        var mb = fs.statSync(b).mtime.getTime();
        return mb - ma;
      } catch (e) { return 0; }
    });
    console.warn('[K+AIRSST][6.1.3][SEED_INDICADORES] GI-FO-044 NO encontrado como exacto; usando FLEXIBLE:',
      flexibleCandidates[0]);
    return flexibleCandidates[0];
  }

  console.warn('[K+AIRSST][6.1.3][SEED_INDICADORES] GI-FO-044 NO encontrado bajo:', companyRoot);
  return null;
}

/**
 * Busca la carpeta de un submódulo (p. ej. "2.2.1 Objetivos SST") dentro de
 * la raíz de la empresa. Útil cuando queremos evitar depender del nombre del
 * archivo y leer directamente desde donde el submódulo guarda sus datos.
 *
 * Búsqueda recursiva (max 4 niveles): empieza en el nivel inmediato y
 * desciende. Devuelve la primera carpeta cuyo nombre empieza con el prefijo
 * (p. ej. "2.2.1" → "2.2.1 Objetivos SST/").
 *
 * Tolerante a mayúsculas, acentos y sufijos ("2.2.1 OBJETIVOS DEL SG-SST",
 * "2.2.1 Objetivos SST (Copia)", etc.).
 */
function _findSubmoduleFolder(companyRoot, submodulePrefix) {
  if (!companyRoot || !fs.existsSync(companyRoot)) return null;
  var MAX_DEPTH = 4;
  var SKIP_DIRS = new Set(['.git', 'node_modules', '.cache', '.tmp', '__pycache__',
    'venv', '.venv', '.idea', '.vscode', 'dist', 'build']);
  var prefixLower = submodulePrefix.toLowerCase();

  function _search(dir, depth) {
    if (depth > MAX_DEPTH) return null;
    var entries;
    try { entries = fs.readdirSync(dir); } catch (e) { return null; }

    /* Coincidencia exacta del prefijo al inicio del nombre */
    for (var i = 0; i < entries.length; i++) {
      var name = entries[i];
      if (name.toLowerCase().indexOf(prefixLower) === 0) {
        var full = path.join(dir, name);
        try {
          if (fs.statSync(full).isDirectory()) return full;
        } catch (e) { /* ignore */ }
      }
    }

    /* Descender */
    for (var j = 0; j < entries.length; j++) {
      var fk = entries[j];
      if (fk.startsWith('.') || SKIP_DIRS.has(fk)) continue;
      var fullPath = path.join(dir, fk);
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          var found = _search(fullPath, depth + 1);
          if (found) return found;
        }
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  return _search(companyRoot, 0);
}

// ─── Parser G-FO-006: Acta de Revisión Gerencial (123×98) ─────────
// Estructura real inspeccionada:
//   R5: GENERALIDADES (merged A5:F5)
//   R9: PARTICIPANTES (merged A9:E9), R10: POR LA EMPRESA (merged C10:E10)
//   R29: §1 LECTURA DEL ACTA ANTERIOR → contenido en R30 (merged A30:F30)
//   R31: §2 REVISIÓN DE COMPONENTES ORGANIZACIONALES → sub-temas R32-R36
//   R37: §3 AUDITORIAS INTERNAS → contenido R38-R42
//   R43: §4 REQUISITOS LEGALES → contenido R44-R46
//   R47: §5 PARTICIPACIÓN Y CONSULTA → sub-temas R48-R51
//   R52: §6 INVESTIGACIÓN DE INCIDENTES → contenido R53-R57
//   R58: §7 ACCIONES ACTA ANTERIOR → contenido R59-R60
//   R61: §8 CAMBIOS QUE PUEDAN AFECTAR → contenido R62-R63
//   R64: §9 RECURSOS → contenido R65-R68
//   R80: §10 GESTIÓN DE RIESGOS → contenido R81
//   R82: §11 ACTIVIDADES PENDIENTES → contenido R83-R84
//   R85: §12 CONCLUSIONES FINALES → contenido R86-R99

// ─── Marcadores dinámicos para detectar las 12 secciones canónicas ───
// En vez de hardcodear filas (que cambian entre versiones de la plantilla),
// buscamos cada sección por su texto característico. Tolerante a mayúsculas,
// acentos y variaciones menores en el título.
//
// Estructura típica: "1. LECTURA DEL ACTA ANTERIOR" ocupa una fila merged
// completa; el contenido va desde la fila siguiente hasta el próximo título.

var GFO006_SECCIONES_MARCADORES = [
  { numero: 1, titulo: 'Lectura del acta anterior', patron: /^1\.\s*LECTURA\s+DEL\s+ACTA\s+ANTERIOR/i },
  { numero: 2, titulo: 'Revisión de componentes organizacionales', patron: /^2\.\s*REVISI[ÓO]N\s+DE\s+COMPONENTES\s+ORGANIZACIONALES/i },
  { numero: 3, titulo: 'Auditorías internas', patron: /^3\.\s*AUDITOR[IÍ]AS?\s+INTERNAS?/i },
  { numero: 4, titulo: 'Requisitos legales', patron: /^4\.\s*REQUISITOS?\s+LEGALES?/i },
  { numero: 5, titulo: 'Participación y consulta', patron: /^5\.\s*PARTICIPACI[ÓO]N\s+Y\s+CONSULTA/i },
  { numero: 6, titulo: 'Investigación de incidentes', patron: /^6\.\s*INVESTIGACI[ÓO]N\s+DE\s+INCIDENTES/i },
  { numero: 7, titulo: 'Acciones del acta anterior', patron: /^7\.\s*ACCIONES?\s+(DEL\s+)?ACTA/i },
  { numero: 8, titulo: 'Cambios que pueden afectar el SG-SST', patron: /^8\.\s*CAMBIOS\s+QUE\s+PUEDAN\s+AFECTAR/i },
  { numero: 9, titulo: 'Recursos', patron: /^9\.\s*RECURSOS/i },
  { numero: 10, titulo: 'Gestión de riesgos', patron: /^10\.\s*GESTI[ÓO]N\s+DE\s+RIESGOS/i },
  { numero: 11, titulo: 'Actividades pendientes', patron: /^11\.\s*ACTIVIDADES?\s+PENDIENTES?/i },
  { numero: 12, titulo: 'Conclusiones, recomendaciones y acciones tomadas', patron: /^12\.\s*CONCLUSIONES/i }
];

// Sub-temas dentro de cada sección (se detectan por patrón en el texto de la fila)
var GFO006_SUBTEMAS_PATRONES = {
  2: [
    { patron: /^OBJETIVOS?:/i, titulo: 'Objetivos' },
    { patron: /^POLI[ÍI]TICA\s+SST:/i, titulo: 'Política SST' },
    { patron: /^POLI[ÍI]TICA\s+ALCOHOL\s+Y\s+DROGAS?:/i, titulo: 'Política alcohol y drogas' },
    { patron: /^REGLAMENTO\s+DE\s+HIGIENE\s+Y\s+SEGURIDAD:/i, titulo: 'Reglamento de higiene y seguridad' },
    { patron: /^MISI[ÓO]N,\s*VISI[ÓO]N\s+Y\s+VALORES:/i, titulo: 'Misión, visión y valores' }
  ],
  5: [
    { patron: /^QUEJAS,\s*RECLAMOS\s+Y\s+SUGERENCIAS/i, titulo: 'Quejas, reclamos y sugerencias' },
    { patron: /^COPASST:?/i, titulo: 'COPASST' }
  ]
};

/**
 * Busca todas las apariciones de los marcadores de sección en la hoja.
 * @returns {Array<{row:number, numero:number, titulo:string}>} ordenado por fila
 */
function _detectarSeccionesGFO006(sheet) {
  var matches = [];
  if (!sheet['!ref']) return matches;
  var range = XLSX.utils.decode_range(sheet['!ref']);

  for (var r = 0; r <= range.e.r; r++) {
    // Solo revisar las primeras 6 columnas (la sección siempre está merged en A:F)
    var rowText = '';
    for (var c = 0; c < 6; c++) {
      var addr = XLSX.utils.encode_cell({ r: r, c: c });
      var cell = sheet[addr];
      if (cell && cell.v != null) {
        rowText += (rowText ? ' ' : '') + String(cell.v);
      }
    }
    if (!rowText) continue;

    for (var i = 0; i < GFO006_SECCIONES_MARCADORES.length; i++) {
      var m = GFO006_SECCIONES_MARCADORES[i];
      if (m.patron.test(rowText.trim())) {
        // Evitar duplicados en la misma fila
        var dup = matches.find(function(x) { return x.row === r + 1; });
        if (!dup) {
          matches.push({ row: r + 1, numero: m.numero, titulo: m.titulo });
        }
        break;
      }
    }
  }

  matches.sort(function(a, b) { return a.row - b.row; });
  return matches;
}

function _parserGFO006(workbook) {
  var sheetName = workbook.SheetNames.find(function(n) {
    return n.indexOf('Acta') !== -1 || n.indexOf('Revisi') !== -1;
  }) || workbook.SheetNames[0];
  var sheet = workbook.Sheets[sheetName];
  if (!sheet) return { secciones: _createSeccionesVacias(), porEmpresa: [], invitados: [] };

  var revision = {
    secciones: _createSeccionesVacias(),
    porEmpresa: [],
    invitados: []
  };

  // ─── 1. PARTICIPANTES (filas 12-28): A-B = por empresa, C-E = invitados ───
  // Filtrar bogus: celdas merged de títulos de sección pueden contaminar.
  // Un participante válido tiene nombre y cargo DISTINTOS.
  for (var p = 12; p <= 28; p++) {
    var nombreEmpresa = _getMergedCellValue(sheet, p, 0);
    var cargoEmpresa = _getMergedCellValue(sheet, p, 1);
    var nombreInvitado = _getMergedCellValue(sheet, p, 2);
    var cargoInvitado = _getMergedCellValue(sheet, p, 4);

    if (nombreEmpresa && cargoEmpresa && nombreEmpresa !== cargoEmpresa) {
      revision.porEmpresa.push({ nombre: nombreEmpresa, cargo: cargoEmpresa, empresa: '', correo: '', telefono: '', presente: true });
    }
    if (nombreInvitado && cargoInvitado && nombreInvitado !== cargoInvitado) {
      revision.invitados.push({ nombre: nombreInvitado, cargo: cargoInvitado, empresa: '', correo: '', telefono: '', presente: true });
    }
  }

  // ─── 2. SECCIONES — parsing dinámico ───
  var secciones = _detectarSeccionesGFO006(sheet);
  if (secciones.length === 0) {
    console.warn('[K+AIRSST][6.1.3][PARSER_GFO006] No se detectaron secciones en la hoja');
    return revision;
  }

  var totalRows = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).e.r + 1 : 200;

  secciones.forEach(function(sec, idx) {
    var nextSec = secciones[idx + 1];
    var seccionIdx = sec.numero - 1;
    var seccion = revision.secciones[seccionIdx];
    if (!seccion) return;

    // Override título canónico (puede diferir del texto crudo de la plantilla)
    seccion.titulo = sec.titulo;

    // Contenido va desde la fila siguiente al título hasta la fila anterior
    // al siguiente título (o hasta el final de la hoja).
    var contentStart = sec.row + 1;
    var contentEnd = nextSec ? nextSec.row - 1 : Math.min(sec.row + 30, totalRows);

    var contentParts = [];
    for (var r = contentStart; r <= contentEnd; r++) {
      var text = _getMergedRangeText(sheet, r, 0, 5);
      if (text && String(text).trim()) {
        contentParts.push(String(text).trim());
      }
    }
    seccion.contenido = contentParts.join('\n');

    // ─── 3. SUB-TEMAS (para §2 y §5) ───
    var patronesSubtema = GFO006_SUBTEMAS_PATRONES[sec.numero];
    if (patronesSubtema && contentParts.length > 0) {
      seccion.subTemas = _extraerSubtemasDinamicos(contentParts, patronesSubtema);
    }
  });

  return revision;
}

/**
 * Divide el contenido de una sección en sub-temas detectando patrones
 * en cada línea/segmento. Si no hay matches, devuelve array vacío.
 */
function _extraerSubtemasDinamicos(contentParts, patrones) {
  // El contenido viene como un array de strings (filas). Cada fila puede
  // comenzar con un patrón de sub-tema (e.g. "OBJETIVOS: ...").
  var subTemas = [];
  var num = 1;
  var actual = null;

  for (var i = 0; i < contentParts.length; i++) {
    var part = contentParts[i];
    // Buscar el primer patrón que matchee al INICIO de esta línea
    var matched = patrones.find(function(p) { return p.patron.test(part); });
    if (matched) {
      if (actual) subTemas.push(actual);
      // Quitar el prefijo "TITULO:" del contenido
      var sinPrefijo = part.replace(matched.patron, '').trim();
      actual = {
        numero: num++,
        titulo: matched.titulo,
        contenido: sinPrefijo
      };
    } else if (actual) {
      actual.contenido += (actual.contenido ? '\n' : '') + part;
    }
    // Si no hay match y no hay actual → contenido introductorio, se ignora
  }
  if (actual) subTemas.push(actual);
  return subTemas;
}

// ─── Parser G-FO-009: Acta de Reunión Gerencial (43×8) ────────────
// R7: "Acta de reunion N°" | R8: Tema | R9: Preside | R10: Fecha
// R11: Ciudad | R12: Hora inicio | R13: Hora fin | R14: Participantes
// R15: Agenda/Orden del día (merged C15:H15)
// R32: "Desarrollo de la reunion" | R33-R43: tabla (N°, Temas, Compromisos, Fecha, Responsable)

function _parserGFO009(workbook) {
  var sheetName = workbook.SheetNames[0];
  var sheet = workbook.Sheets[sheetName];

  var acta = {
    numero: _generateActaNumero('temp'),
    tema: '',
    preside: '',
    fecha: '',
    ciudad: '',
    horaInicio: '',
    horaFin: '',
    participantes: [],
    ordenDia: '',
    agenda: [],
    desarrollo: [],
    estado: 'Abierta'
  };

  // G-FO-009: labels en col B, valores en merged C:H
  acta.tema = _getMergedRangeText(sheet, 8, 2, 7);
  acta.preside = _getMergedRangeText(sheet, 9, 2, 7);
  acta.fecha = _getMergedRangeText(sheet, 10, 2, 7);
  acta.ciudad = _getMergedRangeText(sheet, 11, 2, 7);
  acta.horaInicio = _getMergedRangeText(sheet, 12, 2, 7);
  acta.horaFin = _getMergedRangeText(sheet, 13, 2, 7);

  // Participantes (R14, merged C14:H14)
  var participantesText = _getMergedRangeText(sheet, 14, 2, 7);
  if (participantesText) {
    var lines = participantesText.split(/[\n;]+/);
    lines.forEach(function(line) {
      var trimmed = line.trim();
      if (trimmed) {
        acta.participantes.push({ nombre: trimmed, cargo: '', empresa: '', correo: '', telefono: '', presente: true });
      }
    });
  }

  // Orden del día (R15, merged C15:H15)
  acta.ordenDia = _getMergedRangeText(sheet, 15, 2, 7);

  // Tabla de desarrollo (R34-R43): B-D=Temas, E-F=Compromisos, G=Fecha, H=Responsable
  for (var d = 34; d <= 43; d++) {
    var temas = _getMergedRangeText(sheet, d, 1, 3);
    var compromisos = _getMergedRangeText(sheet, d, 4, 5);
    var fecha = _getCellValue(sheet, XLSX.utils.encode_cell({ r: d - 1, c: 6 }));
    var responsable = _getCellValue(sheet, XLSX.utils.encode_cell({ r: d - 1, c: 7 }));
    if (temas || compromisos) {
      acta.desarrollo.push({
        numero: d - 33,
        temaTratado: temas,
        compromiso: compromisos,
        responsable: responsable,
        fecha: fecha,
        verificacion: '',
        estado: 'Pendiente'
      });
    }
  }

  return acta;
}

// ─── Parser GG-FO-005: Registro Documental (42×9) ─────────────────
// R7: encabezados | R8-R42: datos (hasta 35 registros)
// Columnas: A=N°, B=Documento, C=Tipo, D=ID, E=Radicación, F=Fecha, G=Remitente, H=Destinatario, I=Área

function _parserGGFO005(workbook) {
  var sheetName = workbook.SheetNames[0];
  var sheet = workbook.Sheets[sheetName];
  var registros = [];

  for (var i = 8; i <= 42; i++) {
    var documento = _getMergedCellValue(sheet, i, 1);
    if (!documento) continue;
    registros.push({
      numero: _getMergedCellValue(sheet, i, 0) || String(i - 7),
      documentoConcepto: documento,
      tipoDocumento: _getMergedCellValue(sheet, i, 2),
      idDocumento: _getMergedCellValue(sheet, i, 3),
      numeroRadicacion: _getMergedCellValue(sheet, i, 4),
      fechaRecibido: _getMergedCellValue(sheet, i, 5),
      remitente: _getMergedCellValue(sheet, i, 6),
      destinatario: _getMergedCellValue(sheet, i, 7),
      area: _getMergedCellValue(sheet, i, 8),
      archivo: ''
    });
  }
  return registros;
}

// ─── Serializers: JSON → XLSX (preservando plantilla virgen) ──────
// Copia la plantilla original → modifica → exporta a archivo nuevo
// Nunca modifica la plantilla fuente

function _copiarPlantilla(tipoPlantilla, destPath) {
  var source = _getPlantillaSourcePath(tipoPlantilla);
  var dest = _getPlantillaPath(tipoPlantilla);
  _ensureDir(path.dirname(dest));
  if (!fs.existsSync(dest) && fs.existsSync(source)) {
    fs.copyFileSync(source, dest);
  }
  if (!fs.existsSync(dest)) return null;
  return dest;
}

function _resolverPlantilla(tipoPlantilla) {
  var plantillaPath = _getPlantillaPath(tipoPlantilla);
  if (fs.existsSync(plantillaPath)) return plantillaPath;
  var sourcePath = _getPlantillaSourcePath(tipoPlantilla);
  if (fs.existsSync(sourcePath)) return sourcePath;
  return null;
}

function _exportarGFO001(indicadores) {
  var plantillaPath = _resolverPlantilla('G-FO-001');
  if (!plantillaPath) return { success: false, error: { code: 'TEMPLATE_NOT_FOUND', message: 'Plantilla G-FO-001 no encontrada' } };
  var wb = XLSX.readFile(plantillaPath);
  var ws = wb.Sheets[wb.SheetNames[0]];

  if (indicadores) {
    indicadores.forEach(function(ind, idx) {
      var row = 7 + idx;
      if (row > 22) return;
      ws['A' + row] = { t: 's', v: ind.politicaIntegral || '' };
      ws['B' + row] = { t: 's', v: ind.objetivoEstrategico || '' };
      ws['C' + row] = { t: 's', v: ind.indicador || '' };
      ws['D' + row] = { t: 's', v: ind.formula || '' };
      ws['E' + row] = { t: 's', v: ind.meta || '' };
      ws['F' + row] = { t: 's', v: ind.frecuencia || '' };
      ws['G' + row] = { t: 's', v: ind.responsable || '' };
    });
  }

  return { workbook: wb, sheetName: wb.SheetNames[0] };
}

function _exportarGFO006(revision) {
  var plantillaPath = _resolverPlantilla('G-FO-006');
  if (!plantillaPath) return { success: false, error: { code: 'TEMPLATE_NOT_FOUND', message: 'Plantilla G-FO-006 no encontrada' } };
  var wb = XLSX.readFile(plantillaPath);
  var ws = wb.Sheets[wb.SheetNames[0]];

  // Mapeo sección → fila donde se escribe el contenido
  var contentRowMap = [30, 32, 38, 44, 48, 53, 59, 62, 66, 81, 83, 86];

  if (revision.secciones) {
    revision.secciones.forEach(function(seccion, idx) {
      if (idx >= contentRowMap.length) return;
      var row = contentRowMap[idx];
      ws['A' + row] = { t: 's', v: seccion.contenido || '' };
    });
  }

  return { workbook: wb, sheetName: wb.SheetNames[0] };
}

function _exportarGFO009(acta) {
  var plantillaPath = _resolverPlantilla('G-FO-009');
  if (!plantillaPath) return { success: false, error: { code: 'TEMPLATE_NOT_FOUND', message: 'Plantilla G-FO-009 no encontrada' } };
  var wb = XLSX.readFile(plantillaPath);
  var ws = wb.Sheets[wb.SheetNames[0]];

  // G-FO-009: labels en col B, valores en merged C:H
  ws['C8'] = { t: 's', v: acta.tema || '' };
  ws['C9'] = { t: 's', v: acta.preside || '' };
  ws['C10'] = { t: 's', v: acta.fecha || '' };
  ws['C11'] = { t: 's', v: acta.ciudad || '' };
  ws['C12'] = { t: 's', v: acta.horaInicio || '' };
  ws['C13'] = { t: 's', v: acta.horaFin || '' };
  ws['C15'] = { t: 's', v: acta.ordenDia || '' };

  if (acta.desarrollo) {
    acta.desarrollo.forEach(function(d) {
      var row = 33 + d.numero;
      if (row > 43) return;
      ws['B' + row] = { t: 's', v: d.temaTratado || '' };
      ws['E' + row] = { t: 's', v: d.compromiso || '' };
      ws['G' + row] = { t: 's', v: d.fecha || '' };
      ws['H' + row] = { t: 's', v: d.responsable || '' };
    });
  }

  return { workbook: wb, sheetName: wb.SheetNames[0] };
}

function _exportarGGFO005(documentos) {
  var plantillaPath = _resolverPlantilla('GG-FO-005');
  if (!plantillaPath) return { success: false, error: { code: 'TEMPLATE_NOT_FOUND', message: 'Plantilla GG-FO-005 no encontrada' } };
  var wb = XLSX.readFile(plantillaPath);
  var ws = wb.Sheets[wb.SheetNames[0]];

  if (documentos) {
    documentos.forEach(function(doc, idx) {
      var row = 8 + idx;
      if (row > 42) return;
      ws['A' + row] = { t: 's', v: doc.numero || String(idx + 1) };
      ws['B' + row] = { t: 's', v: doc.documentoConcepto || '' };
      ws['C' + row] = { t: 's', v: doc.tipoDocumento || '' };
      ws['D' + row] = { t: 's', v: doc.idDocumento || '' };
      ws['E' + row] = { t: 's', v: doc.numeroRadicacion || '' };
      ws['F' + row] = { t: 's', v: doc.fechaRecibido || '' };
      ws['G' + row] = { t: 's', v: doc.remitente || '' };
      ws['H' + row] = { t: 's', v: doc.destinatario || '' };
      ws['I' + row] = { t: 's', v: doc.area || '' };
    });
  }

  return { workbook: wb, sheetName: wb.SheetNames[0] };
}

// ─── Helpers de SQLite (fuente de verdad post-migración 2026-06-18) ──
// La migración "rev-alta-direccion-json-to-sqlite-v1" movió revisiones,
// secciones y subpuntos a SQLite. Las actas y los indicadores ya estaban
// allí. Los JSON locales quedan como fallback sólo si SQLite no responde.

function _loadActasFromDb(empresaId) {
  if (!_getDb) return null;
  try {
    var db = _getDb();
    var rows = db.prepare('SELECT id, numero, fecha, estado, archivo_path, metadata_json, creado_en, actualizado_en FROM actas WHERE empresa_id = ? ORDER BY fecha DESC, creado_en DESC').all(empresaId);
    return rows.map(function(r) {
      var metadata = {};
      try { if (r.metadata_json) metadata = JSON.parse(r.metadata_json); } catch (e) { metadata = {}; }
      return {
        id: r.id,
        numero: r.numero,
        fecha: r.fecha,
        estado: r.estado || 'Abierta',
        archivo: r.archivo_path || '',
        metadata: metadata,
        creado_en: r.creado_en,
        actualizado_en: r.actualizado_en
      };
    });
  } catch (e) {
    console.error('[K+AIRSST][6.1.3][DB_LOAD_ACTAS]', e.message);
    return null;
  }
}

function _loadRevisionesFromDb(empresaId) {
  if (!_getDb) return null;
  try {
    var db = _getDb();
    var revs = db.prepare('SELECT * FROM revisiones WHERE empresa_id = ? ORDER BY fecha DESC, creado_en DESC').all(empresaId);

    /* Cargar secciones y subpuntos para cada revisión en bulk */
    var secciones = db.prepare('SELECT revision_id, seccion_key, numero, titulo, contenido FROM revision_secciones').all();
    var subpuntos = db.prepare('SELECT revision_id, seccion_key, sub_key, sub_numero, label, estado, observacion FROM revision_subpuntos').all();

    var seccionesByRev = {};
    var subpuntosBySec = {};
    secciones.forEach(function(s) {
      if (!seccionesByRev[s.revision_id]) seccionesByRev[s.revision_id] = [];
      seccionesByRev[s.revision_id].push({
        seccion_key: s.seccion_key,
        numero: s.numero,
        titulo: s.titulo,
        contenido: s.contenido || ''
      });
    });
    subpuntos.forEach(function(p) {
      var k = p.revision_id + '||' + p.seccion_key;
      if (!subpuntosBySec[k]) subpuntosBySec[k] = [];
      subpuntosBySec[k].push({
        sub_key: p.sub_key,
        sub_numero: p.sub_numero,
        label: p.label || '',
        estado: p.estado || 'Pendiente',
        observacion: p.observacion || ''
      });
    });

    return revs.map(function(r) {
      var secs = seccionesByRev[r.id] || [];
      secs.forEach(function(sec) {
        var k = r.id + '||' + sec.seccion_key;
        sec.subpuntos = subpuntosBySec[k] || [];
      });
      return {
        id: r.id,
        periodo: r.periodo,
        fecha: r.fecha,
        fechaProgramada: r.fecha_programada,
        fechaRealizacion: r.fecha_realizacion,
        tipo: r.tipo,
        estado: r.estado,
        lugar: r.lugar,
        preside: r.preside,
        elabora: r.elabora,
        participantes: r.participantes || 0,
        proximaRevision: r.proxima_revision,
        archivoOriginal: r.archivo_original,
        progreso: r.progreso || 0,
        secciones: secs,
        creado_en: r.creado_en,
        actualizado_en: r.actualizado_en
      };
    });
  } catch (e) {
    console.error('[K+AIRSST][6.1.3][DB_LOAD_REVISIONES]', e.message);
    return null;
  }
}

function _loadIndicadoresFromDb(empresaId) {
  if (!_getDb) return null;
  try {
    var db = _getDb();
    var rows = db.prepare('SELECT id, nombre, meta, resultado, unidad, periodo, responsable, metadata_json, creado_en, actualizado_en FROM indicadores_revision WHERE empresa_id = ? ORDER BY creado_en ASC').all(empresaId);
    return rows.map(function(r, idx) {
      var metadata = {};
      try { if (r.metadata_json) metadata = JSON.parse(r.metadata_json); } catch (e) { metadata = {}; }

      /* Mapear DB → shape de la vista DespliegueEstrategicoView:
         - DB.nombre  → vista.indicador
         - DB.meta    → vista.meta
         - DB.resultado → vista.ultimoValor (o '—' si vacío)
         - DB.periodo → vista.frecuencia
         - DB.responsable → vista.responsable
         - metadata.politica/objetivo/formula → vista.politica/objetivo/formula
         - metadata.mediciones → vista.tendencia y vista.estado (computados)
      */
      var mediciones = Array.isArray(metadata.mediciones) ? metadata.mediciones : [];
      var ultimoValor = r.resultado || (mediciones.length > 0 ? mediciones[mediciones.length - 1].valor : '—');
      var tendencia = _calcularTendencia(mediciones);
      var estado = _calcularEstadoIndicador(ultimoValor, r.meta, mediciones);

      return {
        id: r.id,
        /* Campos que la vista espera */
        politica: metadata.politica || metadata.politicaIntegral || '',
        objetivo: metadata.objetivo || metadata.objetivoEstrategico || '',
        indicador: r.nombre || metadata.indicador || '',
        formula: metadata.formula || '',
        meta: r.meta || '',
        ultimoValor: ultimoValor,
        tendencia: tendencia,
        frecuencia: r.periodo || metadata.frecuencia || '',
        responsable: r.responsable || '',
        estado: estado,
        /* Campos crudos para diagnóstico */
        unidad: r.unidad,
        metadata: metadata,
        creado_en: r.creado_en,
        actualizado_en: r.actualizado_en
      };
    });
  } catch (e) {
    console.error('[K+AIRSST][6.1.3][DB_LOAD_INDICADORES]', e.message);
    return null;
  }
}

/* Calcula tendencia (up/down/flat) a partir del historial de mediciones */
function _calcularTendencia(mediciones) {
  if (!Array.isArray(mediciones) || mediciones.length < 2) return 'flat';
  var ultimas = mediciones.slice(-2);
  var a = parseFloat(ultimas[0].valor);
  var b = parseFloat(ultimas[1].valor);
  if (isNaN(a) || isNaN(b)) return 'flat';
  if (b > a) return 'up';
  if (b < a) return 'down';
  return 'flat';
}

/* Calcula estado del indicador (Cumple / Parcial / No cumple / Sin medición) */
function _calcularEstadoIndicador(ultimoValor, meta, mediciones) {
  if (!ultimoValor || ultimoValor === '—' || mediciones.length === 0) return 'Sin medición';
  if (!meta) return 'Sin meta';

  var valor = parseFloat(String(ultimoValor).replace(/[^0-9.\-]/g, ''));
  if (isNaN(valor)) return 'Sin medición';

  /* Soportar metas tipo "< 1", "> 50", "≥ 0.8", "<= 100", ">= 80", etc. */
  var metaStr = String(meta).trim();
  var match = metaStr.match(/^(<=|>=|<|>|≤|≥|=|)\s*([0-9.]+)/);
  if (!match) return 'Sin meta';
  var op = match[1] || '=';
  var metaNum = parseFloat(match[2]);

  var cumple;
  switch (op) {
    case '<': case '≤': cumple = valor < metaNum; break;
    case '>': case '≥': cumple = valor > metaNum; break;
    case '<=': cumple = valor <= metaNum; break;
    case '>=': cumple = valor >= metaNum; break;
    default: cumple = Math.abs(valor - metaNum) < 0.01;
  }
  if (cumple) return 'Cumple';

  /* Si no cumple, ver si está cerca (parcial) o lejos (no cumple) */
  var diff = Math.abs(valor - metaNum) / (metaNum || 1);
  return diff < 0.15 ? 'Parcial' : 'No cumple';
}

/* Hidrata SQLite con los indicadores parseados del Excel G-FO-001.
   Solo se ejecuta si la tabla está vacía para esta empresa — no sobreescribe
   datos ya capturados. Esto resuelve el problema de la vista mostrando
   una sola fila vacía en lugar del despliegue estratégico completo.

   Fuente priorizada (espejo de Objetivos y Metas 2.2.1):
     1. GI-FO-044 OBJETIVOS Y METAS DEL SST.xlsx (mismo Excel que edita 2.2.1)
     2. Fallback → GG-FO-001 DESPLIEGUE ESTRATEGICO.xls (formato histórico)

   Detección robusta de "datos obsoletos":
     - Sin metadata.fuente              → legacy del parser antiguo G-FO-001
     - metadata.fuente !== 'GI-FO-044'  → sembrado por fallback flexible (ej. ANEXO 21)
     - metadata.source !== path_actual  → el archivo resuelto ahora es DIFERENTE al usado antes
     - metadata.mtime !== mtime_actual  → el archivo Excel fue editado después del último seed
     En cualquiera de estos casos, limpiar y re-sembrar. */
function _seedIndicadoresFromXlsx(empresaId, dir) {
  if (!_getDb) {
    console.warn('[K+AIRSST][6.1.3][SEED_INDICADORES] _getDb no disponible, saltando seed');
    return { seeded: 0 };
  }
  try {
    var db = _getDb();
    var rowsExistentes = db.prepare('SELECT id, metadata_json FROM indicadores_revision WHERE empresa_id = ?').all(empresaId);
    var count = rowsExistentes.length;
    console.log('[K+AIRSST][6.1.3][SEED_INDICADORES][DIAG] empresa=' + empresaId + ' count=' + count);

    if (!XLSX || !dir || !fs.existsSync(dir)) {
      console.warn('[K+AIRSST][6.1.3][SEED_INDICADORES] XLSX o dir no disponible. XLSX=' + !!XLSX + ' dir=' + dir);
      return { seeded: 0, reason: 'sin-excel' };
    }

    /* 1) Resolver archivo fuente ACTUAL (paso crítico: se hace ANTES de comparar) */
    var companyRoot = _getCompanyRootFromConfig(empresaId);
    console.log('[K+AIRSST][6.1.3][SEED_INDICADORES][DIAG] companyRoot=' + companyRoot);
    var objetivosFile = companyRoot ? _resolverExcelObjetivosSST(companyRoot) : null;
    console.log('[K+AIRSST][6.1.3][SEED_INDICADORES][DIAG] objetivosFile=' + objetivosFile);

    var xlsxPath = null;
    var parser = null;
    var sourceTag = null;

    if (objetivosFile && fs.existsSync(objetivosFile)) {
      xlsxPath = objetivosFile;
      parser = _parserGFO044ObjetivosSST;
      sourceTag = 'GI-FO-044';
    } else {
      /* 2) Fallback: GG-FO-001 en la carpeta del módulo 6.1.3 */
      var entries = fs.readdirSync(dir);
      var xlsxFile = entries.find(function(f) {
        return /^GG-FO-001/i.test(f) && /\.(xlsx|xls)$/i.test(f);
      });
      if (!xlsxFile) {
        console.warn('[K+AIRSST][6.1.3][SEED_INDICADORES] GI-FO-044 no accesible y GG-FO-001 no encontrado en dir');
        return { seeded: 0, reason: 'archivo-no-encontrado' };
      }
      xlsxPath = path.join(dir, xlsxFile);
      parser = _parserGFO001;
      sourceTag = 'GG-FO-001';
    }

    var currentFileMtime = null;
    try { currentFileMtime = fs.statSync(xlsxPath).mtime.toISOString(); } catch (e) { /* ignore */ }

    /* 3) Parsear archivo fuente para tener count actual */
    var wb = XLSX.readFile(xlsxPath, { cellDates: true });
    var parsed = parser(wb);
    console.log('[K+AIRSST][6.1.3][SEED_INDICADORES][DIAG] parser=' + sourceTag + ' registros=' + parsed.length);
    if (!Array.isArray(parsed) || parsed.length === 0) return { seeded: 0, reason: 'parser-vacio' };

    /* 4) FORZAR re-seed siempre que el count no coincida con el archivo actual.
       Heurística pragmática: si el archivo tiene 15 filas pero la BD tiene 3,
       algo está mal y re-sembramos. Si todo coincide, skip.
       Esto evita los casos donde metadata guarda "GI-FO-044" pero en realidad
       vino del Anexo 21 (que también pasó el filtro flexible). */
    if (count > 0 && count === parsed.length) {
      console.log('[K+AIRSST][6.1.3][SEED_INDICADORES] Ya hidratado (' + count + ' registros, coinciden con archivo). Saltando.');
      return { seeded: 0, reason: 'ya-hidratado-desde-gi-fo-044' };
    }

    if (count > 0) {
      console.log('[K+AIRSST][6.1.3][SEED_INDICADORES] FORZANDO re-seed: count_en_BD=' + count + ' count_en_archivo=' + parsed.length + ' (no coinciden, datos sospechosos).');
      db.prepare('DELETE FROM indicadores_revision WHERE empresa_id = ?').run(empresaId);
      count = 0;
    }

    var now = new Date().toISOString();
    var insert = db.prepare(`
      INSERT INTO indicadores_revision (id, empresa_id, nombre, meta, resultado, unidad, periodo, responsable, metadata_json, creado_en, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    var inserted = 0;
    parsed.forEach(function(ind, idx) {
      var id = 'IND-' + empresaId.replace(/[^a-z0-9]/gi, '').toUpperCase().substring(0, 6) + '-' + String(idx + 1).padStart(3, '0');
      var nombre = ind.indicador || '';
      var meta = ind.meta || '';
      var periodo = ind.frecuencia || '';
      var responsable = ind.responsable || '';
      var metadataJson = JSON.stringify({
        /* GI-FO-044 no tiene columna Política — intencional, el usuario
           decidió no reflejarla en esta vista espejo. */
        politica: ind.politicaIntegral || '',
        objetivo: ind.objetivoEstrategico || '',
        formula: ind.formula || '',
        categoria: ind.categoria || 'Cumplimiento',
        mediciones: ind.mediciones || [],
        fuente: sourceTag,
        source: xlsxPath,
        mtime: currentFileMtime,
        seededCount: parsed.length,
        seededAt: now
      });

      try {
        insert.run(id, empresaId, nombre, meta, null, null, periodo, responsable, metadataJson, now, now);
        inserted++;
      } catch (e) {
        console.error('[K+AIRSST][6.1.3][SEED_INDICADORES][' + id + ']', e.message);
      }
    });

    console.log('[K+AIRSST][6.1.3][SEED_INDICADORES] ' + inserted + ' indicadores hidratados desde ' +
      path.basename(xlsxPath) + ' (fuente=' + sourceTag + ', mtime=' + currentFileMtime + ')');
    return { seeded: inserted, source: path.basename(xlsxPath), fuente: sourceTag, rehidratado: false };
  } catch (e) {
    console.error('[K+AIRSST][6.1.3][SEED_INDICADORES][ERROR]', e.message);
    return { seeded: 0, error: e.message };
  }
}

/**
 * Lee config.json y devuelve la ruta raíz de la empresa.
 * Helper extraído de _getEmpresaDir para usos donde solo se necesita la raíz
 * (p. ej. buscar el Excel de objetivos en toda la carpeta de la empresa).
 */
function _getCompanyRootFromConfig(empresaId) {
  if (!empresaId) return null;
  try {
    var configPath = path.join(app.getPath('userData'), 'config.json');
    if (!fs.existsSync(configPath)) return null;
    var cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    var normalized = String(empresaId).toLowerCase().trim();
    var companyKey = Object.keys(cfg.companyPaths || {}).find(function(k) {
      return String(k).toLowerCase().trim() === normalized;
    });
    if (companyKey) {
      return cfg.companyPaths[companyKey].root || cfg.companyPaths[companyKey].ruta_base || null;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function _saveActaToDb(empresaId, acta) {
  if (!_getDb) return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  try {
    var db = _getDb();
    var id = acta.id || ('ACT-' + empresaId + '-' + Date.now());
    var numero = acta.numero || ('1.' + (Math.floor(Math.random() * 9) + 1));
    var fecha = acta.fecha || new Date().toISOString().split('T')[0];
    var estado = acta.estado || 'Abierta';
    var archivo = acta.archivo || null;
    var metadataJson = JSON.stringify(acta.metadata || {});
    var now = new Date().toISOString();

    db.prepare(`
      INSERT INTO actas (id, empresa_id, numero, fecha, estado, archivo_path, metadata_json, creado_en, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        numero = excluded.numero,
        fecha = excluded.fecha,
        estado = excluded.estado,
        archivo_path = excluded.archivo_path,
        metadata_json = excluded.metadata_json,
        actualizado_en = excluded.actualizado_en
    `).run(id, empresaId, numero, fecha, estado, archivo, metadataJson, now, now);

    return { success: true, data: { id: id, numero: numero } };
  } catch (e) {
    console.error('[K+AIRSST][6.1.3][DB_SAVE_ACTA]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

function _saveIndicadorToDb(empresaId, ind) {
  if (!_getDb) return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  try {
    var db = _getDb();
    var id = ind.id || ('IND-' + Date.now());
    var metadataJson = ind.metadata ? JSON.stringify(ind.metadata) : null;
    var now = new Date().toISOString();

    db.prepare(`
      INSERT INTO indicadores_revision (id, empresa_id, nombre, meta, resultado, unidad, periodo, responsable, metadata_json, creado_en, actualizado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nombre = excluded.nombre,
        meta = excluded.meta,
        resultado = excluded.resultado,
        unidad = excluded.unidad,
        periodo = excluded.periodo,
        responsable = excluded.responsable,
        metadata_json = excluded.metadata_json,
        actualizado_en = excluded.actualizado_en
    `).run(id, empresaId, ind.nombre, ind.meta, ind.resultado, ind.unidad, ind.periodo, ind.responsable, metadataJson, now, now);

    return { success: true, data: { id: id } };
  } catch (e) {
    console.error('[K+AIRSST][6.1.3][DB_SAVE_INDICADOR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

// ─── Handlers IPC ───────────────────────────────────────────────────

function registerRevisionAltaDireccionHandlers(app, deps) {
  _getCompanyRootPath = deps && deps.getCompanyRootPath ? deps.getCompanyRootPath : null;
  _getDb = deps && deps.getDb ? deps.getDb : null;

  console.log('[K+AIRSST][6.1.3][INIT][INFO] Registrando handlers de Revisión por la Alta Dirección...');

  // ── Cargar todo (dashboard) ──
  ipcMain.handle('revisionAltaDireccion:cargarTodo', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var dir = _getEmpresaDir(empresaId);
      if (!dir) {
        return { success: false, error: { code: 'NO_COMPANY', message: 'Empresa no encontrada o sin ruta: ' + empresaId } };
      }
      _ensureDir(dir);

      /* Auto-import desde XLSX oficiales si los JSON no existen */
      var importResult = _autoImportXlsx(dir);

      /* Fuente de verdad: SQLite (post-migración 2026-06-18).
         Si SQLite no responde, fallback al JSON local. */
      var dbActas = _loadActasFromDb(empresaId);
var dbRevs = _loadRevisionesFromDb(empresaId);
      var dbInds = _loadIndicadoresFromDb(empresaId);

      /* Hidratación de indicadores desde el Excel espejo.
         La función _seedIndicadoresFromXlsx es idempotente y maneja tres casos:
           (a) BD vacía → siembra desde GI-FO-044 (o fallback GG-FO-001)
           (b) BD con datos legacy (parser antiguo sin fuente=GI-FO-044) → limpia y re-siembra
           (c) BD ya hidratada desde GI-FO-044 → no hace nada
         Por eso la condición ya no exige BD vacía — el seed decide internamente. */
      var seedResult = { seeded: 0 };
      if (_getDb) {
        seedResult = _seedIndicadoresFromXlsx(empresaId, dir);
        if (seedResult.seeded > 0) {
          dbInds = _loadIndicadoresFromDb(empresaId);
        }
      }

      var actas = (dbActas !== null) ? dbActas : (_readJson(path.join(dir, 'G-FO-009.json')) || []);
      var revisiones = (dbRevs !== null) ? dbRevs : (_readJson(path.join(dir, 'G-FO-006.json')) || []);
      var indicadores = (dbInds !== null && dbInds.length > 0)
        ? dbInds
        : (_readJson(path.join(dir, 'G-FO-001.json')) || []);
      var documentos = _readJson(path.join(dir, 'GG-FO-005.json')) || [];

      var fuente = (dbActas !== null || dbRevs !== null || (dbInds !== null && dbInds.length > 0)) ? 'sqlite' : 'json';
      console.log('[K+AIRSST][6.1.3][CARGAR_TODO] empresa=' + empresaId + ' fuente=' + fuente +
        ' actas=' + actas.length + ' revisiones=' + revisiones.length + ' indicadores=' + indicadores.length +
        (seedResult.seeded > 0 ? ' SEEDED_INDICADORES=' + seedResult.seeded : ''));

      return {
        success: true,
        data: {
          revisiones: revisiones,
          actas: actas,
          indicadores: indicadores,
          documentos: documentos,
          autoImport: importResult,
          fuente: fuente,
          seedIndicadores: seedResult
        }
      };
    } catch (e) {
      console.error('[K+AIRSST][6.1.3][CARGAR_TODO][ERROR]', e);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Listar revisiones ──
  ipcMain.handle('revisionAltaDireccion:listarRevisiones', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var filtros = params.filtros || {};
      var dbItems = _loadRevisionesFromDb(empresaId);
      var items;
      if (dbItems !== null) {
        items = dbItems;
      } else {
        var dir = _getEmpresaDir(empresaId);
        items = _readJson(path.join(dir, 'G-FO-006.json')) || [];
      }

      if (filtros.ano) {
        items = items.filter(function(r) { return r.id && r.id.indexOf('RG-' + filtros.ano) !== -1; });
      }
      if (filtros.estado) {
        items = items.filter(function(r) { return r.estado === filtros.estado; });
      }
      if (filtros.tipo) {
        items = items.filter(function(r) { return r.tipo === filtros.tipo; });
      }
      if (filtros.buscar) {
        var busq = filtros.buscar.toLowerCase();
        items = items.filter(function(r) {
          return (r.id && r.id.toLowerCase().indexOf(busq) !== -1) ||
                 (r.lugar && r.lugar.toLowerCase().indexOf(busq) !== -1);
        });
      }

      return { success: true, data: items };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Obtener una revisión ──
  ipcMain.handle('revisionAltaDireccion:obtenerRevision', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var id = params.id;
      var dir = _getEmpresaDir(empresaId);
      var items = _readJson(path.join(dir, 'G-FO-006.json')) || [];
      var found = items.find(function(r) { return r.id === id; });
      if (!found) return { success: false, error: { code: 'NOT_FOUND', message: 'Revisión no encontrada' } };
      return { success: true, data: found };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Crear revisión ──
  ipcMain.handle('revisionAltaDireccion:crearRevision', async function(event, params) {
    try {
      var empresaId = params.data.empresaId || params.empresaId;
      var id = _generateRevisionId(empresaId);
      var revision = Object.assign({
        id: id,
        fechaProgramada: '',
        fechaRealizacion: '',
        tipo: 'Ordinaria',
        estado: 'Borrador',
        lugar: '',
        porEmpresa: [],
        invitados: [],
        secciones: _createSeccionesVacias(),
        proximaRevision: '',
        firmadoPor: [],
        archivoOriginal: ''
      }, params.data.revision || params.data);
      revision.empresaId = empresaId;

      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'G-FO-006.json');
      var items = _readJson(filePath) || [];
      items.push(revision);
      _writeJson(filePath, items);

      return { success: true, data: { id: id } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Actualizar revisión ──
  ipcMain.handle('revisionAltaDireccion:actualizarRevision', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var id = params.id;
      var cambios = params.cambios;
      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'G-FO-006.json');
      var items = _readJson(filePath) || [];
      var idx = items.findIndex(function(r) { return r.id === id; });
      if (idx === -1) return { success: false, error: { code: 'NOT_FOUND', message: 'Revisión no encontrada' } };

      items[idx] = Object.assign(items[idx], cambios);
      _writeJson(filePath, items);

      return { success: true, data: { ok: true } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Cambiar estado ──
  ipcMain.handle('revisionAltaDireccion:cambiarEstadoRevision', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var id = params.id;
      var nuevoEstado = params.nuevoEstado;
      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'G-FO-006.json');
      var items = _readJson(filePath) || [];
      var found = items.find(function(r) { return r.id === id; });
      if (!found) return { success: false, error: { code: 'NOT_FOUND', message: 'Revisión no encontrada' } };

      if (!_validarTransicionEstado(found.estado, nuevoEstado)) {
        return { success: false, error: { code: 'INVALID_TRANSITION', message: 'Transición no permitida: ' + found.estado + ' → ' + nuevoEstado } };
      }

      if (nuevoEstado === 'Cerrada') {
        var errores = _validarRevisionParaCerrar(found);
        if (errores.length > 0) {
          return { success: false, error: { code: 'VALIDATION_ERROR', message: errores.join('; ') } };
        }
        found.fechaRealizacion = found.fechaRealizacion || new Date().toISOString();
      }

      found.estado = nuevoEstado;
      _writeJson(filePath, items);

      return { success: true, data: { ok: true } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Eliminar revisión ──
  ipcMain.handle('revisionAltaDireccion:eliminarRevision', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var id = params.id;
      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'G-FO-006.json');
      var items = _readJson(filePath) || [];
      var found = items.find(function(r) { return r.id === id; });
      if (!found) return { success: false, error: { code: 'NOT_FOUND', message: 'Revisión no encontrada' } };
      if (found.estado !== 'Borrador') {
        return { success: false, error: { code: 'NOT_DELETABLE', message: 'Solo se pueden eliminar revisiones en Borrador' } };
      }

      var filtered = items.filter(function(r) { return r.id !== id; });
      _writeJson(filePath, filtered);

      return { success: true, data: { ok: true } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Listar actas de reunión ──
  ipcMain.handle('revisionAltaDireccion:listarActas', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var filtros = params.filtros || {};
      var dbItems = _loadActasFromDb(empresaId);
      var items;
      if (dbItems !== null) {
        items = dbItems;
      } else {
        var dir = _getEmpresaDir(empresaId);
        items = _readJson(path.join(dir, 'G-FO-009.json')) || [];
      }

      if (filtros.estado) {
        items = items.filter(function(a) { return a.estado === filtros.estado; });
      }
      if (filtros.buscar) {
        var busq = filtros.buscar.toLowerCase();
        items = items.filter(function(a) {
          var tema = a.metadata && a.metadata.tema ? a.metadata.tema : (a.tema || '');
          return (tema && tema.toLowerCase().indexOf(busq) !== -1) ||
                 (String(a.numero).indexOf(busq) !== -1);
        });
      }

      return { success: true, data: items };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Guardar acta ──
  ipcMain.handle('revisionAltaDireccion:guardarActa', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var acta = params.acta;
      if (!acta) return { success: false, error: { code: 'NO_ACTA', message: 'Datos del acta requeridos' } };

      /* Si el acta tiene campos a nivel raíz (tema, preside, etc.) que no
         están en metadata, moverlos a metadata para mantener un único shape. */
      if (!acta.metadata) acta.metadata = {};
      var rootFields = ['tema', 'preside', 'ciudad', 'horaInicio', 'horaFin', 'participantes', 'ordenDia', 'desarrollo', 'agenda'];
      rootFields.forEach(function(f) {
        if (acta[f] !== undefined && acta.metadata[f] === undefined) {
          acta.metadata[f] = acta[f];
        }
      });

      /* SQLite primero; si no hay DB, fallback a JSON */
      if (_getDb) {
        var dbResult = _saveActaToDb(empresaId, acta);
        if (dbResult.success) {
          return { success: true, data: { id: dbResult.data.id, numero: dbResult.data.numero, fuente: 'sqlite' } };
        }
        console.warn('[K+AIRSST][6.1.3][GUARDAR_ACTA] SQLite falló, usando JSON:', dbResult.error && dbResult.error.message);
      }

      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'G-FO-009.json');
      var items = _readJson(filePath) || [];

      if (acta.id) {
        var idx = items.findIndex(function(a) { return a.id === acta.id; });
        if (idx !== -1) items[idx] = Object.assign(items[idx], acta);
        else items.push(acta);
      } else {
        acta.id = 'ACT-' + empresaId + '-' + Date.now();
        acta.numero = _generateActaNumero(empresaId);
        items.push(acta);
      }

      _writeJson(filePath, items);
      return { success: true, data: { id: acta.id, numero: acta.numero, fuente: 'json' } };
    } catch (e) {
      console.error('[K+AIRSST][6.1.3][GUARDAR_ACTA][ERROR]', e);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Listar indicadores ──
  ipcMain.handle('revisionAltaDireccion:listarIndicadores', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var dbItems = _loadIndicadoresFromDb(empresaId);
      var items;
      if (dbItems !== null) {
        items = dbItems;
      } else {
        var dir = _getEmpresaDir(empresaId);
        items = _readJson(path.join(dir, 'G-FO-001.json')) || [];
      }
      return { success: true, data: items };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Guardar indicador ──
  ipcMain.handle('revisionAltaDireccion:guardarIndicador', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var indicador = params.indicador;
      if (!indicador) return { success: false, error: { code: 'NO_INDICADOR', message: 'Datos del indicador requeridos' } };

      if (_getDb) {
        var dbResult = _saveIndicadorToDb(empresaId, indicador);
        if (dbResult.success) {
          return { success: true, data: { id: dbResult.data.id, fuente: 'sqlite' } };
        }
        console.warn('[K+AIRSST][6.1.3][GUARDAR_INDICADOR] SQLite falló, usando JSON:', dbResult.error && dbResult.error.message);
      }

      var dir = _getEmpresaDir(empresaId);
      var filePath = path.join(dir, 'G-FO-001.json');
      var items = _readJson(filePath) || [];

      if (indicador.id) {
        var idx = items.findIndex(function(i) { return i.id === indicador.id; });
        if (idx !== -1) items[idx] = Object.assign(items[idx], indicador);
        else items.push(indicador);
      } else {
        indicador.id = _generateIndicadorId(empresaId);
        items.push(indicador);
      }

      _writeJson(filePath, items);
      return { success: true, data: { id: indicador.id, fuente: 'json' } };
    } catch (e) {
      console.error('[K+AIRSST][6.1.3][GUARDAR_INDICADOR][ERROR]', e);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Importar XLSX ──
  ipcMain.handle('revisionAltaDireccion:importarXlsx', async function(event, params) {
    try {
      if (!XLSX) return { success: false, error: { code: 'NO_XLSX', message: 'Módulo xlsx no disponible' } };

      var empresaId = params.empresaId;
      var archivoPath = params.archivoPath;
      var tipoPlantilla = params.tipoPlantilla;

      if (!fs.existsSync(archivoPath)) {
        return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Archivo no encontrado' } };
      }

      var wb = XLSX.readFile(archivoPath, { cellDates: true });
      var datos;
      var filePath;

      var dir = _getEmpresaDir(empresaId);
      _ensureDir(dir);

      if (tipoPlantilla === 'G-FO-001') {
        datos = _parserGFO001(wb);
        filePath = path.join(dir, 'G-FO-001.json');
      } else if (tipoPlantilla === 'G-FO-006') {
        datos = _parserGFO006(wb);
        filePath = path.join(dir, 'G-FO-006.json');
        var existing = _readJson(filePath) || [];
        existing.push(datos);
        datos = existing;
      } else if (tipoPlantilla === 'G-FO-009') {
        datos = _parserGFO009(wb);
        filePath = path.join(dir, 'G-FO-009.json');
        var existingActas = _readJson(filePath) || [];
        existingActas.push(datos);
        datos = existingActas;
      } else if (tipoPlantilla === 'GG-FO-005') {
        datos = _parserGGFO005(wb);
        filePath = path.join(dir, 'GG-FO-005.json');
      } else {
        return { success: false, error: { code: 'INVALID_TEMPLATE', message: 'Tipo de plantilla inválido: ' + tipoPlantilla } };
      }

      _writeJson(filePath, datos);

      return { success: true, data: { importados: Array.isArray(datos) ? datos.length : 1, errores: [] } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Exportar XLSX ──
  ipcMain.handle('revisionAltaDireccion:exportarXlsx', async function(event, params) {
    try {
      if (!XLSX) return { success: false, error: { code: 'NO_XLSX', message: 'Módulo xlsx no disponible' } };

      var empresaId = params.empresaId;
      var tipoPlantilla = params.tipoPlantilla;
      var id = params.id;

      var dir = _getEmpresaDir(empresaId);
      var exportDir = path.join(dir, 'exports');
      _ensureDir(exportDir);

      var timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      var nombreArchivo = tipoPlantilla + '_' + (id || 'all') + '_' + timestamp + '.xlsx';
      var exportPath = path.join(exportDir, nombreArchivo);

      var result;
      if (tipoPlantilla === 'G-FO-001') {
        var indicadores = _readJson(path.join(dir, 'G-FO-001.json')) || [];
        result = _exportarGFO001(indicadores);
      } else if (tipoPlantilla === 'G-FO-006') {
        var revisiones = _readJson(path.join(dir, 'G-FO-006.json')) || [];
        var revision = id ? revisiones.find(function(r) { return r.id === id; }) : revisiones[revisiones.length - 1];
        result = _exportarGFO006(revision || { secciones: _createSeccionesVacias() });
      } else if (tipoPlantilla === 'G-FO-009') {
        var actas = _readJson(path.join(dir, 'G-FO-009.json')) || [];
        var acta = id ? actas.find(function(a) { return a.id === id; }) : actas[actas.length - 1];
        result = _exportarGFO009(acta || {});
      } else if (tipoPlantilla === 'GG-FO-005') {
        var documentos = _readJson(path.join(dir, 'GG-FO-005.json')) || [];
        result = _exportarGGFO005(documentos);
      } else {
        return { success: false, error: { code: 'INVALID_TEMPLATE', message: 'Tipo de plantilla inválido: ' + tipoPlantilla } };
      }

      if (result && result.success === false) return result;

      XLSX.writeFile(result.workbook, exportPath);

      return { success: true, data: { archivoPath: exportPath } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Subir documento ──
  ipcMain.handle('revisionAltaDireccion:subirDocumento', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var buffer = params.buffer;
      var metadata = params.metadata;
      var dir = _getEmpresaDir(empresaId);
      var docDir = path.join(dir, 'documentos');
      _ensureDir(docDir);

      var fileName = 'DOC-' + Date.now() + '_' + (metadata.nombre || 'documento');
      var filePath = path.join(docDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(buffer));

      return { success: true, data: { archivoPath: filePath, nombre: fileName } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Obtener procedimiento ──
  ipcMain.handle('revisionAltaDireccion:obtenerProcedimiento', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var dir = _getEmpresaDir(empresaId);
      var procPath = path.join(dir, 'G-PR-001.doc');
      var existe = fs.existsSync(procPath);
      return {
        success: true,
        data: {
          existe: existe,
          archivoPath: existe ? procPath : null,
          version: '01',
          fecha: '2016-11-01'
        }
      };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // ── Abrir procedimiento ──
  ipcMain.handle('revisionAltaDireccion:abrirProcedimiento', async function(event, params) {
    try {
      var empresaId = params.empresaId;
      var dir = _getEmpresaDir(empresaId);
      var procPath = path.join(dir, 'G-PR-001.doc');
      if (fs.existsSync(procPath)) {
        shell.openPath(procPath);
        return { success: true, data: { ok: true } };
      }
      return { success: false, error: { code: 'FILE_NOT_FOUND', message: 'Procedimiento no encontrado' } };
    } catch (e) {
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  console.log('[K+AIRSST][6.1.3][INIT][SUCCESS] Handlers de Revisión por la Alta Dirección registrados correctamente (16 canales)');
}

module.exports = { registerRevisionAltaDireccionHandlers };
