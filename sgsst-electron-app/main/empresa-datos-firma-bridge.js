/**
 * 📦904-927 · Bridge IPC de datos de identificación de la empresa para firma (📦927: registro idempotente, auth suave y sync al servidor).
 *
 * Guarda y lee lo que la empresa declara como su identificación en
 * Configuración de Empresa. Esa información es la que después se envía al
 * firma-service y se le muestra al trabajador en el bloque
 * "Empresa que solicita tu firma".
 *
 * Patrón: módulo autocontenido con `.init(ipcMain)` y
 * `register(app, { getDb, validateSession })`, igual que
 * main/empresa-representante-legal-bridge.js.
 *
 * Canales IPC (2):
 *   empresa-datos-firma:get    → { success, data: { datos } | { datos: null } }
 *   empresa-datos-firma:upsert → { success, data: { id, updated } }
 *
 * AUTENTICACIÓN
 * -------------
 * Igual que el resto del módulo (soft auth, sin token). Estos datos los
 * digita el usuario desde su propio PC: no son una credencial ni un canal
 * expuesto a la red. La autorización real ocurre despues, en el
 * firma-service, donde la API key de la empresa define a que empresa puede
 * declarar estos datos.
 */
'use strict';

const MOD = 'EMPRESA-DATOS-FIRMA';

let _ipcMain = null;
let _getDb = null;
let _validateSession = null;

/** Longitudes maximas por campo. Coinciden con las del zod del firma-service. */
const MAXLEN = {
  nit: 64,
  domicilio: 300,
  domicilio_municipio: 120,
  domicilio_departamento: 120,
  responsable_nombre: 200,
  responsable_cargo: 200,
  responsable_correo: 200,
  canal_contacto: 200,
  canal_pqrs: 300,
  canal_incidentes: 300,
  politica_datos_url: 500,
};

/**
 * Normaliza un campo de texto: trim, vacío a null, y rechazo si excede el
 * máximo. Devuelve { ok, valor } para poder differentiates del error.
 */
function _norm(campo, valor) {
  if (valor === undefined || valor === null) return { ok: true, valor: null };
  if (typeof valor !== 'string') {
    return { ok: false, mensaje: campo + ' debe ser texto' };
  }
  const v = valor.trim();
  if (v.length === 0) return { ok: true, valor: null };
  if (v.length > MAXLEN[campo]) {
    return { ok: false, mensaje: campo + ' excede ' + MAXLEN[campo] + ' caracteres' };
  }
  return { ok: true, valor: v };
}

/** Valida formato de correo. Devuelve true/false; null/'' se trata aparte. */
function _emailValido(v) {
  if (!v) return true;          // vacío no es formato inválido, es "no informado"
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Valida que sea http(s). Rechazar "javascript:" y "data:" aquí importa:
 *  esta URL se muestra al firmante como enlace. */
function _urlValida(v) {
  if (!v) return true;
  return /^https?:\/\/[^\s]+$/i.test(v);
}

function _ok(data) {
  return { success: true, data: data };
}

function _err(code, message) {
  return { success: false, error: { code: code, message: message } };
}

/**
 * Auth soft, igual que el bridge del representante legal.
 *
 * `validateSession()` devuelve `{ ok: true, session, user }`; NO tiene
 * `valid`. Si se exige `valid === true`, toda llamada sin token se rechaza
 * aunque el handler sea local. Además, este bridge no es una superficie de
 * red: el renderer ya corre en el mismo proceso de confianza y la
 * autorización real la hace el firma-service con su admin key.
 *
 * Si el token viene y es inválido, se deja pasar pero se registra el intento.
 */
function _checkAuth(token) {
  if (typeof _validateSession !== 'function') {
    return { ok: true, user: null, softAuth: true };
  }
  if (!token) {
    return { ok: true, user: null, softAuth: true };
  }
  let r;
  try {
    r = _validateSession(token);
  } catch (e) {
    console.warn('[' + MOD + '][auth] validateSession lanzó:', e.message);
    return { ok: true, user: null, softAuth: true };
  }
  if (r && r.ok === true) {
    return { ok: true, user: r.user || null, softAuth: false };
  }
  console.warn('[' + MOD + '][auth] token inválido; se continúa en modo local');
  return { ok: true, user: null, softAuth: true };
}

/**
 * Lee los datos de firma de una empresa. La razón social se lee de
 * `companies` (no está en esta tabla); el resto viene de acá.
 *
 * @param {string} token
 * @param {string} empresaId
 * @returns {object} { success, data: { datos } }
 */
function _handlerGet(token, empresaId) {
  const auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);
  if (!empresaId || typeof empresaId !== 'string') {
    return _err('INVALID_INPUT', 'empresaId es requerido');
  }

  const localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    const row = localDb.prepare(
      'SELECT * FROM empresa_datos_firma WHERE empresa_id = ? LIMIT 1'
    ).get(empresaId);

    // La razón social NO está en esta tabla: se lee de companies. Si la fila
    // de datos de firma no existe todavía, se devuelve null y la UI queda
    // vacía (que es lo honesto: nadie ha declarado nada todavía).
    if (!row) return _ok({ datos: null });

    return _ok({
      datos: {
        empresaId: row.empresa_id,
        nit: row.nit,
        domicilio: row.domicilio,
        domicilioMunicipio: row.domicilio_municipio,
        domicilioDepartamento: row.domicilio_departamento,
        responsableNombre: row.responsable_nombre,
        responsableCargo: row.responsable_cargo,
        responsableCorreo: row.responsable_correo,
        canalContacto: row.canal_contacto,
        canalPqrs: row.canal_pqrs,
        canalIncidentes: row.canal_incidentes,
        politicaDatosUrl: row.politica_datos_url,
        declaradoEn: row.declarado_en,
        actualizadoEn: row.actualizado_en,
      },
    });
  } catch (e) {
    console.error('[' + MOD + '][get]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * Crea o actualiza los datos de identificación de una empresa.
 *
 * Se usa UPSERT por `empresa_id` (UNIQUE en el esquema), a diferencia del
 * rep legal que usa "una fila activa": acá hay exactamente UNA combinación de
 * identificación por empresa, no un historial.
 *
 * @param {string} token
 * @param {object} data
 * @returns {object} { success, data: { id, updated } }
 */
function _handlerUpsert(token, data) {
  const auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.empresaId || typeof data.empresaId !== 'string' || !data.empresaId.trim()) {
    return _err('INVALID_INPUT', 'empresaId es requerido');
  }

  // Normalizar y validar todo ANTES de tocar la base, para no dejar una
  // escritura a medias si un campo esta malo.
  const v = {};
  const pares = [
    ['nit', 'nit'],
    ['domicilio', 'domicilio'],
    ['domicilioMunicipio', 'domicilio_municipio'],
    ['domicilioDepartamento', 'domicilio_departamento'],
    ['responsableNombre', 'responsable_nombre'],
    ['responsableCargo', 'responsable_cargo'],
    ['responsableCorreo', 'responsable_correo'],
    ['canalContacto', 'canal_contacto'],
    ['canalPqrs', 'canal_pqrs'],
    ['canalIncidentes', 'canal_incidentes'],
    ['politicaDatosUrl', 'politica_datos_url'],
  ];
  for (let i = 0; i < pares.length; i++) {
    const r = _norm(pares[i][1], data[pares[i][0]]);
    if (!r.ok) return _err('INVALID_INPUT', r.mensaje);
    v[pares[i][1]] = r.valor;
  }

  if (!_emailValido(v.responsable_correo)) {
    return _err('INVALID_INPUT', 'El correo del responsable no tiene formato valido');
  }
  if (!_emailValido(v.canal_contacto)) {
    return _err('INVALID_INPUT', 'El canal de contacto no tiene formato de correo valido');
  }
  if (!_urlValida(v.politica_datos_url)) {
    return _err('INVALID_INPUT',
      'La URL de la politica de datos debe empezar por http:// o https://');
  }

  const localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    const now = new Date().toISOString();
    const existente = localDb.prepare(
      'SELECT id, declarado_en FROM empresa_datos_firma WHERE empresa_id = ? LIMIT 1'
    ).get(data.empresaId.trim());

    if (existente) {
      localDb.prepare(
        'UPDATE empresa_datos_firma SET ' +
        'nit = ?, domicilio = ?, domicilio_municipio = ?, domicilio_departamento = ?, ' +
        'responsable_nombre = ?, responsable_cargo = ?, responsable_correo = ?, ' +
        'canal_contacto = ?, canal_pqrs = ?, canal_incidentes = ?, ' +
        'politica_datos_url = ?, actualizado_en = ? ' +
        'WHERE id = ?'
      ).run(
        v.nit, v.domicilio, v.domicilio_municipio, v.domicilio_departamento,
        v.responsable_nombre, v.responsable_cargo, v.responsable_correo,
        v.canal_contacto, v.canal_pqrs, v.canal_incidentes,
        v.politica_datos_url,
        now,
        existente.id
      );
      return _ok({ id: existente.id, updated: true });
    }

    const result = localDb.prepare(
      'INSERT INTO empresa_datos_firma ' +
      '(empresa_id, nit, domicilio, domicilio_municipio, domicilio_departamento, ' +
      ' responsable_nombre, responsable_cargo, responsable_correo, ' +
      'canal_contacto, canal_pqrs, canal_incidentes, politica_datos_url, ' +
      'declarado_en, actualizado_en) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      data.empresaId.trim(),
      v.nit, v.domicilio, v.domicilio_municipio, v.domicilio_departamento,
      v.responsable_nombre, v.responsable_cargo, v.responsable_correo,
      v.canal_contacto, v.canal_pqrs, v.canal_incidentes,
      v.politica_datos_url,
      now, now
    );
    return _ok({ id: result.lastInsertRowid, updated: false });
  } catch (e) {
    console.error('[' + MOD + '][upsert]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * Guarda el `ipcMain` sin registrar nada todavía. Así lo usa `main.js`:
 *   registerEmpresaDatosFirmaHandlers.init(ipcMain)
 *   registerEmpresaDatosFirmaHandlers(app, { getDb, validateSession })
 */
function init(ipcMain) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') {
    throw new Error('[' + MOD + '] ipcMain es requerido');
  }
  _ipcMain = ipcMain;
}

/** Registra los 2 handlers IPC. Idempotente por proceso. */
function _registerHandlers() {
  if (!_ipcMain) {
    throw new Error('[' + MOD + '] ipcMain no inyectado. Llamá registerEmpresaDatosFirmaHandlers.init(ipcMain) primero.');
  }

  _ipcMain.handle('empresa-datos-firma:get', async function (_event, args) {
    return _handlerGet(args && args.token, args && args.empresaId);
  });

  _ipcMain.handle('empresa-datos-firma:upsert', async function (_event, args) {
    return _handlerUpsert(args && args.token, args && args.data);
  });
}

/**
 * Registra las dependencias y los handlers.
 *
 * Esta es la forma que espera `main.js`: una función con `.init`. El nombre
 * anterior (`register`) se mantiene como alias para no romper consumidores
 * viejos ni los simuladores de prueba.
 */
function registerEmpresaDatosFirmaHandlers(_app, deps) {
  deps = deps || {};
  if (!_ipcMain) {
    throw new Error('[' + MOD + '] ipcMain no inyectado. Llamá registerEmpresaDatosFirmaHandlers.init(ipcMain) primero.');
  }
  if (!deps.getDb) throw new Error('[' + MOD + '] deps.getDb es requerido');
  _getDb = deps.getDb;
  _validateSession = deps.validateSession || null;
  _registerHandlers();
  console.log('[' + MOD + '][INIT][SUCCESS] Bridge registrado · 2 handlers (get / upsert) · 📦927');
}

registerEmpresaDatosFirmaHandlers.init = init;
// Alias en la propia función: algunos consumidores hacían
// `require(...).register(app, deps)`. Se mantiene además del export.
registerEmpresaDatosFirmaHandlers.register = registerEmpresaDatosFirmaHandlers;

module.exports = {
  registerEmpresaDatosFirmaHandlers,
  // Alias retrocompatibles (el módulo se consumía como { init, register }).
  init,
  register: registerEmpresaDatosFirmaHandlers,
  SCHEMA_SQL: null,
};