/**
 * Tests del script scripts/empalmar-acuerdo-v1.1.js.
 *
 * Qué se prueba:
 *  - El empalme reemplaza el texto de un numeral y deja intactos los demás.
 *  - Un placeholder en el texto final IMPIDE que se escriba el archivo.
 *  - El empalme es idempotente: dos corridas dan el mismo texto.
 *  - El caso REAL (v1.0 sellada + respuesta 11A): el texto tiene más de 30.000
 *    caracteres, los 49 numerales del mapa de empalme aparecen con su texto
 *    final, y el reporte de placeholders es el de HOY: el texto tiene huecos
 *    y el script NO escribe el archivo.
 *
 * Este archivo NO abre la base de datos: el script es de texto puro.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  main,
  parseArgs,
  empalmar,
  localizarPlaceholders,
  armarReportePlaceholders,
  leerNumeralesDelMapa,
  sha256,
  DEFAULT_BASE,
  DEFAULT_CAMBIOS,
  DEFAULT_SALIDA,
  MAPA_EMPALME,
} = require('../../scripts/empalmar-acuerdo-v1.1.js');

const RAIZ_SERVICIO = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RAIZ_SERVICIO, '..');
const RESPUESTA_ABOGADO = path.join(
  REPO, 'docs', 'gestion-humana', 'firma-electronica', 'respuesta-11A-2026-10-23.txt'
);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Corre main() sin ensuciar la salida del runner. */
function runSilent(args) {
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  let code;
  try {
    code = main(['node', 'empalmar-acuerdo-v1.1.js'].concat(args));
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
  return code;
}

/** Un directorio de trabajo que se borra al terminar. */
function conTemporal(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'empalme-v11-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const BASE_SINTETICA = [
  'ACUERDO DE PRUEBA',
  '',
  '1. PRIMER CAPITULO',
  '',
  '1.1. Primer numeral de prueba, que no debe cambiar.',
  '',
  '1.2. Segundo numeral de prueba, que si cambia.',
  '',
  '2. SEGUNDO CAPITULO',
  '',
  '2.1. Numeral con literal subordinado.',
  '',
  '    a) Literal de prueba que no cambia.',
  '',
  '    b) Literal de prueba que si cambia.',
  '',
].join('\n');

const CAMBIOS_SINTETICOS = {
  version: 'v1.1',
  cambios: {
    '1.2': '1.2. Texto final de prueba del numeral 1.2.',
    '2.1(b)': '2.1(b). Texto final de prueba del literal b.',
  },
  inserciones: {},
  absorbe: {},
};

const TEXTO_REAL = fs.readFileSync(DEFAULT_BASE, 'utf8');
const CAMBIOS_REALES = JSON.parse(fs.readFileSync(DEFAULT_CAMBIOS, 'utf8'));
const TEXTO_ABCADO = fs.readFileSync(RESPUESTA_ABOGADO, 'utf8').replace(/\r\n/g, '\n');
const NUMERALES_DEL_MAPA = leerNumeralesDelMapa(MAPA_EMPALME);

// =========================================================================
// parseArgs
// =========================================================================

test('parseArgs: defaults → v1.1, base y cambios del repo, salida por defecto', () => {
  const args = parseArgs(['node', 'empalmar-acuerdo-v1.1.js']);
  assert.equal(args.version, 'v1.1');
  assert.equal(args.base, DEFAULT_BASE);
  assert.equal(args.cambios, DEFAULT_CAMBIOS);
  assert.equal(args.salida, DEFAULT_SALIDA);
  assert.equal(args.reporte, null);
});

test('parseArgs: --salida= y --reporte= se resuelven a rutas absolutas', () => {
  const args = parseArgs(['node', 'x.js', '--salida=salida.txt', '--reporte=rep.txt']);
  assert.ok(path.isAbsolute(args.salida));
  assert.ok(path.isAbsolute(args.reporte));
  assert.ok(args.salida.endsWith('salida.txt'));
  assert.ok(args.reporte.endsWith('rep.txt'));
});

// =========================================================================
// El empalme: reemplaza lo que cambia, deja intacto lo demás
// =========================================================================

test('empalmar: el numeral cambiado trae el texto nuevo y ya NO el viejo', () => {
  const r = empalmar(BASE_SINTETICA, CAMBIOS_SINTETICOS);
  assert.ok(
    r.texto.includes('1.2. Texto final de prueba del numeral 1.2.'),
    'el texto final del 1.2 debe estar en el resultado'
  );
  assert.ok(
    !r.texto.includes('Segundo numeral de prueba, que si cambia.'),
    'el texto viejo del 1.2 NO debe quedar en el resultado'
  );
});

test('empalmar: un numeral que no cambia queda intacto', () => {
  const r = empalmar(BASE_SINTETICA, CAMBIOS_SINTETICOS);
  assert.ok(
    r.texto.includes('1.1. Primer numeral de prueba, que no debe cambiar.'),
    'el 1.1 no cambia y tiene que quedar tal cual'
  );
});

test('empalmar: un literal que no cambia queda intacto', () => {
  const r = empalmar(BASE_SINTETICA, CAMBIOS_SINTETICOS);
  assert.ok(
    r.texto.includes('a) Literal de prueba que no cambia.'),
    'el literal a) no cambia y tiene que quedar tal cual'
  );
});

test('empalmar: un literal cambiado se reemplaza y conserva su sangria', () => {
  const r = empalmar(BASE_SINTETICA, CAMBIOS_SINTETICOS);
  assert.ok(r.texto.includes('    2.1(b). Texto final de prueba del literal b.'));
  assert.ok(!r.texto.includes('b) Literal de prueba que si cambia.'));
});

test('empalmar: la base no se modifica', () => {
  const antes = sha256(BASE_SINTETICA);
  empalmar(BASE_SINTETICA, CAMBIOS_SINTETICOS);
  assert.equal(sha256(BASE_SINTETICA), antes);
});

// =========================================================================
// El script (main): escribe o no escribe
// =========================================================================

test('main: sin placeholders escribe el archivo y sale con código 0', () => {
  conTemporal((dir) => {
    const base = path.join(dir, 'base.txt');
    const cambios = path.join(dir, 'cambios.json');
    const salida = path.join(dir, 'salida.txt');
    fs.writeFileSync(base, BASE_SINTETICA, 'utf8');
    fs.writeFileSync(cambios, JSON.stringify(CAMBIOS_SINTETICOS), 'utf8');

    const code = runSilent(['--base=' + base, '--cambios=' + cambios, '--salida=' + salida]);
    assert.equal(code, 0);
    assert.ok(fs.existsSync(salida), 'con el texto limpio tiene que escribir el archivo');

    const escrito = fs.readFileSync(salida, 'utf8');
    assert.ok(escrito.includes('1.2. Texto final de prueba del numeral 1.2.'));
    assert.ok(escrito.includes('1.1. Primer numeral de prueba, que no debe cambiar.'));
    assert.ok(!escrito.includes('\r'), 'el archivo se escribe con LF, no con CRLF');
  });
});

test('main: con un placeholder NO escribe el archivo y sale con código 2', () => {
  conTemporal((dir) => {
    const base = path.join(dir, 'base.txt');
    const cambios = path.join(dir, 'cambios.json');
    const salida = path.join(dir, 'salida.txt');
    fs.writeFileSync(base, BASE_SINTETICA, 'utf8');
    fs.writeFileSync(cambios, JSON.stringify({
      version: 'v1.1',
      cambios: { '1.2': '1.2. Texto final con un hueco [PENDIENTE] todavia.' },
      inserciones: {},
      absorbe: {},
    }), 'utf8');

    const code = runSilent(['--base=' + base, '--cambios=' + cambios, '--salida=' + salida]);
    assert.equal(code, 2, 'con placeholders el codigo de salida es 2');
    assert.ok(!fs.existsSync(salida), 'con placeholders NO se debe escribir el archivo');
  });
});

test('main: el reporte de placeholders se puede escribir en un archivo', () => {
  conTemporal((dir) => {
    const base = path.join(dir, 'base.txt');
    const cambios = path.join(dir, 'cambios.json');
    const salida = path.join(dir, 'salida.txt');
    const reporte = path.join(dir, 'reporte.txt');
    fs.writeFileSync(base, BASE_SINTETICA, 'utf8');
    fs.writeFileSync(cambios, JSON.stringify({
      version: 'v1.1',
      cambios: { '1.2': '1.2. Texto final con un hueco [PENDIENTE] todavia.' },
      inserciones: {},
      absorbe: {},
    }), 'utf8');

    const code = runSilent([
      '--base=' + base, '--cambios=' + cambios, '--salida=' + salida, '--reporte=' + reporte,
    ]);
    assert.equal(code, 2);
    assert.ok(fs.existsSync(reporte));
    const contenido = fs.readFileSync(reporte, 'utf8');
    assert.ok(contenido.includes('[PENDIENTE]'));
    assert.ok(contenido.includes('1.2'), 'el reporte dice en que numeral esta el hueco');
  });
});

test('main: es idempotente (dos corridas dan el mismo texto)', () => {
  conTemporal((dir) => {
    const base = path.join(dir, 'base.txt');
    const cambios = path.join(dir, 'cambios.json');
    const salida1 = path.join(dir, 'salida1.txt');
    const salida2 = path.join(dir, 'salida2.txt');
    fs.writeFileSync(base, BASE_SINTETICA, 'utf8');
    fs.writeFileSync(cambios, JSON.stringify(CAMBIOS_SINTETICOS), 'utf8');

    assert.equal(runSilent(['--base=' + base, '--cambios=' + cambios, '--salida=' + salida1]), 0);
    assert.equal(runSilent(['--base=' + base, '--cambios=' + cambios, '--salida=' + salida2]), 0);

    const uno = fs.readFileSync(salida1, 'utf8');
    const dos = fs.readFileSync(salida2, 'utf8');
    assert.equal(uno, dos, 'dos corridas tienen que dar exactamente el mismo texto');
    assert.equal(sha256(uno), sha256(dos));
  });
});

test('main: un numeral que no existe en la base es un error (código 3)', () => {
  conTemporal((dir) => {
    const base = path.join(dir, 'base.txt');
    const cambios = path.join(dir, 'cambios.json');
    const salida = path.join(dir, 'salida.txt');
    fs.writeFileSync(base, BASE_SINTETICA, 'utf8');
    fs.writeFileSync(cambios, JSON.stringify({
      version: 'v1.1',
      cambios: { '9.9': '9.9. Numeral que no existe en la base.' },
      inserciones: {},
      absorbe: {},
    }), 'utf8');

    const code = runSilent(['--base=' + base, '--cambios=' + cambios, '--salida=' + salida]);
    assert.equal(code, 3);
    assert.ok(!fs.existsSync(salida));
  });
});

// =========================================================================
// El JSON de cambios: los 49 numerales, con el texto VERBATIM del abogado
// =========================================================================

test('el JSON de cambios trae los 49 numerales del mapa de empalme', () => {
  const claves = Object.keys(CAMBIOS_REALES.cambios);
  assert.equal(claves.length, 49, 'el mapa de empalme lista 49 numerales que cambian');
  assert.equal(NUMERALES_DEL_MAPA.length, 49, 'el mapa de empalme tiene que listar 49 numerales');
  for (const n of NUMERALES_DEL_MAPA) {
    assert.ok(claves.includes(n), 'falta el numeral ' + n + ' en el JSON de cambios');
  }
});

test('cada texto del JSON aparece LITERAL en el .txt del abogado', () => {
  for (const clave of Object.keys(CAMBIOS_REALES.cambios)) {
    const texto = CAMBIOS_REALES.cambios[clave];
    assert.ok(typeof texto === 'string' && texto.length > 0, 'el texto de ' + clave + ' esta vacio');
    assert.ok(
      TEXTO_ABCADO.includes(texto),
      'el texto de ' + clave + ' no aparece literal en la respuesta del abogado'
    );
  }
});

test('los tres numerales nuevos son inserciones con ancla, no reemplazos', () => {
  const inserciones = CAMBIOS_REALES.inserciones || {};
  assert.deepEqual(
    Object.keys(inserciones).sort(),
    ['10.2(h)', '10.5(g)', '3.10'],
    'los numerales que no existian en la v1.0 se insertan, con su ancla'
  );
  for (const clave of Object.keys(inserciones)) {
    assert.ok(CAMBIOS_REALES.cambios[clave], 'el numeral insertado ' + clave + ' tiene texto');
  }
});

// =========================================================================
// CASO REAL: la v1.0 sellada + la respuesta 11A
// =========================================================================

test('CASO REAL: el texto empalmado tiene más de 30.000 caracteres', () => {
  const r = empalmar(TEXTO_REAL, CAMBIOS_REALES);
  assert.ok(
    r.texto.length > 30000,
    'el texto empalmado quedó en ' + r.texto.length + ' caracteres'
  );
});

test('CASO REAL: los 49 numerales del mapa aparecen con su texto final', () => {
  const r = empalmar(TEXTO_REAL, CAMBIOS_REALES);
  for (const clave of NUMERALES_DEL_MAPA) {
    const textoFinal = CAMBIOS_REALES.cambios[clave];
    assert.ok(textoFinal, 'el numeral ' + clave + ' no esta en el JSON de cambios');
    assert.ok(
      r.texto.includes(textoFinal),
      'el texto resultante NO trae el texto final del numeral ' + clave
    );
  }
});

test('CASO REAL: los numerales que NO cambian siguen intactos', () => {
  const r = empalmar(TEXTO_REAL, CAMBIOS_REALES);
  const intactos = [
    'b) El uso del mecanismo de firma electrónica no tiene ningún costo para el Trabajador.',
    '3.2. La firma electrónica aquí pactada no es una firma digital criptográfica',
    'a) La vigencia de la firma corresponde a la misma del contrato',
    '8.1. De conformidad con el artículo 2.2.1.1.12 del Decreto 1072 de 2015',
    'h) Cumplir obligaciones legales, administrativas o judiciales',
    '11.3. K+AIR puede comunicar al Firmante',
    '12.2. La validez de la firma electrónica se determina conforme a las reglas del Capítulo',
  ];
  for (const fragmento of intactos) {
    assert.ok(r.texto.includes(fragmento), 'no debe cambiar: ' + fragmento.slice(0, 40));
  }
});

test('CASO REAL: HOY el texto tiene placeholders y el script NO escribe el archivo', () => {
  const r = empalmar(TEXTO_REAL, CAMBIOS_REALES);
  const encontrados = localizarPlaceholders(r.texto);
  const pares = encontrados
    .map((e) => e.placeholder + ' @ ' + e.ubicacion)
    .sort();

  assert.deepEqual(pares, [
    '[ciudad, país] @ 10.1',
    '[correo o URL] @ 10.7(b)',
    '[interno, a cargo de … / provisto por …] @ 10.1',
    '[nombre o cargo] @ 10.7(b)',
    '[registrada por el sistema] @ MANIFESTACIÓN DE VOLUNTAD',
    '[registrada por el sistema] @ MANIFESTACIÓN DE VOLUNTAD',
    '[registrada por el sistema] @ MANIFESTACIÓN DE VOLUNTAD',
    '[registrada por el sistema] @ MANIFESTACIÓN DE VOLUNTAD',
    '[URL] @ 1.5',
  ].sort(), 'este es el reporte de placeholders de HOY: documenta el estado real');

  const reporte = armarReportePlaceholders(r.texto, TEXTO_REAL);
  assert.equal(reporte.total, 9);
  assert.equal(reporte.nuevos, 5, 'cinco huecos que hay que llenar');
  assert.equal(reporte.heredados, 4, 'los cuatro que ya venían en la v1.0');
});

test('CASO REAL: el script sale con código 2 y no crea acuerdo-v1.1.txt', () => {
  assert.ok(
    !fs.existsSync(DEFAULT_SALIDA),
    'el archivo de salida no debe existir mientras falten placeholders'
  );
  const code = runSilent(['--salida=' + path.join(os.tmpdir(), 'no-debe-existir-v1.1.txt')]);
  assert.equal(code, 2);
  assert.ok(
    !fs.existsSync(DEFAULT_SALIDA),
    'el script NO debe escribir el archivo de la v1.1 todavia'
  );
});

test('CASO REAL: la v1.0 sellada no se toco', () => {
  const manifiesto = JSON.parse(
    fs.readFileSync(path.join(RAIZ_SERVICIO, 'scripts', 'fixtures', 'acuerdo-ARCHIVO.json'), 'utf8')
  );
  assert.equal(
    sha256(TEXTO_REAL),
    manifiesto.versiones['v1.0'].sha256,
    'la v1.0 tiene que seguir con la huella archivada'
  );
  assert.equal(TEXTO_REAL.length, manifiesto.versiones['v1.0'].chars);
});
