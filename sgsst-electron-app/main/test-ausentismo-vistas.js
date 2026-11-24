// test-ausentismo-vistas.js
// 📦1096 (2026-11-24) — Tests de las VISTAS del 3.3.6 cuando pasan a leer
// de SQLite: el deduplicador del importador, el adaptador Excel->SQLite y el
// canal "ausentismo:actualizar".
//
// Patrón del repo: el metodo se EXTRAE del archivo real con new Function
// (como test-mail-fecha-860.js) para que el test no pueda pasar contra una
// copia del codigo.
//
// NOTA de ejecución: better-sqlite3 está compilado con el ABI de Electron, así
// que este test se corre con electron-as-node:
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe main/test-ausentismo-vistas.js
//
// Qué cubre:
//   1. _deduplicar: no fusiona casos distintos, sí fusiona el repetido,
//      conserva la primera aparición y completa sus campos vacíos.
//   2. _claveCaso: dos casos sin fecha nunca se fusionan.
//   3. _filasDesdeSqlite: produce TODAS las claves que la UI lee hoy
//      (se listan midiendo el archivo real, no a mano).
//   4. _filasDesdeBd: devuelve null (fallback al Excel) si la empresa no tiene
//      filas, si la API falla o si no hay API.
//   5. _camposParaBd: traduce las claves del modal de edicion.
//   6. ausentismo:actualizar: actualiza por id, no toca `origen`, recalcula
//      anio/mes/mas_10_dias y da NOT_FOUND si el id no existe.

'use strict';

const fs = require('fs');
const path = require('path');

const checks = [];
function ok(name, cond, extra) { checks.push({ name: name, ok: !!cond, extra: extra }); }

// ══════════════════════════════════════════════════════════════════
// Helpers: extraer un metodo del archivo real
// ══════════════════════════════════════════════════════════════════
function extraerMetodo(fuente, nombre) {
  const re = new RegExp('^    (?:async\\s+)?' + nombre + '\\s*\\(', 'm');
  const m = re.exec(fuente);
  if (!m) return null;
  const inicio = m.index;
  const llaveAbierta = fuente.indexOf('{', inicio);
  if (llaveAbierta < 0) return null;
  let nivel = 0;
  let enTexto = false;
  let esc = false;
  let enComentario = false;
  for (let i = llaveAbierta; i < fuente.length; i++) {
    const c = fuente[i];
    if (enComentario) {
      if (c === '\n') enComentario = false;
      continue;
    }
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '/' && fuente[i + 1] === '/') { enComentario = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { enTexto = !enTexto; continue; }
    if (enTexto) continue;
    if (c === '{') nivel++;
    else if (c === '}') {
      nivel--;
      if (nivel === 0) return fuente.slice(inicio, i + 1);
    }
  }
  return null;
}

/** Convierte "    metodo(args) { ... }" en una funcion suelta. */
function comoFuncion(fuenteMetodo) {
  const esAsync = /^\s*async\s/.test(fuenteMetodo);
  const sinEspacios = fuenteMetodo.replace(/^\s+/, '').replace(/^async\s+/, '');
  const nombre = sinEspacios.match(/^([A-Za-z_][A-Za-z0-9_]*)/)[1];
  const cabeza = esAsync ? 'async function ' : 'function ';
  return new Function(cabeza + sinEspacios + '\nreturn ' + nombre + ';')();
}

const RUTA_VISTAS = process.env.KAIR_VISTAS ||
  path.join(__dirname, '..', 'modules', 'gestion-salud', 'ausentismo', 'medicion-ausentismo.js');
const fuenteVistas = fs.readFileSync(RUTA_VISTAS, 'utf8');
const lineas = fuenteVistas.split('\n');

/** Lineas que ocupa un metodo de la clase (hasta el siguiente metodo). */
function rangoDeMetodo(nombre) {
  const re = new RegExp('^    (?:async\\s+)?' + nombre + '\\s*\\(', 'm');
  const m = re.exec(fuenteVistas);
  if (!m) return null;
  const desde = fuenteVistas.slice(0, m.index).split('\n').length;
  const siguiente = /^    (?:async\s+)?[A-Za-z_][A-Za-z0-9_]*\s*\(/gm;
  siguiente.lastIndex = m.index + m[0].length;
  const sig = siguiente.exec(fuenteVistas);
  const hasta = sig ? fuenteVistas.slice(0, sig.index).split('\n').length : lineas.length;
  return [desde, hasta];
}

async function main() {

  // ══════════════════════════════════════════════════════════════
  // 1 y 2) El deduplicador del importador
  // ══════════════════════════════════════════════════════════════
  const importador = require('./ausentismo-import.js');

  function hoja(nombre, anio, filas) {
    return { nombre: nombre, anio: anio, filaHeader: 7, filas: filas };
  }
  function caso(extra) {
    return Object.assign({
      cedula: '123', nombre: 'PERSONA', cargo: '', area: '', empresa_usuaria: '',
      genero: '', fecha_inicio: '2024-04-01', fecha_fin: '2024-04-03',
      dias_incapacidad: 3, tipo_incapacidad: 'Enfermedad General',
      clase_incapacidad: 'EPS', entidad: '', codigo: 'R074',
      diagnostico: 'Dolor', descripcion: '', observaciones: '', concepto: '',
      mas_10_dias: 0, anio: 2024, mes: 4, anio_incapacidad: 2024, mes_incapacidad: 4,
      excel_fila: 1, excel_hoja: 'X'
    }, extra);
  }

  // 1a) El repetido se fusiona y la conservada gana.
  {
    const primera = caso({ excel_fila: 8, excel_hoja: 'Empresa 2024', entidad: '', codigo: 'R074' });
    const repetida = caso({ excel_fila: 9, excel_hoja: '2024', entidad: 'EPS SANITAS', cargo: 'AUXILIAR' });
    const r = importador._deduplicar([hoja('Empresa 2024', 2024, [primera]), hoja('2024', 2024, [repetida])]);
    const quedan = r.hojas.reduce((s, h) => s + h.filas.length, 0);
    ok('1a) el caso repetido se descarta (duplicadas=1)', r.duplicadas === 1, 'duplicadas=' + r.duplicadas);
    ok('1b) queda una sola fila', quedan === 1, 'quedaron=' + quedan);
    const conservada = r.hojas[0].filas[0];
    ok('1c) gana la primera aparicion (hoja "Empresa 2024")', conservada.excel_hoja === 'Empresa 2024',
      'hoja=' + conservada.excel_hoja);
    ok('1d) la conservada se completa con los campos vacios de la repetida',
      conservada.entidad === 'EPS SANITAS' && conservada.cargo === 'AUXILIAR',
      'entidad="' + conservada.entidad + '" cargo="' + conservada.cargo + '"');
    ok('1e) lo que ya traia no se pisa', conservada.codigo === 'R074' && conservada.clase_incapacidad === 'EPS',
      'codigo=' + conservada.codigo + ' clase=' + conservada.clase_incapacidad);
  }

  // 1f) Casos DISTINTOS no se fusionan.
  {
    const a = caso({ excel_fila: 8, fecha_inicio: '2024-04-01', fecha_fin: '2024-04-03', dias_incapacidad: 3 });
    const b = caso({ excel_fila: 9, fecha_inicio: '2024-05-01', fecha_fin: '2024-05-03', dias_incapacidad: 3 });
    const c = caso({ excel_fila: 10, fecha_inicio: '2024-04-01', fecha_fin: '2024-04-05', dias_incapacidad: 5 });
    const r = importador._deduplicar([hoja('Empresa 2024', 2024, [a]), hoja('2024', 2024, [b, c])]);
    const quedan = r.hojas.reduce((s, h) => s + h.filas.length, 0);
    ok('1f) tres casos distintos se conservan (duplicadas=0)', r.duplicadas === 0 && quedan === 3,
      'duplicadas=' + r.duplicadas + ' quedaron=' + quedan);
  }

  // 2) Dos casos SIN fecha nunca se fusionan (no se puede saber si son el mismo).
  {
    const s1 = caso({ excel_fila: 8, fecha_inicio: '', fecha_fin: '', excel_hoja: 'A' });
    const s2 = caso({ excel_fila: 9, fecha_inicio: '', fecha_fin: '', excel_hoja: 'B' });
    ok('2a) dos casos sin fecha NO se fusionan',
      importador._claveCaso(s1) !== importador._claveCaso(s2),
      'claves iguales -> se fusionarian');
    const r = importador._deduplicar([hoja('A', 2024, [s1]), hoja('B', 2024, [s2])]);
    const quedan = r.hojas.reduce((s, h) => s + h.filas.length, 0);
    ok('2b) sobreviven los dos casos sin fecha', quedan === 2 && r.duplicadas === 0,
      'duplicadas=' + r.duplicadas + ' quedaron=' + quedan);
  }

  // ══════════════════════════════════════════════════════════════
  // 3) El adaptador: produce TODAS las claves que la UI lee hoy
  // ══════════════════════════════════════════════════════════════
  const fuenteAdapter = extraerMetodo(fuenteVistas, '_filasDesdeSqlite');
  ok('3-pre) _filasDesdeSqlite existe en el archivo real', !!fuenteAdapter);
  const Adapter = fuenteAdapter ? comoFuncion(fuenteAdapter) : null;

  // Las claves que la UI lee de cada fila, MEDIDAS sobre el archivo real.
  //
  // OJO con la semantica: la UI no exige que existan TODAS las claves, exige
  // que exista AL MENOS UNA de cada cadena de respaldo. Por ejemplo
  //   row['15'] || row['F. INICIO'] || row['FECHA INICIO'] || row.fecha_inicio
  // Con que '15' este, la UI ya encuentra el valor. Por eso el test mide
  // CADENAS y no una bolsa de claves sueltas.
  //
  // El codigo real es mas enredado: hay cadenas donde las alternativas vienen
  // envueltas (parseInt(row['N° DIAS DE INCAPACIDAD']) || parseInt(...)) y
  // cadenas que acaban en una constante que no es una clave (row.no ||
  // index + 1). Por eso se parte el texto por '||' y se mira cada
  // ALTERNATIVA por separado.
  const REGIONES = [
    ['tabla "Ver registros"', rangoDeMetodo('renderTable')],
    ['tabla "Ver registros" (filtros)', rangoDeMetodo('populateDynamicFilters')],
    ['estadisticas', rangoDeMetodo('loadEstadisticasData')],
    ['estadisticas extendidas', rangoDeMetodo('_calcularEstadisticasExtendidas')],
    ['metricas', rangoDeMetodo('updateStatsMetrics')],
    ['graficos', rangoDeMetodo('renderCharts')],
    ['filtros de estadisticas', rangoDeMetodo('populateStatsFilters')]
  ];
  // Los nombres de columna pueden llevar tilde ("ÁREA O DPTO", "AÑO").
  const LETRA = "[A-Za-z\\u00C0-\\u024F_][A-Za-z\\u00C0-\\u024F0-9_]*";
  const ACC = "\\b(?:row|r|f|fila|registro|record)";
  const reAcceso = new RegExp(ACC + "(?:\\[['\"]([^'\"]+)['\"]\\]|\\.(" + LETRA + "))", 'g');
  const reGetCol = /getCol\(\s*\w+\s*,\s*([^)]*)\)/g;
  const TRIVIAL = ['', '0', "''", '""', 'null', 'undefined', 'false'];

  /** Devuelve la clave del ultimo acceso a fila de una alternativa. */
  function claveDe(texto) {
    let clave = null;
    let mm;
    reAcceso.lastIndex = 0;
    while ((mm = reAcceso.exec(texto))) clave = mm[1] !== undefined ? mm[1] : mm[2];
    return clave;
  }

  const cadenas = [];
  for (const par of REGIONES) {
    const rango = par[1];
    if (!rango) continue;
    const seg = lineas.slice(rango[0] - 1, rango[1]).join('\n');
    let m;
    while ((m = reGetCol.exec(seg))) {
      const claves = m[1].split(',').map(c => c.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      if (claves.length) {
        cadenas.push({ claves: claves, texto: 'getCol(' + m[1] + ')' });
      }
    }
    // Cadenas con '||': primero se parte por ';' (una oracion) y luego por
    // '||' (las alternativas de la cadena).
    for (const oracion of seg.split(';')) {
      const alternativas = oracion.split('||').map(s => s.trim()).filter(s => s !== '');
      if (alternativas.length < 2) continue;
      const claves = [];
      const constantes = [];
      for (const alt of alternativas) {
        const clave = claveDe(alt);
        if (clave !== null) claves.push(clave);
        else constantes.push(alt);
      }
      if (!claves.length) continue;
      cadenas.push({ claves: claves, constantes: constantes, texto: alternativas.join(' || ') });
    }
  }
  ok('3-pre) se midieron las cadenas de claves que lee la UI', cadenas.length > 20,
    'cadenas=' + cadenas.length);

  const REGISTRO = {
    id: 'aus-1', empresa_id: 'Aseplus', cedula: '3729847', nombre: 'VLADIMIR ESCORCIA',
    cargo: 'No Existe', area: 'CENTRO RECREACIONAL TURIPANA', empresa_usuaria: 'COMFAMILIAR ATLANTICO',
    genero: 'HOMBRE', fecha_inicio: '2024-04-01', fecha_fin: '2024-04-02',
    dias_incapacidad: 2, tipo_incapacidad: 'ENFREMEDAD LABORAL', clase_incapacidad: 'EPS',
    entidad: 'No Existe', codigo: 'R074', diagnostico: 'Dolor en el pecho, no especificado',
    descripcion: '', observaciones: '', concepto: '', mas_10_dias: 0,
    anio: 2024, mes: 4, anio_incapacidad: 2024, mes_incapacidad: 4, origen: 'import_excel'
  };

  const fila = Adapter ? Adapter([REGISTRO])[0] : null;
  ok('3a) el adaptador devuelve una fila por registro', !!fila);

  if (fila) {
    // 3b) Para cada cadena de respaldo que usa la UI, al menos una clave
    //     tiene que existir en la fila que produce el adaptador.
    const rotas = [];
    for (const c of cadenas) {
      const alguno = c.claves.filter(k => fila[k] !== undefined && fila[k] !== null);
      // Una alternativa que no es una clave (row.no || index + 1) tambien
      // sirve: la UI tiene su propio respaldo.
      const constante = (c.constantes || []).some(t => TRIVIAL.indexOf(t) === -1);
      if (!alguno.length && !constante) {
        rotas.push('[' + c.claves.join(' || ') + '] <- ' + c.texto.replace(/\s+/g, ' ').slice(0, 110));
      }
    }
    ok('3b) para cada cadena de respaldo de la UI hay una clave que existe',
      rotas.length === 0, 'rotas: ' + rotas.join(' | '));

    const numericas = ['2', '3', '9', '11', '14', '15', '16', '17'];
    const faltanNum = numericas.filter(k => fila[k] === undefined);
    ok('3c) la fila trae los indices numericos que usa la UI', faltanNum.length === 0,
      'faltan: ' + faltanNum.join(', '));

    ok('3d) MES es el NOMBRE del mes en mayusculas (como el Excel)', fila.MES === 'ABRIL', 'MES=' + fila.MES);
    ok('3e) el indice 9 tambien es el nombre del mes', fila['9'] === 'ABRIL', "['9']=" + fila['9']);
    ok('3f) AÑO es texto (como en el Excel)', fila['AÑO'] === '2024' && typeof fila['AÑO'] === 'string', 'AÑO=' + fila['AÑO']);
    ok('3g) DESCRIPCION sale del campo diagnostico', fila.DESCRIPCION === 'Dolor en el pecho, no especificado',
      'DESCRIPCION=' + fila.DESCRIPCION);
    ok('3h) el indice 15 es la fecha de inicio', fila['15'] === '2024-04-01', "['15']=" + fila['15']);
    ok('3i) los dias son texto (lo parsea con parseInt)', fila['N° DIAS DE INCAPACIDAD'] === '2',
      'dias=' + fila['N° DIAS DE INCAPACIDAD']);
    ok('3j) la fila se marca como de la base', fila.__origen === 'bd' && fila.__id === 'aus-1',
      '__origen=' + fila.__origen + ' __id=' + fila.__id);
    ok('3k) la fila trae su indice para editar/eliminar', fila.__rowIndex === 0, '__rowIndex=' + fila.__rowIndex);
    ok('3l) NO se copia la columna "No" (la tabla la renumera al filtrar)', fila.no === undefined,
      'no=' + fila.no);
  }

  // ══════════════════════════════════════════════════════════════
  // 4) _filasDesdeBd: null cuando la empresa no tiene filas (fallback Excel)
  // ══════════════════════════════════════════════════════════════
  const fuenteDesdeBd = extraerMetodo(fuenteVistas, '_filasDesdeBd');
  ok('4-pre) _filasDesdeBd existe en el archivo real', !!fuenteDesdeBd);
  const DesdeBd = fuenteDesdeBd ? comoFuncion(fuenteDesdeBd) : null;

  function contexto(api) {
    global.window = api === undefined ? {} : { electronAPI: api };
    return {
      currentCompany: 'Aseplus',
      _filasDesdeSqlite: Adapter
    };
  }

  if (DesdeBd) {
    {
      const ctx = contexto({ ausentismoListar: async () => ({ success: true, data: [REGISTRO] }) });
      const r = await DesdeBd.call(ctx);
      ok('4a) con filas en la base devuelve las filas (no null)',
        Array.isArray(r) && r.length === 1 && r[0].__origen === 'bd',
        'r=' + JSON.stringify(r && r.length));
    }
    {
      const ctx = contexto({ ausentismoListar: async () => ({ success: true, data: [] }) });
      ok('4b) empresa sin filas devuelve null (no un arreglo vacio)',
        (await DesdeBd.call(ctx)) === null, 'no es null');
    }
    {
      const ctx = contexto({ ausentismoListar: async () => { throw new Error('boom'); } });
      ok('4c) si la API falla devuelve null y no rompe la vista',
        (await DesdeBd.call(ctx)) === null, 'no es null');
    }
    {
      const ctx = contexto(undefined);
      ok('4d) sin API disponible devuelve null', (await DesdeBd.call(ctx)) === null, 'no es null');
    }
  }

  // ══════════════════════════════════════════════════════════════
  // 5) _camposParaBd: traduce las claves del modal de edicion
  // ══════════════════════════════════════════════════════════════
  const fuenteCampos = extraerMetodo(fuenteVistas, '_camposParaBd');
  ok('5-pre) _camposParaBd existe en el archivo real', !!fuenteCampos);
  const CamposParaBd = fuenteCampos ? comoFuncion(fuenteCampos) : null;
  if (CamposParaBd) {
    const r = CamposParaBd({
      'GENERO': 'Femenino',
      'CLASE DE INCAPACIDAD': 'Temporal',
      'TIPO DE INCAPACIDAD': 'Enfermedad General',
      'CODIGO': 'R074',
      'DESCRIPCION': 'Dolor',
      'F. INICIO': '4/1/24',
      'F. FIN': '4/2/24'
    });
    ok('5a) traduce las 7 claves editables del modal',
      r.genero === 'Femenino' && r.clase_incapacidad === 'Temporal' &&
      r.tipo_incapacidad === 'Enfermedad General' && r.codigo === 'R074' &&
      r.diagnostico === 'Dolor' && r.fecha_inicio === '4/1/24' && r.fecha_fin === '4/2/24',
      JSON.stringify(r));
    const r2 = CamposParaBd({ 'CEDULA': '1', 'NOMBRE': 'X', 'N° DIAS DE INCAPACIDAD': '5' });
    ok('5b) ignora las claves que no son editables', Object.keys(r2).length === 0, JSON.stringify(r2));
  }

  // ══════════════════════════════════════════════════════════════
  // 6) El canal ausentismo:actualizar
  // ══════════════════════════════════════════════════════════════
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
  require.cache['electron-mock'] = {
    id: 'electron-mock', filename: 'electron-mock', loaded: true,
    exports: { ipcMain: global._mockIpcMain }
  };

  const bridge = require('./ausentismo-bridge.js');
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec(bridge.SCHEMA_SQL);

  try {
    db.prepare('SELECT company_key FROM companies LIMIT 1').get();
  } catch (e) {
    db.exec('CREATE TABLE companies (company_key TEXT, display_name TEXT)');
    db.prepare('INSERT INTO companies (company_key, display_name) VALUES (?, ?)').run('Aseplus', 'Aseplus');
  }

  bridge.registerAusentismoHandlers({}, { getDb: () => db });

  ok('6-pre) el canal ausentismo:actualizar quedo registrado', typeof handlers['ausentismo:actualizar'] === 'function');

  db.prepare('INSERT INTO ausentismo_registros ' +
    '(id, empresa_id, cedula, nombre, fecha_inicio, fecha_fin, dias_incapacidad, ' +
    'tipo_incapacidad, clase_incapacidad, entidad, codigo, diagnostico, ' +
    'mas_10_dias, anio_incapacidad, mes_incapacidad, anio, mes, origen, ' +
    'creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    'aus-test-1', 'Aseplus', '123', 'PERSONA', '2024-04-01', '2024-04-03', 3,
    'Enfermedad General', 'EPS', 'EPS SANITAS', 'R074', 'Dolor', 0, 2024, 4, 2024, 4, 'app',
    '2026-11-24T00:00:00.000Z', '2026-11-24T00:00:00.000Z');

  const act = handlers['ausentismo:actualizar'];
  if (act) {
    const r1 = await act({}, {
      empresaId: 'Aseplus', id: 'aus-test-1',
      datos: { genero: 'Femenino', codigo: 'R075', fecha_inicio: '2/5/24', dias_incapacidad: 12 }
    });
    ok('6a) actualizar responde success', r1 && r1.success === true, JSON.stringify(r1 && r1.error));
    const f1 = db.prepare('SELECT * FROM ausentismo_registros WHERE id = ?').get('aus-test-1');
    ok('6b) guarda el genero', f1.genero === 'Femenino', 'genero=' + f1.genero);
    ok('6c) guarda el codigo', f1.codigo === 'R075', 'codigo=' + f1.codigo);
    ok('6d) parsea la fecha M/D/YY que manda el modal ("2/5/24" = 5 de febrero)',
      f1.fecha_inicio === '2024-02-05', 'fecha_inicio=' + f1.fecha_inicio);
    ok('6e) recalcula anio_incapacidad y mes_incapacidad',
      f1.anio_incapacidad === 2024 && f1.mes_incapacidad === 2,
      'anio=' + f1.anio_incapacidad + ' mes=' + f1.mes_incapacidad);
    ok('6e-bis) la fecha real del Excel ("4/1/24" = 1 de abril) tambien',
      (await act({}, { empresaId: 'Aseplus', id: 'aus-test-1', datos: { fecha_inicio: '4/1/24' } })).data.fecha_inicio === '2024-04-01',
      'mal');
    ok('6f) recalcula mas_10_dias (12 dias)', f1.mas_10_dias === 1, 'mas_10_dias=' + f1.mas_10_dias);
    ok('6g) NO toca el origen de la fila', f1.origen === 'app', 'origen=' + f1.origen);
    ok('6h) NO toca exportado_excel_en', f1.exportado_excel_en === null, 'exportado=' + f1.exportado_excel_en);

    const r2 = await act({}, { empresaId: 'Aseplus', id: 'no-existe', datos: { genero: 'X' } });
    ok('6i) un id inexistente responde NOT_FOUND',
      r2 && r2.success === false && r2.error && r2.error.code === 'NOT_FOUND', JSON.stringify(r2));

    const r3 = await act({}, { empresaId: 'Aseplus', datos: { genero: 'X' } });
    ok('6j) sin id responde NO_ID',
      r3 && r3.success === false && r3.error && r3.error.code === 'NO_ID', JSON.stringify(r3));

    db.prepare('INSERT INTO ausentismo_registros ' +
      '(id, empresa_id, cedula, nombre, origen, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?)').run(
      'aus-test-2', 'Tempoactiva', '999', 'OTRO', 'app',
      '2026-11-24T00:00:00.000Z', '2026-11-24T00:00:00.000Z');
    const r4 = await act({}, { empresaId: 'Aseplus', id: 'aus-test-2', datos: { genero: 'Femenino' } });
    const f2 = db.prepare('SELECT * FROM ausentismo_registros WHERE id = ?').get('aus-test-2');
    ok('6k) no actualiza una fila de otra empresa',
      r4 && r4.success === false && f2.genero !== 'Femenino', JSON.stringify(r4));
  }

  // ══════════════════════════════════════════════════════════════
  // Resumen
  // ══════════════════════════════════════════════════════════════
  let fallos = 0;
  checks.forEach(c => {
    if (!c.ok) {
      fallos++;
      console.log('FAIL  ' + c.name + (c.extra ? '  ->  ' + c.extra : ''));
    }
  });
  console.log('');
  console.log((checks.length - fallos) + '/' + checks.length + ' checks OK');
  db.close();
  process.exit(fallos ? 1 : 0);
}

main().catch(e => {
  console.error('ERROR EN EL TEST:', e && e.stack ? e.stack : e);
  process.exit(1);
});
