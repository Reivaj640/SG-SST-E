#!/usr/bin/env node
/**
 * Construye el Acuerdo v1.4 a partir de la v1.3 y de las correcciones
 * del abogado del 30-oct-2026.
 *
 * Reproducible e idempotente: correrlo dos veces deja el mismo archivo.
 *
 * Las correcciones van en `reemplazos_texto` (coincidencia exacta y unica),
 * que es el mecanismo que el empalme usa para los pasajes que no caen
 * dentro de un numeral completo.
 *
 * La v1.4 es la candidata que sustituye a la v1.3 (nunca publicada).
 */

const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, '..', 'scripts', 'fixtures');
const V3_CAMBIOS = path.join(FIXTURES, 'acuerdo-v1.3-cambios.json');
const V3_DATOS = path.join(FIXTURES, 'acuerdo-v1.3-datos.json');
const V3_TEXTO = path.join(FIXTURES, 'acuerdo-v1.3.txt');
const V4_CAMBIOS = path.join(FIXTURES, 'acuerdo-v1.4-cambios.json');
const V4_DATOS = path.join(FIXTURES, 'acuerdo-v1.4-datos.json');

// --- Determinacion J6: el texto literal del abogado, el mismo en A1, A2 y A3.
const DETERMINACION_GOOGLE =
  'Por la operaci\u00f3n concreta, y contrastada con los t\u00e9rminos aplicables de la cuenta de '
  + 'consumo, Google LLC decide sobre la finalidad y los medios de su propio servicio y trata '
  + 'los datos por cuenta propia; en esta operaci\u00f3n act\u00faa como Responsable del Tratamiento '
  + '(art. 3, literales d) y e), de la Ley 1581 de 2012) y el flujo constituye una transferencia '
  + 'internacional de datos personales (art. 2.2.2.25.1.3, numeral 4, del Decreto 1074 de 2015) '
  + 'a un Responsable ubicado en Estados Unidos, pa\u00eds con nivel adecuado de protecci\u00f3n '
  + '(numeral 3.2 del T\u00edtulo V de la Circular \u00dAnica). No existe DPA empresarial ni contrato de '
  + 'transmisi\u00f3n con Google, y esta determinaci\u00f3n no atribuye al Encargado facultades de '
  + 'supresi\u00f3n sobre las copias del proveedor ni le impone obligaciones contractuales a este.';;

// El texto del Acuerdo esta en espanol con tildes reales (no HTML). Se
// escriben con escapes \uXXXX para que el archivo del script quede en ASCII
// puro y no dependa de como se codifique al guardarlo.
const T = (s) => s;

const REEMPLAZOS = [
  {
    motivo: 'C-1 (A1 3.6(h)): la Constancia no puede vincular un modelo de Anexo de Nube sin firmar',
    antiguo: T('La Constancia lleva adem\u00e1s la versi\u00f3n y la huella SHA-256 de los anexos que rigen esa firma: la del Anexo de Encargo, tomada de la versi\u00f3n que esa Empresa acept\u00f3, y la del Anexo de Nube, tomada de su versi\u00f3n firmada o, si no hay copia firmada, de su modelo vigente.'),
    nuevo: T('La Constancia lleva adem\u00e1s la versi\u00f3n y la huella SHA-256 de los anexos que rigen esa firma: la del Anexo de Encargo, tomada de la versi\u00f3n que esa Empresa acept\u00f3, y la del Anexo de Nube, tomada de su versi\u00f3n firmada por esa Empresa. Si la Empresa no ha suscrito el Anexo de Nube, el servicio no permite crear solicitudes de firma y, en consecuencia, no puede emitirse Constancia.'),
  },
  {
    motivo: 'C-2 (A1 3.6(b)): la conservacion registra tambien las huellas de los dos anexos',
    antiguo: T('La versi\u00f3n del Acuerdo aceptado y la huella digital SHA-256 de su texto.'),
    nuevo: T('La versi\u00f3n del Acuerdo aceptado y la huella digital SHA-256 de su texto, y la versi\u00f3n y la huella SHA-256 del Anexo de Encargo y del Anexo de Nube que rigen esa firma.'),
  },
  {
    motivo: 'C-2 (A1 9.2): la aceptacion identifica los anexos y pone la matriz a disposicion antes de la casilla',
    antiguo: T('9.2. El Trabajador puede leer el Acuerdo antes de firmar. El sistema muestra la versi\u00f3n vigente al momento de la firma, habilita la casilla solo cuando el texto ha sido desplegado hasta su final y registra la aceptaci\u00f3n con la huella del texto y la fecha y hora. El sistema acredita el despliegue, no la lectura.'),
    nuevo: T('9.2. El Trabajador puede leer el Acuerdo antes de firmar. El sistema muestra la versi\u00f3n vigente al momento de la firma, habilita la casilla solo cuando el texto ha sido desplegado hasta su final y registra la aceptaci\u00f3n con la huella del texto y la fecha y hora. El sistema acredita el despliegue, no la lectura. El sistema registra adem\u00e1s, en el mismo acto de aceptaci\u00f3n, la versi\u00f3n y la huella SHA-256 del Anexo de Encargo y del Anexo de Nube que rigen esa firma para esa Empresa, y pone a disposici\u00f3n del Firmante, antes de habilitar la casilla, la matriz de finalidades que determinan el alcance de su autorizaci\u00f3n, con su versi\u00f3n y su huella.'),
  },
  {
    motivo: 'C-2 (A1 9.6): la Constancia identifica tambien los anexos',
    antiguo: T('vigente en el momento de la aceptaci\u00f3n.'),
    nuevo: T('vigente en el momento de la aceptaci\u00f3n. La Constancia identifica adem\u00e1s la versi\u00f3n y la huella SHA-256 del Anexo de Encargo y del Anexo de Nube que rigen esa firma para esa Empresa.'),
  },
  {
    motivo: 'C-2 (Manifestacion de Voluntad, ordinal 3): el Titular autoriza sobre la matriz que le pusieron a disposicion',
    antiguo: null, // se arma abajo, con el texto exacto del archivo
    nuevo: T('3. Autorizo, de manera expresa, informada y separable, el tratamiento de mis datos\npersonales \u00fanicamente para las finalidades que, en la matriz de finalidades del Anexo de\nEncargo que el sistema me ha puesto a disposici\u00f3n antes de esta autorizaci\u00f3n, con su\nversi\u00f3n y su huella SHA-256, tienen como base jur\u00eddica esa autorizaci\u00f3n, y en los\nt\u00e9rminos y con los l\u00edmites que esa matriz les fija. La revocatoria de esta autorizaci\u00f3n\nno produce efectos sobre las finalidades que tienen otra base jur\u00eddica, ni suprime los datos\nque se deben conservar por un deber legal o contractual.'),
  },
  {
    motivo: 'J3 (A1 5.6): el registro de aceptaci\u00f3n consigna el medio y la fecha de puesta a disposici\u00f3n',
    antiguo: T('con la fecha en que se le pusieron a su disposici\u00f3n, y su evidencia se conserva.'),
    nuevo: T('con la fecha en que se le pusieron a su disposici\u00f3n, y su evidencia se conserva. El registro de aceptaci\u00f3n consigna adem\u00e1s el medio concreto por el que las pol\u00edticas se pusieron a disposici\u00f3n y la fecha de esa puesta a disposici\u00f3n, que no puede ser posterior a la fecha de aceptaci\u00f3n.'),
  },
  {
    motivo: 'J14-2 (A1 8.7, segundo parrafo): la supresion en Cloudflare, que no almacena copia',
    antiguo: T('La supresi\u00f3n del 8.6 alcanza a los respaldos dentro del plazo all\u00ed previsto, y tambi\u00e9n a los que se conservan en los servicios de los subencargados identificados en el Anexo de Nube (Cloudflare, Inc.), con las medidas, plazos y obligaciones de devoluci\u00f3n y supresi\u00f3n all\u00ed pactados.'),
    nuevo: T('La supresi\u00f3n del 8.6 alcanza la infraestructura del Encargado y los respaldos dentro del plazo del Anexo de Nube \u00a73. El t\u00fanel de Cloudflare, Inc. transporta y transita sin almacenar copia de los registros del proceso de firma; por ello no hay datos que suprimir en ese servicio, y lo \u00fanico que se exige al proveedor es el deber de devoluci\u00f3n y supresi\u00f3n pactado en su DPA.'),
  },
  {
    motivo: 'J11 (A1 10.8(d)(iv)): el deber propio del Encargado frente a la SIC',
    antiguo: T('(iv) Notificaci\u00f3n. K+AIR avisa a la Empresa por su canal de incidentes y la informa de que la solicitud qued\u00f3 bloqueada. La Empresa, como Responsable, notifica al Titular y a la autoridad cuando su propia normativa y la ley lo exigen, y decide las medidas de atenci\u00f3n al Titular.'),
    nuevo: T('(iv) Notificaci\u00f3n. K+AIR avisa a la Empresa por su canal de incidentes y la informa de que la solicitud qued\u00f3 bloqueada. La Empresa, como Responsable, notifica al Titular y a la autoridad cuando su propia normativa y la ley lo exigen, y decide las medidas de atenci\u00f3n al Titular. K+AIR, en su calidad de Encargado, cumple por s\u00ed mismo el deber de que trata el art\u00edculo 18, literal k), de la Ley 1581 de 2012: informa a la Delegatura para la Protecci\u00f3n de Datos Personales de la Superintendencia de Industria y Comercio cuando el hecho configure una violaci\u00f3n de los c\u00f3digos de seguridad del servicio y exista riesgo en la administraci\u00f3n de la informaci\u00f3n de los Titulares, dentro de los plazos y por los canales que fija la normativa. Este deber es propio del Encargado y no se desplaza a la Empresa.'),
  },
];

// --- El ordinal 3: el texto exacto sale del archivo, para que el JSON no
// dependa de como se copie a mano.
function ordinal3Exacto() {
  const t = fs.readFileSync(V3_TEXTO, 'utf8');
  const ini = t.indexOf('3. Autorizo, de manera expresa, informada y separable');
  if (ini === -1) throw new Error('No se encontro el ordinal 3 de la Manifestacion de Voluntad.');
  const fin = t.indexOf('un deber legal o contractual.', ini);
  if (fin === -1) throw new Error('No se encontro el final del ordinal 3.');
  return t.slice(ini, fin + 'un deber legal o contractual.'.length);
}

function construir() {
  const v3 = JSON.parse(fs.readFileSync(V3_CAMBIOS, 'utf8'));
  const datos = JSON.parse(fs.readFileSync(V3_DATOS, 'utf8'));

  const reemplazos = (v3.reemplazos_texto || []).slice();
  for (const r of reemplazos) {
    if (r.motivo.startsWith('Encabezado: la fecha de vigencia')) {
      r.motivo = 'Encabezado: la fecha de vigencia de la v1.4 la fija el owner antes de publicar';
      r.antiguo = 'Versión del Acuerdo: v1.4';
      r.nuevo = 'Versión del Acuerdo: v1.4\nFecha de vigencia: por fijarse antes de la publicación de esta versión.';
    }
  }
  for (const r of REEMPLAZOS) {
    const antiguo = r.antiguo === null ? ordinal3Exacto() : r.antiguo;
    reemplazos.push({ motivo: r.motivo, antiguo, nuevo: r.nuevo });
  }

  const v4 = Object.assign({}, v3);
  v4.version = 'v1.4';
  v4.reemplazos_texto = reemplazos;
  v4.cambios['10.1'] = v4.cambios['10.1'].replace(
    /La cuenta de consumo de Gmail es un proveedor externo[\s\S]*?hasta que esa conclusión conste por escrito\./,
    DETERMINACION_GOOGLE
  ).replace(
    /Antes de publicar este Acuerdo, el abogado debe determinar[\s\S]*?comunicaciones regulatorias\./,
    'El estado del RNBD y las obligaciones que correspondan a cada Empresa deben verificarse por su Responsable. La identificación de Google no acredita controles técnicos del canal. La oferta tecnológica K+AIR se evalúa separadamente frente a los deberes regulatorios que le correspondan.'
  ).replace(
    /El flujo, el proveedor, los datos enviados y las medidas comprobadas se describen en el Anexo de Nube\. La clasificación jurídica de la operación y las consecuencias regulatorias quedan pendientes de validación profesional y no se consideran resueltas por la elección operativa de mantener Gmail\./,
    'El flujo, los datos enviados, los controles comprobados y sus limitaciones se describen en el Anexo de Nube.'
  );
  v4.cambios['10.5(f)'] = v4.cambios['10.5(f)'].replace(
    /Google LLC interviene en el envío mediante una cuenta de consumo\. El papel de Google por operación y la clasificación jurídica del flujo quedan pendientes de validación profesional; este Acuerdo no declara que Google sea Responsable, Encargado o subencargado de Gesstiar, ni califica el flujo como transferencia o transmisión hasta que esa determinación conste por escrito\./,
    DETERMINACION_GOOGLE
  );

  const d4 = Object.assign({}, datos);
  d4.version = 'v1.4';

  fs.writeFileSync(V4_CAMBIOS, JSON.stringify(v4, null, 2) + '\n', 'utf8');
  fs.writeFileSync(V4_DATOS, JSON.stringify(d4, null, 2) + '\n', 'utf8');

  console.log('acuerdo-v1.4-cambios.json: ' + v4.reemplazos_texto.length + ' reemplazos de texto libre');
  console.log('acuerdo-v1.4-datos.json: version ' + d4.version);
}

if (require.main === module) construir();

module.exports = { REEMPLAZOS, DETERMINACION_GOOGLE };
