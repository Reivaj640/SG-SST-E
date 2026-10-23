/**
 * Rastro de los cambios de la ficha de la Empresa (migraciones 037 y 038).
 *
 * POR QUÉ EXISTE
 * --------------
 * `PUT /internal/admin/empresas/:id` es un REEMPLAZO de la ficha completa: lo
 * que no se manda queda en NULL. Eso significa que un canal de PQRS declarado
 * por via administrativa puede ser pisado por un guardado de escritorio, sin
 * que quede rastro de quien lo cambio ni de cuando.
 *
 * El abogado lo pone como bloqueante de la publicacion de la v1.1:
 *
 *   "Canal de PQRS unico (formulario o endpoint) | Si - sin el, el override no
 *    deja rastro"
 *
 * O sea: el problema no es que se pueda cambiar (cambiar el canal de una
 * Empresa es legitimo), es que el cambio SEA INVISIBLE. Sin rastro no hay
 * forma de responder "de donde salio este canal".
 *
 * QUE SE GUARDA
 * -------------
 * Un renglon por CAMPO QUE REALMENTE CAMBIO (no por guardado): con el valor
 * anterior, el valor nuevo, quien lo hizo, desde donde, y el motivo que
 * declaro.
 *
 * Lo que NO se guarda: los guardados que no cambian nada. Un guardado que
 * re-manda lo mismo no es un cambio y ensuciaria el rastro.
 *
 * LO QUE NO SE DUPLICA
 * --------------------
 * El documento del representante legal NO se escribe en claro en el rastro: se
 * enmascara con la misma convencion que ya usa el sistema para mostrarse
 * (MASCARA + los ultimos 4). La fila de la Empresa ya guarda el dato; el
 * rastro solo tiene que poder decir QUE CAMBIO, no reponer el numero.
 *
 * LA TABLA ES APPEND-ONLY
 * -----------------------
 * Lo que se escribe una vez, no se altera: los triggers de la migracion 038.
 * Es el mismo criterio de la bitacora de eventos (migracion 020) y de la
 * bitacora de excepciones (036).
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const representanteService = require('./representante');

/**
 * Campos de la ficha cuyo cambio se rastrea.
 *
 * Son los 12 editables mas los 4 que el service escribe aparte. La lista
 * esta ACA y no se importa de `services/empresa.js` a proposito: este modulo
 * no puede requerir a `empresa.js` (se require mutuamente) y, si la lista
 * viviera en el otro lado, un cambio alli seARIA un cambio aca sin que nadie
 * lo viera. La lista se compara con la de `empresa.js` en los tests.
 */
const CAMPOS_TRAZABLES = [
  'razon_social', 'nit', 'domicilio',
  'representante_legal', 'representante_legal_identificacion',
  'responsable_tratamiento', 'responsable_tratamiento_correo',
  'canal_pqrs', 'canal_incidentes', 'politica_datos_url',
  'plazo_retencion', 'canal_solicitud_copia',
  'plazo_retencion_dias', 'norma_conservacion',
  'conservacion_por_deber_legal', 'dominios_corporativos',
];

/**
 * Campos cuyo valor NO se copia al rastro en claro.
 *
 * El documento del representante legal es el unico dato personal que puede
 * aparecer en la ficha de la Empresa: se enmascara. Los demas son datos de la
 * empresa (razon social, canales, plazos) y se guardan tal cual, porque sin el
 * valor anterior el rastro no sirve para nada.
 */
const CAMPOS_SENSIBLES = new Set(['representante_legal_identificacion']);

/**
 * Normaliza un valor a texto comparable.
 *
 * - null/undefined -> null (el valor "no estaba").
 * - boolean -> 'SI' / 'NO'. El flag `conservacion_por_deber_legal` llega como
 *   boolean desde la fila (via `_toRowShape`) y como 0/1 desde la escritura:
 *   sin normalizar, un valor sin cambio pareceria un cambio.
 * - number -> su representacion decimal.
 * - string -> la string.
 *
 * @param {string} campo
 * @param {*} valor
 * @returns {string|null}
 */
function _texto(campo, valor) {
  if (valor === null || valor === undefined) return null;
  if (campo === 'conservacion_por_deber_legal') {
    return (valor === true || valor === 1 || valor === '1' || valor === 'true') ? 'SI' : 'NO';
  }
  if (typeof valor === 'boolean') return valor ? 'SI' : 'NO';
  if (typeof valor === 'number') return String(valor);
  return String(valor);
}

/**
 * El valor tal como se escribe en el rastro.
 *
 * Para los campos sensibles se enmascara; para los demas es el texto
 * normalizado.
 *
 * @param {string} campo
 * @param {*} valor
 * @returns {string|null}
 */
function _valorEnRastro(campo, valor) {
  const texto = _texto(campo, valor);
  if (texto === null) return null;
  if (!CAMPOS_SENSIBLES.has(campo)) return texto;
  return representanteService.MASCARA + representanteService.ultimosDeTexto(texto);
}

/**
 * Calcula que campos cambiaron entre dos versiones de la ficha.
 *
 * Se compara el valor ANTERIOR contra el NUEVO. Si son iguales (o los dos
 * ausentes), el campo no cambio y no se registra: un guardado que re-manda lo
 * mismo no es un cambio.
 *
 * @param {object} anterior - La ficha antes del cambio (shape de `getById`).
 * @param {object} nuevo - La ficha despues del cambio (mismas claves).
 * @returns {Array<{campo: string, valor_anterior: string|null, valor_nuevo: string|null}>}
 */
function calcularCambios(anterior, nuevo) {
  const cambios = [];
  for (const campo of CAMPOS_TRAZABLES) {
    const antes = _valorEnRastro(campo, anterior ? anterior[campo] : null);
    const despues = _valorEnRastro(campo, nuevo ? nuevo[campo] : null);
    if (antes === despues) continue;
    cambios.push({ campo, valor_anterior: antes, valor_nuevo: despues });
  }
  return cambios;
}

/**
 * Escribe el rastro de los cambios de la ficha.
 *
 * Se escribe UN RENGLON POR CAMPO QUE CAMBIO. Si no cambio nada, no se
 * escribe nada.
 *
 * @param {object} opts
 * @param {string} opts.id_empresa
 * @param {object} opts.anterior - La ficha antes del cambio.
 * @param {object} opts.nuevo - La ficha despues del cambio.
 * @param {string} [opts.actor] - Quien lo hizo. Default 'admin'.
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @param {string} [opts.motivo] - Por que (lo declara el operador).
 * @returns {Array<object>} Los cambios registrados.
 */
function registrarCambios({
  id_empresa, anterior, nuevo,
  actor = null, ip = null, user_agent = null, motivo = null,
}) {
  const cambios = calcularCambios(anterior, nuevo);
  if (cambios.length === 0) return [];

  const quien = (typeof actor === 'string' && actor.trim().length > 0)
    ? actor.trim().slice(0, 200)
    : 'admin';
  const fecha = new Date().toISOString();
  const porque = (typeof motivo === 'string' && motivo.trim().length > 0)
    ? motivo.trim().slice(0, 500)
    : null;

  const stmt = db.prepare(`
    INSERT INTO gh_firma_empresas_auditoria
      (id_empresa, fecha_hora, id_actor, ip, user_agent,
       campo, valor_anterior, valor_nuevo, motivo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const c of cambios) {
      stmt.run(
        id_empresa, fecha, quien,
        ip || null, user_agent || null,
        c.campo, c.valor_anterior, c.valor_nuevo, porque
      );
    }
  });
  tx();

  logger.info('Rastro de la ficha de la empresa', {
    id_empresa,
    actor: quien,
    campos: cambios.map((c) => c.campo),
    motivo: porque,
  });

  return cambios;
}

/**
 * Registra un cambio de un campo que NO viene de la ficha editable (por
 * ejemplo, la fecha de firma del Anexo de Encargo o el estado activo).
 *
 * Misma tabla, misma inmutabilidad: son actos administrativos sobre la
 * Empresa y tienen el mismo derecho a dejar rastro.
 *
 * @param {object} opts
 * @param {string} opts.id_empresa
 * @param {string} opts.campo
 * @param {*} opts.valor_anterior
 * @param {*} opts.valor_nuevo
 * @param {string} [opts.actor]
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @param {string} [opts.motivo]
 * @returns {boolean} true si se escribio el renglon.
 */
function registrarCampo({
  id_empresa, campo, valor_anterior, valor_nuevo,
  actor = null, ip = null, user_agent = null, motivo = null,
}) {
  const antes = _valorEnRastro(campo, valor_anterior);
  const despues = _valorEnRastro(campo, valor_nuevo);
  if (antes === despues) return false;

  const quien = (typeof actor === 'string' && actor.trim().length > 0)
    ? actor.trim().slice(0, 200)
    : 'admin';
  const porque = (typeof motivo === 'string' && motivo.trim().length > 0)
    ? motivo.trim().slice(0, 500)
    : null;

  db.prepare(`
    INSERT INTO gh_firma_empresas_auditoria
      (id_empresa, fecha_hora, id_actor, ip, user_agent,
       campo, valor_anterior, valor_nuevo, motivo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id_empresa, new Date().toISOString(), quien,
    ip || null, user_agent || null,
    campo, antes, despues, porque
  );

  logger.info('Rastro de la ficha de la empresa', {
    id_empresa, actor: quien, campos: [campo], motivo: porque,
  });
  return true;
}

/**
 * Lee el rastro de la ficha de una Empresa.
 *
 * @param {string} id_empresa
 * @param {object} [opts]
 * @param {number} [opts.limite] - Maximo de renglones (por defecto 200).
 * @returns {Array<object>} Del mas reciente al mas antiguo.
 */
function historial(id_empresa, { limite = 200 } = {}) {
  const max = Number.isInteger(limite) && limite > 0 ? Math.min(limite, 1000) : 200;
  return db.prepare(`
    SELECT id, id_empresa, fecha_hora, id_actor, ip, user_agent,
           campo, valor_anterior, valor_nuevo, motivo
    FROM gh_firma_empresas_auditoria
    WHERE id_empresa = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(id_empresa, max);
}

module.exports = {
  CAMPOS_TRAZABLES,
  CAMPOS_SENSIBLES,
  calcularCambios,
  registrarCambios,
  registrarCampo,
  historial,
};
