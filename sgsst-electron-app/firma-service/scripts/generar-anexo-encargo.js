#!/usr/bin/env node
/**
 * scripts/generar-anexo-encargo.js
 *
 * GENERA los dos bloques del Anexo de Encargo que no se escriben a mano:
 * la matriz de finalidades (seccion 2) y la tabla de conservacion (seccion 8).
 *
 * POR QUE SE GENERAN Y NO SE ESCRIBEN A MANO
 * -------------------------------------------
 * Una tabla escrita a mano se contradice con la fuente a la tercera version.
 * Estas dos salen de dos archivos y solo de esos:
 *
 *   config/matriz-finalidades.json  -> la matriz de finalidades (E1)
 *   config/tabla-conservacion.json  -> la tabla de conservacion (E2)
 *
 * El bloque generado queda entre dos marcadores de comentario HTML estables,
 * de modo que el texto alrededor se puede reescribir sin tocar lo generado:
 *
 *   <!-- MATRIZ-FINALIDADES:GENERADA --> ... <!-- /MATRIZ-FINALIDADES -->
 *   <!-- TABLA-CONSERVACION:GENERADA --> ... <!-- /TABLA-CONSERVACION -->
 *
 * El script es IDEMPOTENTE: correrlo dos veces produce un archivo byte a byte
 * identico, porque lo que se escribe depende solo de las dos fuentes y no
 * del estado anterior del archivo.
 *
 * TILDES Y ENTIDADES
 * -------------------
 * El HTML del Anexo usa entidades (&aacute;, &oacute;, &ntilde;, ...), no
 * caracteres acentuados en crudo. Las dos fuentes JSON se escriben en ASCII
 * (misma convencion que tabla-conservacion.json), asi que este script
 * RESTITUYE las tildes con un diccionario y despues las convierte a
 * entidades. El diccionario esta al final del archivo y es explicito: cada
 * palabra esta a la vista, para que se pueda revisar sin leer codigo.
 *
 * Uso:
 *   node scripts/generar-anexo-encargo.js            regenera legal/ y sitio/
 *   node scripts/generar-anexo-encargo.js --check     solo verifica (no escribe)
 *
 * Exit codes:
 *   0 = los dos bloques quedaron escritos (o coinciden, con --check)
 *   1 = error de uso
 *   2 = la fuente no sirve: falta una categoria, falta una finalidad, falta
 *       un campo, un marcador no esta, o el JSON no valida
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');

const CONFIG_TABLA_REL = path.join('sgsst-electron-app', 'firma-service', 'config', 'tabla-conservacion.json');
const CONFIG_MATRIZ_REL = path.join('sgsst-electron-app', 'firma-service', 'config', 'matriz-finalidades.json');
const HTML_LEGAL_REL = path.join('sgsst-electron-app', 'legal', 'anexo-encargo.html');
const HTML_SITIO_REL = path.join('sitio', 'anexo-encargo.html');

const MARCA_MATRIZ_INI = '<!-- MATRIZ-FINALIDADES:GENERADA -->';
const MARCA_MATRIZ_FIN = '<!-- /MATRIZ-FINALIDADES -->';
const MARCA_TABLA_INI = '<!-- TABLA-CONSERVACION:GENERADA -->';
const MARCA_TABLA_FIN = '<!-- /TABLA-CONSERVACION -->';

// Las categorias que la tabla de conservacion DEBE traer. Si falta una, el
// Anexo quedaria sin plazo para esa clase de documento y el script no escribe.
const CATEGORIAS_REQUERIDAS = [
  'DOCUMENTO_FIRMADO',
  'CONSTANCIA_Y_MANIFESTACION',
  'REGISTRO_OPERACIONES',
  'SOLICITUDES_OPERATIVAS',
  'LAPIDA_Y_RECIBO',
  'RESPALDOS_CIFRADOS',
  'SST_ESPECIAL',
  'CONTRATO_SIN_TERMINO',
];

// Las ocho finalidades del numeral 10.3 del Acuerdo, con su identificador
// literal. El texto se compara: si el Acuerdo cambia, el script lo dice.
const FINALIDADES_REQUERIDAS = [
  { id: '10.3(a)', literal: 'Crear y gestionar la solicitud de firma.' },
  { id: '10.3(b)', literal: 'Enviar al Titular el enlace de acceso y el codigo OTP.' },
  { id: '10.3(c)', literal: 'Verificar la identidad del Firmante.' },
  { id: '10.3(d)', literal: 'Registrar y conservar su manifestacion de aceptacion de este Acuerdo.' },
  { id: '10.3(e)', literal: 'Generar y entregar la constancia de firma.' },
  { id: '10.3(f)', literal: 'Conservar la evidencia del proceso de firma por el tiempo indicado en el numeral 8.6.' },
  { id: '10.3(g)', literal: 'Atender peticiones, quejas, reclamos y solicitudes relacionadas con el proceso de firma.' },
  { id: '10.3(h)', literal: 'Cumplir obligaciones legales, administrativas o judiciales que resulten aplicables.' },
];

// Los nueve campos que la matriz lleva en cada fila. Una finalidad marcada
// como activa (Grupo A) no puede llegar al Anexo con alguno vacio.
const CAMPOS_OBLIGATORIOS = [
  'descripcion',
  'categorias_datos',
  'titulares',
  'base_juridica',
  'responsable_instruye',
  'plazo_conservacion',
  'consecuencia_revocatoria',
  'estado_habilitacion',
];

// Punto de inicio que la fuente no puede expresar con una leyenda (el
// contrato individual no corre por un punto de inicio: corre por un hecho).
const PUNTO_INICIO_FALLBACK = {
  CONTRATO_SIN_TERMINO:
    'No aplica mientras subsista la relacion laboral; a su terminacion, el plazo que resulte '
    + 'de la tabla de la Empresa o, en su defecto, el de esta tabla supletoria.',
};

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

class ErrorFuente extends Error {}

/** Falla de validacion: la fuente no sirve y el script no escribe. */
function fallar(msg) {
  throw new ErrorFuente(msg);
}

function leerJson(ruta) {
  let crudo;
  try {
    crudo = fs.readFileSync(ruta, 'utf8');
  } catch (err) {
    fallar(`No se pudo leer ${ruta}: ${err.message}`);
  }
  try {
    return JSON.parse(crudo);
  } catch (err) {
    fallar(`El JSON de ${ruta} no valida: ${err.message}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tildes y entidades HTML
// ---------------------------------------------------------------------------

// Diccionario de palabras ASCII que llevan tilde. Cada entrada es explicita
// para que se pueda revisar de un vistazo. La clave esta en minuscula; el
// script respeta las mayusculas del texto donde aparece.
const PALABRAS_CON_TILDE = {
  aceptacion: 'aceptación',
  acepto: 'aceptó',
  actualizacion: 'actualización',
  aca: 'acá',
  activacion: 'activación',
  alla: 'allá',
  anos: 'años',
  aqui: 'aquí',
  articulo: 'artículo',
  articulos: 'artículos',
  autenticacion: 'autenticación',
  autografica: 'autográfica',
  autorizacion: 'autorización',
  capitulo: 'capítulo',
  capacitacion: 'capacitación',
  categoria: 'categoría',
  categorias: 'categorías',
  codigo: 'código',
  confirmo: 'confirmó',
  conservacion: 'conservación',
  convencion: 'convención',
  creacion: 'creación',
  declaracion: 'declaración',
  decision: 'decisión',
  demas: 'demás',
  descripcion: 'descripción',
  despues: 'después',
  dia: 'día',
  dias: 'días',
  direccion: 'dirección',
  disposicion: 'disposición',
  electronica: 'electrónica',
  electronico: 'electrónico',
  emision: 'emisión',
  envia: 'envía',
  envio: 'envío',
  epidemiologicos: 'epidemiológicos',
  examenes: 'exámenes',
  habilitacion: 'habilitación',
  habiles: 'hábiles',
  identificacion: 'identificación',
  indice: 'índice',
  informacion: 'información',
  instruccion: 'instrucción',
  juridica: 'jurídica',
  juridicas: 'jurídicas',
  juridico: 'jurídico',
  juridicos: 'jurídicos',
  lapida: 'lápida',
  logica: 'lógica',
  manifestacion: 'manifestación',
  mas: 'más',
  maximo: 'máximo',
  medicos: 'médicos',
  minimo: 'mínimo',
  numero: 'número',
  obligacion: 'obligación',
  obligaciones: 'obligaciones',
  operacion: 'operación',
  parafrasis: 'paráfrasis',
  parrafo: 'párrafo',
  periodo: 'período',
  periodicos: 'periódicos',
  peticion: 'petición',
  peticiones: 'peticiones',
  politica: 'política',
  practica: 'práctica',
  practico: 'práctico',
  prestacion: 'prestación',
  presuncion: 'presunción',
  produccion: 'producción',
  proteccion: 'protección',
  publico: 'público',
  recepcion: 'recepción',
  rectificacion: 'rectificación',
  relacion: 'relación',
  restauracion: 'restauración',
  retencion: 'retención',
  sabias: 'sabías',
  seccion: 'sección',
  segun: 'según',
  supresion: 'supresión',
  suprimio: 'suprimió',
  tecnica: 'técnica',
  tecnico: 'técnico',
  terminacion: 'terminación',
  termino: 'término',
  terminos: 'términos',
  titulo: 'título',
  ultimo: 'último',
  unica: 'única',
  unico: 'único',
  unicamente: 'únicamente',
  vacio: 'vacío',
  validacion: 'validación',
  verificacion: 'verificación',
  version: 'versión',
};

// Frases donde la tilde depende del uso y no de la palabra: se corrigen
// enteras, no palabra por palabra. Se aplican DESPUES de escapar, porque la
// correccion ya viene en forma de entidad HTML.
const FRASES_CON_TILDE = [
  ['con que fundamento', 'con qu&eacute; fundamento'],
  ['no esta habilitada', 'no est&aacute; habilitada'],
  ['por si sola', 'por s&iacute; sola'],
  ['por si solo', 'por s&iacute; solo'],
];

/**
 * Devuelve el texto con las tildes de las palabras del diccionario puestas.
 * Respeta mayusculas: MINIMO -> MÍNIMO, Lapida -> Lápida.
 */
function restituirTildes(texto) {
  return String(texto).replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (palabra) => {
    const minuscula = palabra.toLowerCase();
    const destino = PALABRAS_CON_TILDE[minuscula];
    if (!destino) return palabra;
    if (palabra === palabra.toUpperCase()) {
      return destino.toUpperCase();
    }
    if (palabra[0] === palabra[0].toUpperCase()) {
      return destino.charAt(0).toUpperCase() + destino.slice(1);
    }
    return destino;
  });
}

// Entidades HTML que usa el Anexo. Todo lo que no este aca sale como entidad
// numerica, para que el archivo nunca quede con caracteres acentuados crudos.
const ENTIDADES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '\u00a1': '&iexcl;',
  '\u00bf': '&iquest;',
  '\u00a3': '&pound;',
  '\u00a7': '&sect;',
  '\u00ab': '&laquo;',
  '\u00bb': '&raquo;',
  '\u00ae': '&reg;',
  '\u00b0': '&deg;',
  '\u00b7': '&middot;',
  '\u2022': '&bull;',
  '\u00d7': '&times;',
  '\u00c1': '&Aacute;',
  '\u00c9': '&Eacute;',
  '\u00cd': '&Iacute;',
  '\u00d3': '&Oacute;',
  '\u00da': '&Uacute;',
  '\u00d1': '&Ntilde;',
  '\u00c0': '&Agrave;',
  '\u00c8': '&Egrave;',
  '\u00cc': '&Igrave;',
  '\u00d2': '&Ograve;',
  '\u00d9': '&Ugrave;',
  '\u00e1': '&aacute;',
  '\u00e9': '&eacute;',
  '\u00ed': '&iacute;',
  '\u00f3': '&oacute;',
  '\u00fa': '&uacute;',
  '\u00f1': '&ntilde;',
  '\u00e0': '&agrave;',
  '\u00e8': '&egrave;',
  '\u00ec': '&igrave;',
  '\u00f2': '&ograve;',
  '\u00f9': '&ugrave;',
  '\u00fc': '&uuml;',
  '\u2013': '&ndash;',
  '\u2014': '&mdash;',
  '\u2018': '&lsquo;',
  '\u2019': '&rsquo;',
  '\u201c': '&ldquo;',
  '\u201d': '&rdquo;',
  '\u2026': '&hellip;',
};

/** Texto plano -> HTML con entidades. Nunca devuelve caracteres acentuados. */
function html(texto) {
  if (texto === null || texto === undefined) return '';
  const conTildes = restituirTildes(String(texto));
  let salida = '';
  for (const ch of conTildes) {
    if (ENTIDADES[ch]) {
      salida += ENTIDADES[ch];
    } else if (ch.codePointAt(0) > 126) {
      salida += `&#x${ch.codePointAt(0).toString(16).toUpperCase()};`;
    } else {
      salida += ch;
    }
  }
  for (const [de, a] of FRASES_CON_TILDE) {
    salida = salida.split(de).join(a);
  }
  return salida;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Convierte una fecha ISO (2026-10-30) en la fecha que se lee en un texto. */
function fechaLegible(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return String(iso);
  return `${Number(m[3])} de ${mes} de ${m[1]}`;
}

// ---------------------------------------------------------------------------
// La matriz de finalidades (E1)
// ---------------------------------------------------------------------------

function construirMatriz(matriz) {
  const lineas = [];

  lineas.push('<p><strong>Reglas de la matriz.</strong></p>');
  lineas.push('<ul>');
  for (const regla of matriz.reglas || []) {
    lineas.push(`  <li>${html(regla)}</li>`);
  }
  lineas.push('</ul>');

  lineas.push('<table>');
  lineas.push('  <thead>');
  lineas.push('    <tr>');
  lineas.push('      <th>Identificador</th>');
  lineas.push('      <th>Descripci&oacute;n</th>');
  lineas.push('      <th>Categor&iacute;as de datos</th>');
  lineas.push('      <th>Titulares involucrados</th>');
  lineas.push('      <th>Base jur&iacute;dica declarada</th>');
  lineas.push('      <th>Responsable que instruye</th>');
  lineas.push('      <th>Plazo de conservaci&oacute;n</th>');
  lineas.push('      <th>Consecuencia de la revocatoria o la supresi&oacute;n</th>');
  lineas.push('      <th>Estado de habilitaci&oacute;n</th>');
  lineas.push('    </tr>');
  lineas.push('  </thead>');
  lineas.push('  <tbody>');

  for (const grupo of ['A', 'B']) {
    const definicion = (matriz.grupos || {})[grupo] || {};
    const filas = (matriz.finalidades || []).filter((f) => f.grupo === grupo);
    if (!filas.length) continue;
    lineas.push('    <tr>');
    lineas.push(`      <th colspan="9">${html(definicion.titulo || `Grupo ${grupo}`)}</th>`);
    lineas.push('    </tr>');
    lineas.push('    <tr>');
    lineas.push(`      <td colspan="9">${html(definicion.regla || '')}</td>`);
    lineas.push('    </tr>');
    for (const f of filas) {
      lineas.push('    <tr>');
      lineas.push(`      <td><strong>${html(f.id)}</strong></td>`);
      lineas.push(`      <td>${html(f.descripcion)}</td>`);
      lineas.push(`      <td>${html(f.categorias_datos)}</td>`);
      lineas.push(`      <td>${html(f.titulares)}</td>`);
      lineas.push(`      <td>${html(f.base_juridica)}</td>`);
      lineas.push(`      <td>${html(f.responsable_instruye)}</td>`);
      lineas.push(`      <td>${html(f.plazo_conservacion)}</td>`);
      lineas.push(`      <td>${html(f.consecuencia_revocatoria)}</td>`);
      lineas.push(`      <td>${html(f.estado_habilitacion)}</td>`);
      lineas.push('    </tr>');
    }
  }

  lineas.push('  </tbody>');
  lineas.push('</table>');

  // Evidencia de la instruccion y su version: queda junto a la matriz para que
  // la Empresa vea, en el mismo lugar, que instruccion habilita estas
  // finalidades y que version de esa instruccion es.
  const instr = matriz.instruccion || {};
  if (instr.documento) {
    lineas.push('');
    lineas.push('<p><strong>Evidencia de la instrucci&oacute;n y su versi&oacute;n.</strong> La instrucci&oacute;n '
      + `documentada del Responsable que habilita el Grupo A es la de ${html(instr.responsable || 'la Empresa')}, `
      + `contenida en ${html(instr.documento)}, versi&oacute;n ${html(instr.version)}, fechada el `
      + `${html(instr.fecha)}, y en el Acuerdo de uso del mecanismo de firma electr&oacute;nica K+AIR que el Titular `
      + 'acepta en cada Manifestaci&oacute;n de Voluntad. '
      + `${html(instr.soporte || '')}`
      + ' Esta matriz se genera desde la fuente <code>config/matriz-finalidades.json</code>, versi&oacute;n '
      + `${html(matriz.version)}, actualizada el ${html(fechaLegible(matriz.actualizado_at))}: los cambios en la matriz se aplican `
      + 'regener&aacute;ndola desde esa fuente, no editando esta tabla a mano.</p>');
  }

  return lineas.join('\n');
}

// ---------------------------------------------------------------------------
// La tabla de conservacion (E2)
// ---------------------------------------------------------------------------

/** Consecuencia de la revocatoria o la supresion, derivada de la fuente. */
function consecuenciaDe(categoria) {
  if (categoria.piso_legal) {
    return 'No se suprime por el mero vencimiento del plazo que declare la Empresa: el piso legal '
      + 'prevalece. Vencido el plazo que resulte aplicable y sin deber legal o contractual de '
      + 'conservacion, hold vigente ni solicitud de copia pendiente, se suprime: la supresion deja '
      + 'la lapida y el recibo del numeral 3.6(g) del Acuerdo.';
  }
  if (categoria.hold_siempre) {
    return 'No se suprime por vencimiento: lleva un hold mientras subsista la relacion laboral. La '
      + 'revocatoria y la supresion no proceden mientras exista ese deber legal o contractual de '
      + 'permanencia (articulo 2.2.2.25.2.6 del Decreto 1074 de 2015).';
  }
  if (categoria.hereda_de) {
    return 'No se suprime antes de que venza el plazo del documento asociado, y la supresion de la '
      + 'constancia no suprime el documento asociado, que se rige por su propia categoria. La '
      + 'supresion deja la lapida y el recibo del numeral 3.6(g) del Acuerdo.';
  }
  return 'Vencido el plazo y sin deber legal o contractual de conservacion, hold vigente ni solicitud '
    + 'de copia pendiente, se suprime: la supresion deja la lapida y el recibo del numeral 3.6(g) del '
    + 'Acuerdo, no altera la evidencia ya generada y no devuelve el dato suprimido.';
}

/** Condicion especial de la categoria, derivada de la fuente. */
function condicionDe(categoria) {
  if (categoria.piso_legal) {
    return 'Piso legal: la tabla de retencion documental de la Empresa no puede bajarlo. El plazo es '
      + 'un tope de custodia y no autoriza a conservar mas alla de la finalidad (numeral 8.6(a) del '
      + 'Acuerdo).';
  }
  if (categoria.hold_siempre) {
    return 'Hold: no se suprime por vencimiento mientras subsista la relacion laboral (numeral 8.6(c) '
      + 'del Acuerdo). El plazo es un tope de custodia y no autoriza a conservar mas alla de la '
      + 'finalidad (numeral 8.6(a) del Acuerdo).';
  }
  if (categoria.hereda_de) {
    return 'Hereda el plazo del documento al que se refiere la firma: si ese documento no tiene plazo '
      + 'propio, se aplica el de «Documento original y firmado». El plazo es un tope de custodia y no '
      + 'autoriza a conservar mas alla de la finalidad (numeral 8.6(a) del Acuerdo).';
  }
  return 'Ninguna adicional. El plazo es un tope de custodia y no autoriza a conservar mas alla de la '
    + 'finalidad (numeral 8.6(a) del Acuerdo).';
}

function construirTabla(tabla) {
  const lineas = [];

  // Los identificadores de la fuente (DOCUMENTO_FIRMADO, ...) no son texto
  // legal: cuando una nota los menciona, se cambian por el nombre de la
  // categoria, que si es texto que se lee.
  const nombreDe = new Map(tabla.categorias.map((c) => [c.id, c.nombre]));
  function sinCodigos(texto) {
    let salida = String(texto || '');
    for (const [id, nombre] of nombreDe) {
      salida = salida.split(id).join(`«${nombre}»`);
    }
    return salida;
  }

  lineas.push('<p><strong>Fuente y precedencia de esta tabla.</strong> Esta tabla se genera desde la '
    + 'fuente &uacute;nica de la conservaci&oacute;n del servicio '
    + '(<code>config/tabla-conservacion.json</code>, versi&oacute;n '
    + `${html(tabla.version)}, actualizada el ${html(fechaLegible(tabla.actualizado_at))}) y no se edita a mano. `
    + '<strong>Precedencia:</strong> la tabla de retenci&oacute;n documental de la '
    + '<strong>Empresa</strong>, cuando declara un plazo para una categor&iacute;a, tiene precedencia '
    + 'sobre el plazo por defecto de esta tabla supletoria (numeral 8.6(a) del Acuerdo); cuando la '
    + 'Empresa no declara plazo, se aplica el plazo por defecto de esta tabla, que siempre existe: '
    + '<strong>no hay retenci&oacute;n indefinida</strong> ni <em>hold</em> por plazo no declarado. El '
    + '<strong>piso legal</strong> de los registros del SG-SST no puede ser bajado por la tabla de la '
    + 'Empresa. Los plazos que esta tabla declara como supletorios est&aacute;n sujetos a la '
    + 'validaci&oacute;n jur&iacute;dica pendiente: mientras esa validaci&oacute;n no se produzca, la '
    + 'tabla de la Empresa, que tiene precedencia, es la que fija el plazo aplicable a sus registros. '
    + 'Modificar la fuente no altera los registros ya calculados: el plazo aplicado, su fuente y la '
    + 'fecha de inicio quedan congelados en cada documento.</p>');

  lineas.push('<table>');
  lineas.push('  <thead>');
  lineas.push('    <tr>');
  lineas.push('      <th>Categor&iacute;a documental</th>');
  lineas.push('      <th>Plazo</th>');
  lineas.push('      <th>Punto de inicio</th>');
  lineas.push('      <th>Fundamento</th>');
  lineas.push('      <th>Condici&oacute;n especial</th>');
  lineas.push('      <th>Consecuencia de la revocatoria o la supresi&oacute;n</th>');
  lineas.push('    </tr>');
  lineas.push('  </thead>');
  lineas.push('  <tbody>');

  for (const categoria of tabla.categorias) {
    const punto = categoria.punto_inicio
      ? (tabla.puntos_inicio || {})[categoria.punto_inicio]
      : PUNTO_INICIO_FALLBACK[categoria.id];
    lineas.push('    <tr>');
    lineas.push(`      <td><strong>${html(categoria.nombre)}</strong></td>`);
    lineas.push('      <td>');
    lineas.push(`        ${html(categoria.plazo_texto)}<br>`);
    if (categoria.piso_legal) {
      lineas.push('        <em>Piso legal: la tabla de la Empresa no puede bajarlo.</em>');
    } else if (categoria.hold_siempre) {
      lineas.push('        <em>No se suprime por vencimiento: lleva un hold mientras subsista la '
        + 'relaci&oacute;n laboral (numeral 8.6(c) del Acuerdo).</em>');
    } else {
      lineas.push('        <em>Por defecto; la tabla de la Empresa precede (8.6(a)).</em>');
    }
    lineas.push('      </td>');
    lineas.push(`      <td>${html(punto || 'No aplica.')}</td>`);
    lineas.push('      <td>');
    lineas.push(`        ${html(categoria.fundamento)}`);
    if (categoria.nota) {
      lineas.push(`        <br><em>${html(sinCodigos(categoria.nota))}</em>`);
    }
    lineas.push('      </td>');
    lineas.push(`      <td>${html(condicionDe(categoria))}</td>`);
    lineas.push(`      <td>${html(consecuenciaDe(categoria))}</td>`);
    lineas.push('    </tr>');
  }

  lineas.push('  </tbody>');
  lineas.push('</table>');

  return lineas.join('\n');
}

// ---------------------------------------------------------------------------
// Reemplazo entre marcadores
// ---------------------------------------------------------------------------

function reemplazarBloque(contenidoHtml, inicio, fin, bloque) {
  const iIni = contenidoHtml.indexOf(inicio);
  const iFin = contenidoHtml.indexOf(fin);
  if (iIni === -1) fallar(`No esta el marcador ${inicio} en el Anexo de Encargo.`);
  if (iFin === -1) fallar(`No esta el marcador ${fin} en el Anexo de Encargo.`);
  if (iFin < iIni) fallar(`Los marcadores de ${inicio} estan al reves en el Anexo de Encargo.`);
  const antes = contenidoHtml.slice(0, iIni + inicio.length);
  const despues = contenidoHtml.slice(iFin);
  return `${antes}\n${bloque}\n${despues}`;
}

// ---------------------------------------------------------------------------
// Validacion de las fuentes
// ---------------------------------------------------------------------------

function validarTabla(tabla) {
  if (!Array.isArray(tabla.categorias)) {
    fallar('tabla-conservacion.json no trae el arreglo "categorias".');
  }
  const porId = new Map();
  for (const categoria of tabla.categorias) {
    if (!categoria.id) fallar('Una categoria de tabla-conservacion.json no tiene "id".');
    porId.set(categoria.id, categoria);
  }
  for (const id of CATEGORIAS_REQUERIDAS) {
    if (!porId.has(id)) {
      fallar(`Falta la categoria requerida ${id} en tabla-conservacion.json.`);
    }
  }
  for (const categoria of tabla.categorias) {
    for (const campo of ['nombre', 'plazo_texto', 'fundamento']) {
      if (!categoria[campo]) {
        fallar(`La categoria ${categoria.id} de tabla-conservacion.json no trae "${campo}".`);
      }
    }
    const tieneCondicion = categoria.piso_legal || categoria.hold_siempre
      || Boolean(categoria.hereda_de);
    if ((categoria.plazo_dias === null || categoria.plazo_dias === undefined) && !tieneCondicion) {
      fallar(`La categoria ${categoria.id} no tiene plazo ni condicion que lo defina.`);
    }
    if (categoria.punto_inicio && !(tabla.puntos_inicio || {})[categoria.punto_inicio]) {
      fallar(`La categoria ${categoria.id} apunta a un punto de inicio que no esta en la leyenda.`);
    }
    if (!categoria.punto_inicio && !PUNTO_INICIO_FALLBACK[categoria.id]) {
      fallar(`La categoria ${categoria.id} no tiene punto de inicio ni excepcion declarada para el.`);
    }
  }
  return porId;
}

function validarMatriz(matriz) {
  if (!Array.isArray(matriz.finalidades)) {
    fallar('matriz-finalidades.json no trae el arreglo "finalidades".');
  }
  const porId = new Map();
  for (const f of matriz.finalidades) {
    if (!f.id) fallar('Una finalidad de matriz-finalidades.json no tiene "id".');
    if (porId.has(f.id)) fallar(`La finalidad ${f.id} esta duplicada en matriz-finalidades.json.`);
    porId.set(f.id, f);
  }
  for (const req of FINALIDADES_REQUERIDAS) {
    const f = porId.get(req.id);
    if (!f) fallar(`Falta la finalidad requerida ${req.id} en matriz-finalidades.json.`);
    const literal = String(f.literal || '').trim();
    if (literal !== req.literal) {
      fallar(`El literal de ${req.id} no coincide con el del Acuerdo.\n`
        + `  esperado: ${req.literal}\n`
        + `  en la fuente: ${literal}`);
    }
    if (f.grupo !== 'A' && f.grupo !== 'B') {
      fallar(`La finalidad ${req.id} no tiene grupo valido (A o B).`);
    }
    for (const campo of CAMPOS_OBLIGATORIOS) {
      if (!f[campo] || String(f[campo]).trim() === '') {
        fallar(`La finalidad ${req.id} no trae el campo "${campo}".`);
      }
    }
  }
  if (porId.size !== FINALIDADES_REQUERIDAS.length) {
    fallar(`matriz-finalidades.json trae ${porId.size} finalidades y el Acuerdo enumera `
      + `${FINALIDADES_REQUERIDAS.length}.`);
  }
  return porId;
}

// ---------------------------------------------------------------------------
// Programa
// ---------------------------------------------------------------------------

function sha256(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

function main() {
  const args = process.argv.slice(2);
  const soloVerificar = args.includes('--check');
  const argRaiz = args.find((a) => a.startsWith('--raiz='));
  const desconocidos = args.filter((a) => a !== '--check' && !a.startsWith('--raiz='));
  if (desconocidos.length) {
    console.error(`Argumento desconocido: ${desconocidos.join(', ')}. Uso: --check [--raiz=carpeta]`);
    process.exit(1);
  }

  // --raiz permite apuntar a otra copia del repositorio: lo usan los tests
  // para provar que el script falla cuando la fuente esta incompleta.
  const raiz = argRaiz ? path.resolve(argRaiz.slice('--raiz='.length)) : REPO_ROOT;
  const CONFIG_TABLA = path.join(raiz, CONFIG_TABLA_REL);
  const CONFIG_MATRIZ = path.join(raiz, CONFIG_MATRIZ_REL);
  const HTML_LEGAL = path.join(raiz, HTML_LEGAL_REL);
  const HTML_SITIO = path.join(raiz, HTML_SITIO_REL);

  const tabla = leerJson(CONFIG_TABLA);
  const matriz = leerJson(CONFIG_MATRIZ);

  validarTabla(tabla);
  validarMatriz(matriz);

  const contenido = fs.readFileSync(HTML_LEGAL, 'utf8');
  const eol = contenido.includes('\r\n') ? '\r\n' : '\n';

  const bloqueMatriz = construirMatriz(matriz);
  const bloqueTabla = construirTabla(tabla);

  let nuevo = contenido;
  nuevo = reemplazarBloque(nuevo, MARCA_MATRIZ_INI, MARCA_MATRIZ_FIN, bloqueMatriz);
  nuevo = reemplazarBloque(nuevo, MARCA_TABLA_INI, MARCA_TABLA_FIN, bloqueTabla);
  if (eol === '\r\n') {
    nuevo = nuevo.replace(/\r?\n/g, '\r\n');
  }

  const grupoA = matriz.finalidades.filter((f) => f.grupo === 'A').length;
  const grupoB = matriz.finalidades.filter((f) => f.grupo === 'B').length;
  const pendientes = matriz.finalidades.filter(
    (f) => String(f.base_juridica).includes('pendiente de validacion juridica')
  ).length;

  if (soloVerificar) {
    if (nuevo !== contenido) {
      console.error('VERIFICACION FALLIDA: el Anexo de Encargo no esta al dia con las fuentes.');
      console.error('  Correr: node scripts/generar-anexo-encargo.js');
      process.exit(2);
    }
    console.log('VERIFICACION OK: el Anexo de Encargo esta al dia con las dos fuentes.');
  } else {
    fs.writeFileSync(HTML_LEGAL, nuevo, 'utf8');
    if (fs.existsSync(HTML_SITIO)) {
      fs.writeFileSync(HTML_SITIO, nuevo, 'utf8');
    }
    console.log('Anexo de Encargo regenerado.');
  }

  console.log('');
  console.log('  Resumen');
  console.log(`    categorias de conservacion : ${tabla.categorias.length}`
    + ` (${CATEGORIAS_REQUERIDAS.length} requeridas, todas presentes)`);
  console.log(`    finalidades                : ${matriz.finalidades.length}`
    + ` (Grupo A ${grupoA}, Grupo B ${grupoB})`);
  console.log(`    base juridica pendiente    : ${pendientes} de ${matriz.finalidades.length}`);
  console.log(`    version de la fuente tabla : ${tabla.version} (${tabla.actualizado_at})`);
  console.log(`    estado de la fuente tabla  : ${restituirTildes(tabla.estado)}`);
  console.log(`    version de la fuente matriz: ${matriz.version} (${matriz.actualizado_at})`);
  console.log(`    estado de la fuente matriz : ${restituirTildes(matriz.estado)}`);
  console.log(`    sha256 legal/anexo-encargo.html : ${sha256(nuevo)}`);
  if (fs.existsSync(HTML_SITIO)) {
    const sitio = fs.readFileSync(HTML_SITIO, 'utf8');
    console.log(`    sitio/anexo-encargo.html identico : ${sitio === nuevo ? 'si' : 'NO'}`);
  }
  console.log('');
}

try {
  main();
} catch (err) {
  if (err instanceof ErrorFuente) {
    console.error(`ERROR DE FUENTE: ${err.message}`);
    process.exit(2);
  }
  throw err;
}
