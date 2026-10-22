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
const { cifrar, descifrar, esCifrado } = require('../crypto/cifrado');
const representanteService = require('./representante');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

// 8B-C · El snapshot de la Empresa también contiene el documento del
// representante legal. Se cifra con un propósito y un campo PROPIOS: así el
// sobre de este snapshot no se puede abrir como si fuera el del sign request
// (que usa otro propósito/campo), aunque la Empresa sea la misma.
const PROPOSITO_EMPRESA_SNAPSHOT = 'cifrado-empresa-snapshot';
const CAMPO_EMPRESA_REP = 'empresa_snapshot.representante_legal_identificacion';

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
  conservacion_por_deber_legal, norma_conservacion,
  dominios_corporativos,
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
  norma_conservacion: 300,
  dominios_corporativos: 1000,
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
 * Normaliza un campo booleano. Acepta boolean, 0/1 y "true"/"false".
 * Devuelve false si viene vacío (un flag apagado es el estado natural).
 * Lanza 400 si el valor no es un booleano reconocible.
 *
 * `conservacion_por_deber_legal` (migración 029) es un flag: dice si la
 * Empresa tiene un deber legal de conservación SIN término (el 2.2.1.1.12 del
 * Decreto 1072). No es un texto: si lo fuera, "sí" y "no" serían lo mismo para
 * una máquina.
 */
function _normBooleano(campo, valor) {
  if (valor === undefined || valor === null || valor === '') return false;
  if (typeof valor === 'boolean') return valor;
  if (valor === 1 || valor === '1' || valor === 'true') return true;
  if (valor === 0 || valor === '0' || valor === 'false') return false;
  throw new AppError(400, 'INVALID_REQUEST_BODY',
    `${campo} debe ser verdadero o falso`);
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
  // El deber legal de conservación sin término (migración 029). NO va en el
  // snapshot: el snapshot es la identificación que se le MOSTRÓ al firmante.
  // Esto es una política de conservación, y como el plazo computable, no
  // altera la huella de lo que el firmante vio.
  out.conservacion_por_deber_legal = Boolean(row.conservacion_por_deber_legal);
  out.norma_conservacion = row.norma_conservacion || null;
  // Los dominios corporativos (D-2). Es política de la Empresa: NO va en
  // el snapshot (el snapshot es lo que el firmante ve).
  out.dominios_corporativos = row.dominios_corporativos || null;
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
 * Copia los datos del snapshot y cifra el documento del representante.
 *
 * El campo se deja con el MISMO nombre (`representante_legal_identificacion`)
 * para que los lectores no tengan que aprender una columna nueva; el valor
 * pasa a ser un sobre `enc:v2:...` y al lado se guardan los últimos 4 como
 * rastro de auditoría. La presentación NO confía en esos 4: abre el sobre y
 * verifica la etiqueta GCM antes de mostrar el número enmascarado.
 *
 * @param {object} datos
 * @param {string} id_empresa
 * @returns {object}
 */
function _cifrarDatosSnapshot(datos, id_empresa) {
  const copia = Object.assign({}, datos);
  const valor = copia.representante_legal_identificacion;

  if (typeof valor !== 'string' || valor.length === 0) return copia;

  if (esCifrado(valor)) {
    // Defensa: si ya venía cifrado, no se cifra dos veces. Si le faltan los
    // últimos 4, se intentan recuperar; si la llave no está, se dejan null.
    if (!copia.representante_legal_identificacion_ultimos4) {
      try {
        copia.representante_legal_identificacion_ultimos4 =
          representanteService.ultimosDeTexto(
            descifrar(valor, id_empresa, PROPOSITO_EMPRESA_SNAPSHOT, CAMPO_EMPRESA_REP)
          );
      } catch (e) {
        logger.warn('No se pudieron recuperar los últimos 4 del representante', {
          error: e.message,
        });
      }
    }
    return copia;
  }

  copia.representante_legal_identificacion = cifrar(
    valor,
    id_empresa,
    PROPOSITO_EMPRESA_SNAPSHOT,
    CAMPO_EMPRESA_REP
  );
  copia.representante_legal_identificacion_ultimos4 =
    representanteService.ultimosDeTexto(valor);
  return copia;
}

/**
 * Devuelve una copia del snapshot con el documento del representante CIFRADO.
 *
 * A diferencia de `snapshotColumnsFor()`, NO reconstruye el snapshot desde la
 * fila viva de la empresa: parte del snapshot HISTÓRICO que ya se archivó y
 * solo transforma el número. Eso es lo que necesita el backfill para no
 * cambiar lo que el firmante vio.
 *
 * @param {object|string|null} snapshot
 * @param {string} id_empresa
 * @returns {object|null}
 */
function cifrarSnapshotEmpresa(snapshot, id_empresa) {
  const original = typeof snapshot === 'string' ? parseSnapshot(snapshot) : snapshot;
  if (!original || typeof original !== 'object' || Array.isArray(original)) return null;
  return _cifrarDatosSnapshot(original, id_empresa);
}

/**
 * Devuelve una copia del snapshot con el documento del representante EN CLARO.
 *
 * Es para verificación y backfill, NO para presentación. Si el sobre no se
 * puede abrir, lanza: quien verifica tiene que enterarse, no recibir un dato
 * inventado. Las filas heredadas (texto en claro) se devuelven tal cual.
 *
 * @param {object|string|null} snapshot
 * @param {string} id_empresa
 * @returns {object|null}
 */
function descifrarSnapshotEmpresa(snapshot, id_empresa) {
  const original = typeof snapshot === 'string' ? parseSnapshot(snapshot) : snapshot;
  if (!original || typeof original !== 'object' || Array.isArray(original)) return null;

  const copia = Object.assign({}, original);
  const valor = copia.representante_legal_identificacion;
  if (typeof valor === 'string' && esCifrado(valor)) {
    copia.representante_legal_identificacion = descifrar(
      valor,
      id_empresa,
      PROPOSITO_EMPRESA_SNAPSHOT,
      CAMPO_EMPRESA_REP
    );
  }
  if (typeof copia.representante_legal_identificacion === 'string'
    && !copia.representante_legal_identificacion_ultimos4) {
    copia.representante_legal_identificacion_ultimos4 =
      representanteService.ultimosDeTexto(copia.representante_legal_identificacion);
  }
  return copia;
}

/**
 * Huella canónica del snapshot, calculada sobre los datos EN CLARO.
 *
 * `snapshotColumnsFor()` sigue devolviendo la misma huella que antes de 8B-C:
 * SHA-256 del JSON canónico con el documento en claro. El sobre cifrado NO se
 * hashea: su IV es aleatorio y la huella cambiaría en cada cifrado. Para
 * verificar una fila hay que descifrarla primero y llamar aquí.
 *
 * @param {object|string|null} snapshot - datos en claro (o JSON en claro)
 * @returns {string|null}
 */
function hashSnapshotEmpresa(snapshot) {
  const obj = typeof snapshot === 'string' ? parseSnapshot(snapshot) : snapshot;
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  // Un sobre o una máscara no son "datos en claro": hashearlos produciría una
  // huella que no se puede volver a calcular desde lo que el firmante vio.
  const valor = obj.representante_legal_identificacion;
  if (typeof valor === 'string'
    && (esCifrado(valor) || valor.startsWith(representanteService.MASCARA))) {
    return null;
  }

  // Solo se incluyen las claves PRESENTES, en el orden de SNAPSHOT_FIELDS.
  // Los snapshots anteriores a la migración 021 tienen 11 campos (no existían
  // `plazo_retencion` ni `canal_solicitud_copia`). Rellenarlos con null acá
  // cambiaría la huella y el backfill rechazaría filas históricas legítimas.
  const canon = {};
  for (const campo of SNAPSHOT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, campo)) {
      canon[campo] = obj[campo];
    }
  }
  return sha256(JSON.stringify(canon));
}

/**
 * Arma el snapshot para persistir. Si la empresa no está dada de alta,
 * devuelve dos nulls: el consentimiento se guarda igual (no bloqueamos la
 * firma por un dato administrativo), pero queda constancia de que no se le
 * mostró identificación de empresa.
 *
 * El documento del representante va CIFRADO; `hash` sigue siendo el SHA-256
 * del JSON canónico EN CLARO (ver `hashSnapshotEmpresa`).
 *
 * @param {string} id_empresa
 * @returns {{snapshot: string|null, hash: string|null}}
 */
function snapshotColumnsFor(id_empresa) {
  const snap = buildSnapshot(id_empresa);
  if (!snap) return { snapshot: null, hash: null };
  const datos = _cifrarDatosSnapshot(snap.datos, id_empresa);
  return { snapshot: JSON.stringify(datos), hash: snap.huella };
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
 * @param {object} [overrides] - Texto de retención propio de la solicitud
 *   (catálogo por documento). Si no se pasa, se usa la Empresa viva, que es el
 *   comportamiento de las solicitudes legacy.
 * @returns {object|null}
 */
function publicViewFor(id_empresa, overrides) {
  const snap = buildSnapshot(id_empresa);
  if (!snap) return null;
  const empresa = getActiva(id_empresa);
  const extra = (overrides && typeof overrides === 'object') ? overrides : {};
  const tiene = (campo) => Object.prototype.hasOwnProperty.call(extra, campo);

  // El texto y el deber legal pueden venir de la fila de la solicitud (20 años
  // desde el cese, contrato electrónico, historia laboral). Si no vienen, se
  // conserva la Empresa viva: las solicitudes viejas no cambian de golpe.
  const plazoRetencion = tiene('plazo_retencion')
    ? extra.plazo_retencion
    : snap.datos.plazo_retencion;
  const deberLegal = tiene('conservacion_por_deber_legal')
    ? Boolean(extra.conservacion_por_deber_legal)
    : Boolean(empresa && empresa.conservacion_por_deber_legal);
  const normaConservacion = tiene('norma_conservacion')
    ? (extra.norma_conservacion || null)
    : ((empresa && empresa.norma_conservacion) || null);

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
    plazo_retencion: plazoRetencion,
    canal_solicitud_copia: snap.datos.canal_solicitud_copia,
    // El deber legal de conservación sin término (migración 029). Va en la
    // vista pública porque el 8.6 obliga a COMUNICAR al Trabajador el plazo
    // y dónde pedir copia: si su documento no se borra, eso también se
    // comunica (y es mejor que el Trabajador lo sepa).
    conservacion_por_deber_legal: deberLegal,
    norma_conservacion: normaConservacion,
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
    INSERT INTO gh_firma_empresas (id_empresa, ${EDITABLE_FIELDS.join(', ')}, plazo_retencion_dias, norma_conservacion, conservacion_por_deber_legal, dominios_corporativos)
    VALUES (?, ${EDITABLE_FIELDS.map(() => '?').join(', ')}, ?, ?, ?, ?)
  `).run(
    id_empresa,
    ...EDITABLE_FIELDS.map((c) => valores[c]),
    _normEntero('plazo_retencion_dias', datos.plazo_retencion_dias),
    _norm('norma_conservacion', datos.norma_conservacion),
    _normBooleano('conservacion_por_deber_legal', datos.conservacion_por_deber_legal) ? 1 : 0,
    _norm('dominios_corporativos', datos.dominios_corporativos)
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

  // El deber legal de conservación (migración 029) NO se toca si el body no
  // lo trae. Es lo contrario que el resto de los campos, y a propósito: acá
  // un campo ausente no puede significar "levantar el deber legal" (eso es un
  // acto, con actor y motivo). Para levantarlo hay que mandar el `false`
  // explícito.
  const deberLegal = datos.conservacion_por_deber_legal === undefined
    ? (actual.conservacion_por_deber_legal ? 1 : 0)
    : (_normBooleano('conservacion_por_deber_legal', datos.conservacion_por_deber_legal) ? 1 : 0);
  const norma = datos.norma_conservacion === undefined
    ? (actual.norma_conservacion || null)
    : _norm('norma_conservacion', datos.norma_conservacion);
  const dominios = datos.dominios_corporativos === undefined
    ? (actual.dominios_corporativos || null)
    : _norm('dominios_corporativos', datos.dominios_corporativos);

  db.prepare(`
    UPDATE gh_firma_empresas
    SET ${EDITABLE_FIELDS.map((c) => `${c} = ?`).join(', ')},
        plazo_retencion_dias = ?,
        norma_conservacion = ?,
        conservacion_por_deber_legal = ?,
        dominios_corporativos = ?,
        updated_at = datetime('now')
    WHERE id_empresa = ?
  `).run(
    ...EDITABLE_FIELDS.map((c) => valores[c]),
    _normEntero('plazo_retencion_dias', datos.plazo_retencion_dias),
    norma,
    deberLegal,
    dominios,
    id_empresa
  );

  logger.info('Empresa actualizada', {
    id_empresa,
    campos_actualizados: EDITABLE_FIELDS.filter((c) => datos[c] !== undefined),
    conservacion_por_deber_legal: Boolean(deberLegal),
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
 * ¿La Empresa está habilitada para pedir firmas? (D-03)
 *
 * Son dos cosas distintas las que se comprueban, y las dos están en el
 * Acuerdo:
 *
 *   1. El **Anexo de Encargo** firmado. El 1.4 dice que la relación entre la
 *      Empresa (Responsable) y K+AIR (Encargado) se rige por el contrato de
 *      transmisión de datos (art. 25 del Decreto 1377 / 2.2.2.25.5.2). Sin
 *      ese Anexo, K+AIR estaría tratando datos de personas por cuenta de
 *      una Empresa con la que no tiene contrato de encargo.
 *   2. El **plazo de conservación declarado**. El 8.6 obliga a la Empresa a
 *      comunicar al Trabajador el plazo y dónde pedir copia ANTES de pedirle
 *      la firma; sin plazo no hay fecha de conservación (10.6) y la supresión
 *      nunca puede ocurrir.
 *
 * Una empresa que **no está registrada** no se bloquea aquí: eso es otro
 * problema (identificación incompleta) y se atiende por el alta de la
 * empresa. Este control es para las empresas que YA están en el registro.
 *
 * @param {string} id_empresa
 * @returns {{ok: boolean, registrada: boolean, id_empresa: string,
 *   pendientes: string[], mensaje: string}}
 */
function verificarHabilitacionFirma(id_empresa) {
  const empresa = getById(id_empresa);
  if (!empresa) {
    return {
      ok: true,
      registrada: false,
      id_empresa,
      pendientes: [],
      mensaje: 'La empresa no está registrada en el directorio de empresas.',
    };
  }

  // El PLAZO DE CONSERVACIÓN ya no se le exige a la Empresa: la custodia de 80
  // años vive en el código del sistema (src/services/retencion.js) y no hay
  // nada que declarar ni que decidir. Lo que sí se exige es lo que la Empresa
  // no puede dejar de tener:
  //   - el Anexo de Encargo firmado (el 1.4): sin él, K+AIR no tiene el
  //     encargo que respalda la firma.
  //   - el canal de atención (el 7.2-7.3): sin él, el derecho del Trabajador
  //     a la firma autográfica no tiene puerta. Cuando el rechazo del D-2 esté
  //     encendido, el 400 le dice al Trabajador «pedile a tu Empresa la firma
  //     en papel»: si la Empresa no tiene canal, ese 400 apunta a una puerta
  //     que no existe (es el mismo error que el 409 sin salida que la 10.4 vino
  //     a matar).
  const pendientes = [];
  if (!empresa.anexo_encargo_firmado_at) pendientes.push('anexo_encargo_firmado');
  if (!empresa.canal_pqrs) pendientes.push('canal_pqrs');

  if (pendientes.length === 0) {
    return {
      ok: true,
      registrada: true,
      id_empresa,
      pendientes: [],
      mensaje: 'La empresa está habilitada para solicitar firmas.',
    };
  }

  const falta = pendientes.map((p) => {
    if (p === 'anexo_encargo_firmado') return 'no tiene registrado el Anexo de Encargo firmado';
    return 'no tiene declarado el canal de atención (el 7.2-7.3: es por dón donde el Trabajador pide la firma en papel)';
  }).join(' y ');

  return {
    ok: false,
    registrada: true,
    id_empresa,
    pendientes,
    mensaje: `La empresa ${id_empresa} ${falta}. `
      + 'Regístrelo en POST /internal/admin/empresas/'
      + `${id_empresa}/anexo-firmado (Anexo) y en `
      + `PUT /internal/admin/empresas/${id_empresa} (canal de atención) `
      + 'antes de solicitar firmas.',
  };
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

/**
 * Snapshot listo para PRESENTAR (PDF/constancia): el documento del
 * representante sale enmascarado y NUNCA en claro.
 *
 * - Si el campo es un sobre v2, se abre SIEMPRE y se usan los últimos 4 del
 *   texto verificado. Si no se puede abrir, el campo queda null (no se inventa
 *   un número ni se imprime `CC —`).
 * - Si es una fila heredada en claro, se enmascara al vuelo.
 *
 * Si se pasa `opts.hashEsperado` (la huella archivada en el consentimiento),
 * también se verifica que el snapshot descifrado sea exactamente el que produjo
 * esa huella. Si no cuadra, el número queda null y `empresa_hash_verificado`
 * queda false: el PDF dice `No disponible` en vez de mostrar un dato que no
 * corresponde a la evidencia.
 *
 * No muta el objeto original.
 *
 * @param {string|null} texto
 * @param {string} id_empresa
 * @param {{hashEsperado?: string|null}} [opts]
 * @returns {object|null}
 */
function parseSnapshotParaMostrar(texto, id_empresa, opts) {
  const obj = parseSnapshot(texto);
  if (!obj) return null;

  const copia = Object.assign({}, obj);
  const valor = obj.representante_legal_identificacion;
  const hashEsperado = opts
    && typeof opts.hashEsperado === 'string'
    && opts.hashEsperado.length > 0
    ? opts.hashEsperado
    : null;
  let numero = null;
  let claroParaHash = null;

  if (typeof valor === 'string' && valor.length > 0) {
    if (esCifrado(valor)) {
      // Se descifra SIEMPRE para presentar, aunque el snapshot tenga los
      // últimos 4 guardados. Esos 4 no están autenticados: si el sobre fue
      // alterado, mostrarlos daría una apariencia de integridad que no existe.
      // Si la llave no está o el sobre no abre, no se muestra nada.
      try {
        const claro = descifrar(
          valor,
          id_empresa,
          PROPOSITO_EMPRESA_SNAPSHOT,
          CAMPO_EMPRESA_REP
        );
        claroParaHash = claro;
        numero = representanteService.MASCARA
          + representanteService.ultimosDeTexto(claro);
      } catch (e) {
        logger.warn('No se pudo descifrar el documento del representante del snapshot', {
          error: e.message,
        });
        numero = null;
      }
    } else {
      claroParaHash = valor;
      numero = representanteService.MASCARA
        + representanteService.ultimosDeTexto(valor);
    }
  }

  let hashVerificado = null;
  if (hashEsperado) {
    if (claroParaHash !== null) {
      const paraHash = Object.assign({}, obj, {
        representante_legal_identificacion: claroParaHash,
      });
      hashVerificado = hashSnapshotEmpresa(paraHash) === hashEsperado;
    } else {
      hashVerificado = false;
    }
    if (!hashVerificado) {
      logger.warn('La huella del snapshot de empresa no coincide con la copia', {
        id_empresa,
      });
      numero = null;
    }
  }

  copia.representante_legal_identificacion = numero;
  copia.representante_legal_identificacion_enmascarada = numero;
  copia.representante_legal_identificacion_ultimos4 = numero
    ? numero.slice(-representanteService.ULTIMOS)
    : null;
  copia.empresa_hash_verificado = hashVerificado;
  return copia;
}

/**
 * Texto que el PDF puede imprimir para el documento del representante.
 *
 * Es la última barrera: aunque el llamador pase el objeto crudo (con el
 * número completo), esta función NO lo devuelve. Si no hay una versión
 * enmascarada válida, dice `No disponible`; nunca `CC —`.
 *
 * @param {object|null} empresaId
 * @returns {string}
 */
function documentoRepresentanteParaMostrar(empresaId) {
  if (!empresaId || typeof empresaId !== 'object') return 'No disponible';

  const enmascarada = empresaId.representante_legal_identificacion_enmascarada;
  if (typeof enmascarada === 'string'
    && enmascarada.startsWith(representanteService.MASCARA)) {
    return enmascarada;
  }

  const valor = empresaId.representante_legal_identificacion;
  if (typeof valor === 'string' && valor.startsWith(representanteService.MASCARA)) {
    return valor;
  }

  return 'No disponible';
}

/**
 * Los dominios CORPORATIVOS de una Empresa (D-2).
 *
 * Son dos fuentes, sumadas:
 *
 *   1. La lista EXPRESA (`dominios_corporativos`, migración 031). La declara
 *      el operador: sirve para los dominios que no aparecen en ningún correo
 *      de la ficha (por ejemplo, cuando la empresa usa un dominio de correo
 *      distinto del de sus canales).
 *   2. Los DERIVADOS de los correos que la Empresa ya registró: los canales
 *      de PQRS y de incidentes, el responsable de tratamiento y el canal para
 *      pedir copia. Esos correos son de la Empresa por definición.
 *
 * Se suman para no depender de que alguien declare la lista completa: un
 * dominio que se deduce de los canales de la empresa ES corporativo, se
 * declare o no.
 *
 * @param {string} id_empresa
 * @returns {Set<string>} los dominios en minúsculas, sin "@"
 */
function dominiosCorporativos(id_empresa) {
  const dominios = new Set();
  const empresa = getById(id_empresa);
  if (!empresa) return dominios;

  // 1. La lista explícita.
  const explicitos = typeof empresa.dominios_corporativos === 'string'
    ? empresa.dominios_corporativos
    : '';
  for (const parte of explicitos.split(',')) {
    const d = _dominio(parte);
    if (d) dominios.add(d);
  }

  // 2. Los derivados de los correos de la ficha.
  const correos = [
    empresa.canal_pqrs,
    empresa.canal_incidentes,
    empresa.responsable_tratamiento_correo,
    empresa.canal_solicitud_copia,
  ];
  for (const correo of correos) {
    const d = _dominio(correo);
    if (d) dominios.add(d);
  }

  return dominios;
}

/**
 * El dominio de un correo, en minúsculas y sin el "@".
 * @param {string} valor
 * @returns {string|null}
 */
function _dominio(valor) {
  if (typeof valor !== 'string') return null;
  const s = valor.trim().toLowerCase();
  if (!s) return null;
  // Acepta un correo ("rrhh@empresa.com") o un dominio suelto
  // ("empresa.com"), que es como se declara la lista explicita.
  const d = s.includes('@') ? s.split('@').pop() : s;
  return d && d.includes('.') ? d : null;
}

/**
 * ¿Este correo cae en un dominio corporativo de la Empresa?
 *
 * @param {string} correo
 * @param {string} id_empresa
 * @returns {boolean}
 */
function esDominioCorporativo(correo, id_empresa) {
  const d = _dominio(correo);
  if (!d) return false;
  return dominiosCorporativos(id_empresa).has(d);
}

module.exports = {
  SNAPSHOT_FIELDS,
  EDITABLE_FIELDS,
  PROPOSITO_EMPRESA_SNAPSHOT,
  CAMPO_EMPRESA_REP,
  getById,
  getActiva,
  buildSnapshot,
  snapshotColumnsFor,
  cifrarSnapshotEmpresa,
  descifrarSnapshotEmpresa,
  hashSnapshotEmpresa,
  parseSnapshot,
  parseSnapshotParaMostrar,
  documentoRepresentanteParaMostrar,
  publicViewFor,
  create,
  update,
  marcarAnexoFirmado,
  setActivo,
  verificarHabilitacionFirma,
  dominiosCorporativos,
  esDominioCorporativo,
  list,
  listConPendientes,
};