'use strict';
/**
 * main/gh-render-plantilla.js — 📦GPE · Aplica los datos editados al PDF de la
 * plantilla y deja el archivo listo para exportar y para firmar.
 *
 * POR QUE SUPERPONER Y NO REEMPLAZAR: las plantillas que sube la empresa son
 * formularios en blanco y sus textos estan escritos con fuentes CID
 * (Identity-H): el texto dentro del PDF no son letras, son CODIGOS de glifo.
 * Parchear ese texto es imposible sin la tabla de conversion. Lo que SI se
 * puede es saber DONDE esta cada etiqueta (pdf.js lee la capa de texto y da
 * la posicion exacta) y escribir el valor ENCIMA, al lado de la etiqueta.
 *
 * EL CONTRATO DE ESTE MODULO:
 *   1 ·Ubica la etiqueta en la capa de texto del PDF (pdf.js).
 *   2 · Dibuja el valor al lado, con la fuente del formulario (pdf-lib).
 *   3 · VERIFICA: vuelve a leer el PDF resultante y comprueba que el valor
 *       quedo dentro. Un valor que no se verifico se REPORTA, no se oculta.
 *   4 · Para los reemplazos de texto libre, tapa el texto viejo y escribe el
 *       nuevo en su lugar.
 *
 * SIEMPRE SE RENDERIZA DESDE LA PLANTILLA ORIGINAL, nunca desde el archivo ya
 * renderizado: si se renderizara encima, cada guardado pondria los valores
 * dos veces.
 */

var fs = require('fs');
var path = require('path');
var { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
var campos = require('./gh-plantilla-campos');

// ── pdf.js (se carga una vez) ──────────────────────────────────────────────
var _pdfjs = null;
async function _pdfjsLib() {
  if (_pdfjs) return _pdfjs;
  var ruta = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
  try {
    _pdfjs = require(ruta);
  } catch (e) {
    // Node viejo: import dinamico
    _pdfjs = await import('file:///' + ruta.replace(/\\/g, '/'));
  }
  return _pdfjs;
}

// ── fuentes estandar de pdf.js ─────────────────────────────────────────────
// pdf.js necesita los datos de las 14 fuentes estandar (Helvetica, Times...)
// para leer bien lo que el motor escribe encima de la plantilla. Sin esto
// avisa por consola y la lectura del PDF resultante puede no dar el texto
// exacto (y un valor bien puesto se reportaria como no verificado).
var _fuentesEstandar = null;
function _rutaFuentesEstandar() {
  if (_fuentesEstandar !== null) return _fuentesEstandar;
  try {
    var dir = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'standard_fonts');
    // pdf.js exige que la ruta termine en '/' (si no, el mismo pdf.js avisa)
    _fuentesEstandar = fs.existsSync(dir) ? dir + '/' : '';
  } catch (e) {
    _fuentesEstandar = '';
  }
  return _fuentesEstandar;
}

function _opcionesPdfJs(data) {
  var o = {
    data: data,
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true
  };
  var fuentes = _rutaFuentesEstandar();
  if (fuentes) o.standardFontDataUrl = fuentes;
  return o;
}

// ── utilidades ─────────────────────────────────────────────────────────────
function _colapsar(s) {
  return campos.normalizar(s);
}

function _sanear(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\u0020-\u00FF]/g, '?')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── busqueda de una frase dentro de un texto ───────────────────────────────
/**
 * Devuelve el rango CRUDO (indice inicial y final) de la frase buscada dentro
 * de un texto, o null si no esta. La comparacion ignora mayusculas y tildes,
 * pero el rango sale en las posiciones REALES: asi se puede tapar SOLO la
 * frase y no toda la linea (en un contrato, borrar la linea es perder texto).
 */
function _plano(texto) {
  var txt = '';
  var mapa = [];
  var s = String(texto == null ? '' : texto);
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    var n = (c === ' ' || c === '\t' || c === '\u00A0') ? ' ' : _colapsar(c);
    if (!n) n = ' '; // la puntuacion cuenta como separador
    if (n === ' ' && txt.charAt(txt.length - 1) === ' ') continue; // no repetir espacios
    txt += n;
    mapa.push(i);
  }
  return { txt: txt, mapa: mapa };
}

function _rangoDe(texto, buscar) {
  var plano = _plano(texto);
  var pat = _plano(buscar).txt;
  if (!pat) return null;
  var pos = plano.txt.indexOf(pat);
  if (pos < 0) return null;
  return { ini: plano.mapa[pos], fin: plano.mapa[pos + pat.length - 1] + 1 };
}

// ── lectura de la capa de texto ────────────────────────────────────────────
/**
 * Devuelve las lineas de texto de una pagina con la posicion de cada trozo.
 * COORDENADAS: pdf.js entrega la linea base (transform[5]) medida desde ABAJO
 * (origen abajo-izquierda) y pdf-lib dibuja en el mismo sistema: el y se usa
 * TAL CUAL, sin invertir. (Invertirlo mandaba los valores a otra parte de la
 * pagina.) Las lineas quedan ordenadas de ARRIBA hacia ABAJO, que es el orden
 * de lectura de un formulario.
 */
async function _lineasDe(pdfjs, doc, numPagina) {
  var page = await doc.getPage(numPagina);
  var viewport = page.getViewport({ scale: 1 });
  var tc = await page.getTextContent();
  var items = (tc.items || []).filter(function (it) { return it.str && it.str.trim().length; });

  var porY = {};
  items.forEach(function (it) {
    var y = Math.round(it.transform[5] * 2) / 2;
    if (!porY[y]) porY[y] = [];
    porY[y].push({
      x: it.transform[4],
      w: it.width || 0,
      h: it.height || 0,
      str: it.str
    });
  });

  var lineas = [];
  Object.keys(porY).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) {
    var arr = porY[y].sort(function (a, b) { return a.x - b.x; });
    var texto = '';
    // los trozos se unen con espacio: una etiqueta partida en varios trozos
    // ("SALARIO" + "MENSUAL:") tiene que poder compararse con "SALARIO MENSUAL"
    arr.forEach(function (it) { it.ini = texto.length; texto += (texto ? ' ' : '') + it.str; it.fin = texto.length; });
    lineas.push({ y: y, texto: texto, items: arr });
  });
  return { lineas: lineas, viewport: viewport };
}

/**
 * Busca la etiqueta en las lineas y devuelve donde termina (para el valor).
 *
 * Gana la coincidencia MAS FUERTE, no la primera que aparece. Un campo de
 * formulario es una linea CORTA que TERMINA en la etiqueta ("SEDE:"); una
 * clausula del cuerpo que menciona la palabra ("... el SALARIO MENSUAL
 * pactado.") no lo es. La puntuacion:
 *   +4 · la linea termina con la etiqueta
 *   +2 · la linea empieza con la etiqueta
 *   +2 · la linea es corta (etiqueta + hasta 24 caracteres)
 * Las lineas llegan de arriba hacia abajo: a igual puntuacion gana la de mas
 * arriba. Dentro de la linea, el valor se pone al final del item que completa
 * la etiqueta.
 */
function _ubicar(lineas, etiqueta) {
  var etNorm = _colapsar(etiqueta);
  if (!etNorm) return null;

  var mejor = null;
  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i];
    var ln = _colapsar(linea.texto);
    if (ln.indexOf(etNorm) < 0) continue;

    var puntaje = 0;
    if (ln.length >= etNorm.length && ln.slice(-etNorm.length) === etNorm) puntaje += 4;
    if (ln.indexOf(etNorm) === 0) puntaje += 2;
    if (ln.length <= etNorm.length + 24) puntaje += 2;

    if (!mejor || puntaje > mejor.puntaje) mejor = { linea: linea, puntaje: puntaje };
  }
  if (!mejor) return null;

  var lineaElegida = mejor.linea;
  // primer item que completa la etiqueta
  var acum = '';
  for (var j = 0; j < lineaElegida.items.length; j++) {
    var it = lineaElegida.items[j];
    acum += ' ' + it.str;
    if (_colapsar(acum).indexOf(etNorm) >= 0) {
      return {
        linea: lineaElegida,
        item: it,
        x: it.x + it.w,
        y: lineaElegida.y,
        size: it.h || 10,
        puntaje: mejor.puntaje
      };
    }
  }
  // no se pudo precisar el item: se usa el fin de la linea
  var ultimo = lineaElegida.items[lineaElegida.items.length - 1];
  return {
    linea: lineaElegida,
    item: ultimo,
    x: ultimo.x + ultimo.w,
    y: lineaElegida.y,
    size: ultimo.h || 10,
    puntaje: mejor.puntaje
  };
}

// ── motor ──────────────────────────────────────────────────────────────────
/**
 * Aplica los datos editados a la plantilla.
 *
 * @param {object} opts
 *   bytesPlantilla  Buffer del PDF de la plantilla (ORIGINAL, sin renderizar)
 *   tipoDocumento    tipo del documento (para el mapa de etiquetas)
 *   datosEditados   { valores: {...}, reemplazos: [...] }
 * @returns {object} { ok, aplicados, faltantes, reemplazos, verificados, sinVerificar, mensaje }
 */
async function aplicarDatos(opts) {
  var bytes = opts.bytesPlantilla;
  var tipo = opts.tipoDocumento || 'contrato';
  var de = opts.datosEditados || {};
  var valores = de.valores || {};
  var reemplazos = de.reemplazos || [];

  var resultado = {
    ok: false,
    aplicados: [],
    faltantes: [],
    reemplazos: [],
    verificados: [],
    sinVerificar: [],
    mensaje: ''
  };

  var claves = Object.keys(valores).filter(function (k) {
    return String(valores[k] == null ? '' : valores[k]).trim().length > 0;
  });
  if (!claves.length && !reemplazos.length) {
    resultado.ok = true;
    resultado.mensaje = 'No hay datos editados que aplicar.';
    return resultado;
  }

  var pdfjs = await _pdfjsLib();

  // ── 1 · leer la plantilla ────────────────────────────────────────────────
  var docLectura = await pdfjs.getDocument(_opcionesPdfJs(new Uint8Array(bytes))).promise;

  var lineasPorPagina = [];
  for (var p = 1; p <= docLectura.numPages; p++) {
    lineasPorPagina.push(await _lineasDe(pdfjs, docLectura, p));
  }

  // ── 2 · ubicar cada valor ────────────────────────────────────────────────
  var located = [];
  claves.forEach(function (clave) {
    var candidatas = campos.etiquetasDe(tipo, clave);
    if (!candidatas.length) {
      resultado.faltantes.push({ clave: clave, etiqueta: null, motivo: 'sin etiqueta en el mapa' });
      return;
    }
    var hallada = null;
    var probada = null;
    var mejorPuntaje = -1;
    for (var pi = 0; pi < lineasPorPagina.length && !hallada; pi++) {
      for (var ci = 0; ci < candidatas.length; ci++) {
        var u = _ubicar(lineasPorPagina[pi].lineas, candidatas[ci]);
        if (!u) { probada = candidatas[ci]; continue; }
        // gana la coincidencia mas fuerte; a igual fuerza, la primera etiqueta
        if (u.puntaje > mejorPuntaje) {
          mejorPuntaje = u.puntaje;
          hallada = { clave: clave, etiqueta: candidatas[ci], pagina: pi, donde: u };
        }
      }
    }
    if (hallada) located.push(hallada);
    else resultado.faltantes.push({ clave: clave, etiqueta: probada, motivo: 'la etiqueta no aparece en la plantilla' });
  });

  // ── 3 · escribir encima ──────────────────────────────────────────────────
  var doc = await PDFDocument.load(bytes, { updateMetadata: false });
  var font = await doc.embedFont(StandardFonts.Helvetica);
  var negro = rgb(0, 0, 0);

  located.forEach(function (l) {
    var valor = _sanear(valores[l.clave]);
    if (!valor) return;
    var page = doc.getPage(l.pagina);
    var vp = lineasPorPagina[l.pagina].viewport;
    var size = Math.max(6, Math.min(24, l.donde.size || 10));
    // pdf.js y pdf-lib miden desde abajo: el y de la etiqueta se usa tal cual
    var y = l.donde.y;
    var x = l.donde.x + 2;

    // si el valor no cabe en la pagina, se recorta (nunca se desborda)
    var ancho = font.widthOfTextAtSize(valor, size);
    var limite = vp.width - x - 6;
    if (ancho > limite && limite > 20) {
      var aprox = Math.max(4, Math.floor(valor.length * (limite / ancho)));
      valor = valor.slice(0, aprox);
    }
    page.drawText(valor, { x: x, y: y, size: size, font: font, color: negro });
    l.valor = valor;
    resultado.aplicados.push({ clave: l.clave, etiqueta: l.etiqueta, pagina: l.pagina + 1, valor: l.valor });
  });

  // reemplazos de texto libre: tapar el viejo y escribir el nuevo
  for (var ri = 0; ri < reemplazos.length; ri++) {
    var rep = reemplazos[ri];
    if (!rep || !String(rep.buscar || '').trim()) continue;
    var destino = null;
    // 1 · el item que contiene la frase (tapa SOLO la frase)
    for (var pi2 = 0; pi2 < lineasPorPagina.length && !destino; pi2++) {
      for (var li = 0; li < lineasPorPagina[pi2].lineas.length; li++) {
        var linea = lineasPorPagina[pi2].lineas[li];
        for (var ii = 0; ii < linea.items.length; ii++) {
          var it2 = linea.items[ii];
          var rango = _rangoDe(it2.str, rep.buscar);
          if (rango) {
            destino = { pagina: pi2, item: it2, linea: linea, vp: lineasPorPagina[pi2].viewport, rango: rango };
            break;
          }
        }
        if (destino) break;
      }
    }
    // 2 · si la frase esta partida en varios items, se tapa el item que la
    //     completa (se pierde el resto de ese item, pero no de la pagina)
    if (!destino) {
      var buscarNorm = _colapsar(rep.buscar);
      for (var pi3 = 0; pi3 < lineasPorPagina.length && !destino; pi3++) {
        for (var li3 = 0; li3 < lineasPorPagina[pi3].lineas.length; li3++) {
          var linea3 = lineasPorPagina[pi3].lineas[li3];
          var acum2 = '';
          for (var ii3 = 0; ii3 < linea3.items.length; ii3++) {
            var it3 = linea3.items[ii3];
            acum2 += ' ' + it3.str;
            if (_colapsar(acum2).indexOf(buscarNorm) >= 0) {
              destino = { pagina: pi3, item: it3, linea: linea3, vp: lineasPorPagina[pi3].viewport, rango: null };
              break;
            }
          }
          if (destino) break;
        }
      }
    }
    if (!destino) {
      resultado.reemplazos.push({ buscar: rep.buscar, aplicado: false, motivo: 'el texto no aparece en la plantilla' });
      continue;
    }
    var pageR = doc.getPage(destino.pagina);
    var itR = destino.item;
    var sizeR = Math.max(6, Math.min(24, itR.h || 10));
    var yBase = destino.linea.y;
    var nuevo = _sanear(rep.reemplazar);
    // el ancho tapado: solo la frase (o el item entero si la frase estaba partida)
    var xIni = itR.x;
    var anchoTap = itR.w;
    if (destino.rango) {
      var textoItem = String(itR.str);
      var prefijo = textoItem.slice(0, destino.rango.ini);
      var trozo = textoItem.slice(destino.rango.ini, destino.rango.fin);
      var xIni2 = itR.x;
      var anchoTap2 = itR.w;
      try {
        // el ancho se mide con las metricas de la fuente y se calibra con el
        // ancho REAL del item (asi tambien se absorben la fuente y el tamano
        // distintos de los de la plantilla)
        var anchoRef = font.widthOfTextAtSize(textoItem, sizeR);
        if (anchoRef > 0) {
          var escala = itR.w / anchoRef;
          xIni2 = itR.x + font.widthOfTextAtSize(prefijo, sizeR) * escala;
          anchoTap2 = font.widthOfTextAtSize(trozo, sizeR) * escala;
        }
      } catch (e) {
        // la fuente no puede medir ese texto: se usa la proporcion por caracter
        var largoItem = textoItem.length || 1;
        xIni2 = itR.x + itR.w * (destino.rango.ini / largoItem);
        anchoTap2 = itR.w * ((destino.rango.fin - destino.rango.ini) / largoItem);
      }
      xIni = xIni2;
      anchoTap = anchoTap2;
    }
    pageR.drawRectangle({
      x: xIni - 0.5,
      y: yBase - sizeR * 0.25,
      width: Math.max(1, anchoTap) + 1,
      height: sizeR * 1.15,
      color: rgb(1, 1, 1)
    });
    if (nuevo) {
      pageR.drawText(nuevo, { x: xIni, y: yBase, size: sizeR, font: font, color: negro });
    }
    resultado.reemplazos.push({ buscar: rep.buscar, reemplazar: nuevo, aplicado: true, pagina: destino.pagina + 1 });
  }

  // ── 4 · guardar y VERIFICAR ──────────────────────────────────────────────
  var salida = await doc.save();

  var docVerif = await pdfjs.getDocument(_opcionesPdfJs(new Uint8Array(salida))).promise;
  var textoVerif = '';
  for (var pv = 1; pv <= docVerif.numPages; pv++) {
    var pgv = await docVerif.getPage(pv);
    var tcv = await pgv.getTextContent();
    textoVerif += ' ' + (tcv.items || []).map(function (i) { return i.str; }).join(' ');
  }
  var verifNorm = _colapsar(textoVerif);

  resultado.aplicados.forEach(function (a) {
    if (verifNorm.indexOf(_colapsar(a.valor)) >= 0) resultado.verificados.push(a.clave);
    else resultado.sinVerificar.push({ clave: a.clave, valor: a.valor });
  });

  resultado.ok = true;
  resultado.bytes = salida;
  resultado.mensaje = resultado.aplicados.length + ' dato(s) aplicados, ' +
    resultado.faltantes.length + ' sin aplicar, ' +
    resultado.sinVerificar.length + ' sin verificar.';
  return resultado;
}

module.exports = {
  aplicarDatos: aplicarDatos,
  _ubicar: _ubicar,
  _sanear: _sanear,
  _opcionesPdfJs: _opcionesPdfJs
};
