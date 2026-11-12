/**
 * actualizar-cuadro-canonico-2026-11-12.js
 *
 * QUE HACE
 * --------
 * Pone al dia el estado de los requisitos del cuadro canonico
 * (`docs/gestion-humana/firma-electronica/respuesta-checklist-cierre-2026-10-30.md`)
 * con lo que **se midio** el 12-nov-2026, y despues regenera la tabla resumen
 * con `contar-estados-checklist.js`.
 *
 * POR QUE ES MECANICO Y NO UNA REDACCION
 * -------------------------------------
 * El texto que se pone en cada requisito **no lo escribe este script**: se
 * copia, sin tocar una palabra, del informe de verificacion que lo midio
 * (`docs/gestion-humana/firma-electronica/verificacion-cierre/*.md`). Asi el
 * cuadro no dice nada que el informe no sostenga con evidencia, y el informe
 * queda siendo la fuente de verdad. Si un requisito no esta medido, **no se
 * toca**: su estado sigue siendo el de la ronda del 30-oct.
 *
 * QUE CAMBIA EN CADA REQUISITO MEDIDO
 * ------------------------------------
 * 1. La palabra de estado de la clave (despues del ultimo raya largo), que es
 *    lo que cuenta el verificador (PROMPT.md 5.30).
 * 2. Todo el cuerpo del requisito: el texto medido, con la linea que declara
 *    de que informe sale. El cuerpo ANTERIOR se reemplaza, no se apila: el
 *    cuadro es un documento vivo y su respuesta es la de hoy. Lo que decia
 *    antes queda en el historial de git.
 *
 * IDEMPOTENCIA
 * ------------
 * Correrlo dos veces no puede cambiar el archivo. Por eso el estado ANTERIOR
 * (el de la ronda del 30-oct) no se recalcula contra el documento ya
 * actualizado: se recupera de lo que el propio documento ya dice, tanto en la
 * linea "Cambio de estado" de cada bloque como en la tabla de la seccion de
 * revision.
 *
 * INTERFAZ
 * --------
 *   node actualizar-cuadro-canonico-2026-11-12.js            Verifica (solo lectura).
 *   node actualizar-cuadro-canonico-2026-11-12.js --escribir  Aplica los cambios.
 *   node actualizar-cuadro-canonico-2026-11-12.js --ayuda     Esta ayuda.
 *
 * Este archivo es codigo: se escribe en ASCII puro (sin tildes ni enie),
 * como el resto del codigo del repositorio.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** La raiz del repositorio electronico. */
const RAIZ = path.resolve(__dirname, '..', '..');
/** El cuadro canonico. */
const RUTA_CANONICO = path.join(
  RAIZ, 'docs', 'gestion-humana', 'firma-electronica',
  'respuesta-checklist-cierre-2026-10-30.md'
);
/** La carpeta con los informes de verificacion. */
const RUTA_INFORMES = path.join(
  RAIZ, 'docs', 'gestion-humana', 'firma-electronica', 'verificacion-cierre'
);
/** La fecha de la medicion que se aplica. */
const FECHA = '12-nov-2026';
/** El rayon largo: separa el texto del estado. */
const RAYON = '\u2014';

/**
 * El encabezado de un requisito del cuadro: "**N.N - texto - ESTADO.**".
 * Hay uno que cubre varios IDs ("**6.5 a 6.9 - ...**"): ese no se toca.
 */
const RE_REQ_CANONICO = /\*\*(\d+\.\d+)(?:\s+a\s+\d+\.\d+)?\s+·\s+([\s\S]*?)\*\*/g;
/** El encabezado de un bloque de un informe: "### N.N - texto - ESTADO". */
const RE_REQ_INFORME = /^###\s+(\d+\.\d+)\s+-\s+(.+)$/gm;
/** La linea que declara el cambio de estado de un bloque ya medido. */
const RE_LINEA_CAMBIO = /^\*Cambio de estado:.*\*$/m;
/** La fila de la tabla de la seccion de revision. */
const RE_FILA_REVISION = /^\|\s*\*\*F-\d+\*\*\s*\|\s*(\d+\.\d+)\s[^|]*estado\s\*\*(.+?)\*\*\s*->/gm;

/**
 * El estado que se reconoce, y como se clasifica.
 * @param {string} clave
 * @returns {string|null} el estado, o null si no se reconoce.
 */
function estadoDeClave(clave) {
  const n = String(clave || '').replace(/[\u00c0-\u00ff]/g, (c) => {
    const mapa = {
      '\u00e1': 'a', '\u00e9': 'e', '\u00ed': 'i', '\u00f3': 'o', '\u00fa': 'u',
      '\u00e0': 'a', '\u00e8': 'e', '\u00ec': 'i', '\u00f2': 'o', '\u00f9': 'u',
      '\u00c1': 'A', '\u00c9': 'E', '\u00cd': 'I', '\u00d3': 'O', '\u00da': 'U',
    };
    return mapa[c] || c;
  }).toUpperCase().trim();
  if (n.indexOf('CERRADO') === 0) return 'CERRADO';
  if (n.indexOf('PENDIENTE') === 0) return 'PENDIENTE';
  if (n.indexOf('PARCIALMENTE') === 0) return 'PARCIALMENTE';
  if (n.indexOf('NO APLICA') === 0) return 'No aplica';
  return null;
}

/**
 * Separa el texto del estado en la clave de un encabezado.
 *
 * Los informes no usan todos el mismo separador: unos ponen la palabra de
 * estado despues de un raya largo y otros despues de un guion. Se prueban
 * los dos y gana el que deja una palabra de estado reconocible; si ambos
 * sirven, gana el raya largo (es el que usa el cuadro canonico).
 *
 * @param {string} clave
 * @returns {{titulo: string, estado: string}|null}
 */
function separarEstado(clave) {
  // Cada separador trae su largo: " - " ocupa tres caracteres y el raya
  // largo uno solo, y hay que cortar despues del separador completo.
  const candidatos = [];
  const iRaya = clave.lastIndexOf(RAYON);
  if (iRaya >= 0) candidatos.push({ i: iRaya, largo: 1 });
  const iGuion = clave.lastIndexOf(' - ');
  if (iGuion >= 0 && iGuion !== iRaya) candidatos.push({ i: iGuion, largo: 3 });
  candidatos.sort((a, b) => a.i - b.i);
  for (const c of candidatos) {
    const estado = estadoDeClave(clave.slice(c.i + c.largo));
    if (estado) return { titulo: clave.slice(0, c.i).trim(), estado: estado };
  }
  return null;
}

/**
 * Lee los informes de verificacion y devuelve el estado medido de cada
 * requisito, con el texto tal cual lo escribio quien midio.
 *
 * @returns {{medidos: object, archivos: string[]}}
 */
function leerInformes() {
  const medidos = {};
  const archivos = [];
  if (!fs.existsSync(RUTA_INFORMES)) return { medidos: medidos, archivos: archivos };

  const nombres = fs.readdirSync(RUTA_INFORMES)
    .filter((n) => n.endsWith('.md'))
    .sort();

  for (const nombre of nombres) {
    const ruta = path.join(RUTA_INFORMES, nombre);
    const texto = fs.readFileSync(ruta, 'utf8');
    const re = new RegExp(RE_REQ_INFORME.source, 'gm');
    let m;
    while ((m = re.exec(texto)) !== null) {
      const id = m[1];
      const clave = m[2];
      const separado = separarEstado(clave);
      if (!separado) continue;

      // El cuerpo va desde el fin del encabezado hasta el siguiente encabezado.
      const fin = texto.indexOf('\n### ', m.index + m[0].length);
      const finSeccion = texto.indexOf('\n## ', m.index + m[0].length);
      let limite = fin;
      if (limite < 0 || (finSeccion >= 0 && finSeccion < limite)) limite = finSeccion;
      const cuerpo = (limite < 0
        ? texto.slice(m.index + m[0].length)
        : texto.slice(m.index + m[0].length, limite));
      const limpio = cuerpo
        .replace(/^\s*---\s*$/m, '')
        .replace(/\s+$/, '')
        .replace(/^\n+/, '');

      if (medidos[id]) {
        // Dos informes sobre el mismo requisito: es un error de las medidas,
        // no algo que se resuelva eligiendo uno por su cuenta.
        medidos[id].duplicado = true;
        continue;
      }
      medidos[id] = {
        id: id,
        titulo: separado.titulo,
        estado: separado.estado,
        cuerpo: limpio,
        informe: nombre,
      };
    }
    archivos.push(nombre);
  }
  return { medidos: medidos, archivos: archivos };
}

/**
 * Recupera, de la tabla de la corrida anterior, el estado que cada
 * requisito tenia ANTES de esta medicion. Sin esto, la segunda corrida
 * compararia el estado de hoy contra si mismo y escribiria
 * "CERRADO -> CERRADO".
 *
 * @param {string} doc el documento completo.
 * @returns {object} un mapa id -> estado anterior.
 */
function estadosAnteriores(doc) {
  const previos = {};
  const re = new RegExp(RE_FILA_REVISION.source, 'gm');
  let m;
  while ((m = re.exec(doc)) !== null) {
    previos[m[1]] = m[2].trim();
  }
  return previos;
}

/**
 * Parte el cuadro canonico en sus bloques de requisito y calcula hasta donde
 * llega el cuerpo de cada uno: hasta el encabezado del requisito siguiente o
 * hasta el encabezado de seccion.
 *
 * @param {string} texto
 * @returns {{bloques: Array}}
 */
function partirCanonic(texto) {
  const re = new RegExp(RE_REQ_CANONICO.source, 'g');
  const bloques = [];
  let m;
  while ((m = re.exec(texto)) !== null) {
    const cuerpo = m[2];
    const corte = cuerpo.lastIndexOf(RAYON);
    const estado = corte < 0 ? null : estadoDeClave(cuerpo.slice(corte + 1));
    bloques.push({
      id: m[1],
      titulo: corte < 0 ? cuerpo.trim() : cuerpo.slice(0, corte).trim(),
      estado: estado,
      estadoViejo: estado,
      inicio: m.index,
      finEncabezado: m.index + m[0].length,
      multiple: /\s+a\s+\d+\.\d+/.test(m[0].slice(0, m[0].indexOf('\u00b7'))),
    });
  }
  // El cuerpo de cada bloque llega hasta el siguiente bloque o hasta el
  // encabezado de seccion. El separador que queda se reconstruye al escribir.
  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    const siguiente = i + 1 < bloques.length ? bloques[i + 1].inicio : -1;
    const iSeccion = texto.indexOf('\n## ', b.finEncabezado);
    let fin;
    let separador;
    if (iSeccion >= 0 && (siguiente < 0 || iSeccion < siguiente)) {
      fin = iSeccion;
      separador = '\n';
    } else if (siguiente >= 0) {
      fin = siguiente;
      separador = '\n\n';
    } else {
      fin = texto.length;
      separador = '';
    }
    b.fin = fin;
    b.separador = separador;
  }
  return { bloques: bloques };
}

/**
 * Arma el bloque nuevo de un requisito medido.
 * @param {object} bloque el bloque del canonico.
 * @param {object} medido el bloque del informe.
 * @param {string} viejoTexto el bloque como esta hoy en el documento.
 * @returns {string} el bloque, sin salto de linea final.
 */
function armarBloque(bloque, medido, viejoTexto) {
  // Si el bloque ya estaba medido en una corrida anterior, se conserva su
  // linea de "Cambio de estado": recalcularla compararia el estado de hoy
  // contra si mismo y el script dejaria de ser idempotente.
  const lineaVieja = viejoTexto ? (viejoTexto.match(RE_LINEA_CAMBIO) || [null])[0] : null;
  const cambia = bloque.estadoViejo !== medido.estado;
  const partes = [];
  partes.push('**' + bloque.id + ' \u00b7 ' + medido.titulo + ' ' + RAYON + ' ' + medido.estado + '.**');
  partes.push('');
  partes.push('**Medicion del ' + FECHA + '** (informe `verificacion-cierre/' + medido.informe
    + '`). Se contrasta el requisito contra el codigo y contra el servidor; lo que sigue es la '
    + 'medicion y su evidencia.');
  partes.push('');
  if (lineaVieja) {
    partes.push(lineaVieja);
    partes.push('');
  } else if (cambia) {
    partes.push('*Cambio de estado: en la ronda del 30-oct-2026 figuraba como '
      + (bloque.estadoViejo || 'sin estado reconocible') + '.*');
    partes.push('');
  }
  partes.push(medido.cuerpo);
  return partes.join('\n');
}

/**
 * Arma la seccion de revision que documenta el cambio.
 * @param {Array} cambios
 * @returns {string}
 */
function armarRevision(cambios) {
  const lineas = [];
  lineas.push('## Quinta revision: la medicion del ' + FECHA + ' (' + cambios.length + ' requisitos)');
  lineas.push('');
  lineas.push('Esta ronda **midio** los requisitos del cuadro contra el codigo y contra el servidor de');
  lineas.push('produccion, y escribio el resultado en los informes de `verificacion-cierre/`. Este');
  lineas.push('cuadro se pone al dia con esa medicion: la palabra de estado de cada requisito medido');
  lineas.push('es la de hoy, y su cuerpo es el texto del informe, sin reescribirlo.');
  lineas.push('');
  lineas.push('**Lo que NO se hizo.** Los requisitos que nadie midio **no se tocaron**: siguen con el');
  lineas.push('estado de la ronda del 30-oct-2026. La tabla resumen se regenera desde el conteo real');
  lineas.push('(`firma-service/scripts/contar-estados-checklist.js`), no a mano.');
  lineas.push('');
  lineas.push('**Que pasa con el texto anterior.** El cuerpo de cada requisito medido **reemplaza** la');
  lineas.push('respuesta de la ronda del 30-oct-2026: este cuadro es un documento vivo y su respuesta es');
  lineas.push('la de hoy. Lo que decia antes no se borro de la memoria del proyecto: esta en el');
  lineas.push('historial de git, y las correcciones de cada ronda estan al principio del documento');
  lineas.push('(segunda, tercera, cuarta y esta quinta revision).');
  lineas.push('');
  lineas.push('| # | Que se cambio | Donde |');
  lineas.push('|---|---|---|');
  let i = 0;
  for (const c of cambios) {
    i += 1;
    lineas.push('| **F-' + i + '** | ' + c.id + ' ' + c.titulo + ': estado **' + c.viejo + '** -> **'
      + c.nuevo + '**, con la medicion del ' + FECHA + ' | Este cuadro, ' + c.id
      + ' (evidencia en `verificacion-cierre/' + c.informe + '`) |');
  }
  lineas.push('');
  return lineas.join('\n');
}

/**
 * Ejecuta la actualizacion.
 * @param {boolean} escribir
 * @returns {number} el codigo de salida.
 */
function correr(escribir) {
  if (!fs.existsSync(RUTA_CANONICO)) {
    console.error('No existe el cuadro canonico: ' + RUTA_CANONICO);
    return 2;
  }
  const info = leerInformes();
  const medidos = info.medidos;
  const ids = Object.keys(medidos).sort();
  if (!ids.length) {
    console.error('No hay informes de verificacion con requisitos medidos en ' + RUTA_INFORMES);
    return 2;
  }

  const texto = fs.readFileSync(RUTA_CANONICO, 'utf8');
  const partes = partirCanonic(texto);
  const previos = estadosAnteriores(texto);

  const cambios = [];
  const duplicados = [];
  const multiple = [];
  let cursor = 0;
  const salida = [];
  for (const bloque of partes.bloques) {
    const medido = medidos[bloque.id];
    if (!medido) continue;
    if (medido.duplicado) {
      // Dos informes miden el mismo requisito: es un error de las medidas,
      // no algo que se resuelva eligiendo uno. Se AVISA y no se escribe.
      duplicados.push(bloque.id);
      continue;
    }
    if (bloque.multiple) {
      // Un encabezado del canonico que cubre varios IDs ("6.5 a 6.9"): no
      // se toca, y eso es informativo.
      multiple.push(bloque.id);
      continue;
    }
    cambios.push({
      id: bloque.id,
      titulo: medido.titulo,
      viejo: previos[bloque.id] || bloque.estadoViejo || 'sin estado',
      nuevo: medido.estado,
      informe: medido.informe,
    });
    // Se reemplaza TODO el bloque: encabezado y cuerpo. Si solo se tocara el
    // encabezado, el cuerpo anterior quedaria debajo del nuevo y el documento
    // diria lo mismo dos veces.
    salida.push(texto.slice(cursor, bloque.inicio));
    salida.push(armarBloque(bloque, medido, texto.slice(bloque.inicio, bloque.fin))
      + bloque.separador);
    cursor = bloque.fin;
  }
  salida.push(texto.slice(cursor));
  let nuevo = salida.join('');

  // La seccion de revision va antes de la seccion 1, como las anteriores.
  const ancla = '\n## 1. Integridad y control documental';
  const iAncla = nuevo.indexOf(ancla);
  if (iAncla < 0) {
    console.error('No se encontro el ancla de la seccion 1: el cuadro cambio de forma.');
    return 2;
  }
  const rotulo = '\n## Quinta revision';
  const iVieja = nuevo.indexOf(rotulo);
  const seccion = '\n' + armarRevision(cambios) + '\n';
  if (iVieja >= 0) {
    // Se reemplaza la seccion de la corrida anterior (idempotencia).
    const finVieja = nuevo.indexOf(ancla, iVieja);
    nuevo = nuevo.slice(0, iVieja) + seccion.slice(0, -1) + nuevo.slice(finVieja);
  } else {
    // El mismo recorte que hace la rama de reemplazo: si no, la seccion
    // insertada deja una linea en blanco de mas que la reescrita y el
    // documento se mueve en cada corrida.
    nuevo = nuevo.slice(0, iAncla) + seccion.slice(0, -1) + nuevo.slice(iAncla);
  }

  if (multiple.length) {
    console.log('Sin tocar (encabezado del canonico que cubre varios IDs): '
      + multiple.join(', '));
  }
  if (duplicados.length) {
    console.error('ERROR: dos informes miden el mismo requisito: '
      + duplicados.join(', '));
    console.error('Renombra los IDs de uno de los informes (no pueden coincidir con');
    console.error('los del otro) y vuelve a correr. NO SE ESCRIBE NADA.');
    return 1;
  }

  if (!escribir) {
    console.log('Requisitos medidos disponibles: ' + ids.length);
    console.log('Requisitos que se actualizarian: ' + cambios.length);
    cambios.forEach((c) => console.log('  ' + c.id + ': ' + c.viejo + ' -> ' + c.nuevo
      + '  (' + c.informe + ')'));
    console.log('\nCorre con --escribir para aplicarlo.');
    return 0;
  }

  const antes = fs.readFileSync(RUTA_CANONICO);
  if (antes.equals(Buffer.from(nuevo, 'utf8'))) {
    console.log('El cuadro canonico ya estaba actualizado: no se escribo nada.');
    return 0;
  }
  fs.writeFileSync(RUTA_CANONICO, nuevo, 'utf8');
  console.log('Cuadro canonico actualizado: ' + cambios.length + ' requisitos.');
  cambios.forEach((c) => console.log('  ' + c.id + ': ' + c.viejo + ' -> ' + c.nuevo));
  return 0;
}

module.exports = {
  correr: correr,
  leerInformes: leerInformes,
  estadoDeClave: estadoDeClave,
  estadosAnteriores: estadosAnteriores,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.indexOf('--ayuda') >= 0 || args.indexOf('--help') >= 0) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('/**', ''));
    process.exit(0);
  }
  process.exit(correr(args.indexOf('--escribir') >= 0));
}
