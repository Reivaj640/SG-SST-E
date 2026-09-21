#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────
   K+AIR · Migración GTC-45 one-shot (F439.8 — 2026-06-24)
   
   ANTES:  Escala invertida (ND=0=Muy Alto, ND=5=No existe) y NC con 6 niveles
          no oficiales (10, 20, 40, 60, 80, 100).
   
   DESPUÉS: Escala GTC-45 oficial:
            ND: 0=No existe → 5=Muy Alto  (invertida: new_ND = 5 - old_ND)
            NE: 1=Esporádica, 2=Ocasional, 3=Frecuente, 4=Continua (sin cambio numérico)
            NC: solo 4 niveles oficiales (10, 25, 60, 100)
                10 → 10  (Leve)
                20 → 25  (Incapacidad temporal = Grave)
                40 → 60  (Incapacidad permanente parcial = Muy Grave)
                60 → 60  (Incapacidad permanente total = Muy Grave)
                80 → 100 (Muerte)
                100 → 100 (Muerte múltiple)
   
   USO:    node tools/migrate-gtc45.js <path-al-archivo-json>
   
   BACKUP: El archivo original se guarda como .pre-gtc45.bak antes de modificar.
   ───────────────────────────────────────────────────────────────────── */

'use strict';

var fs = require('fs');
var path = require('path');

// ── Tablas de migración ────────────────────────────────────────────────
function migrateND(old) {
  if (old == null || isNaN(old)) return old;
  var n = Number(old);
  if (n < 0 || n > 5) return n; // fuera de rango: dejar tal cual
  return 5 - n;
}

var NC_MAP = {
  10:  10,
  20:  25,
  40:  60,
  60:  60,
  80:  100,
  100: 100
};

function migrateNC(old) {
  if (old == null || isNaN(old)) return old;
  var n = Number(old);
  if (NC_MAP.hasOwnProperty(n)) return NC_MAP[n];
  // Si el valor no está en la tabla, aproximar al más cercano oficial
  var valid = [10, 25, 60, 100];
  var closest = valid[0];
  var minDiff = Math.abs(n - closest);
  for (var i = 1; i < valid.length; i++) {
    var diff = Math.abs(n - valid[i]);
    if (diff < minDiff) { minDiff = diff; closest = valid[i]; }
  }
  return closest;
}

// NE: solo cambia label, no valor numérico. Pero como la escala "Permanente"
// (old=3) tenía sentido de "frecuente alta" pero la nueva etiqueta es "Frecuente",
// mantenemos el número igual. Sin embargo, si el usuario ingresó NE=2 pensando en
// "Permanente" (que era la 3ra posición en old), eso ya estaba mal — el dato
// tiene el número correcto, solo cambia el nombre.

// ── Cálculos GTC-45 (mismos que el bridge) ──────────────────────────────
var NP_INTERPRETACION = [
  { max: 4,  label: 'Bajo' },
  { max: 8,  label: 'Medio' },
  { max: 40, label: 'Alto' }
];
function interpNP(np) {
  for (var i = 0; i < NP_INTERPRETACION.length; i++) {
    if (np <= NP_INTERPRETACION[i].max) return NP_INTERPRETACION[i].label;
  }
  return 'Alto';
}

var NR_ACEPTABILIDAD = [
  { max: 20,    nivel: 'I',   label: 'Aceptable',                   color: 'verde' },
  { max: 100,   nivel: 'II',  label: 'Aceptable con control',       color: 'azul' },
  { max: 300,   nivel: 'III', label: 'Mejorable (No aceptable)',    color: 'amarillo' },
  { max: 600,   nivel: 'IV',  label: 'No aceptable nivel 1',        color: 'naranja' },
  { max: Infinity, nivel: 'V', label: 'No aceptable nivel 2',       color: 'rojo' }
];
function interpNR(nr) {
  for (var i = 0; i < NR_ACEPTABILIDAD.length; i++) {
    if (nr <= NR_ACEPTABILIDAD[i].max) {
      return { nivel: NR_ACEPTABILIDAD[i].nivel, label: NR_ACEPTABILIDAD[i].label, color: NR_ACEPTABILIDAD[i].color };
    }
  }
  return { nivel: 'V', label: 'No aceptable nivel 2', color: 'rojo' };
}

function calcNP(nd, ne) {
  if (nd == null || ne == null) return null;
  return Number(nd) * Number(ne);
}
function calcNR(np, nc) {
  if (np == null || nc == null) return null;
  return Number(np) * Number(nc);
}

function recalc(o, stats) {
  // Recalcular NP, NR, interpretaciones después de migrar nd/nc.
  // Solo si el objeto tiene nd, ne, nc (es un peligro).
  if ('nd' in o && 'ne' in o && 'nc' in o) {
    var nd = o.nd, ne = o.ne, nc = o.nc;
    var np = calcNP(nd, ne);
    var nr = calcNR(np, nc);

    if (np != null) {
      var oldNP = o.np;
      var oldNPLabel = o.npInterpretacion;
      o.np = np;
      o.npInterpretacion = interpNP(np);
      if (oldNP !== np) stats.npChanges.push({ from: oldNP, to: np });
      if (oldNPLabel !== o.npInterpretacion) stats.npLabelChanges.push({ from: oldNPLabel, to: o.npInterpretacion });
    }
    if (nr != null) {
      var interp = interpNR(nr);
      var oldNR = o.nr;
      var oldNivel = o.nrNivel;
      var oldLabel = o.nrLabel;
      var oldColor = o.nrColor;
      o.nr = nr;
      o.nrNivel = interp.nivel;
      o.nrLabel = interp.label;
      o.nrColor = interp.color;
      if (oldNR !== nr) stats.nrChanges.push({ from: oldNR, to: nr });
      if (oldNivel !== interp.nivel) stats.nrNivelChanges.push({ from: oldNivel, to: interp.nivel });
      if (oldLabel !== interp.label) stats.nrLabelChanges.push({ from: oldLabel, to: interp.label });
      if (oldColor !== interp.color) stats.nrColorChanges.push({ from: oldColor, to: interp.color });
    }
  }
}

function walk(o, stats) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach(function (x) { walk(x, stats); }); return; }

  // Migrar NC primero
  if ('nc' in o && o.nc != null) {
    var oldNC = o.nc;
    var newNC = migrateNC(oldNC);
    if (oldNC !== newNC) {
      stats.ncChanges.push({ from: oldNC, to: newNC, path: stats._path });
      o.nc = newNC;
    }
  }
  // Migrar ND
  if ('nd' in o && o.nd != null) {
    var oldND = o.nd;
    var newND = migrateND(oldND);
    if (oldND !== newND) {
      stats.ndChanges.push({ from: oldND, to: newND, path: stats._path });
      o.nd = newND;
    }
  }
  // Recalcular derivados (NP, NR, interpretaciones) si tiene los 3 campos
  recalc(o, stats);

  // Recorrer hijos
  Object.keys(o).forEach(function (k) {
    var prevPath = stats._path;
    stats._path = prevPath + '.' + k;
    walk(o[k], stats);
    stats._path = prevPath;
  });
}

// ── Main ────────────────────────────────────────────────────────────────
var targetPath = process.argv[2];
if (!targetPath) {
  console.error('Uso: node tools/migrate-gtc45.js <archivo.json>');
  process.exit(1);
}

if (!fs.existsSync(targetPath)) {
  console.error('No existe: ' + targetPath);
  process.exit(1);
}

var raw = fs.readFileSync(targetPath, 'utf8');
var data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('JSON inválido: ' + e.message);
  process.exit(1);
}

var backupPath = targetPath.replace(/\.json$/, '') + '.pre-gtc45.bak.json';
fs.writeFileSync(backupPath, raw, 'utf8');
console.log('✓ Backup creado: ' + backupPath);

var stats = {
  ndChanges: [],
  ncChanges: [],
  npChanges: [],
  npLabelChanges: [],
  nrChanges: [],
  nrNivelChanges: [],
  nrLabelChanges: [],
  nrColorChanges: [],
  _path: 'root'
};
walk(data, stats);

// Resumen
console.log('\n=== Cambios ND (inversión de escala) ===');
console.log('Total: ' + stats.ndChanges.length);
var ndSummary = {};
stats.ndChanges.forEach(function (c) { var k = c.from + '→' + c.to; ndSummary[k] = (ndSummary[k] || 0) + 1; });
Object.keys(ndSummary).sort().forEach(function (k) { console.log('  ND ' + k + ': ' + ndSummary[k]); });

console.log('\n=== Cambios NC (mapeo a GTC-45) ===');
console.log('Total: ' + stats.ncChanges.length);
var ncSummary = {};
stats.ncChanges.forEach(function (c) { var k = c.from + '→' + c.to; ncSummary[k] = (ncSummary[k] || 0) + 1; });
Object.keys(ncSummary).sort().forEach(function (k) { console.log('  NC ' + k + ': ' + ncSummary[k]); });

console.log('\n=== Recálculos automáticos ===');
console.log('NP recalculados: ' + stats.npChanges.length);
console.log('NP label cambios: ' + stats.npLabelChanges.length);
console.log('NR recalculados: ' + stats.nrChanges.length);
console.log('NR nivel cambios: ' + stats.nrNivelChanges.length);
console.log('NR label cambios: ' + stats.nrLabelChanges.length);
console.log('NR color cambios: ' + stats.nrColorChanges.length);

if (stats.nrNivelChanges.length > 0) {
  console.log('\n  Distribución de cambios de nivel NR:');
  var nrNivelSummary = {};
  stats.nrNivelChanges.forEach(function (c) { var k = c.from + '→' + c.to; nrNivelSummary[k] = (nrNivelSummary[k] || 0) + 1; });
  Object.keys(nrNivelSummary).sort().forEach(function (k) { console.log('    ' + k + ': ' + nrNivelSummary[k]); });
}

// Escribir archivo migrado
var out = JSON.stringify(data, null, 2);
fs.writeFileSync(targetPath, out, 'utf8');
console.log('\n✓ Archivo migrado: ' + targetPath);
console.log('  Tamaño: ' + out.length + ' bytes');
