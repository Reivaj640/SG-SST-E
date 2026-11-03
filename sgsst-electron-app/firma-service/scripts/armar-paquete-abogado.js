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
 *     del Acuerdo, la del Anexo de Encargo, la del Anexo de Nube, la de la
 *     Constancia y la de la matriz de finalidades tienen que coincidir con las
 *     que calcula aqui. Si no coinciden, sale con codigo 3.
 *     (J14-5: el manifiesto tiene que decir la verdad sobre el texto que se
 *     publica, y la comprobacion tiene que ser automatica.)
 *  4. No publica nada ni firma nada: esto solo arma el paquete.
 *  5. Barre las huellas escritas DENTRO de los documentos del paquete: cada
 *     huella citada tiene que ser una vigente o estar declarada como historica
 *     en el mismo parrafo. Sin esto, un documento puede seguir citando la huella
 *     vieja de un archivo que ya cambio, y el abogado encuentra dos huellas
 *     distintas para el mismo documento en la seccion que firma.
 *
 * USO
 * ---
 *   node scripts/armar-paquete-abogado.js
 *   node scripts/armar-paquete-abogado.js --version=v1.4
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
const VERSION_DEFAULT = 'v1.4';

// Los documentos del paquete, en su orden. El "adjunto" es el nombre
// con el que viaja; el "origen" es el archivo del repo, que no se modifica.
const DOCUMENTOS = [
  {
    adjunto: '00-revision-juridica-del-abogado-2026-10-30.txt',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'revision-juridica-abogado-2026-10-30.txt'
    ),
    que: 'Su revision juridica del 30-oct-2026, tal como se recibio (adjunto 0)',
  },
  {
    adjunto: '01-acuerdo-uso-v1.4.txt',
    origen: path.join(SERVICE_ROOT, 'scripts', 'fixtures', 'acuerdo-v1.4.txt'),
    que: 'Acuerdo de uso v1.4 (texto final armado)',
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
    adjunto: '04-constancia-de-aprobacion-v1.4.html',
    origen: path.join(REPO_ROOT, 'legal', 'constancia-aprobacion-acuerdo.html'),
    que: 'Constancia de version y autorizacion de publicacion de la v1.4',
  },
  {
    adjunto: '05-correspondencia-texto-codigo-v1.4.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'correspondencia-texto-codigo-v1.4.md'
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
  {
    adjunto: '09-respuesta-al-checklist-de-cierre.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'respuesta-checklist-cierre-2026-10-30.md'
    ),
    que: 'Respuesta al checklist de cierre: los 96 requisitos y su evidencia (adjunto 9)',
  },
  {
    adjunto: '10-informe-correcciones-para-asesor-juridico.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'paquete-abogado-2026-10-30', '10-informe-correcciones-para-asesor-juridico.md'
    ),
    que: 'Informe de correcciones, verificaciones y pendientes para revision juridica (adjunto 10)',
  },
  {
    adjunto: '11-checklist-definitivo-revision-juridica-y-cierre.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'paquete-abogado-2026-10-30', '11-checklist-definitivo-revision-juridica-y-cierre.md'
    ),
    que: 'Checklist definitivo para revision juridica y cierre (adjunto 11)',
  },
  {
    adjunto: '12-procedimiento-incidentes-datos-salud.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'procedimiento-incidentes-datos-salud-2026-10-30.md'
    ),
    que: 'Procedimiento escrito de incidentes de datos de salud: RNBD, 15 dias habiles (adjunto 12)',
  },
  {
    adjunto: '13-adenda-rnbd-2026-11-01.md',
    origen: path.join(
      REPO_ROOT, 'docs', 'gestion-humana', 'firma-electronica',
      'paquete-abogado-2026-10-30', '13-adenda-rnbd-2026-11-01.md'
    ),
    que: 'Adenda de precision juridica sobre el RNBD, 1-nov-2026 (adjunto 13)',
  },
];

// Que tiene que decir el manifiesto legal sobre cada documento del paquete.
// Cada entrada: [adjunto, como se llega al valor en el manifiesto, etiqueta].
const COMPROBACIONES = [
  ['01-acuerdo-uso-v1.4.txt', (m) => m.acuerdo && m.acuerdo.hash, 'Acuerdo'],
  ['02-anexo-de-encargo.html', (m) => m.anexo_encargo && m.anexo_encargo.hash, 'Anexo de Encargo'],
  ['03-anexo-de-nube-v1.0.html', (m) => m.anexo_nube && m.anexo_nube.modelo && m.anexo_nube.modelo.hash, 'Anexo de Nube (modelo)'],
  ['04-constancia-de-aprobacion-v1.4.html', (m) => m.constancia && m.constancia.hash, 'Constancia'],
];

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// Barrido de huellas escritas DENTRO de los documentos del paquete.
//
// Por que existe: la comparacion del manifiesto contra los archivos dice si los
// bytes son los correctos, pero no dice si lo que los documentos ESCRIBEN sobre
// esos bytes es cierto. Un documento puede seguir citando la huella vieja de un
// archivo que ya cambio, y el control automatico no se entera: el defecto se ve
// cuando el abogado lee la seccion que firma y encuentra dos huellas distintas
// para el mismo documento (asi se Rompio la vez anterior, con el Anexo de Nube).
//
// Regla: toda huella que aparezca escrita dentro de un documento del paquete tiene
// que ser (a) una huella vigente del manifiesto o de un adjunto, o (b) una huella
// que el mismo parrafo declara como historica. Cualquier otra cosa es un fallo.
//
// Limite conocido y aceptado: se juzgan las huellas COMPLETAS (64 caracteres) y las
// formas abreviadas con puntos suspensivos (`abc12345…f6d7`). NO se juzgan las
// abreviaturas sueltas (`7298a943`), porque en el paquete esa forma la usan tambien
// los hash de commit de git (`5534aca7`, `e1d10728`) y algunos numeros que no son
// huellas: distinguirlas produciria falsos positivos que taparian los defectos
// reales.
// ---------------------------------------------------------------------------

// Como se declara una huella como historica dentro de un parrafo.
const DECLARADO_HISTORICO = /hist[oó]ric|ronda anterior|ronda previa|no es la del texto que se entrega|hab[ií]a cambiado|segu[ií]an indicando|qued[oó] (?:viejo|obsoleto)|huella anterior|antes de la correcci[oó]n|no emit[io]\s+aprobaci|fue la candidata sometida|antecedente|predecesora/i;

// ---------------------------------------------------------------------------
// Una huella que el texto AFIRMA que es la vigente no puede ser una huella vieja.
//
// Esta es la diferencia con "historica": "la huella vigente del Anexo de Encargo
// es <hash>" es una AFIRMACION sobre el archivo que se entrega. Si ese hash no es
// el vigente, el documento no se contradice: MIENTE, y el abogado lo lee.
//
// El caso real (31-oct-2026, noche): la fila D3 del checklist 11 decia "La
// huella vigente del Anexo de Encargo es `ebc294ac...`" (86 382 B), que era la
// huella VIEJA del A2 (la vigente es `7d626ba9...`, 86 407 B). Esa fila entera
// se excusaba con la palabra "historica", que estaba en OTRA celda, y el control
// la daba por buena. Por eso el control se endurece: la declaracion de
// historica se lee por CELDA, y la afirmacion de "vigente" se lee por SEGMENTO.
// ---------------------------------------------------------------------------
const RE_DECLARADA_VIGENTE = /(huella|hash|sha-?256|checksum)\s+(?:vigente|actual|de\s+referencia|definitiv[oa])\b/i;

// El segmento que decide: desde el ultimo limite de oracion antes de la huella.
// Se toma solo lo que va justo antes, porque una celda puede contener dos
// afirmaciones distintas ("la huella vigente es X; la anterior es Y, historica").
function segmentoPrevio(texto, indice) {
  const antes = texto.slice(0, indice);
  let corte = -1;
  ['. ', '\n', '|', '; '].forEach(function (m) {
    const i = antes.lastIndexOf(m);
    if (i > corte) corte = i;
  });
  return antes.slice(corte + 1);
}

// true si el texto anterior a la huella la declara vigente.
function esReclamadaComoVigente(texto, indice) {
  return RE_DECLARADA_VIGENTE.test(segmentoPrevio(texto, indice));
}

const RE_HUELLAS = /[0-9a-f]{64}/g;
const RE_HUELLAS_CORTAS = /([0-9a-f]{6,12})\u2026([0-9a-f]{4,10})/g;

// Documentos que son texto literal del abogado. No los reescribimos (son suyos)
// y sus huellas son las que el mismo vio, asi que el control no los juzga.
const TEXTOS_DEL_ABOGADO = [
  '00-revision-juridica-del-abogado-2026-10-30.txt',
  '08-especificacion-abogado-2026-10-30.md',
];

// Devuelve la lista de referencias a huellas que el documento declara como
// historicas y que no son vigentes: [] si todo esta bien.
function referenciasNoDeclaradas(texto, vigentes) {
  const malas = [];

  function revisar(contenido, contexto) {
    const declarada = DECLARADO_HISTORICO.test(contenido);
    const resumen = contexto.replace(/\s+/g, ' ').trim().slice(0, 150);

    // Las huellas de 64 caracteres, una por una: cada una se juzga con el
    // segmento que la precede, para saber si el texto la AFIRMA vigente.
    const re64 = new RegExp(RE_HUELLAS.source, 'g');
    let m;
    while ((m = re64.exec(contenido)) !== null) {
      const h = m[0];
      if (vigentes.has(h)) continue;
      if (esReclamadaComoVigente(contenido, m.index)) {
        malas.push({
          huella: h,
          contexto: resumen,
          motivo: 'el texto la declara vigente y no es ninguna huella vigente',
        });
        continue;
      }
      if (declarada) continue;
      malas.push({ huella: h, contexto: resumen, motivo: 'no esta declarada como historica' });
    }

    const recorta = new RegExp(RE_HUELLAS_CORTAS.source, 'g');
    while ((m = recorta.exec(contenido)) !== null) {
      const corta = m[0];
      const partes = corta.split('\u2026');
      const pre = partes[0];
      const suf = partes[1];
      const vigente = Array.from(vigentes).some(function (v) {
        return v.startsWith(pre) && v.endsWith(suf);
      });
      if (vigente) continue;
      if (esReclamadaComoVigente(contenido, m.index)) {
        malas.push({
          huella: corta,
          contexto: resumen,
          motivo: 'el texto la declara vigente y no es ninguna huella vigente',
        });
        continue;
      }
      if (declarada) continue;
      malas.push({ huella: corta, contexto: resumen, motivo: 'no esta declarada como historica' });
    }
  }

  // Cada bloque va por separado. Y dentro de un bloque en forma de tabla, cada
  // fila va por separado: si se juzgara la tabla entera, una fila que dice
  // "historico" absolveria a todas las demas, que es exactamente el defecto
  // que este control tiene que atrapar (la fila donde el abogado aprueba).
  //
  // La mencion a una huella historica absuelve a las huellas VIEJAS de esa
  // fila. Lo que NO absuelve es la AFIRMACION de vigencia: si la fila dice que
  // una huella es la vigente, esa huella tiene que ser la vigente. Por eso la
  // comprobacion de "declara vigente" va antes que la de "historica" y se
  // calcula sobre el segmento que precede a la huella, que con el separador
  // de tabla queda dentro de la celda donde esta la afirmacion.
  texto.split(/\r?\n\s*\r?\n/).forEach(function (bloque) {
    const lineas = bloque.split(/\r?\n/).filter(function (l) { return l.trim(); });
    const esTabla = lineas.length > 1 && lineas.every(function (l) { return /^\s*\|/.test(l); });
    if (esTabla) {
      lineas.forEach(function (linea) { revisar(linea, linea); });
    } else {
      revisar(bloque, bloque);
    }
  });
  return malas;
}

function parseArgs(argv) {
  const args = { paquete: PAQUETE_DEFAULT, version: VERSION_DEFAULT };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--paquete=')) args.paquete = path.resolve(a.slice('--paquete='.length).trim());
    else if (a.startsWith('--version=')) args.version = a.slice('--version='.length).trim();
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

    COMPROBACIONES.forEach(function (c) {
      const adjunto = c[0];
      const declarado = c[1](man);
      if (!declarado) {
        console.error('  FALLA: el manifiesto legal no declara la huella del ' + c[2] + '.');
        problemas++;
        return;
      }
      if (declarado.toLowerCase() !== porAdjunto[adjunto]) {
        console.error('  FALLA: el manifiesto legal declara una huella distinta de la ' + c[2] + '.');
        console.error('         manifiesto: ' + declarado);
        console.error('         paquete   : ' + porAdjunto[adjunto]);
        problemas++;
      }
    });

    const anexoNube = detalle.find(d => d.adjunto === '03-anexo-de-nube-v1.0.html');
    const bytesNubeDeclarados = man.anexo_nube && man.anexo_nube.modelo && man.anexo_nube.modelo.bytes;
    if (!Number.isInteger(bytesNubeDeclarados)) {
      console.error('  FALLA: el manifiesto legal no declara el tamaño en bytes del modelo del Anexo de Nube.');
      problemas++;
    } else if (bytesNubeDeclarados !== anexoNube.bytes) {
      console.error('  FALLA: el tamaño en bytes del modelo del Anexo de Nube no coincide con el paquete.');
      console.error('         manifiesto: ' + bytesNubeDeclarados);
      console.error('         paquete   : ' + anexoNube.bytes);
      problemas++;
    }

    // La matriz de finalidades no viaja como adjunto (va dentro del Anexo de
    // Encargo), pero el manifiesto tambien la declara: se comprueba igual.
    const matrizPath = path.join(SERVICE_ROOT, 'config', 'matriz-finalidades.json');
    const hashMatriz = man.matriz_finalidades && man.matriz_finalidades.hash;
    if (!hashMatriz) {
      console.error('  FALLA: el manifiesto legal no declara la huella de la matriz de finalidades.');
      problemas++;
    } else if (sha256(fs.readFileSync(matrizPath)) !== hashMatriz.toLowerCase()) {
      console.error('  FALLA: la huella de la matriz de finalidades no coincide con el archivo.');
      problemas++;
    }

    // La version que el manifiesto declara tiene que ser la del paquete.
    const versionManifiesto = man.acuerdo && man.acuerdo.version;
    if (versionManifiesto !== args.version) {
      console.error('  FALLA: el manifiesto declara ' + versionManifiesto
        + ' y el paquete se armo para ' + args.version + '.');
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
  // 3-bis. Barrido de las huellas escritas dentro de los documentos del paquete.
  // Cada huella citada en un documento tiene que ser una vigente o estar
  // declarada como historica en el mismo parrafo.
  {
    const vigentes = new Set();
    if (fs.existsSync(manifiestoPath)) {
      const man = JSON.parse(fs.readFileSync(manifiestoPath, 'utf8'));
      [
        man.acuerdo && man.acuerdo.hash,
        man.anexo_encargo && man.anexo_encargo.hash,
        man.anexo_nube && man.anexo_nube.modelo && man.anexo_nube.modelo.hash,
        man.constancia && man.constancia.hash,
        man.matriz_finalidades && man.matriz_finalidades.hash,
      ].forEach(function (h) { if (h) vigentes.add(String(h).toLowerCase()); });
    }
    detalle.forEach(function (d) { vigentes.add(d.hash); });

    const citados = fs.readdirSync(args.paquete).filter(function (n) {
      return /\.(md|txt|html)$/.test(n) && n !== 'SHA256SUMS.txt';
    }).sort();
    citados.forEach(function (nombre) {
      if (TEXTOS_DEL_ABOGADO.indexOf(nombre) !== -1) return;
      const texto = fs.readFileSync(path.join(args.paquete, nombre), 'utf8');
      referenciasNoDeclaradas(texto, vigentes).forEach(function (m) {
        console.error('  FALLA: ' + nombre + ' cita la huella ' + m.huella
          + ', que ' + (m.motivo || 'no esta declarada como historica') + '.');
        console.error('         ' + m.contexto);
        problemas++;
      });
    });
  }

  if (problemas) {
    console.error('\nNO SE ESCRIBE SHA256SUMS.txt: el manifiesto legal no coincide con el paquete.');
    process.exit(3);
  }

  // 4. Escribir el manifiesto del paquete.
  const manifiesto = lineas.join('\n') + '\n';
  fs.writeFileSync(path.join(args.paquete, 'SHA256SUMS.txt'), manifiesto, 'utf8');

  // 5. Limpiar los adjuntos de una ronda anterior. Un paquete con el adjunto
  //    viejo de la v1.3 mezclado con el nuevo de la v1.4 hace que el abogado
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

if (require.main === module) {
  main();
}

module.exports = {
  referenciasNoDeclaradas,
  DECLARADO_HISTORICO,
  RE_DECLARADA_VIGENTE,
  esReclamadaComoVigente,
  TEXTOS_DEL_ABOGADO,
};
