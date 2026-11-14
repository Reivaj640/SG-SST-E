'use strict';
/**
 * generar-candidatos-v1.4.js
 *
 * QUE HACE
 * --------
 * Arma los CANDIDATOS de la version nueva del Anexo de Nube (v1.4) y del
 * Anexo de Encargo, en DOS FASES:
 *
 *   FASE 1 - los SIETE reemplazos literales de
 *   `docs/gestion-humana/firma-electronica/propuesta-v1.4-anexo-nube-2026-11-12.md`
 *   (C1 a C7).
 *
 *   FASE 2 - las DETERMINACIONES LEGALES de la mesa L1 a L7, que estan
 *   escritas en `determinaciones-v1.4.js` y cuyo texto literal se LEE de
 *   `dictamen-legal-l1-2026-11-12.md` (L1) y de
 *   `pedido-6-backblaze-v1-4-2026-11-12.md` (L4 y L5). El texto no se
 *   transcribe: se aplica tal cual esta escrito en la determinacion.
 *
 *   FASE 3 - la REGLA DE LA COMPUERTA de la tabla supletoria, que cambio por
 *   decision del owner el 13-nov-2026: la validacion escrita de un tercero
 *   deja de ser requisito para abrir la compuerta. Son tres anclas literales
 *   en el Anexo de Encargo (que es donde esta la tabla del seccion 8).
 *
 *   FASE 4 - el ACTO DE APERTURA de la compuerta (13-nov-2026, S-25): el
 *   owner abrio la compuerta con un acto expreso y fechado, y dos frases
 *   del seccion 8 del texto firmado dejaron de ser ciertas. Son dos anclas
 *   literales en el Anexo de Encargo.
 * *   decision del owner el 13-nov-2026: la validacion escrita de un tercero
 *   deja de ser requisito para abrir la compuerta. Son tres anclas literales
 *   en el Anexo de Encargo (que es donde esta la tabla del seccion 8).
 *
 * QUE NO HACE (y por que importa)
 * --------------------------------
 * - No modifica `legal/anexo-nube-v1.3.html` ni `legal/anexo-encargo.html`: son
 *   textos SUSCRITOS y un texto suscrito no se corrige, se sustituye.
 * - No toca `sitio/` (las copias publicas) ni `legal-readiness.json`: el manifiesto
 *   del repositorio tiene que quedar byte a byte igual que el de produccion, y
 *   publicar un texto que nadie ha firmado haria que el gate dijera "firmado"
 *   sobre un texto que no lo esta.
 * - No publica nada, no enciende ninguna compuerta y no firma nada.
 *
 * DONDE ESCRIBE
 * -------------
 * En `docs/gestion-humana/firma-electronica/candidatos-v1.4/`, que NO viaja en el
 * paquete de despliegue. Son candidatos:-serving para que el abogado revise el
 * TEXTO, no una version publicable.
 *
 * EL GUARD
 * --------
 * Cada "antes" tiene que aparecer EXACTAMENTE una vez en su archivo. Si no, el
 * script no escribe nada y sale con codigo 1: un ancla que casa dos veces o
 * ninguna no se puede reemplazar a ciegas.
 *
 * ASCII puro, LF, sin BOM. Es codigo.
 *
 *   node generar-candidatos-v1.4.js            Arma y escribe (idempotente).
 *   node generar-candidatos-v1.4.js --estado   Dice que haria, sin escribir.
 *   node generar-candidatos-v1.4.js --verificar Solo comprueba los anchors.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..', '..');
const LEGAL = path.join(RAIZ, 'legal');
const SALIDA = path.join(RAIZ, 'docs', 'gestion-humana', 'firma-electronica', 'candidatos-v1.4');

// ---------------------------------------------------------------------------
// LOS REEMPLAZOS DEL ANEXO DE NUBE v1.4 (C1 a C6)
// ---------------------------------------------------------------------------

const NUBE = [
  {
    id: 'C1',
    donde: 'Seccion 1, primer bullet (lineas 90-93)',
    antes:
      '<strong>Esta declaraci&oacute;n es\n'
      + '      condicional</strong>: no afirma que el CDPA haya sido aceptado por el administrador de la cuenta, ni que la\n'
      + '      cuenta est&eacute; activa, ni que los alias existan, ni que el env&iacute;o real con el dominio\n'
      + '      <code>@gesstiar.com</code> ya se haya hecho.',
    despues:
      '<strong>Esta declaraci&oacute;n es condicional en un solo punto</strong>: <strong>no afirma que los alias\n'
      + '      <code>privacidad@</code>, <code>soporte@</code> e <code>incidentes@</code> existan</strong>, porque crearlos y\n'
      + '      verificarlos es el pendiente P3, a cargo del owner. Los dem&aacute;s hechos que sostienen el papel de Google\n'
      + '      &mdash;la aceptaci&oacute;n del CDPA, la cuenta empresarial activa, el env&iacute;o real con el dominio\n'
      + '      <code>@gesstiar.com</code> y la publicaci&oacute;n de SPF, DKIM y DMARC&mdash; est&aacute;n cumplidos y se declaran\n'
      + '      con su evidencia en el segundo bullet y en la ficha t&eacute;cnica del &sect;5.',
  },
  {
    id: 'C2',
    donde: 'Seccion 1, bullet del cifrado (lineas 113-114)',
    antes:
      'del respaldo fuera del servidor y la purga peri&oacute;dica de los respaldos se ejecutan con los scripts del\n'
      + '      despliegue, con la frase de paso que el owner conserva en una copia fuera del servidor, y quedan declarados en',
    despues:
      'del respaldo fuera del servidor est&aacute; <strong>prevista</strong> con el script\n'
      + '      <code>deploy/backup-offsite.sh</code> y <strong>queda pendiente</strong> hasta que el owner decida el destino y\n'
      + '      se verifique la primera copia; la purga peri&oacute;dica de los respaldos s&iacute; se ejecuta con los scripts del\n'
      + '      despliegue, con la frase de paso que el owner conserva en una copia fuera del servidor, y quedan declarados en',
  },
  {
    id: 'C3',
    donde: 'Seccion 1, parrafo de la cuenta (lineas 163-165)',
    antes:
      'cerraron el 10 de noviembre de 2026 (pendientes P2 y P5): la cuenta est&aacute; activa, con verificaci&oacute;n en',
    despues:
      'cerraron el 10 de noviembre de 2026: <strong>eran los pendientes P2 y P5</strong>. La cuenta est&aacute; activa, con\n'
      + '      verificaci&oacute;n en',
  },
  {
    id: 'C4',
    donde: 'Seccion 5, ficha "Contrasena de aplicacion": el metodo (lineas 617-621)',
    antes:
      '<strong>El m&eacute;todo de autenticaci&oacute;n est&aacute; pendiente de decisi&oacute;n y de\n'
      + '        verificaci&oacute;n por el owner (P2):</strong> si la consola de Workspace tiene habilitadas las app\n'
      + '        passwords y la cuenta tiene verificaci&oacute;n en dos pasos, la credencial es una app password; si no, la\n'
      + '        opci&oacute;n es OAuth2, que exige cambio en el c&oacute;digo del servicio y variables nuevas, y la ejecuta el\n'
      + '        owner.',
    despues:
      '<strong>El m&eacute;todo de autenticaci&oacute;n es app password</strong> de la cuenta\n'
      + '        <code>kair@gesstiar.com</code>, con verificaci&oacute;n en dos pasos habilitada. <strong>OAuth2 no se usa\n'
      + '        hoy</strong>: queda como alternativa si el owner deshabilita las app passwords, y exigir&iacute;a cambio de\n'
      + '        c&oacute;digo y variables nuevas.',
  },
  {
    id: 'C5',
    donde: 'Seccion 5, ficha "Contrasena de aplicacion": la fecha (lineas 623-625)',
    antes:
      '<strong>La fecha de generaci&oacute;n de la credencial vigente no consta</strong> y no se inventa:\n'
      + '        el proveedor de correo no expone la fecha de creaci&oacute;n de una app password y el expediente no la\n'
      + '        registra.',
    despues:
      '<strong>La credencial vigente (<code>kair-firma-smtp</code>) se gener&oacute; el 10 de noviembre de 2026</strong>,\n'
      + '        cuando se migr&oacute; la cuenta, y esa es la fecha que consta en el expediente.',
  },
  {
    id: 'C6',
    donde: 'Seccion 5, ficha "Plantilla vigente": el envio con remitente nuevo (lineas 661-662)',
    antes:
      '<strong>El env&iacute;o con el remitente nuevo\n'
      + '        (<code>kair@gesstiar.com</code>) sigue pendiente de ejecutar (P5).</strong>',
    despues: '',
  },
];

// ---------------------------------------------------------------------------
// LOS REEMPLAZOS DEL ANEXO DE ENCARGO (C7)
// ---------------------------------------------------------------------------

const ENCARGO = [
  {
    id: 'C7.1',
    donde: 'menu de documentos (linea 28)',
    antes: '<li><a href="anexo-nube-v1.3.html">Anexo de nube</a></li>',
    despues: '<li><a href="anexo-nube-v1.4.html">Anexo de nube</a></li>',
  },
  {
    id: 'C7.2',
    donde: 'Seccion 1, remision y estado de los actos (lineas 570-574)',
    antes:
      '<strong>La versi&oacute;n 1.3 del Anexo de Nube\n'
      + '  es el texto que se publicar&aacute; y remite a esta versi&oacute;n 2026-11-11 de este Anexo de Encargo sin\n'
      + '  sustituirla.</strong> A la fecha de esta versi&oacute;n, esa versi&oacute;n 1.3 no est&aacute; todav&iacute;a\n'
      + '  suscrito ni contrafirmado: su suscripci&oacute;n, y la de este Anexo de Encargo en su versi&oacute;n 2026-11-11,\n'
      + '  son pasos pendientes, con nombre y responsable, en esta secci&oacute;n.</p>',
    despues:
      '<strong>La versi&oacute;n 1.4 del Anexo de Nube\n'
      + '  es el texto que se publica y remite a esta versi&oacute;n 2026-11-12 de este Anexo de Encargo sin\n'
      + '  sustituirla.</strong> Los dos instrumentos anteriores quedaron <strong>suscritos y contrafirmados el 12 de\n'
      + '  noviembre de 2026</strong>: el Anexo de Nube en su versi&oacute;n 1.3 y este Anexo de Encargo en su versi&oacute;n\n'
      + '  2026-11-11, cada uno con su suscripci&oacute;n, su contrafirma, su acta y su huella. La versi&oacute;n 1.4 del\n'
      + '  Anexo de Nube y esta versi&oacute;n 2026-11-12 de este Anexo de Encargo las sustituyen, y las anteriores\n'
      + '  quedan como registro hist&oacute;rico, sin reescribirse.</p>',
  },
  {
    id: 'C7.3',
    donde: 'Seccion 2, remision al Anexo de Nube (lineas 72)',
    antes:
      '<a href="anexo-nube-v1.3.html">Anexo de Nube</a>.</td>',
    despues:
      '<a href="anexo-nube-v1.4.html">Anexo de Nube</a>.</td>',
  },
  {
    id: 'C7.4',
    donde: 'Seccion 5, proveedores externos (linea 431)',
    antes:
      'est&aacute;n en el <a href="anexo-nube-v1.3.html">Anexo de Nube</a>, versi&oacute;n 1.3, que forma parte',
    despues:
      'est&aacute;n en el <a href="anexo-nube-v1.4.html">Anexo de Nube</a>, versi&oacute;n 1.4, que forma parte',
  },
  {
    id: 'C7.5',
    donde: 'Seccion 9, servicio en la nube (linea 834)',
    antes:
      '<a href="anexo-nube-v1.3.html">Anexo de Nube</a>. La Empresa no recibe copias de la base de datos ni del',
    despues:
      '<a href="anexo-nube-v1.4.html">Anexo de Nube</a>. La Empresa no recibe copias de la base de datos ni del',
  },
];

// ---------------------------------------------------------------------------
// FASE 3: LA REGLA DE LA COMPUERTA DE LA TABLA SUPLETORIA (13-nov-2026)
// ---------------------------------------------------------------------------
//
// QUE ES
// ------
// El owner decidio el 13-nov-2026 que la validacion escrita de un tercero NO
// es requisito para abrir la compuerta de la tabla supletoria: la compuerta la
// abre K+AIR, con un acto expreso y FECHADO.
//
// El texto firmado del Anexo de Encargo (el del 11-jun-2026, que NO se toca)
// dice lo contrario en dos frases de su seccion 8: que la tabla "existe una
// vez validada y activada" y que "los plazos que esta tabla declara como
// supletorios estan sujetos a la validacion juridica pendiente". Ese texto ya
// no describe la regla vigente, y el v1.4 es un texto NUEVO: un texto
// suscrito no se corrige, se sustituye.
//
// QUE HACE ESTA FASE
// ------------------
// Corrige esas dos frases EN EL CANDIDATO, por ancla literal, con el mismo
// guard que las demas fases: cada ancla tiene que casar EXACTAMENTE una vez o
// no se escribe nada.
//
// LO QUE NO HACE
// --------------
// - No toca `legal/anexo-encargo.html`: el texto firmado se queda como esta.
// - No toca el Anexo de Nube: la compuerta de la tabla se describe en el
//   Anexo de Encargo, que es donde esta la tabla del seccion 8.
// - No enciende la compuerta: la tabla sigue con `activada` en false.
//
const ENCARGO_COMPUERTA = [
  {
    id: 'COMPUERTA-1',
    donde: 'Seccion 8, el parrafo que presenta la tabla supletoria',
    antes:
      'es el plazo por defecto y, una vez validada y activada, <strong>siempre',
    despues:
      'es el plazo por defecto y, una vez activada por K+AIR con la fecha de su acto, <strong>siempre',
  },
  {
    id: 'COMPUERTA-2',
    donde: 'Seccion 8, el parrafo de fuente y precedencia de la tabla',
    antes:
      'que, una vez validada y activada, siempre existe:',
    despues:
      'que, una vez activada por K+AIR con la fecha de su acto, siempre existe:',
  },
  {
    id: 'COMPUERTA-3',
    donde: 'Seccion 8, la frase de los plazos supletorios',
    antes:
      'Los plazos que esta tabla declara como supletorios est&aacute;n sujetos a la '
      + 'validaci&oacute;n jur&iacute;dica pendiente. ',
    despues:
      'Los plazos que esta tabla declara como supletorios no est&aacute;n sujetos a la '
      + 'validaci&oacute;n de un tercero: la apertura de la tabla es un acto expreso y '
      + 'fechado de K+AIR, y el numeral 8.6(a) del Acuerdo exige que cada regla tenga '
      + 'fundamento y punto de inicio, que esta tabla declara en sus ocho categor&iacute;as. ',
  },
];

// ---------------------------------------------------------------------------
// FASE 4: EL ACTO DE APERTURA DE LA COMPUERTA (13-nov-2026)
// ---------------------------------------------------------------------------
//
// QUE ES
// ------
// El 13-nov-2026 el owner ABRIO la compuerta de la tabla supletoria con un
// acto expreso y fechado (S-25): `activada` en true y `activado_at` con la
// fecha. Ese acto cambia lo que el mundo es, y el texto que se firma tiene
// que decirlo.
//
// QUE CORRIGE ESTA FASE
// -----------------------
// Dos frases del seccion 8 del texto firmado dejaban de ser ciertas:
//
//   1. "la compuerta de la tabla esta cerrada y el Acuerdo que describe
//      este mecanismo no esta aprobado ni publicado" - la primera mitad ya
//      no era cierta desde el 13-nov-2026 (el acto), y la segunda YA NO ERA
//      CIERTA desde el 11-nov-2026: el Acuerdo vigente es la v1.6, publicada
//      y activa desde ese dia, y su numeral 8.6(a) SI describe esta tabla.
//   2. "Mientras la compuerta de activacion siga cerrada el plazo
//      supletorio no se aplica" - es una regla, pero la frase que la
//      acompana ("el registro queda retenido, sin fecha de supresion")
//      describe un estado que ya no es el de hoy.
//
// QUE HACE ESTA FASE
// ------------------
// Sustituye esas dos frases EN EL CANDIDATO, por ancla literal, con el
// mismo guard que las demas fases: cada ancla tiene que casar EXACTAMENTE
// una vez o no se escribe nada. Los dos "antes" se extrajeron del texto
// firmado con una herramienta, no se transcribieron a mano.
//
// LO QUE DICE EL TEXTO NUEVO
// ---------------------------
// Que la activacion se produjo el 13-nov-2026 con el acto de K+AIR, que el
// Acuerdo vigente es la v1.6 (publicada y activa desde el 11-nov-2026), que
// desde esa fecha el plazo supletorio se aplica con su fuente y su punto de
// inicio, y que los documentos abiertos antes de esa fecha conservan el
// hold `tabla_supletoria_pendiente_validacion` hasta el RECALCULO que les
// aplica el plazo supletorio (el recalculo es una operacion expresa,
// autorizada y auditada; el hold es de los motivos liberables por
// recalculo, no un deber legal).
//
// LO QUE NO HACE
// ---------------
// - No toca `legal/anexo-encargo.html`: el texto firmado se queda como esta.
//   Un texto suscrito no se corrige, se sustituye: esto es la sustitucion
//   (la v1.4), y es la que el owner tiene que revisar y firmar (M.18).
// - No toca el Anexo de Nube: la compuerta de la tabla se describe en el
//   Anexo de Encargo, que es donde esta la tabla del seccion 8.
// - No enciende ni apaga la compuerta: eso es el config
//   (`config/tabla-conservacion.json`), y lo hizo el acto del owner.
//
const ENCARGO_COMPUERTA_ACTO = [
  {
    id: 'COMPUERTA-ACTO-1',
    donde: 'Seccion 8, el parrafo que presenta la tabla supletoria',
    antes:
      '<strong>Mientras esa activaci&oacute;n no se produzca el plazo supletorio no se aplica</strong>: la' +
      '\n' +
      '  compuerta de la tabla est&aacute; cerrada y el Acuerdo que describe este mecanismo no est&aacute; aprobado ni' +
      '\n' +
      '  publicado, de modo que el registro queda retenido, sin fecha de supresi&oacute;n, con el <em>hold</em>' +
      '\n' +
      '  <code>tabla_supletoria_pendiente_validacion</code>;',
    despues:
      '<strong>La activaci&oacute;n de la tabla se produjo el 13 de noviembre de 2026, con el acto expreso y fechado de K+AIR</strong>: el Acuerdo que describe este mecanismo es la v1.6, publicada y activa desde el 11 de noviembre de 2026, y desde esa fecha el plazo supletorio se aplica, con la fuente y el punto de inicio que esta tabla declara en sus ocho categor&iacute;as, de modo que el registro se conserva con su fecha de supresi&oacute;n calculada; los documentos abiertos antes de esa fecha conservan el <em>hold</em> <code>tabla_supletoria_pendiente_validacion</code> hasta el rec&aacute;lculo que les aplica el plazo supletorio;',
  },
  {
    id: 'COMPUERTA-ACTO-2',
    donde: 'Seccion 8, la descripcion de la tabla del seccion 8',
    antes:
      '<strong>Mientras la compuerta de activaci&oacute;n siga cerrada el plazo supletorio no se aplica</strong>: el registro queda retenido, sin fecha de supresi&oacute;n, con el <em>hold</em> <code>tabla_supletoria_pendiente_validacion</code>;',
    despues:
      '<strong>Desde la activaci&oacute;n de la tabla el 13 de noviembre de 2026 el plazo supletorio se aplica</strong>: el registro se conserva con su fecha de supresi&oacute;n calculada, y los documentos abiertos antes de esa fecha conservan el <em>hold</em> <code>tabla_supletoria_pendiente_validacion</code> hasta el rec&aacute;lculo que les aplica el plazo supletorio;',
  },
];

// ---------------------------------------------------------------------------
// EL MOTOR
// ---------------------------------------------------------------------------

function contar(texto, aguja) {
  let n = 0;
  let i = texto.indexOf(aguja);
  while (i >= 0) {
    n += 1;
    i = texto.indexOf(aguja, i + aguja.length);
  }
  return n;
}

function aplicar(texto, reemplazos) {
  const problemas = [];
  for (const r of reemplazos) {
    const n = contar(texto, r.antes);
    if (n !== 1) {
      problemas.push(r.id + ' (en ' + r.donde + '): casa ' + n + ' veces, se esperaba 1');
      continue;
    }
    texto = texto.replace(r.antes, r.despues);
  }
  return { texto: texto, problemas: problemas };
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function correr(escribir) {
  const origenNube = path.join(LEGAL, 'anexo-nube-v1.3.html');
  const origenEncargo = path.join(LEGAL, 'anexo-encargo.html');
  for (const p of [origenNube, origenEncargo]) {
    if (!fs.existsSync(p)) {
      console.error('No existe el texto vigente: ' + p);
      return 2;
    }
  }

  const textoNube = fs.readFileSync(origenNube, 'utf8');
  const textoEncargo = fs.readFileSync(origenEncargo, 'utf8');

  const rn = aplicar(textoNube, NUBE);
  const re = aplicar(textoEncargo, ENCARGO);
  const problemas = rn.problemas.concat(re.problemas);

  console.log('Anexo de Nube v1.4: ' + NUBE.length + ' reemplazos.');
  console.log('Anexo de Encargo:   ' + ENCARGO.length + ' reemplazos.');
  if (problemas.length) {
    console.error('\nERROR: un ancla no casa exactamente una vez:');
    problemas.forEach((p) => console.error('  ' + p));
    console.error('NO SE ESCRIBE NADA.');
    return 1;
  }
  console.log('Todos los anclas casan exactamente una vez.');

  // FASE 2: las determinaciones legales de la mesa L1 a L7 (L1, L4 y L5).
  // El texto literal se lee de los propios documentos de determinacion: no
  // se transcribe. Si una Determinacion no aplica, no se escribe nada.
  const det = require('./determinaciones-v1.4.js');
  const d = det.determinaciones(rn.texto, re.texto);
  const problemasDet = d.nube.problemas.concat(d.encargo.problemas);
  console.log('Determinaciones L1/L4/L5: Nube ' + d.nube.aplicadas.length
    + ', Encargo ' + d.encargo.aplicadas.length + '.');
  if (problemasDet.length) {
    console.error('\nERROR: una determinacion no se pudo aplicar:');
    problemasDet.forEach((p) => console.error('  ' + p));
    console.error('NO SE ESCRIBE NADA.');
    return 1;
  }
  const textoNubeFinal = d.nube.texto;
  let textoEncargoFinal = d.encargo.texto;

  // FASE 3: la regla de la compuerta de la tabla supletoria (decision del
  // owner del 13-nov-2026). Va DESPUES de las determinaciones porque no es una
  // determinacion juridica: es un cambio de regla de K+AIR, y asi queda dicho.
  const rc = aplicar(textoEncargoFinal, ENCARGO_COMPUERTA);
  console.log('Regla de la compuerta (13-nov-2026): ' + ENCARGO_COMPUERTA.length + ' reemplazos.');
  if (rc.problemas.length) {
    console.error('\nERROR: una ancla de la regla de la compuerta no se pudo aplicar:');
    rc.problemas.forEach((p) => console.error('  ' + p));
    console.error('NO SE ESCRIBE NADA.');
    return 1;
  }
  textoEncargoFinal = rc.texto;

  // FASE 4: el ACTO DE APERTURA de la compuerta (13-nov-2026). El texto
  // firmado describia un estado que ya no es el de hoy: la compuerta esta
  // abierta y el Acuerdo vigente (la v1.6) si esta aprobado y publicado.
  const r4 = aplicar(textoEncargoFinal, ENCARGO_COMPUERTA_ACTO);
  console.log('Acto de apertura de la compuerta (13-nov-2026): ' + ENCARGO_COMPUERTA_ACTO.length + ' reemplazos.');
  if (r4.problemas.length) {
    console.error('\nERROR: un ancla del acto de apertura no se pudo aplicar:');
    r4.problemas.forEach((p) => console.error('  ' + p));
    console.error('NO SE ESCRIBE NADA.');
    return 1;
  }
  textoEncargoFinal = r4.texto;

  // El texto vigente no se toca: se comprueba antes de escribir nada.
  const bufNube = fs.readFileSync(origenNube);
  const bufEncargo = fs.readFileSync(origenEncargo);
  const bufManifiesto = fs.readFileSync(path.join(RAIZ, 'firma-service', 'legal-readiness.json'));

  const destinoNube = path.join(SALIDA, 'anexo-nube-v1.4.html');
  const destinoEncargo = path.join(SALIDA, 'anexo-encargo-2026-11-12.html');
  const bufNuevoNube = Buffer.from(textoNubeFinal, 'utf8');
  const bufNuevoEncargo = Buffer.from(textoEncargoFinal, 'utf8');

  console.log('');
  console.log('Candidato Anexo de Nube v1.4   : ' + bufNuevoNube.length + ' B, sha256 ' + sha256(bufNuevoNube));
  console.log('Candidato Anexo de Encargo 12-11: ' + bufNuevoEncargo.length + ' B, sha256 ' + sha256(bufNuevoEncargo));
  console.log('Texto vigente Nube v1.3        : ' + bufNube.length + ' B, sha256 ' + sha256(bufNube) + ' (NO SE TOCA)');
  console.log('Texto vigente Encargo          : ' + bufEncargo.length + ' B, sha256 ' + sha256(bufEncargo) + ' (NO SE TOCA)');
  console.log('Manifiesto                     : sha256 ' + sha256(bufManifiesto) + ' (NO SE TOCA)');

  if (!escribir) {
    console.log('\nModo --estado: no se escribio nada.');
    return 0;
  }

  fs.mkdirSync(SALIDA, { recursive: true });
  fs.writeFileSync(destinoNube, bufNuevoNube);
  fs.writeFileSync(destinoEncargo, bufNuevoEncargo);

  // El texto vigente y el manifiesto tienen que seguir igual despues.
  if (!fs.readFileSync(origenNube).equals(bufNube)) throw new Error('El texto vigente del Nube cambio');
  if (!fs.readFileSync(origenEncargo).equals(bufEncargo)) throw new Error('El texto vigente del Encargo cambio');
  if (!fs.readFileSync(path.join(RAIZ, 'firma-service', 'legal-readiness.json')).equals(bufManifiesto)) {
    throw new Error('El manifiesto cambio');
  }

  console.log('\nCandidatos escritos en: ' + SALIDA);
  return 0;
}

module.exports = { correr: correr, NUBE: NUBE, ENCARGO: ENCARGO, ENCARGO_COMPUERTA: ENCARGO_COMPUERTA,
  ENCARGO_COMPUERTA_ACTO: ENCARGO_COMPUERTA_ACTO };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.indexOf('--ayuda') >= 0 || args.indexOf('--help') >= 0) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('/**', ''));
    process.exit(0);
  }
  process.exit(correr(args.indexOf('--estado') < 0 && args.indexOf('--verificar') < 0));
}
