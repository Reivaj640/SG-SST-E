/**
 * Tests del generador del Anexo de Encargo (E1 y E2).
 *
 * QUE PRUEBA
 * ----------
 * La matriz de finalidades (seccion 2) y la tabla de conservacion (seccion 8)
 * del Anexo de Encargo NO se escriben a mano: las genera
 * `scripts/generar-anexo-encargo.js` desde dos fuentes unicas,
 * `config/matriz-finalidades.json` y `config/tabla-conservacion.json`.
 *
 * Aca se verifica lo que el generador tiene que garantizar:
 *  - Es IDEMPOTENTE: correrlo dos veces deja el archivo byte a byte igual.
 *  - Las dos copias del Anexo (legal/ y sitio/) quedan identicas.
 *  - La matriz trae las ocho finalidades del 10.3 con su identificador literal
 *    y los nueve campos que pidio el abogado.
 *  - FALLA con codigo distinto de cero cuando falta una categoria requerida,
 *    falta un marcador o el JSON no valida: un Anexo a medias es peor que
 *    un Anexo viejo.
 *  - Ni el HTML ni las fuentes traen CJK, cirilico ni hangul.
 *
 * Tests:
 *   node --test tests/scripts/generar-anexo-encargo.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const FIRMA = path.resolve(__dirname, '..', '..');
const APP = path.resolve(FIRMA, '..');
const REPO = path.resolve(APP, '..');

const SCRIPT = path.join(FIRMA, 'scripts', 'generar-anexo-encargo.js');
const HTML_LEGAL = path.join(APP, 'legal', 'anexo-encargo.html');
const HTML_SITIO = path.join(REPO, 'sitio', 'anexo-encargo.html');
const CONFIG_TABLA = path.join(FIRMA, 'config', 'tabla-conservacion.json');
const CONFIG_MATRIZ = path.join(FIRMA, 'config', 'matriz-finalidades.json');

const IDENTIFICADORES = [
  '10.3(a)', '10.3(b)', '10.3(c)', '10.3(d)',
  '10.3(e)', '10.3(f)', '10.3(g)', '10.3(h)',
];

const CAMPOS_MATRIZ = [
  'Identificador',
  'Descripci&oacute;n',
  'Categor&iacute;as de datos',
  'Titulares involucrados',
  'Base jur&iacute;dica declarada',
  'Responsable que instruye',
  'Plazo de conservaci&oacute;n',
  'Consecuencia de la revocatoria o la supresi&oacute;n',
  'Estado de habilitaci&oacute;n',
];

function correr(args = []) {
  return execFileSync(process.execPath, [SCRIPT, ...args], { cwd: FIRMA, encoding: 'utf8' });
}

/** Arma una copia throwaway del repositorio para probar los fallos. */
function raizTemporal() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-anexo-'));
  const dirConfig = path.join(tmp, 'sgsst-electron-app', 'firma-service', 'config');
  const dirLegal = path.join(tmp, 'sgsst-electron-app', 'legal');
  fs.mkdirSync(dirConfig, { recursive: true });
  fs.mkdirSync(dirLegal, { recursive: true });
  fs.copyFileSync(CONFIG_TABLA, path.join(dirConfig, 'tabla-conservacion.json'));
  fs.copyFileSync(CONFIG_MATRIZ, path.join(dirConfig, 'matriz-finalidades.json'));
  fs.copyFileSync(HTML_LEGAL, path.join(dirLegal, 'anexo-encargo.html'));
  return tmp;
}

test('el generador es idempotente: dos corridas dan el mismo byte', () => {
  const antes = fs.readFileSync(HTML_LEGAL);
  correr();
  const primera = fs.readFileSync(HTML_LEGAL);
  correr();
  const segunda = fs.readFileSync(HTML_LEGAL);
  assert.deepEqual(primera, segunda, 'la segunda corrida cambio el archivo');
  assert.deepEqual(antes, segunda, 'el Anexo del repositorio no estaba al dia con las fuentes');
});

test('las dos copias del Anexo (legal/ y sitio/) son byte a byte identicas', () => {
  correr();
  assert.deepEqual(fs.readFileSync(HTML_LEGAL), fs.readFileSync(HTML_SITIO));
});

test('la matriz trae las ocho finalidades del 10.3 con su identificador literal', () => {
  const html = fs.readFileSync(HTML_LEGAL, 'utf8');
  for (const id of IDENTIFICADORES) {
    assert.ok(html.includes(`<strong>${id}</strong>`), `falta la finalidad ${id}`);
  }
  for (const campo of CAMPOS_MATRIZ) {
    assert.ok(html.includes(`<th>${campo}</th>`), `falta el campo ${campo}`);
  }
  assert.ok(html.includes('No habilitada - pendiente de entrega de informaci&oacute;n por la Empresa'),
    'falta el estado de habilitacion del Grupo B');
});

test('el Anexo no remite ya al hold por plazo no declarado del 8.6(h)', () => {
  const html = fs.readFileSync(HTML_LEGAL, 'utf8');
  assert.ok(!html.includes('8.6(h)'), 'el Anexo todavia cita el 8.6(h)');
  assert.ok(!html.includes('queda retenido por esa raz&oacute;n'),
    'el Anexo todavia promete el hold por plazo no declarado');
  assert.ok(!html.includes('el registro no se suprime'),
    'el Anexo todavia dice que sin plazo declarado el registro no se suprime');
  assert.ok(html.includes('No hay retenci&oacute;n indefinida'), 'falta la regla de no retencion indefinida');
});

test('el generador falla si falta una categoria requerida', () => {
  const tmp = raizTemporal();
  const ruta = path.join(tmp, 'sgsst-electron-app', 'firma-service', 'config', 'tabla-conservacion.json');
  const tabla = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  tabla.categorias = tabla.categorias.filter((c) => c.id !== 'SST_ESPECIAL');
  fs.writeFileSync(ruta, JSON.stringify(tabla, null, 2), 'utf8');
  const res = spawnSync(process.execPath, [SCRIPT, `--raiz=${tmp}`], { encoding: 'utf8' });
  assert.notEqual(res.status, 0, 'el script no fallo con la categoria faltante');
  assert.ok(/SST_ESPECIAL/.test(res.stderr), 'el error no nombra la categoria faltante');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('el generador falla si falta un marcador en el Anexo', () => {
  const tmp = raizTemporal();
  const ruta = path.join(tmp, 'sgsst-electron-app', 'legal', 'anexo-encargo.html');
  const html = fs.readFileSync(ruta, 'utf8')
    .replace('<!-- TABLA-CONSERVACION:GENERADA -->', '');
  fs.writeFileSync(ruta, html, 'utf8');
  const res = spawnSync(process.execPath, [SCRIPT, `--raiz=${tmp}`], { encoding: 'utf8' });
  assert.notEqual(res.status, 0, 'el script no fallo con el marcador faltante');
  assert.ok(/TABLA-CONSERVACION/.test(res.stderr), 'el error no nombra el marcador faltante');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('el generador falla si el JSON de la fuente no valida', () => {
  const tmp = raizTemporal();
  const ruta = path.join(tmp, 'sgsst-electron-app', 'firma-service', 'config', 'matriz-finalidades.json');
  fs.writeFileSync(ruta, '{ esto no es json', 'utf8');
  const res = spawnSync(process.execPath, [SCRIPT, `--raiz=${tmp}`], { encoding: 'utf8' });
  assert.notEqual(res.status, 0, 'el script no fallo con el JSON invalido');
  assert.ok(/no valida/.test(res.stderr), 'el error no dice que el JSON no valida');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('ni el HTML ni las fuentes traen CJK, cirilico ni hangul', () => {
  const archivos = [HTML_LEGAL, HTML_SITIO, CONFIG_MATRIZ, CONFIG_TABLA, SCRIPT];
  for (const archivo of archivos) {
    const texto = fs.readFileSync(archivo, 'utf8');
    const prohibidos = new Set();
    for (const ch of texto) {
      const cp = ch.codePointAt(0);
      if ((cp >= 0x4e00 && cp <= 0x9fff)
        || (cp >= 0x0400 && cp <= 0x04ff)
        || (cp >= 0xac00 && cp <= 0xd7af)) {
        prohibidos.add(`U+${cp.toString(16)}`);
      }
    }
    assert.equal(prohibidos.size, 0, `${archivo} trae ${[...prohibidos].join(', ')}`);
  }
});
