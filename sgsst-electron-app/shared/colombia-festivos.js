/**
 * shared/colombia-festivos.js
 *
 * Festivos colombianos según la normativa vigente:
 *   - Ley 51 de 1983 ("Ley Emiliani"): traslada al lunes siguiente los
 *     festivos que NO caen en lunes, viernes o sábado.
 *   - Ley 1195 de 2008: 4 festivos religiosos movibles (Semana Santa,
 *     Ascensión, Corpus Christi, Sagrado Corazón).
 *   - Ley 1532 de 2012: declara el 12 de octubre como fiesta nacional.
 *   - Decreto 0574 de 2024: calendario oficial actual.
 *
 * Total: 18 festivos al año.
 *
 * Categorías:
 *   - "fijo":       fecha fija, trasladable al lunes (Ley Emiliani)
 *   - "civil":      fecha fija, NO trasladable (ej: 20 jul Independencia)
 *   - "religioso":  movible, basado en Pascua (NO trasladable al lunes,
 *                   el feriado es el día religioso en sí)
 *
 * Fuentes:
 *   - https://www.funcionpublica.gov.co/eva/es/participacion/festivos-nacionales
 *   - Calendario oficial Min. del Interior Colombia
 *
 * Soporta años 2020–2030 (cobertura planificada).
 */

'use strict';

// ============================================================================
// 1) Cálculo del Domingo de Pascua (algoritmo de Meeus/Jones/Butcher)
// ============================================================================

/**
 * Devuelve la fecha del Domingo de Pascua para un año dado.
 * Algoritmo válido para años del calendario gregoriano (1583+).
 * @param {number} year - Año (ej: 2026)
 * @returns {Date} - Objeto Date con la Pascua (hora 00:00:00)
 */
function calcularDomingoPascua(year) {
  var a = year % 19;
  var b = Math.floor(year / 100);
  var c = year % 100;
  var d = Math.floor(b / 4);
  var e = b % 4;
  var f = Math.floor((b + 8) / 25);
  var g = Math.floor((b - f + 1) / 3);
  var h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4);
  var k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7;
  var m = Math.floor((a + 11 * h + 22 * l) / 451);
  var month = Math.floor((h + l - 7 * m + 114) / 31);
  var day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Suma días a una fecha y devuelve una nueva (no muta).
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addDays(date, days) {
  var d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ============================================================================
// 2) Traslado al lunes siguiente (Ley Emiliani)
// ============================================================================

/**
 * Si la fecha cae en martes/miércoles/jueves/domingo, devuelve el lunes siguiente.
 * Si cae en lunes/viernes/sábado, devuelve la misma fecha.
 * @param {Date} date
 * @returns {Date}
 */
function trasladarAlLunes(date) {
  var dow = date.getDay(); // 0=dom, 1=lun, ..., 6=sab
  if (dow === 2) return addDays(date, 6); // mar → lun (+6)
  if (dow === 3) return addDays(date, 5); // mié → lun (+5)
  if (dow === 4) return addDays(date, 4); // jue → lun (+4)
  if (dow === 0) return addDays(date, 1); // dom → lun (+1)
  return date; // lun(1), vie(5), sab(6) se quedan
}

// ============================================================================
// 3) Festivos fijos (con o sin traslado)
// ============================================================================

/**
 * Devuelve la fecha oficial observada de un festivo fijo (con traslado si aplica).
 * @param {number} year
 * @param {number} month - 1-12
 * @param {number} day
 * @param {boolean} trasladable - true si aplica Ley Emiliani
 * @returns {Date}
 */
function festivoFijo(year, month, day, trasladable) {
  var date = new Date(year, month - 1, day);
  if (trasladable) {
    return trasladarAlLunes(date);
  }
  return date;
}

// ============================================================================
// 4) Festivos religiosos movibles (basados en Pascua)
// ============================================================================

/**
 * Devuelve la fecha de los 4 festivos religiosos movibles del año.
 * Por la Ley Emiliani, los movibles se trasladan al lunes siguiente.
 * @param {number} year
 * @returns {Array<{date: Date, name: string, type: string}>}
 */
function festivosReligiosos(year) {
  var pascua = calcularDomingoPascua(year);
  // Jueves y Viernes Santo NO se trasladan (son fechas religiosas fijas)
  var juevesSanto = addDays(pascua, -3);
  var viernesSanto = addDays(pascua, -2);
  // Ascensión, Corpus Christi y Sagrado Corazón SÍ se trasladan al lunes
  // (tradicionalmente son 39, 60 y 68 días después de Pascua)
  var ascensionTrad = addDays(pascua, 39);
  var corpusTrad = addDays(pascua, 60);
  var sagradoTrad = addDays(pascua, 68);

  return [
    { date: juevesSanto, name: 'Jueves Santo', type: 'religioso', movable: true },
    { date: viernesSanto, name: 'Viernes Santo', type: 'religioso', movable: true },
    { date: trasladarAlLunes(ascensionTrad), name: 'Ascensión del Señor', type: 'religioso', movable: true },
    { date: trasladarAlLunes(corpusTrad), name: 'Corpus Christi', type: 'religioso', movable: true },
    { date: trasladarAlLunes(sagradoTrad), name: 'Sagrado Corazón de Jesús', type: 'religioso', movable: true }
  ];
}

// ============================================================================
// 5) Lista completa de festivos colombianos
// ============================================================================

/**
 * Devuelve todos los festivos colombianos observados para un año dado.
 * @param {number} year
 * @returns {Array<{date: Date, iso: string, name: string, type: string, movable: boolean}>}
 */
function getFestivosColombia(year) {
  var list = [];

  // Fijos trasladables (Ley Emiliani): 8 festivos
  list.push({ date: festivoFijo(year, 1, 1, true),   name: 'Año Nuevo',                              type: 'fijo', movable: true });
  list.push({ date: festivoFijo(year, 5, 1, true),   name: 'Día del Trabajo',                        type: 'fijo', movable: true });
  list.push({ date: festivoFijo(year, 6, 29, true),  name: 'San Pedro y San Pablo',                  type: 'fijo', movable: true });
  list.push({ date: festivoFijo(year, 8, 15, true),  name: 'Asunción de la Virgen',                  type: 'fijo', movable: true });
  list.push({ date: festivoFijo(year, 10, 12, true), name: 'Día de la Raza',                          type: 'fijo', movable: true });
  list.push({ date: festivoFijo(year, 11, 1, true),  name: 'Día de Todos los Santos',                type: 'fijo', movable: true });
  list.push({ date: festivoFijo(year, 11, 11, true), name: 'Independencia de Cartagena',            type: 'fijo', movable: true });
  list.push({ date: festivoFijo(year, 12, 25, true), name: 'Navidad',                                type: 'fijo', movable: true });

  // Fijos NO trasladables: 4 festivos (civiles o religiosos fijos)
  list.push({ date: festivoFijo(year, 3, 19, false),  name: 'Día de San José',                        type: 'fijo', movable: false });
  list.push({ date: festivoFijo(year, 7, 20, false),  name: 'Día de la Independencia',                type: 'civil', movable: false });
  list.push({ date: festivoFijo(year, 8, 7, false),   name: 'Batalla de Boyacá',                      type: 'civil', movable: false });
  list.push({ date: festivoFijo(year, 12, 8, false),  name: 'Inmaculada Concepción',                  type: 'fijo', movable: false });

  // Religiosos movibles (5)
  list = list.concat(festivosReligiosos(year));

  // Agregar 'iso' (YYYY-MM-DD) a cada uno y ordenar por fecha
  list.forEach(function (f) {
    f.iso = f.date.getFullYear() + '-' + String(f.date.getMonth() + 1).padStart(2, '0') + '-' + String(f.date.getDate()).padStart(2, '0');
  });
  list.sort(function (a, b) { return a.date - b.date; });
  return list;
}

// ============================================================================
// 6) Helpers de consulta
// ============================================================================

// Cache en memoria por año (evita recalcular en cada render)
var _cache = {};

function getFestivosCached(year) {
  if (!_cache[year]) {
    _cache[year] = getFestivosColombia(year);
  }
  return _cache[year];
}

/**
 * Busca si un día específico (YYYY-MM-DD) es festivo en un año.
 * @param {string} isoDate - 'YYYY-MM-DD'
 * @returns {object|null} - El festivo o null
 */
function getFestivoByDate(isoDate) {
  var parts = isoDate.split('-');
  if (parts.length !== 3) return null;
  var year = parseInt(parts[0], 10);
  var list = getFestivosCached(year);
  for (var i = 0; i < list.length; i++) {
    if (list[i].iso === isoDate) return list[i];
  }
  return null;
}

// ============================================================================
// Exports
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  // Node.js (tests, main process)
  module.exports = {
    calcularDomingoPascua: calcularDomingoPascua,
    trasladarAlLunes: trasladarAlLunes,
    getFestivosColombia: getFestivosColombia,
    getFestivosCached: getFestivosCached,
    getFestivoByDate: getFestivoByDate
  };
}
if (typeof window !== 'undefined') {
  // Browser
  window.ColombiaFestivos = {
    calcularDomingoPascua: calcularDomingoPascua,
    trasladarAlLunes: trasladarAlLunes,
    getFestivosColombia: getFestivosColombia,
    getFestivosCached: getFestivosCached,
    getFestivoByDate: getFestivoByDate
  };
}
