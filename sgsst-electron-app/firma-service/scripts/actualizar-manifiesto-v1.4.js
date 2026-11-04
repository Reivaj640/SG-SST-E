#!/usr/bin/env node
/**
 * scripts/actualizar-manifiesto-v1.4.js
 *
 * Apunta el manifiesto legal-readiness.json a los documentos de la v1.4 y
 * renombra las claves ambiguas del bloque "acuerdo" (J14-5).
 *
 * POR QUE ESTE SCRIPT Y NO UN JSON.stringify
 * -------------------------------------------
 * El manifiesto es ASCII PURO: las notas van sin tildes y los caracteres que
 * no son ASCII estan escapados (\u00e1). Re-serializarlo con JSON.stringify lo
 * romperia: convertiria cada escape en el caracter real, el archivo dejaria de
 * ser ASCII y el diff seria enorme. Por eso el manifiesto se edita con
 * REEMPLAZO LITERAL sobre el texto crudo, y despues se valida que siga siendo
 * JSON valido y ASCII puro.
 *
 * LAS HUELLAS NO SE INVENTAN
 * --------------------------
 * Las cinco se recalculan desde los archivos reales: la del Acuerdo v1.4, la
 * del Anexo de Encargo, la del Anexo de Nube, la de la Constancia y la de la
 * matriz de finalidades. Si un archivo no existe, el script se niega a
 * escribir. Ademas exige que las dos copias de cada HTML (legal/ y sitio/)
 * sean byte a byte identicas: dos copias distintas son dos textos, y un
 * manifiesto que declara una sola huella no puede declarar dos.
 *
 * J14-5 · LA TRAZABILIDAD DEL MANIFIESTO
 * --------------------------------------
 * Las claves v1_1_archivo y v1_1_hash contenian el valor de la v1.3: no era
 * un defecto de fondo, pero la Constancia §3 exige que la huella del texto
 * publicado coincida con la del aprobado "en el manifiesto del servicio", y
 * con ese nombre de clave la comprobacion es ambigua. Este script renombra a
 * "archivo", "hash" y "fecha", y deja la comprobacion automatica en
 * tests/readiness-manifiesto-v1.4.test.js.
 *
 * USO
 * ---
 *   node scripts/actualizar-manifiesto-v1.4.js
 *   node scripts/actualizar-manifiesto-v1.4.js --check
 *
 * Exit codes:
 *   0 = manifiesto actualizado (o verificado con --check)
 *   3 = error (falta un documento, las copias difieren, el manifiesto no es
 *       JSON, o un literal no aparece exactamente una vez)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const MANIFIESTO = path.join(SERVICE_ROOT, 'legal-readiness.json');
const VERSION = 'v1.4';

// La fecha de la ronda en que se tocan los anexos. Vive aqui y no en el JSON:
// el manifiesto es la salida de este script.
const FECHA_ACTUALIZACION = '2026-11-03';

// ---------------------------------------------------------------------------
// Las notas del manifiesto. ASCII PURO: sin tildes, sin acentos crudos.
// ---------------------------------------------------------------------------

const NOTA_ACUERDO = [
  'Candidata v1.4, NO aprobada y NO publicada. El 30-oct-2026 la revision '
  + 'juridica del abogado no emitio aprobacion sobre la v1.3 (49eab0c5...f4de12) y '
  + 'fijan tres cambios que obligan a publicar una v1.4 con huella recalculada: C-1 (la '
  + 'Constancia no puede vincular un modelo de Anexo de Nube sin firmar), C-2 (la '
  + 'aceptacion registra la version y la huella del Anexo de Encargo y del Anexo de Nube, '
  + 'y pone a disposicion la matriz de finalidades antes de habilitar la casilla) y C-3 '
  + '(deber propio del Encargado frente a la SIC, art. 18(k) de la Ley 1581). La v1.4 '
  + 'aplica ademas J3 (5.6: medio y fecha de puesta a disposicion), J6/D1 (determinacion '
  + 'del papel de Google por operacion, en el literal del abogado) y J14-2 (8.7: el tunel '
  + 'de Cloudflare transporta y transita sin almacenar copia de los registros). Las claves '
  + 'del bloque se renombraron a archivo, hash y fecha (J14-5): las anteriores v1_1_* '
  + 'contenian el valor de otra version y hacian ambigua la comprobacion automatica que '
  + 'exige la Constancia seccion 3. El texto se arma desde la v1.0 sellada con '
  + 'scripts/empalmar-acuerdo-v1.1.js --version=v1.4 '
  + '--cambios=scripts/fixtures/acuerdo-v1.4-cambios.json; ese JSON se construye con '
  + 'scripts/construir-acuerdo-v1.4.js a partir del de la v1.3, de modo que la diferencia '
  + 'entre las dos versiones queda escrita y no transcrita. La v1.3 queda como historico y '
  + 'nunca se publico. La fecha de vigencia la declara el owner antes de publicar y no se '
  + 'inventa.',
].join('');

const NOTA_ENCARGO = [
  'Modelo sin firmar. El 30-oct-2026 se aplico la revision juridica: J4 (bases juridicas '
  + 'literales de 10.3(a), (b), (c) y (e), con su estado de habilitacion, taken de '
  + 'config/matriz-finalidades.json), J14-1 (seccion 4 y seccion 6: el deber de no designar '
  + 'subencargados sin informar previamente y sin contrato o DPA queda en las obligaciones '
  + 'del Encargado; en las del responsable queda informarse y oponerse, y no usar un '
  + 'proveedor de correo propio sin autorizacion escrita), J9 (seccion 6), J5 (fuera del '
  + 'calendario de Google) y C-1 (seccion 9: sin copia firmada del Anexo de Nube la '
  + 'Constancia no puede emitirse). J6/D1: la determinacion del papel de Google por '
  + 'operacion quedo con el texto literal en las secciones 4, 5 y 8, y se retiraron las '
  + 'frases que quedaban falsas al lado de esa determinacion. El contenido es coherente con '
  + 'el Acuerdo v1.4 candidato, que elimina la retencion indefinida: la tabla supletoria que '
  + 'administra K+AIR da un plazo por defecto por categoria y la tabla de retencion '
  + 'documental de la Empresa tiene precedencia. Los plazos de diez (10) y cinco (5) anos no '
  + 'se activan en produccion hasta que el abogado los valide; el mecanismo queda '
  + 'construido y la activacion es otra decision, con el orden que fijo la revision: '
  + 'validar, alinear el catalogo, reejecutar las pruebas y solo entonces abrir la compuerta '
  + 'con validacion escrita. Para las categorias SG-SST el computo de veinte (20) anos exige '
  + 'la fecha real de cese; si falta, no se sustituye por la firma y el registro queda '
  + 'pendiente, sin fecha de supresion calculada. Firma y fecha las declara el owner.',
].join('');

const NOTA_NUBE = [
  'Modelo DILIGENCIADO por el owner el 31-oct-2026 y SIN FIRMAR: ninguna Empresa lo ha suscrito. '
  + 'El 31-oct-2026 se completaron los catorce (14) marcadores que el bloque de pendientes dejaba '
  + 'abiertos: cuatro del RNBD y diez de la ficha tecnica del canal de correo. RNBD: Gesstiar S.A.S. es '
  + 'una sociedad por acciones simplificada (S.A.S.), categoria que juridicamente es una sociedad; el '
  + 'certificado de existencia y representacion pendiente confirmara el tipo societario exacto. '
  + 'sigue pendiente de adjuntar. El umbral del articulo 2.2.2.26.1.2 del Decreto 1074 de 2015 son '
  + '100.000 UVT, que con la UVT 2026 de $52.374 (Resolucion DIAN 000238 de 2025) son $5.237.400.000 COP; '
  + 'la declaracion del owner ($1.000.000 COP, 19,09 UVT) queda por debajo del umbral, pero no acredita '
  + 'por si sola los activos totales a la fecha de corte; la posible no obligacion depende de verificarlo '
  + 'con el certificado de existencia y representacion y los estados financieros. No '
  + 'esta inscrita en el RNBD. Ficha del canal: el '
  + 'servidor SMTP es smtp.gmail.com puerto 587 con STARTTLS, verificado con TLSv1.3 y '
  + 'TLS_AES_256_GCM_SHA384 y cadena valida (verify 0); el remitente efectivo es adminkair@gmail.com; '
  + 'la cuenta tiene verificacion en dos pasos activada, corroborado porque una contrasena de '
  + 'aplicacion del proveedor solo existe con esa verificacion activada; la plantilla del OTP es la '
  + 'vigente del codigo y hay cuatro envios reales del 26-oct-2026; el registro de envios y de errores '
  + 'es gh_firma_eventos, con el evento OTP_SEND_FAILED ya implementado en el codigo; y no hay ninguna '
  + 'revocacion registrada porque nunca se ha revocado una credencial. Quedan pendientes y el Anexo los '
  + 'declara de forma expresa: la rotacion de la credencial y su periodicidad; el escalamiento de un '
  + 'codigo de un solo uso rechazado (el codigo bloquea con OTP_LOCKED pero no escala a ninguna '
  + 'persona); la fecha de generacion de la contrasena de aplicacion (el proveedor no la expone y el '
  + 'expediente no la registra); el certificado de existencia y representacion y la consulta al portal '
  + 'de la SIC; el minimo privilegio del sistema de archivos del despliegue (el T4 del 31-oct-2026 '
  + 'verifico que no cumple: permisos 777 y una base de datos de prueba dentro del despliegue); su '
  + 'correccion esta pendiente a cargo del owner, sin fecha de ejecucion confirmada; el cifrado en reposo del disco (verificado el '
  + '31-oct-2026: la raiz del servidor se monta '
  + 'sobre LVM sin cifrado y el area de intercambio es un archivo sin cifrar, de modo que no se '
  + 'declara implementado); y la validacion de las tres respuestas que este Anexo incorpora, que es '
  + 'del abogado. El 30-oct-2026 se aplico la revision juridica: el 6 quedo con el texto literal de D2; '
  + 'el 3 define el RTO como objetivo de recuperacion dependiente de la deteccion y del inicio de la '
  + 'respuesta; el 10 se firma sin marcadores de pendientes; el 1 fija la prevalencia del Anexo de Nube '
  + 'sobre el Anexo de Encargo tambien en conservacion, devolucion, supresion y auditoria; el 9 fija que '
  + 'toda modificacion se publica como version nueva con su propia huella SHA-256, se suscribe nuevamente '
  + 'por ambas partes y no altera las versiones ya suscritas ni sus efectos sobre los registros ya '
  + 'generados; el 8 corrige la promesa de auditoria, que ya no atribuye a Cloudflare certificaciones '
  + 'que pueden no existir. El papel de Google LLC se documenta como proveedor de un Gmail de consumo, '
  + 'sin afirmar DPA empresarial ni subencargado contractual ni contrato de transmision. El papel por '
  + 'operacion y la clasificacion juridica estan determinados (Google LLC actua como Responsable del '
  + 'Tratamiento y el flujo es una transferencia internacional a un pais con nivel adecuado); la '
  + 'Circular Externa 002 de 2025 no aplica a este canal. La copia firmada, cuando exista, sera la que '
  + 'se registre en version y hash; hasta entonces firmado=false y hash=null en este bloque.',
].join('');

const NOTA_CONSTANCIA = [
  'Modelo sin firmar. Desde el 03-nov-2026 es una constancia interna de version y autorizacion '
  + 'operativa de publicacion a cargo del representante legal; no declara ni requiere una aprobacion '
  + 'juridica del abogado. Identifica la version y huella exactas, y solo registra autorizacion de '
  + 'publicacion cuando las condiciones tecnicas y operativas hayan sido verificadas. El estado '
  + 'no_firmada significa que este modelo no esta suscrito; no representa una compuerta tecnica. '
  + 'Las recomendaciones del asesor se conservan en su documento original, y el owner registra '
  + 'por escrito sus decisiones J1-J14 en la seccion E del checklist, incluso si deja puntos pendientes.',
].join('');

const NOTA_MATRIZ = [
  'Fuente unica de la matriz de finalidades (Anexo de Encargo, seccion 2). La version y la '
  + 'huella son las que el servicio pone a disposicion del Firmante antes de habilitar la '
  + 'casilla de aceptacion, y las que la aceptacion registra junto con la version y la '
  + 'huella de los dos anexos. La matriz esta en estado de propuesta: ninguna finalidad '
  + 'queda habilitada en produccion hasta que el abogado valide el reparto entre Grupo A y '
  + 'Grupo B, la base juridica de cada finalidad y el estado de habilitacion.',
].join('');

// ---------------------------------------------------------------------------

function error(msg) {
  const e = new Error(msg);
  e.codigo = 3;
  return e;
}

/**
 * Reemplazo literal: exige que el texto viejo aparezca EXACTAMENTE una vez.
 */
function reemplazar(texto, viejo, nuevo, etiqueta) {
  const n = texto.split(viejo).length - 1;
  if (n !== 1) {
    throw error('El literal de ' + etiqueta + ' aparece ' + n + ' veces; tiene que '
      + 'aparecer exactamente una.');
  }
  return texto.replace(viejo, nuevo);
}

function cuerpoDeBloque(texto, bloque) {
  const i = texto.indexOf('"' + bloque + '": {');
  if (i < 0) throw error('El manifiesto no tiene el bloque "' + bloque + '".');
  const fin = texto.indexOf('\n  },', i);
  if (fin < 0) throw error('No se pudo cerrar el bloque "' + bloque + '".');
  return texto.slice(i, fin);
}

function ponerEnBloque(texto, bloque, clave, valor, etiqueta) {
  const i = texto.indexOf('"' + bloque + '": {');
  if (i < 0) throw error('El manifiesto no tiene el bloque "' + bloque + '".');
  const fin = texto.indexOf('\n  },', i);
  if (fin < 0) throw error('No se pudo cerrar el bloque "' + bloque + '".');
  const antes = texto.slice(0, i);
  const cuerpo = texto.slice(i, fin);
  const despues = texto.slice(fin);
  // El valor puede contener comillas ESCAPADAS (\"), asi que el patron tiene
  // que reconocer un string JSON completo y no solo los caracteres que no son
  // comilla: con `[^"]*` el valor se cortaria en la primera comilla escapada.
  const m = new RegExp('("' + clave + '"\\s*:\\s*)"((?:[^"\\\\]|\\\\.)*)"').exec(cuerpo);
  if (!m) throw error('El bloque "' + bloque + '" no tiene la clave "' + clave + '".');
  const nuevoCuerpo = cuerpo.replace(
    m[0],
    m[1] + '"' + valor.replace(/"/g, '\\"') + '"',
  );
  return antes + nuevoCuerpo + despues;
}

function sha256De(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/**
 * Un valor que NO es una cadena (booleano, null, numero). El patron de
 * `ponerEnBloque` exige comillas de apertura y cierre, asi que un `false`
 * sin comillas no lo encontraria.
 */
function ponerEscalarEnBloque(texto, bloque, clave, valorCrudo, etiqueta) {
  const i = texto.indexOf('"' + bloque + '": {');
  if (i < 0) throw error('El manifiesto no tiene el bloque "' + bloque + '".');
  const fin = texto.indexOf('\n  },', i);
  if (fin < 0) throw error('No se pudo cerrar el bloque "' + bloque + '".');
  const antes = texto.slice(0, i);
  const cuerpo = texto.slice(i, fin);
  const despues = texto.slice(fin);
  const m = new RegExp('("' + clave + '"\\s*:\\s*)([^,\\n}]+)').exec(cuerpo);
  if (!m) return antes + cuerpo + ',\n    "' + clave + '": ' + valorCrudo + despues;
  return antes + cuerpo.replace(m[0], m[1] + valorCrudo) + despues;
}

/**
 * ¿Existe el bloque? (no lanza: se usa para decidir si hay que insertarlo)
 */
function bloqueExiste(texto, bloque) {
  return texto.indexOf('"' + bloque + '": {') >= 0;
}

/**
 * Las dos copias de cada HTML (legal/ y sitio/) tienen que ser byte a byte
 * iguales. Si no lo son, hay dos textos y una sola huella no puede
 * describirlos: el manifiesto se niega a escribir.
 */
function exigirCopiasIguales(nombre, rutaA, rutaB) {
  const a = fs.readFileSync(rutaA);
  const b = fs.readFileSync(rutaB);
  if (!a.equals(b)) {
    throw error('Las dos copias de ' + nombre + ' difieren: legal/ y sitio/ tienen '
      + 'contenidos distintos, asi que una sola huella no describe los dos.');
  }
  return a.length;
}

function main() {
  const args = process.argv.slice(2);
  let soloCheck = false;
  for (const a of args) {
    if (a === '--check') soloCheck = true;
    else {
      console.error('Argumento desconocido: ' + a);
      process.exit(2);
    }
  }

  const relativoAcuerdo = 'scripts/fixtures/acuerdo-' + VERSION + '.txt';
  const archivoAcuerdo = path.join(SERVICE_ROOT, relativoAcuerdo);
  const archivoEncargo = path.join(APP_ROOT, 'legal', 'anexo-encargo.html');
  const archivoEncargoSitio = path.join(REPO_ROOT, 'sitio', 'anexo-encargo.html');
  const archivoNube = path.join(APP_ROOT, 'legal', 'anexo-nube-v1.0.html');
  const archivoNubeSitio = path.join(REPO_ROOT, 'sitio', 'anexo-nube-v1.0.html');
  const archivoConstancia = path.join(APP_ROOT, 'legal', 'constancia-aprobacion-acuerdo.html');
  const archivoConstanciaSitio = path.join(REPO_ROOT, 'sitio', 'constancia-aprobacion-acuerdo.html');
  const archivoMatriz = path.join(SERVICE_ROOT, 'config', 'matriz-finalidades.json');

  for (const p of [
    archivoAcuerdo, archivoEncargo, archivoEncargoSitio, archivoNube,
    archivoNubeSitio, archivoConstancia, archivoConstanciaSitio, archivoMatriz,
  ]) {
    if (!fs.existsSync(p)) throw error('No existe ' + p);
  }

  const bytesEncargo = exigirCopiasIguales('el Anexo de Encargo', archivoEncargo, archivoEncargoSitio);
  const bytesNube = exigirCopiasIguales('el Anexo de Nube', archivoNube, archivoNubeSitio);
  const bytesConstancia = exigirCopiasIguales('la Constancia', archivoConstancia, archivoConstanciaSitio);

  const hashAcuerdo = sha256De(archivoAcuerdo);
  const hashEncargo = sha256De(archivoEncargo);
  const hashNube = sha256De(archivoNube);
  const hashConstancia = sha256De(archivoConstancia);
  const hashMatriz = sha256De(archivoMatriz);

  let matriz = null;
  try {
    matriz = JSON.parse(fs.readFileSync(archivoMatriz, 'utf8'));
  } catch (err) {
    throw error('La matriz de finalidades no es JSON valido: ' + err.message);
  }
  const versionMatriz = matriz && matriz.version ? String(matriz.version) : null;
  const fechaMatriz = matriz && matriz.actualizado_at ? String(matriz.actualizado_at) : '2026-10-30';

  if (!fs.existsSync(MANIFIESTO)) throw error('No existe ' + MANIFIESTO);
  let m = fs.readFileSync(MANIFIESTO, 'utf8');
  // La fecha de actualizacion del manifiesto vive AQUI, en el script que lo
  // escribe: el manifiesto es la salida de este script, no un archivo que se
  // edita a mano. La ronda del 3-nov-2026 cambio el Anexo de Encargo (el
  // titular del aviso de revision profesional) y el Anexo de Nube (el titular
  // del bloque de pendientes), asi que las tres fechas que dependen de esos
  // archivos se mueven juntas.
  const fechasManifiesto = m.match(/"version": "\d{4}-\d{2}-\d{2}",\n  "actualizado_at": "\d{4}-\d{2}-\d{2}"/g) || [];
  if (fechasManifiesto.length !== 1) {
    throw error('La fecha de actualizacion del manifiesto aparece ' + fechasManifiesto.length + ' veces (se esperaba 1).');
  }
  m = m.replace(
    fechasManifiesto[0],
    '"version": "' + FECHA_ACTUALIZACION + '",\n  "actualizado_at": "' + FECHA_ACTUALIZACION + '"',
  );

  // --- Acuerdo: renombrar las claves ambiguas (J14-5) --------------------
  //
  // Idempotente: la primera corrida renombra v1_1_* a archivo/hash/fecha; la
  // segunda ya no encuentra las viejas y actualiza las nuevas.
  const renombres = [
    ['v1_1_archivo', 'archivo'],
    ['v1_1_hash', 'hash'],
    ['v1_1_fecha', 'fecha'],
  ];
  for (const [vieja, nueva] of renombres) {
    if (new RegExp('"' + vieja + '"').test(m)) {
      // Se conservan el separador y el VALOR: el renombrado cambia el nombre
      // de la clave, no lo que la clave dice.
      m = m.replace(
        new RegExp('"' + vieja + '"(\\s*:\\s*")([^"]*)"'),
        '"' + nueva + '"$1$2"',
      );
    }
  }
  m = ponerEnBloque(m, 'acuerdo', 'archivo', relativoAcuerdo, 'acuerdo.archivo');
  m = ponerEnBloque(m, 'acuerdo', 'hash', hashAcuerdo, 'acuerdo.hash');
  m = ponerEnBloque(m, 'acuerdo', 'fecha', '2026-10-30', 'acuerdo.fecha');
  m = ponerEnBloque(m, 'acuerdo', 'version', VERSION, 'acuerdo.version');
  // El Acuerdo v1.4 sigue sin publicarse: la publicacion la autoriza el
  // owner, despues de la autorizacion operativa y de las verificaciones tecnicas.
  // La aprobacion juridica no es un requisito legal ni una compuerta tecnica:
  // el owner registra sus decisiones J1-J14 en la seccion E del checklist.
  m = ponerEscalarEnBloque(m, 'acuerdo', 'publicado', 'false', 'acuerdo.publicado');
  m = ponerEnBloque(m, 'acuerdo', 'nota', NOTA_ACUERDO, 'la nota del Acuerdo');

  // --- Anexo de Encargo --------------------------------------------------
  m = ponerEnBloque(m, 'anexo_encargo', 'hash', hashEncargo, 'anexo_encargo.hash');
  m = ponerEnBloque(m, 'anexo_encargo', 'version', FECHA_ACTUALIZACION, 'anexo_encargo.version');
  m = ponerEnBloque(m, 'anexo_encargo', 'nota', NOTA_ENCARGO, 'la nota del Anexo de Encargo');

  // --- Anexo de Nube -----------------------------------------------------
  //
  // OJO: el bloque anexo_nube tiene DOS hashes con significados distintos.
  // "modelo.hash" es la huella del documento sin firmar (este es el que se
  // recalcula). "hash" es la huella de la COPIA FIRMADA por la Empresa: como
  // no hay ninguna, sigue en null y "firmado" en false. Ponerle el hash del
  // modelo ahi seria una mentira: diria que existe una firma que no existe.
  m = ponerEnBloque(m, 'modelo', 'hash', hashNube, 'anexo_nube.modelo.hash');
  const hashModeloLine = '"hash": "' + hashNube + '",';
  const bytesModelo = new RegExp('("hash": "' + hashNube + '",\\n      "bytes": )\\d+,');
  if (bytesModelo.test(m)) {
    m = m.replace(bytesModelo, '$1' + bytesNube + ',');
  } else {
    if (!m.includes(hashModeloLine)) throw error('No se pudo ubicar la huella del modelo para declarar sus bytes.');
    m = m.replace(hashModeloLine, hashModeloLine + '\n      "bytes": ' + bytesNube + ',');
  }
  m = m.replace(/\n    "bytes": \d+,/, '');
  m = ponerEnBloque(m, 'modelo', 'actualizado', FECHA_ACTUALIZACION, 'anexo_nube.modelo.actualizado');
  m = ponerEnBloque(m, 'modelo', 'nota', NOTA_NUBE, 'la nota del Anexo de Nube');

  // --- Constancia y matriz: bloques nuevos -------------------------------
  const bloqueConstancia = [
    '  "constancia": {',
    '    "archivo": "legal/constancia-aprobacion-acuerdo.html",',
    '    "hash": "' + hashConstancia + '",',
    '    "version": "' + VERSION + '",',
    '    "estado": "no_firmada",',
    '    "fecha": null,',
    '    "evidencia": null,',
    '    "nota": "' + NOTA_CONSTANCIA + '"',
    '  },',
  ].join('\n');

  const bloqueMatriz = [
    '  "matriz_finalidades": {',
    '    "archivo": "config/matriz-finalidades.json",',
    '    "hash": "' + hashMatriz + '",',
    '    "version": "' + versionMatriz + '",',
    '    "actualizado_at": "' + fechaMatriz + '",',
    '    "nota": "' + NOTA_MATRIZ + '"',
    '  },',
  ].join('\n');

  if (bloqueExiste(m, 'constancia')) {
    m = ponerEnBloque(m, 'constancia', 'hash', hashConstancia, 'constancia.hash');
    m = ponerEnBloque(m, 'constancia', 'version', VERSION, 'constancia.version');
    m = ponerEnBloque(m, 'constancia', 'nota', NOTA_CONSTANCIA, 'constancia.nota');
  } else {
    const ancla = m.indexOf('  "encargado": {');
    if (ancla < 0) throw error('No se encontro el bloque "encargado" donde insertar los nuevos.');
    m = m.slice(0, ancla) + bloqueConstancia + '\n' + bloqueMatriz + '\n' + m.slice(ancla);
  }

  if (bloqueExiste(m, 'matriz_finalidades')) {
    m = ponerEnBloque(m, 'matriz_finalidades', 'hash', hashMatriz, 'matriz_finalidades.hash');
    // La version y la fecha tambien se refrescan desde la fuente: si no, el
    // manifiesto queda con una fecha anterior al archivo que describe (N-5).
    m = ponerEnBloque(m, 'matriz_finalidades', 'version', versionMatriz, 'matriz_finalidades.version');
    m = ponerEnBloque(m, 'matriz_finalidades', 'actualizado_at', fechaMatriz, 'matriz_finalidades.actualizado_at');
    m = ponerEnBloque(m, 'matriz_finalidades', 'nota', NOTA_MATRIZ, 'matriz_finalidades.nota');
  }

  // --- validaciones ------------------------------------------------------
  let datos = null;
  try {
    datos = JSON.parse(m);
  } catch (err) {
    throw error('El manifiesto dejo de ser JSON valido: ' + err.message);
  }
  const noAscii = (m.match(/[^\x00-\x7F]/g) || []).length;
  if (noAscii > 0) {
    throw error('El manifiesto dejo de ser ASCII puro (' + noAscii + ' caracteres).');
  }
  if (datos.acuerdo.hash !== hashAcuerdo
    || datos.anexo_encargo.hash !== hashEncargo
    || datos.anexo_nube.modelo.hash !== hashNube
    || datos.constancia.hash !== hashConstancia
    || datos.matriz_finalidades.hash !== hashMatriz) {
    throw error('Alguna huella del manifiesto no coincide con la del archivo.');
  }
  if (datos.acuerdo.publicado !== false) {
    throw error('El manifiesto dice que el Acuerdo esta publicado. No debe estarlo.');
  }
  if (datos.anexo_nube.firmado !== false || datos.anexo_nube.hash !== null) {
    throw error('El manifiesto dice que hay Anexo de Nube firmado. No hay ninguna firma.');
  }

  if (soloCheck) {
    console.log('Manifiesto coherente con los archivos (--check, no se escribio nada).');
  } else {
    fs.writeFileSync(MANIFIESTO, m, 'utf8');
    console.log('Manifiesto actualizado.');
  }
  console.log('  acuerdo.hash                : ' + hashAcuerdo);
  console.log('  anexo_encargo.hash          : ' + hashEncargo + ' (' + bytesEncargo + ' B)');
  console.log('  anexo_nube.modelo.hash      : ' + hashNube + ' (' + bytesNube + ' B)');
  console.log('  constancia.hash             : ' + hashConstancia + ' (' + bytesConstancia + ' B)');
  console.log('  matriz_finalidades.hash     : ' + hashMatriz);
  console.log('  bytes: ' + Buffer.byteLength(m, 'utf8'));
}

try {
  main();
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(err.codigo || 3);
}
