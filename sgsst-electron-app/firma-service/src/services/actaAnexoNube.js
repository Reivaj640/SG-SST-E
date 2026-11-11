/**
 * EL ACTA DE LA CONTRAFIRMA DEL ANEXO DE NUBE
 * ============================================================================
 *
 * QUÉ ES
 * ------
 * El documento que deja constancia del SEGUNDO ACTO del Anexo de Nube: la
 * contrafirma de K+AIR. Es la misma forma que el acta del Anexo de Encargo
 * (un PDF con QUIÉN firmó, QUÉ firmó, CUÁNDO, CÓMO se verificó y con
 * QUÉ huella), y por eso devuelve lo mismo: el buffer, su huella SHA-256
 * sobre los bytes, su tamaño y el nombre del archivo.
 *
 * POR QUÉ ES UN ARCHIVO APARTE Y NO UN REUSO DEL DEL ENCARGO
 * -----------------------------------------------------------
 * El acta del Anexo de Encargo (`services/actaEncargo.js`) cita el acta de
 * la suscripcion, los cinco datos del parrafo 11 y la verificacion documental
 * del representante. El Anexo de Nube no tiene nada de eso: su suscripcion no
 * deja PDF (la constancia de la Empresa es la pantalla) y sus datos son los
 * de la ficha. Reusar el acta del Encargo tal cual seria un acta que fala de
 * documentos que no existen en este expediente.
 *
 * LO QUE DICE Y LO QUE NO DICE
 * ----------------------------
 * El acta deja por escrito que con este acto el instrumento queda EJECUTADO
 * (las dos partes actuaron) y, sin adornos, que esto NO es una firma
 * electronica con certificado digital ni tiene sello de tiempo de un tercero:
 * K+AIR no tiene hoy proveedor de firma. Un acta que presentara este
 * mecanismo como una firma calificada seria una falsificacion.
 *
 * LAS DOS HUELLAS, Y QUE NO SE CONFUNDAN
 * --------------------------------------
 *  - La HUELLA CANONICA (la del texto del Anexo) se imprime: es lo que liga
 *    el acta con el instrumento.
 *  - La HUELLA DEL ACTA (la de sus bytes) NO puede imprimirse dentro del
 *    acta: se calcula sobre los bytes ya generados. Queda registrada con la
 *    contrafirma, en la suscripcion, y se contrasta contra esa.
 *
 * EL CODIGO NO SE IMPRIME
 * -----------------------
 * Lo que se registra es QUE se verifico y CUANDO, nunca los seis digitos: el
 * codigo es un secreto con caducidad y el servicio no lo guarda en claro en
 * ningun sitio.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const storage = require('./storage');
// La funcion de enmascarar se TOMA del acta del Anexo de Encargo: el correo
// que ve la Empresa en la pantalla y el que imprime el acta tienen que ser
// el mismo. Si difieren, el registro deja de cuadrar con lo que se leyo.
const { enmascararCorreo } = require('./actaEncargo');

// --- Medidas de la pagina --------------------------------------------------
const PAGINA_ANCHO = 612;
const PAGINA_ALTO = 792;
const MARGEN = 56;
const Y_INICIAL = 720;
const Y_MINIMO = 78;

// --- Colores (los mismos de la pagina de sello: src/services/pdfGen.js) ----
const AZUL = rgb(0.09, 0.31, 0.65);
const GRIS = rgb(0.35, 0.35, 0.35);
const NEGRO = rgb(0, 0, 0);
const AVISO_FONDO = rgb(1, 0.97, 0.89);
const AVISO_BORDE = rgb(0.79, 0.63, 0.11);

/**
 * La huella SHA-256 de un buffer.
 *
 * @param {Buffer} buf
 * @returns {string}
 */
function _sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Un texto, acotado. Lo que no llega se marca como 'N/D' (no como vacio):
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
 * ISO -> 'DD/MM/YYYY, HH:mm:ss' (hora local del servidor).
 * La precision legal la da el ISO crudo, que tambien se imprime.
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
 * Parte un texto en lineas que quepan en un ancho dado.
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

/**
 * El nombre del archivo del acta de contrafirma.
 *
 * Sale del id de la suscripcion (un entero de la base), nunca de lo que
 * escribio la Empresa: el nombre no se puede usar para escribir fuera de la
 * carpeta.
 *
 * @param {number} id_suscripcion
 * @returns {string}
 */
function nombreActaContrafirma(id_suscripcion) {
  return `acta-${Number(id_suscripcion)}-contrafirma-anexo-nube.pdf`;
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
 * Escribe el acta en disco, con fsync: si el proceso se muere a mitad de la
 * escritura, el archivo no queda truncado en silencio.
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
 * Lee el acta del disco, si esta.
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

/**
 * EL LIENZO DEL ACTA: las herramientas de dibujo.
 *
 * El maquetado vive aqui, en un solo lugar, y el acta lo usa entero: un
 * acta con dos tipos de letra o dos margenes se ve como un documento mal
 * hecho.
 *
 * @param {object} pdfDoc - el documento de pdf-lib ya creado.
 * @returns {Promise<object>} las herramientas y el estado de la pagina.
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

  /** Asegura que queda espacio; si no, abre pagina. */
  function espacio(alto) {
    if (!page || y - alto < Y_MINIMO) nuevaPagina();
  }

  /** Una linea de texto. */
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

  /** El titulo de una seccion. */
  function seccion(titulo) {
    // Deja sitio para el titulo y para varias filas: si no cabe, la seccion
    // empieza en la pagina siguiente. Una seccion partida a la mitad se ve
    // como un documento mal hecho.
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
    /** La pagina actual (para dibujar encima de algo puntual). */
    get pagina() { return page; },
    /** La linea donde se esta escribiendo. */
    get y() { return y; },
    /** Baja la linea sin escribir nada (un hueco). */
    avanzar(cantidad) { y -= cantidad; },
  };
}

/**
 * EL ACTA DE LA CONTRAFIRMA DEL ANEXO DE NUBE
 * ==========================================
 *
 * @param {object} datos
 * @param {number} datos.id_suscripcion
 * @param {string} datos.id_empresa
 * @param {string} datos.empresa - razon social de la Empresa.
 * @param {string} datos.version - version del texto canonico.
 * @param {string} datos.hash_texto - huella SHA-256 del texto canonico.
 * @param {string} datos.suscrito_at - ISO 8601 del primer acto.
 * @param {string} [datos.nombre_firmante]
 * @param {string} [datos.cargo_firmante]
 * @param {string} [datos.correo_firmante] - el correo COMPLETO (aqui se enmascara).
 * @param {string} [datos.codigo_enviado_at] - cuando salio el codigo de suscripcion.
 * @param {string} [datos.codigo_verificado_at] - cuando se verifico ese codigo.
 * @param {string} [datos.ip_suscripcion]
 * @param {string} [datos.user_agent_suscripcion]
 * @param {string} datos.contrafirmado_at - ISO 8601 del segundo acto.
 * @param {string} [datos.canal_codigo] - el buzon al que salio el codigo.
 * @param {string} [datos.contrafirma_codigo_enviado_at]
 * @param {string} [datos.contrafirma_codigo_verificado_at]
 * @param {string} [datos.actor] - quien hizo el acto en K+AIR.
 * @param {string} [datos.motivo] - por que.
 * @param {string} [datos.ip]
 * @param {string} [datos.user_agent]
 * @param {string} [datos.representante_legal_ficha] - el representante legal
 *   que consta en la ficha de la Empresa.
 * @param {string} [datos.verificacion_firmante] - como se cotejo el firmante.
 * @returns {Promise<{buffer: Buffer, hash: string, bytes: number, filename: string}>}
 */
async function generarActaContrafirma(datos) {
  const d = datos || {};
  const pdfDoc = await PDFDocument.create();
  const c = await _crearLienzo(pdfDoc);
  c.nuevaPagina();

  // --- Encabezado -----------------------------------------------------------
  c.linea('=========================================================================', { color: AZUL, lh: 18 });
  c.linea('ACTA DE CONTRAFIRMA DEL ANEXO DE NUBE', { bold: true, size: 15, color: AZUL, lh: 20 });
  c.linea('K+AIR - Gesstiar S.A.S. - NIT 900987987-4 - Colombia', { color: GRIS, lh: 14 });
  c.linea('=========================================================================', { color: AZUL, lh: 22 });

  // --- Los tres avisos ------------------------------------------------------
  c.aviso(
    'SEGUNDO ACTO DE 2: EL INSTRUMENTO QUEDA EJECUTADO.',
    'El Anexo de Nube es un instrumento bilateral: este es el segundo de sus dos actos, la '
    + 'contrafirma de K+AIR. Con este acto las dos partes han actuado sobre el texto canonico '
    + 'cuya huella esta impresa mas abajo, y el instrumento queda ejecutado para esa Empresa. '
    + 'Esta acta es la constancia del SEGUNDO acto: el de K+AIR.');
  c.aviso(
    'LO QUE ESTA ACTA NO ES',
    'Esta contrafirma NO es una firma electronica con certificado digital, y no cuenta con un '
    + 'sello de tiempo de un tercero: K+AIR no tiene hoy un proveedor de firma ni un servicio '
    + 'de sellado de tiempo. Lo que existe es una firma electronica REFORZADA: un codigo de un '
    + 'solo uso que sale al buzon de proteccion de datos de K+AIR, el cotejo de quien firmo por '
    + 'la Empresa contra la ficha de esa Empresa, y un rastro inalterable con la fecha, la '
    + 'direccion IP y el navegador de los dos actos. Quien necesite una firma con certificado '
    + 'o un sellado de tiempo de terceros tiene que usar otro mecanismo.');
  c.aviso(
    'ESTA ACTA ES UNA CONSTANCIA, NO LA COPIA FIRMADA',
    'Esta acta es una constancia de la contrafirma. No sustituye la copia firmada del Anexo, '
    + 'que cada parte conserva. El servicio no almacena la copia firmada de la Empresa: lo que '
    + 'queda aqui es el documento que K+AIR archiva en el expediente.');

  // --- 1. El instrumento -----------------------------------------------------
  c.seccion('1. El instrumento');
  c.dato('Version del texto', _texto(d.version, 40), { bold: true });

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
  c.dato('Id de la suscripcion', String(d.id_suscripcion === undefined ? 'N/D' : d.id_suscripcion));

  // --- 2. El primer acto ----------------------------------------------------
  c.seccion('2. El primer acto: la suscripcion de la Empresa');
  c.dato('Fecha y hora (ISO 8601)', _texto(d.suscrito_at, 40), { bold: true });
  c.dato('Fecha y hora (local)', _fmtFechaHora(d.suscrito_at));
  c.dato('Firmante por la Empresa', _texto(d.nombre_firmante, 200));
  c.dato('Cargo del firmante', _texto(d.cargo_firmante, 200));
  c.dato('Correo del firmante', d.correo_firmante ? enmascararCorreo(d.correo_firmante) : 'N/D');
  c.dato('Codigo enviado el', _texto(d.codigo_enviado_at, 40));
  c.dato('Codigo verificado el', _texto(d.codigo_verificado_at, 40));
  c.dato('Direccion IP', _texto(d.ip_suscripcion, 64));
  c.dato('Navegador', _texto(d.user_agent_suscripcion, 300));

  // --- 3. El segundo acto ---------------------------------------------------
  c.seccion('3. El segundo acto: la contrafirma de K+AIR');
  c.dato('Fecha y hora (ISO 8601)', _texto(d.contrafirmado_at, 40), { bold: true });
  c.dato('Fecha y hora (local)', _fmtFechaHora(d.contrafirmado_at));
  c.dato('Codigo de verificacion', 'Verificado (los seis digitos no se registran en claro)');
  c.dato('Canal del codigo', d.canal_codigo ? enmascararCorreo(d.canal_codigo) : 'N/D');
  c.dato('Canal del codigo (fijo)', d.canal_codigo ? 'Si, lo declara la configuracion de K+AIR' : 'N/D');
  c.dato('Codigo enviado el', _texto(d.contrafirma_codigo_enviado_at, 40));
  c.dato('Codigo verificado el', _texto(d.contrafirma_codigo_verificado_at, 40));
  c.dato('Hecho por', _texto(d.actor, 120));
  c.dato('Motivo', _texto(d.motivo, 300));
  c.dato('Direccion IP', _texto(d.ip, 64));
  c.dato('Navegador', _texto(d.user_agent, 300));

  // --- 4. Quien firmo por la Empresa ---------------------------------------
  c.seccion('4. Quien firmo por la Empresa');
  c.dato('Firmante declarado', _texto(d.nombre_firmante, 200));
  c.dato('Cargo declarado', _texto(d.cargo_firmante, 200));
  c.dato('Representante legal de la ficha', _texto(d.representante_legal_ficha, 200));
  c.dato('Cotejo', _texto(d.verificacion_firmante, 300));
  c.bloque('Este cotejo es el que le permite a K+AIR contrafirmar: sin saber quien firmo por la '
    + 'Empresa, la contrafirma no se hace. El texto vigente del Anexo de Nube (parrafo 10) exige '
    + 'verificar quien firmo por la Empresa ANTES de contrafirmar.', { size: 8.5, lh: 11 });

  // --- 5. La facultad de quien contrafirma ---------------------------------
  c.seccion('5. La facultad de quien contrafirma por K+AIR');
  const fac = d.facultad_contrafirmante || null;
  if (fac) {
    c.dato('Quien contrafirma', _texto(fac.nombre, 200), { bold: true });
    c.dato('Cargo', _texto(fac.cargo, 200));
    c.dato('Con que facultad', fac.resultado === 'REPRESENTANTE_LEGAL_ENCARGADO'
      ? 'Representante legal de Gesstiar S.A.S.'
      : 'Poder acreditado (' + _texto(fac.tipo, 40) + ')');
    c.dato('Instrumento', _texto(fac.instrumento_ref, 300));
    c.dato('Huella SHA-256 del instrumento', _texto(fac.instrumento_sha256, 64));
    if (fac.vigente_desde || fac.vigente_hasta) {
      c.dato('Vigencia', _texto(fac.vigente_desde, 40)
        + ' - ' + (fac.vigente_hasta ? _texto(fac.vigente_hasta, 40) : 'sin termino declarado'));
    }
    c.dato('Facultad verificada el', _texto(fac.verificado_at, 40));
  } else {
    c.dato('Facultad acreditada', 'NO DECLARADA');
  }
  c.bloque('La ejecucion por una persona distinta del representante legal de Gesstiar '
    + 'S.A.S. exige acreditar previamente la facultad de representacion o poder '
    + 'suficiente, que queda conservada en el expediente. Lo que se acredita aqui es la '
    + 'FACULTAD (con que poder se firmo), no la IDENTIDAD de quien estaba escribiendo: esa '
    + 'identidad descansa en la llave administrativa del servicio y en el nombre que el '
    + 'operador declaro al hacer el acto.', { size: 8.5, lh: 11 });

  // --- 6. Donde queda el registro ------------------------------------------
  c.seccion('6. Donde queda el registro');
  c.bloque('Los dos actos quedaron registrados en el servicio de firma electronica K+AIR, con su '
    + 'rastro inalterable: cada paso (apertura del enlace, envio del codigo, verificacion del '
    + 'codigo, suscripcion de la Empresa, envio del codigo de contrafirma y contrafirma) queda con '
    + 'fecha, direccion IP y navegador. La suscripcion quedo ademas en la ficha de la Empresa, '
    + 'con el valor anterior, el nuevo, quien la cambio, desde donde y por que. Y la contrafirma '
    + 'quedo registrada con la fecha de ejecucion del instrumento (anexo_nube_ejecutado_at), que '
    + 'es la que, con la suscripcion, deja el Anexo de Nube ejecutado para esa Empresa.');

  // --- Nota sobre la segunda huella ----------------------------------------
  c.espacio(60);
  c.avanzar(4);
  c.linea('Nota sobre la huella de este acta', { bold: true, size: 9.5, color: GRIS, lh: 14 });
  c.bloque('La huella SHA-256 de este acta (la de sus bytes) no puede imprimirse dentro del '
    + 'propio acta: se calcula sobre los bytes ya generados. Queda registrada con la '
    + 'contrafirma, en la suscripcion. Quien reciba este documento y quiera verificarlo, lo '
    + 'contrasta contra ese registro.', { size: 8.5, lh: 11 });

  // --- Pie ------------------------------------------------------------------
  const totalPaginas = pdfDoc.getPageCount();
  pdfDoc.getPages().forEach((p, i) => {
    p.drawText('Acta de contrafirma del Anexo de Nube - K+AIR - Gesstiar S.A.S.', {
      x: MARGEN, y: 40, size: 8, font: c.font, color: GRIS,
    });
    p.drawText(`Pagina ${i + 1} de ${totalPaginas}`, {
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
  nombreActaContrafirma,
  rutaActa,
  guardarActa,
  leerActa,
  generarActaContrafirma,
};
