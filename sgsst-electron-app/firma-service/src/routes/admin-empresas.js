/**
 * Rutas admin para la identificación de las empresas cliente (migración 017).
 *
 * Endpoints protegidos por X-Admin-API-Key, igual que
 * /internal/admin/acuerdo-versiones y /internal/admin/clientes. NO son
 * expuestos a K+AIR: son de operador humano.
 *
 * POR QUÉ EXISTE UN CRUD ADMIN Y NO LO PIDE EL CLIENTE
 * ----------------------------------------------------
 * El `id_empresa` ya lo manda el cliente autenticado (`req.id_empresa`, ver
 * middleware/authz.js). Lo que el cliente NO puede mandar son los datos que
 * le muestran al trabajador: si el puente pudiera declarar "la empresa X se
 * llama Y, tiene domicilio Z", un cliente comprometido podría suplantar la
 * identificación de otra empresa en la pantalla de firma. Por eso la
 * escritura es solo por admin.
 *
 * Endpoints:
 *   GET    /internal/admin/empresas            lista con pendientes
 *   GET    /internal/admin/empresas/:id        una empresa
 *   GET    /internal/admin/empresas/:id/anexos las suscripciones de los dos anexos
 *   POST   /internal/admin/empresas            alta
 *   PUT    /internal/admin/empresas/:id        actualizar identidad
 *   POST   /internal/admin/empresas/:id/anexo-firmado
 *   POST   /internal/admin/empresas/:id/anexo-firmado/quitar
 *   POST   /internal/admin/empresas/:id/anexo-suscrito/quitar
 *   POST   /internal/admin/empresas/:id/anexo-nube/suscripcion
 *   POST   /internal/admin/empresas/:id/anexo-nube/suscripcion/:id_suscripcion/anular
 *   POST   /internal/admin/empresas/:id/anexo-nube/contrafirmar/codigo
 *   POST   /internal/admin/empresas/:id/anexo-nube/contrafirmar
 *   POST   /internal/admin/empresas/:id/anexo-encargo/suscripcion
 *   POST   /internal/admin/empresas/:id/anexo-encargo/suscripcion/:id_suscripcion/anular
 *   POST   /internal/admin/empresas/:id/anexo-encargo/suscripcion/:id_suscripcion/verificar-representante
 *   POST   /internal/admin/empresas/:id/anexo-encargo/contrafirmar/codigo
 *   POST   /internal/admin/empresas/:id/anexo-encargo/contrafirmar
 *   POST   /internal/admin/empresas/:id/estado  alta/baja lógica
 *   POST   /internal/admin/empresas/:id/fecha-terminacion
 *   GET    /internal/admin/empresas/:id/fecha-terminacion/pendientes
 */
'use strict';

const express = require('express');
const router = express.Router();
const { adminApiAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const logger = require('../utils/logger');
const empresaService = require('../services/empresa');
const anexoNubeService = require('../services/anexoNube');
const anexoEncargoService = require('../services/anexoEncargo');
const actaEncargoService = require('../services/actaEncargo');
const auditoriaService = require('../services/empresaAuditoria');
const cuentaEnvioService = require('../services/cuentaEnvio');
const fechaTerminacionService = require('../services/fechaTerminacion');
const mailer = require('../services/mailer');
const {
  idEmpresa,
  createEmpresaBody,
  updateEmpresaBody,
  anexoBody,
  anexoNubeBody,
  suscripcionAnexoNubeBody,
  suscripcionAnexoEncargoBody,
  verificarRepresentanteBody,
  contrafirmaCodigoBody,
  contrafirmaBody,
  contrafirmaFacultadBody,
  setActivoBody,
  cuentaEnvioBody,
  probarCuentaEnvioBody,
  fechaTerminacionBody,
} = require('../schemas/admin-empresas');
const { AppError } = require('../middleware/errors');

/**
 * Arma el contexto de auditoria de un request admin.
 *
 * `adminApiAuth()` SOLO dice "esta peticion viene con la API key administrativa":
 * no dice quien la hizo. Para que el rastro de la ficha tenga un "quien" real,
 * el operador puede declarar el actor con el header `X-Admin-Actor` (quien
 * firma el cambio) y el motivo con `X-Admin-Motivo`. Si no se declara nada,
 * el rastro queda con `admin` como actor: el cambio sigue siendo visible (que
 * es lo que el abogado exige: "sin el, el override no deja rastro"), pero no
 * se le atribuye a una persona.
 *
 * El motivo va en HEADER y no en el body a proposito: el body de `PUT
 * /empresas/:id` es un REEMPLAZO de la ficha, y meter el motivo ahi lo
 * contaminaria (el service no lo reconoceria como campo de la Empresa).
 *
 * @param {object} req
 * @returns {{actor: string|null, motivo: string|null, ip: string|null, user_agent: string|null}}
 */
function _contextoAuditoria(req) {
  const actor = req.get('X-Admin-Actor');
  const motivo = req.get('X-Admin-Motivo');
  return {
    actor: typeof actor === 'string' && actor.trim() ? actor.trim().slice(0, 200) : null,
    motivo: typeof motivo === 'string' && motivo.trim() ? motivo.trim().slice(0, 500) : null,
    ip: req.ip || req.socket?.remoteAddress || null,
    user_agent: req.get('User-Agent') || null,
  };
}

/**
 * El texto de un header, decodificado como UTF-8.
 *
 * POR QUÉ: Node decodifica los headers como latin1, así que un actor
 * escrito con tilde ("Julián") llega como "JuliÃ¡n". Sin esta corrección, el
 * rastro de la cuenta de envío guardaría el nombre del operador hecho
 * pedazos, y el rastro es justo lo que tiene que poder leerse después.
 *
 * El viaje de ida y vuelta solo se aplica si el resultado es UTF-8 válido: si
 * el cliente mandó ASCII, el texto no cambia.
 *
 * @param {string} valor
 * @returns {string}
 */
function _textoUtf8(valor) {
  if (typeof valor !== 'string' || !valor) return valor;
  try {
    const utf8 = Buffer.from(valor, 'latin1').toString('utf8');
    if (!utf8.includes('\uFFFD')) return utf8;
  } catch (e) {
    // Si no se puede reinterpretar, se deja el valor como vino.
  }
  return valor;
}

/**
 * El contexto de auditoría de la cuenta de envío.
 *
 * Es el de `_contextoAuditoria`, con el texto de los headers corregido: en el
 * rastro de la cuenta de envío el nombre del operador tiene que leerse.
 *
 * @param {object} req
 * @returns {{actor: string|null, motivo: string|null, ip: string|null, user_agent: string|null}}
 */
function _contextoAuditoriaCuentaEnvio(req) {
  const ctx = _contextoAuditoria(req);
  return {
    actor: ctx.actor ? _textoUtf8(ctx.actor) : ctx.actor,
    motivo: ctx.motivo ? _textoUtf8(ctx.motivo) : ctx.motivo,
    ip: ctx.ip,
    user_agent: ctx.user_agent,
  };
}

/**
 * Lee y valida el path param id_empresa con el mismo schema que se usa para
 * el body. Devuelve el string ya normalizado (trim).
 */
function _parseId(req) {
  const r = idEmpresa.safeParse(req.params.id_empresa);
  if (!r.success) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'id_empresa inválido', {
        issues: r.error.issues.map((i) => ({
          path: i.path.join('.'), message: i.message, code: i.code,
        })),
      });
  }
  return r.data;
}

// ============================================================================
// GET /internal/admin/empresas
// Devuelve todas las empresas con el detalle de qué les falta, para que el
// operador no de de alta una con la identificación a medias sin notarlo.
// ============================================================================
router.get('/empresas', adminApiAuth(), (req, res, next) => {
  try {
    res.json({ items: empresaService.listConPendientes() });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /internal/admin/empresas/:id
// ============================================================================
router.get('/empresas/:id_empresa', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const empresa = empresaService.getById(id);
    if (!empresa) {
      throw new AppError(404, 'EMPRESA_NOT_FOUND',
        `No existe la empresa ${id}`, { id_empresa: id });
    }
    // Se incluye la huella que se archivará en cada firma, para que el
    // operador pueda confirmar que lo que está viendo es lo que se archiva.
    const snap = empresaService.buildSnapshot(id);
    res.json({
      ...empresa,
      huella_snapshot: snap ? snap.huella : null,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas
// ============================================================================
router.post('/empresas', adminApiAuth(), validateBody(createEmpresaBody), (req, res, next) => {
  try {
    const creada = empresaService.create(req.body);
    res.status(201).json(creada);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PUT /internal/admin/empresas/:id_empresa
// Actualiza la identificacion. Cada campo que REALMENTE cambia queda
// rastreado (migraciones 037 y 038): como este PUT es un reemplazo completo,
// un guardado de escritorio puede pisar un canal de PQRS declarado por via
// administrativa, y el abogado exige que ese override deje rastro.
// ============================================================================
router.put('/empresas/:id_empresa', adminApiAuth(), validateBody(updateEmpresaBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    const actualizada = empresaService.update(id, req.body, _contextoAuditoria(req));
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /internal/admin/empresas/:id_empresa/historial
// El rastro de los cambios de la ficha, del mas reciente al mas antiguo.
//
// Es el endpoint que responde "de donde salio este canal": quien lo cambio,
// cuando, desde donde, por que, y de que valor a que valor.
// ============================================================================
router.get('/empresas/:id_empresa/historial', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const limiteRaw = req.query.limite;
    let limite = 200;
    if (limiteRaw !== undefined) {
      const n = Number(limiteRaw);
      if (!Number.isInteger(n) || n <= 0 || n > 1000) {
        throw new AppError(400, 'INVALID_REQUEST_BODY',
          'limite debe ser un entero entre 1 y 1000');
      }
      limite = n;
    }
    res.json({ items: auditoriaService.historial(id, { limite }) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /internal/admin/empresas/:id_empresa/anexos
// La lectura que necesita el PANEL DE OPERADOR: la suscripción viva de cada
// anexo (la más reciente) y el rastro de eventos de esa suscripción.
//
// POR QUÉ ESTA RUTA HACÍA FALTA
// -----------------------------
// Las tres acciones de la contrafirma ("verificar-representante",
// "contrafirmar/codigo" y "contrafirmar") y el "anular" exigen el
// `id_suscripcion` en el path, y ese id NO está en la ficha de la Empresa ni
// en ninguna respuesta de lectura. Sin esta ruta, el operador tenía que abrir
// la consola para descubrir el id de una suscripción.
//
// EL TOKEN EN CLARO NO SE PUEDE RECUPERAR
// ---------------------------------------
// En la base solo vive su huella (`token_hash`), y la ruta de alta es la
// única que lo devuelve en claro. Esta ruta no lo intenta: no se puede.
//
// LO QUE NO SE DEVUELVE
// ---------------------
// Ni `token_hash`, ni `otp_hash`, ni `contrafirma_otp_hash`, ni
// `canal_codigo_tipo`: son las llaves y los contadores del mecanismo, y el
// operador no los necesita para cumplir la contrafirma. El `canal_codigo` sí
// se devuelve (el operador lo declaró al abrir la suscripción y lo necesita
// para el expediente) y el `contrafirma_canal` va ENMASCARADO, con la misma
// función que usa el acta.
// ============================================================================

/**
 * Parsea una columna que es JSON EN TEXTO.
 *
 * `representante_verificacion` y `evidencia` se guardan como texto (el
 * SQLite no tiene un tipo JSON). Si el texto no parsea, NO se inventa nada:
 * se devuelve `null` y el operador ve que no hay evidencia legible, que es
 * muy distinto de ver un objeto vacío.
 *
 * @param {string|null} texto
 * @returns {object|null}
 */
function _json(texto) {
  if (typeof texto !== 'string' || texto.length === 0) return null;
  try {
    const valor = JSON.parse(texto);
    return (valor && typeof valor === 'object') ? valor : null;
  } catch (e) {
    return null;
  }
}

/**
 * La suscripción del Anexo de ENCARGO, en la forma que la lee el operador.
 *
 * `FIRMADA` en esta tabla significa que la EMPRESA suscribió (fase 1), NO que
 * el instrumento esté ejecutado: para eso está `contrafirmado_at` (fase 2).
 *
 * @param {object|null} fila - la fila cruda, o null si no hay suscripción.
 * @returns {object|null}
 */
function _suscripcionEncargo(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    estado: fila.estado,
    version: fila.version,
    hash: fila.hash_texto,
    correo_firmante: fila.correo_firmante,
    canal_codigo: fila.canal_codigo || null,
    nombre_firmante: fila.nombre_firmante || null,
    cargo_firmante: fila.cargo_firmante || null,
    firmado_at: fila.firmado_at || null,
    contrafirmado_at: fila.contrafirmado_at || null,
    // El SEGUNDO ACTO, en la misma forma que lo expone el Anexo de Nube
    // (`_suscripcionNube`): el actor que hizo la contrafirma y la EVIDENCIA
    // del acto.
    //
    // La evidencia es la que lleva la ACREDITACION DE LA FACULTAD de quien
    // contrafirmo por Gesstiar (P7, 10-nov-2026). Sin este campo, el panel
    // del operador no tiene de donde sacarla y muestra "NO DECLARADA" en un
    // Anexo de Encargo que si la tiene acreditada: un falso negativo en la
    // pantalla que hace creer que falta lo que ya esta en el expediente.
    contrafirma_actor: fila.contrafirma_actor || null,
    contrafirma_motivo: fila.contrafirma_motivo || null,
    contrafirma_evidencia: _json(fila.contrafirma_evidencia),
    representante_verificacion: _json(fila.representante_verificacion),
    representante_verificado_at: fila.representante_verificado_at || null,
    // El canal de la CONTRAFIRMA va enmascarado: es el buzón de K+AIR, y la
    // misma función que usa el acta es la que lo enmascara acá (si fueran
    // dos implementaciones distintas, el operador vería un correo y el acta
    // otro).
    contrafirma_canal: fila.contrafirma_canal
      ? actaEncargoService.enmascararCorreo(fila.contrafirma_canal) : null,
    evidencia: _json(fila.evidencia),
    contrafirma_acta_archivo: fila.contrafirma_acta_archivo || null,
    contrafirma_acta_hash: fila.contrafirma_acta_hash || null,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
  };
}

/**
 * La suscripción del Anexo de NUBE, en la forma que la lee el operador.
 *
 * 📦1047 · punto 3 El Anexo de Nube SÍ es bilateral (el texto vigente, §10): lo
 * suscribe la Empresa (fase 1) y lo contrafirma K+AIR (fase 2), y el
 * instrumento solo queda EJECUTADO con los dos actos. Antes esta forma
 * devolvía `null` en todos los campos de la fase 2 y el comentario decía que
 * "el Anexo de Nube NO es bilateral": era verdad el día anterior y pasó a ser
 * mentira sin que nadie lo tocara (ver la trampa 148 de PROMPT.md). Ahora
 * devuelve los datos REALES del segundo acto.
 *
 * `estado = FIRMADA` sigue siendo el de la FASE 1 (que la Empresa suscribió),
 * NO el del instrumento: para eso está `contrafirmado_at` (fase 2). Es lo
 * mismo que en el gemelo del Anexo de Encargo.
 *
 * `representante_verificacion` y `representante_verificado_at` van en `null`
 * porque el Anexo de Nube NO tiene verificación documental (no hay columna ni
 * ruta: el cotejo es contra el `representante_legal` de la ficha). Eso NO es
 * una falta de la fase 2: es una diferencia real con el Anexo de Encargo, y
 * por eso el panel puede leer los dos anexos con la misma forma.
 *
 * La lectura es TOLERANTE: si la migración 060 no está aplicada en la base de
 * destino, las columnas no existen y estos campos vienen en `null` (fallo
 * CERRADO: no se inventa una contrafirma que no se puede leer).
 *
 * @param {object|null} fila - la fila cruda, o null si no hay suscripción.
 * @returns {object|null}
 */
function _suscripcionNube(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    estado: fila.estado,
    version: fila.version,
    hash: fila.hash_texto,
    correo_firmante: fila.correo_firmante,
    // El SEGUNDO canal del código. En el Anexo de Nube NO existe: la
    // suscripción manda su código al correo del firmante
    // (`correo_firmante`), y el de la CONTRAFIRMA va al buzón fijo de K+AIR
    // (`contrafirma_canal`, más abajo). Va en `null` para que el panel pueda
    // leer los dos anexos con la misma forma.
    canal_codigo: null,
    nombre_firmante: fila.nombre_firmante || null,
    cargo_firmante: fila.cargo_firmante || null,
    firmado_at: fila.firmado_at || null,
    // EL SEGUNDO ACTO.
    contrafirmado_at: fila.contrafirmado_at || null,
    contrafirma_actor: fila.contrafirma_actor || null,
    contrafirma_motivo: fila.contrafirma_motivo || null,
    contrafirma_codigo_enviado_at: fila.contrafirma_codigo_enviado_at || null,
    contrafirma_canal: fila.contrafirma_canal
      ? actaEncargoService.enmascararCorreo(fila.contrafirma_canal) : null,
    contrafirma_estado: fila.contrafirma_estado || null,
    contrafirma_evidencia: _json(fila.contrafirma_evidencia),
    // La verificación documental no existe en este instrumento: el cotejo es
    // contra el representante legal de la ficha.
    representante_verificacion: null,
    representante_verificado_at: null,
    evidencia: _json(fila.evidencia),
    contrafirma_acta_archivo: fila.contrafirma_acta_archivo || null,
    contrafirma_acta_hash: fila.contrafirma_acta_hash || null,
    contrafirma_acta_bytes: fila.contrafirma_acta_bytes || null,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
  };
}

/**
 * El bloque de un anexo: su suscripción más reciente y el rastro de esa
 * suscripción.
 *
 * @param {object[]} suscripciones - de la más reciente a la más antigua.
 * @param {function} leerEventos - `eventosDeSuscripcion(id)`.
 * @param {function} forma - `_suscripcionEncargo` o `_suscripcionNube`.
 * @returns {{suscripcion: object|null, eventos: object[]}}
 */
function _bloqueAnexo(suscripciones, leerEventos, forma) {
  const fila = Array.isArray(suscripciones) && suscripciones.length > 0
    ? suscripciones[0] : null;
  if (!fila) return { suscripcion: null, eventos: [] };
  return {
    suscripcion: forma(fila),
    eventos: leerEventos(fila.id),
  };
}

router.get('/empresas/:id_empresa/anexos', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    res.json({
      id_empresa: id,
      anexo_encargo: _bloqueAnexo(
        anexoEncargoService.suscripcionesDeEmpresa(id),
        anexoEncargoService.eventosDeSuscripcion,
        _suscripcionEncargo,
      ),
      anexo_nube: _bloqueAnexo(
        anexoNubeService.suscripcionesDeEmpresa(id),
        anexoNubeService.eventosDeSuscripcion,
        _suscripcionNube,
      ),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-firmado
// Registra la fecha de firma del Anexo de Encargo (art. 25 Decreto 1377/2013).
// Endpoint separado para que ese dato, que sustenta el cumplimiento legal,
// no se modifique en una actualización de rutina.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-firmado', adminApiAuth(), validateBody(anexoBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    const empresa = empresaService.marcarAnexoFirmado(id, req.body.fecha, _contextoAuditoria(req));
    res.json(empresa);
  } catch (err) {
    next(err);
  }
});

// Registra la versión del Anexo de Nube suscrita por esta Empresa.
router.post('/empresas/:id_empresa/anexo-nube-firmado', adminApiAuth(), validateBody(anexoNubeBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    const empresa = empresaService.marcarAnexoNubeFirmado(id, req.body, _contextoAuditoria(req));
    res.json(empresa);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-nube/suscripcion
// Abre una suscripción del Anexo de Nube y manda el enlace a la Empresa.
//
// Es el paso previo a `anexo-nube-firmado`: en vez de que un operador
// registre la firma a mano, la Empresa la hace por su cuenta en la pantalla
// de suscripción, con un enlace de un solo uso y un código de verificación.
//
// LO QUE DEVUELVE
//   El enlace en claro (para mandarlo por el canal que el operador prefiera)
//   y la versión y la huella del texto que se va a suscribir.
//
// LO QUE NO HACE
//   No elige la versión: la saca del archivo del servidor y calcula su
//   huella. Si el archivo no está, se niega (503) en vez de inventar una.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-nube/suscripcion', adminApiAuth(), validateBody(suscripcionAnexoNubeBody), async (req, res, next) => {
  try {
    const id = _parseId(req);
    const r = await anexoNubeService.crearSuscripcion(id, req.body, _contextoAuditoria(req));
    res.status(201).json(r);
  } catch (err) {
    next(err);
  }
});

// Da de baja una suscripción que todavía no se firmó.
router.post('/empresas/:id_empresa/anexo-nube/suscripcion/:id_suscripcion/anular', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const idSuscripcion = parseInt(req.params.id_suscripcion, 10);
    if (!Number.isInteger(idSuscripcion) || idSuscripcion <= 0) {
      throw new AppError(400, 'INVALID_REQUEST_BODY', 'id_suscripcion inválido');
    }
    const r = anexoNubeService.anularSuscripcion(id, idSuscripcion, _contextoAuditoria(req));
    res.json(r);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-encargo/suscripcion
// Abre una suscripción del Anexo de Encargo y manda el enlace a la Empresa.
//
// POR QUÉ ESTA RUTA NO ESTABA EN EL PLAN
// --------------------------------------
// El §4.3 del plan listaba las rutas públicas y la de contrafirma, pero no la
// que ABRE la suscripción. Sin ella el servicio del Anexo de Encargo era
// código muerto: nadie podía abrir una suscripción y el flujo no era
// alcanzable por HTTP. Es el mismo hueco que ya se había cerrado para el
// Anexo de Nube (`/anexo-nube/suscripcion`), replicado aquí.
//
// LO QUE DEVUELVE
//   El enlace en claro (para mandarlo por el canal que el operador prefiera),
//   la versión y la huella del texto que se va a suscribir, y el prellenado
//   de los cinco datos del §11.
//
// LO QUE NO HACE
//   No elige la versión: la lee del manifiesto legal y la contrasta con los
//   bytes del archivo del servidor. Si el texto del servidor no es el que
//   declara el manifiesto, no se abre nada (503): es un fallo de despliegue,
//   no un error de la Empresa.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-encargo/suscripcion', adminApiAuth(), validateBody(suscripcionAnexoEncargoBody), async (req, res, next) => {
  try {
    const id = _parseId(req);
    const r = await anexoEncargoService.crearSuscripcion(id, req.body, _contextoAuditoria(req));
    res.status(201).json(r);
  } catch (err) {
    next(err);
  }
});

// Da de baja una suscripción del Anexo de Encargo que todavía no se firmó.
//
// Es el mismo camino que el del Anexo de Nube: lo que YA se firmó no se toca
// por aquí (eso se corrige por el camino administrativo, con motivo); lo que
// está pendiente se da de baja y queda el motivo en el rastro.
router.post('/empresas/:id_empresa/anexo-encargo/suscripcion/:id_suscripcion/anular', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const idSuscripcion = parseInt(req.params.id_suscripcion, 10);
    if (!Number.isInteger(idSuscripcion) || idSuscripcion <= 0) {
      throw new AppError(400, 'INVALID_REQUEST_BODY', 'id_suscripcion inválido');
    }
    const r = anexoEncargoService.anularSuscripcion(id, idSuscripcion, _contextoAuditoria(req));
    res.json(r);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-encargo/suscripcion/:id_suscripcion/verificar-representante
// Registra la verificación documental de quien firmó el Anexo de Encargo.
//
// POR QUÉ ESTE PASO NO ES UN ADITIVO
// ----------------------------------
// El método de firma probaba control de un buzón, no que quien firmara fuera
// el representante legal ni que tuviera poder. Para un contrato sobre datos de
// salud eso es insuficiente: la Empresa podría alegar que el firmante no
// tenía poder (pregunta 7 del abogado, 7-nov-2026).
//
// La verificación la hace K+AIR contra el certificado de existencia y
// representación de la cámara de comercio, contra el RUT de la Empresa o
// contra el poder, según la calidad con la que se firmó. Queda en el
// expediente con quién la hizo, cuándo y contra qué documento.
//
// ES UN REQUISITO DE LA CONTRAFIRMA
// ---------------------------------
// K+AIR no contrafirma el Anexo sin esta verificación registrada. Por eso
// exige `X-Admin-Motivo`: es un acto con efecto sobre el expediente.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-encargo/suscripcion/:id_suscripcion/verificar-representante',
  adminApiAuth(), validateBody(verificarRepresentanteBody), (req, res, next) => {
    try {
      const id = _parseId(req);
      const idSuscripcion = parseInt(req.params.id_suscripcion, 10);
      if (!Number.isInteger(idSuscripcion) || idSuscripcion <= 0) {
        throw new AppError(400, 'INVALID_REQUEST_BODY', 'id_suscripcion inválido');
      }
      const r = anexoEncargoService.verificarRepresentante(
        id, idSuscripcion, req.body, _contextoAuditoria(req),
      );
      res.json(r);
    } catch (err) {
      next(err);
    }
  });

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-encargo/contrafirmar/codigo
// Manda el código de la CONTRAFIRMA al buzón de protección de datos de K+AIR.
//
// EL CANAL NO SE DECLARA
// ----------------------
// El código sale al buzón que dice la CONFIGURACIÓN
// (FIRMA_CANAL_PROTECCION_DATOS), no a uno que elija quien pide la
// contrafirma. Es la misma razón por la que el segundo canal de la
// suscripción lo declara K+AIR y no la Empresa: un canal elegido por quien
// pide el acto no probaría nada.
//
// ESTA RUTA NO CONTRAFIRMA NADA
// -----------------------------
// Solo manda el código. El acto es otra ruta, la de la contrafirma, que pide
// el código, la aceptación expresa y el motivo. Separarlas deja claro que
// pedir el código no es contrafirmar.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-encargo/contrafirmar/codigo',
  adminApiAuth(), validateBody(contrafirmaCodigoBody), async (req, res, next) => {
    try {
      const id = _parseId(req);
      const r = await anexoEncargoService.solicitarCodigoContrafirma(
        id, req.body.id_suscripcion, _contextoAuditoria(req),
      );
      res.json(r);
    } catch (err) {
      next(err);
    }
  });

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-encargo/contrafirmar
// Contrafirma el Anexo de Encargo: el SEGUNDO acto del instrumento.
//
// QUÉ HACE
//   Verifica el código (que salió al buzón de K+AIR), exige la aceptación
//   expresa y el motivo, genera el acta de la contrafirma y escribe la fecha
//   de EJECUCIÓN del instrumento en la ficha de la Empresa. Con esa fecha, y
//   solo con ella, la Empresa queda habilitada para firmar documentos de sus
//   trabajadores.
//
// LO QUE EXIGE (y por qué)
//   - Que la Empresa haya suscrito: no se contrafirma lo que no se firmó.
//   - Que K+AIR haya verificado documentalmente a quien firmó por ella: es
//     lo que el abogado señaló como la grieta del método.
//   - El código: sale al buzón de K+AIR, no al de la Empresa.
//   - La aceptación expresa: la contrafirma no es un valor por omisión.
//   - El motivo (`X-Admin-Motivo`): es un acto que habilita a la Empresa.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-encargo/contrafirmar',
  adminApiAuth(), validateBody(contrafirmaBody), async (req, res, next) => {
    try {
      const id = _parseId(req);
      const r = await anexoEncargoService.contrafirmar(
        id, req.body.id_suscripcion, req.body, _contextoAuditoria(req),
      );
      res.json(r);
    } catch (err) {
      next(err);
    }
  });
// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-nube/contrafirmar/codigo
// Manda el código de la CONTRAFIRMA al buzón de protección de datos de K+AIR.
//
// EL CANAL NO SE DECLARA
// ----------------------
// El código sale al buzón que dice la CONFIGURACIÓN
// (FIRMA_CANAL_PROTECCION_DATOS), no a uno que elija quien pide la
// contrafirma. Es la misma razón por la que el código de la suscripción no
// sale al buzón de la Empresa: un canal elegido por quien pide el acto no
// probaría nada.
//
// ESTA RUTA NO CONTRAFIRMA NADA
// -----------------------------
// Solo manda el código. El acto es otra ruta, la de la contrafirma, que pide
// el código, la aceptación expresa y el motivo. Separarlas deja claro que
// pedir el código no es contrafirmar.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-nube/contrafirmar/codigo',
  adminApiAuth(), validateBody(contrafirmaCodigoBody), async (req, res, next) => {
    try {
      const id = _parseId(req);
      const r = await anexoNubeService.solicitarContrafirmaAnexoNube(
        id, req.body.id_suscripcion, _contextoAuditoria(req),
      );
      res.json(r);
    } catch (err) {
      next(err);
    }
  });

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-nube/contrafirmar
// Contrafirma el Anexo de Nube: el SEGUNDO acto del instrumento.
//
// QUÉ HACE
//   Verifica el código (que salió al buzón de K+AIR), exige la aceptación
//   expresa y el motivo, genera el acta de la contrafirma con su huella
//   SHA-256 y escribe la fecha de EJECUCIÓN del instrumento en la ficha de la
//   Empresa. Con esa fecha, y solo con ella, el Anexo de Nube queda
//   EJECUTADO para esa Empresa.
//
// LO QUE EXIGE (y por qué)
//   - Que la Empresa haya suscrito: no se contrafirma lo que no se firmó.
//   - Que se sepa quién firmó por la Empresa: el §10 del texto vigente exige
//     verificarlo antes de contrafirmar.
//   - El código: sale al buzón de K+AIR, no al de la Empresa.
//   - La aceptación expresa: la contrafirma no es un valor por omisión.
//   - El motivo (`X-Admin-Motivo`): es un acto que ejecuta el instrumento.
//
// LO QUE NO HACE
//   No toca `anexo_nube_firmado_at`: esa es la fecha del PRIMER acto (la
//   suscripción). La fecha del segundo acto va en `anexo_nube_ejecutado_at`.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-nube/contrafirmar',
  adminApiAuth(), validateBody(contrafirmaBody), async (req, res, next) => {
    try {
      const id = _parseId(req);
      const r = await anexoNubeService.contrafirmarAnexoNube(
        id, req.body.id_suscripcion, req.body, _contextoAuditoria(req),
      );
      res.json(r);
    } catch (err) {
      next(err);
    }
  });

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-nube/contrafirma/facultad
// Certifica la FACULTAD de una contrafirma del Anexo de Nube YA HECHA.
//
// CUANDO SE USA
// -------------
// Cuando la contrafirma se hizo con un despliegue anterior a la exigencia del
// abogado (P7, 10-nov-2026): el segundo acto quedo registrado sin la
// acreditacion de la facultad. El manifiesto declara entonces
// `contrafirma_facultad: null` y el item `contrafirma_nube` del gate NO puede
// quedar ok.
//
// QUE HACE
// --------
// Comprueba que la persona que HIZO EL ACTO tenga la facultad acreditada (es
// el `contrafirma_actor` que quedo registrado, no quien llama) y escribe esa
// acreditacion en la evidencia del acto y en su rastro, con su actor y su
// motivo.
//
// QUE NO HACE
// -----------
// No toca `contrafirmado_at`, ni la huella del acta, ni
// `anexo_nube_ejecutado_at`: el segundo acto ya ocurrio y no se reescribe. Lo
// que se anade es el dato que le faltaba.
//
// ES UN ACTO ADMINISTRATIVO
// --------------------------
// Exige `X-Admin-Actor` y `X-Admin-Motivo`, como todos los de este servicio.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-nube/contrafirma/facultad',
  adminApiAuth(), validateBody(contrafirmaFacultadBody), (req, res, next) => {
    try {
      const id = _parseId(req);
      const r = anexoNubeService.registrarFacultadEnContrafirma(
        id, req.body.id_suscripcion, _contextoAuditoria(req),
      );
      res.json(r);
    } catch (err) {
      next(err);
    }
  });

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-firmado/quitar
// Quita la fecha de firma del Anexo de Encargo.
//
// Es la salida auditada para una marca equivocada: exige `X-Admin-Motivo`,
// escribe el valor anterior y el nuevo (null) en el historial append-only y
// deja un WARN en el log. Sin este camino, la unica forma de corregir seria
// tocar la base a mano, sin rastro.
//
// Despues de quitarla, D-03 vuelve a bloquear la Empresa hasta que se registre
// una fecha respaldada por el PDF firmado.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-firmado/quitar', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const empresa = empresaService.desmarcarAnexoFirmado(id, _contextoAuditoria(req));
    res.json(empresa);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-suscrito/quitar
// Quita el registro de la SUSCRIPCIÓN (fase 1) del Anexo de Encargo.
//
// POR QUÉ ESTA RUTA EXISTE
// ------------------------
// El Anexo de Encargo se versiona por fecha: cuando el texto vigente cambia,
// la Empresa tiene que SUSCRIBIR DE NUEVO, porque la suscripción anterior
// describe un texto que ya no rige. `services/anexoEncargo.js` lo dice
// expressly: si la Empresa ya tiene un Anexo (suscrito o firmado) y la
// suscripción nueva es de OTRO texto, la suscripción pública se rechaza con
// 409 SUSCRIPCION_EXISTENTE y avisa de que "la corrección se registra por el
// canal administrativo, con su motivo".
//
// Ese canal administrativo NO existía por HTTP: la función que deshace la
// fase 1 (`empresaService.desmarcarAnexoSuscrito`) estaba escrita, probada y
// exportada, pero ninguna ruta la llamaba. El resultado era un callejón: el
// Anexo de Encargo no se podía re-suscribir.
//
// LO QUE HACE
// ------------
// Pone en NULL los cuatro campos de la fase 1 en la ficha de la Empresa
// (`anexo_encargo_suscrito_at`, `_version`, `_hash` y `_evidencia`), con el
// valor anterior en el historial append-only, el actor y el motivo.
//
// LO QUE NO HACE
// ---------------
// - No toca `anexo_encargo_firmado_at`: esa es la fecha del SEGUNDO acto
//   (la contrafirma de K+AIR). Si hay que quitarla, es otra ruta y otro
//   motivo: `POST .../anexo-firmado/quitar`.
// - No toca NINGUNA fila de `gh_firma_anexo_encargo_suscripciones`: la
//   suscripción anterior queda FIRMADA, con su evidencia, su acta y su
//   contrafirma. Lo que se deshace es el puntero de la ficha, no el hecho.
// - No borra nada del historial: el rastro es append-only.
//
// EL MOTIVO ES OBLIGATORIO
// ------------------------
// Es un acto que deshace un registro jurídico de la ficha: sin motivo, el
// rastro registra que alguien borró una suscripción y no por qué.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-suscrito/quitar', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const empresa = empresaService.desmarcarAnexoSuscrito(id, _contextoAuditoria(req));
    res.json(empresa);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/estado
// Alta/baja lógica. Una empresa inactiva NO muestra bloque en la mini-app,
// pero sus consentimientos y firmas históricas se conservan intactos.
// ============================================================================
router.post('/empresas/:id_empresa/estado', adminApiAuth(), validateBody(setActivoBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    const empresa = empresaService.setActivo(id, req.body.activo, _contextoAuditoria(req));
    logger.warn('Estado de empresa cambiado por admin', {
      id_empresa: id,
      activo: req.body.activo,
    });
    res.json(empresa);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// LA CUENTA DE CORREO DE ENVÍO DE LA EMPRESA (migración 042)
// ============================================================================
//
// La decisión 1.b del owner: "la Empresa es quien realiza el envío, con sus
// propios correos; K+AIR es el puente".
//
// Endpoints:
//   GET    /internal/admin/empresas/:id_empresa/cuenta-envio
//   POST   /internal/admin/empresas/:id_empresa/cuenta-envio
//   DELETE /internal/admin/empresas/:id_empresa/cuenta-envio
//   POST   /internal/admin/empresas/:id_empresa/cuenta-envio/probar
//
// La contraseña NUNCA se devuelve: el GET responde la vista enmascarada (con
// `clave_presente`, que dice si hay clave, no cuál es).
// ============================================================================

/**
 * Verifica que la Empresa exista antes de tocar su cuenta de envío.
 *
 * POR QUÉ: la cuenta de envío es un dato de la Empresa (de su operación), y
 * una cuenta huérfana no tiene a quién pertenecer: nadie la usa y nadie la
 * puede dejar de usar.
 */
function _exigirEmpresa(id) {
  const empresa = empresaService.getById(id);
  if (!empresa) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND',
      `No existe la empresa ${id}`, { id_empresa: id });
  }
  return empresa;
}

// ============================================================================
// GET /internal/admin/empresas/:id_empresa/cuenta-envio
// La vista ENMASCARADA de la cuenta: sin la clave y con el usuario
// enmascarado. 404 si la Empresa no tiene cuenta configurada.
// ============================================================================
router.get('/empresas/:id_empresa/cuenta-envio', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const vista = cuentaEnvioService.obtenerVista(id);
    if (!vista) {
      throw new AppError(404, 'CUENTA_ENVIO_NOT_FOUND',
        `La empresa ${id} no tiene cuenta de envío configurada`, { id_empresa: id });
    }
    res.json(vista);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/cuenta-envio
// Da de alta o actualiza la cuenta de envío.
//
// La clave viaja en el body y NO sale nunca: se cifra con la llave maestra
// (que vive fuera de la base) y queda como un sobre. Si no se manda clave en
// una actualización, se conserva la que había.
//
// Actor y motivo van en los headers `X-Admin-Actor` / `X-Admin-Motivo`, igual
// que en el resto del router: el cuerpo es la CONFIGURACIÓN, no el rastro.
// ============================================================================
router.post('/empresas/:id_empresa/cuenta-envio', adminApiAuth(), validateBody(cuentaEnvioBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    _exigirEmpresa(id);
    const resultado = cuentaEnvioService.guardar(id, req.body, _contextoAuditoriaCuentaEnvio(req));
    logger.warn('Cuenta de envío de la Empresa ' + (resultado.creado ? 'creada' : 'actualizada') + ' por admin', {
      id_empresa: id,
      host: req.body.host,
      activo: req.body.activo,
    });
    res.status(resultado.creado ? 201 : 200).json(resultado.vista);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE /internal/admin/empresas/:id_empresa/cuenta-envio
// Elimina la cuenta de envío y deja rastro.
//
// A partir de acá, todo lo que salga para esa Empresa vuelve a salir por la
// cuenta de K+AIR.
// ============================================================================
router.delete('/empresas/:id_empresa/cuenta-envio', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const borrada = cuentaEnvioService.eliminar(id, _contextoAuditoriaCuentaEnvio(req));
    if (!borrada) {
      throw new AppError(404, 'CUENTA_ENVIO_NOT_FOUND',
        `La empresa ${id} no tiene cuenta de envío configurada`, { id_empresa: id });
    }
    res.json({ ok: true, id_empresa: id });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/cuenta-envio/probar
// Manda un correo de PRUEBA a la dirección que se le pase.
//
// Para qué: para poder afirmar que la cuenta está "configurada Y probada".
// Configurar no es probar: el puerto puede estar cerrado, el servidor puede
// rechazar las credenciales o el remitente puede estar bloqueado.
//
// NUNCA se loguean credenciales: del correo de prueba solo se anota el
// remitente y el destino (enmascarado).
// ============================================================================
router.post('/empresas/:id_empresa/cuenta-envio/probar', adminApiAuth(), validateBody(probarCuentaEnvioBody), async (req, res, next) => {
  try {
    const id = _parseId(req);
    _exigirEmpresa(id);

    let cuenta;
    try {
      cuenta = cuentaEnvioService.resolverCuentaEstricta(id);
    } catch (e) {
      throw new AppError(400, 'CUENTA_ENVIO_INVALIDA',
        'La cuenta de envío no se pudo resolver: revisa el host, el puerto y las credenciales',
        { id_empresa: id, error: e.message });
    }
    if (!cuenta) {
      throw new AppError(400, 'CUENTA_ENVIO_NO_CONFIGURADA',
        `La empresa ${id} no tiene una cuenta de envío activa para probar`,
        { id_empresa: id });
    }

    try {
      const enviado = await mailer.sendPruebaCuenta({
        to: req.body.to,
        cuenta_envio: cuenta,
      });
      logger.info('Correo de prueba enviado con la cuenta de la Empresa', {
        id_empresa: id,
        remitente: enviado.remitente,
        simulado: !!enviado.simulado,
      });
      res.json({
        ok: true,
        detalle: enviado.simulado
          ? 'Prueba simulada: en este ambiente el correo no sale a la red.'
          : 'Correo de prueba enviado.',
        remitente: enviado.remitente,
        simulado: !!enviado.simulado,
      });
    } catch (e) {
      // El detalle dice POR QUÉ no salió, sin credenciales: el servidor SMTP
      // rechaza la autenticación, el puerto está cerrado, etc.
      logger.warn('No se pudo enviar el correo de prueba de la cuenta de la Empresa', {
        id_empresa: id,
        host: cuenta.host,
        puerto: cuenta.puerto,
        error: e.message,
      });
      res.status(502).json({
        ok: false,
        detalle: 'El correo de prueba no pudo salir: ' + String(e.message || e.code || 'error desconocido').slice(0, 300),
      });
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// EL CANAL DE LA FECHA DE TERMINACIÓN (Anexo de Encargo, sección 6)
// ============================================================================
//
// La Empresa comunica al Encargado la fecha de terminación de la relación
// laboral de un trabajador, por el canal que el Encargado habilita en el
// servicio, con el fin de iniciar el cómputo del plazo legal.
//
// Endpoints:
//   POST   /internal/admin/empresas/:id_empresa/fecha-terminacion
//   GET    /internal/admin/empresas/:id_empresa/fecha-terminacion/pendientes
//   GET    /internal/admin/empresas/:id_empresa/fecha-terminacion
//
// Actor y motivo van en los headers `X-Admin-Actor` / `X-Admin-Motivo`, igual
// que en el resto del router: el cuerpo es el DATO, el rastro va aparte.
//
// El motivo que viene en el body (opcional) COMPLEMENTA al del header: el del
// header explica por qué se hizo la operación administrativa, el del body
// explica por qué se comunica esa fecha.
// ============================================================================

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/fecha-terminacion
// Registra la fecha comunicada, la escribe en las filas del trabajador,
// recalcula el plazo de ESAS filas y deja el registro de la operación.
//
// Sin la evidencia no hay registro: es lo que pide el Anexo de Encargo.
// ============================================================================
router.post('/empresas/:id_empresa/fecha-terminacion', adminApiAuth(), validateBody(fechaTerminacionBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    _exigirEmpresa(id);
    const ctx = _contextoAuditoriaCuentaEnvio(req);
    const resultado = fechaTerminacionService.registrar({
      id_empresa: id,
      id_trabajador: req.body.id_trabajador,
      fecha_terminacion: req.body.fecha_terminacion,
      evidencia: req.body.evidencia,
      canal: req.body.canal,
      motivo: req.body.motivo || ctx.motivo,
      actor: ctx.actor,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
    });
    logger.warn('Fecha de terminacion comunicada por la Empresa', {
      id_empresa: id,
      actor: ctx.actor,
      fecha_terminacion: req.body.fecha_terminacion,
      filas: resultado.filas.encontradas,
      recalculadas: resultado.filas.recalculadas,
    });
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /internal/admin/empresas/:id_empresa/fecha-terminacion/pendientes
// La REVISIÓN PERIÓDICA del Anexo de Encargo: qué filas siguen esperando la
// fecha de terminación y cuáles tienen la fecha pero conservan el recálculo
// pendiente.
//
// "Mientras la fecha no se reciba, la fila permanece retenida, no se calcula
//  fecha de supresión y se revisa periódicamente."
// ============================================================================
router.get('/empresas/:id_empresa/fecha-terminacion/pendientes', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    _exigirEmpresa(id);
    res.json(fechaTerminacionService.pendientes({ id_empresa: id }));
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /internal/admin/empresas/:id_empresa/fecha-terminacion
// Las comunicaciones registradas de esta Empresa, con su bitácora.
// ============================================================================
router.get('/empresas/:id_empresa/fecha-terminacion', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    _exigirEmpresa(id);
    res.json({ items: fechaTerminacionService.comunicaciones(id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
