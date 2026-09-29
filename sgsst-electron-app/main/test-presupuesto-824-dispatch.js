// test-presupuesto-824-dispatch.js
// 📦824 — Guarda contra la clase de bug "this._X is not a function".
//
// Qué pasó: el selector mandaba la acción 'open-budget-from-db' y el dispatch la
// llamaba `this._handleOpenBudgetFromDB` (DB en mayúsculas) cuando el método se
// llamaba `_handleOpenBudgetFromBD`. En runtime eso es un TypeError y el módulo
// se caía al cambiar de período. Estos tests son ESTÁTICOS a propósito: leen el
// fuente, no lo ejecutan, y por eso corren en cualquier motor.
//
// Comprueba tres cosas:
//   1. Cada `case '...'` del dispatch llama a un método que EXISTE.
//   2. Cada acción que manda el selector / la vista de gestión tiene su `case`.
//   3. Los helpers `this._X(...)` citados en el archivo están definidos.
//
// Uso: node main/test-presupuesto-824-dispatch.js

'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const LOGIC = path.join(RAIZ, 'modules', 'recursos', 'presupuesto', 'presupuesto-logic.js');
const SELECTOR = path.join(RAIZ, 'modules', 'recursos', 'presupuesto', 'presupuesto-selector.html');
const GESTION = path.join(RAIZ, 'modules', 'recursos', 'presupuesto', 'presupuesto-gestion.html');

const checks = [];
function ok(n, c, e) { checks.push({ name: n, ok: !!c, extra: e }); }

function leer(p) { return fs.readFileSync(p, 'utf8'); }

// Un método de clase es una línea que NO menciona `this` y termina en '{'.
// Hay que aceptar indentación de 2 y de 4 espacios: el proyecto alterna.
function metodosDefinidos(src) {
  const set = new Set();
  src.split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s{2,8}(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/);
    if (m && !/\bthis\b/.test(l)) set.add(m[1]);
  });
  return set;
}

// Acciones que un iframe le manda al padre, y el cuerpo del handler de esa acción.
function accionesEnviadas(src) {
  const acc = new Set();
  const re = /action\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) acc.add(m[1]);
  return acc;
}

// Recorta SOLO el método handleIframeMessage. El archivo tiene otros `switch`
// (p. ej. el de render(), que decide qué vista pintar) y escanear el archivo
// entero mezclaba los casos: el último `case` se tragaba hasta el final y
// reportaba llamadas que no le pertenecen.
function cuerpoDelDispatch(src) {
  const inicio = src.search(/^\s*async\s+handleIframeMessage\s*\(/m);
  if (inicio < 0) return '';
  const fin = src.indexOf('\n    showErrorUI', inicio);
  return src.slice(inicio, fin > inicio ? fin : src.length);
}

// Cada `case 'x':` se corta en el SIGUIENTE `case`, no en el `break;`.
// Los cuerpos tienen longitudes muy distintas y algunos no tienen indentación
// (p. ej. `case 'requestBudgetData':` pegado al margen), así que buscar el
// break con un regex de tamaño fijo se descuadraba y se perdían casos.
function casosDelDispatch(cuerpo) {
  const re = /case\s+'([^']+)'\s*:/g;
  const marcas = [];
  let m;
  while ((m = re.exec(cuerpo)) !== null) marcas.push({ accion: m[1], ini: m.index });
  const mapa = new Map();
  marcas.forEach((mk, i) => {
    const fin = (i + 1 < marcas.length) ? marcas[i + 1].ini : cuerpo.length;
    const trozo = cuerpo.slice(mk.ini, fin);
    const llamadas = [];
    const re2 = /this\.([A-Za-z_$][\w$]*)\s*\(/g;
    let m2;
    while ((m2 = re2.exec(trozo)) !== null) llamadas.push(m2[1]);
    mapa.set(mk.accion, llamadas);
  });
  return mapa;
}

function main() {
  const logic = leer(LOGIC);
  const definidos = metodosDefinidos(logic);
  const casos = casosDelDispatch(cuerpoDelDispatch(logic));

  // Propiedades asignadas en el constructor (this.onBack = onBack, etc.). No son
  // métodos, pero sí son cosas que `this.X()` puede llamar legítimamente.
  const propiedades = new Set();
  logic.split(/\r?\n/).forEach(l => {
    const m = l.match(/this\.([A-Za-z_$][\w$]*)\s*=/);
    if (m) propiedades.add(m[1]);
  });

  ok('el dispatch tiene casos', casos.size >= 8, casos.size + ' casos');

  // ── 1) Cada case llama a métodos que existen ─────────────────────────
  const rotas = [];
  casos.forEach((llamadas, accion) => {
    llamadas.forEach(n => {
      if (!definidos.has(n) && !propiedades.has(n)) rotas.push(accion + ' -> this.' + n + '()');
    });
  });
  ok('1) ningún case llama a un método inexistente', rotas.length === 0, rotas.join(' | '));

  // ── 2) Cada acción que manda el selector tiene su case ──────────────
  const enviadas = accionesEnviadas(leer(SELECTOR));
  const sinCase = [...enviadas].filter(a => !casos.has(a));
  ok('2) el selector no manda acciones sin handler', sinCase.length === 0,
    sinCase.join(', ') || [...enviadas].join(', '));

  // ── 3) La vista de gestión tampoco manda acciones huérfanas ─────────
  const envGestion = accionesEnviadas(leer(GESTION));
  const sinCaseG = [...envGestion].filter(a => !casos.has(a));
  ok('3) la vista de gestión no manda acciones sin handler', sinCaseG.length === 0,
    sinCaseG.join(', ') || [...envGestion].join(', '));

  // ── 4) Los helpers privados citados existen ─────────────────────────
  const citados = new Set();
  logic.split(/\r?\n/).forEach(l => {
    const ms = l.match(/this\.(_[A-Za-z0-9_$]*)\s*\(/g);
    if (ms) ms.forEach(x => citados.add(x.replace(/^this\./, '').replace(/\s*\($/, '')));
  });
  const perdidos = [...citados].filter(n => !definidos.has(n) && !propiedades.has(n));
  ok('4) todo this._x() privado citado está definido', perdidos.length === 0, perdidos.join(', '));

  // ── 5) El caso que originó el bug, protegido explícitamente ─────────
  ok('5) abrir un período desde la BD apunta al método real',
    casos.has('open-budget-from-db') &&
    casos.get('open-budget-from-db').every(n => definidos.has(n)),
    JSON.stringify(casos.get('open-budget-from-db')));
  ok('5) el método _handleOpenBudgetFromBD existe', definidos.has('_handleOpenBudgetFromBD'));

  let failed = 0;
  console.log('\n=======================================');
  checks.forEach(c => {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

main();
