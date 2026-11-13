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
    donde: '§1, primer bullet (lineas 90-93)',
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
    donde: '§1, bullet del cifrado (lineas 113-114)',
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
    donde: '§1, parrafo de la cuenta (lineas 163-165)',
    antes:
      'cerraron el 10 de noviembre de 2026 (pendientes P2 y P5): la cuenta est&aacute; activa, con verificaci&oacute;n en',
    despues:
      'cerraron el 10 de noviembre de 2026: <strong>eran los pendientes P2 y P5</strong>. La cuenta est&aacute; activa, con\n'
      + '      verificaci&oacute;n en',
  },
  {
    id: 'C4',
    donde: '§5, ficha "Contrasena de aplicacion": el metodo (lineas 617-621)',
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
    donde: '§5, ficha "Contrasena de aplicacion": la fecha (lineas 623-625)',
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
    donde: '§5, ficha "Plantilla vigente": el envio con remitente nuevo (lineas 661-662)',
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
    donde: '§1, remision y estado de los actos (lineas 570-574)',
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
    donde: '§2, remision al Anexo de Nube (lineas 72)',
    antes:
      '<a href="anexo-nube-v1.3.html">Anexo de Nube</a>.</td>',
    despues:
      '<a href="anexo-nube-v1.4.html">Anexo de Nube</a>.</td>',
  },
  {
    id: 'C7.4',
    donde: '§5, proveedores externos (linea 431)',
    antes:
      'est&aacute;n en el <a href="anexo-nube-v1.3.html">Anexo de Nube</a>, versi&oacute;n 1.3, que forma parte',
    despues:
      'est&aacute;n en el <a href="anexo-nube-v1.4.html">Anexo de Nube</a>, versi&oacute;n 1.4, que forma parte',
  },
  {
    id: 'C7.5',
    donde: '§9, servicio en la nube (linea 834)',
    antes:
      '<a href="anexo-nube-v1.3.html">Anexo de Nube</a>. La Empresa no recibe copias de la base de datos ni del',
    despues:
      '<a href="anexo-nube-v1.4.html">Anexo de Nube</a>. La Empresa no recibe copias de la base de datos ni del',
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
  const textoEncargoFinal = d.encargo.texto;

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

module.exports = { correr: correr, NUBE: NUBE, ENCARGO: ENCARGO };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.indexOf('--ayuda') >= 0 || args.indexOf('--help') >= 0) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('/**', ''));
    process.exit(0);
  }
  process.exit(correr(args.indexOf('--estado') < 0 && args.indexOf('--verificar') < 0));
}
