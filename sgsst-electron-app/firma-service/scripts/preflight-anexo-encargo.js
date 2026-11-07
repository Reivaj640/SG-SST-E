#!/usr/bin/env node
/**
 * scripts/preflight-anexo-encargo.js
 *
 * PREFLIGHT DEL ANEXO DE ENCARGO: ¿QUÉ HAY QUE VERIFICAR ANTES DE QUE EL
 * MANIFIESTO DIGA "FIRMADO"?
 *
 * QUÉ COMPRUEBA
 * -------------
 *   1. EL TEXTO: que el archivo del Anexo de Encargo esté en el servidor y
 *      que su huella SHA-256 sea la que declara el manifiesto. Si no
 *      coinciden, el servicio estaría firmando un texto que nadie ha
 *      verificado.
 *   2. LA CONTRAFIRMA: que exista AL MENOS UNA Empresa ACTIVA con el
 *      Anexo de Encargo EJECUTADO, es decir, con la suscripción de la
 *      Empresa (fase 1) Y la contrafirma de K+AIR (fase 2), y con la fecha
 *      de ejecución en la ficha. Sin los dos actos, el manifiesto no puede
 *      decir "firmado".
 *   3. LAS ACTAS: que los dos archivos de acta estén en el disco y que sus
 *      bytes tengan la huella que quedó registrada. Un acta cuya huella no
 *      cuadra no es un acta.
 *   4. EL MANIFIESTO: que diga "firmado" con fecha y evidencia (si se pide
 *      con `--exigir-firmado`).
 *   5. EL RESPALDO: que el script de respaldo se lleve la carpeta entera de
 *      `storage/` y no una lista de subcarpetas. Las actas del Anexo de
 *      Encargo son evidencia: si el respaldo no las toma, el expediente
 *      pierde documentos que ya no se pueden regenerar (el acta de la
 *      suscripción ya salió del servidor).
 *
 * POR QUÉ ABORTA Y NO AVISA
 * -------------------------
 * Un manifiesto que dice "firmado" sin que el texto, los dos actos, las
 * actas y el respaldo estén en su sitio no es un aviso pendiente: es una
 * afirmación falsa en el documento que lee la compuerta de publicación.
 *
 * USO
 * ---
 *   node scripts/preflight-anexo-encargo.js
 *   node scripts/preflight-anexo-encargo.js --json
 *   node scripts/preflight-anexo-encargo.js --exigir-firmado
 *
 * En el servidor se usa sin argumentos: el texto, el manifiesto y el script
 * de respaldo son los del repo. `--manifiesto`, `--texto` y `--backup`
 * existen para poder probar el preflight sobre una COPIA sin tocar los
 * archivos de verdad.
 *
 * Exit codes:
 *   0 = todo en orden
 *   2 = argumentos inválidos
 *   3 = error de base de datos o de lectura
 *   4 = el texto no está o su huella no coincide con el manifiesto
 *   5 = no hay ninguna Empresa con el Anexo de Encargo ejecutado (ABORTA)
 *   6 = las actas no están o su huella no coincide (ABORTA)
 *   7 = el manifiesto no dice "firmado" (solo con --exigir-firmado)
 *   8 = el respaldo no se lleva la carpeta de las actas (ABORTA)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');

const RUTAS_POR_DEFECTO = {
  texto: path.join(APP_ROOT, 'legal', 'anexo-encargo.html'),
  manifiesto: path.join(SERVICE_ROOT, 'legal-readiness.json'),
  backup: path.join(SERVICE_ROOT, 'deploy', 'backup-firma.sh'),
};

// ---------------------------------------------------------------------------
// SALIDA INJECTABLE (para los tests)
// ---------------------------------------------------------------------------

let SALIDA_FN = console.log;
let ERROR_FN = console.error;

function fijarSalida(fn, fnError) {
  SALIDA_FN = fn || console.log;
  ERROR_FN = fnError || console.error;
}

// ---------------------------------------------------------------------------
// EL RESULTADO
// ---------------------------------------------------------------------------

function resultadoInicial(exigirFirmado) {
  return {
    ok: false,
    motivo: null,
    texto: {
      archivo: 'legal/anexo-encargo.html',
      existe: false,
      hash: null,
      hash_manifiesto: null,
      coincide: false,
      version_manifiesto: null,
    },
    empresas: {
      activas: 0,
      con_suscripcion: 0,
      contrafirmadas: 0,
      detalle: [],
    },
    actas: {
      carpeta: null,
      detalle: [],
      problema: null,
    },
    manifiesto: {
      estado: null,
      fecha: null,
      evidencia: null,
      esperado_firmado: Boolean(exigirFirmado),
    },
    respaldo: {
      script: 'deploy/backup-firma.sh',
      existe: false,
      lleva_storage_entero: false,
      problema: null,
    },
  };
}

/**
 * Los argumentos: `--json`, `--exigir-firmado` y las tres rutas de prueba.
 *
 * @param {Array<string>} args
 * @returns {object}
 * @throws {Error} con `codigo = 2` si hay un argumento que no se conoce.
 */
function parseArgs(args) {
  const opciones = {
    json: false,
    exigirFirmado: false,
    texto: RUTAS_POR_DEFECTO.texto,
    manifiesto: RUTAS_POR_DEFECTO.manifiesto,
    backup: RUTAS_POR_DEFECTO.backup,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') opciones.json = true;
    else if (a === '--exigir-firmado') opciones.exigirFirmado = true;
    else if (a === '--texto' || a === '--manifiesto' || a === '--backup') {
      i += 1;
      if (!args[i]) {
        const e = new Error(a + ' necesita una ruta.');
        e.codigo = 2;
        throw e;
      }
      opciones[a.slice(2)] = path.resolve(args[i]);
    } else {
      const e = new Error('Argumento desconocido: ' + a);
      e.codigo = 2;
      throw e;
    }
  }
  return opciones;
}

// ---------------------------------------------------------------------------
// LAS COMPROBACIONES
// ---------------------------------------------------------------------------

/**
 * El texto vigente y su huella real, calculada sobre los bytes del archivo.
 */
function leerTexto(rutas, salida) {
  if (!fs.existsSync(rutas.texto)) return;
  const bytes = fs.readFileSync(rutas.texto);
  salida.texto.existe = true;
  salida.texto.hash = crypto.createHash('sha256').update(bytes).digest('hex');
  salida.texto.bytes = bytes.length;
}

/**
 * El manifiesto: qué declara del Anexo de Encargo.
 */
function leerManifiesto(rutas, salida) {
  let man;
  try {
    man = JSON.parse(fs.readFileSync(rutas.manifiesto, 'utf8'));
  } catch (e) {
    const err = new Error('No se pudo leer el manifiesto: ' + e.message);
    err.codigo = 3;
    throw err;
  }
  const bloque = (man && man.anexo_encargo) || {};
  salida.texto.hash_manifiesto = bloque.hash || null;
  salida.texto.version_manifiesto = bloque.version || null;
  salida.manifiesto.estado = bloque.estado || null;
  salida.manifiesto.fecha = bloque.fecha || null;
  salida.manifiesto.evidencia = bloque.evidencia || null;
}

/**
 * Las Empresas y el estado de los dos actos.
 */
function leerEmpresas(salida) {
  const db = require('../src/db/connection');
  let filas;
  try {
    filas = db.prepare(`
      SELECT s.id AS id_suscripcion, s.id_empresa, s.version, s.hash_texto,
             s.firmado_at, s.contrafirmado_at,
             s.contrafirma_acta_hash, s.contrafirma_acta_archivo, s.evidencia,
             e.razon_social, e.activo, e.anexo_encargo_firmado_at
      FROM gh_firma_anexo_encargo_suscripciones s
      LEFT JOIN gh_firma_empresas e ON e.id_empresa = s.id_empresa
      WHERE s.estado = 'FIRMADA'
      ORDER BY s.id
    `).all();
  } catch (e) {
    const err = new Error('No se pudo leer la tabla de suscripciones: ' + e.message);
    err.codigo = 3;
    throw err;
  }

  let empresas = [];
  try {
    empresas = db.prepare(
      'SELECT id_empresa, razon_social, activo, anexo_encargo_firmado_at '
      + 'FROM gh_firma_empresas WHERE activo = 1',
    ).all();
  } catch (e) {
    const err = new Error('No se pudo leer la tabla de Empresas: ' + e.message);
    err.codigo = 3;
    throw err;
  }
  salida.empresas.activas = empresas.length;

  for (const f of filas) {
    const empresa = empresas.find((e) => e.id_empresa === f.id_empresa);
    if (!empresa) continue; // la empresa no esta activa
    const suscrita = Boolean(f.firmado_at);
    const contrafirmada = Boolean(f.contrafirmado_at);
    const ejecutada = Boolean(empresa.anexo_encargo_firmado_at);
    if (suscrita) salida.empresas.con_suscripcion += 1;
    if (contrafirmada) salida.empresas.contrafirmadas += 1;
    salida.empresas.detalle.push({
      id_empresa: f.id_empresa,
      razon_social: f.razon_social,
      suscrita,
      contrafirmada,
      ejecutada,
      version: f.version,
      vigente: f.version === salida.texto.version_manifiesto
        && String(f.hash_texto || '').toLowerCase() === String(salida.texto.hash_manifiesto || '').toLowerCase(),
      fecha_ejecucion: empresa.anexo_encargo_firmado_at,
      id_suscripcion: f.id_suscripcion,
      acta_contrafirma_archivo: f.contrafirma_acta_archivo,
      acta_contrafirma_hash: f.contrafirma_acta_hash,
      evidencia_suscripcion: f.evidencia,
    });
  }
}

/**
 * Las actas del disco: están y sus bytes coinciden con lo registrado.
 */
function leerActas(salida) {
  const storage = require('../src/services/storage');
  salida.actas.carpeta = storage.PATHS.actas;
  for (const d of salida.empresas.detalle) {
    // El acta de la contrafirma.
    if (d.acta_contrafirma_archivo) {
      salida.actas.detalle.push({
        empresa: d.id_empresa,
        archivo: d.acta_contrafirma_archivo,
        esperado: d.acta_contrafirma_hash,
      });
    }
    // El acta de la suscripción: la primera, la que ya se llevó la Empresa.
    if (d.evidencia_suscripcion) {
      let ev = {};
      try {
        ev = JSON.parse(d.evidencia_suscripcion);
      } catch (e) {
        ev = {};
      }
      if (ev.acta_archivo) {
        salida.actas.detalle.push({
          empresa: d.id_empresa,
          archivo: ev.acta_archivo,
          esperado: ev.acta_hash,
        });
      }
    }
  }

  for (const a of salida.actas.detalle) {
    const ruta = path.join(storage.PATHS.actas, path.basename(a.archivo));
    a.existe = fs.existsSync(ruta);
    if (a.existe) {
      const real = crypto.createHash('sha256')
        .update(fs.readFileSync(ruta)).digest('hex');
      a.hash_coincide = String(real).toLowerCase() === String(a.esperado || '').toLowerCase();
    } else {
      a.hash_coincide = false;
    }
    if (!a.existe) {
      salida.actas.problema = 'el acta ' + a.archivo + ' no esta en el servidor';
    } else if (!a.hash_coincide) {
      salida.actas.problema = 'el acta ' + a.archivo + ' no tiene la huella que quedo registrada';
    }
  }
}

/**
 * El respaldo: tiene que llevarse la carpeta ENTERA de storage.
 *
 * El acta de la suscripción ya salió del servidor: la Empresa la tiene. Si el
 * respaldo no la copia, el expediente pierde un documento que ya no se puede
 * regenerar. Por eso el backup tiene que empaquetar `storage/` entero y no
 * una lista de subcarpetas: la carpeta de las actas es nueva y una lista
 * fija se quedaría atrás sin avisar.
 */
function leerRespaldo(rutas, salida) {
  if (!fs.existsSync(rutas.backup)) {
    salida.respaldo.problema = 'no se encuentra deploy/backup-firma.sh';
    return;
  }
  salida.respaldo.existe = true;
  const texto = fs.readFileSync(rutas.backup, 'utf8');
  // `tar -C "$BASE" ... storage` (el directorio entero) es lo que vale.
  const llevaEntero = /tar\s+-C\s+"?\$?\{?BASE\}?"?\s+[^\n]*\bstorage\b/.test(texto)
    && !/tar\s+[^\n]*\bstorage\/(originales|firmados|constancias|papel)\b/.test(texto);
  salida.respaldo.lleva_storage_entero = llevaEntero;
  if (!llevaEntero) {
    salida.respaldo.problema = 'el script de respaldo no se lleva la carpeta storage '
      + 'entera: la carpeta de las actas (storage/pdfs/actas) se quedaria fuera';
  }
}

// ---------------------------------------------------------------------------
// EL MAIN
// ---------------------------------------------------------------------------

/**
 * Corre el preflight y devuelve el codigo de salida.
 *
 * @param {Array<string>} args
 * @returns {number} el codigo de salida (0 = todo en orden).
 */
function main(args) {
  let opciones;
  try {
    opciones = parseArgs(args || []);
  } catch (e) {
    ERROR_FN('Argumento desconocido: ' + e.message);
    return 2;
  }

  const salida = resultadoInicial(opciones.exigirFirmado);

  const imprimir = (codigo, motivo) => {
    salida.ok = false;
    salida.motivo = motivo;
    if (opciones.json) {
      SALIDA_FN(JSON.stringify(salida, null, 2));
      return;
    }
    SALIDA_FN('[preflight-anexo-encargo] Preflight del Anexo de Encargo');
    SALIDA_FN('  Texto: ' + salida.texto.archivo);
    SALIDA_FN('    existe:            ' + salida.texto.existe);
    SALIDA_FN('    huella archivo:    ' + (salida.texto.hash || '-'));
    SALIDA_FN('    huella manifiesto: ' + (salida.texto.hash_manifiesto || '-'));
    SALIDA_FN('    coinciden:         ' + salida.texto.coincide);
    SALIDA_FN('  Empresas activas: ' + salida.empresas.activas);
    SALIDA_FN('    con la suscripcion cerrada: ' + salida.empresas.con_suscripcion);
    SALIDA_FN('    con la contrafirma de K+AIR: ' + salida.empresas.contrafirmadas);
    for (const d of salida.empresas.detalle) {
      SALIDA_FN('    - ' + d.id_empresa + ' ' + (d.razon_social || '') + ' :: '
        + 'suscrita=' + d.suscrita + ' contrafirmada=' + d.contrafirmada
        + ' ejecutada=' + d.ejecutada + ' vigente=' + d.vigente);
    }
    SALIDA_FN('  Actas: ' + (salida.actas.carpeta || '(sin carpeta)'));
    for (const a of salida.actas.detalle) {
      SALIDA_FN('    - ' + a.archivo + ' :: en disco=' + a.existe
        + ' hash ok=' + a.hash_coincide);
    }
    SALIDA_FN('  Manifiesto: estado=' + (salida.manifiesto.estado || '-')
      + ' fecha=' + (salida.manifiesto.fecha || '-'));
    SALIDA_FN('  Respaldo: lleva storage entero=' + salida.respaldo.lleva_storage_entero);
    SALIDA_FN('  RESULTADO: ABORTA — ' + motivo);
  };

  try {
    leerTexto(opciones, salida);
    leerManifiesto(opciones, salida);
    leerEmpresas(salida);
    leerActas(salida);
    leerRespaldo(opciones, salida);
  } catch (e) {
    ERROR_FN('[preflight-anexo-encargo] ' + e.message);
    imprimir(e.codigo || 3, e.message);
    return e.codigo || 3;
  }

  if (!salida.texto.existe) {
    imprimir(4, 'El texto del Anexo de Encargo no esta en el servidor.');
    return 4;
  }
  salida.texto.coincide = String(salida.texto.hash).toLowerCase()
    === String(salida.texto.hash_manifiesto || '').toLowerCase();
  if (!salida.texto.coincide) {
    imprimir(4, 'El texto del servidor no tiene la huella que declara el manifiesto: '
      + 'el servicio firmaria un texto que nadie ha verificado.');
    return 4;
  }

  if (salida.empresas.contrafirmadas === 0) {
    imprimir(5, 'No hay ninguna Empresa activa con el Anexo de Encargo contrafirmado: '
      + 'el manifiesto no puede decir "firmado".');
    return 5;
  }

  const ejecutadas = salida.empresas.detalle.filter((d) => d.ejecutada && d.contrafirmada);
  if (ejecutadas.length === 0) {
    imprimir(5, 'Hay suscripciones contrafirmadas, pero ninguna Empresa tiene la fecha de '
      + 'ejecucion en la ficha: las dos escrituras van en una sola transaccion y no '
      + 'pueden no coincidir.');
    return 5;
  }

  if (salida.actas.problema) {
    imprimir(6, salida.actas.problema);
    return 6;
  }

  if (salida.respaldo.problema) {
    imprimir(8, salida.respaldo.problema);
    return 8;
  }

  if (opciones.exigirFirmado && salida.manifiesto.estado !== 'firmado') {
    imprimir(7, 'El manifiesto no dice "firmado" (dice "'
      + (salida.manifiesto.estado || 'nada') + '").');
    return 7;
  }

  salida.ok = true;
  salida.motivo = 'el texto, los dos actos, las actas y el respaldo estan en su sitio.';
  if (opciones.json) {
    SALIDA_FN(JSON.stringify(salida, null, 2));
    return 0;
  }
  SALIDA_FN('[preflight-anexo-encargo] Preflight del Anexo de Encargo');
  SALIDA_FN('  Texto: ' + salida.texto.archivo);
  SALIDA_FN('    existe:            ' + salida.texto.existe);
  SALIDA_FN('    huella archivo:    ' + (salida.texto.hash || '-'));
  SALIDA_FN('    huella manifiesto: ' + (salida.texto.hash_manifiesto || '-'));
  SALIDA_FN('    coinciden:         ' + salida.texto.coincide);
  SALIDA_FN('  Empresas activas: ' + salida.empresas.activas);
  SALIDA_FN('    con la suscripcion cerrada: ' + salida.empresas.con_suscripcion);
  SALIDA_FN('    con la contrafirma de K+AIR: ' + salida.empresas.contrafirmadas);
  for (const d of salida.empresas.detalle) {
    SALIDA_FN('    - ' + d.id_empresa + ' ' + (d.razon_social || '') + ' :: '
      + 'suscrita=' + d.suscrita + ' contrafirmada=' + d.contrafirmada
      + ' ejecutada=' + d.ejecutada + ' vigente=' + d.vigente);
  }
  SALIDA_FN('  Actas verificadas: ' + salida.actas.detalle.length);
  SALIDA_FN('  Manifiesto: estado=' + (salida.manifiesto.estado || '-')
    + ' fecha=' + (salida.manifiesto.fecha || '-'));
  SALIDA_FN('  Respaldo: lleva storage entero=' + salida.respaldo.lleva_storage_entero);
  SALIDA_FN('  RESULTADO: OK');
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = {
  main,
  parseArgs,
  fijarSalida,
  resultadoInicial,
  RUTAS_POR_DEFECTO,
};
