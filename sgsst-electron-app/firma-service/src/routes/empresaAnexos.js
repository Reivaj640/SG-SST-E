/**
 * EL ESTADO DE LOS ANEXOS DE LA EMPRESA (LADO CLIENTE)
 * ============================================================================
 *
 * - GET /internal/empresa/anexos
 *
 * Auth (I-010, D-13): `requireEmpresaScopeAndLimit()`, el mismo patrón que el
 * resto de `/internal`. Lee `X-Internal-API-Key` y deja `req.id_empresa`, que
 * es la ÚNICA fuente de la Empresa (ver `middleware/authz.js`: "req.id_empresa
 * SIEMPRE viene de la identidad autenticada, NUNCA del body/query").
 *
 * POR QUÉ NO HAY `:id_empresa` EN LA RUTA
 * --------------------------------------
 * Porque no hace falta: la Empresa es la de la key. Si la ruta aceptara un
 * `:id_empresa`, el `checkIdEmpresa` del middleware tendría que compararlo
 * con la identidad — y una ruta sin ese parámetro no tiene por dónde
 * escaparse. Es el mismo criterio que el resto de las rutas per-empresa del
 * servicio.
 *
 * POR QUÉ EL MODO LEGACY ES UN 403 Y NO UN 200 CON DATOS
 * -------------------------------------------------------
 * En modo legacy (`authSource === 'legacy'`) el middleware deja
 * `req.id_empresa = null`: la key no está atada a ninguna Empresa. Con esa key
 * NO se puede decir de quién es el estado, así que la ruta se niega con un 403
 * con un código claro en vez de devolver el estado de alguna Empresa al azar.
 * Es el mismo criterio de "no se confirma la existencia de lo que no se puede
 * atribuir" que usan las rutas cross-empresa del servicio.
 *
 * QUÉ ES ESTE ENDPOINT
 * --------------------
 * Es un endpoint de ESTADO, no un volcado de la tabla. Dice en qué punto está
 * el Anexo de Encargo de la Empresa y si ya puede firmar documentos de sus
 * trabajadores. NO devuelve el enlace de la suscripción, ni el código de
 * verificación, ni el canal en claro, ni la evidencia cruda: nada de eso le
 * sirve a la Empresa y todo eso es del expediente.
 *
 * El texto que dice por qué una Empresa no puede firmar es el de
 * `empresaService.verificarHabilitacionFirma()`: es el mismo que aparece en
 * el 409 del bloqueo, y la UI lo MUESTRA, no lo reescribe. Ese texto es lo
 * que distingue "suscribió pero K+AIR no contrafirmó" de "no tiene Anexo".
 */
'use strict';

const express = require('express');
const router = express.Router();
const { requireEmpresaScopeAndLimit } = require('../middleware/authz');
const { AppError } = require('../middleware/errors');
const empresaService = require('../services/empresa');

/**
 * El estado del Anexo de Encargo de la Empresa.
 *
 * TRES ESTADOS, NO DOS
 * --------------------
 * "ejecutado" · "suscrito" · "no_suscrito"
 *
 * El Anexo de Encargo es BILATERAL: son dos actos. `suscrito` es el primero
 * (la Empresa firmó); `ejecutado` es el segundo (K+AIR contrafirmó) y es el
 * único que habilita a la Empresa para firmar documentos de sus
 * trabajadores. Un campo que dijera "firmado" cuando solo firmó una parte
 * sería una inconsistencia semántica que se vuelve problema probatorio
 * (abogado, 7-nov-2026), así que la ruta dice "suscrito" y "ejecutado".
 *
 * @param {object|null} empresa - la fila de la Empresa, o null si no existe.
 * @returns {object} el bloque `anexo_encargo`.
 */
function _estadoAnexoEncargo(empresa) {
  const firmadoAt = empresa ? (empresa.anexo_encargo_firmado_at || null) : null;
  const suscritoAt = empresa ? (empresa.anexo_encargo_suscrito_at || null) : null;
  return {
    estado: firmadoAt ? 'ejecutado' : (suscritoAt ? 'suscrito' : 'no_suscrito'),
    // La fecha de EJECUCIÓN (la de la contrafirma), no la de la suscripción.
    firmado_at: firmadoAt,
    suscrito_at: suscritoAt,
    suscrito_version: empresa ? (empresa.anexo_encargo_suscrito_version || null) : null,
    suscrito_hash: empresa ? (empresa.anexo_encargo_suscrito_hash || null) : null,
  };
}

/**
 * El estado del Anexo de Nube de la Empresa.
 *
 * El Anexo de Nube NO es bilateral: lo suscribe la Empresa y ya está. Por eso
 * no tiene el par "suscrito/ejecutado" del de Encargo, sino un `firmado` que
 * dice si la Empresa tiene el Anexo de Nube y con qué versión y huella.
 *
 * @param {object|null} empresa - la fila de la Empresa, o null si no existe.
 * @returns {object} el bloque `anexo_nube`.
 */
function _estadoAnexoNube(empresa) {
  const fecha = empresa ? (empresa.anexo_nube_firmado_at || null) : null;
  return {
    firmado: Boolean(fecha),
    fecha,
    version: empresa ? (empresa.anexo_nube_version || null) : null,
    hash: empresa ? (empresa.anexo_nube_hash || null) : null,
  };
}

// ============================================================================
// GET /internal/empresa/anexos
// ============================================================================
router.get('/empresa/anexos', requireEmpresaScopeAndLimit(), (req, res, next) => {
  try {
    // LA EMPRESA VIENE SOLO DE LA IDENTIDAD AUTENTICADA. Nunca del path,
    // nunca del query, nunca del body.
    const id_empresa = req.id_empresa;
    if (typeof id_empresa !== 'string' || id_empresa.length === 0) {
      throw new AppError(403, 'EMPRESA_NO_RESUELTA',
        'La API key no está asociada a una empresa: no se puede leer el estado de los anexos');
    }

    const empresa = empresaService.getById(id_empresa);

    // Si la Empresa no existe, `verificarHabilitacionFirma` ya responde
    // `registrada: false` con `ok: true` (una Empresa que no está en el
    // directorio no está BLOQUEADA: eso es otro problema). NO es un 404:
    // se devuelve tal cual, con el Anexo en "no_suscrito".
    const habilitacion = empresaService.verificarHabilitacionFirma(id_empresa);

    res.json({
      id_empresa,
      anexo_encargo: _estadoAnexoEncargo(empresa),
      anexo_nube: _estadoAnexoNube(empresa),
      // Se devuelve TAL COMO lo da el service: ese mensaje es el que
      // distingue "suscribió pero K+AIR no contrafirmó" de "no tiene Anexo",
      // y la UI lo muestra, no lo reescribe.
      habilitacion,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
