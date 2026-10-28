/**
 * Los anexos que rigen cada firma: versión y huella SHA-256.
 *
 * POR QUÉ EXISTE
 * -------------
 * El numeral 1.5 del Acuerdo de uso promete:
 *
 *   "La version incorporada del Anexo de Encargo y la del Anexo de Nube son
 *    las que constan, con su identificador y huella SHA-256, en el Anexo de
 *    Encargo y en la Constancia de cada firma."
 *
 * En el código no había NADA de eso: grep de "anexo" en los generadores de
 * Constancia daba cero coincidencias. El Anexo de Encargo solo se guardaba
 * como FECHA de firma (gh_firma_empresas.anexo_encargo_firmado_at), sin
 * huella; y el Anexo de Nube ni siquiera estaba versionado en el repo (en el
 * manifiesto solo había el MODELO, sin firmar).
 *
 * Este servicio lee el manifiesto legal (legal-readiness.json), que es donde
 * vive la versión y la huella de cada anexo, y las devuelve con el estado de
 * firma de cada uno. La Constancia las imprime (services/pdfGen.js) y la fila
 * de la firma las archiva (migración 045), para que el dato sea consultable
 * por firma y no solo impreso.
 *
 * LA DISTINCIÓN IMPORTANTE: MODELO vs FIRMADO
 * --------------------------------------------
 * Del Anexo de Nube hoy solo existe el MODELO: un texto sin firmar, con su
 * versión y su huella, pero que NO es la versión firmada. Este servicio nunca
 * los confunde:
 *   - `anexo_nube.version` / `anexo_nube.hash` son los de la versión FIRMADA
 *     (hoy: null).
 *   - `anexo_nube.modelo` es el texto sin firmar, con su propia huella.
 *   - `anexo_nube.version_incorporada` / `hash_incorporada` son los del texto
 *     que realmente rige (la firmada si existe; si no, el modelo), y son los
 *     que se archivan en la fila de la firma.
 *
 * LO QUE NO INVENTA
 * -----------------
 * Si la Empresa todavía no firmó el Anexo de Encargo, la respuesta dice
 * `firmado: false` y `fecha_firma: null`. NO se inventa una fecha ni una
 * huella de "copia firmada": la huella que se publica es la del TEXTO de la
 * versión incorporada, tal como está en el manifiesto, y eso se dice
 * explícitamente en la Constancia.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../db/connection');
const empresaService = require('./empresa');

// Raíz del service (firma-service). En producción el service se despliega en
// /opt/kair-firma/app, así que esta misma ruta resuelve a
// /opt/kair-firma/app/legal-readiness.json.
const SERVICE_ROOT = path.resolve(__dirname, '..', '..');

// El manifiesto está en la raíz del service. La segunda ruta es el respaldo
// para despliegues donde el service cuelgue de un subdirectorio.
const RUTAS_MANIFIESTO = [
  path.join(SERVICE_ROOT, 'legal-readiness.json'),
  path.join(SERVICE_ROOT, '..', 'legal-readiness.json'),
];

/**
 * Lee el manifiesto y lo devuelve normalizado.
 *
 * @param {string} ruta
 * @returns {{existe: boolean, datos: object|null, error: string|null, ruta: string}}
 */
function _leerManifiesto(ruta) {
  try {
    const datos = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new Error('el manifiesto no es un objeto JSON');
    }
    return { existe: true, datos, error: null, ruta };
  } catch (err) {
    return { existe: false, datos: null, error: err.message, ruta };
  }
}

/**
 * Devuelve el manifiesto legal.
 *
 * Se relee en cada llamada (el archivo es de un par de kilobytes y lo cambia
 * un operador, no el sistema): una caché dejaría la Constancia con una
 * versión vieja del anexo sin que nadie lo notara.
 *
 * @param {object} [opciones]
 * @param {object} [opciones.manifiesto] manifiesto inyectado (tests)
 * @param {string} [opciones.rutaManifiesto] ruta alternativa (tests)
 * @returns {{existe: boolean, datos: object|null, error: string|null, ruta: string}}
 */
function manifiesto(opciones = {}) {
  if (opciones.manifiesto && typeof opciones.manifiesto === 'object') {
    return {
      existe: true,
      datos: opciones.manifiesto,
      error: null,
      ruta: 'manifiesto (inyectado)',
    };
  }
  if (opciones.rutaManifiesto) return _leerManifiesto(opciones.rutaManifiesto);
  let resultado = null;
  for (const ruta of RUTAS_MANIFIESTO) {
    resultado = _leerManifiesto(ruta);
    if (resultado.existe) return resultado;
  }
  return resultado;
}

/** Texto normalizado (trim) o cadena vacía. */
function _texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

/** ¿Es una huella SHA-256 (64 hexadecimales)? */
function _esHashSha256(valor) {
  return typeof valor === 'string' && /^[0-9a-f]{64}$/i.test(valor.trim());
}

/**
 * Los datos de los dos anexos, tal como están a la fecha de la firma.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.id_empresa] la Empresa que pide la firma: define
 *   si el Anexo de Encargo ya está firmado por ella.
 * @param {object} [opciones.manifiesto] manifiesto inyectado (tests)
 * @param {string} [opciones.rutaManifiesto] ruta alternativa (tests)
 * @returns {object} la estructura de anexos (ver la cabecera del archivo)
 */
function datosAnexos(opciones = {}) {
  const idEmpresa = _texto(opciones.id_empresa) || null;
  const man = manifiesto(opciones);

  if (!man.existe) {
    // Sin manifiesto NO se inventa nada: se dice que no se pudo leer.
    return {
      disponible: false,
      error: man.error,
      fuente: man.ruta,
      id_empresa: idEmpresa,
      anexo_encargo: {
        nombre: 'Anexo de Encargo',
        version: null,
        hash: null,
        hash_valido: false,
        firmado: false,
        fecha_firma: null,
        estado: 'no_disponible',
        evidencia: null,
      },
      anexo_nube: {
        nombre: 'Anexo de Nube',
        version: null,
        hash: null,
        hash_valido: false,
        firmado: false,
        fecha: null,
        estado: 'no_disponible',
        modelo: null,
        version_incorporada: null,
        hash_incorporada: null,
        origen_incorporada: null,
      },
    };
  }

  const datos = man.datos || {};
  const encMan = datos.anexo_encargo || {};
  const nubeMan = datos.anexo_nube || {};

  // ───────────────────────────────────────────────────────────────────────────
  // EL ANEXO DE ENCARGO
  // ───────────────────────────────────────────────────────────────────────────
  // La versión y la huella son del manifiesto. La FECHA de firma es de la
  // Empresa: vive en su fila (gh_firma_empresas.anexo_encargo_firmado_at),
  // que es donde el servicio ya guardaba el dato.
  let fechaFirmaEmpresa = null;
  if (idEmpresa) {
    try {
      const empresa = empresaService.getById(idEmpresa);
      if (empresa) fechaFirmaEmpresa = empresa.anexo_encargo_firmado_at || null;
    } catch (e) {
      // La constancia NUNCA se cae por esto: si no se puede leer la Empresa,
      // el Anexo de Encargo se declara sin firmar, que es el lado seguro.
      fechaFirmaEmpresa = null;
    }
  }
  const encHash = _texto(encMan.hash);
  const encFirmado = Boolean(fechaFirmaEmpresa) || _texto(encMan.estado) === 'firmado';

  const anexoEncargo = {
    nombre: 'Anexo de Encargo',
    version: _texto(encMan.version) || null,
    hash: encHash || null,
    hash_valido: _esHashSha256(encHash),
    firmado: encFirmado,
    // La fecha de la Empresa es la que manda: es la firma que consta.
    fecha_firma: fechaFirmaEmpresa || _texto(encMan.fecha) || null,
    estado: encFirmado ? 'firmado' : 'no_firmado',
    evidencia: encMan.evidencia || null,
  };

  // ───────────────────────────────────────────────────────────────────────────
  // EL ANEXO DE NUBE
  // ───────────────────────────────────────────────────────────────────────────
  // Hoy solo hay el MODELO: un texto sin firmar. La versión firmada y su
  // huella son null, y eso es lo que se devuelve como `version`/`hash`. El
  // modelo va aparte, en `modelo`, con su propia huella.
  const nubeHash = _texto(nubeMan.hash);
  const nubeFirmado = nubeMan.firmado === true;
  const modelo = nubeMan.modelo && typeof nubeMan.modelo === 'object'
    ? {
      version: _texto(nubeMan.modelo.version) || null,
      hash: _texto(nubeMan.modelo.hash) || null,
      actualizado: _texto(nubeMan.modelo.actualizado) || null,
      nota: _texto(nubeMan.modelo.nota) || null,
    }
    : null;

  const anexoNube = {
    nombre: 'Anexo de Nube',
    // La versión FIRMADA (hoy no hay ninguna).
    version: _texto(nubeMan.version) || null,
    hash: nubeHash || null,
    hash_valido: _esHashSha256(nubeHash),
    firmado: nubeFirmado,
    fecha: _texto(nubeMan.fecha) || null,
    estado: nubeFirmado ? 'firmado' : 'no_firmado',
    // El texto sin firmar, con su huella.
    modelo,
    // Lo que realmente rige: la versión firmada si existe; si no, el modelo.
    version_incorporada: _texto(nubeMan.version) || (modelo ? modelo.version : null),
    hash_incorporada: nubeHash || (modelo ? modelo.hash : null),
    origen_incorporada: _texto(nubeMan.version)
      ? 'version_firmada'
      : (modelo ? 'modelo' : null),
  };

  return {
    disponible: true,
    error: null,
    fuente: man.ruta,
    id_empresa: idEmpresa,
    anexo_encargo: anexoEncargo,
    anexo_nube: anexoNube,
  };
}

/**
 * Archiva en la fila de la firma los anexos que rigen esa firma.
 *
 * ESTA FUNCIÓN ES LA QUE HAY QUE LLAMAR DESDE LA TRANSACCIÓN DE LA FIRMA.
 * Se puede llamar dentro o fuera de una `db.transaction()`: better-sqlite3
 * usa la conexión, así que si se llama dentro de una transacción abierta la
 * escritura se suma a esa transacción (y se revierte con ella).
 *
 * @param {number|string} firmaId id interno de la fila en gh_firmas_electronicas
 * @param {object} [datos] resultado de `datosAnexos()`. Si no se pasa, se lee
 *   el manifiesto en el momento (con `opciones.id_empresa`).
 * @param {object} [opciones]
 * @param {string} [opciones.id_empresa]
 * @param {object} [opciones.db] conexión (tests)
 * @returns {object|null} lo que se escribió, o null si no se pudo escribir
 */
function registrarAnexosFirma(firmaId, datos, opciones = {}) {
  const id = Number(firmaId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const dbConn = opciones.db || db;
  const anexos = datos && typeof datos === 'object'
    ? datos
    : datosAnexos({ id_empresa: opciones.id_empresa });

  const enc = anexos.anexo_encargo || {};
  const nube = anexos.anexo_nube || {};

  try {
    dbConn.prepare(`
      UPDATE gh_firmas_electronicas
         SET anexo_encargo_version = ?,
             anexo_encargo_hash = ?,
             anexo_nube_version = ?,
             anexo_nube_hash = ?
       WHERE id = ?
    `).run(
      enc.version || null,
      enc.hash || null,
      nube.version_incorporada || null,
      nube.hash_incorporada || null,
      id,
    );
  } catch (e) {
    // Si la migración 045 todavía no está aplicada, la firma NO se cae: la
    // constancia ya se generó con los anexos (el PDF no depende de la tabla).
    return null;
  }

  return {
    anexo_encargo_version: enc.version || null,
    anexo_encargo_hash: enc.hash || null,
    anexo_nube_version: nube.version_incorporada || null,
    anexo_nube_hash: nube.hash_incorporada || null,
  };
}

/**
 * Lee los anexos que quedaron archivados en una firma.
 *
 * @param {number|string} firmaId
 * @param {object} [opciones]
 * @param {object} [opciones.db]
 * @returns {object|null}
 */
function anexosDeFirma(firmaId, opciones = {}) {
  const dbConn = opciones.db || db;
  const id = Number(firmaId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    return dbConn.prepare(`
      SELECT anexo_encargo_version, anexo_encargo_hash,
             anexo_nube_version, anexo_nube_hash
        FROM gh_firmas_electronicas
       WHERE id = ?
    `).get(id) || null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  datosAnexos,
  registrarAnexosFirma,
  anexosDeFirma,
  manifiesto,
  RUTAS_MANIFIESTO,
};
