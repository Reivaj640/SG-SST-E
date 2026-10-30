#!/usr/bin/env node
/**
 * scripts/construir-acuerdo-v1.3.js
 *
 * ARMA el JSON de cambios de la v1.3 del Acuerdo a partir del JSON de cambios de la
 * v1.2 y de los deltas de la especificacion del abogado del 30-oct-2026.
 *
 * POR QUÉ ESTE SCRIPT Y NO UN ARCHIVO ESCRITO A MANO
 * ----------------------------------------------------
 * El JSON de cambios es el mapa numeral -> texto final. La v1.2 ya tiene 71 numerales
 * con su texto. Escribir a mano la v1.3 obligaría a transcribir 71 bloques legales, y
 * una palabra mal copiada en un texto que se firma electrónicamente es un bug legal.
 * Este script deja escrito QUÉ cambia entre la v1.2 y la v1.3, y solo eso.
 *
 *  1. Lee la v1.2 (scripts/fixtures/acuerdo-v1.2-cambios.json). NO la toca.
 *  2. Aplica los seis deltas de la especificación del 30-oct-2026:
 *       T1  -> 5.1  (deberes legales separados de los operativos adicionales)
 *       T2  -> 5.1  (literal f) + 5.6 nuevo (mecanismo de las políticas)
 *       D1  -> 8.6  (a, c, g y h: fin de la retención indefinida, tabla supletoria)
 *       D1  -> 3.6(g) (se retira el hold por plazo no declarado)
 *       D1  -> 10.4(a) y 10.6 (precedencia de la tabla supletoria)
 *  3. Escribe scripts/fixtures/acuerdo-v1.3-cambios.json (LF, sin BOM).
 *
 * REGLAS
 * ------
 *  1. Idempotente: correrlo dos veces produce el mismo archivo.
 *  2. Autoverifica el formato: antes de escribir, comprueba que volver a serializar la
 *     v1.2 con el mismo serializador reproduce el archivo byte a byte. Si no reproduce,
 *     el formato del archivo de origen no es el que este script asume, y se niega a
 *     escribir en vez de producir un archivo con otro formato.
 *  3. La v1.2 no se modifica. La v1.1 tampoco.
 *
 * Uso:
 *   node scripts/construir-acuerdo-v1.3.js
 *   node scripts/construir-acuerdo-v1.3.js --salida=otra/ruta.json
 *
 * Exit codes:
 *   0 = escrito
 *   3 = error (archivos que faltan, JSON ilegible, formato inesperado)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const FIXTURES = path.resolve(SERVICE_ROOT, 'scripts', 'fixtures');

const BASE_CAMBIOS = path.join(FIXTURES, 'acuerdo-v1.2-cambios.json');
const SALIDA = path.join(FIXTURES, 'acuerdo-v1.3-cambios.json');

// ---------------------------------------------------------------------------
// Los seis deltas de la v1.3. Texto final de cada numeral, íntegro.
// ---------------------------------------------------------------------------

// T1 + T2: los tres deberes legales del artículo 2.2.2.47.6 del Decreto 1074 de 2015,
// separados de los deberes operativos adicionales de K+AIR. El literal f) es la
// redacción literal del abogado sobre las políticas de seguridad.
const NUMERAL_5_1 = [
  '5.1. El Firmante reconoce y acepta los deberes y obligaciones que el artículo 2.2.2.47.6 del Decreto 1074 de 2015 impone a quien firma electrónicamente, y se compromete a cumplirlos. Son deberes legales:',
  '',
  '    a) Mantener control y custodia sobre sus datos de creación de la firma.',
  '',
  '    b) Actuar con diligencia para evitar la utilización no autorizada de sus datos de creación de la firma.',
  '',
  '    c) Dar aviso oportuno a cualquier persona que posea, haya recibido o vaya a recibir documentos o mensajes de datos firmados electrónicamente por el Firmante, cuando el Firmante sepa que sus datos de creación de la firma han quedado en entredicho o cuando conozca circunstancias que den lugar a un riesgo considerable de que hayan quedado en entredicho. Se entiende que los datos de creación han quedado en entredicho, entre otros casos, cuando hayan sido conocidos ilegalmente por terceros, corran peligro de ser utilizados indebidamente, o el Firmante haya perdido el control o custodia sobre los mismos, o, en general, cuando exista cualquier otra situación que ponga en duda la seguridad de la firma electrónica o que genere reparos sobre su calidad.',
  '',
  'Adicionalmente, y sin perjuicio de su obligación de cumplir las condiciones de este Acuerdo y de la legislación aplicable, el Firmante se compromete a:',
  '',
  '    d) Usar personalmente el enlace de acceso y el código OTP, que es el dato de creación de la firma, y el token, que es una credencial de acceso, sin entregarlos, sin compartirlos y sin permitir que un tercero los use.',
  '',
  '    e) Informar oportunamente a la Empresa o a K+AIR, por el canal de incidentes publicado en la pantalla de firma, cualquier situación que comprometa la seguridad: acceso no autorizado al correo, pérdida del dispositivo o conocimiento de que un tercero obtuvo el OTP o el enlace.',
  '',
  '    f) Cumplir las políticas de seguridad que regulen directamente el uso del mecanismo de firma electrónica, siempre que hayan sido informadas de manera expresa al Firmante y puestas a su disposición como anexo de este Acuerdo o mediante un medio de consulta accesible antes de su aplicación. Estas políticas no podrán modificar unilateralmente las condiciones esenciales del mecanismo ni imponer obligaciones que no hayan sido comunicadas al Firmante.',
].join('\n');

// T2: numeral nuevo. El mecanismo de "puestas a su disposición" no es una promesa:
// es el versionamiento que ya existe (la pantalla muestra la versión junto con el
// texto, y la aceptación registra texto, huella SHA-256 y fecha y hora).
const NUMERAL_5_6 = [
  '5.6. Las políticas de seguridad que regulan el uso del mecanismo de firma electrónica son las que K+AIR informa expresamente al Firmante y le pone a su disposición antes de que resulten aplicables. La pantalla de firma muestra el texto íntegro de este Acuerdo junto con la versión de este Acuerdo, y la declaración de seguridad del medio por el que se recibe el código de verificación, con el texto que el servidor entrega para esa versión. Al aceptar, el sistema registra el texto aceptado, su huella digital SHA-256 y la fecha y hora, conforme al numeral 9.2. La versión de las políticas efectivamente aceptada queda así identificada, con la fecha en que se le pusieron a su disposición, y su evidencia se conserva. La publicación de una versión nueva de este Acuerdo no altera las aceptaciones ya registradas, que se rigen por la versión que el Firmante aceptó.',
].join('\n');

// D1: el numeral 8.6 completo, con la precedencia nueva y sin retención indefinida.
const NUMERAL_8_6 = [
  '8.6. Conservación, copia y supresión.',
  '',
  '    a) El plazo de conservación de los registros del proceso de firma se determina por categoría documental. Se determina en este orden: primero, por las reglas legales especiales de los literales b) y c), que no pueden rebajarse; segundo, por la tabla de retención documental de la Empresa, que es la referencia vigente de esa Empresa y no se modifica por este Acuerdo; y tercero, a falta de plazo declarado por la Empresa, por la tabla supletoria de conservación que administra K+AIR, que fija un plazo por defecto para cada categoría documental. La tabla supletoria es configurable: K+AIR puede ajustar sus plazos por categoría, y cada regla que la integra ha de tener un fundamento —un deber legal o la finalidad del tratamiento— y un punto de inicio desde el que corre, que es un dato identificable. Ningún plazo puede ser indefinido, y ninguno autoriza a conservar más allá de la finalidad. La tabla supletoria se publica en el Anexo de Encargo. Un cambio en esa tabla no altera los plazos ya calculados: cada registro conserva el plazo que le fue aplicado, con su fuente y la fecha desde la que corre, y un recálculo exige una operación expresa, autorizada y auditada.',
  '',
  '    b) Los registros del SG-SST enumerados en el artículo 2.2.4.6.13 del Decreto 1072 de 2015 se conservan como mínimo veinte (20) años contados desde el cese de la relación laboral: (i) perfiles epidemiológicos y conceptos de exámenes de ingreso, periódicos y de retiro, cuando la Empresa no cuente con médico especialista en áreas afines a la seguridad y salud en el trabajo; (ii) resultados de exámenes y pruebas complementarias que ordene el médico especialista en áreas afines a la seguridad y salud en el trabajo, cuando la Empresa cuente con él; (iii) resultados de mediciones y monitoreo de ambientes de trabajo; (iv) registros de capacitación, formación y entrenamiento en materia de seguridad y salud en el trabajo; y (v) registros de suministro de elementos y equipos de protección personal. Los demás documentos y registros del SG-SST se rigen por la tabla de retención de la Empresa.',
  '',
  '    c) El contrato individual de trabajo y sus adiciones, modificaciones y anexos firmados electrónicamente se conservan con autenticidad, integridad y disponibilidad conforme al artículo 2.2.1.1.12 del Decreto 1072 de 2015. El sistema les asigna un hold mientras subsista la relación laboral y, a su terminación, aplica el plazo que resulte de la tabla de retención documental de la Empresa; si no hay plazo declarado, aplica el plazo por defecto de esa categoría en la tabla supletoria que administra K+AIR, conforme al literal h).',
  '',
  '    d) Si la Empresa declara un deber legal o contractual de conservación, el sistema aplica un hold sobre el documento y no lo suprime mientras ese deber subsista.',
  '',
  '    e) La supresión procede solo cuando concurren: (i) vencimiento del plazo aplicable; (ii) ausencia de deber legal o contractual de conservación; (iii) ausencia de solicitud de copia pendiente; y (iv) ausencia de hold vigente. La supresión deja la lápida y el recibo del numeral 3.6(g).',
  '',
  '    f) La Empresa entrega al Trabajador, siempre y sin costo, copia del contrato, sus anexos y modificaciones, por el medio electrónico que el Trabajador autorice, conforme a los artículos 2.2.1.1.12 y 2.2.1.1.13 del Decreto 1072 de 2015. La solicitud se registra y se atiende antes de cualquier supresión.',
  '',
  '    g) Antes de la firma, la Empresa informa al Trabajador el plazo aplicable —el que resulte de su tabla de retención documental o, a falta de plazo declarado por ella, el plazo por defecto de esa categoría en la tabla supletoria que administra K+AIR—, el deber de conservación del contrato y el canal para solicitar copia. El sistema no envía aviso previo de supresión y este Acuerdo no lo promete.',
  '',
  '    h) No hay retención indefinida. La tabla supletoria de conservación que administra K+AIR fija un plazo por defecto para cada categoría documental, con su fundamento y su punto de inicio, de modo que toda categoría tiene un plazo aplicable. Cuando la Empresa declara un plazo para una categoría en su tabla de retención documental, ese plazo es el que se aplica; cuando no lo declara, se aplica el plazo por defecto de esa categoría en la tabla supletoria. Los plazos legales especiales del literal b) se aplican por encima del plazo declarado por la Empresa y no pueden rebajarse. El contrato individual de trabajo y sus adiciones, modificaciones y anexos se conservan con el hold del literal c) mientras subsista la relación laboral. Un plazo sin fundamento y sin punto de inicio identificable no es admisible. La fecha de la firma no inicia por sí sola ningún cómputo de prescripción. Cada plazo es un tope de custodia y no autoriza a conservar más allá de la finalidad.',
].join('\n');

// D1: 3.6(g) pierde la frase del hold por plazo no declarado: ese hold ya no existe.
const LITERAL_3_6_G = [
  '    g) El registro de auditoría no puede alterarse una vez escrito. La capacidad que lo hace efectivo es técnica y no declarativa: el registro de eventos del servicio está protegido en la base de datos con disparadores que impiden las sentencias de actualización y de eliminación sobre las filas ya escritas, de manera que el registro es de solo anexado. La supresión dentro de la ventana de purga del 8.6 no es alteración: da lugar a una lápida que identifica la solicitud, la fecha y hora, las categorías suprimidas y el fundamento del plazo, y a un recibo que la Empresa entrega al Trabajador si lo solicita. Una consulta a un registro cuyo plazo de conservación ya venció se rechaza con la respuesta de conservación vencida y no devuelve el dato suprimido. Mientras subsista un deber legal o contractual de conservación, el registro queda retenido por esa razón y no se suprime.',
].join('\n');

// D1: la base legal de la finalidad 10.3(f) incluye la tabla supletoria.
const LITERAL_10_4_A = [
  '    a) La finalidad del 10.3(f) se sustenta en el deber legal de conservar el documento firmado según su naturaleza y, en particular, los registros del SG-SST (artículo 2.2.4.6.13 del Decreto 1072 de 2015), en la tabla de retención documental de la Empresa y, a falta de plazo declarado por ella, en la tabla supletoria que administra K+AIR, y, en lo aplicable, en el deber de conservar prueba de la autorización (artículo 2.2.2.25.2.5). Esa base legal opera con independencia de la autorización del Titular, que no es la base jurídica de esta finalidad.',
].join('\n');

// D1: 10.6 enuncia la precedencia y deja claro que el piso del SG-SST no se baja.
const NUMERAL_10_6 = [
  '10.6. Los plazos se determinan por categoría, con la precedencia del 8.6(a): el plazo que declare la Empresa en su tabla de retención documental y, a falta de plazo declarado por ella, el plazo por defecto de esa categoría en la tabla supletoria que administra K+AIR. Vencido el plazo y sin deber legal o contractual, el dato se suprime conforme al 8.6. La supresión del documento, la Constancia y los registros de auditoría deja la lápida y el recibo del 3.6(g) y 10.5(d). Los plazos del SG-SST son los del 8.6(b) y no pueden rebajarse.',
].join('\n');

// D1: el 12.7 sigue prometiendo el mecanismo viejo ("mientras ese plazo no esté
// declarado, la prueba no se suprime y queda retenida por esa razón, conforme al
// 8.6(h)"). Con el 8.6(h) nuevo ese mecanismo no existe: lo que se aplica a
// falta de plazo declarado es el plazo por defecto de la tabla supletoria.
const NUMERAL_12_7 = [
  '12.7. La Empresa conserva la prueba de la aceptación junto con la versión aceptada, la huella del texto, la fecha y hora y el identificador de la solicitud, conforme al artículo 2.2.2.25.2.5. Esta prueba subsiste a la supresión de los demás registros del 8.6 y se sujeta al plazo de conservación que la Empresa declare para ella; a falta de plazo declarado, se aplica el plazo por defecto de la tabla supletoria que administra K+AIR, conforme al 8.6(h).',
].join('\n');

// ---------------------------------------------------------------------------

function error(msg) {
  const e = new Error(msg);
  e.codigo = 3;
  return e;
}

function parseArgs(argv) {
  const args = { salida: SALIDA };
  const lista = Array.isArray(argv) ? argv : process.argv;
  for (let i = 2; i < lista.length; i++) {
    const a = lista[i];
    if (a.startsWith('--salida=')) args.salida = path.resolve(a.slice('--salida='.length).trim());
    else {
      console.error('Argumento desconocido: ' + a);
      process.exit(2);
    }
  }
  return args;
}

/**
 * Reemplaza un numeral en el mapa de cambios, exigiendo que exista.
 * @param {object} cambios
 * @param {string} clave
 * @param {string} texto
 */
function fijar(cambios, clave, texto) {
  if (!Object.prototype.hasOwnProperty.call(cambios.cambios, clave)) {
    throw error('El JSON de la v1.2 no tiene el numeral "' + clave + '". Revisar el empalme.');
  }
  cambios.cambios[clave] = texto;
}

function main() {
  const args = parseArgs();

  if (!fs.existsSync(BASE_CAMBIOS)) {
    throw error('No existe ' + BASE_CAMBIOS + '.');
  }
  const crudoBase = fs.readFileSync(BASE_CAMBIOS, 'utf8');
  let cambios;
  try {
    cambios = JSON.parse(crudoBase);
  } catch (err) {
    throw error('El JSON de la v1.2 no se puede leer: ' + err.message);
  }

  // Autoverificación de formato: si el serializador no reproduce el archivo de la
  // v1.2 byte a byte, este script no sabe qué formato produce y no escribe nada.
  const reSerializado = JSON.stringify(cambios, null, 2) + '\n';
  if (reSerializado !== crudoBase) {
    throw error(
      'El formato del JSON de la v1.2 no es el que este script asume: volver a '
      + 'serializarlo no lo reproduce byte a byte. Revisar antes de escribir la v1.3.',
    );
  }

  // --- metadatos de la versión -------------------------------------------
  cambios.version = 'v1.3';
  cambios.fuente = 'especificacion del abogado del 30-oct-2026 (cierre de la linea legal de la firma electronica)';
  cambios.fuente_ruta = 'docs/gestion-humana/firma-electronica/especificacion-abogado-2026-10-30.md';
  cambios.nota = [
    'Cambios de la v1.3. Arrastra los cambios de la v1.2 (que nunca se publico) y aplica la',
    'especificacion del abogado del 30-oct-2026. T1: el 5.1 separa los tres deberes legales',
    'del articulo 2.2.2.47.6 del Decreto 1074 de 2015 de los deberes operativos adicionales de',
    'K+AIR, y el aviso legal deja de estar restringido a la Empresa y a K+AIR. T2: el literal',
    'f) del 5.1 es la redaccion literal del abogado sobre las politicas de seguridad, y el',
    'numeral 5.6 (nuevo) declara el mecanismo con el que el Firmante las conoce: la pantalla',
    'muestra la version junto con el texto y la aceptacion registra texto, huella y fecha.',
    'D1: se elimina la retencion indefinida por falta de plazo declarado. El 8.6 fija la',
    'precedencia (reglas legales especiales que no se rebajan, tabla de la Empresa, y a falta',
    'de plazo declarado la tabla supletoria que administra K+AIR), la tabla supletoria es',
    'configurable y se publica en el Anexo de Encargo, y un cambio en ella no altera los plazos',
    'ya calculados. El 3.6(g), el 10.4(a) y el 10.6 se ajustan a esa precedencia.',
    'La fecha de vigencia NO se inventa: queda como marcador en el encabezado y la fija el',
    'owner antes de publicar.',
  ].join(' ');

  // --- los seis deltas ----------------------------------------------------
  fijar(cambios, '5.1', NUMERAL_5_1);
  fijar(cambios, '8.6', NUMERAL_8_6);
  fijar(cambios, '3.6(g)', LITERAL_3_6_G);
  fijar(cambios, '10.4(a)', LITERAL_10_4_A);
  fijar(cambios, '10.6', NUMERAL_10_6);
  fijar(cambios, '12.7', NUMERAL_12_7);

  // 5.6 es un numeral nuevo: se inserta después del 5.5, que sí existe en la base.
  cambios.cambios['5.6'] = NUMERAL_5_6;
  cambios.inserciones = cambios.inserciones || {};
  cambios.inserciones['5.6'] = '5.5';

  // El encabezado se sella ANTES de aplicar los reemplazos de texto libre, así que
  // el reemplazo que lo menciona tiene que hablar de la versión nueva. Si no, el
  // empalme busca "Versión del Acuerdo: v1.2" en un texto que ya dice v1.3 y se
  // niega: es lo que pasó la primera vez que se corrió este script.
  for (const r of cambios.reemplazos_texto || []) {
    if (r && typeof r.antiguo === 'string'
      && /^Versión del Acuerdo: v\d+\.\d+$/.test(r.antiguo)) {
      r.antiguo = 'Versión del Acuerdo: ' + cambios.version;
      r.nuevo = String(r.nuevo).replace(
        /^Versión del Acuerdo: v\d+\.\d+/,
        'Versión del Acuerdo: ' + cambios.version,
      );
    }
  }

  // --- escritura ----------------------------------------------------------
  const salida = JSON.stringify(cambios, null, 2) + '\n';
  fs.writeFileSync(args.salida, salida, 'utf8');

  // --- resumen ------------------------------------------------------------
  const crypto = require('crypto');
  console.log('JSON de la v1.3 escrito: ' + path.relative(SERVICE_ROOT, args.salida));
  console.log('Bytes: ' + Buffer.byteLength(salida, 'utf8'));
  console.log('SHA-256: ' + crypto.createHash('sha256').update(salida, 'utf8').digest('hex'));
  console.log('Numerales en el mapa: ' + Object.keys(cambios.cambios).length);
  console.log('Inserciones: ' + Object.keys(cambios.inserciones).join(', '));
  console.log('Deltas aplicados: 5.1, 5.6 (nuevo), 8.6, 3.6(g), 10.4(a), 10.6, 12.7');
}

try {
  main();
} catch (err) {
  console.error('ERROR: ' + err.message);
  process.exit(err.codigo || 3);
}
