#!/usr/bin/env node
/**
 * scripts/panel-firmas.js
 *
 * PANEL DE SOLO LECTURA del proceso de firma: por empresa y por firma.
 *
 * POR QUE EXISTE
 * --------------
 * Con el servicio ya en produccion (22-oct-2026), la pregunta de "como va el
 * proceso de firma" se respondia con `sqlite3` a mano: un comando por tabla,
 * copiado y pegado. Con nueve firmas ya habia que ejecutar cuatro consultas
 * para saber si algo seguia vivo, que tokens quedaban y cuando se habia movido
 * algo por ultima vez.
 *
 * Este script junta esa lectura en una sola pantalla y la vuelve navegable:
 *
 *   1. TABLERO GENERAL  - todas las empresas, su resumen y las firmas que NO
 *                         estan en estado terminal (las que siguen vivas).
 *   2. PANEL DE EMPRESA- el detalle de una empresa (lo que ve el firmante).
 *   3. DETALLE DE FIRMA- tokens, sesion, consentimiento y la TRAZA completa
 *                         de eventos (`gh_firma_eventos`, append-only).
 *
 * QUE NO HACE (y por que importa)
 * --------------------------------
 * - NO ESCRIBE NADA. La base se abre en modo `readonly: true` (better-sqlite3).
 *   Si el motor no deja abrir en solo lectura (una base en WAL a la que no se
 *   puede crear el `-shm`), cae a una conexion normal AVISANDO: el script solo
 *   hace SELECT, pero el candado es real.
 * - NO MUESTRA SECRETOS. El `token_hash` es la credencial del enlace: nunca
 *   se imprime, solo su estado (vivo / vencido / revocado). El numero del
 *   trabajador sale como el pseudonimo recortado. Los hashes salen truncados.
 * - NO IMPRIME LA `metadata` cruda de los eventos: trae datos del cliente que
 *   el propio servicio filtra en su API interna (`routes/internal-audit.js`).
 *   Aqui sale solo el codigo del evento, quien lo hizo y cuando.
 * - NO TOCA LAS TABLAS QUE NO NECESITA: cada vista pide lo suyo.
 *
 * USO
 * ---
 *   node scripts/panel-firmas.js                       # tablero general (interactivo)
 *   node scripts/panel-firmas.js --empresa=900829731   # panel de esa empresa
 *   node scripts/panel-firmas.js --firma=6             # detalle de esa firma
 *   node scripts/panel-firmas.js --json                # salida para maquinas
 *   node scripts/panel-firmas.js --cada=10             # refresco cada 10s
 *   node scripts/panel-firmas.js --abiertas            # solo firmas no terminales
 *   node scripts/panel-firmas.js --ayuda
 *
 * Si no hay terminal interactivo (o se pide `--json`, `--empresa` o
 * `--firma`), el script imprime UNA vez y sale: el mismo panel sirve para
 * pipelines, para pegar en un ticket o para comparar dos momentos.
 *
 * Exit codes:
 *   0 = panel mostrado
 *   1 = error de ejecucion (base no encontrada, etc.)
 *   2 = argumentos invalidos
 */
'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const RUTA_DB_DEFECTO = path.resolve(SERVICE_ROOT, 'data', 'firma.sqlite');

// Estados en los que la solicitud ya no acepta mas acciones del firmante.
// Mismo criterio que `services/publicFlow.js` (la linea de estados
// terminales) y que el CHECK de la tabla.
const ESTADOS_TERMINALES = [
  'SIGNED', 'DUAL_FIRMADO', 'REJECTED', 'REVOKED', 'CANCELLED', 'EXPIRED',
];

const ANCHO = 78;
const SEP = '='.repeat(ANCHO);

// =============================================================================
// Texto
// =============================================================================

/**
 * Rellena a la derecha con espacios (o a la izquierda con `der`).
 * @param {*} valor
 * @param {number} n
 * @param {boolean} [der]
 * @returns {string}
 */
function pad(valor, n, der) {
  const s = valor === null || valor === undefined ? '' : String(valor);
  if (s.length >= n) return s.slice(0, n);
  const relleno = ' '.repeat(n - s.length);
  return der ? relleno + s : s + relleno;
}

/**
 * Recorta un valor largo y le pone puntos suspensivos.
 * @param {*} valor
 * @param {number} n - longitud maxima
 * @returns {string}
 */
function recortar(valor, n) {
  const s = valor === null || valor === undefined ? '' : String(valor);
  if (!s) return '-';
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

/**
 * Fecha en formato corto para las tablas: '2026-10-21 11:08Z'. La fecha
 * cruda ('2026-10-21T11:08:07.110Z') no cabe en una columna y se cortaba
 * por la mitad, que es peor que no verla.
 * @param {string|null} fecha
 * @returns {string}
 */
function fechaCorta(fecha) {
  if (!fecha) return '-';
  const s = String(fecha);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? m[1] + ' ' + m[2] + 'Z' : recortar(s, 18);
}

/**
 * Fecha y hora sin milisegundos: '2026-10-21 23:10:20'.
 * @param {string|null} fecha
 * @returns {string}
 */
function fechaHora(fecha) {
  if (!fecha) return '-';
  const s = String(fecha);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] + ' ' + m[2] : recortar(s, 19);
}

/**
 * Enmascara una IP dejando los dos primeros octetos (o los dos primeros
 * grupos en IPv6). La IP es evidencia de "desde donde", no un secreto: pero
 * tampoco necesita ir completa a una pantalla que se puede pegar en un
 * ticket.
 * @param {string|null} ip
 * @returns {string}
 */
function enmascararIp(ip) {
  if (!ip) return '-';
  const s = String(ip);
  if (s.includes(':')) {
    const grupos = s.split(':');
    return grupos.slice(0, 2).join(':') + ':x:x:x:x';
  }
  const octetos = s.split('.');
  if (octetos.length !== 4) return recortar(s, 12);
  return octetos[0] + '.' + octetos[1] + '.x.x';
}

/**
 * Recorta el pseudonimo del trabajador (psn1_...). Es un HMAC, no un
 * documento, pero tampoco hace falta entero para correlacionar filas.
 * @param {string|null} valor
 * @param {number} [n]
 * @returns {string}
 */
function enmascararPseudonimo(valor, n) {
  if (!valor) return '-';
  return recortar(valor, n || 16);
}

/**
 * ¿La fecha ya paso? Compara en ISO (los timestamps se guardan en ISO 8601
 * con Z), no con el `datetime('now')` de SQLite: mezclar formatos en una
 * comparacion de strings da resultados que dependen del separador.
 * @param {string|null} fecha
 * @param {Date} [ahora]
 * @returns {boolean}
 */
function yaVencio(fecha, ahora) {
  if (!fecha) return false;
  const referencia = (ahora || new Date()).toISOString();
  return String(fecha) < referencia;
}

/**
 * Un token esta vivo si no fue revocado y no vencio.
 * @param {object} token
 * @param {Date} [ahora]
 * @returns {boolean}
 */
function tokenVivo(token, ahora) {
  if (!token) return false;
  if (token.revocado_at) return false;
  if (token.expira_en && yaVencio(token.expira_en, ahora)) return false;
  return true;
}

// =============================================================================
// Argumentos
// =============================================================================

/**
 * Lee los argumentos de la linea de comandos.
 * @param {string[]} argv
 * @returns {object} opciones
 * @throws {Error} si un argumento no existe o esta incompleto.
 */
function parseArgs(argv) {
  const opts = {
    empresa: null,
    firma: null,
    json: false,
    cada: 5,
    abiertas: false,
    ayuda: false,
    db: null,
  };

  for (const arg of argv || []) {
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--abiertas') {
      opts.abiertas = true;
    } else if (arg === '--ayuda' || arg === '-h' || arg === '--help') {
      opts.ayuda = true;
    } else if (arg.startsWith('--empresa=')) {
      opts.empresa = arg.slice('--empresa='.length).trim();
    } else if (arg.startsWith('--firma=')) {
      const n = Number(arg.slice('--firma='.length).trim());
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error('--firma= necesita el id numerico de la firma (ej: --firma=6)');
      }
      opts.firma = n;
    } else if (arg.startsWith('--cada=')) {
      const n = Number(arg.slice('--cada='.length).trim());
      if (!Number.isInteger(n) || n < 1 || n > 3600) {
        throw new Error('--cada= necesita un numero de segundos entre 1 y 3600');
      }
      opts.cada = n;
    } else if (arg.startsWith('--db=')) {
      opts.db = arg.slice('--db='.length).trim();
    } else {
      throw new Error('Argumento desconocido: ' + arg);
    }
  }

  return opts;
}

/**
 * Texto de ayuda.
 * @returns {string}
 */
function textoAyuda() {
  return [
    'Panel de firmas K+AIR (solo lectura)',
    '',
    '  node scripts/panel-firmas.js                     tablero general, interactivo',
    '  node scripts/panel-firmas.js --empresa=NIT       panel de una empresa',
    '  node scripts/panel-firmas.js --firma=ID          detalle de una firma',
    '  node scripts/panel-firmas.js --json              salida para maquinas',
    '  node scripts/panel-firmas.js --cada=N            refresco cada N segundos',
    '  node scripts/panel-firmas.js --abiertas          solo firmas no terminales',
    '  node scripts/panel-firmas.js --db=RUTA          otra base (tests)',
    '',
    '  Teclas: flechas mover · Enter ver · f ver la firma · r refrescar',
    '          Esc volver · ? ayuda · q salir',
    '',
    '  Las tres vistas: TABLERO GENERAL -> PANEL DE EMPRESA -> DETALLE DE FIRMA.',
    '  Esc y Enter devuelven a la vista anterior.',
  ].join('\n');
}

// =============================================================================
// Base de datos
// =============================================================================

/**
 * Resuelve la ruta de la base igual que `src/config.js`: relativa al
 * directorio del Servicio, no al CWD.
 * @param {string|null} override
 * @returns {string}
 */
function resolverRutaDb(override) {
  const crudo = override || process.env.DB_PATH || './data/firma.sqlite';
  if (path.isAbsolute(crudo)) return crudo;
  return path.resolve(SERVICE_ROOT, crudo);
}

/**
 * Abre la base en modo SOLO LECTURA.
 *
 * Si el motor no deja (una base en WAL a la que no se le puede crear el
 * `-shm`), cae a una conexion normal y lo dice: el script solo hace SELECT,
 * pero el que quiera el candado sabe que la base era de lectura.
 *
 * @param {string} ruta
 * @returns {{db: object, soloLectura: boolean, aviso: string|null}}
 */
function abrirDb(ruta) {
  if (!require('fs').existsSync(ruta)) {
    throw new Error('No existe la base de datos en ' + ruta
      + ' (se espera DB_PATH o data/firma.sqlite)');
  }
  try {
    const db = new Database(ruta, { readonly: true, fileMustExist: true });
    return { db, soloLectura: true, aviso: null };
  } catch (e) {
    const db = new Database(ruta, { fileMustExist: true });
    return {
      db,
      soloLectura: false,
      aviso: 'No se pudo abrir la base en solo lectura (' + e.message + '). '
        + 'Se abre en modo normal: el script solo hace SELECT, pero la base '
        + 'no esta bloqueada contra escrituras.',
    };
  }
}

/**
 * Nombres de las columnas de una tabla.
 * @param {object} db
 * @param {string} tabla
 * @returns {Set<string>}
 */
function columnasDe(db, tabla) {
  try {
    const filas = db.prepare('PRAGMA table_info(' + tabla + ')').all();
    return new Set(filas.map((f) => f.name));
  } catch (e) {
    return new Set();
  }
}

/**
 * ¿Existe la tabla?
 * @param {object} db
 * @param {string} tabla
 * @returns {boolean}
 */
function tablaExiste(db, tabla) {
  try {
    return db.prepare(
      "SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table' AND name = ?"
    ).get(tabla).n > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Arma un SELECT con las columnas que EXISTAN en la tabla. Asi el script no
 * se rompe si la base es de una version anterior a una migracion.
 * @param {object} db
 * @param {string} tabla
 * @param {string[]} deseadas
 * @param {string} [donde]
 * @param {object[]} [params]
 * @returns {object[]}
 */
function leerCon(db, tabla, deseadas, donde, params) {
  if (!tablaExiste(db, tabla)) return [];
  const existentes = columnasDe(db, tabla);
  const cols = deseadas.filter((c) => existentes.has(c));
  if (!cols.length) return [];
  let sql = 'SELECT ' + cols.join(', ') + ' FROM ' + tabla;
  if (donde) sql += ' WHERE ' + donde;
  return db.prepare(sql).all.apply(db.prepare(sql), params || []);
}

// =============================================================================
// Lectura de datos
// =============================================================================

/**
 * Lee TODOS los tokens (son pocos) y los indexa por firma. Se hace en JS y
 * no en SQL para no comparar fechas en dos formatos distintos: los tokens
 * guardan ISO 8601 con Z y `datetime('now')` devuelve 'YYYY-MM-DD HH:MM:SS'.
 *
 * @param {object} db
 * @returns {Map<number, object[]>}
 */
function leerTokensPorFirma(db) {
  const porFirma = new Map();
  const tokens = leerCon(db, 'gh_firma_tokens', [
    'id', 'firma_id', 'emision', 'emitido_at', 'expira_en', 'revocado_at',
    'revocado_por', 'motivo_revocacion', 'origen',
  ]);
  for (const t of tokens) {
    if (!porFirma.has(t.firma_id)) porFirma.set(t.firma_id, []);
    porFirma.get(t.firma_id).push(t);
  }
  return porFirma;
}

/**
 * Estado de un token en palabras: VIVO / VENCIDO / REVOCADO.
 * @param {object} token
 * @param {Date} [ahora]
 * @returns {string}
 */
function estadoToken(token, ahora) {
  if (!token) return '-';
  if (token.revocado_at) return 'REVOCADO';
  if (token.expira_en && yaVencio(token.expira_en, ahora)) return 'VENCIDO';
  return 'VIVO';
}

/**
 * Lee las empresas registradas.
 * @param {object} db
 * @returns {object[]}
 */
function leerEmpresas(db) {
  return leerCon(db, 'gh_firma_empresas', [
    'id_empresa', 'razon_social', 'nit', 'activo', 'anexo_encargo_firmado_at',
    'plazo_retencion', 'plazo_retencion_dias', 'canal_pqrs', 'canal_incidentes',
    'politica_datos_url', 'conservacion_por_deber_legal', 'norma_conservacion',
    'created_at', 'updated_at',
  ], null, []).sort((a, b) => {
    const x = String(a.razon_social || '').localeCompare(String(b.razon_social || ''));
    return x !== 0 ? x : String(a.id_empresa).localeCompare(String(b.id_empresa));
  });
}

/**
 * Lee las firmas con su conteo de tokens, sesiones y eventos.
 * @param {object} db
 * @param {object} [filtro] - { empresa, abiertas, ahora }
 * @returns {object[]}
 */
function leerFirmas(db, filtro) {
  const f = filtro || {};
  const ahora = f.ahora || new Date();
  const firmas = leerCon(db, 'gh_firmas_electronicas', [
    'id', 'id_solicitud', 'id_empresa', 'estado', 'fecha_creacion', 'tipo_firma',
    'agreement_version', 'agreement_hash', 'hold_legal', 'consent_id',
    'id_constancia', 'identificacion_tipo', 'identificacion_numero_hash',
    'identificacion_coincidio', 'categoria_retencion', 'fecha_conservacion',
    'tipo_firmante', 'requiere_firma_empresa', 'parent_id_solicitud',
  ], null, []);

  const tokensPorFirma = leerTokensPorFirma(db);
  const sesiones = new Set(
    leerCon(db, 'gh_firma_sesiones', ['firma_id'], null, []).map((s) => s.firma_id)
  );
  const eventos = new Map();
  for (const e of leerCon(db, 'gh_firma_eventos', ['firma_id'], null, [])) {
    eventos.set(e.firma_id, (eventos.get(e.firma_id) || 0) + 1);
  }

  let salida = firmas.map((x) => {
    const tokens = tokensPorFirma.get(x.id) || [];
    const vivos = tokens.filter((t) => tokenVivo(t, ahora)).length;
    return {
      id: x.id,
      id_solicitud: x.id_solicitud,
      id_empresa: x.id_empresa,
      estado: x.estado,
      fecha_creacion: x.fecha_creacion,
      tipo_firma: x.tipo_firma,
      agreement_version: x.agreement_version,
      agreement_hash: x.agreement_hash,
      hold_legal: x.hold_legal,
      consent_id: x.consent_id,
      id_constancia: x.id_constancia,
      identificacion_tipo: x.identificacion_tipo,
      identificacion_numero_hash: x.identificacion_numero_hash,
      identificacion_coincidio: x.identificacion_coincidio,
      categoria_retencion: x.categoria_retencion,
      fecha_conservacion: x.fecha_conservacion,
      tipo_firmante: x.tipo_firmante,
      requiere_firma_empresa: x.requiere_firma_empresa,
      parent_id_solicitud: x.parent_id_solicitud,
      tokens: tokens.length,
      tokens_vivos: vivos,
      tokens_vencidos: tokens.filter((t) => estadoToken(t, ahora) === 'VENCIDO').length,
      tokens_revocados: tokens.filter((t) => estadoToken(t, ahora) === 'REVOCADO').length,
      sesion: sesiones.has(x.id),
      eventos: eventos.get(x.id) || 0,
      terminal: ESTADOS_TERMINALES.includes(String(x.estado)),
    };
  });

  if (f.empresa) {
    salida = salida.filter((x) => String(x.id_empresa) === String(f.empresa));
  }
  if (f.abiertas) {
    salida = salida.filter((x) => !x.terminal);
  }
  return salida.sort((a, b) => a.id - b.id);
}

/**
 * Conteos globales de la base.
 * @param {object} db
 * @param {object[]} firmas
 * @returns {object}
 */
function leerResumenGlobal(db, firmas) {
  const cuenta = (sql, tabla) => (tablaExiste(db, tabla)
    ? db.prepare(sql).get().n
    : 0);
  const consentimientos = leerCon(db, 'gh_consentimientos_firma', ['estado'], null, []);
  const porEstado = {};
  for (const c of consentimientos) {
    porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
  }
  const versiones = leerCon(db, 'gh_firma_acuerdo_versiones', [
    'version', 'texto_hash', 'activa', 'fecha_creacion',
  ], null, []);

  return {
    empresas: leerEmpresas(db).length,
    firmas: firmas.length,
    firmas_por_estado: firmas.reduce((acc, f) => {
      acc[f.estado] = (acc[f.estado] || 0) + 1;
      return acc;
    }, {}),
    firmas_en_curso: firmas.filter((f) => !f.terminal).length,
    tokens: cuenta('SELECT COUNT(*) n FROM gh_firma_tokens', 'gh_firma_tokens'),
    tokens_vivos: firmas.reduce((n, f) => n + f.tokens_vivos, 0),
    tokens_vencidos: firmas.reduce((n, f) => n + f.tokens_vencidos, 0),
    tokens_revocados: firmas.reduce((n, f) => n + f.tokens_revocados, 0),
    sesiones: cuenta('SELECT COUNT(*) n FROM gh_firma_sesiones', 'gh_firma_sesiones'),
    eventos: cuenta('SELECT COUNT(*) n FROM gh_firma_eventos', 'gh_firma_eventos'),
    consentimientos: consentimientos.length,
    consentimientos_por_estado: porEstado,
    versiones: versiones.length,
    version_activa: versiones.find((v) => Number(v.activa) === 1) || null,
  };
}

/**
 * El detalle completo de una firma: la fila, sus tokens, su sesion, su
 * consentimiento y su traza de eventos.
 * @param {object} db
 * @param {number} idFirma
 * @param {Date} [ahora]
 * @returns {object|null}
 */
function leerDetalleFirma(db, idFirma, ahora) {
  const momento = ahora || new Date();
  const firma = leerCon(db, 'gh_firmas_electronicas', [
    'id', 'id_solicitud', 'id_empresa', 'estado', 'fecha_creacion', 'tipo_firma',
    'agreement_version', 'agreement_hash', 'document_hash_original',
    'document_hash_firmado', 'evidence_hash', 'hold_legal', 'motivo_hold',
    'consent_id', 'id_constancia', 'identificacion_tipo',
    'identificacion_numero_hash', 'identificacion_coincidio',
    'tipo_identificacion', 'tipo_firmante', 'requiere_firma_empresa',
    'parent_id_solicitud', 'categoria_retencion', 'regla_retencion',
    'fecha_conservacion', 'fecha_terminacion', 'plazo_retencion_aplicable',
    'pdf_original_path', 'pdf_firmado_path', 'constancia_path',
    'datos_sensibles', 'correo_otp',
  ], 'id = ?', [idFirma])[0];

  if (!firma) return null;

  const tokens = leerCon(db, 'gh_firma_tokens', [
    'id', 'firma_id', 'emision', 'emitido_at', 'expira_en', 'revocado_at',
    'revocado_por', 'motivo_revocacion', 'origen',
  ], 'firma_id = ? ORDER BY emision', [idFirma]);

  const sesion = leerCon(db, 'gh_firma_sesiones', [
    'id', 'estado_sesion', 'iniciado_en', 'ultimo_cambio_en', 'cambios_estado',
    'ip_actual', 'user_agent_actual',
  ], 'firma_id = ?', [idFirma])[0] || null;

  // El consentimiento se busca por `consent_id` (la llave que pone el
  // servicio). Si la fila no lo trae, se busca por `id_solicitud`: el
  // consentimiento guarda a que solicitud pertenece (migracion 024).
  const consent = (firma.consent_id
    ? leerCon(db, 'gh_consentimientos_firma', [
      'id', 'id_trabajador', 'id_empresa', 'version_acuerdo', 'fecha_aceptacion',
      'hash_texto_acuerdo', 'estado', 'id_solicitud', 'rol_firmante',
      'manifestacion_aceptada', 'created_at',
    ], 'id = ?', [firma.consent_id])[0]
    : null)
    || leerCon(db, 'gh_consentimientos_firma', [
      'id', 'id_trabajador', 'id_empresa', 'version_acuerdo', 'fecha_aceptacion',
      'hash_texto_acuerdo', 'estado', 'id_solicitud', 'rol_firmante',
      'manifestacion_aceptada', 'created_at',
    ], 'id_solicitud = ? ORDER BY id DESC LIMIT 1', [firma.id_solicitud])[0]
    || null;

  const eventos = leerCon(db, 'gh_firma_eventos', [
    'id', 'evento', 'fecha_hora', 'id_actor', 'ip', 'user_agent',
  ], 'firma_id = ? ORDER BY fecha_hora ASC, id ASC', [idFirma]);

  return {
    firma: Object.assign({}, firma, {
      terminal: ESTADOS_TERMINALES.includes(String(firma.estado)),
    }),
    tokens: tokens.map((t) => Object.assign({}, t, { estado: estadoToken(t, momento) })),
    sesion,
    consent,
    eventos,
    empresa: leerCon(db, 'gh_firma_empresas', [
      'id_empresa', 'razon_social', 'nit', 'activo', 'anexo_encargo_firmado_at',
      'plazo_retencion', 'plazo_retencion_dias', 'canal_pqrs',
      'politica_datos_url', 'conservacion_por_deber_legal', 'norma_conservacion',
    ], 'id_empresa = ?', [firma.id_empresa])[0] || null,
    version_activa: leerCon(db, 'gh_firma_acuerdo_versiones', [
      'version', 'texto_hash', 'activa',
    ], 'activa = 1 LIMIT 1')[0] || null,
  };
}

// =============================================================================
// Dibujo
// =============================================================================

/**
 * Tabla simple: recibe cabeceras y filas y devuelve las lineas.
 * @param {string[]} cabeceras
 * @param {string[][]} filas
 * @param {number[]} anchos
 * @returns {string[]}
 */
function tabla(cabeceras, filas, anchos) {
  const lineas = [];
  const fmt = (celdas, alinear) => celdas.map((c, i) => {
    const ancho = anchos[i] || 10;
    return alinear && alinear[i] === 'der'
      ? pad(c, ancho, true)
      : pad(c, ancho);
  }).join(' ');
  lineas.push(fmt(cabeceras, cabeceras.map(() => 'izq')));
  lineas.push(anchos.map((a) => '-'.repeat(a)).join(' '));
  for (const f of filas) lineas.push(fmt(f, f.__alinear || []));
  return lineas;
}

/**
 * TABLERO GENERAL: todas las empresas y las firmas que siguen vivas.
 * @param {object} datos - { empresas, firmas, resumen, ahora }
 * @returns {string}
 */
function renderGeneral(datos) {
  const L = [];
  const ahora = datos.ahora || new Date();
  L.push(SEP);
  L.push(' K+AIR · PANEL GENERAL DE FIRMA · ' + ahora.toISOString().replace('T', ' ').slice(0, 19) + 'Z');
  L.push(SEP);
  L.push('');

  const r = datos.resumen;
  const global = [
    'firmas=' + r.firmas,
    'eventos=' + r.eventos,
    'tokens=' + r.tokens,
    'vivos=' + r.tokens_vivos,
    'sesiones=' + r.sesiones,
    'consentimientos=' + r.consentimientos,
  ];
  L.push(' EMPRESAS (' + r.empresas + ')                              GLOBAL:  ' + global.join('  '));
  L.push('');

  const filas = datos.empresas.map((e, indice) => {
    const susFirmas = datos.firmas.filter((f) => String(f.id_empresa) === String(e.id_empresa));
    const porEstado = {};
    for (const f of susFirmas) porEstado[f.estado] = (porEstado[f.estado] || 0) + 1;
    const vivos = susFirmas.reduce((n, f) => n + f.tokens_vivos, 0);
    const eventos = susFirmas.reduce((n, f) => n + f.eventos, 0);
    return [
      indice === datos.selEmpresa ? '>' : ' ',
      String(e.id_empresa),
      recortar(e.razon_social, 26),
      Number(e.activo) === 1 ? 'si' : 'no',
      String(susFirmas.length),
      String(porEstado.SIGNED || 0),
      String(susFirmas.filter((f) => !f.terminal).length),
      String(susFirmas.reduce((n, f) => n + f.tokens, 0)),
      String(vivos),
      String(eventos),
    ];
  });
  L.push('  ' + tabla(
    ['', 'EMPRESA', 'RAZON SOCIAL', 'ACTIVA', 'FIRMAS', 'FIRMAD', 'CURSO', 'TOK', 'VIVOS', 'EVENTOS'],
    filas,
    [1, 12, 26, 6, 6, 6, 5, 3, 5, 7]
  ).join('\n  '));
  L.push('');

  const enCurso = datos.firmas.filter((f) => !f.terminal);
  L.push(' FIRMAS EN CURSO (' + enCurso.length + ')   [las que NO estan en estado terminal]');
  if (!enCurso.length) {
    L.push('   (ninguna: no hay solicitudes abiertas)');
  } else {
    const filas2 = enCurso.map((f) => [
      String(f.id),
      String(f.id_empresa),
      f.id_solicitud,
      f.estado,
      fechaCorta(f.fecha_creacion),
      String(f.tokens),
      f.tokens_vivos > 0 ? 'si' : 'no',
      f.sesion ? 'si' : 'no',
      f.hold_legal ? 'si' : 'no',
    ]);
    L.push('  ' + tabla(
      ['id', 'EMPRESA', 'ID SOLICITUD', 'ESTADO', 'CREADA', 'TOK', 'VIVO', 'ABRIO', 'HOLD'],
      filas2,
      [4, 12, 18, 12, 18, 3, 4, 5, 4]
    ).join('\n  '));
  }
  L.push('');
  L.push(' [flechas] empresa   [Enter] ver la empresa   [f] ver la firma');
  L.push(' [r] refrescar       [?] ayuda                [q] salir');
  L.push(SEP);
  return L.join('\n');
}

/**
 * PANEL DE EMPRESA: lo que se le muestra al firmante, mas el estado.
 * @param {object} datos - { empresa, firmas, resumen, ahora }
 * @returns {string}
 */
function renderEmpresa(datos) {
  const L = [];
  const e = datos.empresa;
  const r = datos.resumen;
  L.push(SEP);
  L.push(' PANEL DE EMPRESA · ' + e.id_empresa + ' · ' + (e.razon_social || '(sin razón social)'));
  L.push(SEP);
  L.push('');
  L.push(' EMPRESA');
  L.push('   anexo de encargo     ' + (e.anexo_encargo_firmado_at
    ? 'firmado ' + e.anexo_encargo_firmado_at
    : 'NO firmado'));
  L.push('   plazo de retencion   ' + (e.plazo_retencion
    ? e.plazo_retencion
    : (e.plazo_retencion_dias ? e.plazo_retencion_dias + ' dias' : '(sin plazo declarado)')));
  if (e.conservacion_por_deber_legal) {
    L.push('   deber legal          si' + (e.norma_conservacion ? ' (' + e.norma_conservacion + ')' : ''));
  }
  L.push('   canal de PQRS        ' + (e.canal_pqrs || '(sin canal)'));
  L.push('   politica de datos    ' + (e.politica_datos_url || '(sin URL publicada)'));
  L.push('   estado               ' + (Number(e.activo) === 1 ? 'activa' : 'inactiva'));
  L.push('');

  const porEstado = r.firmas_por_estado || {};
  const lineaEstado = Object.keys(porEstado).sort()
    .map((k) => k + '=' + porEstado[k]).join('   ');
  L.push(' RESUMEN');
  L.push('   firmas=' + r.firmas + '   ' + lineaEstado);
  L.push('   tokens=' + r.tokens + '  vivos=' + r.tokens_vivos
    + '   vencidos=' + r.tokens_vencidos + '   revocados=' + r.tokens_revocados);
  L.push('   sesiones=' + r.sesiones + '   eventos=' + r.eventos
    + '   consentimientos=' + r.consentimientos);
  if (r.version_activa) {
    L.push('   acuerdo vigente  ' + r.version_activa.version
      + '  hash=' + recortar(r.version_activa.texto_hash, 12));
  }
  L.push('');

  L.push(' FIRMAS');
  if (!datos.firmas.length) {
    L.push('   (ninguna)');
  } else {
    const filas = datos.firmas.map((f, indice) => [
      indice === datos.selFirma ? '>' : ' ',
      String(f.id),
      f.id_solicitud,
      f.estado,
      fechaCorta(f.fecha_creacion),
      String(f.tokens),
      f.tokens_vivos > 0 ? 'si' : 'no',
      f.sesion ? 'si' : 'no',
      f.hold_legal ? 'si' : 'no',
    ]);
    L.push('  ' + tabla(
      ['', 'id', 'ID SOLICITUD', 'ESTADO', 'CREADA', 'TOK', 'VIVO', 'ABRIO', 'HOLD'],
      filas,
      [1, 4, 18, 12, 18, 3, 4, 5, 4]
    ).join('\n  '));
  }
  L.push('');
  L.push(' [flechas] firma   [Enter/f] ver el detalle   [Esc] volver   [q] salir');
  L.push(SEP);
  return L.join('\n');
}

/**
 * DETALLE DE FIRMA: estado, tokens, sesion, consentimiento y traza.
 * @param {object} datos - { firma, tokens, sesion, consent, eventos, empresa }
 * @returns {string}
 */
function renderFirma(datos) {
  const L = [];
  const f = datos.firma;
  L.push(SEP);
  L.push(' FIRMA ' + f.id + ' · ' + f.id_solicitud + ' · '
    + (datos.empresa ? (datos.empresa.razon_social || '') : ''));
  L.push(SEP);
  L.push('');
  L.push(' ESTADO');
  L.push('   estado            ' + f.estado + (f.terminal ? '   (terminal)' : '   (en curso)'));
  L.push('   creada            ' + (f.fecha_creacion || '-'));
  L.push('   tipo de firma     ' + (f.tipo_firma || '-')
    + (f.tipo_firmante ? '   firmante=' + f.tipo_firmante : ''));
  L.push('   acuerdo           ' + (f.agreement_version || '-')
    + '   hash=' + recortar(f.agreement_hash, 12));
  if (datos.version_activa) {
    L.push('   vigente ahora     ' + datos.version_activa.version
      + '   hash=' + recortar(datos.version_activa.texto_hash, 12)
      + (recortar(f.agreement_hash, 12) === recortar(datos.version_activa.texto_hash, 12)
        ? '   (coincide)' : '   (NO coincide)'));
  }
  L.push('   identificacion    ' + (f.identificacion_tipo || f.tipo_identificacion || '-')
    + '   hash=' + enmascararPseudonimo(f.identificacion_numero_hash, 16)
    + '   coincidio=' + (f.identificacion_coincidio === null || f.identificacion_coincidio === undefined
      ? '-' : (Number(f.identificacion_coincidio) ? 'si' : 'no')));
  L.push('   documento         original=' + recortar(f.document_hash_original, 12)
    + '   firmado=' + recortar(f.document_hash_firmado, 12));
  L.push('   constancia        ' + (f.id_constancia || '(sin constancia)')
    + (f.constancia_path ? '   ' + recortar(f.constancia_path, 44) : ''));
  L.push('   conservacion      ' + (f.categoria_retencion || '-')
    + (f.fecha_conservacion ? '   hasta ' + f.fecha_conservacion : ''));
  L.push('   hold legal        ' + (Number(f.hold_legal) ? 'si' : 'no')
    + (f.motivo_hold ? '   (' + f.motivo_hold + ')' : ''));
  L.push('');

  L.push(' TOKENS');
  if (!datos.tokens.length) {
    L.push('   (ninguno)');
  } else {
    for (const t of datos.tokens) {
      L.push('   #' + t.emision + '  ' + pad(t.origen || '-', 8)
        + '  emitido=' + (t.emitido_at || '-')
        + '  expira=' + (t.expira_en || '(no expira)')
        + '  ' + t.estado
        + (t.revocado_at ? '  (' + t.revocado_at + (t.motivo_revocacion ? ': ' + t.motivo_revocacion : '') + ')' : ''));
    }
    L.push('   (la rotacion NO extiende el plazo: el enlace sigue con la ventana original)');
  }
  L.push('');

  L.push(' SESION');
  if (!datos.sesion) {
    L.push('   (nadie ha abierto el enlace de esta firma)');
  } else {
    L.push('   estado=' + datos.sesion.estado_sesion
      + '   iniciada=' + datos.sesion.iniciado_en
      + '   ultimo cambio=' + datos.sesion.ultimo_cambio_en);
    L.push('   ip=' + enmascararIp(datos.sesion.ip_actual)
      + '   agente=' + recortar(datos.sesion.user_agent_actual, 40));
  }
  L.push('');

  L.push(' CONSENTIMIENTO');
  if (!datos.consent) {
    L.push('   (esta firma no tiene consentimiento asociado)');
  } else {
    const c = datos.consent;
    L.push('   id=' + c.id + '   trabajador=' + enmascararPseudonimo(c.id_trabajador, 20)
      + '   rol=' + (c.rol_firmante || '-'));
    L.push('   acuerdo=' + (c.version_acuerdo || '-') + '   estado=' + (c.estado || '-')
      + '   aceptado=' + (c.fecha_aceptacion || '-'));
    L.push('   hash del texto aceptado=' + recortar(c.hash_texto_acuerdo, 12));
  }
  L.push('');

  L.push(' TRAZA (gh_firma_eventos, append-only)');
  if (!datos.eventos.length) {
    L.push('   (sin eventos)');
  } else {
    for (const e of datos.eventos) {
      L.push('   ' + pad(fechaHora(e.fecha_hora), 20)
        + '  ' + pad(e.evento, 26)
        + '  ' + pad(e.id_actor || '-', 12)
        + '  ' + enmascararIp(e.ip));
    }
  }
  L.push('');
  L.push(' [Esc] volver   [r] refrescar   [q] salir');
  L.push(SEP);
  return L.join('\n');
}

/**
 * Version JSON de los mismos datos (para pipelines).
 * @param {object} datos
 * @returns {string}
 */
function renderJson(datos) {
  return JSON.stringify(datos, null, 2);
}

// =============================================================================
// Modo interactivo
// =============================================================================

const ANSI = {
  limpiar: '\x1b[2J\x1b[3J\x1b[H',
  ocultarCursor: '\x1b[?25l',
  mostrarCursor: '\x1b[?25h',
};

/**
 * SECUENCIAS de escape que se translates a un nombre de tecla.
 */
const SECUENCIAS = {
  '\x1b[A': 'up', '\x1b[B': 'down', '\x1b[C': 'right', '\x1b[D': 'left',
  '\x1bOA': 'up', '\x1bOB': 'down', '\x1bOC': 'right', '\x1bOD': 'left',
  '\x1b[H': 'home', '\x1b[F': 'end', '\x1b[3~': 'delete',
  '\x1b[5~': 'pageup', '\x1b[6~': 'pagedown',
};

const CLAVES_SECUENCIA = Object.keys(SECUENCIAS);
const MS_ESC_SOLA = 50;

/**
 * LECTOR DE TECLAS PROPIO.
 *
 * POR QUE NO `readline.emitKeypressEvents`: con el parser de Node, una tecla
 * ESC SOLA no emite NINGUN evento `keypress` (el parser queda esperando a ver
 * si lo que viene despues es una secuencia de escape). Verificado en Node
 * v26 de esta maquina:
 *
 *   ESC sola                  -> NINGUN keypress
 *   ESC ESC                   -> NINGUN keypress
 *   flecha arriba (ESC [ A)   -> ch=undefined name=up
 *
 * O sea: la tecla que sirve para "volver" era INALCANZABLE, y el panel se
 * quedaba quieto. Por eso el parser se descarta y los bytes se decodifican
 * aqui: una ESC que no llega seguida de nada (tras 50 ms) es ESC; una ESC
 * seguida de '[' u 'O' es una secuencia (flechas, teclas F).
 *
 * @param {function(string, string|null)} onTecla - recibe (nombre, caracter)
 * @returns {{onData: function(Buffer), destroy: function()}}
 */
function crearLectorTeclado(onTecla) {
  let pendiente = '';
  let timerEsc = null;

  function limpiarTimer() {
    if (timerEsc) {
      clearTimeout(timerEsc);
      timerEsc = null;
    }
  }

  function esPrefijoDeSecuencia(texto) {
    return CLAVES_SECUENCIA.some((k) => k.length > texto.length && k.startsWith(texto));
  }

  function decodificar() {
    while (pendiente.length) {
      const c = pendiente[0];

      if (c === '\x1b') {
        const secuencia = CLAVES_SECUENCIA.find((k) => pendiente.startsWith(k));
        if (secuencia) {
          pendiente = pendiente.slice(secuencia.length);
          onTecla(SECUENCIAS[secuencia], null);
          continue;
        }
        if (pendiente.length === 1) {
          // ESC sola todavia: si no llega mas en MS_ESC_SOLA, es ESC.
          limpiarTimer();
          timerEsc = setTimeout(() => {
            timerEsc = null;
            pendiente = '';
            onTecla('escape', '\x1b');
          }, MS_ESC_SOLA);
          return;
        }
        if (esPrefijoDeSecuencia(pendiente)) {
          // Secuencia a medio llegar: esperamos el resto.
          return;
        }
        // ESC + caracter suelto (alt+tecla): no se usa.
        pendiente = pendiente.slice(2);
        continue;
      }

      if (c === '\r' || c === '\n') {
        pendiente = pendiente.slice(1);
        onTecla('return', c);
        continue;
      }
      if (c === '\t') {
        pendiente = pendiente.slice(1);
        onTecla('tab', c);
        continue;
      }
      if (c === '\x7f' || c === '\b') {
        pendiente = pendiente.slice(1);
        onTecla('backspace', c);
        continue;
      }
      if (c === '\x03') {
        pendiente = pendiente.slice(1);
        onTecla('ctrl-c', c);
        continue;
      }
      if (c < ' ') {
        pendiente = pendiente.slice(1);
        continue;
      }
      pendiente = pendiente.slice(1);
      onTecla(c, c);
    }
  }

  return {
    onData(chunk) {
      limpiarTimer();
      pendiente += chunk.toString('utf8');
      decodificar();
    },
    destroy() {
      limpiarTimer();
    },
  };
}

/**
 * Aplica una tecla al estado del panel. PURE: no dibuja, no lee la base.
 *
 * Vive aparte del bucle interactivo justamente para poder probarlo: la
 * navegacion (que tecla abre que, y que tecla vuelve) es lo que mas se
 * rompe cuando se toca el script.
 *
 * @param {object} estado - { vista, selEmpresa, selFirma, ayuda }
 * @param {string} nombre - nombre de la tecla
 * @param {object} ctx - { hayEmpresas, hayFirmas, maxEmpresas, maxFirmas }
 * @returns {{salir: boolean, redibujar: boolean}}
 */
function aplicarTecla(estado, nombre, ctx) {
  const c = ctx || {};

  if (nombre === 'q' || nombre === 'ctrl-c') {
    return { salir: true, redibujar: false };
  }
  if (nombre === '?') {
    estado.ayuda = !estado.ayuda;
    return { salir: false, redibujar: true };
  }
  if (nombre === 'r') {
    return { salir: false, redibujar: true, refrescar: true };
  }
  if (nombre === 'escape' || nombre === 'backspace') {
    if (estado.ayuda) {
      estado.ayuda = false;
    } else if (estado.vista === 'firma') {
      estado.vista = 'empresa';
    } else if (estado.vista === 'empresa') {
      estado.vista = 'general';
    } else {
      // En el tablero general no hay a donde volver: ESC no hace nada.
      return { salir: false, redibujar: false };
    }
    return { salir: false, redibujar: true };
  }
  if (nombre === 'up' || nombre === 'k') {
    if (estado.vista === 'general') {
      estado.selEmpresa = Math.max(0, estado.selEmpresa - 1);
    } else if (estado.vista === 'empresa') {
      estado.selFirma = Math.max(0, estado.selFirma - 1);
    } else {
      estado.vista = 'empresa';
    }
    return { salir: false, redibujar: true };
  }
  if (nombre === 'down' || nombre === 'j') {
    if (estado.vista === 'general') {
      estado.selEmpresa = Math.min(Math.max(0, (c.maxEmpresas || 1) - 1), estado.selEmpresa + 1);
    } else if (estado.vista === 'empresa') {
      estado.selFirma = Math.min(Math.max(0, (c.maxFirmas || 1) - 1), estado.selFirma + 1);
    } else {
      estado.vista = 'empresa';
    }
    return { salir: false, redibujar: true };
  }
  if (nombre === 'return' || nombre === 'f') {
    if (estado.ayuda) {
      estado.ayuda = false;
      return { salir: false, redibujar: true };
    }
    if (estado.vista === 'general') {
      if (!c.hayEmpresas) return { salir: false, redibujar: false };
      estado.vista = 'empresa';
      estado.selFirma = 0;
      return { salir: false, redibujar: true };
    }
    if (estado.vista === 'empresa') {
      if (!c.hayFirmas) return { salir: false, redibujar: false };
      estado.selFirma = Math.min(estado.selFirma, Math.max(0, (c.maxFirmas || 1) - 1));
      estado.vista = 'firma';
      return { salir: false, redibujar: true };
    }
    // En el detalle de la firma, Enter vuelve a la empresa.
    estado.vista = 'empresa';
    return { salir: false, redibujar: true };
  }

  return { salir: false, redibujar: false };
}

/**
 * Arranca el tablero interactivo.
 *
 * Tres vistas: general -> empresa -> firma. Las flechas mueven la seleccion,
 * Enter abre, Esc vuelve, `r` refresca, `q` sale.
 *
 * @param {object} db
 * @param {object} opts
 * @returns {Promise<void>}
 */
function ejecutarInteractivo(db, opts) {
  const raw = process.stdin.isTTY;
  if (raw) process.stdin.setRawMode(true);

  const estado = {
    vista: 'general',
    selEmpresa: 0,
    selFirma: 0,
    ayuda: false,
    salida: false,
  };

  const empresas = leerEmpresas(db);
  const firmas = leerFirmas(db, {});
  const resumen = leerResumenGlobal(db, firmas);

  function firmasDeEmpresa(indice) {
    const e = empresas[indice];
    if (!e) return [];
    return firmas.filter((f) => String(f.id_empresa) === String(e.id_empresa));
  }

  function pintar() {
    let texto;
    if (estado.ayuda) {
      texto = SEP + '\n AYUDA\n' + SEP + '\n'
        + textoAyuda().split('\n').map((l) => '  ' + l).join('\n') + '\n' + SEP;
    } else if (estado.vista === 'general') {
      texto = renderGeneral({
        empresas, firmas, resumen, ahora: new Date(), selEmpresa: estado.selEmpresa,
      });
    } else if (estado.vista === 'empresa') {
      const e = empresas[estado.selEmpresa];
      const susFirmas = firmasDeEmpresa(estado.selEmpresa);
      texto = renderEmpresa({
        empresa: e,
        firmas: susFirmas,
        resumen: {
          firmas: susFirmas.length,
          firmas_por_estado: susFirmas.reduce((acc, f) => {
            acc[f.estado] = (acc[f.estado] || 0) + 1;
            return acc;
          }, {}),
          tokens: susFirmas.reduce((n, f) => n + f.tokens, 0),
          tokens_vivos: susFirmas.reduce((n, f) => n + f.tokens_vivos, 0),
          tokens_vencidos: susFirmas.reduce((n, f) => n + f.tokens_vencidos, 0),
          tokens_revocados: susFirmas.reduce((n, f) => n + f.tokens_revocados, 0),
          sesiones: susFirmas.filter((f) => f.sesion).length,
          eventos: susFirmas.reduce((n, f) => n + f.eventos, 0),
          consentimientos: 0,
          version_activa: resumen.version_activa,
        },
        ahora: new Date(),
        selFirma: estado.selFirma,
      });
    } else {
      const susFirmas = firmasDeEmpresa(estado.selEmpresa);
      const firma = susFirmas[Math.min(estado.selFirma, susFirmas.length - 1)];
      const detalle = firma ? leerDetalleFirma(db, firma.id) : null;
      texto = detalle ? renderFirma(detalle) : SEP + '\n (sin firmas)\n' + SEP;
    }
    process.stdout.write(ANSI.limpiar + texto + '\n');
  }

  function refrescar() {
    empresas.length = 0;
    empresas.push(...leerEmpresas(db));
    firmas.length = 0;
    firmas.push(...leerFirmas(db, {}));
    Object.assign(resumen, leerResumenGlobal(db, firmas));
    if (estado.selEmpresa >= empresas.length) estado.selEmpresa = Math.max(0, empresas.length - 1);
    pintar();
  }

  const temporizador = setInterval(() => {
    if (!estado.salida) refrescar();
  }, opts.cada * 1000);

  return new Promise((resolve) => {
    const lector = crearLectorTeclado((nombre) => {
      const susFirmas = firmasDeEmpresa(estado.selEmpresa);
      const r = aplicarTecla(estado, nombre, {
        hayEmpresas: empresas.length > 0,
        hayFirmas: susFirmas.length > 0,
        maxEmpresas: empresas.length,
        maxFirmas: susFirmas.length,
      });
      if (r.salir) {
        terminar();
        return;
      }
      if (r.refrescar) {
        refrescar();
        return;
      }
      if (r.redibujar) pintar();
    });

    function alRecibirDatos(chunk) {
      lector.onData(chunk);
    }

    function terminar() {
      estado.salida = true;
      clearInterval(temporizador);
      lector.destroy();
      if (raw) process.stdin.setRawMode(false);
      process.stdout.write(ANSI.mostrarCursor);
      process.stdin.removeListener('data', alRecibirDatos);
      resolve();
    }

    process.stdin.on('data', alRecibirDatos);
    process.stdout.write(ANSI.ocultarCursor);
    pintar();
  });
}

// =============================================================================
// Main
// =============================================================================

/**
 * Arma el objeto de datos segun la vista pedida.
 * @param {object} db
 * @param {object} opts
 * @returns {object}
 */
function armarDatos(db, opts) {
  const ahora = new Date();
  const empresas = leerEmpresas(db);
  const firmas = leerFirmas(db, { empresa: opts.empresa, abiertas: opts.abiertas, ahora });
  const resumen = leerResumenGlobal(db, firmas);

  if (opts.firma) {
    const detalle = leerDetalleFirma(db, opts.firma, ahora);
    if (!detalle) {
      throw new Error('No existe la firma ' + opts.firma);
    }
    return { vista: 'firma', detalle, ahora };
  }

  if (opts.empresa) {
    const empresa = empresas.find((e) => String(e.id_empresa) === String(opts.empresa));
    if (!empresa) {
      throw new Error('No existe la empresa ' + opts.empresa + ' en la base');
    }
    return { vista: 'empresa', empresa, empresas, firmas, resumen, ahora };
  }

  return { vista: 'general', empresas, firmas, resumen, ahora };
}

/**
 * Punto de entrada.
 * @param {string[]} argv
 * @returns {Promise<number>} codigo de salida
 */
async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(e.message);
    console.error('');
    console.error(textoAyuda());
    return 2;
  }

  if (opts.ayuda) {
    console.log(textoAyuda());
    return 0;
  }

  let abierta;
  try {
    abierta = abrirDb(resolverRutaDb(opts.db));
  } catch (e) {
    console.error('ERROR:', e.message);
    return 1;
  }

  const db = abierta.db;
  try {
    if (abierta.aviso) {
      console.error('AVISO: ' + abierta.aviso);
    }

    const datos = armarDatos(db, opts);

    if (opts.json) {
      console.log(renderJson(datos));
      return 0;
    }

    if (datos.vista === 'firma') {
      console.log(renderFirma(datos.detalle));
      return 0;
    }
    if (datos.vista === 'empresa') {
      console.log(renderEmpresa({
        empresa: datos.empresa,
        firmas: datos.firmas,
        resumen: datos.resumen,
        ahora: datos.ahora,
      }));
      return 0;
    }

    // Vista general: interactiva si hay terminal, una pasada si no la hay.
    const hayTerminal = process.stdin.isTTY && process.stdout.isTTY;
    if (hayTerminal) {
      await ejecutarInteractivo(db, opts);
      return 0;
    }
    console.log(renderGeneral(datos));
    console.log('');
    console.log('  (sin terminal interactiva: una sola pasada. Usa --empresa= o --firma= para el detalle.)');
    return 0;
  } catch (e) {
    console.error('ERROR:', e && e.message ? e.message : e);
    return 1;
  } finally {
    try {
      db.close();
    } catch (e) { /* ya cerrada */ }
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => { process.exit(code); },
    (err) => {
      console.error('ERROR:', err && err.stack ? err.stack : err);
      process.exit(1);
    }
  );
}

module.exports = {
  main,
  parseArgs,
  resolverRutaDb,
  abrirDb,
  leerEmpresas,
  leerFirmas,
  leerResumenGlobal,
  leerDetalleFirma,
  leerTokensPorFirma,
  estadoToken,
  tokenVivo,
  yaVencio,
  enmascararIp,
  enmascararPseudonimo,
  fechaCorta,
  fechaHora,
  recortar,
  renderGeneral,
  renderEmpresa,
  renderFirma,
  renderJson,
  textoAyuda,
  crearLectorTeclado,
  aplicarTecla,
  ESTADOS_TERMINALES,
};
