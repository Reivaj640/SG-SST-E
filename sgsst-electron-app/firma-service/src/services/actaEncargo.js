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
async function generarActa(datos) {
  const d = datos || {};
  const pdfDoc = await PDFDocument.create();
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

  nuevaPagina();

  // ─── Encabezado ───────────────────────────────────────────────────────────
  linea('=========================================================================', { color: AZUL, lh: 18 });
  linea('ACTA DE SUSCRIPCIÓN DEL ANEXO DE ENCARGO', { bold: true, size: 15, color: AZUL, lh: 20 });
  linea('K+AIR - Gesstiar S.A.S. - NIT 900987987-4 - Colombia', { color: GRIS, lh: 14 });
  linea('=========================================================================', { color: AZUL, lh: 22 });

  // ─── El aviso de las dos fases ────────────────────────────────────────────
  aviso(
    'FASE 1 DE 2: LA EMPRESA SE SUSCRIBIÓ. EL INSTRUMENTO NO ESTÁ EJECUTADO.',
    'El Anexo de Encargo es un contrato bilateral: esta acta deja constancia de que la '
    + 'Empresa se suscribió al texto canónico cuya huella está impresa más abajo. La '
    + 'contrafirma de K+AIR como Encargado es OTRO acto, posterior a este, y se registra '
    + 'por separado. Mientras no exista esa contrafirma, el contrato NO está ejecutado y '
    + 'esta acta NO lo declara firmado.');
  aviso(
    'ESTA ACTA ES UNA CONSTANCIA, NO LA COPIA FIRMADA',
    'Esta acta es una constancia de la suscripción. No sustituye la copia firmada '
    + 'del Anexo, que cada parte conserva. El §12 del Anexo de Encargo prevé que la '
    + 'copia firmada la conserve cada parte, y el servicio no la almacena: lo que '
    + 'aquí queda es el documento que K+AIR archiva en el expediente y que la Empresa '
    + 'puede descargar.');
  aviso(
    'LA DECLARACIÓN DE LA EMPRESA',
    'La Empresa declara que leyó el texto canónico del Anexo de Encargo en la versión '
    + 'indicada, con la huella indicada, que aceptó sus condiciones en nombre propio, que '
    + 'declaró los cinco datos del párrafo 11 que se imprimen más abajo, que declaró el '
    + 'documento y la calidad de quien suscribe, que verificó su identidad con el código '
    + 'de verificación recibido en un canal distinto al del enlace, y que acepta el '
    + 'mecanismo electrónico por el que se suscribe este Anexo.');

  // ─── 1. El instrumento ─────────────────────────────────────────────────────
  seccion('1. El instrumento suscrito');
  dato('Versión del texto', _texto(d.version, 40), { bold: true });

  // La huella va PARTIDA en dos renglones, con su etiqueta: los 64
  // caracteres no caben en la columna de los valores, y una huella partida a
  // mano se presta para que alguien la lea mal (o la recorte mal).
  const hash = _texto(d.hash_texto, 64);
  espacio(34);
  page.drawText('Huella SHA-256', { x: MARGEN, y: y, size: 9.5, font: fontBold, color: GRIS });
  if (hash.length === 64) {
    page.drawText(hash.slice(0, 32), { x: MARGEN + 150, y: y, size: 9.5, font: fontBold });
    page.drawText(hash.slice(32), { x: MARGEN + 150, y: y - 14, size: 9.5, font: fontBold });
    y -= 30;
  } else {
    page.drawText(hash, { x: MARGEN + 150, y: y, size: 9.5, font: fontBold });
    y -= 16;
  }
  dato('Empresa', _texto(d.empresa, 200), { bold: true });

  // ─── 2. La suscripción ─────────────────────────────────────────────────────
  seccion('2. La suscripción');
  dato('Fecha y hora (ISO 8601)', _texto(d.firmado_at, 40), { bold: true });
  dato('Fecha y hora (local)', _fmtFechaHora(d.firmado_at));
  dato('Id de la suscripción', String(d.id_suscripcion === undefined ? 'N/D' : d.id_suscripcion));
  dato('Firmante', _texto(d.nombre_firmante, 200));
  dato('Cargo', _texto(d.cargo_firmante, 200));
  dato('Correo del firmante', enmascararCorreo(d.correo_firmante));
  dato('Enlace abierto el', _texto(d.enlace_abierto_at, 40));

  // ─── 3. Los cinco datos del §11 ───────────────────────────────────────────
  seccion('3. Los cinco datos del parrafo 11 declarados por la Empresa');
  const s11 = d.datos_empresa || {};
  dato('Razón social', _texto(s11.razon_social, 200));
  dato('NIT o C.C.', _texto(s11.nit, 60));
  dato('Domicilio', _texto(s11.domicilio, 300));
  dato('Correo', _texto(s11.correo, 254));
  dato('Representante legal', _texto(s11.representante, 200));

  // ─── 4. Quién firmó ─────────────────────────────────────────────────────
  // El documento va con su final nada más: el número completo está cifrado en
  // el registro, y un acta es un documento que la Empresa puede compartir con
  // quien quiera.
  seccion('4. Quien firmó');
  dato('Nombre', _texto(d.representante_nombre, 200));
  dato('Documento', _texto(d.representante_documento, 60));
  dato('Calidad', _texto(d.representante_calidad, 40));
  bloque('La verificación documental de esa representación (contra el certificado de '
    + 'existencia y representación de la cámara de comercio, contra el RUT de la Empresa '
    + 'o contra el poder, según la calidad) la hace K+AIR después de esta suscripción, '
    + 'y queda registrada en el expediente. K+AIR no contrafirma el Anexo sin esa '
    + 'verificación: es la contrafirma la que la deja por escrito.', { size: 8.5, lh: 11 });

  // ─── 5. La verificación ────────────────────────────────────────────────────
  seccion('5. La verificación');
  dato('Código de verificación', 'Verificado (los seis dígitos no se registran en claro)');
  dato('Canal del código', d.canal_codigo ? enmascararCorreo(d.canal_codigo) : 'N/D');
  dato('Distinto del buzón del enlace', d.canal_codigo ? 'Sí' : 'N/D');
  dato('Código enviado el', _texto(d.codigo_enviado_at, 40));
  dato('Código verificado el', _texto(d.codigo_verificado_at, 40));
  dato('Dirección IP', _texto(d.ip, 64));
  dato('Navegador', _texto(d.user_agent, 300));

  // ─── 6. Lo que la Empresa aceptó ──────────────────────────────────────────
  // El acta imprime las PALABRAS que la Empresa marcó, con su huella. Es la
  // diferencia entre un acta que dice "aceptó" y un acta que prueba qué se
  // aceptó.
  seccion('6. Lo que la Empresa aceptó');
  if (d.texto_mecanismo) {
    bloque(d.texto_mecanismo, { size: 8.5, lh: 11 });
    y -= 4;
  }
  if (d.texto_declaracion) {
    bloque(d.texto_declaracion, { size: 8.5, lh: 11 });
    y -= 4;
  }
  if (d.texto_tratamiento) {
    bloque(d.texto_tratamiento, { size: 8.5, lh: 11 });
    y -= 4;
  }
  dato('Huella del texto aceptado', _texto(d.aceptacion_hash, 64));
  dato('Huella del texto de datos', _texto(d.aceptacion_tratamiento_hash, 64));

  // ─── 7. El registro ────────────────────────────────────────────────────────
  seccion('7. Dónde queda el registro');
  bloque('La suscripción quedó registrada en el servicio de firma electrónica K+AIR, con su '
    + 'rastro inalterable: cada paso (apertura del enlace, envío del código, verificación y '
    + 'suscripción) queda con fecha, dirección IP y navegador. La suscripción quedó además '
    + 'en la ficha de la Empresa, con el valor anterior, el nuevo, quién la cambió, desde '
    + 'dónde y por qué. Esa fecha de la ficha dice SUSCRIPCIÓN, no firma: el Anexo de '
    + 'Encargo es bilateral y el instrumento queda ejecutado solo cuando K+AIR también '
    + 'firma, en un segundo acto que se registra por separado.');

  // ─── Nota sobre la segunda huella ─────────────────────────────────────────
  espacio(60);
  y -= 4;
  linea('Nota sobre la huella de este acta', { bold: true, size: 9.5, color: GRIS, lh: 14 });
  bloque('La huella SHA-256 de este acta (la de sus bytes) no puede imprimirse dentro del '
    + 'propio acta: se calcula sobre los bytes ya generados. Queda registrada con la '
    + 'suscripción y en la evidencia del manifiesto legal. Quien reciba este documento y '
    + 'quiera verificarlo, lo contrasta contra ese registro.', { size: 8.5, lh: 11 });

  // ─── Pie ───────────────────────────────────────────────────────────────────
  const totalPaginas = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((p, i) => {
    p.drawText('Acta de suscripción del Anexo de Encargo - K+AIR - Gesstiar S.A.S.', {
      x: MARGEN, y: 40, size: 8, font: font, color: GRIS,
    });
    p.drawText(`Página ${i + 1} de ${totalPaginas}`, {
      x: PAGINA_ANCHO - MARGEN - 80, y: 40, size: 8, font: font, color: GRIS,
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

module.exports = {
  enmascararCorreo,
  nombreActa,
  rutaActa,
  guardarActa,
  leerActa,
  generarActa,
};
