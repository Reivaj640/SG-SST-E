#!/usr/bin/env node
/**
 * scripts/publicar-acuerdo-legal.js
 *
 * Publica el TEXTO LEGAL del Acuerdo de uso en el servicio, leyéndolo del
 * archivo sellado y comprobando su huella contra el manifiesto antes de
 * enviarlo.
 *
 * POR QUÉ HAY UN SCRIPT
 * ---------------------
 * El texto legal se publica por la API admin (`POST
 * /internal/admin/acuerdo-versiones`). El cuerpo lleva el texto COMPLETO del
 * Acuerdo: 32.907 caracteres. Pegarlo a mano en una terminal es una forma
 * garantizada de publicar un texto con un typo, y un typo en el Acuerdo de
 * uso no es un bug: es un problema legal.
 *
 * El script arma el cuerpo desde el archivo, verifica que su huella sea la
 * del manifiesto (la que se archivó) y lo manda. Si el archivo y el
 * manifiesto no cuadran, no publica nada.
 *
 * No es la 5B ni toca datos: publica una versión del Acuerdo y nada más.
 *
 * USO
 * ---
 *   node scripts/publicar-acuerdo-legal.js --url=https://firma.kair.fyi \
 *        --admin-key-file=/opt/kair-firma/admin-key.txt
 *   node scripts/publicar-acuerdo-legal.js --url=https://firma.kair.fyi \
 *        --admin-key-file=/opt/kair-firma/admin-key.txt --simular
 *
 * Exit codes:
 *   0  publicado (o simulado con éxito)
 *   2  argumentos inválidos
 *   3  error de base de datos o de red
 *   4  el archivo no coincide con el manifiesto: NO se publica
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const FIXTURES = path.resolve(__dirname, 'fixtures');
const MANIFIESTO = path.join(FIXTURES, 'acuerdo-ARCHIVO.json');

function parseArgs(argv) {
  const opts = {
    url: 'https://firma.kair.fyi',
    adminKeyFile: null,
    adminKey: null,
    version: 'v1.0',
    archivo: null,
    simular: false,
    timeoutMs: 30000,
  };
  for (const arg of argv) {
    if (arg === '--simular') opts.simular = true;
    else if (arg.startsWith('--url=')) opts.url = arg.slice('--url='.length).trim();
    else if (arg.startsWith('--admin-key-file=')) opts.adminKeyFile = arg.slice('--admin-key-file='.length).trim();
    else if (arg.startsWith('--admin-key=')) opts.adminKey = arg.slice('--admin-key='.length).trim();
    else if (arg.startsWith('--version=')) opts.version = arg.slice('--version='.length).trim();
    else if (arg.startsWith('--archivo=')) opts.archivo = arg.slice('--archivo='.length).trim();
    else if (arg.startsWith('--timeout-ms=')) opts.timeoutMs = parseInt(arg.slice('--timeout-ms='.length), 10);
    else throw new Error(`Argumento desconocido: ${arg}`);
  }
  if (!opts.adminKey && !opts.adminKeyFile) {
    throw new Error('Falta la llave admin (--admin-key-file o --admin-key)');
  }
  opts.url = opts.url.replace(/\/+$/, '');
  return opts;
}

function leerLlave(opts) {
  if (opts.adminKey) return String(opts.adminKey).trim();
  return fs.readFileSync(opts.adminKeyFile, 'utf8').trim();
}

/**
 * El archivo del texto legal: el que dice el manifiesto para esa versión.
 */
function archivoDe(version) {
  if (!fs.existsSync(MANIFIESTO)) {
    throw new Error(`No existe el manifiesto ${MANIFIESTO}`);
  }
  const manifiesto = JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8'));
  const entrada = manifiesto.versiones && manifiesto.versiones[version];
  if (!entrada) {
    throw new Error(`El manifiesto no tiene la versión ${version}. `
      + `Tiene: ${Object.keys(manifiesto.versiones || {}).join(', ')}`);
  }
  // El `archivo` del manifiesto es relativo a la raiz de firma-service (la
  // carpeta que contiene a `scripts/`), no a la del repo.
  const ruta = path.resolve(__dirname, '..', entrada.archivo || '');
  if (!fs.existsSync(ruta)) {
    throw new Error(`El manifiesto apunta a ${entrada.archivo} y ese archivo no existe`);
  }
  return { ruta, entrada };
}

function pedir(url, opcion, cuerpo, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const esHttps = u.protocol === 'https:';
    const mod = esHttps ? https : http;
    const req = mod.request({
      method: opcion.method || 'GET',
      hostname: u.hostname,
      port: u.port || (esHttps ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: opcion.headers || {},
      timeout: timeoutMs,
    }, (res) => {
      const trozos = [];
      res.on('data', (d) => trozos.push(d));
      res.on('end', () => {
        const texto = Buffer.concat(trozos).toString('utf8');
        let json = null;
        try { json = JSON.parse(texto); } catch (_) { /* no es JSON */ }
        resolve({ status: res.statusCode, texto, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (cuerpo) req.write(cuerpo);
    req.end();
  });
}

async function main(argv) {
  const opts = parseArgs(argv);

  const { ruta, entrada } = archivoDe(opts.version);
  const texto = fs.readFileSync(ruta, 'utf8');
  const hash = crypto.createHash('sha256').update(texto, 'utf8').digest('hex');

  console.log('=== PUBLICACIÓN DEL TEXTO LEGAL DEL ACUERDO ===');
  console.log(`  archivo:  ${path.basename(ruta)}`);
  console.log(`  versión:  ${opts.version}`);
  console.log(`  caracteres: ${texto.length}`);
  console.log(`  huella:   ${hash}`);
  console.log(`  manifiesto: ${entrada.sha256} (archivado el ${entrada.fecha_archivado || '?'})`);

  if (hash !== entrada.sha256) {
    console.error('\n  EL ARCHIVO NO COINCIDE CON EL MANIFIESTO. No se publica nada.');
    console.error('  Si el texto legal cambió, hay que volver a archivarlo y a que lo apruebe el abogado.');
    return 4;
  }
  console.log('  el archivo coincide con la huella archivada');

  if (opts.simular) {
    console.log('\nSimulación: no se envía nada.');
    return 0;
  }

  const llave = leerLlave(opts);
  const cuerpo = JSON.stringify({
    version: opts.version,
    texto,
    activa: true,
    creado_por: 'rh:despliegue',
    metadata: { archivo: path.basename(ruta), sha256: hash },
  });

  let res;
  try {
    res = await pedir(opts.url + '/internal/admin/acuerdo-versiones', {
      method: 'POST',
      headers: {
        'X-Admin-API-Key': llave,
        'Content-Type': 'application/json',
      },
    }, cuerpo, opts.timeoutMs);
  } catch (e) {
    console.error('\n  No se pudo publicar: ' + e.message);
    return 3;
  }

  console.log(`\n  HTTP ${res.status}`);
  if (res.json) console.log('  ' + JSON.stringify(res.json, null, 2).replace(/\n/g, '\n  '));
  else console.log('  ' + res.texto.slice(0, 500));

  if (res.status !== 200 && res.status !== 201) {
    console.error('\n  La publicación NO se hizo. Revisa el código de error.');
    return 3;
  }

  console.log('\n  Publicado. Verificalo con:');
  console.log(`  node scripts/archivar-acuerdo.js --version=${opts.version} --verificar`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code)).catch((e) => {
    console.error('Error: ' + (e && e.stack ? e.stack : e));
    process.exit(3);
  });
}

module.exports = { parseArgs, archivoDe };
