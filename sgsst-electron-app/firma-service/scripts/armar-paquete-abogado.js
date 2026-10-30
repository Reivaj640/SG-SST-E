#!/usr/bin/env node
/**
 * scripts/armar-paquete-abogado.js
 *
 * ARMA el paquete para el abogado: copia los documentos con el nombre de
 * adjunto, calcula su SHA-256 y escribe el manifiesto SHA256SUMS.txt.
 *
 * POR QUE EXISTE
 * --------------
 * La huella que se le pide al abogado tiene que ser la del archivo exacto que
 * se le entrega. Si alguien edita a mano el manifiesto, o regenera el texto
 * sin regenerar el manifiesto, la huella que se certifica deja de ser la del
 * documento: el paquete miente. Este script hace las dos cosas siempre
 * juntas, y ademas verifica que el manifiesto del repo diga lo mismo.
 *
 * REGLAS
 * ------
 *  1. Determinista: dos corridas seguidas dan el mismo SHA256SUMS.txt.
 *  2. No inventa: si un documento falta, no arma el paquete.
 *  3. Verifica el manifiesto legal del repo (legal-readiness.json): la huella
 *     del Acuerdo y la del Anexo de Encargo tienen que coincidir con las que
 *     calcula aqui. Si no coinciden, sale con codigo 3.
 *  4. No publica nada ni firma nada: esto solo arma el paquete.
 *
 * Uso:
 *   node scripts/armar-paquete-abogado.js
 *   node scripts/armar-paquete-abogado.js --paquete=docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30
 *
 * Exit codes:
 *   0 = paquete armado y verificado
 *   3 = falta un documento, o el manifiesto legal no coincide
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SERVICE_ROOT, '..');
const PAQUETE_DEFAULT = path.join(
  REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica', 'paquete-abogado-2026-10-30'
);

// Los documentos del paquete, en su orden. El "adjunto" es el nombre
// con el que viaja; el "origen" es el archivo del repo, que no se modifica.
const DOCUMENTOS = [
  {
    adjunto: '01-acuerdo-uso-v1.3.txt',
    origen: path.join(SERVICE_ROOT, 'scripts', 'fixtures', 'acuerdo-v1.3.txt'),
    que: 'Acuerdo de uso v1.3 (texto final armado)',
  },
  {
    adjunto: '02-anexo-de-encargo.html',
    origen: path.join(REPO_ROOT, 'legal', 'anexo-encargo.html'),
    que: 'Anexo de Encargo de Tratamiento de Datos Personales',
  },
  {
    adjunto: '03-anexo-de-nube-v1.0.html',
    origen: path.join(REPO_ROOT, 'legal', 'anexo-nube-v1.0.html'),
    que: 'Anexo de Nube v1.0',
  },
  {
    adjunto: '04-constancia-de-aprobacion-v1.3.html',
    origen: path.join(REPO_ROOT, 'legal', 'constancia-aprobacion-acuerdo.html'),
    que: 'Constancia de aprobacion de la v1.3',
  },
  {
    adjunto: '05-correspondencia-texto-codigo-v1.3.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'correspondencia-texto-codigo-v1.3.md'
    ),
    que: 'Correspondencia texto <-> codigo: que numeral exige que y donde vive (adjunto 5)',
  },
  {
    adjunto: '06-auditoria-capitulo-v-t1-t2.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'auditoria-capitulo-v-acuerdo-uso-2026-10-19.md'
    ),
    que: 'Hallazgos T1 y T2 del Capitulo V, para el punto 5 (adjunto 6)',
  },
  {
    adjunto: '07-evaluacion-canal-correo.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'evaluacion-canal-correo-2026-10-27.md'
    ),
    que: 'Evaluacion del canal de correo: el papel del destinatario y el RNBD (adjunto 7)',
  },
  {
    adjunto: '08-especificacion-abogado-2026-10-30.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'especificacion-abogado-2026-10-30.md'
    ),
    que: 'La especificacion del abogado del 30-oct-2026 que ordena esta ronda (adjunto 8)',
  },
];

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function parseArgs(argv) {
  const args = { paquete: PAQUETE_DEFAULT };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--paquete=')) args.paquete = path.resolve(a.slice('--paquete='.length).trim());
    else {
      console.error('Argumento desconocido: ' + a);
      process.exit(3);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);

  // 1. Que existan todos los origenes.
  const faltan = DOCUMENTOS.filter(d => !fs.existsSync(d.origen));
  if (faltan.length) {
    console.error('FALTAN DOCUMENTOS:');
    faltan.forEach(d => console.error('  ' + d.origen));
    process.exit(3);
  }

  // 2. Copiar con el nombre de adjunto y calcular la huella.
  fs.mkdirSync(args.paquete, { recursive: true });
  const lineas = [];
  const detalle = [];
  DOCUMENTOS.forEach(function (d) {
    const buf = fs.readFileSync(d.origen);
    const destino = path.join(args.paquete, d.adjunto);
    fs.writeFileSync(destino, buf);
    const hash = sha256(buf);
    lineas.push(hash + '  ' + d.adjunto);
    detalle.push({ adjunto: d.adjunto, hash: hash, bytes: buf.length, que: d.que });
  });

  // 3. Verificar que el manifiesto legal del repo dice lo mismo.
  const manifiestoPath = path.join(SERVICE_ROOT, 'legal-readiness.json');
  let problemas = 0;
  if (fs.existsSync(manifiestoPath)) {
    const man = JSON.parse(fs.readFileSync(manifiestoPath, 'utf8'));
    const porAdjunto = {};
    detalle.forEach(d => { porAdjunto[d.adjunto] = d.hash; });
    const hashAcuerdo = porAdjunto['01-acuerdo-uso-v1.3.txt'];
    const hashAnexo = porAdjunto['02-anexo-de-encargo.html'];
    if (man.acuerdo && man.acuerdo.v1_1_hash !== hashAcuerdo) {
      console.error('  FALLA: el manifiesto legal declara una huella de Acuerdo distinta.');
      console.error('         manifiesto: ' + man.acuerdo.v1_1_hash);
      console.error('         paquete   : ' + hashAcuerdo);
      problemas++;
    }
    if (man.anexo_encargo && man.anexo_encargo.hash !== hashAnexo) {
      console.error('  FALLA: el manifiesto legal declara una huella de Anexo distinta.');
      console.error('         manifiesto: ' + man.anexo_encargo.hash);
      console.error('         paquete   : ' + hashAnexo);
      problemas++;
    }
    if (man.acuerdo && man.acuerdo.publicado !== false) {
      console.error('  FALLA: el manifiesto dice que el Acuerdo esta publicado. No debe estarlo.');
      problemas++;
    }
  } else {
    console.error('  FALLA: no existe ' + manifiestoPath);
    problemas++;
  }
  if (problemas) {
    console.error('\nNO SE ESCRIBE SHA256SUMS.txt: el manifiesto legal no coincide con el paquete.');
    process.exit(3);
  }

  // 4. Escribir el manifiesto del paquete.
  const manifiesto = lineas.join('\n') + '\n';
  fs.writeFileSync(path.join(args.paquete, 'SHA256SUMS.txt'), manifiesto, 'utf8');

  // 5. Limpiar los adjuntos de una ronda anterior. Un paquete con el adjunto
  //    viejo de la v1.2 mezclado con el nuevo de la v1.3 hace que el abogado
  //    revise un texto que ya no es el que se le pide aprobar. Solo se borran
  //    los archivos que siguen el patron de adjunto (NN-nombre) y que NO son
  //    los de esta ronda: la nota y el manifiesto nunca se tocan.
  const actuales = new Set(DOCUMENTOS.map(d => d.adjunto));
  const conservados = new Set(['SHA256SUMS.txt', 'nota-al-abogado-2026-10-30.md']);
  const sobrantes = fs.readdirSync(args.paquete).filter(function (nombre) {
    return /^\d\d-/.test(nombre) && !actuales.has(nombre) && !conservados.has(nombre);
  });
  sobrantes.forEach(function (nombre) {
    fs.unlinkSync(path.join(args.paquete, nombre));
    console.log('  adjunto de una ronda anterior retirado: ' + nombre);
  });

  console.log('=== PAQUETE PARA EL ABOGADO ===');
  console.log('  carpeta: ' + args.paquete);
  detalle.forEach(function (d) {
    console.log('  ' + d.adjunto);
    console.log('    ' + d.que);
    console.log('    bytes ' + d.bytes + ' | sha256 ' + d.hash);
  });
  console.log('  SHA256SUMS.txt escrito');
  console.log('\n  Verificado contra legal-readiness.json: coincide.');
  console.log('  NO se publico nada, NO se firmo nada.');
}

main();
