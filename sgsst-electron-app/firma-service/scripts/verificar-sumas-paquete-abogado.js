/**
 * verificar-sumas-paquete-abogado.js
 *
 * COMPRUEBA QUE EL PAQUETE DEL ABOGADO SIGA INTEGRO
 * ==================================================
 *
 * QUE ES ESTE ARCHIVO
 * -------------------
 * El paquete que se le manda al abogado lleva su propio manifiesto de
 * integridad: `SHA256SUMS.txt`, con una linea por adjunto:
 *
 *   <sha256>  <nombre del archivo>
 *
 * Ese manifiesto es lo que permite responder "el archivo que recibiste es
 * ESTE" y no "parecido". Y es lo que detecta que alguien edito un adjunto
 * sin avisar.
 *
 * EL FALLO QUE ESTE SCRIPT CIERRA
 * -------------------------------
 * El 12-nov-2026 se verificaron las 14 sumas y **dos no coincidian**:
 *
 *   - `10-informe-correcciones-para-asesor-juridico.md`, editado ese mismo dia.
 *   - `11-checklist-definitivo-revision-juridica-y-cierre.md`, editado en la
 *     ronda ANTERIOR (la fila J12 del 📦1050). Esa edicion **no regenero** el
 *     manifiesto, y nadie lo noto: el archivo que se habia enviado al abogado
 *     seguia cuadrando con lo que se le habia enviado, y el repositorio ya no
 *     cuadraba con el paquete.
 *
 * El arreglo de fondo no es "recordarse de regenerar el manifiesto": es que
 * el deriva **se note sola**. Eso es este script.
 *
 * QUE HACE
 * --------
 * 1. Lee el `SHA256SUMS.txt` del paquete.
 * 2. Recalcula el SHA-256 de cada archivo listado.
 * 3. Compara. Si algo no coincide, lo dice NOMBRANDO el archivo y sale con
 *    codigo 1.
 *
 * SOLO LEE. No escribe, no regenera, no toca nada. Para rehacer el manifiesto
 * hay que llamar a `scripts/armar-paquete-abogado.js` (que ademas copia los
 * adjuntos y retira los de rondas anteriores) o regenerarlo a mano con el
 * mismo formato.
 *
 * INTERFAZ
 * --------
 *   node verificar-sumas-paquete-abogado.js                    Verifica el
 *       paquete real (sale 0 si todo cuadra, 1 si hay deriva, 2 si falta el
 *       manifiesto).
 *   node verificar-sumas-paquete-abogado.js --paquete=<dir>     Verifica otro
 *       paquete (lo usa el test, sobre una COPIA).
 *   node verificar-sumas-paquete-abogado.js --json              Salida en JSON.
 *
 * Este archivo es codigo: se escribe en ASCII puro (sin tildes ni enie).
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** El paquete del abogado, relativo a este script. */
const PAQUETE_POR_DEFECTO = path.resolve(
  __dirname, '..', '..', 'docs', 'gestion-humana', 'firma-electronica',
  'paquete-abogado-2026-10-30'
);

/** El nombre del manifiesto de integridad. */
const NOMBRE_MANIFIESTO = 'SHA256SUMS.txt';

/**
 * Calcula el SHA-256 de un buffer.
 * @param {Buffer} buf
 * @returns {string}
 */
function sha256(buf) {
  return require('crypto').createHash('sha256').update(buf).digest('hex');
}

/**
 * Verifica el manifiesto de un paquete.
 * @param {string} dirPaquete la carpeta del paquete.
 * @returns {{ok: boolean, codigo: number, lineas: number, deriva: Array, faltan: Array, sobran: Array}}
 */
function verificar(dirPaquete) {
  const rutaManifiesto = path.join(dirPaquete, NOMBRE_MANIFIESTO);
  if (!fs.existsSync(rutaManifiesto)) {
    return {
      ok: false,
      codigo: 2,
      lineas: 0,
      deriva: [],
      faltan: [],
      sobran: [],
      error: 'No existe ' + NOMBRE_MANIFIESTO + ' en ' + dirPaquete,
    };
  }

  const texto = fs.readFileSync(rutaManifiesto, 'utf8');
  const lineas = texto.split('\n').filter((l) => l.trim() !== '');
  const deriva = [];
  const faltan = [];
  const listados = [];

  for (const linea of lineas) {
    const m = /^([0-9a-f]{64})\s+(.+)$/.exec(linea.trim());
    if (!m) {
      deriva.push({ archivo: linea.trim(), motivo: 'la linea no tiene el formato "<sha256>  <archivo>"' });
      continue;
    }
    const esperado = m[1];
    const nombre = m[2].trim();
    listados.push(nombre);
    const ruta = path.join(dirPaquete, nombre);
    if (!fs.existsSync(ruta)) {
      faltan.push(nombre);
      continue;
    }
    const real = sha256(fs.readFileSync(ruta));
    if (real !== esperado) {
      deriva.push({ archivo: nombre, motivo: 'la suma no coincide', esperado: esperado, real: real });
    }
  }

  // Un archivo del paquete que NO esta en el manifiesto es una deriva
  // invisible: el manifiesto no lo ampara.
  const sobran = [];
  if (fs.existsSync(dirPaquete)) {
    for (const nombre of fs.readdirSync(dirPaquete)) {
      if (nombre === NOMBRE_MANIFIESTO) continue;
      if (!/\.(md|txt|html)$/.test(nombre)) continue;
      if (listados.indexOf(nombre) >= 0) continue;
      sobran.push(nombre);
    }
  }

  return {
    ok: deriva.length === 0 && faltan.length === 0,
    codigo: deriva.length === 0 && faltan.length === 0 ? 0 : 1,
    lineas: lineas.length,
    deriva: deriva,
    faltan: faltan,
    sobran: sobran,
  };
}

function main() {
  const args = process.argv.slice(2);
  const comoJson = args.indexOf('--json') >= 0;
  const dePaquete = (args.find((a) => a.indexOf('--paquete=') === 0) || '').split('=')[1];
  const dirPaquete = dePaquete ? path.resolve(dePaquete) : PAQUETE_POR_DEFECTO;

  const r = verificar(dirPaquete);

  if (comoJson) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log('Paquete: ' + dirPaquete);
    console.log('Lineas del manifiesto: ' + r.lineas);
    if (r.error) console.log('  ERROR: ' + r.error);
    r.deriva.forEach((d) => {
      console.log('  DERIVA ' + d.archivo + ': ' + d.motivo);
      if (d.esperado) {
        console.log('        esperado ' + d.esperado);
        console.log('        real     ' + d.real);
      }
    });
    r.faltan.forEach((f) => console.log('  FALTA  ' + f + ': esta en el manifiesto y no en el paquete'));
    r.sobran.forEach((f) => console.log('  SUELTO ' + f + ': esta en el paquete y no en el manifiesto'));
    if (r.ok) {
      console.log('  OK: las ' + r.lineas + ' sumas coinciden.');
      if (r.sobran.length) {
        console.log('  (sin manifiesto, por diseno del paquete: ' + r.sobran.join(', ') + ')');
      }
    } else {
      console.log('  FALLA: el paquete ya no es el que se firmo ni se envio.');
    }
  }
  return r.codigo;
}

module.exports = { verificar: verificar, PAQUETE_POR_DEFECTO: PAQUETE_POR_DEFECTO };

if (require.main === module) {
  process.exit(main());
}
