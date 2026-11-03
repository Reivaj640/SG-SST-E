#!/usr/bin/env node
/**
 * scripts/corregir-anexo-encargo-v1.4.js
 *
 * Aplica al Anexo de Encargo (A2) las correcciones que pidio la revision
 * juridica del 30-oct-2026 (J4, J5, J6, J9, J12, J14-1, C-1 y D1) y deja el
 * documento al dia con sus fuentes.
 *
 * QUE CORRIGE (codigo de la condicion de la revision)
 * ---------------------------------------------------
 *  J4    config/matriz-finalidades.json: base juridica declarada y estado de
 *        habilitacion de las finalidades 10.3(a), (b), (c) y (e). Esa matriz es
 *        un bloque GENERADO: se corrige la FUENTE y se regenera, nunca el
 *        HTML a mano.
 *  J12   A2 §1: ninguna Empresa opera con este Anexo sin los campos completos
 *        y las dos firmas, y el Encargado no habilita la creacion de solicitudes
 *        de firma mientras eso no se cumpla.
 *  J14-1 A2 §4: el deber de no designar subencargados, redactado como lo pide
 *        la revision. A2 §6: la contraparte que le corresponde a la Empresa.
 *  J6/D1 A2 §4 (ultimo literal), A2 §5 (ultimo parrafo) y A2 §8 (ultimo
 *        parrafo): la determinacion escrita del papel de Google LLC. El texto
 *        es UNO, identico en los tres lugares, literal (D1: no se parafrasea).
 *        Ademas se retiran las frases del §5 que decian que esa
 *        clasificacion seguia pendiente: un contrato no puede afirmar a la vez
 *        que la calificacion esta pendiente y que ya esta decidida.
 *  J5    A2 §5: se elimina la mencion al calendario de Google (no esta
 *        documentado en el Anexo de Nube).
 *  J9    A2: el deber de la Empresa de comunicar la fecha de terminacion de la
 *        relacion laboral. La revision lo ubica en "A2 §4, obligaciones del
 *        responsable"; en este Anexo §4 es "Obligaciones del encargado" y §6 es
 *        "Obligaciones del responsable", y el literal es un deber de la
 *        Empresa ("Comunicar al Encargado..."). Va en §6: puesto en §4 le
 *        obligaria al Encargado a comunicarse a si mismo.
 *  C-1   A2 §9: si no hay copia firmada, la Constancia no puede emitirse (no
 *        puede vincular a un Anexo de Nube no firmado).
 *
 * TILDES Y ENTIDADES
 * -------------------
 * Los dos HTML son ASCII con entidades HTML: nunca se escribe ahi un
 * caracter acentuado literal. El script lo verifica al final.
 *
 * La fuente config/matriz-finalidades.json se escribe en ASCII como el resto
 * del archivo, y el generador restituye las tildes con su diccionario. Dos
 * palabras del texto de la revision no estan en ese diccionario
 * ("documentacion" y "atencion"): van escritas con su tilde en UTF-8, que el
 * generador convierte igual en entidad HTML.
 *
 * IDEMPOTENCIA
 * ------------
 * El script se puede correr dos veces: la segunda no cambia nada y dice
 * "OK, ya aplicado". Cada correccion exige que su literal viejo aparezca
 * EXACTAMENTE una vez; si aparece mas de una, o si el texto nuevo ya esta y
 * el viejo no, el script no escribe y lo reporta.
 *
 * Uso:
 *   node scripts/corregir-anexo-encargo-v1.4.js
 *
 * Exit codes:
 *   0 = corregido y verificado (o ya aplicado)
 *   3 = error: un literal no aparecio, aparecio mas de una vez, o la
 *       verificacion final fallo
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');

const FUENTE_MATRIZ = path.join(SERVICE_ROOT, 'config', 'matriz-finalidades.json');
const HTML_LEGAL = path.join(APP_ROOT, 'legal', 'anexo-encargo.html');
const HTML_SITIO = path.join(REPO_ROOT, 'sitio', 'anexo-encargo.html');
const GENERADOR = path.join(__dirname, 'generar-anexo-encargo.js');

// ---------------------------------------------------------------------------
// La determinacion de J6: un solo texto, literal, para los tres lugares del A2.
// ---------------------------------------------------------------------------

const DETERMINACION = 'Por la operaci&oacute;n concreta, y contrastada con los t&eacute;rminos aplicables de la cuenta '
  + 'de consumo, Google LLC decide sobre la finalidad y los medios de su propio servicio y trata los datos por '
  + 'cuenta propia; en esta operaci&oacute;n act&uacute;a como Responsable del Tratamiento (art. 3, literales d) '
  + 'y e), de la Ley 1581 de 2012) y el flujo constituye una transferencia internacional de datos personales '
  + '(art. 2.2.2.25.1.3, numeral 4, del Decreto 1074 de 2015) a un Responsable ubicado en Estados Unidos, '
  + 'pa&iacute;s con nivel adecuado de protecci&oacute;n (numeral 3.2 del T&iacute;tulo V de la Circular &Uacute;nica). '
  + 'No existe DPA empresarial ni contrato de transmisi&oacute;n con Google, y esta determinaci&oacute;n no atribuye '
  + 'al Encargado facultades de supresi&oacute;n sobre las copias del proveedor ni le impone obligaciones '
  + 'contractuales a este.';

// ---------------------------------------------------------------------------
// Errores y utilidades
// ---------------------------------------------------------------------------

function error(msg) {
  const e = new Error(msg);
  e.codigo = 3;
  return e;
}

function contar(texto, frag) {
  return texto.split(frag).length - 1;
}

/**
 * Reemplazo literal idempotente.
 * - el literal viejo tiene que aparecer EXACTAMENTE una vez: se aplica;
 * - si no aparece y el nuevo si, la correccion ya estaba aplicada: no se escribe;
 * - cualquier otro caso es un error y el script no escribe.
 */
function aplicar(texto, edit, registro) {
  if (edit.nuevo && edit.nuevo.includes(edit.viejo)) {
    throw error('El texto nuevo de ' + edit.etiqueta + ' contiene el viejo: esa correccion '
      + 'no seria idempotente y hay que rehacerla como insercion.');
  }
  const nViejo = contar(texto, edit.viejo);
  if (nViejo === 1) {
    // El estado final se verifica aparte (DEBE_HABER / NO_DEBE_HABER): aqui solo
    // se exige que el literal viejo aparezca exactamente una vez.
    registro.push(edit.etiqueta + ': aplicado');
    return texto.replace(edit.viejo, edit.nuevo);
  }
  if (nViejo === 0) {
    // Un borrado (texto nuevo vacio) ya esta aplicado si su literal no aparece.
    if (!edit.nuevo || contar(texto, edit.nuevo) > 0) {
      registro.push(edit.etiqueta + ': ya aplicado');
      return texto;
    }
    throw error('El literal de ' + edit.etiqueta + ' no aparece en el Anexo.');
  }
  throw error('El literal de ' + edit.etiqueta + ' aparece ' + nViejo
    + ' veces; tiene que aparecer exactamente una.');
}

/**
 * Insercion idempotente: el ancla se queda y el contenido va despues. Si el
 * contenido ya esta, no se inserta otra vez.
 */
function insertar(texto, ancla, contenido, etiqueta, registro) {
  const nAncla = contar(texto, ancla);
  if (nAncla !== 1) {
    throw error('El ancla de ' + etiqueta + ' aparece ' + nAncla
      + ' veces; tiene que aparecer exactamente una.');
  }
  if (contar(texto, contenido) > 0) {
    registro.push(etiqueta + ': ya aplicado');
    return texto;
  }
  registro.push(etiqueta + ': aplicado');
  return texto.replace(ancla, ancla + contenido);
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// 1. J4 - la fuente de la matriz (base juridica y estado de habilitacion)
// ---------------------------------------------------------------------------

const ESTADO_NUEVO = 'Habilitada para la Empresa que haya suscrito el presente Anexo de Encargo y el Anexo de Nube, '
  + 'inscrito su tabla de retencion documental y designado su canal de atención. No habilitada en tanto no se '
  + 'cumplan esas tres condiciones.';

const ESTADO_VIEJO = 'Propuesta; no habilitada para produccion hasta que el abogado valide la base juridica y el '
  + 'owner documente la instruccion aplicable.';

/**
 * Finalidades a corregir: id, base juridica que exige la revision (literal) y
 * base juridica nueva (literal). El texto viejo se valida antes de tocar: si
 * la fuente tiene otra cosa, el script se detiene y lo dice.
 */
const FINALIDADES_J4 = [
  {
    id: '10.3(a)',
    etiqueta: 'J4 base juridica 10.3(a)',
    baseVieja: 'Instruccion documentada del Responsable (la Empresa) y del contrato de encargo (este Anexo y el Acuerdo), con fundamento en la finalidad del tratamiento. Base juridica propia de la Empresa para esta finalidad: No declarada en los documentos actuales - pendiente de validacion juridica. El numeral 10.4(b) del Acuerdo exige que cada finalidad tenga su base en esta matriz, y no invoca la autorizacion del Titular para las finalidades cuya base no sea esa autorizacion.',
    baseNueva: 'Autorizacion previa, expresa e informada del Titular (arts. 9 y 12 Ley 1581 de 2012; arts. 2.2.2.25.2.2 y 2.2.2.25.2.4 del Decreto 1074 de 2015), manifestada en el ordinal 3 de la Manifestacion de Voluntad; y deber legal de conservacion de la documentación del SG-SST cuando el documento remitido pertenezca a las categorias del art. 2.2.4.6.13 del Decreto 1072 de 2015',
  },
  {
    id: '10.3(b)',
    etiqueta: 'J4 base juridica 10.3(b)',
    baseVieja: 'Instruccion documentada del Responsable (la Empresa) y del contrato de encargo. Medida de seguridad del envio: deber de confiabilidad de la firma electronica (articulo 2.2.2.47.4, numeral 1, del Decreto 1074 de 2015) y custodia del dato de creacion de la firma por parte de quien provee el mecanismo (articulo 2.2.2.47.6 del Decreto 1074 de 2015), en los terminos de los numerales 3.4(e) y 3.7(a) del Acuerdo. Base juridica propia de la Empresa para esta finalidad: No declarada en los documentos actuales - pendiente de validacion juridica.',
    baseNueva: 'Deber legal de confiabilidad de la firma electronica: art. 2.2.2.47.4, numeral 1, y art. 2.2.2.47.6 del Decreto 1074 de 2015, que relevan del consentimiento en los terminos del literal c) del art. 4 de la Ley 1581 de 2012; y autorizacion del Titular respecto del medio de recepcion y del uso del canal.',
  },
  {
    id: '10.3(c)',
    etiqueta: 'J4 base juridica 10.3(c)',
    baseVieja: 'Instruccion documentada del Responsable (la Empresa) y del contrato de encargo. El deber de confiabilidad de la firma electronica exige verificar la identidad del firmante: articulo 2.2.2.47.4, numeral 1, del Decreto 1074 de 2015, en los terminos del numeral 3.7(a) del Acuerdo. Base juridica propia de la Empresa para esta finalidad: No declarada en los documentos actuales - pendiente de validacion juridica.',
    baseNueva: 'Deber legal de verificar la identidad del firmante (art. 2.2.2.47.4, numeral 1, del Decreto 1074 de 2015), con el mismo fundamento de dispensa del literal c) del art. 4 de la Ley 1581 de 2012; y autorizacion del Titular para el acceso a los datos identificativos que se comparan como HMAC-SHA-256.',
  },
  {
    id: '10.3(e)',
    etiqueta: 'J4 base juridica 10.3(e)',
    baseVieja: 'Instruccion documentada del Responsable (la Empresa) y del contrato de encargo. Deber contractual de generar y entregar la constancia de firma despues de la firma (numerales 3.4(i) y 3.6(h) del Acuerdo) y de ponerla a disposicion del Titular sin costo (numeral 5.4 del Acuerdo). Base juridica propia de la Empresa para esta finalidad: No declarada en los documentos actuales - pendiente de validacion juridica.',
    baseNueva: 'Deber legal y contractual de generar y entregar la constancia de firma: art. 2.2.1.1.12 del Decreto 1072 de 2015 y art. 2.2.2.25.2.8 del Decreto 1074 de 2015; y autorizacion del Titular.',
  },
];

/**
 * Sustituye un campo de texto dentro del bloque de una finalidad.
 * El bloque se delimita por su "id" y el "id" siguiente: dentro de ese bloque
 * el campo tiene que estar una vez. Idempotente: si el campo ya tiene el
 * valor nuevo, no se escribe.
 */
function campoEnBloque(bloque, campo) {
  const marca = '"' + campo + '": "';
  const i = bloque.indexOf(marca);
  if (i === -1) throw error('El bloque no tiene el campo "' + campo + '".');
  if (bloque.indexOf(marca, i + 1) !== -1) throw error('El campo "' + campo + '" aparece mas de una vez.');
  const desde = i + marca.length;
  const hasta = bloque.indexOf('"', desde);
  if (hasta === -1) throw error('El campo "' + campo + '" no esta cerrado.');
  return { desde, hasta, valor: bloque.slice(desde, hasta) };
}

/**
 * Aplica las correcciones de J4 a la fuente de la matriz. Devuelve la fuente
 * nueva y deja en el registro que cambio y que ya estaba aplicado.
 */
function corregirMatriz(fuente, registro) {
  let salida = fuente;
  for (const f of FINALIDADES_J4) {
    const marcador = '"id": "' + f.id + '"';
    const i = salida.indexOf(marcador);
    if (i === -1) throw error('La fuente no trae la finalidad ' + f.id + '.');
    if (salida.indexOf(marcador, i + 1) !== -1) throw error('La finalidad ' + f.id + ' esta duplicada.');
    const fin = salida.indexOf('"id": "', i + marcador.length);
    const finBloque = fin === -1 ? salida.length : fin;
    const bloque = salida.slice(i, finBloque);

    // --- base juridica
    const base = campoEnBloque(bloque, 'base_juridica');
    if (base.valor === f.baseNueva) {
      registro.push(f.etiqueta + ': ya aplicado');
    } else if (base.valor === f.baseVieja) {
      const bloqueNuevo = bloque.slice(0, base.desde) + f.baseNueva + bloque.slice(base.hasta);
      salida = salida.slice(0, i) + bloqueNuevo + salida.slice(finBloque);
      registro.push(f.etiqueta + ': aplicado');
    } else {
      throw error('La base juridica de ' + f.id + ' no es la que la revision da por vieja; '
        + 'la fuente cambio y hay que revisarla a mano.');
    }

    // --- estado de habilitacion (el mismo texto en las cuatro filas)
    const i2 = salida.indexOf(marcador);
    const fin2 = salida.indexOf('"id": "', i2 + marcador.length);
    const bloque2 = salida.slice(i2, fin2 === -1 ? salida.length : fin2);
    const estado = campoEnBloque(bloque2, 'estado_habilitacion');
    if (estado.valor === ESTADO_NUEVO) {
      registro.push('J4 estado de habilitacion ' + f.id + ': ya aplicado');
    } else if (estado.valor === ESTADO_VIEJO) {
      const bloqueNuevo = bloque2.slice(0, estado.desde) + ESTADO_NUEVO + bloque2.slice(estado.hasta);
      salida = salida.slice(0, i2) + bloqueNuevo + salida.slice(fin2 === -1 ? salida.length : fin2);
      registro.push('J4 estado de habilitacion ' + f.id + ': aplicado');
    } else {
      throw error('El estado de habilitacion de ' + f.id + ' no es el que la revision da por viejo; '
        + 'la fuente cambio y hay que revisarla a mano.');
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// 2. El Anexo de Encargo (HTML escrito a mano)
// ---------------------------------------------------------------------------

const EDICIONES_HTML = [
  // --- J12: §1, condiciones para que la Empresa opere ---------------------
  {
    etiqueta: 'J12 §1 condiciones de operacion',
    ancla: '        equivalente que la empresa use.</td>\n      </tr>\n    </tbody>\n  </table>\n\n\n',
    contenido: '  <p><strong>Ninguna Empresa podr&aacute; operar en el servicio con este Anexo sin los campos\n'
      + '  completos y las dos firmas; el Encargado no habilita la creaci&oacute;n de solicitudes de firma\n'
      + '  mientras esa condici&oacute;n no se cumpla.</p>\n\n',
  },

  // --- J14-1 + J6: §4, ultimo literal (deber de no designar subencargados) --
  {
    etiqueta: 'J14-1 y J6 §4 ultimo literal',
    viejo: '    <li><strong>No designar subencargados</strong> sin informar previamente a la Empresa y sin que est&eacute;n\n'
      + '    vinculados por un contrato o DPA que les imponga obligaciones equivalentes a las de este anexo, conforme a\n'
      + '    la secci&oacute;n 5 y al <a href="anexo-nube-v1.0.html">Anexo de Nube</a>. La cuenta de correo gratuita que\n'
      + '    hoy se usa no cumple esa condici&oacute;n: por eso el env&iacute;o de correo no se documenta como\n'
      + '    transmisi&oacute;n a un subencargado, sino como una <strong>transferencia internacional a un proveedor externo\n'
      + '    que act&uacute;a como Responsable</strong> en los t&eacute;rminos de la secci&oacute;n 5.</li>\n',
    nuevo: '    <li><strong>No designar subencargados</strong> sin informar previamente a la Empresa y sin que est&eacute;n\n'
      + '    vinculados por contrato o DPA que les imponga obligaciones equivalentes. ' + DETERMINACION + '</li>\n',
  },

  // --- J9 + J14-1: §6, obligaciones del responsable ------------------------
  {
    etiqueta: 'J9 y J14-1 §6 obligaciones del responsable',
    ancla: '    de firma. La empresa tiene el dato de contacto; el buz&oacute;n es del trabajador.</li>\n',
    contenido: '    <li><strong>Comunicar al Encargado, por el canal de atenci&oacute;n, la fecha de terminaci&oacute;n de la\n'
      + '    relaci&oacute;n laboral</strong> de cada trabajador respecto de quien se firmen documentos de las\n'
      + '    categor&iacute;as del literal (b) del numeral 8.6 del Acuerdo, con el fin de iniciar el c&oacute;mputo del\n'
      + '    plazo legal. Mientras esa fecha no se comunique, el registro queda retenido y no se calcula fecha de\n'
      + '    supresi&oacute;n.</li>\n'
      + '    <li><strong>Informarse y oponerse a la designaci&oacute;n de subencargados, y no usar un proveedor de\n'
      + '    correo propio sin autorizaci&oacute;n escrita.</strong></li>\n',
  },

  // --- J5: §5, fila de Google: fuera el calendario -------------------------
  {
    etiqueta: 'J5 §5 fila Google (calendario en la columna Que realiza)',
    viejo: '        servicio; y, cuando la empresa lo use, el calendario</td>\n',
    nuevo: '        servicio</td>\n',
  },
  {
    etiqueta: 'J5 y D1 §5 fila Google (calendario y clasificacion pendiente)',
    viejo: '        subencargo contractual. El papel de Google por operaci&oacute;n, la clasificaci&oacute;n del flujo y su\n'
      + '        fundamento est&aacute;n pendientes de validaci&oacute;n profesional; ver la secci&oacute;n 5 y el\n'
      + '        <a href="anexo-nube-v1.0.html">Anexo de Nube</a>. El calendario solo si la empresa conecta su cuenta</td>\n',
    nuevo: '        subencargo contractual</td>\n',
  },

  // --- D1: §5, el parrafo de las comunicaciones de firma --------------------
  {
    etiqueta: 'D1 §5 parrafo de comunicaciones de firma',
    viejo: ' El papel de Google por\n'
      + '  operaci&oacute;n y la clasificaci&oacute;n del flujo (transferencia o transmisi&oacute;n) quedan pendientes de\n'
      + '  validaci&oacute;n jur&iacute;dica profesional. Este Anexo no atribuye a Google la condici&oacute;n de Responsable,\n'
      + '  Encargado o subencargado de Gesstiar ni afirma una base jur&iacute;dica de transferencia antes de esa validaci&oacute;n.\n',
    nuevo: '',
  },

  // --- J6: §5, retitulo del parrafo de determinacion ------------------------
  {
    etiqueta: 'J6 §5 retitulo del parrafo de determinacion',
    viejo: '<strong>Determinaci&oacute;n del papel del proveedor de correo (Google LLC): pendiente.</strong>',
    nuevo: '<strong>Determinaci&oacute;n del papel del proveedor de correo (Google LLC).</strong>',
  },

  // --- D1: §5, el parrafo de la declaracion de la empresa cliente -----------
  {
    etiqueta: 'D1 §5 parrafo de la declaracion de la empresa cliente',
    viejo: ' El papel del proveedor, la calificaci&oacute;n como\n'
      + '  transferencia o transmisi&oacute;n, la base aplicable y las obligaciones de informaci&oacute;n o autorizaci&oacute;n\n'
      + '  quedan pendientes de determinaci&oacute;n escrita por el abogado colombiano antes de publicar.</p>\n'
      + '  <p><strong>Determinaci&oacute;n del papel del proveedor de correo (Google LLC).</strong>',
    nuevo: '</p>\n'
      + '  <p><strong>Determinaci&oacute;n del papel del proveedor de correo (Google LLC).</strong>',
  },

  // --- J6: §5, frase final del parrafo de determinacion --------------------
  {
    etiqueta: 'J6 §5 frase final del parrafo de determinacion',
    viejo: ' Hasta entonces,\n'
      + '  este Anexo no declara cerrada la clasificaci&oacute;n ni su suficiencia jur&iacute;dica.</p>\n',
    nuevo: ' Esta determinaci&oacute;n no equivale a un acuerdo de tratamiento con Google: no existe DPA\n'
      + '  empresarial, no hay contrato de transmisi&oacute;n y no se atribuyen a Google condiciones de\n'
      + '  conservaci&oacute;n, supresi&oacute;n o auditor&iacute;a que no hayan sido verificadas documentalmente.</p>\n',
  },

  // --- D1: §5, la lista de lo que queda pendiente ---------------------------
  {
    etiqueta: 'D1 §5 paso pendiente (i) determinacion escrita de Google',
    viejo: 'que el abogado debe validar y que debe quedar en',
    nuevo: 'que esta secci&oacute;n incorpora y que debe quedar en',
  },
  {
    etiqueta: 'D1 §5 pasos pendientes (v) y (vi), ya resueltos por la determinacion',
    viejo: '; (v) la\n'
      + '  determinaci&oacute;n de si esta operaci&oacute;n exige adem&aacute;s Normas Corporativas Vinculantes (art&iacute;culo\n'
      + '  27 de la Ley 1581 de 2012) o un contrato de transmisi&oacute;n en los t&eacute;rminos del art&iacute;culo\n'
      + '  2.2.2.25.5.2 del Decreto 1074 de 2015, que solo corresponde si el papel de Google se determinara como\n'
      + '  Encargado; y (vi) las tres preguntas puntuales que quedan abiertas para el abogado: si el papel del\n'
      + '  destinatario debe determinarse desde los t&eacute;rminos del proveedor o desde la operaci&oacute;n concreta; si la\n'
      + '  Circular 2 de 2025 exige comunicaci&oacute;n previa a la Delegatura o basta la declaraci&oacute;n en el Registro\n'
      + '  Nacional de Bases de Datos; y qu&eacute; redacci&oacute;n de este Anexo deja la base de la transferencia declarada\n'
      + '  de forma que el abogado pueda considerarla suficiente. <strong>Este Anexo declara lo que est&aacute; hecho y\n'
      + '  deja lo que falta con nombre y responsable: no afirma que estos pasos ya est&eacute;n cumplidos.</strong></p>',
    nuevo: '. <strong>Este Anexo declara lo que est&aacute; hecho y\n'
      + '  deja lo que falta con nombre y responsable: no afirma que estos pasos ya est&eacute;n cumplidos.</strong></p>',
  },

  // --- J6: §5, ultimo parrafo ---------------------------------------------
  {
    etiqueta: 'J6 §5 ultimo parrafo',
    viejo: ' mismo. El proveedor de correo no es un subencargado y no est&aacute; vinculado por un contrato o DPA: se declara\n'
      + '  como Responsable en una transferencia internacional, con el encuadre y los pendientes de esta secci&oacute;n. El\n',
    nuevo: ' mismo. ' + DETERMINACION + ' El\n',
  },

  // --- J6: §8, ultimo parrafo (se retira el "encuadre ya decidido") ---------
  {
    etiqueta: 'J6 §8 ultimo parrafo',
    viejo: ' anexo, que deber&aacute; interpretarse de manera conjunta con esta disposici&oacute;n. La evaluaci&oacute;n jur&iacute;dica\n'
      + '  y contractual del canal de correo qued&oacute; documentada el 27 de octubre de 2026 y su resultado es el\n'
      + '  encuadre de transferencia internacional que declara la secci&oacute;n 5; lo que en esa evaluaci&oacute;n qued&oacute;\n'
      + '  pendiente son los pasos documentales que ah&iacute; se enumeran, no la caracterizaci&oacute;n de la operaci&oacute;n.</p>\n',
    nuevo: ' anexo, que deber&aacute; interpretarse de manera conjunta con esta disposici&oacute;n. ' + DETERMINACION + '</p>\n',
  },

  // --- C-1: §9, la Constancia no puede vincular un Anexo no firmado --------
  {
    etiqueta: 'C-1 §9 constancia sin copia firmada',
    viejo: '  al firmar; la del Anexo de Nube es la de la versi&oacute;n firmada por esa Empresa o, si todav&iacute;a no hay copia\n'
      + '  firmada, la del modelo vigente. Esas huellas quedan escritas en el registro de la firma, junto con el documento\n',
    nuevo: '  al firmar; la del Anexo de Nube es la de la versi&oacute;n firmada por esa Empresa o, si no hay copia firmada, la\n'
      + '  Constancia no puede emitirse. Esas huellas quedan escritas en el registro de la firma, junto con el documento\n',
  },
];

// ---------------------------------------------------------------------------
// Verificacion del estado final: lo que TIENE que quedar, y lo que no
// ---------------------------------------------------------------------------

const DEBE_HABER = [
  { etiqueta: 'J6/D1 determinacion de Google LLC (en §4, §5 y §8)', texto: DETERMINACION, veces: 3 },
  {
    etiqueta: 'J12 §1 condiciones para operar',
    texto: 'Ninguna Empresa podr&aacute; operar en el servicio con este Anexo sin los campos',
    veces: 1,
  },
  {
    etiqueta: 'J14-1 §4 deber de no designar subencargados',
    texto: 'vinculados por contrato o DPA que les imponga obligaciones equivalentes',
    veces: 1,
  },
  {
    etiqueta: 'J14-1 §6 contraparte de la Empresa',
    texto: 'Informarse y oponerse a la designaci&oacute;n de subencargados, y no usar un proveedor de',
    veces: 1,
  },
  {
    etiqueta: 'J9 deber de comunicar la fecha de terminacion',
    texto: 'Comunicar al Encargado, por el canal de atenci&oacute;n, la fecha de terminaci&oacute;n',
    veces: 1,
  },
  {
    etiqueta: 'C-1 §9 Constancia sin copia firmada',
    texto: 'o, si no hay copia firmada, la',
    veces: 1,
  },
  {
    etiqueta: 'C-1 §9 Constancia sin copia firmada (continuacion)',
    texto: 'Constancia no puede emitirse. Esas huellas quedan escritas en el registro de la firma',
    veces: 1,
  },
  {
    etiqueta: 'J6 §5 retitulo del parrafo de determinacion',
    texto: '<strong>Determinaci&oacute;n del papel del proveedor de correo (Google LLC).</strong>',
    veces: 1,
  },
  {
    etiqueta: 'J6 §5 frase final del parrafo de determinacion',
    texto: 'Esta determinaci&oacute;n no equivale a un acuerdo de tratamiento con Google',
    veces: 1,
  },
];

const NO_DEBE_HABER = [
  { etiqueta: 'J5 calendario de Google (columna "Que realiza")', texto: 'y, cuando la empresa lo use, el calendario' },
  { etiqueta: 'J5 calendario de Google (columna "Cuando aplica")', texto: 'El calendario solo si la empresa conecta su cuenta' },
  { etiqueta: 'D1 clasificacion pendiente (§5)', texto: 'quedan pendientes de validaci&oacute;n jur&iacute;dica profesional' },
  { etiqueta: 'D1 clasificacion pendiente (fila de Google)', texto: 'est&aacute;n pendientes de validaci&oacute;n profesional' },
  { etiqueta: 'D1 determinacion pendiente (§5)', texto: 'quedan pendientes de determinaci&oacute;n escrita por el abogado colombiano' },
  { etiqueta: 'D1 paso pendiente (i)', texto: 'que el abogado debe validar' },
  { etiqueta: 'D1 paso pendiente (v)', texto: 'Normas Corporativas Vinculantes (art&iacute;culo' },
  { etiqueta: 'D1 paso pendiente (vi)', texto: '(vi) las tres preguntas puntuales' },
  { etiqueta: 'D1 encuadre ya decidido (§8)', texto: 'el encuadre de transferencia internacional que declara la secci&oacute;n 5' },
  { etiqueta: 'J6 titulo viejo (§5)', texto: '(Google LLC): pendiente.' },
  { etiqueta: 'J6 frase final vieja (§5)', texto: 'Este Anexo no declara cerrada la clasificaci&oacute;n' },
  { etiqueta: 'C-1 modelo vigente (§9)', texto: 'la del modelo vigente' },
  { etiqueta: 'J14-1 redaccion vieja (§4)', texto: 'obligaciones equivalentes a las de este anexo, conforme a' },
];

function verificarHtml(html) {
  for (const item of DEBE_HABER) {
    const n = contar(html, item.texto);
    if (n !== item.veces) {
      throw error('Verificacion del Anexo fallo: "' + item.etiqueta + '" aparece ' + n
        + ' veces y tiene que aparecer ' + item.veces + '.');
    }
  }
  for (const item of NO_DEBE_HABER) {
    const n = contar(html, item.texto);
    if (n > 0) {
      throw error('Verificacion del Anexo fallo: todavia queda "' + item.texto + '" (' + item.etiqueta + ').');
    }
  }
}

function verificarMatriz(fuente) {
  const matriz = JSON.parse(fuente);
  for (const f of FINALIDADES_J4) {
    const fila = (matriz.finalidades || []).find((x) => x.id === f.id);
    if (!fila) throw error('La fuente no trae la finalidad ' + f.id + '.');
    if (fila.base_juridica !== f.baseNueva) {
      throw error('La base juridica de ' + f.id + ' no es la que pidio la revision.');
    }
    if (fila.estado_habilitacion !== ESTADO_NUEVO) {
      throw error('El estado de habilitacion de ' + f.id + ' no es el que pidio la revision.');
    }
  }
  const h = (matriz.finalidades || []).find((x) => x.id === '10.3(h)');
  if (!h || h.estado_habilitacion !== 'No habilitada - pendiente de entrega de informacion por la Empresa') {
    throw error('El estado de 10.3(h) cambio y la revision dice que se mantiene.');
  }
}

// ---------------------------------------------------------------------------
// Programa
// ---------------------------------------------------------------------------

function main() {
  const registro = [];
  let cambios = 0;

  // ------------------------------------------------------- 1. fuente (J4)
  if (!fs.existsSync(FUENTE_MATRIZ)) throw error('No existe ' + FUENTE_MATRIZ);
  let fuente = fs.readFileSync(FUENTE_MATRIZ, 'utf8');
  const fuenteAntes = fuente;
  fuente = corregirMatriz(fuente, registro);
  verificarMatriz(fuente); // la fuente tiene que quedar como la pide la revision
  JSON.parse(fuente); // y seguir siendo JSON valido
  if (fuente !== fuenteAntes) {
    fs.writeFileSync(FUENTE_MATRIZ, fuente, 'utf8');
    cambios++;
  }
  console.log('1. fuente config/matriz-finalidades.json (J4)');

  // ------------------------------------------------------- 2. regenerar
  // La matriz es un bloque generado: primero se regenera el Anexo con la fuente
  // nueva y despues se corrige a mano el resto.
  if (cambios > 0) {
    const salidaGen = execFileSync(process.execPath, [GENERADOR], {
      cwd: SERVICE_ROOT,
      encoding: 'utf8',
    });
    console.log(salidaGen.trim().split('\n').map((l) => '   ' + l).join('\n'));
  } else {
    console.log('2. (sin cambios en la fuente: no se regenera)');
  }

  // ------------------------------------------------------- 3. HTML a mano
  if (!fs.existsSync(HTML_LEGAL)) throw error('No existe ' + HTML_LEGAL);
  let html = fs.readFileSync(HTML_LEGAL, 'utf8');
  const crlfAntes = (html.match(/\r\n/g) || []).length;
  let cambiosHtml = 0;
  for (const edit of EDICIONES_HTML) {
    const antes = html;
    if (edit.ancla !== undefined) {
      html = insertar(html, edit.ancla, edit.contenido, edit.etiqueta, registro);
    } else {
      html = aplicar(html, edit, registro);
    }
    if (html !== antes) cambiosHtml++;
  }
  console.log('3. Anexo de Encargo (J12, J14-1, J9, J6/D1, J5, C-1)');

  // ------------------------------------------------------- 4. verificar antes de escribir
  verificarHtml(html);

  const crlfDespues = (html.match(/\r\n/g) || []).length;
  if (crlfDespues !== crlfAntes) {
    throw error('El EOL cambio: CRLF antes ' + crlfAntes + ', despues ' + crlfDespues + '.');
  }
  const noAscii = new Set();
  for (let i = 0; i < html.length; i++) {
    if (html.charCodeAt(i) > 127) {
      noAscii.add('U+' + html.charCodeAt(i).toString(16).toUpperCase());
    }
  }
  if (noAscii.size) {
    throw error('El HTML trae caracteres no ASCII: ' + [...noAscii].join(', '));
  }
  const prohibidos = new Set();
  for (const c of html) {
    const q = c.codePointAt(0);
    if ((q >= 0x4e00 && q <= 0x9fff) || (q >= 0x0400 && q <= 0x04ff) || (q >= 0xac00 && q <= 0xd7af)) {
      prohibidos.add('U+' + q.toString(16));
    }
  }
  if (prohibidos.size) throw error('Caracteres prohibidos: ' + [...prohibidos].join(', '));

  // ------------------------------------------------------- 5. escribir las dos copias
  if (cambiosHtml > 0) {
    fs.writeFileSync(HTML_LEGAL, html, 'utf8');
    fs.writeFileSync(HTML_SITIO, html, 'utf8');
  }
  const legal = fs.readFileSync(HTML_LEGAL);
  const sitio = fs.readFileSync(HTML_SITIO);
  if (!legal.equals(sitio)) throw error('legal/ y sitio/ no quedaron byte a byte identicos.');

  // ------------------------------------------------------- 6. el generador dice OK
  const check = execFileSync(process.execPath, [GENERADOR, '--check'], {
    cwd: SERVICE_ROOT,
    encoding: 'utf8',
  });
  console.log('\n=== VERIFICACION DEL GENERADOR ===');
  console.log(check.trim().split('\n').map((l) => '   ' + l).join('\n'));
  if (!/VERIFICACION OK/.test(check)) {
    throw error('El generador dice que el Anexo no esta al dia con sus fuentes.');
  }

  console.log('\n=== CORRECCIONES ===');
  for (const linea of registro) console.log('   ' + linea);

  console.log('\n=== RESUMEN ===');
  console.log('   cambios aplicados en esta corrida: ' + (cambios + cambiosHtml));
  console.log('   legal/anexo-encargo.html bytes : ' + legal.length);
  console.log('   legal/anexo-encargo.html sha256: ' + sha256(legal));
  console.log('   sitio/ identico a legal/      : si');
  console.log('   EOL                            : CRLF=' + crlfDespues + ' (LF puro)');
  console.log('   caracteres no ASCII en el HTML : 0');
  console.log('   texto de la revision presente : si (verificacion completa)');
  if (cambios === 0 && cambiosHtml === 0) {
    console.log('\nOK, ya aplicado.');
  }
}

try {
  main();
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(err.codigo || 3);
}
