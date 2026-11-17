#!/usr/bin/env node
// scripts/limpiar-empresa-prueba-local.js
// 📦1090 · Borra COMPLETA, en la base local de la app, lo que dejó la empresa
// de prueba: los trabajadores de ensayo, sus firmas, los documentos firmados,
// el expediente, la identidad de la empresa, sus plantillas, sus carpetas y sus
// notificaciones. Y NO toca lo que no es de la empresa de prueba.
//
// EL PELIGRO REAL (medido el 17-nov-2026, la ronda 24):
//   `empresa_id` NO es «dueño de la fila»: es el sello de la empresa ACTIVA.
//   Cuando el owner configuró ASEPLUS como empresa activa, 209 empleados
//   REALES y 26 sedes REALES quedaron con `empresa_id = 'Aseplus'`. Un script
//   que borra «todo lo de la empresa de prueba» por `empresa_id` se lleva
//   209 empleados del cliente y 26 sedes. Por eso:
//     - los TRABAJADORES se borran por CÉDULA explícita (--cedulas), nunca
//       por empresa;
//     - las TABLAS DE LA EMPRESA (identidad, plantillas, carpetas,
//       notificaciones) sí se purgan por empresa, y son una lista EXPLÍCITA:
//       son tablas donde la fila ES de la empresa;
//     - toda tabla con `empresa_id` que NO esté en esa lista se toca
//       únicamente por los identificadores de los hijos, y el script verifica
//       al final que ninguna fila de otra empresa se movió.
//
// CÓMO SE CORRE
// -------------
//   # 0. CERRAR la app (K+AIR). Con la app abierta, el archivo se puede
//   #    sobrescribir al salir.
//   # 1. SIMULACIÓN (no toca nada):
//      node scripts/limpiar-empresa-prueba-local.js \
//        --empresa=Aseplus --cedulas=9999999999,1111111111,6666666666 \
//        --actor="Javier Robles Fontalvo" --motivo="Empresa de prueba: se retira del PC"
//   # 2. EJECUCIÓN (agrega --ejecutar).
//
// La base se resuelve por candidatos (--db para forzarla), el script DICE cuál
// usó y se niega en vez de crear una base vacía donde no es. Antes de la
// primera escritura hace un RESPALDO (VACUUM INTO) y al final verifica
// `integrity_check`, `foreign_key_check` y el re-inventario.

'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// Tablas donde la fila ES de la empresa (se purgan por empresa_id/company_key).
// Cada una con la columna que guarda la empresa. Si la tabla no existe, se
// salta: el script trabaja sobre el esquema real.
const TABLAS_DE_LA_EMPRESA = [
  { tabla: 'empresa_datos_firma', columna: 'empresa_id' },
  { tabla: 'empresa_representante_legal', columna: 'empresa_id' },
  { tabla: 'companies', columna: 'company_key' },
  { tabla: 'gh_templates', columna: 'empresa_id' },
  { tabla: 'gh_carpetas_categorias', columna: 'empresa_id' },
  { tabla: 'notificaciones', columna: 'company_key' }
];

// Columnas que, por convención, apuntan a un padre (aunque no tengan FK
// declarada). Son las que hay que mirar para no dejar huérfanos.
const COLUMNAS_PADRE = [
  'trabajador_id', 'id_trabajador', 'personal_id',
  'contratacion_id', 'id_contratacion',
  'documento_id', 'id_documento',
  'expediente_id', 'id_expediente',
  'categoria_id', 'id_categoria',
  'empleado_id'
];

const NOMBRES_EMPRESA = ['empresa_id', 'company_key'];

function error(msg) {
  process.stderr.write('ERROR: ' + msg + '\n');
}

function parseArgs(argv) {
  const opts = {
    empresa: null,
    cedulas: [],
    actor: null,
    motivo: null,
    ejecutar: false,
    db: null,
    userData: null,
    quiet: false
  };
  for (const raw of argv || []) {
    const a = String(raw);
    if (a === '--ejecutar') { opts.ejecutar = true; continue; }
    if (a === '--quiet') { opts.quiet = true; continue; }
    const eq = a.indexOf('=');
    if (eq === -1) continue;
    const k = a.slice(0, eq).replace(/^--/, '');
    const v = a.slice(eq + 1);
    if (k === 'cedulas') {
      opts.cedulas = v.split(',').map(s => s.trim()).filter(Boolean);
    } else if (k === 'empresa') {
      opts.empresa = v;
    } else if (k === 'actor') {
      opts.actor = v;
    } else if (k === 'motivo') {
      opts.motivo = v;
    } else if (k === 'db') {
      opts.db = v;
    } else if (k === 'user-data') {
      opts.userData = v;
    }
  }
  return opts;
}

function listarTablas(db) {
  return db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(r => r.name);
}

function columnasDe(db, tabla) {
  try {
    return db.prepare('PRAGMA table_info("' + tabla.replace(/"/g, '""') + '")').all();
  } catch (e) {
    return [];
  }
}

function tieneColumna(db, tabla, columna) {
  return columnasDe(db, tabla).some(c => c.name === columna);
}

function fksDe(db, tabla) {
  try {
    return db.prepare('PRAGMA foreign_key_list("' + tabla.replace(/"/g, '""') + '")').all();
  } catch (e) {
    return [];
  }
}

function contar(db, tabla, donde, params) {
  if (!tabla) return 0;
  try {
    const sql = 'SELECT COUNT(*) AS n FROM "' + tabla.replace(/"/g, '""') + '"'
      + (donde ? ' WHERE ' + donde : '');
    const r = db.prepare(sql).get(...(params || []));
    return r && r.n ? r.n : 0;
  } catch (e) {
    return 0;
  }
}

// Devuelve las CLAVES PRIMARIAS de las filas de `tabla` cuya columna
// `columna` tiene uno de los `valores`. Ojo: lo que devuelve es la clave
// primaria de la fila que coincide, NO el valor de la columna filtrada: si se
// devuelve el valor filtrado, el plan borra filas equivocadas (o ninguna).
function idsDe(db, tabla, columna, valores) {
  if (!valores.length) return [];
  try {
    const pk = columnaPk(db, tabla);
    const sql = 'SELECT DISTINCT "' + pk.replace(/"/g, '""') + '" AS v FROM "'
      + tabla.replace(/"/g, '""') + '" WHERE CAST("' + columna.replace(/"/g, '""')
      + '" AS TEXT) IN (' + valores.map(() => '?').join(',') + ')';
    // Los ids se comparan como TEXTO: el `CAST` del lado izquierdo vuelve
    // texto lo que hay en la base, y si se binds un INTEGER (una clave
    // primaria entera) la comparacion es INTEGER contra TEXT y no casa:
    // el plan saldria VACIO y no se borraria nada.
    return db.prepare(sql).all(...valores.map(v => String(v))).map(r => r.v);
  } catch (e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Resolver la base y el userData
// ---------------------------------------------------------------------------
function candidatasDb(userData) {
  const c = [];
  if (userData) c.push(path.join(userData, 'kair.db'));
  const appdata = process.env.APPDATA || (process.env.HOME ? path.join(process.env.HOME, '.config') : '');
  if (appdata) {
    c.push(path.join(appdata, 'sgsst-electron-app', 'kair.db'));
    c.push(path.join(appdata, 'K+AIR', 'kair.db'));
  }
  c.push(path.join(__dirname, '..', 'data', 'kair.db'));
  return c;
}

function resolverDb(opts) {
  if (opts.db) {
    if (!fs.existsSync(opts.db)) {
      return { error: 'La base indicada con --db no existe: ' + opts.db };
    }
    return { ruta: path.resolve(opts.db) };
  }
  for (const c of candidatasDb(opts.userData)) {
    if (fs.existsSync(c)) return { ruta: path.resolve(c) };
  }
  return {
    error: 'No se encontro la base local. Candidatas probadas:\n  - '
      + candidatasDb(opts.userData).join('\n  - ')
      + '\n  Use --db=<ruta> para decir cual es.'
  };
}

// ---------------------------------------------------------------------------
// Descubrir el esquema
// ---------------------------------------------------------------------------
function descubrirPersonal(db, tablas) {
  // La tabla de personal es la que tiene cédula y nombres, y ademas es el
  // destino de la FK `trabajador_id` de las tablas hijas.
  let candidatas = tablas.filter(t => {
    const cols = columnasDe(db, t).map(c => c.name);
    return cols.includes('cedula') && cols.includes('nombres') && cols.includes('id');
  });
  const REFERENCIADAS = new Set();
  for (const t of tablas) {
    for (const fk of fksDe(db, t)) REFERENCIADAS.add(fk.table);
  }
  const porFk = candidatas.filter(t => REFERENCIADAS.has(t));
  if (porFk.length === 1) return porFk[0];
  if (candidatas.length === 1) return candidatas[0];
  return candidatas.find(t => t === 'base_personal') || candidatas[0] || null;
}

// ---------------------------------------------------------------------------
// Armar el plan
// ---------------------------------------------------------------------------
function armarPlan(db, opts) {
  const tablas = listarTablas(db);
  const plan = {
    empresa: opts.empresa,
    tablas: [],          // { tabla, n, filas, ids }
    archivos: [],        // rutas absolutas
    guard: {},           // invariantes que se comprueban despues
    avisos: []
  };

  const personal = descubrirPersonal(db, tablas);
  plan.personal = personal;
  if (!personal) {
    plan.avisos.push('No se encontro la tabla de personal (con cedula y nombres).');
    return plan;
  }

  // 1. Los trabajadores de prueba: por CÉDULA, nunca por empresa.
  const marcCedulas = opts.cedulas.map(String);
  const _workers = db.prepare(
    'SELECT * FROM "' + personal.replace(/"/g, '""') + '" WHERE CAST(cedula AS TEXT) IN ('
    + marcCedulas.map(() => '?').join(',') + ')'
  ).all(...marcCedulas);
  const idsPersonal = _workers.map(w => w.id);
  plan.trabajadores = _workers.map(w => ({
    id: w.id,
    nombre: [w.nombres, w.apellidos].filter(Boolean).join(' '),
    cedula: w.cedula
  }));

  // 2. Sus contrataciones (por trabajador_id o por cédula).
  const tablaContrataciones = tablas.find(t => {
    if (t === personal) return false;
    const cols = columnasDe(db, t).map(c => c.name);
    return cols.includes('cedula') && cols.includes('nombres') && cols.includes('trabajador_id');
  }) || null;
  const idsContratacion = [];
  if (tablaContrataciones) {
    idsDe(db, tablaContrataciones, 'trabajador_id', idsPersonal).forEach(v => idsContratacion.push(v));
    idsDe(db, tablaContrataciones, 'cedula', marcCedulas).forEach(v => idsContratacion.push(v));
  }

  // 3. Los hijos: por FK declarada y por convencion del nombre de la columna.
  const hijosPorTabla = new Map();  // tabla -> Set(ids)
  const registrar = (t, id) => {
    if (id === null || id === undefined) return;
    if (!hijosPorTabla.has(t)) hijosPorTabla.set(t, new Set());
    hijosPorTabla.get(t).add(String(id));
  };
  const tablasAfectadas = new Set();

  // Los trabajadores de prueba y sus contrataciones son los que se borran:
  // se registran por su clave primaria, no por la columna que los filtro.
  idsPersonal.forEach(id => registrar(personal, id));
  idsContratacion.forEach(id => registrar(tablaContrataciones, id));
  tablasAfectadas.add(personal);
  if (tablaContrataciones) tablasAfectadas.add(tablaContrataciones);

  for (const t of tablas) {
    const cols = columnasDe(db, t);
    const colNames = cols.map(c => c.name);
    const fks = fksDe(db, t);
    const candidatos = [];

    for (const c of colNames) {
      // FK declarada hacia la tabla de personal o la de contrataciones
      for (const fk of fks) {
        if (fk.from !== c) continue;
        if (fk.table === personal && idsPersonal.length) {
          candidatos.push({ col: c, valores: idsPersonal });
        }
        if (tablaContrataciones && fk.table === tablaContrataciones && idsContratacion.length) {
          candidatos.push({ col: c, valores: idsContratacion });
        }
      }
      // Convencion del nombre
      if (COLUMNAS_PADRE.includes(c)) {
        if (c === 'trabajador_id' || c === 'id_trabajador' || c === 'personal_id' || c === 'empleado_id') {
          if (idsPersonal.length) candidatos.push({ col: c, valores: idsPersonal });
        } else if (c === 'contratacion_id' || c === 'id_contratacion') {
          if (idsContratacion.length) candidatos.push({ col: c, valores: idsContratacion });
        }
      }
    }

    for (const cand of candidatos) {
      const ids = idsDe(db, t, cand.col, cand.valores);
      if (!ids.length) continue;
      ids.forEach(id => registrar(t, id));
      tablasAfectadas.add(t);
      // Los hijos de los hijos: se resuelven en la vuelta siguiente.
      plan.hijos = plan.hijos || [];
      plan.hijos.push({ tabla: t, col: cand.col, ids });
    }
  }

  // 4. Las tablas DE LA EMPRESA (fila propia de la empresa).
  const tablasEmpresa = [];
  for (const def of TABLAS_DE_LA_EMPRESA) {
    if (!tablas.includes(def.tabla)) continue;
    if (!tieneColumna(db, def.tabla, def.columna)) continue;
    const ids = idsDe(db, def.tabla, def.columna, [opts.empresa]);
    if (!ids.length) continue;
    ids.forEach(id => registrar(def.tabla, id));
    tablasAfectadas.add(def.tabla);
    tablasEmpresa.push({ tabla: def.tabla, columna: def.columna, n: ids.length });
  }
  plan.tablasEmpresa = tablasEmpresa;

  // 5. Cerrar los nietos: repetir el paso 3 con los ids ya conocidos.
  //    (Los nietos de los hijos cuelgan por FK o por convencion; se resuelve
  //    con dos vueltas y luego se verifica con foreign_key_check.)
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const nuevos = [];
    for (const t of tablas) {
      const cols = columnasDe(db, t).map(c => c.name);
      const fks = fksDe(db, t);
      for (const c of cols) {
        let valores = null;
        for (const fk of fks) {
          if (fk.from !== c) continue;
          if (hijosPorTabla.has(fk.table)) valores = [...hijosPorTabla.get(fk.table)];
        }
        if (!valores && COLUMNAS_PADRE.includes(c)) {
          const padre = c.replace(/^id_/, '').replace(/_id$/, '');
          for (const [t2, set] of hijosPorTabla.entries()) {
            if (t2.toLowerCase().includes(padre.toLowerCase()) || padre.toLowerCase().includes(t2.toLowerCase().replace(/_/g, ''))) {
              valores = [...set];
            }
          }
        }
        if (!valores || !valores.length) continue;
        const ya = hijosPorTabla.get(t) || new Set();
        const ids = idsDe(db, t, c, valores).filter(id => !ya.has(String(id)));
        if (!ids.length) continue;
        ids.forEach(id => registrar(t, id));
        tablasAfectadas.add(t);
        nuevos.push({ tabla: t, col: c, ids });
      }
    }
    if (!nuevos.length) break;
    plan.hijos = (plan.hijos || []).concat(nuevos);
  }

  // 6. El plan, tabla por tabla, con los archivos que se van a borrar.
  for (const t of tablasAfectadas) {
    const ids = [...(hijosPorTabla.get(t) || [])];
    if (!ids.length) continue;
    const filas = db.prepare(
      'SELECT * FROM "' + t.replace(/"/g, '""') + '" WHERE CAST("' + (columnaPk(db, t)) + '" AS TEXT) IN ('
      + ids.map(() => '?').join(',') + ')'
    ).all(...ids.map(String));
    plan.tablas.push({ tabla: t, n: filas.length, filas: filas });
    if (tieneColumna(db, t, 'ruta_archivo')) {
      for (const f of filas) {
        if (f.ruta_archivo) plan.archivos.push(String(f.ruta_archivo));
      }
    }
  }

  // 7. Los invariantes: lo que NO se puede mover.
  plan.guard = {
    personalDeLaEmpresaQueQueda: contar(
      db, personal, 'CAST(empresa_id AS TEXT) = ? AND CAST(id AS TEXT) NOT IN ('
      + (idsPersonal.length ? idsPersonal.map(() => '?').join(',') : "''") + ')',
      [opts.empresa].concat(idsPersonal)
    ),
    personalDeOtrasEmpresas: contar(
      db, personal, 'empresa_id IS NULL OR CAST(empresa_id AS TEXT) <> ?', [opts.empresa]
    ),
    filasDeOtrasEmpresasPorTabla: {}
  };
  for (const t of tablas) {
    for (const col of NOMBRES_EMPRESA) {
      if (!tieneColumna(db, t, col)) continue;
      const n = contar(db, t, 'CAST("' + col + '" AS TEXT) IS NULL OR CAST("' + col + '" AS TEXT) <> ?', [opts.empresa]);
      if (n > 0) plan.guard.filasDeOtrasEmpresasPorTabla[t + '.' + col] = n;
    }
  }

  return plan;
}

function columnaPk(db, tabla) {
  const cols = columnasDe(db, tabla);
  if (cols.some(c => c.name === 'id')) return 'id';
  if (cols.length) return cols[0].name;
  return 'rowid';
}

// ---------------------------------------------------------------------------
// Ejecutar
// ---------------------------------------------------------------------------
function ejecutar(db, plan, opts) {
  const resultado = { borrados: 0, archivosBorrados: 0, tablas: {} };
  const userData = opts.userData
    ? path.resolve(opts.userData)
    : path.dirname(path.dirname(opts.dbResuelta || '')) || null;

  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    for (const item of plan.tablas) {
      const t = item.tabla;
      const ids = item.filas.map(f => String(f[columnaPk(db, t)]));
      if (!ids.length) continue;
      const sql = 'DELETE FROM "' + t.replace(/"/g, '""') + '" WHERE CAST("'
        + columnaPk(db, t) + '" AS TEXT) IN (' + ids.map(() => '?').join(',') + ')';
      const r = db.prepare(sql).run(...ids);
      const n = r && typeof r.changes === 'number' ? r.changes : 0;
      resultado.tablas[t] = n;
      resultado.borrados += n;
    }
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (e2) { /* ignore */ }
    throw e;
  }
  db.exec('PRAGMA foreign_keys = ON');

  // Archivos: solo dentro del arbol de la app.
  if (userData) {
    for (const f of plan.archivos) {
      const abs = path.resolve(f);
      if (!abs.toLowerCase().startsWith(userData.toLowerCase())) continue;
      try {
        if (fs.existsSync(abs)) {
          fs.unlinkSync(abs);
          resultado.archivosBorrados++;
        }
      } catch (e) { /* se reporta al final */ }
    }
    // Carpetas que quedaron vacias.
    for (const dir of dirsDeArchivos(plan.archivos, userData)) {
      try {
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
      } catch (e) { /* ignore */ }
    }
  }
  return resultado;
}

function dirsDeArchivos(archivos, userData) {
  const dirs = new Set();
  for (const f of archivos) {
    let d = path.dirname(path.resolve(f));
    while (d && d.toLowerCase().startsWith(userData.toLowerCase()) && d !== userData) {
      dirs.add(d);
      d = path.dirname(d);
    }
  }
  return [...dirs].sort((a, b) => b.length - a.length);
}

// ---------------------------------------------------------------------------
// Verificar
// ---------------------------------------------------------------------------
function verificar(db, plan, opts, antes) {
  const v = { ok: true, errores: [] };
  const personal = plan.personal;

  const quedan = opts.cedulas.length
    ? contar(db, personal, 'CAST(cedula AS TEXT) IN (' + opts.cedulas.map(() => '?').join(',') + ')', opts.cedulas)
    : 0;
  if (quedan !== 0) {
    v.ok = false;
    v.errores.push('Quedan ' + quedan + ' persona(s) de prueba en ' + personal);
  }

  for (const def of TABLAS_DE_LA_EMPRESA) {
    if (!listarTablas(db).includes(def.tabla)) continue;
    if (!tieneColumna(db, def.tabla, def.columna)) continue;
    const n = contar(db, def.tabla, 'CAST("' + def.columna + '" AS TEXT) = ?', [opts.empresa]);
    if (n !== 0) {
      v.ok = false;
      v.errores.push('Quedan ' + n + ' fila(s) de la empresa de prueba en ' + def.tabla);
    }
  }

  // El invariante que mas importa: los empleados reales de la empresa NO se
  // tocan. Si el numero cambio, el script borro de mas.
  const quedanReal = contar(
    db, personal, 'CAST(empresa_id AS TEXT) = ? AND CAST(id AS TEXT) NOT IN ('
    + (plan.trabajadores.length ? plan.trabajadores.map(t => '?').join(',') : "''") + ')',
    [opts.empresa].concat(plan.trabajadores.map(t => t.id))
  );
  if (quedanReal !== antes.guard.personalDeLaEmpresaQueQueda) {
    v.ok = false;
    v.errores.push(
      'SE BORRARON EMPLEADOS REALES: quedaban ' + antes.guard.personalDeLaEmpresaQueQueda
      + ' y ahora quedan ' + quedanReal
    );
  }

  for (const t of listarTablas(db)) {
    for (const col of NOMBRES_EMPRESA) {
      if (!tieneColumna(db, t, col)) continue;
      const clave = t + '.' + col;
      const antesN = antes.guard.filasDeOtrasEmpresasPorTabla[clave];
      if (antesN === undefined) continue;
      const ahoraN = contar(db, t, 'CAST("' + col + '" AS TEXT) IS NULL OR CAST("' + col + '" AS TEXT) <> ?', [opts.empresa]);
      if (ahoraN !== antesN) {
        v.ok = false;
        v.errores.push(
          'Se movieron filas de OTRAS empresas en ' + clave + ': eran ' + antesN + ' y ahora son ' + ahoraN
        );
      }
    }
  }

  try {
    const ic = db.prepare('PRAGMA integrity_check').get();
    const valor = ic && Object.values(ic)[0];
    if (valor !== 'ok') {
      v.ok = false;
      v.errores.push('integrity_check: ' + valor);
    }
  } catch (e) {
    v.ok = false;
    v.errores.push('integrity_check fallo: ' + e.message);
  }
  try {
    const fk = db.prepare('PRAGMA foreign_key_check').all();
    if (fk.length) {
      v.ok = false;
      v.errores.push('foreign_key_check: ' + fk.length + ' fila(s) huerfana(s)');
    }
  } catch (e) {
    v.ok = false;
    v.errores.push('foreign_key_check fallo: ' + e.message);
  }

  return v;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
function main(argv) {
  const opts = parseArgs(argv);

  if (!opts.empresa) { error('Falta --empresa (la empresa de prueba, por su company_key)'); return 2; }
  if (!opts.cedulas.length) { error('Falta --cedulas (las cedulas de los trabajadores de prueba)'); return 2; }
  if (!opts.actor) { error('Falta --actor (quien hace el cambio)'); return 2; }
  if (!opts.motivo) { error('Falta --motivo (por que se hace el cambio)'); return 2; }

  const resuelta = resolverDb(opts);
  if (resuelta.error) { error(resuelta.error); return 2; }
  opts.dbResuelta = resuelta.ruta;

  let db;
  try {
    db = new DatabaseSync(resuelta.ruta);
  } catch (e) {
    error('No se pudo abrir la base ' + resuelta.ruta + ': ' + e.message);
    return 2;
  }

  try {
    const plan = armarPlan(db, opts);

    if (!opts.quiet) {
      process.stdout.write('\n=== LIMPIEZA DE EMPRESA DE PRUEBA LOCAL ('
        + (opts.ejecutar ? 'EJECUCION' : 'SIMULACION') + ') ===\n');
      process.stdout.write('Base: ' + resuelta.ruta + '\n');
      process.stdout.write('Empresa de prueba: ' + opts.empresa + '\n');
      process.stdout.write('Actor: ' + opts.actor + '\n');
      process.stdout.write('Motivo: ' + opts.motivo + '\n');
      process.stdout.write('\n-- Trabajadores de prueba (por cedula): ' + plan.trabajadores.length + '\n');
      plan.trabajadores.forEach(t => {
        process.stdout.write('   ' + t.nombre + ' (' + t.cedula + ') [' + t.id + ']\n');
      });
      process.stdout.write('\n-- Filas a borrar: ' + plan.tablas.reduce((a, b) => a + b.n, 0)
        + ' en ' + plan.tablas.length + ' tabla(s)\n');
      plan.tablas.forEach(t => process.stdout.write('   ' + t.tabla.padEnd(32) + t.n + '\n'));
      process.stdout.write('\n-- Archivos a borrar: ' + plan.archivos.length + '\n');
      plan.archivos.forEach(f => process.stdout.write('   ' + f + '\n'));
      process.stdout.write('\n-- NO se tocan: ' + plan.guard.personalDeLaEmpresaQueQueda
        + ' persona(s) real(es) de la misma empresa y ' + plan.guard.personalDeOtrasEmpresas
        + ' persona(s) de otras empresas\n');
      if (!opts.ejecutar) {
        process.stdout.write('\nSIN --ejecutar no se toca nada.\n');
      }
    }

    if (!opts.ejecutar) return 0;

    // Respaldo antes de la primera escritura.
    const dirBackups = path.join(path.dirname(resuelta.ruta), 'backups');
    try { fs.mkdirSync(dirBackups, { recursive: true }); } catch (e) { /* se avisa */ }
    const sello = new Date().toISOString().replace(/[:.]/g, '-');
    const respaldo = path.join(dirBackups,
      'kair-antes-limpieza-' + opts.empresa + '-' + sello + '.sqlite');
    try {
      db.exec("VACUUM INTO '" + respaldo.replace(/'/g, "''") + "'");
      if (!opts.quiet) process.stdout.write('\nRespaldo: ' + respaldo + '\n');
    } catch (e) {
      error('No se pudo hacer el respaldo: ' + e.message);
      return 3;
    }

    const resultado = ejecutar(db, plan, opts);
    const v = verificar(db, plan, opts, plan);

    if (!opts.quiet) {
      process.stdout.write('\nFilas borradas: ' + resultado.borrados + '\n');
      Object.keys(resultado.tablas).forEach(t => {
        process.stdout.write('   ' + t.padEnd(32) + resultado.tablas[t] + '\n');
      });
      process.stdout.write('Archivos borrados: ' + resultado.archivosBorrados + '\n');
      process.stdout.write('\nVerificacion: ' + (v.ok ? 'OK' : 'FALLO') + '\n');
      v.errores.forEach(e => process.stdout.write('   ' + e + '\n'));
      process.stdout.write('\n');
    }

    if (!v.ok) return 4;
    return 0;
  } catch (e) {
    error(e && e.stack ? e.stack : String(e));
    return 3;
  } finally {
    try { db.close(); } catch (e) { /* ignore */ }
  }
}

module.exports = {
  main,
  parseArgs,
  armarPlan,
  ejecutar,
  verificar,
  TABLAS_DE_LA_EMPRESA,
  resolverDb
};

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
