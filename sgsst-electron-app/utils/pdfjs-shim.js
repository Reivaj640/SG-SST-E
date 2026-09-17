// utils/pdfjs-shim.js
//
// Shim que reemplaza pdf-parse@2.4.5 usando pdfjs-dist@5.4.624 (que ya viene
// del @file-viewer/renderer-pdf, así que no agrega peso al bundle).
//
// API expuesta (compatible con pdf-parse@2.4.5):
//   const { PDFParse } = require('./pdfjs-shim');
//   const parser = new PDFParse(uint8Array);
//   const { total, text } = await parser.getText();
//
// Tambien expone default (funcion) para compatibilidad con API vieja:
//   const pdfParse = require('./pdfjs-shim').default;
//   const { numpages, text } = await pdfParse(uint8Array);
//
// ⚠️  Limitaciones vs pdf-parse real:
//   - getImage/getTable/getScreenshot NO soportados (solo necesitamos getText).
//   - En PDF con fonts CID no embebidas, el texto puede salir con menos
//     precision (mismo riesgo que pdf-parse@2.4.5).
//
// Usado por: utils/remisionUtils.js, utils/evaluacionPdfParser.js,
//            utils/analyze-pdf-structure.js, utils/test-pdf-parse.js
//
// 📦638c — Reemplazo de pdf-parse para deduplicar pdfjs-dist@5.4.296 y
// @napi-rs/canvas@0.1.80 del .exe.

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

class PDFParse {
  constructor(data, options = {}) {
    if (data == null) throw new TypeError('PDFParse: data is required');
    // Acepta Buffer, Uint8Array, ArrayBuffer, o un objeto con propiedad .data
    this._data = data;
    this._options = options;
  }

  async getText() {
    const data = await this._getBytes();
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      // No queremos throw si hay fonts faltantes; mismo comportamiento que
      // pdf-parse@2.4.5 que solo emite warnings.
      verbosity: 0,
    });
    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    let fullText = '';
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
        includeMarkedContent: false,
      });
      // Reconstruir lineas respetando posicion Y (los items vienen con transform[5] = y).
      const lines = this._itemsToLines(content.items);
      fullText += lines.join('\n') + '\n\n';
    }
    await doc.cleanup();
    await doc.destroy();
    return {
      total: numPages,
      text: fullText,
    };
  }

  async _getBytes() {
    if (this._data instanceof Uint8Array) return this._data;
    if (Buffer.isBuffer(this._data)) return new Uint8Array(this._data);
    if (this._data instanceof ArrayBuffer) return new Uint8Array(this._data);
    if (typeof this._data === 'object' && this._data.data) {
      const d = this._data.data;
      if (d instanceof Uint8Array) return d;
      if (Buffer.isBuffer(d)) return new Uint8Array(d);
      if (d instanceof ArrayBuffer) return new Uint8Array(d);
    }
    throw new TypeError('PDFParse: data must be Uint8Array / Buffer / ArrayBuffer');
  }

  // Agrupa items de getTextContent en lineas respetando la posicion Y.
  // Items en pdfjs-dist: { str, dir, transform: [a,b,c,d,e,f], ... }
  // f = posicion Y. Items con misma Y estan en la misma linea.
  _itemsToLines(items) {
    if (!items || items.length === 0) return [];
    // Ordenar por Y descendente (pdfjs usa coordenadas top-down), X ascendente.
    const sorted = [...items].sort((a, b) => {
      const ya = a.transform ? a.transform[5] : 0;
      const yb = b.transform ? b.transform[5] : 0;
      if (Math.abs(ya - yb) > 1) return yb - ya; // Y mas alto primero
      const xa = a.transform ? a.transform[4] : 0;
      const xb = b.transform ? b.transform[4] : 0;
      return xa - xb;
    });

    const lines = [];
    let currentY = null;
    let currentLine = [];

    for (const item of sorted) {
      const y = item.transform ? item.transform[5] : 0;
      const str = item.str || '';
      if (str.trim() === '' && !item.hasEOL) {
        // Ignorar espacios sin EOL
        continue;
      }
      if (currentY === null || Math.abs(y - currentY) > 1) {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(' '));
        }
        currentLine = [str];
        currentY = y;
      } else {
        currentLine.push(str);
      }
      if (item.hasEOL) {
        lines.push(currentLine.join(' '));
        currentLine = [];
        currentY = null;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' '));
    }
    return lines;
  }
}

// Compat con API vieja de pdf-parse: function(buffer) -> { numpages, text }
async function pdfParseFunction(data) {
  const parser = new PDFParse(data);
  const result = await parser.getText();
  return {
    numpages: result.total,
    text: result.text,
  };
}

module.exports = PDFParse;
module.exports.PDFParse = PDFParse;
module.exports.default = pdfParseFunction;
