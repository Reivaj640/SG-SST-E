// =====================================================================
// 📦827 (2026-09-30) — Bridge IPC para los DATOS del programa SVE (3.1.2).
//
// 📦825 creó el esqueleto del programa (qué programas hay, qué secciones).
// 📦826 trajo la interfaz del prototipo. 📦827 mete el CONTENIDO en SQLite:
// hasta acá los casos de seguimiento, el plan PHVA y los indicadores vivían
// en localStorage del renderer — dentro de la app y de ESA PC, fuera del
// archivo .kairsync, así que no viajaban entre máquinas y se perdían al
// reinstalar.
//
// CONTRATO — la decisión que evita reescribir 1.300 líneas de vistas:
//   `datos:get` devuelve el dataset en EXACTAMENTE la forma que el store del
//   prototipo ya tiene en memoria (meta / plan / seguimientos / indicadores /
//   morbilidad / analisis). Las tablas son la forma RELATIONAL de ese mismo
//   objeto. Las vistas no se enteran del cambio: siguen leyendo el store, y
//   el store ahora se hidrata desde acá y escribe acá.
//
//   Lo que NO va a la base y sigue en el seed del prototipo:
//     - `fases` (planear/hacer/verificar/actuar): catálogo fijo del ciclo PHVA.
//     - `catalogos` (áreas, cargos, EPS, AFP): listas de autocompletado que se
//       derivan de los casos ya registrados.
//   Son CONFIGURACIÓN, no datos del usuario. Si algún día cambian, se
//   versionan en el seed con el resto del prototipo.
//
// Canales:
//   medprev:sve:datos:get              — dataset completo del programa (read)
//   medprev:sve:casos:crear            — nuevo caso
//   medprev:sve:casos:actualizar       — editar caso
//   medprev:sve:casos:eliminar         — baja lógica (conserva la traza)
//   medprev:sve:plan:actividad:crear   — nueva fila del PHVA (devuelve el id)
//   medprev:sve:plan:actividad:guardar — nombre / responsable / fase
//   medprev:sve:plan:actividad:eliminar— borra la fila y sus 12 meses (FK CASCADE)
//   medprev:sve:plan:celda:guardar     — un (mes, ap, ae)
//   medprev:sve:meta:guardar           — encabezado del documento
//   medprev:sve:indicadores:guardar    — reemplaza definiciones + valores
//   medprev:sve:morbilidad:guardar     — reemplaza la serie
//   medprev:sve:analisis:guardar       — reemplaza los análisis por periodo
//   medprev:sve:migrar                 — vuelca el localStorage una sola vez
//
// 🔒 Auth: misma política que medprev-programas-bridge.js (📦825) —
// las MUTACIONES exigen token válido con validateSession (hard, sin bypass);
// las LECTURAS validan el token si llega y lo rechazan si es inválido.
// Todos los SQL son prepared statements y siempre filtran por empresa_id +
// programa_id: un programa de otra empresa no es legible ni escribible desde
// esta sesión.
//
// Ids de TEXTO ('msc-...', 'act-N'), no numéricos: con varias máquinas y
// merge last-write-wins POR ID, dos PCs que crearan el caso 25 se pisarían
// silenciosamente. El prototipo usaba enteros; por eso `addSeguimiento` del
// store pasa a generar id de texto (📦827).
// =====================================================================
'use strict';

const { ipcMain } = require('electron');
const {
  MP_SVE_SCHEMA_SQL,
  MP_SVE_SCHEMA_ALTERS,
  MP_SVE_MIGRATIONS_SQL,
  MP_SVE_MIGRATION_IDS
} = require('./medprev-sve-datos-schema-sql');

const MOD = 'MEDPREV-SVE-DATOS';

let _getDb = null;
let _validateSession = null;

// ---------- Helpers compartidos ----------
function _err(code, message, extra) {
  var e = { success: false, error: { code: code, message: message } };
  if (extra) e.error.extra = extra;
  return e;
}
function _ok(data) {
  return { success: true, data: data || {} };
}

function _requireAuth(token) {
  if (!_validateSession || typeof _validateSession !== 'function') {
    return { ok: false, error: _err('AUTH_UNAVAILABLE', 'Sistema de sesiones no disponible') };
  }
  var session = _validateSession(token);
  if (!session || !session.ok) {
    var code = (session && session.error && session.error.code) || 'INVALID_SESSION';
    return { ok: false, error: _err('AUTH_' + code, 'Sesión inválida o expirada') };
  }
  return { ok: true, user: session.user };
}

function _optionalAuth(token) {
  if (!token) return { ok: true, user: null };
  if (!_validateSession || typeof _validateSession !== 'function') return { ok: true, user: null };
  var session = _validateSession(token);
  if (!session || !session.ok) {
    return { ok: false, error: _err('AUTH_INVALID_SESSION', 'Sesión inválida o expirada') };
  }
  return { ok: true, user: session.user };
}

function _getCompanyByName(companyName) {
  if (!_getDb) return null;
  var localDb = _getDb();
  if (!localDb) return null;
  var normalized = String(companyName || '').toLowerCase().trim();
  if (!normalized) return null;
  try {
    return localDb.prepare(
      "SELECT id, company_key, display_name FROM companies " +
      "WHERE LOWER(display_name) = ? OR LOWER(company_key) = ? LIMIT 1"
    ).get(normalized, normalized) || null;
  } catch (e) {
    console.error('[' + MOD + '][_getCompanyByName]', e.message);
    return null;
  }
}

function _nuevoId(prefixo) {
  return prefixo + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// Tablas donde se acepta un id propuesto por el renderer. Lista blanca y no
// interpolación libre: el nombre de la tabla se concatena en el SQL.
const _ID_TABLAS = ['mp_sve_casos', 'mp_sve_plan_actividades'];

/**
 * Id de TEXTO único para una tabla de `mp_sve_*`.
 *
 * Existe porque las VISTAS son sincrónicas: al crear un caso, `addSeguimiento`
 * tiene que devolver el id en el mismo tick para que el prototipo pueda pintar
 * la fila y navegar a `#/caso/<id>` sin esperar la respuesta del puente. Por eso
 * el renderer propone el id y esta función lo valida.
 *
 * Ante una colisión NO se pisa el registro existente: se deriva con sufijo y se
 * devuelve el real, que el store reconcilia. Es una red de seguridad, no el
 * camino normal — con `Date.now()` en base36 más 6 caracteres aleatorios la
 * probabilidad de choque es despreciable, y un id repetido en dos máquinas
 * significaría perder un caso sin avisar.
 */
function _idLibre(db, programaId, propuesto, tabla, prefijo) {
  if (_ID_TABLAS.indexOf(tabla) === -1) throw new Error('Tabla no permitida para id propuesto: ' + tabla);
  var base = String(propuesto || '').trim();
  if (!base || base.length > 120) base = _nuevoId(prefijo);
  /* Acota por programa: el id es unico DENTRO del programa, asi que dos
     programas SVE de la misma empresa pueden tener cada uno su 'act-1'. */
  var existe = db.prepare('SELECT 1 AS x FROM ' + tabla + ' WHERE programa_id = ? AND id = ?');
  var id = base;
  var n = 1;
  while (existe.get(programaId, id)) {
    n++;
    id = base.slice(0, 100) + '-' + n;
  }
  return id;
}

function _ahora() { return new Date().toISOString(); }

/**
 * Resuelve el programa y verifica que sea de esta empresa. TODOS los handlers
 * pasan por acá antes de tocar cualquier tabla: es el único punto donde se
 * decide si un programa existe para la sesión actual.
 */
function _programaDe(companyKey, programaId) {
  if (!programaId) return { error: _err('VALIDATION', 'programaId requerido') };
  var localDb = _getDb();
  var p = localDb.prepare(
    "SELECT id, empresa_id, tipo, nombre FROM mp_programas " +
    "WHERE id = ? AND empresa_id = ? AND estado != 'eliminado'"
  ).get(String(programaId), companyKey);
  if (!p) return { error: _err('NOT_FOUND', 'Programa no encontrado para esta empresa') };
  return { db: localDb, programa: p };
}

// =====================================================================
// Mapeo BD <-> shape del store
// =====================================================================

// Orden canónico de las columnas del caso. Se usa en los dos sentidos, así
// que agregar un campo es agregar UNA línea y no dos (y el forget de tocar el
// mapeo en un solo lado es el bug clásico de estas tablas anchas).
const CASO_CAMPOS = [
  'fechaIngreso', 'mes', 'anio', 'empresa',
  'trabajador', 'documento', 'telefono', 'email', 'genero', 'fechaNacimiento',
  'eps', 'afp', 'sector', 'cargo', 'area', 'ciudad',
  'antecedentes', 'tipoAntecedente', 'vulnerable', 'sintomas', 'cualesSintomas',
  'contactoPositivo', 'contactoSintomatico', 'pruebaRapida', 'fechaPruebaRapida',
  'pcr', 'fechaPcr', 'modalidad', 'fechaAislamiento', 'estado', 'observaciones'
];
// camelCase -> snake_case de la columna. Derivado, no escrito a mano: si
// alguien agrega una columna, el mapeo no se olvida.
function _col(campo) {
  return campo.replace(/[A-Z]/g, function (m) { return '_' + m.toLowerCase(); });
}

function _casoRowToUi(r) {
  if (!r) return null;
  var o = { id: r.id, orden: r.orden };
  CASO_CAMPOS.forEach(function (c) {
    var v = r[_col(c)];
    o[c] = (v === null || v === undefined) ? '' : v;
  });
  return o;
}

// Medidas de un indicador. NO es una lista fija: se DERIVA del objeto, porque
// los cuatro indicadores del prototipo no comparten medidas (prevalencia usa
// casos, incidencia casosNuevos, ausentismo diasIncapacidad/diasProgramados,
// eficacia sugeridas/implementadas). Una lista fija se comia tres de las cuatro
// y el Dashboard reventaba al leer `incidencia.casosNuevos[i]`. Lo unico que
// no es una medida es `anios`: es la espina de la serie.
function _medidasDe(ind) {
  return Object.keys(ind || {}).filter(function (k) {
    return k !== 'anios' && Array.isArray(ind[k]);
  });
}
function _aniosDe(ind) {
  return Array.isArray(ind && ind.anios) ? ind.anios : [];
}

/* 📦830 — Extras de la card que no son columnas propias: meta corta
   ("< 10%") y umbral del semáforo (0.1 / 0.7). Se guardan en UN JSON
   (extra_json) para no agregar dos columnas de un solo consumidor. */
function _extraDe(ind) {
  var ex = {};
  if (ind && ind.metaCorta !== undefined && ind.metaCorta !== null && ind.metaCorta !== '') ex.metaCorta = ind.metaCorta;
  if (ind && ind.umbral !== undefined && ind.umbral !== null && ind.umbral !== '') ex.umbral = ind.umbral;
  return Object.keys(ex).length ? JSON.stringify(ex) : null;
}
function _extraHacia(fila) {
  var ex = {};
  try { ex = JSON.parse((fila && fila.extra_json) || '{}') || {}; } catch (e) { ex = {}; }
  var o = {};
  if (ex.metaCorta !== undefined && ex.metaCorta !== null && ex.metaCorta !== '') o.metaCorta = ex.metaCorta;
  if (ex.umbral !== undefined && ex.umbral !== null && ex.umbral !== '') o.umbral = ex.umbral;
  return o;
}

/**
 * Reconstruye `indicadores` desde la base. Las medidas de cada indicador se
 * alinean con el `anios` guardado en la DEFINICION, no con el ano de los
 * valores: un indicador con una serie vacia tiene que volver con sus anos
 * igual, porque las vistas indexan `anios[Math.min(4, anios.length - 1)]` y
 * con la lista de anos derivada de los valores eso daba `undefined`.
 */
function _leerIndicadores(db, programaId) {
  var defs = db.prepare(
    'SELECT * FROM mp_sve_indicadores WHERE programa_id = ? ORDER BY clave'
  ).all(programaId);
  var out = {};
  defs.forEach(function (d) {
    var anios = [];
    var medidas = [];
    try { anios = JSON.parse(d.anios_json || '[]'); } catch (e) { anios = []; }
    try { medidas = JSON.parse(d.medidas_json || '[]'); } catch (e) { medidas = []; }

    var vals = db.prepare(
      'SELECT anio, medida, valor FROM mp_sve_indicadores_valores WHERE programa_id = ? AND indicador_id = ?'
    ).all(programaId, d.id);
    var porMedida = {};
    vals.forEach(function (v) {
      if (!porMedida[v.medida]) porMedida[v.medida] = {};
      porMedida[v.medida][v.anio] = v.valor;
    });

    var o = {
      nombre: d.nombre, meta: d.meta || '', formulacion: d.formulacion || '',
      periodicidad: d.periodicidad || '', anios: anios
    };
    var extra = _extraHacia(d);
    if (extra.metaCorta !== undefined) o.metaCorta = extra.metaCorta;
    if (extra.umbral !== undefined) o.umbral = extra.umbral;
    medidas.forEach(function (m) {
      var porAnio = porMedida[m] || {};
      o[m] = anios.map(function (a) {
        return porAnio[a] === undefined ? null : porAnio[a];
      });
    });
    out[d.clave] = o;
  });
  return out;
}

function _leerMorbilidad(db, programaId) {
  var rows = db.prepare(
    'SELECT tipo, anio, casos, dias_it FROM mp_sve_morbilidad WHERE programa_id = ? ORDER BY tipo, anio'
  ).all(programaId);
  var porTipo = {};
  var anios = {};
  rows.forEach(function (r) {
    anios[r.anio] = 1;
    if (!porTipo[r.tipo]) porTipo[r.tipo] = { tipo: r.tipo, casos: {}, diasIt: {} };
    if (r.casos !== null && r.casos !== undefined) porTipo[r.tipo].casos[r.anio] = r.casos;
    if (r.dias_it !== null && r.dias_it !== undefined) porTipo[r.tipo].diasIt[r.anio] = r.dias_it;
  });
  var listaAnios = Object.keys(anios).map(Number).sort(function (a, b) { return a - b; });
  return {
    anios: listaAnios,
    filas: Object.keys(porTipo).sort().map(function (t) {
      var f = porTipo[t];
      return {
        tipo: f.tipo,
        casos: listaAnios.map(function (a) { return f.casos[a] === undefined ? null : f.casos[a]; }),
        diasIt: listaAnios.map(function (a) { return f.diasIt[a] === undefined ? null : f.diasIt[a]; })
      };
    })
  };
}

function _leerPlan(db, programaId) {
  var acts = db.prepare(
    'SELECT * FROM mp_sve_plan_actividades WHERE programa_id = ? ORDER BY orden, id'
  ).all(programaId);
  var mesesStmt = db.prepare(
    'SELECT mes, ap, ae FROM mp_sve_plan_meses WHERE programa_id = ? AND actividad_id = ? ORDER BY mes'
  );
  return acts.map(function (a) {
    var filas = mesesStmt.all(programaId, a.id);
    var porMes = {};
    filas.forEach(function (f) { porMes[f.mes] = f; });
    var meses = [];
    for (var i = 1; i <= 12; i++) {
      var f = porMes[i];
      meses.push([f ? f.ap : 0, f ? f.ae : 0]);
    }
    return {
      id: a.id, fase: a.fase, actividad: a.actividad || '',
      responsable: a.responsable || '', meses: meses
    };
  });
}

function _leerAnalisis(db, programaId) {
  return db.prepare(
    'SELECT periodo, hallazgos, propuestas, responsable FROM mp_sve_analisis WHERE programa_id = ? ORDER BY orden, periodo'
  ).all(programaId).map(function (r) {
    return {
      periodo: r.periodo || '', hallazgos: r.hallazgos || '',
      propuestas: r.propuestas || '', responsable: r.responsable || ''
    };
  });
}

function _leerMeta(db, programaId) {
  var r = db.prepare('SELECT meta_json FROM mp_sve_meta WHERE programa_id = ?').get(programaId);
  if (!r) return null;
  try { return JSON.parse(r.meta_json); } catch (e) { return null; }
}

function _leerCasos(db, programaId) {
  return db.prepare(
    'SELECT * FROM mp_sve_casos WHERE programa_id = ? AND eliminado_en IS NULL ORDER BY orden, creado_en'
  ).all(programaId).map(_casoRowToUi);
}

// =====================================================================
// Handlers
// =====================================================================

function registerMedprevSveDatosHandlers(app, deps) {
  _getDb = deps.getDb;
  _validateSession = deps.validateSession;

  // ── datos:get — el dataset completo, en la forma que el store ya usa ──
  ipcMain.handle('medprev:sve:datos:get', function (event, payload) {
    try {
      var auth = _optionalAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;

      var db = res.db;
      return _ok({
        meta: _leerMeta(db, res.programa.id),
        plan: _leerPlan(db, res.programa.id),
        seguimientos: _leerCasos(db, res.programa.id),
        indicadores: _leerIndicadores(db, res.programa.id),
        morbilidad: _leerMorbilidad(db, res.programa.id),
        analisis: _leerAnalisis(db, res.programa.id)
      });
    } catch (e) {
      console.error('[' + MOD + '][datos:get]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── casos ──
  ipcMain.handle('medprev:sve:casos:crear', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      var d = payload.caso || {};
      if (!String(d.trabajador || '').trim()) {
        return _err('VALIDATION', 'El campo "trabajador" es obligatorio');
      }

      var db = res.db;
      // El renderer propone el id (ver _idLibre): lo necesita antes de la
      // respuesta para pintar la fila y navegar al detalle en el mismo tick.
      var id = _idLibre(db, res.programa.id, payload.idOpcional, 'mp_sve_casos', 'msc');
      var t = _ahora();
      var orden = db.prepare(
        'SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM mp_sve_casos WHERE programa_id = ?'
      ).get(res.programa.id).siguiente;

      var cols = ['id', 'programa_id', 'empresa_id', 'orden', 'eliminado_en', 'creado_en', 'actualizado_en', 'creado_por'];
      var vals = [id, res.programa.id, company.company_key, orden, null, t, t, (auth.user && auth.user.id) || null];
      CASO_CAMPOS.forEach(function (c) {
        cols.push(_col(c));
        var v = d[c];
        vals.push(v === undefined || v === null ? '' : v);
      });
      // better-sqlite3 exige que el metodo se llame con la sentencia como
      // `this`: `stmt.run.apply(stmt, vals)`. Con `.apply(null, ...)` el
      // motor nativo lanza "Illegal invocation".
      var insCasoStmt = db.prepare(
        'INSERT INTO mp_sve_casos (' + cols.join(', ') + ') VALUES (' + cols.map(function () { return '?'; }).join(', ') + ')'
      );
      insCasoStmt.run.apply(insCasoStmt, vals);

      return _ok({ caso: _casoRowToUi(db.prepare('SELECT * FROM mp_sve_casos WHERE programa_id = ? AND id = ?').get(res.programa.id, id)) });
    } catch (e) {
      console.error('[' + MOD + '][casos:crear]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('medprev:sve:casos:actualizar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      if (!payload.casoId) return _err('VALIDATION', 'casoId requerido');

      var db = res.db;
      var actual = db.prepare(
        'SELECT id FROM mp_sve_casos WHERE id = ? AND programa_id = ? AND empresa_id = ? AND eliminado_en IS NULL'
      ).get(String(payload.casoId), res.programa.id, company.company_key);
      if (!actual) return _err('NOT_FOUND', 'Caso no encontrado');

      var d = payload.caso || {};
      var sets = ['actualizado_en = ?'];
      var vals = [_ahora()];
      CASO_CAMPOS.forEach(function (c) {
        if (d[c] === undefined) return;   // no mandar lo que no se toco
        sets.push(_col(c) + ' = ?');
        vals.push(d[c] === null ? '' : d[c]);
      });
      vals.push(String(payload.casoId), res.programa.id, company.company_key);
      var updCaso = db.prepare('UPDATE mp_sve_casos SET ' + sets.join(', ') + ' WHERE id = ? AND programa_id = ? AND empresa_id = ?');
      updCaso.run.apply(updCaso, vals);

      return _ok({ caso: _casoRowToUi(db.prepare('SELECT * FROM mp_sve_casos WHERE programa_id = ? AND id = ?').get(res.programa.id, String(payload.casoId))) });
    } catch (e) {
      console.error('[' + MOD + '][casos:actualizar]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('medprev:sve:casos:eliminar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      if (!payload.casoId) return _err('VALIDATION', 'casoId requerido');

      var db = res.db;
      // Baja LÓGICA: un caso de SG-SST no se borra, se archiva. Queda el
      // registro y la fecha, para responder "¿este caso existió?".
      var r = db.prepare(
        'UPDATE mp_sve_casos SET eliminado_en = ?, actualizado_en = ? WHERE id = ? AND programa_id = ? AND empresa_id = ? AND eliminado_en IS NULL'
      ).run(_ahora(), _ahora(), String(payload.casoId), res.programa.id, company.company_key);
      if (r.changes === 0) return _err('NOT_FOUND', 'Caso no encontrado');

      return _ok({ eliminado: 1 });
    } catch (e) {
      console.error('[' + MOD + '][casos:eliminar]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── plan PHVA ──
  ipcMain.handle('medprev:sve:plan:actividad:crear', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      if (!payload.fase) return _err('VALIDATION', 'fase requerida');

      var db = res.db;
      // Id estable 'act-N': el store calcula el mismo hueco libre que este
      // bloque y lo propone, para poder enfocar la fila recién creada en el
      // mismo tick. _idLibre garantiza que no se pise una fila existente.
      var usados = {};
      db.prepare('SELECT id FROM mp_sve_plan_actividades WHERE programa_id = ?').all(res.programa.id)
        .forEach(function (r) { usados[r.id] = 1; });
      var n = 1;
      while (usados['act-' + n]) n++;
      var id = _idLibre(db, res.programa.id, payload.idOpcional || ('act-' + n), 'mp_sve_plan_actividades', 'act');

      var t = _ahora();
      var orden = db.prepare(
        'SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM mp_sve_plan_actividades WHERE programa_id = ?'
      ).get(res.programa.id).siguiente;
      db.prepare(
        'INSERT INTO mp_sve_plan_actividades (id, programa_id, empresa_id, fase, actividad, responsable, orden, creado_en, actualizado_en) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, res.programa.id, company.company_key, String(payload.fase), '', '', orden, t, t);

      // Las 12 filas en [0,0]: la actividad nace SIN programar para no entrar
      // al denominador del cumplimiento hasta que se marque AP.
      var insMes = db.prepare(
        'INSERT INTO mp_sve_plan_meses (actividad_id, programa_id, mes, ap, ae) VALUES (?, ?, ?, 0, 0)'
      );
      for (var i = 1; i <= 12; i++) insMes.run(id, res.programa.id, i);

      return _ok({ id: id, orden: orden });
    } catch (e) {
      console.error('[' + MOD + '][plan:actividad:crear]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('medprev:sve:plan:actividad:guardar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      if (!payload.actividadId) return _err('VALIDATION', 'actividadId requerido');

      var db = res.db;
      var sets = ['actualizado_en = ?'];
      var vals = [_ahora()];
      if (payload.actividad !== undefined) { sets.push('actividad = ?'); vals.push(String(payload.actividad || '')); }
      if (payload.responsable !== undefined) { sets.push('responsable = ?'); vals.push(String(payload.responsable || '')); }
      if (payload.fase !== undefined) { sets.push('fase = ?'); vals.push(String(payload.fase || '')); }
      vals.push(String(payload.actividadId), res.programa.id, company.company_key);
      var updAct = db.prepare(
        'UPDATE mp_sve_plan_actividades SET ' + sets.join(', ') + ' WHERE id = ? AND programa_id = ? AND empresa_id = ?'
      );
      var r = updAct.run.apply(updAct, vals);
      if (r.changes === 0) return _err('NOT_FOUND', 'Actividad no encontrada');
      return _ok({ actividadId: payload.actividadId });
    } catch (e) {
      console.error('[' + MOD + '][plan:actividad:guardar]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('medprev:sve:plan:actividad:eliminar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      if (!payload.actividadId) return _err('VALIDATION', 'actividadId requerido');

      var db = res.db;
      // Los 12 meses se van por ON DELETE CASCADE de la FK. Igual se borran
      // explícitamente: las FKs de SQLite NO están activas por defecto y
      // depender de que cada conexión las haya prendido es frágil.
      var del = db.transaction(function (p, emp) {
        db.prepare('DELETE FROM mp_sve_plan_meses WHERE actividad_id = ? AND programa_id = ?').run(String(payload.actividadId), p);
        return db.prepare(
          'DELETE FROM mp_sve_plan_actividades WHERE id = ? AND programa_id = ? AND empresa_id = ?'
        ).run(String(payload.actividadId), p, emp);
      });
      var r = del(res.programa.id, company.company_key);
      if (r.changes === 0) return _err('NOT_FOUND', 'Actividad no encontrada');
      return _ok({ eliminado: 1 });
    } catch (e) {
      console.error('[' + MOD + '][plan:actividad:eliminar]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('medprev:sve:plan:celda:guardar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      if (!payload.actividadId) return _err('VALIDATION', 'actividadId requerido');
      var mes = Number(payload.mes);
      if (!(mes >= 1 && mes <= 12)) return _err('VALIDATION', 'mes debe estar entre 1 y 12');

      var db = res.db;
      var existe = db.prepare(
        'SELECT id FROM mp_sve_plan_actividades WHERE id = ? AND programa_id = ? AND empresa_id = ?'
      ).get(String(payload.actividadId), res.programa.id, company.company_key);
      if (!existe) return _err('NOT_FOUND', 'Actividad no encontrada');

      // El detalle va a una fila aparte de la cabecera — el % de cumplimiento
      // NO se guarda, se calcula. Por eso el anillo y la fila TOTALES no pueden
      // discrepar: los dos leen el mismo detalle.
      db.prepare(
        'INSERT INTO mp_sve_plan_meses (actividad_id, programa_id, mes, ap, ae) VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT(programa_id, actividad_id, mes) DO UPDATE SET ap = excluded.ap, ae = excluded.ae'
      ).run(String(payload.actividadId), res.programa.id, mes, payload.ap ? 1 : 0, payload.ae ? 1 : 0);

      return _ok({ actividadId: payload.actividadId, mes: mes, ap: payload.ap ? 1 : 0, ae: payload.ae ? 1 : 0 });
    } catch (e) {
      console.error('[' + MOD + '][plan:celda:guardar]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── meta / indicadores / morbilidad / analisis (reemplazo del bloque) ──

  ipcMain.handle('medprev:sve:meta:guardar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      var db = res.db;
      db.prepare(
        'INSERT INTO mp_sve_meta (programa_id, empresa_id, meta_json, actualizado_en) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(programa_id) DO UPDATE SET meta_json = excluded.meta_json, actualizado_en = excluded.actualizado_en'
      ).run(res.programa.id, company.company_key, JSON.stringify(payload.meta || {}), _ahora());
      return _ok({ guardado: 1 });
    } catch (e) {
      console.error('[' + MOD + '][meta:guardar]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('medprev:sve:indicadores:guardar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      var db = res.db;
      var indicadores = payload.indicadores || {};
      var t = _ahora();

      db.transaction(function (p, emp) {
        db.prepare('DELETE FROM mp_sve_indicadores WHERE programa_id = ?').run(p);
        var insDef = db.prepare(
          'INSERT INTO mp_sve_indicadores (id, programa_id, empresa_id, clave, nombre, meta, formulacion, periodicidad, anios_json, medidas_json, extra_json, actualizado_en) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        var insVal = db.prepare(
          'INSERT INTO mp_sve_indicadores_valores (indicador_id, programa_id, anio, medida, valor) VALUES (?, ?, ?, ?, ?)'
        );
        Object.keys(indicadores).forEach(function (clave) {
          var ind = indicadores[clave] || {};
          var id = _nuevoId('msi');
          insDef.run(id, p, emp, clave, ind.nombre || clave, ind.meta || '', ind.formulacion || '', ind.periodicidad || '',
            JSON.stringify(_aniosDe(ind)), JSON.stringify(_medidasDe(ind)), _extraDe(ind), t);
          _medidasDe(ind).forEach(function (m) {
            if (!Array.isArray(ind[m])) return;
            ind[m].forEach(function (valor, i) {
              if (valor === null || valor === undefined) return;
              var anio = Array.isArray(ind.anios) ? ind.anios[i] : null;
              if (anio === null || anio === undefined) return;
              insVal.run(id, p, anio, m, Number(valor));
            });
          });
        });
      })(res.programa.id, company.company_key);

      return _ok({ indicadores: _leerIndicadores(db, res.programa.id) });
    } catch (e) {
      console.error('[' + MOD + '][indicadores:guardar]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('medprev:sve:morbilidad:guardar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      var db = res.db;
      var m = payload.morbilidad || {};
      var anios = Array.isArray(m.anios) ? m.anios : [];
      var filas = Array.isArray(m.filas) ? m.filas : [];

      db.transaction(function (p, emp) {
        db.prepare('DELETE FROM mp_sve_morbilidad WHERE programa_id = ?').run(p);
        var ins = db.prepare(
          'INSERT INTO mp_sve_morbilidad (programa_id, empresa_id, tipo, anio, casos, dias_it) VALUES (?, ?, ?, ?, ?, ?)'
        );
        filas.forEach(function (f) {
          anios.forEach(function (anio, i) {
            var casos = Array.isArray(f.casos) ? f.casos[i] : null;
            var dias = Array.isArray(f.diasIt) ? f.diasIt[i] : null;
            if (casos === null && dias === null) return;
            ins.run(p, emp, f.tipo || '', anio,
              casos === null || casos === undefined ? null : Number(casos),
              dias === null || dias === undefined ? null : Number(dias));
          });
        });
      })(res.programa.id, company.company_key);

      return _ok({ morbilidad: _leerMorbilidad(db, res.programa.id) });
    } catch (e) {
      console.error('[' + MOD + '][morbilidad:guardar]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('medprev:sve:analisis:guardar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      var db = res.db;
      var lista = Array.isArray(payload.analisis) ? payload.analisis : [];
      var t = _ahora();
      db.transaction(function (p, emp) {
        db.prepare('DELETE FROM mp_sve_analisis WHERE programa_id = ?').run(p);
        var ins = db.prepare(
          'INSERT INTO mp_sve_analisis (id, programa_id, empresa_id, periodo, hallazgos, propuestas, responsable, orden, actualizado_en) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        lista.forEach(function (a, i) {
          ins.run(_nuevoId('mso'), p, emp, a.periodo || '', a.hallazgos || '', a.propuestas || '', a.responsable || '', i, t);
        });
      })(res.programa.id, company.company_key);
      return _ok({ analisis: _leerAnalisis(db, res.programa.id) });
    } catch (e) {
      console.error('[' + MOD + '][analisis:guardar]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── migrar — vuelca el localStorage del prototipo a SQLite, UNA vez ──
  //
  // Idempotente por diseño: si el programa ya tiene contenido en la base, no
  // toca nada. Así se puede llamar en cada arranque sin riesgo de pisar lo
  // que el usuario ya capturó en SQLite. La respuesta dice si migró o qué
  // encontró, para que el store decida si limpia el localStorage.
  ipcMain.handle('medprev:sve:migrar', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      var res = _programaDe(company.company_key, payload && payload.programaId);
      if (res.error) return res.error;
      var db = res.db;
      var d = payload.datos || {};
      var p = res.programa.id;
      var emp = company.company_key;

      var yaHay = db.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ?').get(p).n +
        db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_actividades WHERE programa_id = ?').get(p).n;
      if (yaHay > 0) {
        return _ok({ migrado: false, motivo: 'la-base-ya-tiene-datos', registrosExistentes: yaHay });
      }

      var t = _ahora();
      var resumen = { casos: 0, actividades: 0, celdas: 0, indicadores: 0, morbilidad: 0, analisis: 0 };

      db.transaction(function () {
        // meta
        if (d.meta) {
          db.prepare(
            'INSERT INTO mp_sve_meta (programa_id, empresa_id, meta_json, actualizado_en) VALUES (?, ?, ?, ?) ' +
            'ON CONFLICT(programa_id) DO UPDATE SET meta_json = excluded.meta_json, actualizado_en = excluded.actualizado_en'
          ).run(p, emp, JSON.stringify(d.meta), t);
        }
        // plan
        if (Array.isArray(d.plan)) {
          var insAct = db.prepare(
            'INSERT INTO mp_sve_plan_actividades (id, programa_id, empresa_id, fase, actividad, responsable, orden, creado_en, actualizado_en) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );
          var insMes = db.prepare('INSERT INTO mp_sve_plan_meses (actividad_id, programa_id, mes, ap, ae) VALUES (?, ?, ?, ?, ?)');
          d.plan.forEach(function (a, i) {
            // El id del prototipo puede venir sin `id` (dataset viejo): se
            // genera uno estable para que la grilla y la base hablen igual.
            var id = a.id || ('act-' + (i + 1));
            insAct.run(id, p, emp, a.fase || 'planear', a.actividad || '', a.responsable || '', i, t, t);
            resumen.actividades++;
            for (var mi = 0; mi < 12; mi++) {
              var par = a.meses && a.meses[mi] ? a.meses[mi] : [0, 0];
              insMes.run(id, p, mi + 1, par[0] ? 1 : 0, par[1] ? 1 : 0);
              resumen.celdas++;
            }
          });
        }
        // casos
        if (Array.isArray(d.seguimientos)) {
          /* La lista de columnas se arma UNA vez, completa (base + los 31
             campos del caso), y el statement se prepara con ESA lista. Armar
             `cols2` por fila pero preparar con `cols` deja el statement con 8
             placeholders y 39 valores -> "Too many parameter values were
             provided" y toda la transacción se revierte. */
          var cols = ['id', 'programa_id', 'empresa_id', 'orden', 'eliminado_en', 'creado_en', 'actualizado_en', 'creado_por'];
          CASO_CAMPOS.forEach(function (f) { cols.push(_col(f)); });
          var insCaso = db.prepare(
            'INSERT OR REPLACE INTO mp_sve_casos (' + cols.join(', ') + ') VALUES (' + cols.map(function () { return '?'; }).join(', ') + ')'
          );
          d.seguimientos.forEach(function (c, i) {
            var vals2 = [String(c.id || _nuevoId('msc')), p, emp, i, null, t, t, null];
            CASO_CAMPOS.forEach(function (f) {
              vals2.push(c[f] === undefined || c[f] === null ? '' : c[f]);
            });
            insCaso.run.apply(insCaso, vals2);
            resumen.casos++;
          });
        }
        // indicadores
        if (d.indicadores && typeof d.indicadores === 'object') {
          var insDef = db.prepare(
            'INSERT INTO mp_sve_indicadores (id, programa_id, empresa_id, clave, nombre, meta, formulacion, periodicidad, anios_json, medidas_json, extra_json, actualizado_en) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );
          var insVal = db.prepare(
            'INSERT INTO mp_sve_indicadores_valores (indicador_id, programa_id, anio, medida, valor) VALUES (?, ?, ?, ?, ?)'
          );
          Object.keys(d.indicadores).forEach(function (clave) {
            var ind = d.indicadores[clave] || {};
            var id = _nuevoId('msi');
            insDef.run(id, p, emp, clave, ind.nombre || clave, ind.meta || '', ind.formulacion || '', ind.periodicidad || '',
              JSON.stringify(_aniosDe(ind)), JSON.stringify(_medidasDe(ind)), _extraDe(ind), t);
            resumen.indicadores++;
            _medidasDe(ind).forEach(function (m) {
              if (!Array.isArray(ind[m])) return;
              ind[m].forEach(function (valor, i) {
                if (valor === null || valor === undefined) return;
                var anio = Array.isArray(ind.anios) ? ind.anios[i] : null;
                if (anio === null || anio === undefined) return;
                insVal.run(id, p, anio, m, Number(valor));
              });
            });
          });
        }
        // morbilidad
        if (d.morbilidad && Array.isArray(d.morbilidad.filas)) {
          var insM = db.prepare(
            'INSERT INTO mp_sve_morbilidad (programa_id, empresa_id, tipo, anio, casos, dias_it) VALUES (?, ?, ?, ?, ?, ?)'
          );
          var aniosM = Array.isArray(d.morbilidad.anios) ? d.morbilidad.anios : [];
          d.morbilidad.filas.forEach(function (f) {
            aniosM.forEach(function (anio, i) {
              var casos = Array.isArray(f.casos) ? f.casos[i] : null;
              var dias = Array.isArray(f.diasIt) ? f.diasIt[i] : null;
              if (casos === null && dias === null) return;
              insM.run(p, emp, f.tipo || '', anio,
                casos === null || casos === undefined ? null : Number(casos),
                dias === null || dias === undefined ? null : Number(dias));
              resumen.morbilidad++;
            });
          });
        }
        // analisis
        if (Array.isArray(d.analisis)) {
          var insA = db.prepare(
            'INSERT INTO mp_sve_analisis (id, programa_id, empresa_id, periodo, hallazgos, propuestas, responsable, orden, actualizado_en) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );
          d.analisis.forEach(function (a, i) {
            insA.run(_nuevoId('mso'), p, emp, a.periodo || '', a.hallazgos || '', a.propuestas || '', a.responsable || '', i, t);
            resumen.analisis++;
          });
        }
      })();

      return _ok({ migrado: true, resumen: resumen });
    } catch (e) {
      // Este handler se loguea con STACK (a diferencia de los otros) porque
      // es una migración de datos que puede fallar sobre el dataset de un
      // cliente: sin saber en qué bloque reventó, el error es inaccionable.
      console.error('[' + MOD + '][migrar]', e.message, '\n', e.stack);
      return _err('INTERNAL', e.message);
    }
  });
}

module.exports = {
  registerMedprevSveDatosHandlers,
  SCHEMA_SQL: MP_SVE_SCHEMA_SQL,
  SCHEMA_ALTERS: MP_SVE_SCHEMA_ALTERS,
  MIGRATIONS_SQL: MP_SVE_MIGRATIONS_SQL,
  MIGRATION_IDS: MP_SVE_MIGRATION_IDS
};
