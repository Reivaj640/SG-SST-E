/**
 * Servicio de Identificación de la Empresa que solicita la firma.
 *
 * Responde una pregunta que el firmante tiene derecho a hacer antes de
 * firmar: ¿quién me está pidiendo esto?
 *
 * ANTECEDENTE
 * -----------
 * Hasta ahora el único identificador de empresa que viajaba con la solicitud
 * era `id_empresa`, que en la práctica es el NIT. Un código no le dice nada a
 * un trabajador: no dice la razón social, ni el domicilio, ni quién responde
 * por la empresa. Esa información vivía en la cabeza del operador humano.
 *
 * LA DISTINCIÓN QUE NO SE DEBE PERDER
 * -----------------------------------
 * Hay TRES partes en cada firma y no son la misma:
 *
 *   1. El TRABAJADOR  → el que firma. Se identifica en el paso 1 del flujo.
 *   2. La EMPRESA     → el empleador que SOLICITA la firma. Es lo que devuelve
 *                       este servicio, y lo que se muestra en el bloque.
 *   3. K+AIR / su operador → quien IMPLEMENTA el mecanismo. Se identifica en
 *                       el capítulo 1.4 del Acuerdo, no aquí.
 *
 * Confundir 2 con 3 es el error grave: si el bloque mostrara los datos de
 * quien opera la plataforma, el trabajador leería "la empresa que me pide
 * firmar" y vería a quien no le está pidiendo nada.
 *
 * DÓNDE ESTÁ EL DATO
 * ------------------
 * `id_empresa` ya existe en todo el esquema (`gh_internal_clients`,
 * `gh_consentimientos_firma`, `gh_firmas_electronicas`) y llega al servicio
 * desde la API key autenticada vía `req.id_empresa` (ver middleware/authz.js).
 * NO se resuelve desde el body de la petición: eso lo enviaría el cliente y
 * sería falsificable.
 *
 * HUELLA DEL SNAPSHOT
 * ------------------
 * `buildSnapshot()` devuelve el texto JSON canónico y su SHA-256. Se archivan
 * en el consentimiento (migración 018) para que, si mañana cambia el domicilio
 * de una empresa, la firma/archive sigue mostrando lo que el firmante vio.
 *
 * Ver migración 017 y 018 para el porqué de NO meter estos datos dentro del
 * texto del Acuerdo.
 */
'use strict';

const db = require('../db/connection');
const { sha256 } = require('../crypto/hash');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

/**
 * Campos que forman el snapshot, EN ORDEN FIJO.
 *
 * El orden importa: `JSON.stringify` serializa en el orden de inserción de
 * claves, así que construir el objeto siempre en este mismo orden es lo que
 * hace que la huella sea REPRODUCIBLE. Si dos empresas tienen los mismos
 * datos deben producir el mismo string y la misma huella; si el orden
 * variara, cada llamada generaría una huella distinta y la prueba de valor.
 */
const SNAPSHOT_FIELDS = [
  'id_empresa',
  'razon_social',
  'nit',
  'domicilio',
  'representante_legal',
  'representante_legal_identificacion',
  'responsable_tratamiento',
  'responsable_tratamiento_correo',
  'canal_pqrs',
  'canal_incidentes',
  'politica_datos_url',
  // Plazo de conservación y canal de copia (numerales 8.6 y 10.6 del
  // Acuerdo). Van al final para no alterar el orden de los campos que ya
  // estaban: el prefijo del snapshot conserva su serialización anterior.
  'plazo_retencion',
  'canal_solicitud_copia',
];

/**
 * Columnas que se leen de la fila de `gh_firma_empresas`.
 */
const SELECT_COLS = `
  id_empresa, razon_social, nit, domicilio,
  representante_legal, representante_legal_identificacion,
  responsable_tratamiento, responsable_tratamiento_correo,
  canal_pqrs, canal_incidentes, politica_datos_url,
  plazo_retencion, canal_solicitud_copia, plazo_retencion_dias,
  anexo_encargo_firmado_at, activo,
  created_at, updated_at
`;

const _MAX_LEN = {
  id_empresa: 64,
  razon_social: 200,
  nit: 64,
  domicilio: 300,
  representante_legal: 200,
  representante_legal_identificacion: 64,
  responsable_tratamiento: 200,
  responsable_tratamiento_correo: 200,
  canal_pqrs: 300,
  canal_incidentes: 300,
  politica_datos_url: 500,
  plazo_retencion: 500,
  canal_solicitud_copia: 300,
};

/**
 * Valida y normaliza (trim) un campo de texto. Devuelve null si viene vacío.
 * Lanza 400 si excede el máximo. La validación real de formato la hace el
 * schema zod; esto es la red de seguridad para quien llame al service
 * directo.
 */
function _norm(campo, valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      `${campo} debe ser string o null`);
  }
  const v = valor.trim();
  if (v.length === 0) return null;
  if (v.length > _MAX_LEN[campo]) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      `${campo} excede el máximo de ${_MAX_LEN[campo]} caracteres`);
  }
  return v;
}

/**
 * Normaliza un campo entero. Acepta número o cadena numérica; devuelve null
 * si viene vacío. Lanza 400 si no es un entero positivo.
 *
 * El plazo de conservación en días (`plazo_retencion_dias`, migración 023) es
 * un entero y no un texto: es el plazo COMPUTABLE que usa el 8.6. El texto
 * libre `plazo_retencion` es el que se le muestra al firmante, porque la
 * tabla de retención de la Empresa puede fijar plazos distintos por categoría
 * de dato y K+AIR no puede representarlos con un entero.
 */
function _normEntero(campo, valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      `${campo} debe ser un número entero de días mayor que cero`);
  }
  if (n > 36500) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      `${campo} no puede superar 36500 días (100 años)`);
  }
  return n;
}

/**
 * Convierte una fila de `gh_firma_empresas` al shape interno (sin los
 * metadatos de auditoría, que no forman parte de la identificación).
 */
function _toRowShape(row) {
  if (!row) return null;
  const out = {};
  for (const campo of SNAPSHOT_FIELDS) {
    out[campo] = row[campo] === undefined ? null : row[campo];
  }
  out.anexo_encargo_firmado_at = row.anexo_encargo_firmado_at || null;
  // Plazo computable de conservación (migración 023). NO va en el snapshot:
  // el snapshot es la identificación que se le MOSTRÓ al firmante, y eso ya
  // está en `plazo_retencion` (el texto que la Empresa declara y que el
  // firmante puede leer). Este número es el valor computable que usa el
  // sistema para calcular la fecha de conservación, no parte de lo que el
  // firmante vio: no tiene por qué alterar la huella del snapshot.
  out.plazo_retencion_dias = row.plazo_retencion_dias === undefined
    ? null
    : row.plazo_retencion_dias;
  out.activo = row.activo === 1;
  out.created_at = row.created_at || null;
  out.updated_at = row.updated_at || null;
  return out;
}

/**
 * Lee una empresa por su id. NO filtra por activo: el admin necesita ver las
 * dadas de baja. Para el hot path usar `getActiva()`.
 *
 * @param {string} id_empresa
 * @returns {object|null}
 */
function getById(id_empresa) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) return null;
  const row = db.prepare(
    `SELECT ${SELECT_COLS} FROM gh_firma_empresas WHERE id_empresa = ?`
  ).get(id_empresa);
  return _toRowShape(row);
}

/**
 * Lee una empresa SOLO si está activa. Es la función que usa la mini-app.
 * Una empresa dada de baja no debe mostrar bloque: si se retiró del servicio,
 * que ninguna firma nueva lo anuncie como si siguiera operando.
 *
 * @param {string} id_empresa
 * @returns {object|null}
 */
function getActiva(id_empresa) {
  const row = getById(id_empresa);
  if (!row || !row.activo) return null;
  return row;
}

/**
 * Construye el snapshot canónico de una empresa + su huella.
 *
 * Devuelve null si la empresa no existe o está inactiva, para que el llamador
 * pueda simplemente omitir el bloque (comportamiento previo a la 017).
 *
 * IMPORTANTE: el JSON NO incluye `created_at`, `updated_at` ni
 * `anexo_encargo_firmado_at`. Son metadatos de gestión, no identificación, y
 * meterlos haría que la huella cambiara cada vez que alguien corrigiera un
 * dato administrativo sin que cambie lo que el firmante vio.
 *
 * @param {string} id_empresa
 * @returns {{datos: object, texto: string, huella: string}|null}
 */
function buildSnapshot(id_empresa) {
  const empresa = getActiva(id_empresa);
  if (!empresa) return null;

  // Se construye en el orden de SNAPSHOT_FIELDS a propósito (ver nota arriba).
  const datos = {};
  for (const campo of SNAPSHOT_FIELDS) {
    datos[campo] = empresa[campo] === undefined ? null : empresa[campo];
  }

  const texto = JSON.stringify(datos);
  const huella = sha256(texto);
  return { datos, texto, huella };
}

/**
 * Arma el snapshot para persistir. Si la empresa no está dada de alta,
 * devuelve dos nulls: el consentimiento se guarda igual (no bloqueamos la
 * firma por un dato administrativo), pero queda constancia de que no se le
 * mostró identificación de empresa.
 *
 * @param {string} id_empresa
 * @returns {{snapshot: string|null, hash: string|null}}
 */
function snapshotColumnsFor(id_empresa) {
  const snap = buildSnapshot(id_empresa);
  if (!snap) return { snapshot: null, hash: null };
  return { snapshot: snap.texto, hash: snap.huella };
}

/**
 * Shape para la mini-app: qué campos se exponen al firmante.
 *
 * `representante_legal_identificacion` se expone COMPLETO a propósito: es el
 * representante legal de una sociedad, dato público en el registro mercantil,
 * y es justamente contra ese dato contra el que el firmante verifica que
 * quien firma por la empresa es quien dice ser. En la verificación pública
 * (`/verify`) sí se enmascara, porque ahí el lector no es el firmante.
 *
 * @param {string} id_empresa
 * @returns {object|null}
 */
function publicViewFor(id_empresa) {
  const snap = buildSnapshot(id_empresa);
  if (!snap) return null;
  return {
    id_empresa: snap.datos.id_empresa,
    razon_social: snap.datos.razon_social,
    nit: snap.datos.nit,
    domicilio: snap.datos.domicilio,
    representante_legal: snap.datos.representante_legal,
    representante_legal_identificacion: snap.datos.representante_legal_identificacion,
    responsable_tratamiento: snap.datos.responsable_tratamiento,
    responsable_tratamiento_correo: snap.datos.responsable_tratamiento_correo,
    canal_pqrs: snap.datos.canal_pqrs,
    canal_incidentes: snap.datos.canal_incidentes,
    politica_datos_url: snap.datos.politica_datos_url,
    plazo_retencion: snap.datos.plazo_retencion,
    canal_solicitud_copia: snap.datos.canal_solicitud_copia,
    huella: snap.huella,
  };
}

/**
 * Campos editables. `id_empresa` NO se incluye: es la clave primaria y
 * cambiarla reescribiría el historial de firmas que apuntan a esta empresa.
 */
const EDITABLE_FIELDS = [
  'razon_social', 'nit', 'domicilio',
  'representante_legal', 'representante_legal_identificacion',
  'responsable_tratamiento', 'responsable_tratamiento_correo',
  'canal_pqrs', 'canal_incidentes', 'politica_datos_url',
  'plazo_retencion', 'canal_solicitud_copia',
];

/**
 * Da de alta una empresa. Falla si el id ya existe.
 *
 * @param {object} datos
 * @returns {object} La empresa creada.
 * @throws AppError 400 si falta razon_social; 409 si el id ya existe.
 */
function create(datos) {
  if (!datos || typeof datos !== 'object') {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'Se esperaba un objeto');
  }
  const id_empresa = _norm('id_empresa', datos.id_empresa);
  if (!id_empresa) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'id_empresa es requerido');
  }
  const razon_social = _norm('razon_social', datos.razon_social);
  if (!razon_social) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'razon_social es requerido');
  }

  const existente = getById(id_empresa);
  if (existente) {
    throw new AppError(409, 'EMPRESA_ALREADY_EXISTS',
      `Ya existe la empresa ${id_empresa}`, { id_empresa });
  }

  const valores = {};
  for (const campo of EDITABLE_FIELDS) {
    valores[campo] = _norm(campo, datos[campo]);
  }

  db.prepare(`
    INSERT INTO gh_firma_empresas (id_empresa, ${EDITABLE_FIELDS.join(', ')}, plazo_retencion_dias)
    VALUES (?, ${EDITABLE_FIELDS.map(() => '?').join(', ')}, ?)
  `).run(
    id_empresa,
    ...EDITABLE_FIELDS.map((c) => valores[c]),
    _normEntero('plazo_retencion_dias', datos.plazo_retencion_dias)
  );

  logger.info('Empresa registrada', {
    id_empresa,
    razon_social,
    campos_pendientes: EDITABLE_FIELDS.filter((c) => !valores[c]),
  });

  return getById(id_empresa);
}

/**
 * Actualiza campos de una empresa existente. Los campos ausentes o null se
 * guardan como null (NO se preserva el valor anterior): quien llama está
 * fijando el estado completo de lo que se muestra al firmante.
 *
 * `activo` NO se toca aquí: dar de baja una empresa tiene su propio endpoint
 * para que no ocurra por accidente en una actualización de rutina.
 *
 * @param {string} id_empresa
 * @param {object} datos
 * @returns {object} La empresa actualizada.
 * @throws AppError 404 si no existe.
 */
function update(id_empresa, datos) {
  const actual = getById(id_empresa);
  if (!actual) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND',
      `No existe la empresa ${id_empresa}`, { id_empresa });
  }
  if (!datos || typeof datos !== 'object') {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'Se esperaba un objeto');
  }

  const valores = {};
  for (const campo of EDITABLE_FIELDS) {
    valores[campo] = _norm(campo, datos[campo]);
  }

  db.prepare(`
    UPDATE gh_firma_empresas
    SET ${EDITABLE_FIELDS.map((c) => `${c} = ?`).join(', ')},
        plazo_retencion_dias = ?,
        updated_at = datetime('now')
    WHERE id_empresa = ?
  `).run(
    ...EDITABLE_FIELDS.map((c) => valores[c]),
    _normEntero('plazo_retencion_dias', datos.plazo_retencion_dias),
    id_empresa
  );

  logger.info('Empresa actualizada', {
    id_empresa,
    campos_actualizados: EDITABLE_FIELDS.filter((c) => datos[c] !== undefined),
  });

  return getById(id_empresa);
}

/**
 * Marca el Anexo de Encargo como firmado con la fecha dada.
 *
 * Endpoint aparte y explícito a propósito: es el dato que sustenta el
 * cumplimiento del artículo 25 del Decreto 1377 de 2013, y no debería poder
 * cambiarse pasando por un PUT de datos de contacto.
 *
 * OJO: registrar el anexo NO habilita el candado. Eso se activa por separado
 * (ver nota de la migración 017).
 *
 * @param {string} id_empresa
 * @param {string} fecha - ISO8601.
 * @returns {object}
 * @throws AppError 404 si la empresa no existe; 400 si la fecha no parsea.
 */
function marcarAnexoFirmado(id_empresa, fecha) {
  const actual = getById(id_empresa);
  if (!actual) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND',
      `No existe la empresa ${id_empresa}`, { id_empresa });
  }
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'fecha de firma del anexo no es una fecha valida');
  }
  const iso = d.toISOString();
  db.prepare(`
    UPDATE gh_firma_empresas
    SET anexo_encargo_firmado_at = ?, updated_at = datetime('now')
    WHERE id_empresa = ?
  `).run(iso, id_empresa);
  logger.info('Anexo de Encargo marcado como firmado', { id_empresa, fecha: iso });
  return getById(id_empresa);
}

/**
 * Da de baja (soft) o reactiva una empresa.
 *
 * @param {string} id_empresa
 * @param {boolean} activo
 * @returns {object}
 */
function setActivo(id_empresa, activo) {
  const actual = getById(id_empresa);
  if (!actual) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND',
      `No existe la empresa ${id_empresa}`, { id_empresa });
  }
  db.prepare(`
    UPDATE gh_firma_empresas
    SET activo = ?, updated_at = datetime('now')
    WHERE id_empresa = ?
  `).run(activo ? 1 : 0, id_empresa);
  logger.info('Empresa ' + (activo ? 'reactivada' : 'dada de baja'), { id_empresa });
  return getById(id_empresa);
}

/**
 * Lista todas las empresas (admin), incluidas las dadas de baja.
 *
 * @returns {Array<object>}
 */
function list() {
  const rows = db.prepare(
    `SELECT ${SELECT_COLS} FROM gh_firma_empresas ORDER BY razon_social ASC`
  ).all();
  return rows.map(_toRowShape);
}

/**
 * Resumen de completitud para el admin: qué campos de identificación faltan
 * en cada empresa. Sirve para no activar una empresa con la identificación a
 * medias sin que nadie lo note.
 *
 * @returns {Array<object>}
 */
function listConPendientes() {
  return list().map((e) => {
    const requeridos = ['razon_social', 'nit', 'domicilio'];
    const deseables = [
      'representante_legal', 'responsable_tratamiento',
      'responsable_tratamiento_correo', 'canal_pqrs', 'canal_incidentes',
      'politica_datos_url',
      // El numeral 8.6 obliga a la Empresa a comunicarle al Trabajador el
      // plazo de conservación y el canal para pedir copia. Si faltan, la
      // comunicación no se puede hacer: se listan entre los deseables para
      // que la consola de empresas los muestre como pendientes.
      'plazo_retencion', 'canal_solicitud_copia',
    ];
    const faltan_requeridos = requeridos.filter((c) => !e[c]);
    const faltan_deseables = deseables.filter((c) => !e[c]);
    return {
      ...e,
      faltan_requeridos,
      faltan_deseables,
      completa: faltan_requeridos.length === 0,
      tiene_anexo: Boolean(e.anexo_encargo_firmado_at),
    };
  });
}

/**
 * Parsea un snapshot archivado (columna empresa_snapshot).
 *
 * El snapshot es JSON que escribimos nosotros, pero se relee años después
 * y puede haber sido tocado a mano en la BD. Un parseo fallido NO debe
 * tumbar la generación de la constancia: se devuelve null y el llamador
 * muestra que no hay identificación archivada. Perder la constancia
 * entera por un JSON malformed sería peor que la constancia sin ese dato.
 *
 * @param {string|null} texto
 * @returns {object|null}
 */
function parseSnapshot(texto) {
  if (typeof texto !== 'string' || texto.length === 0) return null;
  try {
    const obj = JSON.parse(texto);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    return obj;
  } catch (_) {
    return null;
  }
}

module.exports = {
  SNAPSHOT_FIELDS,
  EDITABLE_FIELDS,
  getById,
  getActiva,
  buildSnapshot,
  snapshotColumnsFor,
  parseSnapshot,
  publicViewFor,
  create,
  update,
  marcarAnexoFirmado,
  setActivo,
  list,
  listConPendientes,
};