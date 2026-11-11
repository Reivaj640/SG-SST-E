#!/usr/bin/env node
/**
 * Actualiza en el manifiesto los bloques `acuerdo` y `constancia` para la
 * version v1.6 del Acuerdo.
 *
 * POR QUE UN SCRIPT PROPIO
 * -------------------------
 * El manifiesto es la salida de `scripts/actualizar-manifiesto-1047.js`, que
 * administra los bloques de los anexos. Los bloques del Acuerdo y de la
 * Constancia los administra este script. Los dos se corren en cualquier
 * orden: cada uno toca solo sus bloques.
 *
 * QUE ESCRIBE
 * ------------
 * `acuerdo`: el archivo, la huella, la version y la fecha de la v1.6, y
 * `publicado`. El campo va en false por una razon concreta: la version
 * activa en la base sigue siendo la v1.5 hasta que la v1.6 se registre con
 * su autorizacion operativa. Declarar `publicado: true` sobre un texto que
 * la base no tiene seria un verde falso.
 *
 * `constancia`: la huella del modelo reemitido (y completado con los datos
 * del registro) y la version a la que apunta. La Constancia sigue SIN
 * FIRMAR: su seccion 5 y su seccion 6 estan vacios, como las de la v1.4 y la v1.5.
 *
 * LOS DOS ESTADOS (--publicado)
 * ------------------------------
 * El manifiesto se escribe dos veces el 11-nov-2026, y cada vez dice la
 * verdad de ese momento:
 *
 *   (por defecto)  la v1.6 todavia NO esta registrada: `publicado: false`.
 *   --publicado    la v1.6 ya esta activa en la base con su autorizacion
 *                  operativa: `publicado: true`.
 *
 * El estado se pasa por parametro, no se deduce: quien lo escribe es el
 * operador, que sabe lo que acaba de hacer. Un manifiesto que se declara
 * publicado sin que la base lo diga es un verde falso, y uno que se
 * declara sin publicar cuando la base ya la tiene activa es una mentira
 * al reves.
 *
 * El manifiesto es ASCII puro y se parchea por texto: re-serializarlo con
 * JSON.stringify convertiria los \uXXXX en caracteres reales y el diff
 * seria enorme.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(SERVICE_ROOT, '..');
const MANIFIESTO = path.join(SERVICE_ROOT, 'legal-readiness.json');

const VERSION = 'v1.6';
const FECHA_VIGENCIA = '2026-11-11';
const RELATIVO_ACUERDO = 'scripts/fixtures/acuerdo-' + VERSION + '.txt';
const RUTA_ACUERDO = path.join(SERVICE_ROOT, RELATIVO_ACUERDO);
const RUTA_CONSTANCIA = path.join(APP_ROOT, 'legal', 'constancia-aprobacion-acuerdo.html');

// El bloque `acuerdo` tiene dos notas: una mientras la v1.6 todavia no esta
// registrada en la base, y otra cuando ya esta activa con su autorizacion
// operativa. La segunda NO se escribe a mano: la produce el operador con
// --publicado, en el mismo momento en que la base la dice activa.
const NOTA_ACUERDO_BASE = 'Acuerdo vigente en el repo: ' + VERSION + ', huella ' + '{HASH_ACUERDO}'
  + ', fecha de vigencia ' + FECHA_VIGENCIA + ', texto en ' + RELATIVO_ACUERDO + '. La v1.6 sale de la v1.5 '
  + 'con un cambio acotado a los numerales 8.7, 10.1 y 10.5(f): el canal de correo ya no es una cuenta '
  + 'gratuita de Gmail para consumidores sino una cuenta empresarial de Google Workspace con el CDPA '
  + 'aceptado el 10-nov-2026, y el papel de Google queda delimitado en dos planos (Responsable por cuenta '
  + 'propia en los datos de la cuenta del administrador y la telemetria; Encargado del Encargado, '
  + 'vinculado por el CDPA, en los datos del cliente que transitan por el canal). "Subencargado" queda '
  + 'declarado como figura contractual y no como categoria de la Ley 1581 de 2012. ';

const NOTA_ACUERDO_PENDIENTE = NOTA_ACUERDO_BASE
  + 'NO esta publicada: el campo publicado=false es correcto porque la version activa en la base sigue siendo '
  + 'la v1.5, con su huella 952592f078eb3e8ca6a913361beb6a5eb7c32f22bba2c9fa30d17ab09825be28 y fecha de '
  + 'vigencia 2026-11-05, hasta que la v1.6 se registre con su autorizacion operativa. La Constancia se '
  + 'reemitio contra la v1.6 y se completo el 11-nov-2026 con los datos del registro (el responsable del '
  + 'registro y la fecha del registro); su seccion 5 y su seccion 6 siguen vacios, como la Constancia de la v1.4, '
  + 'porque la autorizacion operativa no se documenta en ese documento sino en el registro de '
  + 'aprobaciones de publicacion del servicio. El fundamento esta en '
  + 'docs/gestion-humana/firma-electronica/dictamen-legal-textos-2026-11-11.md.';

const NOTA_ACUERDO_PUBLICADO = NOTA_ACUERDO_BASE
  + 'Esta publicada: la v1.6 es la version activa en la base desde el 11-nov-2026, con su autorizacion '
  + 'operativa registrada (tipo OPERATIVA) para ese texto y esa huella, y con la Constancia de la v1.6 en '
  + 'legal/constancia-aprobacion-acuerdo.html; su seccion 5 y su seccion 6 siguen vacios, como la Constancia de la '
  + 'v1.4, porque la autorizacion operativa no se documenta en ese documento sino en el '
  + 'registro de aprobaciones de publicacion del servicio (gh_firma_aprobaciones_publicacion). El '
  + 'fundamento esta en docs/gestion-humana/firma-electronica/dictamen-legal-textos-2026-11-11.md.';

// El bloque `constancia` tambien tiene dos notas. La del modelo completado se
// escribe en los dos estados: lo que cambia entre ellos no es la Constancia,
// sino si la autorizacion operativa que el manifiesto dice que se exige ya
// esta registrada en la base.
const NOTA_CONSTANCIA_BASE = 'Modelo reemitido contra la ' + VERSION + ' del Acuerdo el 11-nov-2026 y '
  + 'completado el mismo dia con los datos que el owner confirmo: el responsable del registro (Javier '
  + 'Robles Fontalvo, Representante Legal de Gesstiar S.A.S.) y la fecha del registro (2026-11-11). '
  + 'Identifica la version y la huella exacta del texto que se somete a autorizacion operativa, y no la del '
  + 'Acuerdo que este mismo dia se sustituye. Desde el 03-nov-2026 es una constancia interna de version y '
  + 'autorizacion operativa de publicacion a cargo del representante legal; no declara ni requiere una '
  + 'aprobacion juridica del abogado. Lo que NO esta: la firma del representante legal ni los datos de la '
  + 'autorizacion operativa (su seccion 5 y su seccion 6 siguen vacios, igual que en la Constancia de la v1.4), '
  + 'porque esa autorizacion no se documenta en este documento sino en el registro append-only de '
  + 'aprobaciones de publicacion del servicio (gh_firma_aprobaciones_publicacion, tipo OPERATIVA). ';

const NOTA_CONSTANCIA_PENDIENTE = NOTA_CONSTANCIA_BASE
  + 'La autorizacion operativa de la v1.6 todavia NO esta registrada: hasta que lo este, el texto de la '
  + 'v1.6 no puede publicarse, porque el gate mide la compuerta de autorizacion operativa vigente contra '
  + 'la version activa de la base.';

const NOTA_CONSTANCIA_PUBLICADO = NOTA_CONSTANCIA_BASE
  + 'La autorizacion operativa de la v1.6 quedo registrada el 11-nov-2026 en el mismo servicio, con la '
  + 'garantia, el resultado de las verificaciones y el responsable del despliegue; el gate de publicacion '
  + 'deja de reportar bloqueantes.';

function error(mensaje) {
  console.error('[actualizar-manifiesto-v1.6] ERROR: ' + mensaje);
  process.exit(3);
}

function sha256De(ruta) {
  return crypto.createHash('sha256').update(fs.readFileSync(ruta)).digest('hex');
}

/** Pone un valor JSON literal (string, booleano o null) en una clave de un bloque. */
function ponerEnBloque(texto, bloque, clave, valorJson, etiqueta) {
  const i = texto.indexOf('"' + bloque + '": {');
  if (i < 0) error('El manifiesto no tiene el bloque "' + bloque + '".');
  const fin = texto.indexOf('\n  },', i);
  if (fin < 0) error('No se pudo cerrar el bloque "' + bloque + '".');
  const antes = texto.slice(0, i);
  const cuerpo = texto.slice(i, fin);
  const despues = texto.slice(fin);
  // El valor puede contener comillas ESCAPADAS (\"), asi que el patron tiene
  // que reconocer un string JSON completo y no solo los caracteres que no son
  // comilla.
  const patron = new RegExp('("' + clave + '"\\s*:\\s*)("(?:[^"\\\\]|\\\\.)*"|true|false|null)');
  const m = patron.exec(cuerpo);
  if (!m) error('El bloque "' + bloque + '" no tiene la clave "' + clave + '" (' + etiqueta + ').');
  const nuevoCuerpo = cuerpo.replace(m[0], m[1] + valorJson);
  return antes + nuevoCuerpo + despues;
}

/**
 * El estado (`publicado`) que declara HOY el manifiesto, en su bloque
 * `acuerdo`. Se usa para que `--check` compare contra el estado que el
 * manifiesto ya tiene: el check responde "¿el manifiesto es coherente con los
 * archivos?", no "¿el manifiesto esta en el estado pendiente?".
 *
 * @param {string} texto contenido crudo del manifiesto
 * @returns {boolean}
 */
function estadoActualDelManifiesto(texto) {
  const i = texto.indexOf('"acuerdo": {');
  if (i < 0) error('El manifiesto no tiene el bloque "acuerdo".');
  const fin = texto.indexOf('\n  },', i);
  if (fin < 0) error('No se pudo cerrar el bloque "acuerdo".');
  const cuerpo = texto.slice(i, fin);
  const m = /"publicado"\s*:\s*(true|false)/.exec(cuerpo);
  if (!m) error('El bloque "acuerdo" no declara el campo "publicado".');
  return m[1] === 'true';
}

function construir(soloCheck, publicado) {
  if (!fs.existsSync(RUTA_ACUERDO)) error('No existe ' + RUTA_ACUERDO + '.');
  if (!fs.existsSync(RUTA_CONSTANCIA)) error('No existe ' + RUTA_CONSTANCIA + '.');

  const hashAcuerdo = sha256De(RUTA_ACUERDO);
  const bytesAcuerdo = fs.statSync(RUTA_ACUERDO).size;
  const hashConstancia = sha256De(RUTA_CONSTANCIA);

  // El estado lo declara el operador: por defecto la v1.6 todavia no esta
  // registrada; con --publicado, ya esta activa en la base.
  const notaAcuerdo = publicado ? NOTA_ACUERDO_PUBLICADO : NOTA_ACUERDO_PENDIENTE;
  const notaConstancia = publicado ? NOTA_CONSTANCIA_PUBLICADO : NOTA_CONSTANCIA_PENDIENTE;

  let m = fs.readFileSync(MANIFIESTO, 'utf8');

  m = ponerEnBloque(m, 'acuerdo', 'archivo', '"' + RELATIVO_ACUERDO + '"', 'acuerdo.archivo');
  m = ponerEnBloque(m, 'acuerdo', 'hash', '"' + hashAcuerdo + '"', 'acuerdo.hash');
  m = ponerEnBloque(m, 'acuerdo', 'version', '"' + VERSION + '"', 'acuerdo.version');
  m = ponerEnBloque(m, 'acuerdo', 'fecha', '"' + FECHA_VIGENCIA + '"', 'acuerdo.fecha');
  m = ponerEnBloque(m, 'acuerdo', 'publicado', publicado ? 'true' : 'false', 'acuerdo.publicado');
  m = ponerEnBloque(
    m, 'acuerdo', 'nota',
    '"' + notaAcuerdo.replace('{HASH_ACUERDO}', hashAcuerdo).replace(/"/g, '\\"') + '"',
    'acuerdo.nota'
  );

  m = ponerEnBloque(m, 'constancia', 'hash', '"' + hashConstancia + '"', 'constancia.hash');
  m = ponerEnBloque(m, 'constancia', 'version', '"' + VERSION + '"', 'constancia.version');
  m = ponerEnBloque(
    m, 'constancia', 'nota',
    '"' + notaConstancia.replace(/"/g, '\\"') + '"',
    'constancia.nota'
  );

  if (soloCheck) {
    const actual = fs.readFileSync(MANIFIESTO, 'utf8');
    if (actual !== m) {
      console.error('[actualizar-manifiesto-v1.6] El manifiesto NO esta actualizado (--check).');
      process.exit(3);
    }
    console.log('Manifiesto coherente con los archivos (--check, no se escribio nada).');
  } else {
    fs.writeFileSync(MANIFIESTO, m, 'utf8');
    console.log('[actualizar-manifiesto-v1.6] Manifiesto actualizado (publicado=' + (publicado ? 'true' : 'false') + ').');
  }

  console.log('  acuerdo.' + VERSION + ': ' + hashAcuerdo + ' (' + bytesAcuerdo + ' bytes)');
  console.log('  constancia: ' + hashConstancia);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const soloCheck = args.includes('--check');
  const publicadoExplicito = args.includes('--publicado');
  if (soloCheck && publicadoExplicito) {
    error('No se pueden combinar --check y --publicado: --check compara contra un estado y --publicado declara otro.');
  }
  // En modo --check sin estado explicito, se compara contra el estado que el
  // manifiesto ya declara: el check verifica la COHERENCIA con los archivos.
  let publicado = publicadoExplicito;
  if (soloCheck && !publicadoExplicito) {
    publicado = estadoActualDelManifiesto(fs.readFileSync(MANIFIESTO, 'utf8'));
    console.log('[actualizar-manifiesto-v1.6] el manifiesto declara publicado=' + publicado
      + ': se compara contra ese estado.');
  }
  construir(soloCheck, publicado);
}

module.exports = { construir, ponerEnBloque, estadoActualDelManifiesto };
