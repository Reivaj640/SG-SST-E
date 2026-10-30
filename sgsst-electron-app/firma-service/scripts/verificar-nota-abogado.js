#!/usr/bin/env node
/**
 * scripts/verificar-nota-abogado.js
 *
 * COMPRUEBA QUE LA NOTA AL ABOGADO NO MIENTA.
 *
 * La nota al abogado cita, para cada documento, su tamaño en bytes y su huella
 * SHA-256. Si esos numeros no son los del archivo real, la nota es un escrito
 * que dice una cosa y el paquete otra, y el abogado aprueba un texto que no es
 * el que le mandaron. Eso es exactamente lo que este script evita.
 *
 * QUE COMPRUEBA
 * -------------
 *  1. Cada fila de la tabla de la nota: el archivo de la ruta existe, tiene el
 *     numero de bytes que dice la nota y su SHA-256 es el que dice la nota.
 *  2. Que cada adjunto del paquete sea byte a byte igual a su origen.
 *  3. Que SHA256SUMS.txt coincida con los adjuntos reales.
 *
 * Uso:
 *   node scripts/verificar-nota-abogado.js
 *   node scripts/verificar-nota-abogado.js --paquete=ruta
 *
 * Exit codes:
 *   0 = todo coincide
 *   3 = hay al menos una discrepancia (se listan todas)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const DOCS = path.join(APP_ROOT, 'docs', 'gestion-humana', 'firma-electronica');
const PAQUETE_DEFAULT = path.join(DOCS, 'paquete-abogado-2026-10-30');
const NOTA_DEFAULT = path.join(PAQUETE_DEFAULT, 'nota-al-abogado-2026-10-30.md');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function main() {
  const args = process.argv.slice(2);
  let paquete = PAQUETE_DEFAULT;
  let nota = NOTA_DEFAULT;
  for (const a of args) {
    if (a.startsWith('--paquete=')) {
      paquete = path.resolve(a.slice('--paquete='.length).trim());
      nota = path.join(paquete, 'nota-al-abogado-2026-10-30.md');
    } else if (a.startsWith('--nota=')) {
      nota = path.resolve(a.slice('--nota='.length).trim());
    } else {
      console.error('Argumento desconocido: ' + a);
      process.exit(2);
    }
  }

  if (!fs.existsSync(nota)) {
    console.error('No existe la nota: ' + nota);
    process.exit(3);
  }
  const texto = fs.readFileSync(nota, 'utf8');

  const problemas = [];

  // 1. Las filas de la tabla de documentos.
  //    Formato: | # | Documento | Adjunto | Ruta | Bytes | SHA-256 |
  const filas = [];
  for (const linea of texto.split(/\r?\n/)) {
    if (!/^\|\s*\d+\s*\|/.test(linea)) continue;
    const celdas = linea.split('|').slice(1, -1).map(c => c.trim());
    if (celdas.length < 6) continue;
    const bytes = celdas[4].replace(/[\s\u00a0]/g, '');
    const hash = celdas[5].replace(/[`\s]/g, '');
    // La ruta va con acentos graves en la nota (es markdown): se quitan para
    // poder abrir el archivo.
    const ruta = celdas[3].replace(/[`\s]/g, '');
    const adjunto = celdas[2].replace(/[`\s]/g, '');
    filas.push({ n: celdas[0], adjunto, ruta, bytes, hash });
  }
  if (filas.length === 0) {
    console.error('La nota no tiene filas de documento: el formato de la tabla cambio.');
    process.exit(3);
  }

  console.log('=== NOTA AL ABOGADO: VERIFICACION ===');
  console.log('nota: ' + nota);
  console.log('filas en la tabla: ' + filas.length + '\n');

  for (const f of filas) {
    const absoluto = path.isAbsolute(f.ruta) ? f.ruta : path.join(REPO_ROOT, f.ruta);
    if (!fs.existsSync(absoluto)) {
      problemas.push('documento ' + f.n + ': no existe ' + f.ruta);
      console.log('  [FALTA] ' + f.n + '  ' + f.ruta);
      continue;
    }
    const buf = fs.readFileSync(absoluto);
    const hash = sha256(buf);
    const okBytes = String(buf.length) === f.bytes;
    const okHash = hash === f.hash.toLowerCase();
    if (!okBytes) {
      problemas.push('documento ' + f.n + ': la nota dice ' + f.bytes + ' bytes y el archivo tiene ' + buf.length);
    }
    if (!okHash) {
      problemas.push('documento ' + f.n + ': la nota dice ' + f.hash + ' y el archivo tiene ' + hash);
    }
    console.log('  [' + (okBytes && okHash ? 'OK   ' : 'FALLA') + '] ' + f.n + '  ' + f.ruta);
    if (!okBytes) console.log('         bytes: nota ' + f.bytes + ' / real ' + buf.length);
    if (!okHash) console.log('         hash:  nota ' + f.hash + '\n                real ' + hash);

    // 2. El adjunto del paquete tiene que ser igual al origen.
    if (f.adjunto && fs.existsSync(paquete)) {
      const adj = path.join(paquete, f.adjunto);
      if (!fs.existsSync(adj)) {
        problemas.push('documento ' + f.n + ': no esta el adjunto ' + f.adjunto + ' en el paquete');
      } else {
        const bufAdj = fs.readFileSync(adj);
        if (!bufAdj.equals(buf)) {
          problemas.push('documento ' + f.n + ': el adjunto ' + f.adjunto + ' NO es igual al archivo del repo');
        }
      }
    }
  }

  // 3. SHA256SUMS.txt contra los adjuntos reales.
  const sums = path.join(paquete, 'SHA256SUMS.txt');
  if (fs.existsSync(sums)) {
    const lineas = fs.readFileSync(sums, 'utf8').split(/\r?\n/).filter(l => l.trim());
    for (const linea of lineas) {
      const m = /^([0-9a-f]{64})\s+(.+)$/.exec(linea.trim());
      if (!m) {
        problemas.push('SHA256SUMS.txt tiene una linea que no es "hash  nombre": ' + linea);
        continue;
      }
      const destino = path.join(paquete, m[2].trim());
      if (!fs.existsSync(destino)) {
        problemas.push('SHA256SUMS.txt lista ' + m[2] + ', que no esta en el paquete');
        continue;
      }
      const real = sha256(fs.readFileSync(destino));
      if (real !== m[1]) {
        problemas.push('SHA256SUMS.txt no coincide con ' + m[2]);
      }
    }
    console.log('\n  SHA256SUMS.txt: ' + lineas.length + ' lineas verificadas');
  } else {
    problemas.push('no existe SHA256SUMS.txt en el paquete');
  }

  console.log('');
  if (problemas.length) {
    console.log('=== HAY ' + problemas.length + ' DISCREPANCIA(S) ===');
    problemas.forEach(p => console.log('  - ' + p));
    process.exit(3);
  }
  console.log('=== TODO COINCIDE: la nota no miente ===');
}

main();
