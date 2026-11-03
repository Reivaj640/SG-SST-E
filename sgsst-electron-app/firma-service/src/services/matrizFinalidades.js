/**
 * La matriz de finalidades (C-2 · ordinal 3 de la Manifestacion de Voluntad).
 *
 * EL PROBLEMA QUE RESUELVE
 * -------------------------
 * La aceptacion del Trabajador queda ligada solo a la huella del Acuerdo, pero
 * el ordinal 3 de la Manifestacion de Voluntad delega en la MATRIZ DEL ANEXO
 * DE ENCARGO la definicion de que finalidades se fundan en su autorizacion.
 * Sin esto, el Titular aceptaba sobre una matriz que no aceptaba ni veia.
 *
 * QUE HACE ESTE MODULO
 * --------------------
 * - Lee la fuente unica de la matriz: `config/matriz-finalidades.json`.
 * - Le calcula la huella SHA-256 (la del archivo, que es la que se archiva).
 * - La arma como texto para el Firmante: la mini-app lo muestra ANTES de
 *   habilitar la casilla de aceptacion.
 *
 * LO QUE NO HACE
 * --------------
 * No inventa nada. Si el archivo no esta, no hay matriz: `disponible` es false
 * y quien la necesita tiene que fallar. No arma una matriz de mentira ni
 * completa lo que falta con Supuestos.
 *
 * La huella es la del ARCHIVO (SHA-256 sobre sus bytes), la misma convencion
 * que usa el manifiesto legal para los anexos: es la que un tercero puede
 * recomputar con el archivo en la mano.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { sha256 } = require('../crypto/hash');

/** La fuente unica de la matriz de finalidades. */
const RUTA_MATRIZ = path.join(__dirname, '..', '..', 'config', 'matriz-finalidades.json');

/** Cache en memoria: { mtimeMs, size, hash, datos }. */
let _cache = null;

/**
 * Lee la matriz del disco y le calcula la huella.
 *
 * @returns {{mtimeMs: number, size: number, hash: string, datos: object}}
 */
function _leer() {
  const stat = fs.statSync(RUTA_MATRIZ);
  if (_cache && _cache.mtimeMs === stat.mtimeMs && _cache.size === stat.size) {
    return _cache;
  }
  const bytes = fs.readFileSync(RUTA_MATRIZ);
  const datos = JSON.parse(bytes.toString('utf8'));
  _cache = {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    hash: sha256(bytes),
    datos,
  };
  return _cache;
}

/**
 * La matriz de finalidades, con su version y su huella.
 *
 * @returns {{
 *   disponible: boolean, version: string|null, hash: string|null,
 *   actualizado_at: string|null, estado: string|null, nota: string|null,
 *   instruccion: string|null, reglas: string[], grupos: object,
 *   finalidades: object[], error: string|null
 * }}
 */
function matriz() {
  try {
    const leido = _leer();
    const d = leido.datos || {};
    return {
      disponible: true,
      version: d.version || null,
      hash: leido.hash,
      actualizado_at: d.actualizado_at || null,
      estado: d.estado || null,
      nota: d.nota || null,
      instruccion: d.instruccion || null,
      reglas: Array.isArray(d.reglas) ? d.reglas : [],
      grupos: (d.grupos && typeof d.grupos === 'object') ? d.grupos : {},
      finalidades: Array.isArray(d.finalidades) ? d.finalidades : [],
      error: null,
    };
  } catch (e) {
    return {
      disponible: false,
      version: null,
      hash: null,
      actualizado_at: null,
      estado: null,
      nota: null,
      instruccion: null,
      reglas: [],
      grupos: {},
      finalidades: [],
      error: e && e.message ? e.message : 'no se pudo leer la matriz de finalidades',
    };
  }
}

/**
 * Un valor limpio para imprimir: null/undefined quedan como cadena vacia.
 *
 * @param {*} v
 * @returns {string}
 */
function _txt(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * El texto de la matriz para el Firmante.
 *
 * Es una lectura del archivo, no una redaccion: sale el estado, la
 * instruccion, las reglas, los grupos y cada finalidad con su literal, su
 * descripcion, las categorias de datos, los titulares, la base juridica, el
 * plazo de conservacion y la consecuencia de revocar.
 *
 * @param {object} m la matriz (la de `matriz()`)
 * @returns {string}
 */
function textoParaFirmante(m) {
  if (!m || !m.disponible) return '';
  const L = [];
  L.push('MATRIZ DE FINALIDADES (Anexo de Encargo)');
  L.push('Version: ' + (_txt(m.version) || 'sin version'));
  if (_txt(m.actualizado_at)) L.push('Actualizada: ' + _txt(m.actualizado_at));
  if (_txt(m.estado)) L.push('Estado: ' + _txt(m.estado));
  if (_txt(m.instruccion)) L.push(_txt(m.instruccion));
  if (_txt(m.nota)) L.push(_txt(m.nota));

  const reglas = Array.isArray(m.reglas) ? m.reglas : [];
  if (reglas.length) {
    L.push('');
    L.push('Reglas de la matriz:');
    for (const r of reglas) L.push('- ' + _txt(r));
  }

  const grupos = (m.grupos && typeof m.grupos === 'object') ? m.grupos : {};
  const clavesGrupo = Object.keys(grupos);
  if (clavesGrupo.length) {
    L.push('');
    L.push('Grupos:');
    for (const clave of clavesGrupo) {
      const g = grupos[clave] || {};
      L.push('- ' + (_txt(g.titulo) || 'Grupo ' + clave));
      if (_txt(g.regla)) L.push('  ' + _txt(g.regla));
    }
  }

  const fines = Array.isArray(m.finalidades) ? m.finalidades : [];
  if (fines.length) {
    L.push('');
    L.push('Finalidades:');
    for (const f of fines) {
      L.push('');
      L.push(_txt(f.id) + '. ' + _txt(f.literal));
      if (_txt(f.descripcion)) L.push('  Que se trata: ' + _txt(f.descripcion));
      if (_txt(f.categorias_datos)) L.push('  Datos: ' + _txt(f.categorias_datos));
      if (_txt(f.titulares)) L.push('  Titulares: ' + _txt(f.titulares));
      if (_txt(f.base_juridica)) L.push('  Base juridica: ' + _txt(f.base_juridica));
      if (_txt(f.responsable_instruye)) L.push('  Quien instruye: ' + _txt(f.responsable_instruye));
      if (_txt(f.plazo_conservacion)) L.push('  Plazo de conservacion: ' + _txt(f.plazo_conservacion));
      if (_txt(f.consecuencia_revocatoria)) L.push('  Si se revoca: ' + _txt(f.consecuencia_revocatoria));
      if (_txt(f.estado_habilitacion)) L.push('  Estado de habilitacion: ' + _txt(f.estado_habilitacion));
    }
  }

  return L.join('\n');
}

module.exports = {
  RUTA_MATRIZ,
  matriz,
  textoParaFirmante,
};
