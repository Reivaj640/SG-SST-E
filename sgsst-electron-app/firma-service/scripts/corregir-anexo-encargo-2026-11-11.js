#!/usr/bin/env node
/**
 * Corrige el Anexo de Encargo de la version 2026-11-09 a la version
 * 2026-11-11, con el cambio de fondo que pide el dictamen legal del
 * 11-nov-2026.
 *
 * QUE CORRIGE
 * ------------
 * El parrafo "Lo que queda pendiente" de la seccion 5 enumeraba como
 * pendientes, entre otros, (v) la aceptacion del CDPA en la consola de
 * Workspace y (vi) la confirmacion de que la cuenta empresarial esta activa
 * con la credencial del servidor migrada y probada con un envio real. Los
 * dos se cerraron el 10-nov-2026, y el texto seguia diciendo que no estaban
 * cumplidos. Ademas, el propio parrafo (viii) pedia la confirmacion escrita
 * del abogado sobre el instrumento bilateral, la contrafirma, el alcance de
 * los canales y el papel de Google: eso quedo respondido el 11-nov-2026 en
 * el dictamen legal del expediente.
 *
 * Este Anexo no estaba suscrito por nadie (el suscrito es el 2026-11-06,
 * que queda archivado y no se edita nunca), pero su huella esta registrada
 * en el manifiesto y citada en el expediente: por eso es una version nueva
 * por fecha y no una correccion en silencio. La v1.3 del Anexo de Nube
 * remite a esta.
 *
 * La version y la fecha del documento salen de la fuente
 * `config/matriz-finalidades.json` (campo `instruccion`), que es la que
 * escribe `scripts/generar-anexo-encargo.js`. Este script solo aplica los
 * parches de texto libre y despues el generador se vuelve a correr: el
 * `--check` del generador tiene que seguir dando 0.
 *
 * Idempotente: siempre parte del resultado regenerado.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { aplicarBloque, contieneBloque } = require('./lib/aplicar-parches');

const raiz = path.join(__dirname, '..', '..');
const legal = path.join(raiz, 'legal');
const sitio = path.join(raiz, '..', 'sitio');
const DESTINO = path.join(legal, 'anexo-encargo.html');
const DESTINO_SITIO = path.join(sitio, 'anexo-encargo.html');

const VERSION_VIEJA = '2026-11-09';
const VERSION_NUEVA = '2026-11-11';

// El HTML usa entidades HTML, asi que este archivo queda en ASCII puro.
const PARCHES = [
  [
    'Seccion 5: lo que queda pendiente y lo que ya esta cumplido',
    [
      '<p><strong>Lo que queda pendiente.</strong> La decisi&oacute;n operativa es migrar el canal transaccional a una',
      'cuenta empresarial de Google Workspace vinculada por el CDPA, y quedan pendientes los pasos siguientes, y ninguno',
      'de ellos se declara cumplido en este anexo: (i) el documento que demuestra las medidas de seguridad del canal de',
      'correo, que es la responsabilidad demostrada del par&aacute;grafo primero del T&iacute;tulo V; (ii) la evidencia de',
      'lo que el r&eacute;gimen de transferencias internacionales exija a la Empresa como Responsable; la Circular Externa',
      '002 de 2025 no aplica a este canal, porque su &aacute;mbito son los procesos de transferencia de tecnolog&iacute;a',
      '(seg&uacute;n la conclusi&oacute;n de este Anexo); (iii) la declaraci&oacute;n de la transferencia en el Registro',
      'Nacional de Bases de Datos, a cargo de la Empresa como Responsable y previa confirmaci&oacute;n de que est&aacute;',
      'inscrita; y (iv) la pol&iacute;tica de tratamiento de la Empresa que informa al Titular de la transferencia. A esos',
      'pasos se suman los que exige el v&iacute;nculo con el proveedor: (v) la aceptaci&oacute;n o confirmaci&oacute;n de la',
      'incorporaci&oacute;n del CDPA en la consola de administraci&oacute;n de Google Workspace, con el registro de la fecha',
      'de efectividad y de la evidencia correspondiente, a cargo de Gesstiar S.A.S.; (vi) la confirmaci&oacute;n de que la',
      'cuenta empresarial est&aacute; activa, con verificaci&oacute;n en dos pasos y con el m&eacute;todo de autenticaci&oacute;n',
      'del canal, incluida la migraci&oacute;n efectiva de la credencial del servidor y su comprobaci&oacute;n con un',
      'env&iacute;o real, a cargo de Gesstiar S.A.S.; (vii) la creaci&oacute;n y verificaci&oacute;n de los alias de',
      'privacidad, soporte e incidentes del dominio, a cargo de Gesstiar S.A.S.; (viii) la confirmaci&oacute;n escrita',
      'del abogado sobre el instrumento bilateral, la contrafirma, el alcance de los canales y el papel de Google para',
      'los datos de cuenta y la telemetr&iacute;a, a cargo de Gesstiar S.A.S.; y (ix) la suscripci&oacute;n de esta',
      'versi&oacute;n ' + VERSION_VIEJA + ' del Anexo de Encargo por la Empresa y su contrafirma por el Encargado, a cargo de la',
      'Empresa y de Gesstiar S.A.S. <strong>Este Anexo declara lo que est&aacute; hecho y deja lo que falta con nombre y',
      'responsable: no afirma que estos pasos ya est&eacute;n cumplidos.</strong></p>',
    ],
    [
      '<p><strong>Lo que queda pendiente.</strong> La migraci&oacute;n del canal transaccional a una cuenta empresarial de',
      'Google Workspace vinculada por el CDPA qued&oacute; ejecutada; de los pasos que ese proceso exige, los que siguen',
      'pendientes son estos, y ninguno de ellos se declara cumplido en este anexo: (i) el documento que demuestra las',
      'medidas de seguridad del canal de correo, que es la responsabilidad demostrada del par&aacute;grafo primero del',
      'T&iacute;tulo V; (ii) la evidencia de lo que el r&eacute;gimen de transferencias internacionales exija a la Empresa',
      'como Responsable; la Circular Externa 002 de 2025 no aplica a este canal, porque su &aacute;mbito son los procesos de',
      'transferencia de tecnolog&iacute;a (seg&uacute;n la conclusi&oacute;n de este Anexo); (iii) la declaraci&oacute;n de la',
      'transferencia en el Registro Nacional de Bases de Datos, a cargo de la Empresa como Responsable y previa',
      'confirmaci&oacute;n de que est&aacute; inscrita; y (iv) la pol&iacute;tica de tratamiento de la Empresa que informa al',
      'Titular de la transferencia. Del v&iacute;nculo con el proveedor solo quedan dos pasos pendientes: (vii) la',
      'creaci&oacute;n y verificaci&oacute;n de los alias de privacidad, soporte e incidentes del dominio, a cargo de',
      'Gesstiar S.A.S.; y (ix) la suscripci&oacute;n de esta versi&oacute;n ' + VERSION_NUEVA + ' del Anexo de Encargo por la Empresa y su',
      'contrafirma por el Encargado, a cargo de la Empresa y de Gesstiar S.A.S. <strong>Este Anexo declara lo que est&aacute;',
      'hecho y deja lo que falta con nombre y responsable: no afirma que estos pasos ya est&eacute;n cumplidos.</strong></p>',
      '<p><strong>Los pasos que ya est&aacute;n cumplidos, con su evidencia.</strong> El resto de los pasos del proceso se',
      'cerraron el 10 de noviembre de 2026, y este Anexo los declara con la evidencia que los sostiene: <strong>(v)</strong>,',
      'el CDPA fue aceptado por el administrador de la cuenta de Google Workspace el 10 de noviembre de 2026, con la',
      'evidencia de la consola registrada en el manifiesto del servicio; <strong>(vi)</strong>, la cuenta empresarial est&aacute;',
      'activa, con verificaci&oacute;n en dos pasos, la credencial del servidor migrada y comprobada con un env&iacute;o real',
      'desde <code>kair@gesstiar.com</code>, con su Message-ID y su <code>Authentication-Results</code>; y',
      '<strong>(viii)</strong>, la confirmaci&oacute;n escrita sobre el instrumento bilateral, la contrafirma, el alcance de',
      'los canales y el papel de Google para los datos de cuenta y la telemetr&iacute;a, que qued&oacute; respondida el 11 de',
      'noviembre de 2026 en el dictamen legal del expediente, y cuya ratificaci&oacute;n por el abogado externo queda a cargo',
      'de Gesstiar S.A.S. <strong>La calificaci&oacute;n del papel del proveedor que ese dictamen fija es la que declara',
      'este Anexo en el numeral 5</strong>: respecto de los datos de la cuenta del administrador y de la telemetr&iacute;a,',
      'que no son datos del cliente, Google trata por cuenta propia y es Responsable del Tratamiento; respecto de los',
      'datos del cliente que transitan por el canal de correo, Google trata por cuenta de K+AIR y queda vinculado por el',
      'CDPA, y la designaci&oacute;n de Subencargado es una figura contractual, no una categor&iacute;a de la Ley 1581 de',
      '2012. Esa calificaci&oacute;n queda condicionada a la vigencia y a la aplicabilidad del CDPA para la cuenta',
      'empresarial, que se verifican y documentan en el expediente del canal.</p>',
    ],
  ],
  [
    'Seccion 5: el Anexo de Nube al que remite es la v1.3',
    [
      'cl&aacute;usula se a&ntilde;ade como regla de cierre del conflicto. <strong>La versi&oacute;n 1.2 del Anexo de Nube',
      'es el texto que se publicar&aacute; y remite a esta versi&oacute;n ' + VERSION_VIEJA + ' de este Anexo de Encargo sin',
      'sustituirla.</strong> A la fecha de esta versi&oacute;n, esa versi&oacute;n 1.2 no est&aacute; todav&iacute;a',
      'suscrito ni contrafirmado: su suscripci&oacute;n, y la de este Anexo de Encargo en su versi&oacute;n ' + VERSION_VIEJA + ',',
      'son pasos pendientes, con nombre y responsable, en esta secci&oacute;n.</p>',
    ],
    [
      'cl&aacute;usula se a&ntilde;ade como regla de cierre del conflicto. <strong>La versi&oacute;n 1.3 del Anexo de Nube',
      'es el texto que se publicar&aacute; y remite a esta versi&oacute;n ' + VERSION_NUEVA + ' de este Anexo de Encargo sin',
      'sustituirla.</strong> A la fecha de esta versi&oacute;n, esa versi&oacute;n 1.3 no est&aacute; todav&iacute;a',
      'suscrito ni contrafirmado: su suscripci&oacute;n, y la de este Anexo de Encargo en su versi&oacute;n ' + VERSION_NUEVA + ',',
      'son pasos pendientes, con nombre y responsable, en esta secci&oacute;n.</p>',
    ],
  ],
  [
    'Seccion 12: la constancia de la version',
    [
      '<p><strong>Constancia de la versi&oacute;n.</strong> Este Anexo de Encargo es la versi&oacute;n',
      '<strong>' + VERSION_VIEJA + '</strong> y es una versi&oacute;n nueva entre las mismas partes: desde su firma por ambas, deja',
    ],
    [
      '<p><strong>Constancia de la versi&oacute;n.</strong> Este Anexo de Encargo es la versi&oacute;n',
      '<strong>' + VERSION_NUEVA + '</strong> y es una versi&oacute;n nueva entre las mismas partes: desde su firma por ambas, deja',
    ],
  ],
  // ---------------------------------------------------------------------------
  // ERRATA DEL 11-nov-2026. Cuatro puntos de este Anexo remitian al Anexo de
  // Nube v1.2, un texto SUPERADO (su bloque de pendientes declaraba como no
  // cumplidos unos pasos que ya se habian cerrado el 10-nov-2026) y que el
  // propio Anexo ya declaraba retirado de la suscripcion en su clausula de
  // prevalencia, donde si nombraba la v1.3. El menu, la seccion 1 (Partes), la
  // seccion 5 (Proveedores externos y subencargados) y la seccion 9 seguian
  // apuntando a la v1.2.
  //
  // Por que esto no es un detalle de redaccion: la seccion 5 dice que el
  // Anexo de Nube v1.2 "forma parte integral de este documento". Eso es una
  // incorporacion por remision (articulo 44 de la Ley 527 de 1999): lo que
  // queda incorporado por el vinculo es el TEXTO al que el vinculo apunta. Con
  // el vinculo apuntando a la v1.2, este Anexo incorporaba un texto que el
  // propio documento declara superado, y que ademas esta publicado y se puede
  // descargar. Firmarlo asi habria incorporado el texto equivocado.
  //
  // La correccion es de CITA, no de contenido: no cambian las partes, el
  // objeto, las obligaciones, los precios ni la distribucion del riesgo. Se
  // hace antes de la suscripcion (este texto nunca fue suscrito ni publicado)
  // y la version suscrita por ASEPLUS el 7-nov-2026 (la 2026-11-06) NO se
  // toca.
  //
  // Los parches van DENTRO de este script y no en el HTML: corregidos a mano,
  // la proxima corrida de este script los borraria.
  // ---------------------------------------------------------------------------
  [
    'Menu: el enlace al Anexo de Nube es el de la v1.3',
    '<li><a href="anexo-nube-v1.2.html">Anexo de nube</a></li>',
    '<li><a href="anexo-nube-v1.3.html">Anexo de nube</a></li>',
  ],
  [
    'Seccion 1: el Anexo de Nube del que se apoya el Encargado es el de la v1.3',
    '<a href="anexo-nube-v1.2.html">Anexo de Nube</a>.</td>',
    '<a href="anexo-nube-v1.3.html">Anexo de Nube</a>.</td>',
  ],
  [
    'Seccion 5: el Anexo de Nube que forma parte integral de este documento es el de la v1.3',
    '<a href="anexo-nube-v1.2.html">Anexo de Nube</a>, versi&oacute;n 1.2, que forma parte',
    '<a href="anexo-nube-v1.3.html">Anexo de Nube</a>, versi&oacute;n 1.3, que forma parte',
  ],
  [
    'Seccion 9: la infraestructura del servicio se describe en el Anexo de Nube de la v1.3',
    '<a href="anexo-nube-v1.2.html">Anexo de Nube</a>. La Empresa no recibe copias',
    '<a href="anexo-nube-v1.3.html">Anexo de Nube</a>. La Empresa no recibe copias',
  ],
];

function construir() {
  let texto = fs.readFileSync(DESTINO, 'utf8');
  for (const [motivo, ancla, nuevo] of PARCHES) {
    // El parche es idempotente: si el texto nuevo ya esta en el documento,
    // no se vuelve a aplicar. Hace falta porque el generador solo reescribe
    // los bloques marcados y deja intacto el parrafo del 5.
    if (contieneBloque(texto, nuevo)) {
      console.log('  (ya aplicado) ' + motivo);
      continue;
    }
    texto = aplicarBloque(texto, motivo, ancla, nuevo);
  }

  // Ninguna mencion de la version anterior puede quedar: el documento se
  // identifica con una sola version, en todo el texto.
  const remanentes = texto.split(VERSION_VIEJA).length - 1;
  if (remanentes !== 0) {
    throw new Error(
      'Quedan ' + remanentes + ' menciones a ' + VERSION_VIEJA + '.'
    );
  }

  // ERRATA DEL 11-nov-2026: ninguna remision puede quedar apuntando al Anexo
  // de Nube v1.2. Ese texto esta superado (su bloque de pendientes esta
  // desactualizado) y no es el que el servicio suscribe: el vinculo de la
  // seccion 5 es una incorporacion por remision (articulo 44 de la Ley 527 de
  // 1999), y una remision equivocada incorpora el texto equivocado.
  const remanentesNube = texto.split('anexo-nube-v1.2.html').length - 1;
  if (remanentesNube !== 0) {
    throw new Error(
      'Quedan ' + remanentesNube + ' referencias al Anexo de Nube v1.2.'
    );
  }

  fs.writeFileSync(DESTINO, texto, 'utf8');
  fs.copyFileSync(DESTINO, DESTINO_SITIO);

  const buf = fs.readFileSync(DESTINO);
  console.log('anexo-encargo.html: ' + buf.length + ' bytes');
  console.log('SHA-256: ' + crypto.createHash('sha256').update(buf).digest('hex'));
  console.log('sitio/anexo-encargo.html: copia byte a byte');
}

if (require.main === module) construir();

module.exports = { PARCHES, construir };
