/**
 * EL ACTA DE SUSCRIPCIÓN DEL ANEXO DE ENCARGO
 * ============================================================================
 *
 * QUÉ ES
 * ------
 * El documento que deja constancia de que la Empresa se suscribió al Anexo
 * de Encargo. Es el equivalente del acta de una firma: un PDF con QUIÉN
 * firmó, QUÉ firmó, CUÁNDO, CÓMO se verificó y con QUÉ huella.
 *
 * POR QUÉ HAY UN ACTA Y NO UN MENSAJE DE PANTALLA
 * ------------------------------------------------
 * El Anexo de Nube no genera ningún documento: su constancia es el mensaje
 * de la pantalla ("Guarde esta pantalla"). El Anexo de Encargo es un
 * instrumento BILATERAL (el §12 tiene dos bloques de firma: el de la Empresa
 * y el de K+AIR como Encargado), y un contrato bilateral necesita un
 * documento que quede: el que la Empresa guarda y el que K+AIR archiva en el
 * expediente.
 *
 * LO QUE DICE Y LO QUE NO DICE
 * ----------------------------
 * El acta deja constancia de la FASE 1: la suscripción de la Empresa. Deja
 * escrito, en mayúsculas, que el instrumento NO está ejecutado y que le
 * falta la contrafirma de K+AIR. Un acta que dijera "contrato firmado"
 * cuando solo hay una de las dos partes firmadas sería una falsificación.
 *
 * LAS DOS HUELLAS, Y QUE NO SE CONFUNDAN
 * --------------------------------------
 *  - La HUELLA CANÓNICA (la del texto del Anexo) se imprime: es lo que
 *    liga el acta con el instrumento.
 *  - La HUELLA DEL ACTA (la de sus bytes) NO se puede imprimir dentro del
 *    acta: se calcula sobre los bytes ya generados. Queda registrada con la
 *    suscripción (en la evidencia de la fila) y después en la evidencia del
 *    manifiesto. Por eso el acta lo dice: quien la reciba sabe que hay una
 *    segunda huella que verificar contra el registro.
 *
 * EL CÓDIGO DE VERIFICACIÓN NO SE IMPRIME
 * --------------------------------------
 * El §4.5 del plan habla de "el código verificado". Lo que se registra es
 * QUE se verificó y CUÁNDO, nunca los seis dígitos: el código es un secreto
 * con caducidad y el servicio no lo guarda en claro en ningún sitio (ni en
 * la base, ni en un correo, ni en un documento). Imprimirlo sería romper la
 * única regla que lo protege.
 *
 * QUIÉN VE QUÉ
 * ------------
 * Los datos del §11 (razón social, NIT, domicilio, correo y representante)
 * se imprimen COMPLETOS: son los datos que la Empresa declaró y los que
 * hacen identificable el instrumento. El correo del firmante sí va
 * ENMASCARADO (`re***@empresa.com`), porque es el canal por el que salió el
 * código de verificación: el completo queda en el registro, no en un
 * documento que la Empresa puede compartir con quien quiera.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const storage = require('./storage');

// ─── Medidas de la página ──────────────────────────────────────────────────
const PAGINA_ANCHO = 612;
const PAGINA_ALTO = 792;
const MARGEN = 56;
const Y_INICIAL = 720;
const Y_MINIMO = 78;   // por debajo de esto se abre otra página

// ─── Colores (los mismos de la página de sello: src/services/pdfGen.js) ────
const AZUL = rgb(0.09, 0.31, 0.65);
const GRIS = rgb(0.35, 0.35, 0.35);
const NEGRO = rgb(0, 0, 0);
const AVISO_FONDO = rgb(1, 0.97, 0.89);
const AVISO_BORDE = rgb(0.79, 0.63, 0.11);

// ─── Helpers ───────────────────────────────────────────────────────────────

function _sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Un texto, acotado. Lo que no llega se marca como 'N/D' (no como vacío):
 * un hueco en un acta es un dato que falta, y tiene que verse.
 *
 * @param {*} v
 * @param {number} [max]
 * @returns {string}
 */
function _texto(v, max) {
  if (v === null || v === undefined) return 'N/D';
  const s = String(v).trim();
  if (!s) return 'N/D';
  const limite = max || 500;
  return s.length > limite ? s.slice(0, limite) : s;
}

/**
 * Enmascara un correo para mostrarlo sin exponerlo entero.
 * `representante@empresa.com` -> `re***@empresa.com`
 *
 * POR QUÉ VIVE ACÁ Y NO EN EL SERVICIO
 * -------------------------------------
 * El acta y el contexto público tienen que ENMASCARAR IGUAL: si difieren,
 * la Empresa vería un correo distinto en la pantalla y en el acta, y el
 * registro dejaría de cuadrar con lo que la Empresa leyó. El servicio
 * (services/anexoEncargo.js) toma esta misma función, así que hay una sola
 * implementación.
 *
 * @param {string} correo
 * @returns {string}
 */
function enmascararCorreo(correo) {
  const s = String(correo || '');
  const arroba = s.indexOf('@');
  if (arroba <= 0) return '***';
  const usuario = s.slice(0, arroba);
  const visible = usuario.slice(0, 2);
  return `${visible}***${s.slice(arroba)}`;
}

/**
 * ISO -> 'DD/MM/YYYY, HH:mm:ss' (hora local del servidor).
 * La precisión legal la da el ISO crudo, que también se imprime.
 *
 * @param {string} iso
 * @returns {string}
 */
function _fmtFechaHora(iso) {
  if (!iso) return 'N/D';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Parte un texto en líneas que quepan en un ancho dado.
 *
 * @param {string} text
 * @param {object} font
 * @param {number} size
 * @param {number} maxWidth
 * @returns {string[]}
 */
function _wrap(text, font, size, maxWidth) {
  const palabras = String(text).split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? actual + ' ' + palabra : palabra;
    if (font.widthOfTextAtSize(prueba, size) <= maxWidth) {
      actual = prueba;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [''];
}

// ─── La ruta del acta ──────────────────────────────────────────────────────

/**
 * El nombre del archivo del acta de una suscripción.
 *
 * Sale del id de la suscripción (un entero de la base), nunca de lo que
 * escribió la Empresa: el nombre no se puede usar para escribir fuera de
 * la carpeta.
 *
 * @param {number} id_suscripcion
 * @returns {string}
 */
function nombreActa(id_suscripcion) {
  return `acta-${Number(id_suscripcion)}-anexo-encargo.pdf`;
}

/**
 * La ruta ABSOLUTA del acta.
 *
 * @param {string} filename
 * @returns {string}
 */
function rutaActa(filename) {
  return path.join(storage.PATHS.actas, path.basename(String(filename || '')));
}

/**
 * Escribe el acta en disco, con fsync (igual que `writeFileAtomic` de
 * publicFlow.js): si el proceso se muere a mitad de la escritura, el
 * archivo no queda truncado en silencio.
 *
 * @param {string} filename
 * @param {Buffer} buffer
 * @returns {string} la ruta absoluta.
 */
function guardarActa(filename, buffer) {
  const ruta = rutaActa(filename);
  const fd = fs.openSync(ruta, 'w');
  try {
    fs.writeSync(fd, buffer, 0, buffer.length, 0);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return ruta;
}

/**
 * Lee el acta del disco, si está.
 *
 * @param {string} filename
 * @returns {{found: true, buffer: Buffer} | {found: false}}
 */
function leerActa(filename) {
  const nombre = path.basename(String(filename || ''));
  if (!nombre) return { found: false };
  const ruta = rutaActa(nombre);
  if (!fs.existsSync(ruta)) return { found: false };
  return { found: true, buffer: fs.readFileSync(ruta) };
}

// ─── El generador ──────────────────────────────────────────────────────────

/**
 * Genera el acta de suscripción.
 *
 * @param {object} datos
 * @param {number} datos.id_suscripcion
 * @param {string} datos.id_empresa
 * @param {string} datos.empresa - razón social de la Empresa.
 * @param {string} datos.version - versión del texto canónico.
 * @param {string} datos.hash_texto - huella SHA-256 del texto canónico.
 * @param {string} datos.firmado_at - ISO 8601 del acto.
 * @param {string} [datos.nombre_firmante]
 * @param {string} [datos.cargo_firmante]
 * @param {string} [datos.correo_firmante] - el correo COMPLETO (aquí se enmascara).
 * @param {string} [datos.codigo_enviado_at]
 * @param {string} [datos.codigo_verificado_at]
 * @param {string} [datos.enlace_abierto_at]
 * @param {string} [datos.ip]
 * @param {string} [datos.user_agent]
 * @param {object} [datos.datos_empresa] - los cinco datos del §11.
 * @returns {Promise<{buffer: Buffer, hash: string, bytes: number, filename: string}>}
 */
/**
 * EL LIENZO DEL ACTA: las herramientas de dibujo.
 *
 * POR QUÉ ESTÁ FUERA DE `generarActa`
 * ------------------------------------
 * El Anexo de Encargo tiene DOS actas: la de la suscripción (fase 1) y la de
 * la contrafirma (fase 2). Si cada una tuviera su propio maquetado, un día
 * las dos se verían distintas: distinto margen, distinto tamaño de letra,
 * distinta caja de aviso. Y dos actas del MISMO instrumento que se ven
 * distinto hacen pensar que son dos instrumentos distintos.
 *
 * Por eso el maquetado vive AQUÍ, una sola vez, y las dos actas lo usan.
 *
 * @param {object} pdfDoc - el documento de pdf-lib ya creado.
 * @returns {Promise<object>} las herramientas y el estado de la página.
 */
async function _crearLienzo(pdfDoc) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = null;
  let y = 0;

  function nuevaPagina() {
    page = pdfDoc.addPage([PAGINA_ANCHO, PAGINA_ALTO]);
    y = Y_INICIAL;
  }

  /** Asegura que queda espacio; si no, abre página. */
  function espacio(alto) {
    if (!page || y - alto < Y_MINIMO) nuevaPagina();
  }

  /** Una línea de texto. */
  function linea(texto, opts) {
    const o = opts || {};
    const alto = o.lh || 15;
    espacio(alto);
    page.drawText(String(texto), {
      x: o.x === undefined ? MARGEN : o.x,
      y: y,
      size: o.size || 9.5,
      font: o.bold ? fontBold : font,
      color: o.color || NEGRO,
    });
    y -= alto;
  }

  /** Un bloque de texto que se ajusta al ancho. */
  function bloque(texto, opts) {
    const o = opts || {};
    const size = o.size || 9.5;
    const lh = o.lh || 13;
    const ancho = o.ancho || (PAGINA_ANCHO - (MARGEN * 2));
    for (const l of _wrap(texto, o.bold ? fontBold : font, size, ancho)) {
      linea(l, { size: size, lh: lh, bold: o.bold, color: o.color, x: o.x });
    }
  }

  /** Una fila "etiqueta: valor", con la etiqueta en gris. */
  function dato(etiqueta, valor, opts) {
    const o = opts || {};
    const size = o.size || 9.5;
    const lh = o.lh || 14;
    const anchoValor = o.anchoValor || 300;
    const xValor = (o.x === undefined ? MARGEN : o.x) + 150;

    const lineas = _wrap(String(valor), o.bold ? fontBold : font, size, anchoValor);
    const alto = Math.max(lineas.length * lh, lh) + 2;
    espacio(alto);

    page.drawText(String(etiqueta), {
      x: o.x === undefined ? MARGEN : o.x,
      y: y,
      size: size,
      font: fontBold,
      color: GRIS,
    });
    lineas.forEach((l, i) => {
      page.drawText(l, {
        x: xValor,
        y: y - (i * lh),
        size: size,
        font: o.bold ? fontBold : font,
        color: NEGRO,
      });
    });
    y -= alto;
  }

  /** El título de una sección. */
  function seccion(titulo) {
    // Deja sitio para el título y para varias filas: si no cabe, la sección
    // empieza en la página siguiente. Un acta con una sección partida a la
    // mitad se ve como un documento mal hecho.
    espacio(110);
    y -= 6;
    linea(titulo.toUpperCase(), { bold: true, size: 10.5, color: AZUL, lh: 16 });
    y -= 2;
  }

  /** Una caja de aviso con su texto dentro. */
  function aviso(titulo, cuerpo) {
    const ancho = PAGINA_ANCHO - (MARGEN * 2);
    const lineasTitulo = _wrap(titulo, fontBold, 9.5, ancho - 20);
    const lineasCuerpo = _wrap(cuerpo, font, 9, ancho - 20);
    const alto = (lineasTitulo.length * 13) + (lineasCuerpo.length * 12) + 24;
    espacio(alto + 12);

    page.drawRectangle({
      x: MARGEN, y: y - alto, width: ancho, height: alto,
      color: AVISO_FONDO, borderColor: AVISO_BORDE, borderWidth: 1,
    });
    page.drawRectangle({
      x: MARGEN, y: y - alto, width: 4, height: alto,
      color: AVISO_BORDE,
    });

    let yi = y - 16;
    for (const l of lineasTitulo) {
      page.drawText(l, { x: MARGEN + 14, y: yi, size: 9.5, font: fontBold, color: NEGRO });
      yi -= 13;
    }
    for (const l of lineasCuerpo) {
      page.drawText(l, { x: MARGEN + 14, y: yi, size: 9, font: font, color: NEGRO });
      yi -= 12;
    }
    y -= alto + 14;
  }


  return {
    font,
    fontBold,
    nuevaPagina,
    espacio,
    linea,
    bloque,
    dato,
    seccion,
    aviso,
    /** La página actual (para dibujar encima de algo puntual). */
    get pagina() { return page; },
    /** La línea donde se está escribiendo. */
    get y() { return y; },
    /** Baja la línea sin escribir nada (un hueco). */
    avanzar(cantidad) { y -= cantidad; },
  };
}

async function generarActa(datos) {
  const d = datos || {};
  const pdfDoc = await PDFDocument.create();
  const c = await _crearLienzo(pdfDoc);

  c.nuevaPagina();

  // ─── Encabezado ───────────────────────────────────────────────────────────
  c.linea('=========================================================================', { color: AZUL, lh: 18 });
  c.linea('ACTA DE SUSCRIPCIÓN DEL ANEXO DE ENCARGO', { bold: true, size: 15, color: AZUL, lh: 20 });
  c.linea('K+AIR - Gesstiar S.A.S. - NIT 900987987-4 - Colombia', { color: GRIS, lh: 14 });
  c.linea('=========================================================================', { color: AZUL, lh: 22 });

  // ─── El aviso de las dos fases ────────────────────────────────────────────
  c.aviso(
    'FASE 1 DE 2: LA EMPRESA SE SUSCRIBIÓ. EL INSTRUMENTO NO ESTÁ EJECUTADO.',
    'El Anexo de Encargo es un contrato bilateral: esta acta deja constancia de que la '
    + 'Empresa se suscribió al texto canónico cuya huella está impresa más abajo. La '
    + 'contrafirma de K+AIR como Encargado es OTRO acto, posterior a este, y se registra '
    + 'por separado. Mientras no exista esa contrafirma, el contrato NO está ejecutado y '
    + 'esta acta NO lo declara firmado.');
  c.aviso(
    'ESTA ACTA ES UNA CONSTANCIA, NO LA COPIA FIRMADA',
    'Esta acta es una constancia de la suscripción. No sustituye la copia firmada '
    + 'del Anexo, que cada parte conserva. El §12 del Anexo de Encargo prevé que la '
    + 'copia firmada la conserve cada parte, y el servicio no la almacena: lo que '
    + 'aquí queda es el documento que K+AIR archiva en el expediente y que la Empresa '
    + 'puede descargar.');
  c.aviso(
    'LA DECLARACIÓN DE LA EMPRESA',
    'La Empresa declara que leyó el texto canónico del Anexo de Encargo en la versión '
    + 'indicada, con la huella indicada, que aceptó sus condiciones en nombre propio, que '
    + 'declaró los cinco datos del párrafo 11 que se imprimen más abajo, que declaró el '
    + 'documento y la calidad de quien suscribe, que verificó su identidad con el código '
    + 'de verificación recibido en un canal distinto al del enlace, y que acepta el '
    + 'mecanismo electrónico por el que se suscribe este Anexo.');

  // ─── 1. El instrumento ─────────────────────────────────────────────────────
  c.seccion('1. El instrumento suscrito');
  c.dato('Versión del texto', _texto(d.version, 40), { bold: true });

  // La huella va PARTIDA en dos renglones, con su etiqueta: los 64
  // caracteres no caben en la columna de los valores, y una huella partida a
  // mano se presta para que alguien la lea mal (o la recorte mal).
  const hash = _texto(d.hash_texto, 64);
  c.espacio(34);
  c.pagina.drawText('Huella SHA-256', { x: MARGEN, y: c.y, size: 9.5, font: c.fontBold, color: GRIS });
  if (hash.length === 64) {
    c.pagina.drawText(hash.slice(0, 32), { x: MARGEN + 150, y: c.y, size: 9.5, font: c.fontBold });
    c.pagina.drawText(hash.slice(32), { x: MARGEN + 150, y: c.y - 14, size: 9.5, font: c.fontBold });
    c.avanzar(30);
  } else {
    c.pagina.drawText(hash, { x: MARGEN + 150, y: c.y, size: 9.5, font: c.fontBold });
    c.avanzar(16);
  }
  c.dato('Empresa', _texto(d.empresa, 200), { bold: true });

  // ─── 2. La suscripción ─────────────────────────────────────────────────────
  c.seccion('2. La suscripción');
  c.dato('Fecha y hora (ISO 8601)', _texto(d.firmado_at, 40), { bold: true });
  c.dato('Fecha y hora (local)', _fmtFechaHora(d.firmado_at));
  c.dato('Id de la suscripción', String(d.id_suscripcion === undefined ? 'N/D' : d.id_suscripcion));
  c.dato('Firmante', _texto(d.nombre_firmante, 200));
  c.dato('Cargo', _texto(d.cargo_firmante, 200));
  c.dato('Correo del firmante', enmascararCorreo(d.correo_firmante));
  c.dato('Enlace abierto el', _texto(d.enlace_abierto_at, 40));

  // ─── 3. Los cinco datos del §11 ───────────────────────────────────────────
  c.seccion('3. Los cinco datos del parrafo 11 declarados por la Empresa');
  const s11 = d.datos_empresa || {};
  c.dato('Razón social', _texto(s11.razon_social, 200));
  c.dato('NIT o C.C.', _texto(s11.nit, 60));
  c.dato('Domicilio', _texto(s11.domicilio, 300));
  c.dato('Correo', _texto(s11.correo, 254));
  c.dato('Representante legal', _texto(s11.representante, 200));

  // ─── 4. Quién firmó ─────────────────────────────────────────────────────
  // El documento va con su final nada más: el número completo está cifrado en
  // el registro, y un acta es un documento que la Empresa puede compartir con
  // quien quiera.
  c.seccion('4. Quien firmó');
  c.dato('Nombre', _texto(d.representante_nombre, 200));
  c.dato('Documento', _texto(d.representante_documento, 60));
  c.dato('Calidad', _texto(d.representante_calidad, 40));
  c.bloque('La verificación documental de esa representación (contra el certificado de '
    + 'existencia y representación de la cámara de comercio, contra el RUT de la Empresa '
    + 'o contra el poder, según la calidad) la hace K+AIR después de esta suscripción, '
    + 'y queda registrada en el expediente. K+AIR no contrafirma el Anexo sin esa '
    + 'verificación: es la contrafirma la que la deja por escrito.', { size: 8.5, lh: 11 });

  // ─── 5. La verificación ────────────────────────────────────────────────────
  c.seccion('5. La verificación');
  c.dato('Código de verificación', 'Verificado (los seis dígitos no se registran en claro)');
  c.dato('Canal del código', d.canal_codigo ? enmascararCorreo(d.canal_codigo) : 'N/D');
  c.dato('Distinto del buzón del enlace', d.canal_codigo ? 'Sí' : 'N/D');
  c.dato('Código enviado el', _texto(d.codigo_enviado_at, 40));
  c.dato('Código verificado el', _texto(d.codigo_verificado_at, 40));
  c.dato('Dirección IP', _texto(d.ip, 64));
  c.dato('Navegador', _texto(d.user_agent, 300));

  // ─── 6. Lo que la Empresa aceptó ──────────────────────────────────────────
  // El acta imprime las PALABRAS que la Empresa marcó, con su huella. Es la
  // diferencia entre un acta que dice "aceptó" y un acta que prueba qué se
  // aceptó.
  c.seccion('6. Lo que la Empresa aceptó');
  if (d.texto_mecanismo) {
    c.bloque(d.texto_mecanismo, { size: 8.5, lh: 11 });
    c.avanzar(4);
  }
  if (d.texto_declaracion) {
    c.bloque(d.texto_declaracion, { size: 8.5, lh: 11 });
    c.avanzar(4);
  }
  if (d.texto_tratamiento) {
    c.bloque(d.texto_tratamiento, { size: 8.5, lh: 11 });
    c.avanzar(4);
  }
  c.dato('Huella del texto aceptado', _texto(d.aceptacion_hash, 64));
  c.dato('Huella del texto de datos', _texto(d.aceptacion_tratamiento_hash, 64));

  // ─── 7. El registro ────────────────────────────────────────────────────────
  c.seccion('7. Dónde queda el registro');
  c.bloque('La suscripción quedó registrada en el servicio de firma electrónica K+AIR, con su '
    + 'rastro inalterable: cada paso (apertura del enlace, envío del código, verificación y '
    + 'suscripción) queda con fecha, dirección IP y navegador. La suscripción quedó además '
    + 'en la ficha de la Empresa, con el valor anterior, el nuevo, quién la cambió, desde '
    + 'dónde y por qué. Esa fecha de la ficha dice SUSCRIPCIÓN, no firma: el Anexo de '
    + 'Encargo es bilateral y el instrumento queda ejecutado solo cuando K+AIR también '
    + 'firma, en un segundo acto que se registra por separado.');

  // ─── Nota sobre la segunda huella ─────────────────────────────────────────
  c.espacio(60);
  c.avanzar(4);
  c.linea('Nota sobre la huella de este acta', { bold: true, size: 9.5, color: GRIS, lh: 14 });
  c.bloque('La huella SHA-256 de este acta (la de sus bytes) no puede imprimirse dentro del '
    + 'propio acta: se calcula sobre los bytes ya generados. Queda registrada con la '
    + 'suscripción y en la evidencia del manifiesto legal. Quien reciba este documento y '
    + 'quiera verificarlo, lo contrasta contra ese registro.', { size: 8.5, lh: 11 });

  // ─── Pie ───────────────────────────────────────────────────────────────────
  const totalPaginas = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((p, i) => {
    p.drawText('Acta de suscripción del Anexo de Encargo - K+AIR - Gesstiar S.A.S.', {
      x: MARGEN, y: 40, size: 8, font: c.font, color: GRIS,
    });
    p.drawText(`Página ${i + 1} de ${totalPaginas}`, {
      x: PAGINA_ANCHO - MARGEN - 80, y: 40, size: 8, font: c.font, color: GRIS,
    });
  });

  const bytes = await pdfDoc.save();
  const buffer = Buffer.from(bytes);
  return {
    buffer: buffer,
    hash: _sha256(buffer),
    bytes: buffer.length,
    filename: nombreActa(d.id_suscripcion),
  };
}

/**
 * El nombre del acta de la CONTRAFIRMA.
 *
 * Es OTRO archivo que el de la suscripción: el de la suscripción ya se lo llevó
 * la Empresa, con su huella. No se puede reescribir ese: si se reescribiera,
 * la huella que la Empresa tiene en su copia dejaría de coincidir con la del
 * expediente.
 *
 * @param {number} id_suscripcion
 * @returns {string}
 */
function nombreActaContrafirma(id_suscripcion) {
  return `acta-${Number(id_suscripcion)}-contrafirma-anexo-encargo.pdf`;
}

/**
 * EL ACTA DE LA CONTRAFIRMA (fase 2)
 * ==================================
 *
 * El segundo acta del Anexo de Encargo: la constancia de la contrafirma de
 * K+AIR.
 *
 * POR QUÉ ES UN ACTA APARTE Y NO UNA COPIA DEL DE LA SUSCRIPCIÓN
 * ----------------------------------------------------------------
 * El acta de la suscripción ya salió del servidor: la Empresa la descargó y
 * tiene su huella. Reescribir ese archivo cambiaría su huella y dejaría sin
 * papel lo que la Empresa conserva. Por eso la contrafirma genera SU acta,
 * que CITA la primera (su fecha y su huella) y deja por escrito los dos actos.
 *
 * LO QUE DICE, Y POR QUÉ NO PUEDE DECIR OTRA COSA
 * ------------------------------------------------
 * Con este acto el instrumento queda EJECUTADO (las dos partes firmaron), y el
 * acta lo dice. Pero el acta dice TAMBIÉN, sin adornos, lo que este mecanismo
 * NO es: no hay certificado digital ni sello de tiempo de un tercero. K+AIR no
 * tiene hoy un proveedor de firma. Lo que hay es una firma electrónica
 * reforzada (código de un solo uso al buzón de K+AIR, verificación documental
 * de quien firmó por la Empresa y rastro inalterable). Un acta que
 * presentara este mecanismo como una firma calificada sería una falsificación
 * —y la falsificación en un documento que se archiva en un expediente es peor
 * que una limitación documentada.
 *
 * @param {object} datos
 * @param {number} datos.id_suscripcion
 * @param {string} datos.id_empresa
 * @param {string} datos.empresa - razón social de la Empresa.
 * @param {string} datos.version - versión del texto canónico.
 * @param {string} datos.hash_texto - huella SHA-256 del texto canónico.
 * @param {string} datos.suscrito_at - ISO 8601 del primer acto.
 * @param {string} [datos.acta_suscripcion_hash] - huella del acta de la fase 1.
 * @param {string} [datos.acta_suscripcion_archivo] - nombre de ese acta.
 * @param {string} [datos.acta_suscripcion_bytes]
 * @param {string} datos.contrafirmado_at - ISO 8601 del segundo acto.
 * @param {string} [datos.canal_codigo] - el buzón al que salió el código.
 * @param {string} [datos.codigo_enviado_at]
 * @param {string} [datos.codigo_verificado_at]
 * @param {string} [datos.actor] - quién hizo el acto en K+AIR.
 * @param {string} [datos.motivo] - por qué.
 * @param {string} [datos.ip]
 * @param {string} [datos.user_agent]
 * @param {object} [datos.verificacion_representante] - la verificación
 *   documental: { tipo_documento, referencia, verificado_por, verificado_at }.
 * @param {object} [datos.facultad_contrafirmante] - la facultad acreditada de
 *   quien contrafirma por Gesstiar (P7, 10-nov-2026).
 * @param {object} [datos.datos_empresa] - los cinco datos del §11.
 * @returns {Promise<{buffer: Buffer, hash: string, bytes: number, filename: string}>}
 */
async function generarActaContrafirma(datos) {
  const d = datos || {};
  const pdfDoc = await PDFDocument.create();
  const c = await _crearLienzo(pdfDoc);
  c.nuevaPagina();

  // ─── Encabezado ───────────────────────────────────────────────────────────
  c.linea('=========================================================================', { color: AZUL, lh: 18 });
  c.linea('ACTA DE CONTRAFIRMA DEL ANEXO DE ENCARGO', { bold: true, size: 15, color: AZUL, lh: 20 });
  c.linea('K+AIR - Gesstiar S.A.S. - NIT 900987987-4 - Colombia', { color: GRIS, lh: 14 });
  c.linea('=========================================================================', { color: AZUL, lh: 22 });

  // ─── Los tres avisos ──────────────────────────────────────────────────────
  c.aviso(
    'FASE 2 DE 2: EL INSTRUMENTO QUEDA EJECUTADO.',
    'El Anexo de Encargo es un contrato bilateral y esta es la segunda de sus dos firmas: '
    + 'la contrafirma de K+AIR como Encargado. Con este acto las dos partes han firmado el '
    + 'texto canónico cuya huella está impresa más abajo, y el instrumento queda ejecutado. '
    + 'Esta acta es la constancia del SEGUNDO acto: el de K+AIR.');
  c.aviso(
    'LO QUE ESTA ACTA NO ES',
    'Esta contrafirma NO es una firma electrónica con certificado digital, y no cuenta con un '
    + 'sello de tiempo de un tercero: K+AIR no tiene hoy un proveedor de firma ni un servicio '
    + 'de sellado de tiempo. Lo que existe es una firma electrónica REFORZADA: un código de un '
    + 'solo uso que sale al buzón de protección de datos de K+AIR, la verificación documental '
    + 'previa de quien firmó por la Empresa, y un rastro inalterable con la fecha, la '
    + 'dirección IP y el navegador de los dos actos. Quien necesite una firma con certificado '
    + 'o un sellado de tiempo de terceros tiene que usar otro mecanismo.');
  c.aviso(
    'ESTA ACTA ES UNA CONSTANCIA, NO LA COPIA FIRMADA',
    'Esta acta es una constancia de la contrafirma. No sustituye la copia firmada del Anexo, '
    + 'que cada parte conserva. El §12 del Anexo de Encargo prevé que la copia firmada la '
    + 'conserve cada parte, y el servicio no la almacena: lo que aquí queda es el documento que '
    + 'K+AIR archiva en el expediente.');

  // ─── 1. El instrumento ─────────────────────────────────────────────────────
  c.seccion('1. El instrumento');
  c.dato('Versión del texto', _texto(d.version, 40), { bold: true });

  const hash = _texto(d.hash_texto, 64);
  c.espacio(34);
  c.pagina.drawText('Huella SHA-256', { x: MARGEN, y: c.y, size: 9.5, font: c.fontBold, color: GRIS });
  if (hash.length === 64) {
    c.pagina.drawText(hash.slice(0, 32), { x: MARGEN + 150, y: c.y, size: 9.5, font: c.fontBold });
    c.pagina.drawText(hash.slice(32), { x: MARGEN + 150, y: c.y - 14, size: 9.5, font: c.fontBold });
    c.avanzar(30);
  } else {
    c.pagina.drawText(hash, { x: MARGEN + 150, y: c.y, size: 9.5, font: c.fontBold });
    c.avanzar(16);
  }
  c.dato('Empresa', _texto(d.empresa, 200), { bold: true });
  c.dato('Id de la suscripción', String(d.id_suscripcion === undefined ? 'N/D' : d.id_suscripcion));

  // ─── 2. El primer acto ────────────────────────────────────────────────────
  c.seccion('2. El primer acto: la suscripcion de la Empresa');
  c.dato('Fecha y hora (ISO 8601)', _texto(d.suscrito_at, 40), { bold: true });
  c.dato('Fecha y hora (local)', _fmtFechaHora(d.suscrito_at));
  c.dato('Acta de la suscripción', _texto(d.acta_suscripcion_archivo, 80));
  c.dato('Huella de ese acta', _texto(d.acta_suscripcion_hash, 64));
  c.dato('Tamaño de ese acta', d.acta_suscripcion_bytes
    ? `${d.acta_suscripcion_bytes} bytes` : 'N/D');

  // ─── 3. El segundo acto ───────────────────────────────────────────────────
  c.seccion('3. El segundo acto: la contrafirma de K+AIR');
  c.dato('Fecha y hora (ISO 8601)', _texto(d.contrafirmado_at, 40), { bold: true });
  c.dato('Fecha y hora (local)', _fmtFechaHora(d.contrafirmado_at));
  c.dato('Código de verificación', 'Verificado (los seis dígitos no se registran en claro)');
  c.dato('Canal del código', d.canal_codigo ? enmascararCorreo(d.canal_codigo) : 'N/D');
  c.dato('Canal del código (fijo)', d.canal_codigo ? 'Sí, lo declara la configuración de K+AIR' : 'N/D');
  c.dato('Código enviado el', _texto(d.codigo_enviado_at, 40));
  c.dato('Código verificado el', _texto(d.codigo_verificado_at, 40));
  c.dato('Hecho por', _texto(d.actor, 120));
  c.dato('Motivo', _texto(d.motivo, 300));
  c.dato('Dirección IP', _texto(d.ip, 64));
  c.dato('Navegador', _texto(d.user_agent, 300));

  // ─── 4. La verificación del representante ──────────────────────────────────
  c.seccion('4. La verificacion de quien firmo por la Empresa');
  const v = d.verificacion_representante || {};
  c.dato('Tipo de documento', _texto(v.tipo_documento, 40));
  c.dato('Referencia del documento', _texto(v.referencia, 300));
  c.dato('Verificado por', _texto(v.verificado_por, 120));
  c.dato('Verificado el', _texto(v.verificado_at, 40));
  c.bloque('Esta verificación es la que le permite a K+AIR contrafirmar: sin ella, el Anexo no se '
    + 'contrafirma. Es la respuesta al punto que el abogado señaló sobre quién es el '
    + 'representante que suscribe.', { size: 8.5, lh: 11 });

  // ─── 5. La facultad de quien contrafirma por K+AIR ─────────────────────────
  c.seccion('5. La facultad de quien contrafirma por K+AIR');
  const fac = d.facultad_contrafirmante || null;
  if (fac) {
    c.dato('Quién contrafirma', _texto(fac.nombre, 200), { bold: true });
    c.dato('Cargo', _texto(fac.cargo, 200));
    c.dato('Con qué facultad', fac.resultado === 'REPRESENTANTE_LEGAL_ENCARGADO'
      ? 'Representante legal de Gesstiar S.A.S.'
      : `Poder acreditado (${_texto(fac.tipo, 40)})`);
    c.dato('Instrumento', _texto(fac.instrumento_ref, 300));
    c.dato('Huella SHA-256 del instrumento', _texto(fac.instrumento_sha256, 64));
    if (fac.vigente_desde || fac.vigente_hasta) {
      c.dato('Vigencia', _texto(fac.vigente_desde, 40) + ' - '
        + (fac.vigente_hasta ? _texto(fac.vigente_hasta, 40) : 'sin término declarado'));
    }
    c.dato('Facultad verificada el', _texto(fac.verificado_at, 40));
  } else {
    c.dato('Facultad acreditada', 'NO DECLARADA');
  }
  c.bloque('La ejecución por una persona distinta del representante legal de Gesstiar S.A.S. exige '
    + 'acreditar previamente la facultad de representación o poder suficiente, que queda '
    + 'conservada en el expediente. Lo que se acredita aquí es la FACULTAD (con qué poder se '
    + 'firmó), no la IDENTIDAD de quien estaba escribiendo: esa identidad descansa en la llave '
    + 'administrativa del servicio y en el nombre que el operador declaró al hacer el acto.',
  { size: 8.5, lh: 11 });

  // ─── 6. Los cinco datos del §11 ───────────────────────────────────────────
  c.seccion('6. Los cinco datos del parrafo 11 declarados por la Empresa');
  const s11 = d.datos_empresa || {};
  c.dato('Razón social', _texto(s11.razon_social, 200));
  c.dato('NIT o C.C.', _texto(s11.nit, 60));
  c.dato('Domicilio', _texto(s11.domicilio, 300));
  c.dato('Correo', _texto(s11.correo, 254));
  c.dato('Representante legal', _texto(s11.representante, 200));

  // ─── 7. Dónde queda el registro ───────────────────────────────────────────
  c.seccion('7. Donde queda el registro');
  c.bloque('Los dos actos quedaron registrados en el servicio de firma electrónica K+AIR, con '
    + 'su rastro inalterable: cada paso (apertura del enlace, envío del código, verificación '
    + 'del código, suscripción, verificación documental del representante, envío del código de '
    + 'contrafirma y contrafirma) queda con fecha, dirección IP y navegador. La suscripción '
    + 'quedó además en la ficha de la Empresa, con el valor anterior, el nuevo, quién la '
    + 'cambió, desde dónde y por qué. Y la contrafirma quedó registrada con la fecha de '
    + 'ejecución del instrumento, que es la que habilita a la Empresa para firmar documentos '
    + 'de sus trabajadores.');

  // ─── Nota sobre la segunda huella ─────────────────────────────────────────
  c.espacio(60);
  c.avanzar(4);
  c.linea('Nota sobre la huella de este acta', { bold: true, size: 9.5, color: GRIS, lh: 14 });
  c.bloque('La huella SHA-256 de este acta (la de sus bytes) no puede imprimirse dentro del '
    + 'propio acta: se calcula sobre los bytes ya generados. Queda registrada con la '
    + 'contrafirma y en la evidencia del manifiesto legal. Quien reciba este documento y '
    + 'quiera verificarlo, lo contrasta contra ese registro. El acta de la suscripción de la '
    + 'Empresa, que es otro documento, conserva la suya propia.', { size: 8.5, lh: 11 });

  // ─── Pie ───────────────────────────────────────────────────────────────────
  const totalPaginas = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((p, i) => {
    p.drawText('Acta de contrafirma del Anexo de Encargo - K+AIR - Gesstiar S.A.S.', {
      x: MARGEN, y: 40, size: 8, font: c.font, color: GRIS,
    });
    p.drawText(`Página ${i + 1} de ${totalPaginas}`, {
      x: PAGINA_ANCHO - MARGEN - 80, y: 40, size: 8, font: c.font, color: GRIS,
    });
  });

  const bytes = await pdfDoc.save();
  const buffer = Buffer.from(bytes);
  return {
    buffer: buffer,
    hash: _sha256(buffer),
    bytes: buffer.length,
    filename: nombreActaContrafirma(d.id_suscripcion),
  };
}

module.exports = {
  enmascararCorreo,
  nombreActa,
  nombreActaContrafirma,
  rutaActa,
  guardarActa,
  leerActa,
  generarActa,
  generarActaContrafirma,
};
