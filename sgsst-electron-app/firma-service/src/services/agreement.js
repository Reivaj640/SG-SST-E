/**
 * Servicio del Acuerdo de uso de firma electrónica.
 *
 * Maneja el versionado del Acuerdo y la consulta de la versión activa.
 *
 * Ver DATA_MODEL.md §3.1 (tabla gh_firma_acuerdo_versiones).
 * Ver API.md §6.9 (GET /internal/acuerdo-activo).
 */
'use strict';

const db = require('../db/connection');
const { sha256 } = require('../crypto/hash');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const {
  analizarTextoLegal,
  esVersionSujetaAGuarda,
} = require('../utils/textoLegal');
const aprobacionPublicacion = require('./aprobacionPublicacion');

const VERSION_REGEX = /^v\d+\.\d+$/;
const MAX_TEXTO_CHARS = 50000;
const MAX_VERSION_CHARS = 32;
const MAX_CREADO_POR_CHARS = 128;
const MAX_KAIR_VERSION_CHARS = 32;

/**
 * Obtiene la versión activa Y vigente del Acuerdo.
 *
 * Reglas de vigencia (Bloque A — agreement_version obligatorio):
 *  - activa = 1 (la marca de activa)
 *  - fecha_vigencia_inicio <= now (ya entró en vigencia)
 *  - fecha_vigencia_fin IS NULL OR fecha_vigencia_fin > now
 *    (no ha vencido; NULL = sin fecha de fin = válida indefinidamente)
 *
 * El índice único parcial idx_acuerdo_activa_unica (creado en migración 002)
 * garantiza "máximo 1 activa" a nivel de BD. Este filtro de vigencia va
 * a nivel de aplicación y puede evolucionar (ej. requerir aprobación
 * jurídica explícita antes de activar).
 *
 * @returns {object|null} La versión activa y vigente, o null si no hay.
 */
function getActive() {
  const now = new Date().toISOString();
  const row = db.prepare(`
    SELECT id, version, texto, texto_hash, fecha_vigencia_inicio,
           fecha_vigencia_fin, activa, creado_por, kair_version,
           fecha_creacion
    FROM gh_firma_acuerdo_versiones
    WHERE activa = 1
      AND fecha_vigencia_inicio <= @now
      AND (fecha_vigencia_fin IS NULL OR fecha_vigencia_fin > @now)
    LIMIT 1
  `).get({ now });
  return row || null;
}

/**
 * Obtiene una versión del Acuerdo por su identificador.
 *
 * @param {string} version - Identificador de versión (ej. 'v1.0')
 * @returns {object|null}
 */
function getByVersion(version) {
  if (typeof version !== 'string' || version.length === 0) return null;
  return db.prepare(`
    SELECT id, version, texto, texto_hash, fecha_vigencia_inicio,
           fecha_vigencia_fin, activa, creado_por, kair_version,
           fecha_creacion
    FROM gh_firma_acuerdo_versiones
    WHERE version = ?
    LIMIT 1
  `).get(version);
}

/**
 * Crea una nueva versión del Acuerdo.
 *
 * - Si se marca como activa, desactiva la versión activa anterior
 *   (transacción atómica).
 * - Calcula texto_hash automáticamente (server-side, NUNCA del cliente).
 * - Valida formato de version, unicidad, y coherencia de fechas
 *   ANTES del INSERT, retornando AppError 400/409 con códigos tipados.
 *
 * @param {object} opts
 * @param {string} opts.version - ej. 'v1.0' (formato /^v\d+\.\d+$/)
 * @param {string} opts.texto - Texto completo (1-50000 chars)
 * @param {boolean} [opts.activa=true]
 * @param {string|null} [opts.fecha_vigencia_fin=null] - ISO-8601
 * @param {string} [opts.creado_por]
 * @param {string} [opts.kair_version]
 * @param {object|null} [opts.metadata=null] - JSON object
 * @returns {object} La versión creada + lista de desactivadas
 * @throws AppError 400/409 si validación falla
 */
function createVersion({
  version, texto,
  activa = true,
  fecha_vigencia_fin = null,
  creado_por = null, kair_version = null,
  metadata = null,
}) {
  // 1. Validar formato de version
  if (typeof version !== 'string' || version.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'version es requerida');
  }
  if (version.length > MAX_VERSION_CHARS) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      `version demasiado larga (max ${MAX_VERSION_CHARS} chars)`);
  }
  if (!VERSION_REGEX.test(version)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'version debe tener formato v<major>.<minor> (ej. v1.0)');
  }

  // 2. Validar texto
  if (typeof texto !== 'string' || texto.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'texto es requerido');
  }
  if (texto.length > MAX_TEXTO_CHARS) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      `texto demasiado largo (${texto.length} chars, max ${MAX_TEXTO_CHARS})`);
  }

  // 2.1 Guarda de placeholders y marcas de borrador.
  //
  // La v1.0 ya está publicada y sellada: no se le aplica, porque su proceso
  // ya cerró y los fixtures de desarrollo la usan con textos sintéticos. La
  // guarda empieza en la v1.1, que es la primera versión nueva después del
  // cierre. Si el texto trae un corchete o una marca como "ACUERDO DEV", se
  // rechaza ANTES de tocar la base: un texto legal a medio llenar no se
  // publica ni se firma.
  //
  // Los campos que registra el sistema (`[registrada por el sistema]`) NO
  // cuentan como hueco: la v1.0 ya está publicada con ellos y los llena el
  // sistema al firmar.
  if (esVersionSujetaAGuarda(version)) {
    const analisis = analizarTextoLegal(texto);
    if (!analisis.ok) {
      throw new AppError(
        400,
        'TEXTO_LEGAL_CON_PLACEHOLDERS',
        `El texto de la versión ${version} tiene placeholders o marcas de borrador; no se puede publicar.`,
        {
          placeholders: analisis.placeholders.huecos.total,
          placeholders_unicos: analisis.placeholders.huecos.unicos,
          campos_del_sistema: analisis.placeholders.sistema.total,
          marcadores: analisis.marcadores.map((m) => m.etiqueta),
        },
      );
    }
  }

  // 3. Verificar unicidad ANTES de INSERT
  if (getByVersion(version)) {
    throw new AppError(409, 'ACUERDO_VERSION_EXISTS',
      `Ya existe la versión ${version}`);
  }

  // 4. Validar opcionales de longitud
  if (creado_por !== null && (typeof creado_por !== 'string' || creado_por.length > MAX_CREADO_POR_CHARS)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      `creado_por debe ser string de max ${MAX_CREADO_POR_CHARS} chars`);
  }
  if (kair_version !== null && (typeof kair_version !== 'string' || kair_version.length > MAX_KAIR_VERSION_CHARS)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      `kair_version debe ser string de max ${MAX_KAIR_VERSION_CHARS} chars`);
  }
  if (metadata !== null && (typeof metadata !== 'object' || Array.isArray(metadata))) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'metadata debe ser un objeto JSON o null');
  }

  // 5. Validar fecha_vigencia_fin
  const now = new Date();
  if (fecha_vigencia_fin !== null) {
    if (typeof fecha_vigencia_fin !== 'string') {
      throw new AppError(400, 'INVALID_VIGENCIA',
        'fecha_vigencia_fin debe ser string ISO-8601 o null');
    }
    const fin = new Date(fecha_vigencia_fin);
    if (Number.isNaN(fin.getTime())) {
      throw new AppError(400, 'INVALID_VIGENCIA',
        'fecha_vigencia_fin no es una fecha válida');
    }
    if (fin <= now) {
      throw new AppError(400, 'INVALID_VIGENCIA',
        'fecha_vigencia_fin debe ser futura (posterior a ahora)');
    }
  }

  // 6. Si activa=true y la fecha_fin es pasada, no tiene sentido activar
  //    (caso raro, pero queremos ser explícitos)
  if (activa && fecha_vigencia_fin !== null) {
    const fin = new Date(fecha_vigencia_fin);
    if (fin <= now) {
      throw new AppError(400, 'INVALID_VIGENCIA',
        'No se puede activar una versión con fecha_vigencia_fin en el pasado');
    }
  }

  // 7. Calcular hash server-side
  const texto_hash = sha256(texto);
  const fecha_vigencia_inicio = now.toISOString();
  const fecha_creacion = fecha_vigencia_inicio;

  // 7.1 BARRERA DE PUBLICACIÓN (decisión del owner 1.f, con el abogado).
  //
  // Aprobar el TEXTO no autoriza a publicarlo. La publicación exige una
  // AUTORIZACIÓN OPERATIVA registrada para esa versión y para ESE texto.
  //
  // POR QUÉ el hash va explícito: la autorización es sobre un texto, no sobre
  // un nombre de versión. Si el texto cambia un caracter, el hash cambia (lo
  // calcula el servidor, en el paso 7) y la autorización deja de servir: sin
  // esto, la autorización de un texto serviría para publicar cualquier otro
  // como la misma versión.
  //
  // POR QUÉ `activa: false` NO se bloquea: preparar el texto es libre. Lo que
  // se bloquea es publicarlo, que es lo que exige evidencia operativa.
  if (activa) {
    const autorizada = aprobacionPublicacion.tieneAprobacionOperativa(version, texto_hash);
    if (!autorizada) {
      throw new AppError(
        409,
        'APROBACION_OPERATIVA_REQUERIDA',
        `No se puede publicar la versión ${version}: falta la autorización operativa `
        + `para ese texto (huella ${texto_hash}). Regístrala por `
        + 'POST /internal/admin/aprobaciones-publicacion con tipo OPERATIVA, la '
        + `versión ${version} y la huella del texto, y volvé a publicar. `
        + 'Preparar el texto sin publicarlo (activa: false) no requiere autorización.',
        { version, texto_hash },
      );
    }
  }

  // 8. Transacción atómica: desactivar anteriores + insertar
  const desactivadas = [];
  const tx = db.transaction(() => {
    if (activa) {
      const anteriores = db.prepare(
        'SELECT version FROM gh_firma_acuerdo_versiones WHERE activa = 1'
      ).all();
      desactivadas.push(...anteriores.map(a => a.version));
      db.prepare('UPDATE gh_firma_acuerdo_versiones SET activa = 0').run();
    }
    db.prepare(`
      INSERT INTO gh_firma_acuerdo_versiones
        (version, texto, texto_hash, fecha_vigencia_inicio, fecha_vigencia_fin,
         activa, creado_por, kair_version, fecha_creacion, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      version, texto, texto_hash, fecha_vigencia_inicio, fecha_vigencia_fin,
      activa ? 1 : 0, creado_por, kair_version, fecha_creacion,
      metadata ? JSON.stringify(metadata) : null,
    );
  });
  tx();

  logger.info('Versión de Acuerdo creada', {
    version, activa, desactivadas: desactivadas.length,
    texto_chars: texto.length,
  });
  const creada = getByVersion(version);
  return { ...creada, desactivadas };
}

module.exports = {
  getActive,
  getByVersion,
  createVersion,
  // Constantes exportadas para tests
  VERSION_REGEX,
  MAX_TEXTO_CHARS,
  MAX_VERSION_CHARS,
};
