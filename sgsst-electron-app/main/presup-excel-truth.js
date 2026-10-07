/* Lectura INDEPENDIENTE del Excel de presupuesto, para que los tests tengan contra qué
 * compararse sin depender de una constante escrita a mano.
 *
 * POR QUE EXISTE
 *
 * Estos tests verifican que el importador de 📦824 reproduzca el Excel real. Durante mucho
 * tiempo comparaban contra numeros escritos a mano en el propio test (19.696.874,33, 6.209.816,
 * 9.314.724...). Eso funciono hasta que alguien edito el Excel: se le agrego septiembre a la
 * fila de honorarios, el archivo paso a tener 9 meses en vez de 8, y los tests se pusieron en
 * rojo reportando un bug de $776.227 que no existia — el importador estaba perfectamente bien.
 *
 * Peor: el fallo es INDISTINGUIBLE de un bug real. Un test rojo aqui significa dos cosas
 * opuestas y el test no dice cual.
 *
 * La salida de este modulo es ese "contra que": las cifras se leen del archivo en el momento de
 * correr, asi que editar el Excel no rompe nada y un rojo si significa algo real.
 *
 * POR QUE NO ES UNA TAUTOLOGIA
 *
 * Porque se lee por un camino distinto al del producto. El importador de
 * `main/presupuesto-bridge.js` parsea el .xlsx con su propia logica (celdas combinadas, filas
 * agrupadas por bloque, columnas D..R). Este modulo abre el archivo con SheetJS crudo y suma
 * celda por celda. Si el importador se rompe — se le cae una columna, se le salta una fila, suma
 * dos veces — la comparacion lo detecta, porque las dos sumas vienen de caminos distintos.
 *
 * LO QUE NO SE DERIVA (y por que)
 *
 * El factor IPC queda fijo en el test (0.052). Es un parametro que se decide una vez al ano y
 * no crece con la ejecucion; ademas el archivo lo muestra con formato de porcentaje, que el lector
 * crudo no interpreta igual. El total de valores mensuales sale de `cantidad * 12` en vez de
 * estar escrito.
 */

'use strict';

const path = require('path');

const MESES = 12;

/** Las 3 columnas de la hoja del presupuesto, por indice 0-based. */
const COL_ASIGNADO = 3;   // D — ASIGNACION PRESUPUESTO ANUAL
const COL_EJECUTADO = 4;  // E — EJECUTADO ACUMULADO

/**
 * Lee el Excel y devuelve las cifras de referencia.
 * Lanza si el archivo no tiene la forma esperada: prefiereme un error claro a devolver
 * ceros en silencio y que el test "pase" comparando nulos.
 *
 * @param {string} rutaXlsx
 * @returns {{cantidad:number, filas:Array, sumaAsignado:number, sumaEjecutado:number,
 *            totalDeclaradoAsignado:number, totalDeclaradoEjecutado:number,
 *            valoresMensuales:number, primera:Object}}
 */
function leer(rutaXlsx) {
  const XLSX = require(path.join(path.dirname(__dirname), 'node_modules', 'xlsx'));
  const wb = XLSX.readFile(rutaXlsx);
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws['!ref']) throw new Error('La primera hoja del Excel está vacía');

  const rango = XLSX.utils.decode_range(ws['!ref']);
  const txt = function (r, c) {
    const cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
    return (cell && cell.v !== null && cell.v !== undefined) ? String(cell.v).trim() : '';
  };
  const num = function (r, c) {
    const cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
    return (cell && typeof cell.v === 'number' && isFinite(cell.v)) ? cell.v : 0;
  };

  // La fila de encabezado es la que dice "ASIGNACION PRESUPUESTO ANUAL". Se busca en vez de
  // fijarla en 8, porque si alguien inserta una fila arriba el archivo entero se desplaza.
  let fEnc = -1;
  for (let r = 0; r <= rango.e.r && fEnc < 0; r++) {
    for (let c = 0; c <= rango.e.c; c++) {
      if (/ASIGNACION\s+PRESUPUESTO\s+ANUAL/i.test(txt(r, c))) { fEnc = r; break; }
    }
  }
  if (fEnc < 0) throw new Error('No se encontró la fila de encabezado "ASIGNACION PRESUPUESTO ANUAL"');

  // Las partidas terminan en la fila "TOTAL AÑO", que se busca por texto.
  let fTotal = -1;
  for (let r = fEnc + 1; r <= rango.e.r; r++) {
    if (/TOTAL\s*A[ÑN]O/i.test(txt(r, 0)) || /TOTAL\s*A[ÑN]O/i.test(txt(r, 2))) { fTotal = r; break; }
  }
  if (fTotal < 0) throw new Error('No se encontró la fila "TOTAL AÑO"');

  // Las filas de datos son las que tienen detalle en la columna C. Eso descarta solo la
  // sub-fila de meses (ENERO..DICIEMBRE), que no tiene nada en B ni en C.
  const filas = [];
  for (let r = fEnc + 1; r < fTotal; r++) {
    const detalle = txt(r, 2);
    if (!detalle) continue;
    filas.push({
      fila: r + 1,
      detalle: detalle,
      bloque: txt(r, 1),
      asignado: num(r, COL_ASIGNADO),
      ejecutado: num(r, COL_EJECUTADO)
    });
  }
  if (!filas.length) throw new Error('No se encontró ninguna partida entre el encabezado y TOTAL AÑO');

  const suma = function (campo) {
    return filas.reduce(function (a, x) { return a + (x[campo] || 0); }, 0);
  };

  return {
    cantidad: filas.length,
    filas: filas,
    sumaAsignado: suma('asignado'),
    sumaEjecutado: suma('ejecutado'),
    totalDeclaradoAsignado: num(fTotal, COL_ASIGNADO),
    totalDeclaradoEjecutado: num(fTotal, COL_EJECUTADO),
    valoresMensuales: filas.length * MESES,
    primera: filas[0]
  };
}

/** Formato de pesos colombiano, para que el output del test se lea igual que el Excel. */
function pesos(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

module.exports = { leer, pesos, MESES };