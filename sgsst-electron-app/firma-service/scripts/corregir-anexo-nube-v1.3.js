#!/usr/bin/env node
/**
 * Construye el Anexo de Nube v1.3 a partir de la v1.2.
 *
 * POR QUE UNA VERSION NUEVA Y NO UNA CORRECCION DE LA v1.2
 * -------------------------------------------------------
 * La v1.2 no la ha suscrito nadie: en la base, la suscripcion de ASEPLUS es
 * la v1.1, del 5-nov-2026. Podria, entonces, corregirse sin invalidar
 * ninguna firma. Pero su huella ya esta registrada en el manifiesto y citada
 * en el expediente, y el propio Anexo declara que "toda modificacion de este
 * Anexo se publica como version nueva con su propia huella SHA-256".
 * Cambiar los bytes conservando el numero de version y la fecha haria que dos
 * documentos distintos se presentaran como la misma version. Por eso: v1.3.
 *
 * QUE CORRIGE
 * ------------
 * La v1.2 declara que P1, P2, P4 y P5 "no estan cumplidos", y que el ultimo
 * envio real que puede probarse es el del 26 de octubre de 2026. Los cuatro
 * se cerraron el 10-nov-2026:
 *
 *   P1  el CDPA fue aceptado por el administrador de la cuenta el 10-nov-2026
 *   P2  kair@gesstiar.com esta activa, con verificacion en dos pasos
 *   P4  SPF, DKIM y DMARC de gesstiar.com estan publicados y verificados
 *   P5  hay envio real desde kair@gesstiar.com, con su Message-ID y su
 *       Authentication-Results (dkim=pass; spf=pass; dmarc=pass)
 *
 * Siguen pendientes: P3 (los alias del dominio) y P6 (revocar las app
 * passwords de la cuenta anterior). El texto los declara como pendientes.
 *
 * La v1.3 remite ademas al Anexo de Encargo version 2026-11-11, que es la
 * version que se va a suscribir en P8.
 *
 * Idempotente: siempre parte de la v1.2, nunca de su propia salida.
 *
 * COMO BUSCA LAS ANCLAS
 * ---------------------
 * El HTML es LF puro, sin BOM. Cada parche localiza su bloque comparando las
 * lineas SIN la indentacion inicial, exige que el bloque aparezca una sola vez
 * y conserva la indentacion original de cada linea. Asi el parche no depende de
 * quantos espacios tiene el archivo, pero una ancla que no es unica falla
 * igual (PROMPT 5.11 y 5.16).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const raiz = path.join(__dirname, '..', '..');
const legal = path.join(raiz, 'legal');
const sitio = path.join(raiz, '..', 'sitio');

const ORIGEN = path.join(legal, 'anexo-nube-v1.2.html');
const DESTINO = path.join(legal, 'anexo-nube-v1.3.html');
const DESTINO_SITIO = path.join(sitio, 'anexo-nube-v1.3.html');
const ENCARGARGO_VIEJO = '2026-11-09';
const ENCARGARGO_NUEVO = '2026-11-11';

// El HTML usa entidades HTML, asi que este archivo queda en ASCII puro.
const PARCHES = [
  [
    'Encabezado: el titulo nombra la v1.3',
    '(versi&oacute;n 1.2)</title>',
    '(versi&oacute;n 1.3)</title>',
  ],
  [
    'Encabezado: la meta description nombra la v1.3 y su fecha',
    'Versi&oacute;n 1.2, del 9 de noviembre de 2026, versi&oacute;n susceptible de suscripci&oacute;n por la Empresa',
    'Versi&oacute;n 1.3, del 11 de noviembre de 2026, versi&oacute;n susceptible de suscripci&oacute;n por la Empresa',
  ],
  [
    'Encabezado: el subtitulo nombra la v1.3 y su fecha',
    [
      '<p class="sub">Versi&oacute;n 1.2 del Anexo de Nube &middot; anexo al Anexo de Encargo de',
      'Tratamiento de Datos Personales &middot; versi&oacute;n susceptible de suscripci&oacute;n por la Empresa',
      '&middot; 9 de noviembre de 2026</p>',
    ],
    [
      '<p class="sub">Versi&oacute;n 1.3 del Anexo de Nube &middot; anexo al Anexo de Encargo de',
      'Tratamiento de Datos Personales &middot; versi&oacute;n susceptible de suscripci&oacute;n por la Empresa',
      '&middot; 11 de noviembre de 2026</p>',
    ],
  ],
  [
    'Encabezado: el enlace de navegacion apunta a la v1.3',
    '<li><a href="anexo-nube-v1.2.html">Anexo de nube</a></li>',
    '<li><a href="anexo-nube-v1.3.html">Anexo de nube</a></li>',
  ],
  [
    'Encabezado: la linea de fecha nombra la v1.3',
    '<p class="fecha">Versi&oacute;n 1.2 &middot; 9 de noviembre de 2026</p>',
    '<p class="fecha">Versi&oacute;n 1.3 &middot; 11 de noviembre de 2026</p>',
  ],
  [
    'Que version es esta: la v1.3 y la v1.2 como referencia',
    [
      '<p class="fecha"><strong>Qu&eacute; versi&oacute;n es esta y cu&aacute;l se firma.</strong> Esta es la versi&oacute;n',
      '1.2 del Anexo de Nube: es la que la Empresa suscribe y la que el servicio registra con su huella SHA-256. La',
      'versi&oacute;n 1.1, publicada el 5 de noviembre de 2026, es la versi&oacute;n que ASEPLUS CARIBE S.A.S. suscribi&oacute;',
      'ese d&iacute;a: queda como la versi&oacute;n ya suscrita, y esta versi&oacute;n 1.2 no altera esa suscripci&oacute;n ni sus',
      'efectos sobre los registros ya generados. La versi&oacute;n 1.0 que sigue publicada en este sitio es el',
      '<strong>modelo</strong> anterior: nunca fue susceptible de suscripci&oacute;n, porque se reservaba a s&iacute; hasta',
      'completar su bloque de pendientes, y queda como referencia hist&oacute;rica. El estado real del servicio est&aacute;',
      'declarado en el &sect;4 y en el &sect;5 de este documento, con la limitaci&oacute;n a la vista.</p>',
    ],
    [
      '<p class="fecha"><strong>Qu&eacute; versi&oacute;n es esta y cu&aacute;l se firma.</strong> Esta es la versi&oacute;n',
      '1.3 del Anexo de Nube: es la que la Empresa suscribe y la que el servicio registra con su huella SHA-256. La',
      'versi&oacute;n 1.1, publicada el 5 de noviembre de 2026, es la versi&oacute;n que ASEPLUS CARIBE S.A.S. suscribi&oacute;',
      'ese d&iacute;a: queda como la versi&oacute;n ya suscrita, y esta versi&oacute;n 1.3 no altera esa suscripci&oacute;n ni sus',
      'efectos sobre los registros ya generados. La versi&oacute;n 1.2, publicada el 9 de noviembre de 2026, tambi&eacute;n',
      'queda como referencia: nunca lleg&oacute; a ser susceptible de suscripci&oacute;n y se retira de la suscripci&oacute;n',
      'con esta versi&oacute;n 1.3, porque su bloque de pendientes declaraba como no cumplidos unos pasos que ya se',
      'hab&iacute;an cerrado el 10 de noviembre de 2026. La versi&oacute;n 1.0 que sigue publicada en este sitio es el',
      '<strong>modelo</strong> anterior: nunca fue susceptible de suscripci&oacute;n, porque se reservaba a s&iacute; hasta',
      'completar su bloque de pendientes, y queda como referencia hist&oacute;rica. El estado real del servicio est&aacute;',
      'declarado en el &sect;4 y en el &sect;5 de este documento, con la limitaci&oacute;n a la vista.</p>',
    ],
  ],
  [
    'Estado declarado: el bloque de pendientes separa lo cerrado de lo que sigue abierto',
    [
      '<li><strong>Pendientes del proceso de regularizaci&oacute;n del canal de correo (responsable: el owner).</strong>',
      'Los siguientes puntos <strong>no est&aacute;n cumplidos</strong> y este Anexo no los declara cumplidos:',
      '<strong>P1</strong>, aceptar o confirmar la incorporaci&oacute;n del CDPA en la consola de Workspace y registrar',
      'su fecha de efectividad y la evidencia; <strong>P2</strong>, confirmar que',
      '<code>kair@gesstiar.com</code> est&aacute; activa, con verificaci&oacute;n en dos pasos y con el m&eacute;todo de',
      'autenticaci&oacute;n elegido; <strong>P3</strong>, crear y verificar los alias <code>privacidad@</code>,',
      '<code>soporte@</code> e <code>incidentes@</code> de <code>gesstiar.com</code>; <strong>P4</strong>, verificar',
      'SPF, DKIM y DMARC de <code>gesstiar.com</code>; <strong>P5</strong>, cambiar la credencial del servidor,',
      'reiniciar y ejecutar un env&iacute;o real, guardando el Message-ID, el',
      '<code>Authentication-Results</code> y el remitente visible; y <strong>P6</strong>, revocar las app passwords',
      'de la cuenta de correo anterior del Encargado y verificar que no queda ninguna en el archivo de entorno del',
      'servidor. Todos son actos del owner en consolas a las que el servicio no tiene acceso: ninguno los cierra',
      'una redacci&oacute;n.</li>',
    ],
    [
      '<li><strong>Pendientes del proceso de regularizaci&oacute;n del canal de correo (responsable: el owner).</strong>',
      'Los siguientes puntos <strong>no est&aacute;n cumplidos</strong> y este Anexo no los declara cumplidos:',
      '<strong>P3</strong>, crear y verificar los alias <code>privacidad@</code>,',
      '<code>soporte@</code> e <code>incidentes@</code> de <code>gesstiar.com</code>; y <strong>P6</strong>, revocar las app',
      'passwords de la cuenta de correo anterior del Encargado y verificar que no queda ninguna en el archivo de',
      'entorno del servidor. Los dem&aacute;s est&aacute;n cumplidos y este Anexo los declara con su evidencia:',
      '<strong>P1</strong>, el CDPA fue aceptado por el administrador de la cuenta el 10 de noviembre de 2026, con la',
      'evidencia registrada en el manifiesto del servicio; <strong>P2</strong>, <code>kair@gesstiar.com</code> est&aacute;',
      'activa, con verificaci&oacute;n en dos pasos y autenticaci&oacute;n por app password; <strong>P4</strong>, SPF,',
      'DKIM y DMARC de <code>gesstiar.com</code> est&aacute;n publicados y verificados; y <strong>P5</strong>, el',
      'env&iacute;o real desde <code>kair@gesstiar.com</code> qued&oacute; hecho, con su Message-ID y su',
      '<code>Authentication-Results</code>, que se declaran en la ficha t&eacute;cnica del &sect;5. Los dos pendientes',
      'que quedan son actos del owner en consolas a las que el servicio no tiene acceso: ninguno los cierra una',
      'redacci&oacute;n.</li>',
    ],
  ],
  [
    'Seccion 3: la cuenta ya esta activa y la credencial ya migrada',
    [
      'configurada en el servicio. La activaci&oacute;n de esa cuenta y la migraci&oacute;n de la credencial son los',
      'pendientes P2 y P5, declarados en el estado declarado de la secci&oacute;n inicial y en la ficha t&eacute;cnica del',
      '&sect;5; hasta que se cierren, el &uacute;ltimo env&iacute;o real que puede probarse es el del 26 de octubre de 2026.',
    ],
    [
      'configurada en el servicio. La activaci&oacute;n de esa cuenta y la migraci&oacute;n de la credencial del servidor se',
      'cerraron el 10 de noviembre de 2026 (pendientes P2 y P5): la cuenta est&aacute; activa, con verificaci&oacute;n en',
      'dos pasos, y hay un env&iacute;o real con ese remitente, con su Message-ID y su',
      '<code>Authentication-Results</code> (SPF, DKIM y DMARC). La evidencia est&aacute; en la ficha t&eacute;cnica del',
      '&sect;5. Los &uacute;ltimos env&iacute;os reales de la cuenta anterior siguen siendo evidencia hist&oacute;rica del',
      'canal y no se borran.',
    ],
  ],
  [
    'Ficha tecnica: el envio real con el dominio ya existe',
    [
      '<strong>Evidencia hist&oacute;rica y evidencia pendiente, sin mezclarlas:</strong> los cuatro env&iacute;os',
      'reales de producci&oacute;n del 26-oct-2026 (dos invitaciones y dos c&oacute;digos de un solo uso) salieron',
      'desde la cuenta de correo anterior del Encargado y tienen identificador de mensaje del dominio',
      '<code>@gmail.com</code>, registrados en <code>gh_firma_eventos</code> con los eventos',
      '<code>INVITE_SENT</code> y <code>OTP_SENT</code>; ese es el &uacute;ltimo env&iacute;o real que puede probarse',
      'y es la evidencia hist&oacute;rica del canal. <strong>El env&iacute;o real con el dominio',
      '<code>@gesstiar.com</code> todav&iacute;a no se ha hecho</strong>: es el pendiente P5, a cargo del owner, y',
      'hasta que exista un env&iacute;o con ese remitente, con su <code>Message-ID</code>, su',
      '<code>Authentication-Results</code> (SPF, DKIM y DMARC) y el remitente visible, este Anexo no declara',
      'ninguna evidencia del remitente nuevo. El destinatario nunca es la cuenta de la Empresa: el c&oacute;digo de',
    ],
    [
      '<strong>Evidencia hist&oacute;rica y evidencia vigente, sin mezclarlas:</strong> los cuatro env&iacute;os',
      'reales de producci&oacute;n del 26-oct-2026 (dos invitaciones y dos c&oacute;digos de un solo uso) salieron',
      'desde la cuenta de correo anterior del Encargado y tienen identificador de mensaje del dominio',
      '<code>@gmail.com</code>, registrados en <code>gh_firma_eventos</code> con los eventos',
      '<code>INVITE_SENT</code> y <code>OTP_SENT</code>; esa es la evidencia hist&oacute;rica del canal.',
      '<strong>El env&iacute;o real con el dominio <code>@gesstiar.com</code> ya est&aacute; hecho</strong> (pendiente',
      'P5, cerrado el 10 de noviembre de 2026): el remitente es <code>kair@gesstiar.com</code>, con',
      '<code>Message-ID</code> <code>&lt;5db3377d-4565-e49b-0b64-cd0b5ce2b4ca@gesstiar.com&gt;</code> y',
      '<code>Authentication-Results: dkim=pass; spf=pass; dmarc=pass</code>, con el remitente visible. Ese es el',
      'env&iacute;o real que prueba el canal vigente. Los env&iacute;os anteriores no se borran: quedan como',
      'evidencia hist&oacute;rica. El destinatario nunca es la cuenta de la Empresa: el c&oacute;digo de',
    ],
  ],
  [
    'Ficha tecnica: la credencial de Workspace ya esta instalada y probada',
    [
      'de esta secci&oacute;n. <strong>Estado de la revocaci&oacute;n en esta versi&oacute;n:</strong> la',
      'revocaci&oacute;n de las app passwords de la cuenta de correo anterior del Encargado es el pendiente P6, a',
      'cargo del owner, y hasta que se ejecute no consta revocada ninguna credencial. La credencial de la cuenta de',
      'Google Workspace todav&iacute;a no se ha instalado ni probado (P2 y P5).</td>',
    ],
    [
      'de esta secci&oacute;n. <strong>Estado de la revocaci&oacute;n en esta versi&oacute;n:</strong> la',
      'revocaci&oacute;n de las app passwords de la cuenta de correo anterior del Encargado es el pendiente P6, a',
      'cargo del owner, y hasta que se ejecute no consta revocada ninguna credencial. La credencial de la cuenta de',
      'Google Workspace, en cambio, ya est&aacute; instalada y probada (P2 y P5, cerrados el 10 de noviembre de',
      '2026): el env&iacute;o real declarado en la fila anterior sali&oacute; con ella.</td>',
    ],
  ],
  [
    'Ficha tecnica: la introduccion ya no dice que los apartados estan pendientes',
    [
      'decisi&oacute;n, el texto lo dice de forma expresa. <strong>Con el cambio de cuenta (esta versi&oacute;n 1.2), los',
      'apartados que dependen del estado de la cuenta de Google Workspace y de la credencial del servidor est&aacute;n',
      'pendientes de verificaci&oacute;n por el owner (P2, P5 y P6)</strong>, y el texto lo dice de forma expresa: no se',
      'afirma ninguna verificaci&oacute;n que no se haya hecho, ni se declara un env&iacute;o que no se haya ejecutado. La',
    ],
    [
      'decisi&oacute;n, el texto lo dice de forma expresa. <strong>Con el cambio de cuenta (esta versi&oacute;n 1.3), los',
      'apartados que depend&iacute;an del estado de la cuenta de Google Workspace y de la credencial del servidor ya',
      'est&aacute;n verificados (P2 y P5, cerrados el 10 de noviembre de 2026)</strong>, y los que siguen pendientes se',
      'declaran como tales (P6): no se afirma ninguna verificaci&oacute;n que no se haya hecho, ni se declara un env&iacute;o',
      'que no se haya ejecutado. La',
    ],
  ],
  [
    'Seccion 9: la version, la que sustituye y la que se suscribe',
    [
      'devoluci&oacute;n, supresi&oacute;n y auditor&iacute;a. <strong>Versi&oacute;n:</strong> 1.2. <strong>Esta versi&oacute;n',
      '1.2 sustituye a la versi&oacute;n 1.1, que queda como la versi&oacute;n ya suscrita por ASEPLUS CARIBE S.A.S. el 5 de',
      'noviembre de 2026</strong>: no altera esa suscripci&oacute;n ni sus efectos sobre los registros ya generados, y la',
      'versi&oacute;n 1.0, que se public&oacute; &uacute;nicamente como referencia, nunca fue susceptible de suscripci&oacute;n',
      'porque se reservaba a s&iacute; hasta completar su bloque de pendientes. <strong>Esta versi&oacute;n 1.2 se',
      'suscribe nuevamente por ambas partes</strong>, y su suscripci&oacute;n por ASEPLUS CARIBE S.A.S. es un acto pendiente',
      'del owner (P8).',
    ],
    [
      'devoluci&oacute;n, supresi&oacute;n y auditor&iacute;a. <strong>Versi&oacute;n:</strong> 1.3. <strong>Esta versi&oacute;n',
      '1.3 sustituye a la versi&oacute;n 1.2, que nunca lleg&oacute; a ser susceptible de suscripci&oacute;n</strong>, y no',
      'altera la versi&oacute;n 1.1, que queda como la versi&oacute;n ya suscrita por ASEPLUS CARIBE S.A.S. el 5 de noviembre',
      'de 2026: no altera esa suscripci&oacute;n ni sus efectos sobre los registros ya generados. La versi&oacute;n 1.0, que',
      'se public&oacute; &uacute;nicamente como referencia, nunca fue susceptible de suscripci&oacute;n porque se reservaba a',
      's&iacute; hasta completar su bloque de pendientes. <strong>Esta versi&oacute;n 1.3 se suscribe por ambas partes</strong>,',
      'y su suscripci&oacute;n por ASEPLUS CARIBE S.A.S. es un acto pendiente del owner (P8).',
    ],
  ],
  [
    'Seccion 9: la remision al Anexo de Encargo no es una sustitucion',
    [
      'en su &sect;12 (&laquo;Firmas&raquo;) los dos actos del instrumento. <strong>Esta versi&oacute;n 1.2 no sustituye ese',
      'instrumento por una cl&aacute;usula unilateral</strong>: lo remite y documenta la misma calificaci&oacute;n con la',
    ],
    [
      'en su &sect;12 (&laquo;Firmas&raquo;) los dos actos del instrumento. <strong>Esta versi&oacute;n 1.3 no sustituye ese',
      'instrumento por una cl&aacute;usula unilateral</strong>: lo remite y documenta la misma calificaci&oacute;n con la',
    ],
  ],
  [
    'Seccion 9: la remision al Anexo de Encargo la hace esta version, no la anterior',
    'Esta versi&oacute;n 1.2 <strong>remite</strong>',
    'Esta versi&oacute;n 1.3 <strong>remite</strong>',
  ],
  [
    'Seccion 10: los dos actos de la v1.3 estan pendientes',
    [
      'suscripci&oacute;n. <strong>Los dos actos de esta versi&oacute;n 1.2 est&aacute;n pendientes</strong>: la',
      'suscripci&oacute;n de la v1.2 por ASEPLUS CARIBE S.A.S. y su contrafirma son un acto del owner (P8), y hasta que',
    ],
    [
      'suscripci&oacute;n. <strong>Los dos actos de esta versi&oacute;n 1.3 est&aacute;n pendientes</strong>: la',
      'suscripci&oacute;n de la v1.3 por ASEPLUS CARIBE S.A.S. y su contrafirma son un acto del owner (P8), y hasta que',
    ],
  ],
  [
    'Seccion 10: la incorporacion al Anexo de Encargo',
    'Empresa, este Anexo de Nube v1.2 se suscribe con ella y remite a sus &sect;3 (&laquo;Actividades del',
    'Empresa, este Anexo de Nube v1.3 se suscribe con ella y remite a sus &sect;3 (&laquo;Actividades del',
  ],
  [
    'Pie: la version y la fecha',
    [
      '<p>K+AIR &mdash; Gesstiar S.A.S. &middot; Colombia &middot; Anexo de Nube, versi&oacute;n 1.2 &middot;',
      '9 de noviembre de 2026</p>',
    ],
    [
      '<p>K+AIR &mdash; Gesstiar S.A.S. &middot; Colombia &middot; Anexo de Nube, versi&oacute;n 1.3 &middot;',
      '11 de noviembre de 2026</p>',
    ],
  ],
];

/** Una linea sin su indentacion inicial: sirve para comparar. */
const sinSangria = (s) => s.replace(/^[ \t]+/, '');

/**
 * Localiza el bloque de lineas cuyo texto (sin sangria) coincide con el
 * ancla y lo reemplaza por el texto nuevo, conservando la sangria original
 * de cada linea. Exige que el ancla aparezca UNA sola vez.
 *
 * Cuando el ancla es una sola linea, primero se busca una linea IGUAL; si no
 * hay ninguna, se busca una linea que la CONTENGA, y en ese caso solo se
 * reemplaza ese fragmento, dejando el resto de la linea intacto. En los dos
 * caminos el ancla tiene que ser unica: si aparece mas de una vez, el
 * script falla (PROMPT 5.11 y 5.16).
 */
function aplicarBloque(texto, motivo, ancla, nuevo) {
  const lineas = texto.split('\n');

  if (!Array.isArray(ancla)) {
    const nuevoLineas = Array.isArray(nuevo) ? nuevo : [nuevo];
    let iguales = 0;
    let igualIndice = -1;
    for (let i = 0; i < lineas.length; i++) {
      if (sinSangria(lineas[i]) === sinSangria(ancla)) { iguales += 1; igualIndice = i; }
    }
    if (iguales === 1) {
      const original = lineas[igualIndice];
      const prefijo = (original.match(/^[ \t]*/) || [''])[0];
      lineas.splice(
        igualIndice, 1,
        ...nuevoLineas.map((linea) => (
          sinSangria(linea) === '' ? linea : prefijo + sinSangria(linea)
        ))
      );
      return lineas.join('\n');
    }

    // Fragmento dentro de una linea: tiene que ser unico en todo el archivo.
    let contenidos = 0;
    let contenidoIndice = -1;
    let contenidoPos = -1;
    for (let i = 0; i < lineas.length; i++) {
      const pos = lineas[i].indexOf(ancla);
      if (pos !== -1) { contenidos += 1; contenidoIndice = i; contenidoPos = pos; }
    }
    if (contenidos !== 1) {
      throw new Error(
        'Ancla con ' + (iguales === 0 ? contenidos : iguales) +
        ' coincidencias: ' + motivo
      );
    }
    const linea = lineas[contenidoIndice];
    const antes = linea.slice(0, contenidoPos);
    const despues = linea.slice(contenidoPos + ancla.length);
    lineas.splice(contenidoIndice, 1, antes + nuevo + despues);
    return lineas.join('\n');
  }

  const viejo = ancla;
  const nuevoLineas = Array.isArray(nuevo) ? nuevo : [nuevo];

  let encontrado = -1;
  let coincidencias = 0;
  for (let i = 0; i + viejo.length <= lineas.length; i++) {
    let ok = true;
    for (let j = 0; j < viejo.length; j++) {
      if (sinSangria(lineas[i + j]) !== sinSangria(viejo[j])) { ok = false; break; }
    }
    if (ok) { coincidencias += 1; encontrado = i; }
  }
  if (coincidencias !== 1) {
    throw new Error(
      'Ancla con ' + coincidencias + ' coincidencias: ' + motivo
    );
  }

  const salida = nuevoLineas.map((linea, j) => {
    const original = lineas[encontrado + j] || '';
    const prefijo = (original.match(/^[ \t]*/) || [''])[0];
    return sinSangria(linea) === '' ? linea : prefijo + sinSangria(linea);
  });

  lineas.splice(encontrado, viejo.length, ...salida);
  return lineas.join('\n');
}

function construir() {
  let texto = fs.readFileSync(ORIGEN, 'utf8');
  for (const [motivo, ancla, nuevo] of PARCHES) {
    texto = aplicarBloque(texto, motivo, ancla, nuevo);
  }

  // La remision al Anexo de Encargo: la v1.3 remite a la version que se va a
  // suscribir en P8. Todas las menciones del instrumento se cambian.
  const antes = texto.split(ENCARGARGO_VIEJO).length - 1;
  if (antes !== 10) {
    throw new Error(
      'Se esperaban 10 menciones a ' + ENCARGARGO_VIEJO + ' y hay ' + antes + '.'
    );
  }
  texto = texto.split(ENCARGARGO_VIEJO).join(ENCARGARGO_NUEVO);

  // ERRATA DEL 11-nov-2026. El parrafo 12 de la v1.3 decia "Esta version 1.2
  // remite" al Anexo de Encargo, dentro de un texto que es la v1.3: se
  // contradecía con la frase siguiente del MISMO parrafo, que si decia "Esta
  // version 1.3 no sustituye ese instrumento". Es una cita equivocada, no un
  // contenido: no cambian las partes, el objeto, las obligaciones ni la
  // distribucion del riesgo. Se corrige antes de la suscripcion (el texto
  // nunca fue suscrito ni publicado) y las versiones ya suscritas (la v1.1 del
  // 5-nov-2026) no se tocan. La correccion va DENTRO de este script y no en el
  // HTML: si se corrigiera el archivo a mano, la proxima corrida de este
  // script (que siempre vuelve del v1.2) la borraria.
  const remisionVieja = texto.split('Esta versi&oacute;n 1.2 <strong>remite</strong>').length - 1;
  if (remisionVieja !== 0) {
    throw new Error(
      'Quedan ' + remisionVieja + ' remisiones que dicen "Esta version 1.2 remite".'
    );
  }

  fs.writeFileSync(DESTINO, texto, 'utf8');
  fs.copyFileSync(DESTINO, DESTINO_SITIO);

  const buf = fs.readFileSync(DESTINO);
  console.log('anexo-nube-v1.3.html: ' + buf.length + ' bytes');
  console.log('SHA-256: ' + crypto.createHash('sha256').update(buf).digest('hex'));
  console.log('sitio/anexo-nube-v1.3.html: copia byte a byte');
}

if (require.main === module) construir();

module.exports = { PARCHES, construir, aplicarBloque };
