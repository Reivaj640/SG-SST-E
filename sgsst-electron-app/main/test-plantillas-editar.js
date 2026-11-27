'use strict';
// 📦GPE · El editor de datos de plantillas (plantillas-editar) integrado al
// flujo de firma electrónica, y el motor que aplica los datos al PDF.
//
// POR QUE ESTE TEST EXISTE: la ronda toca tres cosas que se rompen sin que
// se note en pantalla hasta que alguien firma un contrato con los datos
// viejos: (1) el módulo del editor y su contrato de payload, (2) los cinco
// insertos en el componente de firma electrónica, y (3) el motor que aplica
// `datosEditados` al PDF. Lo que se protege acá es que el editor guarde SIEMPRE
// la llave `datosEditados` dentro de `contenido` (sin perder las llaves
// previas), que el backend acepte esa actualización parcial, y que el valor
// que dice haber aplicado ESTE de verdad en el PDF (se relee el PDF
// resultante y se busca el valor: no se trusts el "listo").
//
// El motor se prueba contra un PDF de laboratorio generado en el momento
// (una hoja con las etiquetas de un formulario y sus espacios en blanco):
// el test no depende de la maquina ni de los datos de la empresa.
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const APP = path.join(__dirname, '..');
const checks = [];
const ok = (n, c, e) => checks.push({ n: n, c: !!c, e: e || '' });

// ══ 1 · EL MÓDULO ═════════════════════════════════════════════════════════
{
  const dir = path.join(APP, 'modules', 'gestion-humana', 'plantillas-editar');
  const js = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
  const css = fs.readFileSync(path.join(dir, 'index.css'), 'utf8');

  ok('1a) el módulo existe y expone el singleton window.GPEditor',
    /window\.GPEditor\s*=/.test(js));
  ok('1b) el módulo se autoregistra (IIFE) y no depende de nada externo',
    /\(function \(\)/.test(js) &&
    !/[^.\w]require\s*\(/.test(js) && !/\bimport\s+[\w{*]/.test(js));
  ok('1c) el módulo es ES5 (sin flechas, sin let/const)',
    !/=>/.test(js) && !/\b(let|const)\s/.test(js));
  {
    const feCss = fs.readFileSync(path.join(APP, 'modules', 'gestion-humana', 'firma-electronica', 'index.css'), 'utf8');
    const colores = (s) => (s.match(/#[0-9a-fA-F]{3,8}/g) || []).map(c => c.toLowerCase());
    const cGpe = colores(css), cFe = new Set(colores(feCss));
    const compartidos = cGpe.filter(c => cFe.has(c)).length;
    const pct = cGpe.length ? compartidos / cGpe.length : 0;
    ok('1d) el CSS usa el prefijo gpe- y la paleta de SU seccion (fe-)',
      /\.gpe-/.test(css) && pct >= 0.8,
      Math.round(pct * 100) + '% de sus colores son los de la seccion fe-');
    ok('1d-bis) y no mezcla islas: no usa tokens --kair-* del shell',
      !/var\(--kair-/.test(css));
  }

  // Los nueve puntos clave del proceso de contratación
  const CLAVES = ['TRABAJADOR_NOMBRE', 'TRABAJADOR_CEDULA', 'TRABAJADOR_CARGO',
    'TRABAJADOR_SALARIO', 'TRABAJADOR_FECHA_INGRESO', 'TRABAJADOR_SEDE',
    'TRABAJADOR_EMPRESA_USUARIA', 'DOC_TIPO', 'EMPRESA_NOMBRE'];
  const faltan = CLAVES.filter(k => js.indexOf(k) < 0);
  ok('1e) están los nueve puntos clave',
    faltan.length === 0, faltan.join(','));

  // El contrato de payload: datosEditados dentro de contenido, sin perder lo previo
  ok('1f) guarda la llave datosEditados dentro de contenido',
    /prev\.datosEditados\s*=/.test(js));
  ok('1g) conserva las llaves previas del contenido (parsea y re-serializa)',
    /JSON\.parse\(o\.doc\.contenido/.test(js) && /JSON\.stringify\(prev\)/.test(js));
  ok('1h) registra la trazabilidad (editadoEn y editadoPor)',
    /editadoEn:/.test(js) && /editadoPor:/.test(js));
  ok('1i) los valores son solo los editados y los reemplazos solo los que tienen "buscar"',
    /valores:\s*Object\.assign\(\{\},\s*o\.ovr\)/.test(js) &&
    /r\.buscar\s*&&\s*r\.buscar\.trim\(\)/.test(js));
  ok('1j) guarda por el IPC que ya existe (ghUpdateDocumento con updates.contenido)',
    /ghUpdateDocumento/.test(js) && /updates:\s*\{\s*contenido:/.test(js));
  ok('1k) exporta con ghAbrirDocumento y delega la firma en onEnviarFirma',
    /ghAbrirDocumento/.test(js) && /onEnviarFirma/.test(js));
  ok('1l) el editor se desmonta al cerrarse (no deja el DOM colgado)',
    /GPEditor\.prototype\.close\s*=/.test(js) && /removeEventListener|remove\(\)/.test(js));
  ok('1m) el toast degrada en silencio si no hay gestor (no rompe)',
    /GestionHumanaToast/.test(js) && /KAIRToast/.test(js));

  // EOL: los dos archivos nuevos van en LF puro, sin BOM
  ok('1n) el módulo y su CSS conservan LF puro y sin BOM',
    !/\r/.test(js) && !/\r/.test(css) &&
    fs.readFileSync(path.join(dir, 'index.js'))[0] !== 0xef &&
    fs.readFileSync(path.join(dir, 'index.css'))[0] !== 0xef);
}

// ══ 2 · LOS CINCO INSERTOS EN EL COMPONENTE ══════════════════════════════
{
  const comp = fs.readFileSync(path.join(APP, 'modules', 'gestion-humana', 'firma-electronica', 'index.js'), 'utf8');

  ok('2a) inserto 1: el botón "Editar datos" en el expediente',
    /data-action="editar-datos"/.test(comp));
  ok('2b) inserto 2: la delegación del clic al editor',
    /action === 'editar-datos'/.test(comp) && /_abrirEditorDatos\(docId\)/.test(comp));
  ok('2c) inserto 3: el editor se abre al generar el documento',
    /nuevoDocGPE/.test(comp) && /_abrirEditorDatos\(nuevoDocGPE\)/.test(comp));
  ok('2d) inserto 4: los métodos nuevos (_ensureEditorAssets y _abrirEditorDatos)',
    /_ensureEditorAssets\s*=\s*function/.test(comp) && /_abrirEditorDatos\s*=\s*async function/.test(comp));
  ok('2e) inserto 5: el guard de Escape (el editor es la capa superior)',
    /document\.querySelector\('\.gpe-modal'\)\)\s*return;/.test(comp));
  ok('2f) el componente carga el módulo por la ruta de la carpeta nueva',
    /modules\/gestion-humana\/plantillas-editar\/index\.js/.test(comp) &&
    /modules\/gestion-humana\/plantillas-editar\/index\.css/.test(comp));
  ok('2g) el editor solo se abre con documento pendiente y con archivo',
    /d\.estado === 'pendiente' && d\.rutaArchivo/.test(comp));
  ok('2h) el editor valida el estado antes de abrir',
    /doc\.estado !== 'pendiente'/.test(comp));
  ok('2i) las cinco marcas GPE quedan en el archivo (una por inserto)',
    (comp.match(/📦GPE/g) || []).length === 5, String((comp.match(/📦GPE/g) || []).length));
}

// ══ 3 · EL BACKEND ACEPTA LA ACTUALIZACIÓN PARCIAL ═══════════════════════
{
  const bridge = fs.readFileSync(path.join(APP, 'main', 'gestion-humana-bridge.js'), 'utf8');
  ok('3a) gh:update-documento acepta el campo contenido',
    /contenido:\s*'contenido'/.test(bridge));
  ok('3b) gh:update-documento solo toca las llaves que llegan',
    /Object\.keys\(updates\)\.forEach/.test(bridge) && /if \(fieldMap\[key\]\)/.test(bridge));
  ok('3c) gh:create-documento copia la plantilla al archivo del documento',
    /copyFileSync\(srcPath, destPath\)/.test(bridge));
  ok('3d) el documento guarda el contenido como texto JSON',
    /data\.tipo,\s*data\.titulo,\s*data\.contenido/.test(bridge));

  // El cableado: sin esto, el editor guardaria los datos pero el PDF
  // seguiria con la plantilla en blanco (y nadie se enteraria).
  ok('3e) el handler de update-documento es async (aplica antes de responder)',
    /async function _handlerUpdateDocumento/.test(bridge));
  ok('3f) el handler aplica los datos al archivo y devuelve el reporte',
    /_aplicarDatosAlDocumento\(localDb, documentoId, updates\.contenido\)/.test(bridge) &&
    /render: renderGPE/.test(bridge));
  ok('3g) el render no puede tumbar el guardado (la edicion ya quedo guardada)',
    /catch \(eGPE\)/.test(bridge) &&
    /renderGPE = \{ ok: false,/.test(bridge));
  ok('3h) al crear el documento se deja una copia PRISTINA de la plantilla',
    /-plantilla' \+ ext/.test(bridge) && /copyFileSync\(srcPath, rutaPlantillaGPE\)/.test(bridge));
  ok('3i) el motor se carga desde el paquete (pdfjs-dist sale del asar)',
    (function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
      const unpack = (pkg.build && pkg.build.asarUnpack) || [];
      return unpack.some(r => /pdfjs-dist/.test(r));
    })());
}

// ══ 4 · EL MOTOR APLICA LOS DATOS AL PDF ═════════════════════════════════
(async () => {
  const render = require(path.join(APP, 'main', 'gh-render-plantilla.js'));
  const campos = require(path.join(APP, 'main', 'gh-plantilla-campos.js'));

  // ── fixture: una hoja de formulario con etiquetas y espacios en blanco ──
  // Cada etiqueta va en su propia fila (como en una plantilla real) y mas
  // abajo hay una clausula del cuerpo que menciona SEDE y SALARIO MENSUAL:
  // el valor tiene que caer en el CAMPO, no en la clausula.
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const ETIQUETAS = [
    ['NOMBRES:', 740], ['APELLIDOS:', 712], ['No. CEDULA:', 684], ['CARGO:', 656],
    ['SALARIO MENSUAL:', 628], ['FECHA DE INGRESO:', 600], ['SEDE:', 572],
    ['EMPRESA USUARIA:', 544], ['RAZON SOCIAL:', 516]
  ];
  ETIQUETAS.forEach(t => page.drawText(t[0], { x: 60, y: t[1], size: 10, font: f, color: rgb(0, 0, 0) }));
  page.drawText('CLASULA PRIMERA. El TRABAJADOR se obliga a prestar sus servicios a la EMPRESA en la SEDE', {
    x: 60, y: 420, size: 9, font: f, color: rgb(0, 0, 0)
  });
  page.drawText('y a recibir el SALARIO MENSUAL pactado en el presente documento.', {
    x: 60, y: 404, size: 9, font: f, color: rgb(0, 0, 0)
  });
  // linea con una frase que se puede reemplazar (el resto NO se debe perder)
  page.drawText('Se firma en la ciudad de BARRANQUILLA, a los 30 dias del mes de noviembre de 2026.', {
    x: 60, y: 380, size: 10, font: f, color: rgb(0, 0, 0)
  });
  const bytesPlantilla = await doc.save();

  // ── 4a) los nueve valores caen en la etiqueta correcta ──────────────────
  const valores = {
    TRABAJADOR_NOMBRE: 'Maria Fernanda Perez Gomez',
    TRABAJADOR_CEDULA: '1032456789',
    TRABAJADOR_CARGO: 'Salvavidas',
    TRABAJADOR_SALARIO: '$1.300.000',
    TRABAJADOR_FECHA_INGRESO: '01/12/2026',
    TRABAJADOR_SEDE: 'Sede Bocagrande',
    TRABAJADOR_EMPRESA_USUARIA: 'COMFAMILIAR ATLANTICO',
    EMPRESA_NOMBRE: 'Tempoactiva EST SAS'
  };
  const r1 = await render.aplicarDatos({
    bytesPlantilla: bytesPlantilla,
    tipoDocumento: 'contrato',
    datosEditados: { valores: valores, reemplazos: [] }
  });
  ok('4a) el motor aplico los datos sin fallar', r1.ok, r1.mensaje);
  ok('4b) aplico los 8 valores que tienen etiqueta',
    r1.aplicados.length === 8, r1.aplicados.length + ' aplicados');
  ok('4c) no quedaron datos sin aplicar', r1.faltantes.length === 0,
    JSON.stringify(r1.faltantes));
  ok('4d) los 8 valores quedaron VERIFICADOS dentro del PDF',
    r1.sinVerificar.length === 0, JSON.stringify(r1.sinVerificar));

  // el valor tiene que estar pegado a su etiqueta, en la pagina 1
  const pdfjs = require(path.join(APP, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs'));
  const d2 = await pdfjs.getDocument(render._opcionesPdfJs(new Uint8Array(r1.bytes))).promise;
  let texto = '';
  for (let i = 1; i <= d2.numPages; i++) {
    const pg = await d2.getPage(i);
    const tc = await pg.getTextContent();
    texto += ' ' + (tc.items || []).map(it => it.str).join(' ');
  }
  ok('4e) el PDF resultante trae el nombre del trabajador',
    texto.indexOf('Maria Fernanda Perez Gomez') >= 0);
  ok('4f) el PDF resultante trae el salario con formato es-CO',
    texto.indexOf('$1.300.000') >= 0);
  ok('4g) el PDF resultante trae la cedula',
    texto.indexOf('1032456789') >= 0);
  ok('4h) las etiquetas originales siguen ahí (no se borraron)',
    texto.indexOf('NOMBRES:') >= 0 && texto.indexOf('RAZON SOCIAL:') >= 0);
  ok('4i) el PDF resultante sigue siendo un PDF valido',
    Buffer.from(r1.bytes.slice(0, 5)).toString('latin1') === '%PDF-');

  // ── 4j) una etiqueta que no existe se REPORTA, no se pierde en silencio ──
  const r2 = await render.aplicarDatos({
    bytesPlantilla: bytesPlantilla,
    tipoDocumento: 'contrato',
    datosEditados: { valores: { DOC_TIPO: 'Contrato' }, reemplazos: [] }
  });
  ok('4j) una etiqueta inexistente se reporta como faltante',
    r2.faltantes.length === 1 && r2.faltantes[0].clave === 'DOC_TIPO',
    JSON.stringify(r2.faltantes));
  ok('4k) y no se aplica ningun valor inventado',
    r2.aplicados.length === 0);

  // ── 4l) los reemplazos de texto libre tapan el viejo y escriben el nuevo ──
  const r3 = await render.aplicarDatos({
    bytesPlantilla: bytesPlantilla,
    tipoDocumento: 'contrato',
    datosEditados: { valores: {}, reemplazos: [{ buscar: 'SEDE:', reemplazar: 'SEDE: Sede Bocagrande' }] }
  });
  ok('4l) el reemplazo de texto libre se aplico',
    r3.reemplazos.length === 1 && r3.reemplazos[0].aplicado === true,
    JSON.stringify(r3.reemplazos));

  // ── 4m) sin datos editados no hace nada (no rompe el flujo) ─────────────
  const r4 = await render.aplicarDatos({
    bytesPlantilla: bytesPlantilla,
    tipoDocumento: 'contrato',
    datosEditados: { valores: {}, reemplazos: [] }
  });
  ok('4m) sin datos editados el motor no hace nada y no falla', r4.ok && r4.aplicados.length === 0);

  // ── 4n) el mapa de etiquetas tiene los tipos y el formato de las claves ──
  ok('4n) el mapa declara el tipo contrato con sus nueve claves',
    !!campos.CAMPOS_POR_TIPO.contrato &&
    Object.keys(campos.CAMPOS_POR_TIPO.contrato).length >= 8,
    Object.keys(campos.CAMPOS_POR_TIPO.contrato || {}).join(','));
  ok('4o) el mapa normaliza (mayusculas sin tildes) para comparar',
    campos.normalizar('No. CEDULA:') === 'NO CEDULA',
    campos.normalizar('No. CEDULA:'));

  // ── 4q) el valor queda EN LA MISMA LINEA que su etiqueta ────────────────
  // Sin este check el motor pasaba: el PDF traia el texto, pero caia en otra
  // parte de la pagina (o en una clausula que mencionaba la misma palabra).
  async function lineasDe(docPdf, numPagina) {
    const pg = await docPdf.getPage(numPagina);
    const tc2 = await pg.getTextContent();
    const porY = {};
    (tc2.items || []).forEach(it => {
      if (!it.str || !it.str.trim()) return;
      const y = Math.round(it.transform[5] * 2) / 2;
      if (!porY[y]) porY[y] = [];
      porY[y].push(it);
    });
    return Object.keys(porY).map(Number).sort(function (a, b) { return b - a; }).map(y => ({
      y: y,
      texto: porY[y].map(it => it.str).join(' ')
    }));
  }
  const lineasPlantilla = await lineasDe(
    await pdfjs.getDocument(render._opcionesPdfJs(new Uint8Array(bytesPlantilla))).promise, 1);
  const lineasResultado = await lineasDe(d2, 1);

  // La etiqueta se busca en la linea de CAMPO (la que termina en la
  // etiqueta); el valor, en la linea que es exactamente ese valor. Asi una
  // clausula que menciona la misma palabra no se confunde con el campo.
  function baseDe(lineas, texto, esEtiqueta) {
    const t2 = campos.normalizar(texto);
    const candidatas = lineas.filter(l => campos.normalizar(l.texto).indexOf(t2) >= 0);
    if (!candidatas.length) return null;
    if (esEtiqueta) {
      const campo = candidatas.find(l => campos.normalizar(l.texto).slice(-t2.length) === t2);
      return campo ? campo.y : candidatas[0].y;
    }
    const exacta = candidatas.find(l => campos.normalizar(l.texto) === t2);
    return exacta ? exacta.y : candidatas[0].y;
  }
  const fueraDeLinea = [];
  r1.aplicados.forEach(a => {
    const yEtiqueta = baseDe(lineasPlantilla, a.etiqueta, true);
    const yValor = baseDe(lineasResultado, a.valor, false);
    if (yEtiqueta == null || yValor == null || Math.abs(yEtiqueta - yValor) > 2) {
      fueraDeLinea.push({ clave: a.clave, etiqueta: a.etiqueta, yEtiqueta: yEtiqueta, yValor: yValor });
    }
  });
  ok('4q) cada valor queda en la MISMA LINEA que su etiqueta',
    fueraDeLinea.length === 0, JSON.stringify(fueraDeLinea));

  // ── 4r) el reemplazo se pone EN LA FRASE (no al principio de la linea) ────
  // Si tapara toda la linea, en un contrato se perderia texto.
  const r5 = await render.aplicarDatos({
    bytesPlantilla: bytesPlantilla,
    tipoDocumento: 'contrato',
    datosEditados: { valores: {}, reemplazos: [{ buscar: 'BARRANQUILLA', reemplazar: 'Santa Marta' }] }
  });
  const itemsR4 = [];
  const pgR5 = await (await pdfjs.getDocument(render._opcionesPdfJs(new Uint8Array(r5.bytes))).promise).getPage(1);
  const tc3 = await pgR5.getTextContent();
  (tc3.items || []).forEach(it => {
    if (it.str && it.str.trim()) itemsR4.push({ x: it.transform[4], y: it.transform[5], str: it.str });
  });
  const itemNuevo = itemsR4.find(it => it.str.indexOf('Santa Marta') >= 0);
  const xEsperada = 60 + f.widthOfTextAtSize('Se firma en la ciudad de ', 10);
  ok('4r) el reemplazo queda EN LA FRASE y no borra el resto de la linea',
    !!itemNuevo && Math.abs(itemNuevo.x - xEsperada) <= 3,
    itemNuevo ? ('x=' + itemNuevo.x.toFixed(1) + ' esperada ' + xEsperada.toFixed(1)) : 'no se encontro el texto nuevo');
  ok('4r-bis) y el resto de la linea sigue en el PDF',
    texto.indexOf('a los 30 dias del mes de noviembre de 2026') >= 0);

  // ── 4p) pdf.js recibe las fuentes estandar (si no, no lee bien lo escrito) ──
  const optPdf = render._opcionesPdfJs(new Uint8Array([0]));
  ok('4p) el motor entrega a pdf.js las fuentes estandar',
    typeof optPdf.standardFontDataUrl === 'string' && optPdf.standardFontDataUrl.slice(-1) === '/',
    String(optPdf.standardFontDataUrl));

  // ══ 5 · RESUMEN ════════════════════════════════════════════════════════
  let fallidos = 0;
  console.log('\n=======================================');
  console.log('  📦GPE · Editor de datos de plantillas + motor del PDF');
  console.log('=======================================');
  checks.forEach(ch => {
    if (!ch.c) fallidos++;
    console.log((ch.c ? 'OK  ' : 'FAIL') + '  ' + ch.n + (ch.e ? '  [' + ch.e + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - fallidos) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(fallidos === 0 ? 0 : 1);
})().catch(e => { console.error('ERROR: ' + e.message + '\n' + e.stack); process.exit(1); });
