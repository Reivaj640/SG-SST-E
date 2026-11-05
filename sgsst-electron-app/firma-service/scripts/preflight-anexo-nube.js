#!/usr/bin/env node
/**
 * scripts/preflight-anexo-nube.js
 *
 * PREFLIGHT DEL ENCENDIDO DE LA COMPUERTA `FIRMA_EXIGIR_ANEXO_NUBE`.
 *
 * QUÉ HACE
 * --------
 * Antes de encender la compuerta, comprueba que las tres cosas de las que
 * depende el texto del Acuerdo 3.4(h) sean verdad en el servidor:
 *
 *   1. El texto del Anexo de Nube está en el servidor y su huella SHA-256
 *      es la que declara el manifiesto. Si no coinciden, el servicio firmaría
 *      un texto que nadie ha verificado.
 *   2. Hay AL MENOS UNA Empresa ACTIVA con el Anexo de Nube suscrito, y la
 *      suscripción es del texto vigente. Sin esto, encender la compuerta
 *      deja a todas las Empresas sin poder pedir firmas: es exactamente el
 *      efecto que el 3.4(h) promete, aplicado de golpe y sin transición.
 *   3. La variable `FIRMA_EXIGIR_ANEXO_NUBE` está en `true` (si se pide con
 *      `--exigir-compuerta`).
 *
 * POR QUÉ ABORTA Y NO AVISA
 * -------------------------
 * La excepción auditable de habilitación NO levanta este bloqueo: es para
 * casos individuales y con motivo, no para el estado general de la
 * plataforma. Encender la compuerta sin ninguna Empresa suscrita no es un
 * aviso: es dejar el servicio sin clientes.
 *
 * EL ORDEN OBLIGATORIO (decisión C del owner, 5-nov-2026)
 * --------------------------------------------------------
 *   1) Publicar el Anexo de Nube v1.1 (o la versión que firme el owner).
 *   2) La Empresa activa lo suscribe (enlace de un solo uso + código).
 *   3) `node scripts/preflight-anexo-nube.js --exigir-compuerta` → 0.
 *   4) El despliegue enciende `FIRMA_EXIGIR_ANEXO_NUBE=true`.
 *   5) Se publica el Acuerdo v1.4.
 *
 * USO
 * ---
 *   node scripts/preflight-anexo-nube.js
 *   node scripts/preflight-anexo-nube.js --json
 *   node scripts/preflight-anexo-nube.js --exigir-compuerta
 *
 * Exit codes:
 *   0 = todo en orden
 *   2 = argumentos inválidos
 *   3 = error de base de datos
 *   4 = el texto no está o su huella no coincide con el manifiesto
 *   5 = no hay ninguna Empresa activa con el Anexo de Nube suscrito (ABORTA)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const args = process.argv.slice(2);
const comoJson = args.includes('--json');
const exigirCompuerta = args.includes('--exigir-compuerta');

for (const a of args) {
  if (!['--json', '--exigir-compuerta'].includes(a)) {
    console.error(`Argumento desconocido: ${a}`);
    process.exit(2);
  }
}

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RUTA_MODELO = path.join(REPO_ROOT, 'legal', 'anexo-nube-v1.1.html');
const RUTA_MANIFIESTO = path.join(__dirname, '..', 'legal-readiness.json');

const SALIDA = {
  ok: false,
  motivo: null,
  texto: {
    archivo: 'legal/anexo-nube-v1.1.html',
    existe: false,
    hash: null,
    hash_manifiesto: null,
    coincide: false,
  },
  empresas: {
    activas: 0,
    con_anexo_nube: 0,
    con_anexo_nube_vigente: 0,
    detalle: [],
  },
  compuerta: {
    variable: 'FIRMA_EXIGIR_ANEXO_NUBE',
    valor: process.env.FIRMA_EXIGIR_ANEXO_NUBE || null,
    encendida: process.env.FIRMA_EXIGIR_ANEXO_NUBE === 'true',
  },
};

function textoError(msg) {
  console.error(`[preflight-anexo-nube] ${msg}`);
}

/**
 * El texto vigente y su huella real, calculada sobre los bytes del archivo.
 */
function leerTexto() {
  if (!fs.existsSync(RUTA_MODELO)) return;
  const bytes = fs.readFileSync(RUTA_MODELO);
  SALIDA.texto.existe = true;
  SALIDA.texto.hash = crypto.createHash('sha256').update(bytes).digest('hex');
  SALIDA.texto.bytes = bytes.length;
}

/**
 * El manifiesto: qué huella declara del texto vigente.
 */
function leerManifiesto() {
  try {
    const man = JSON.parse(fs.readFileSync(RUTA_MANIFIESTO, 'utf8'));
    const modelo = man && man.anexo_nube && man.anexo_nube.modelo;
    SALIDA.texto.hash_manifiesto = modelo ? modelo.hash : null;
    SALIDA.texto.version_manifiesto = modelo ? modelo.version : null;
    SALIDA.texto.manifiesto = 'firma-service/legal-readiness.json';
  } catch (e) {
    textoError(`No se pudo leer el manifiesto: ${e.message}`);
  }
}

/**
 * Las Empresas y su estado de suscripción.
 */
function leerEmpresas() {
  const db = require('../src/db/connection');
  let filas;
  try {
    filas = db.prepare(
      'SELECT id_empresa, razon_social, activo, anexo_nube_firmado_at,'
      + ' anexo_nube_version, anexo_nube_hash FROM gh_firma_empresas'
    ).all();
  } catch (e) {
    textoError(`No se pudo leer gh_firma_empresas: ${e.message}`);
    throw e;
  }

  const activas = filas.filter((f) => f.activo === 1);
  SALIDA.empresas.activas = activas.length;

  for (const f of activas) {
    const suscrito = Boolean(f.anexo_nube_firmado_at);
    const vigente = suscrito && f.anexo_nube_hash === SALIDA.texto.hash;
    if (suscrito) SALIDA.empresas.con_anexo_nube += 1;
    if (vigente) SALIDA.empresas.con_anexo_nube_vigente += 1;
    SALIDA.empresas.detalle.push({
      id_empresa: f.id_empresa,
      razon_social: f.razon_social,
      suscrito,
      version: f.anexo_nube_version,
      vigente,
      fecha: f.anexo_nube_firmado_at,
    });
  }
}

function imprimir() {
  if (comoJson) {
    console.log(JSON.stringify(SALIDA, null, 2));
    return;
  }
  console.log('[preflight-anexo-nube] Preflight de la compuerta FIRMA_EXIGIR_ANEXO_NUBE');
  console.log(`  Texto: ${SALIDA.texto.archivo}`);
  console.log(`    existe:           ${SALIDA.texto.existe}`);
  console.log(`    huella archivo:   ${SALIDA.texto.hash || '-'}`);
  console.log(`    huella manifiesto: ${SALIDA.texto.hash_manifiesto || '-'}`);
  console.log(`    coinciden:        ${SALIDA.texto.coincide}`);
  console.log(`  Empresas activas:  ${SALIDA.empresas.activas}`);
  console.log(`    con Anexo de Nube suscrito:       ${SALIDA.empresas.con_anexo_nube}`);
  console.log(`    con Anexo de Nube del texto vigente: ${SALIDA.empresas.con_anexo_nube_vigente}`);
  for (const d of SALIDA.empresas.detalle) {
    console.log(`    - ${d.id_empresa} ${d.razon_social || ''} :: suscrito=${d.suscrito} vigente=${d.vigente} v${d.version || '-'}`);
  }
  console.log(`  ${SALIDA.compuerta.variable}: ${SALIDA.compuerta.valor === null ? '(no definida)' : SALIDA.compuerta.valor}`);
  console.log(SALIDA.ok ? '  RESULTADO: OK' : `  RESULTADO: ABORTA — ${SALIDA.motivo}`);
}

function main() {
  leerTexto();
  leerManifiesto();
  SALIDA.texto.coincide = Boolean(
    SALIDA.texto.existe
    && SALIDA.texto.hash
    && SALIDA.texto.hash_manifiesto
    && SALIDA.texto.hash === SALIDA.texto.hash_manifiesto,
  );

  if (!SALIDA.texto.existe) {
    SALIDA.motivo = `el texto ${SALIDA.texto.archivo} no está en el servidor`;
    imprimir();
    process.exit(4);
  }
  if (!SALIDA.texto.coincide) {
    SALIDA.motivo = 'la huella del texto no coincide con la del manifiesto';
    imprimir();
    process.exit(4);
  }

  try {
    leerEmpresas();
  } catch (e) {
    SALIDA.motivo = `no se pudo leer el estado de las Empresas: ${e.message}`;
    imprimir();
    process.exit(3);
  }

  if (SALIDA.empresas.con_anexo_nube_vigente === 0) {
    SALIDA.motivo = 'no hay ninguna Empresa activa con el Anexo de Nube suscrito '
      + 'sobre el texto vigente: encender la compuerta las dejaría sin poder pedir firmas';
    imprimir();
    process.exit(5);
  }

  if (exigirCompuerta && !SALIDA.compuerta.encendida) {
    SALIDA.motivo = `${SALIDA.compuerta.variable} no está en true`;
    imprimir();
    process.exit(5);
  }

  SALIDA.ok = true;
  SALIDA.motivo = 'hay al menos una Empresa activa con el Anexo de Nube suscrito sobre el texto vigente';
  imprimir();
  process.exit(0);
}

main();
