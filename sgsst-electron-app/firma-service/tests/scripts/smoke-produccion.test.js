/**
 * tests/scripts/smoke-produccion.test.js
 *
 * Tests del script de prueba de humo contra el servicio de firma.
 *
 * Lo que se comprueba:
 *
 *   1. Por defecto NO se escribe nada (solo lectura).
 *   2. `--e2e` SIN `--confirmar-e2e` NO autoriza la escritura.
 *   3. `--e2e --confirmar-e2e` SÍ autoriza la escritura.
 *   4. `--canal-datos` autoriza la escritura (una fila en el canal de datos).
 *   5. Un argumento desconocido se rechaza (codigo 2) y no se ejecuta nada.
 *   6. El cuerpo multipart lleva los campos y el archivo, con su boundary.
 *   7. El PDF de prueba es un PDF de verdad (%PDF-).
 *   8. La llave NO aparece en la salida del script.
 *
 * Por qué el 2 importa: sin ese candado, una corrida "de prueba" podría crear
 * solicitudes y mandar correos a alguien sin que nadie lo pidiera. Es la
 * misma clase de control que el `--actor`/`--motivo` de `recifrar-representante`.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const script = require('../../scripts/smoke-produccion');

// ----------------------------------------------------------------------
// 1-5. Argumentos y modo de escritura
// ----------------------------------------------------------------------
test('sin banderas la corrida es de solo lectura', () => {
  const args = script.parseArgs(['node', 'smoke-produccion.js']);
  assert.equal(args.error, null);
  assert.equal(script.modoEscritura(args).escribe, false);
});

test('--e2e sin --confirmar-e2e NO autoriza la escritura', () => {
  const args = script.parseArgs(['node', 'smoke-produccion.js', '--e2e']);
  const modo = script.modoEscritura(args);
  assert.equal(modo.escribe, false,
    'una corrida e2e sin confirmar tiene que quedar bloqueada');
  assert.match(modo.motivo, /confirmar-e2e/);
});

test('--e2e --confirmar-e2e autoriza la escritura', () => {
  const args = script.parseArgs([
    'node', 'smoke-produccion.js', '--e2e', '--confirmar-e2e',
  ]);
  assert.equal(script.modoEscritura(args).escribe, true);
});

test('--canal-datos autoriza la escritura', () => {
  const args = script.parseArgs(['node', 'smoke-produccion.js', '--canal-datos']);
  assert.equal(script.modoEscritura(args).escribe, true);
});

test('un argumento desconocido se rechaza con codigo 2 y no se ejecuta nada', async () => {
  const code = await script.main(['node', 'smoke-produccion.js', '--inventado']);
  assert.equal(code, 2);
});

test('la URL por omision es la de produccion y se le quita la barra final', () => {
  assert.equal(script.parseArgs(['node', 'x']).url, script.DEFAULT_URL);
  const conBarra = script.parseArgs(['node', 'x', '--url=https://ejemplo.test/']);
  assert.equal(conBarra.url, 'https://ejemplo.test');
});

test('las llaves se leen del archivo, no del texto del comando', () => {
  const args = script.parseArgs([
    'node', 'x', '--interno-file=C:\\ruta\\internal-key.txt',
  ]);
  assert.equal(args.internoFile, 'C:\\ruta\\internal-key.txt');
  assert.equal(args.interno, null);
});

// ----------------------------------------------------------------------
// 6. El cuerpo multipart
// ----------------------------------------------------------------------
test('el cuerpo multipart lleva los campos, el archivo y su boundary', () => {
  const { body, contentType } = script.multipart(
    { id_empresa: 'EMP-1', agreement_version: 'v1.0' },
    { campo: 'documento', nombre: 'prueba.pdf', contenido: Buffer.from('%PDF-1.7\n') },
  );
  const texto = body.toString('latin1');
  assert.match(contentType, /^multipart\/form-data; boundary=/);
  const boundary = contentType.split('boundary=')[1];
  assert.match(texto, new RegExp('--' + boundary));
  assert.match(texto, /name="id_empresa"/);
  assert.match(texto, /name="agreement_version"/);
  assert.match(texto, /name="documento"; filename="prueba\.pdf"/);
  assert.match(texto, /Content-Type: application\/pdf/);
  assert.ok(texto.includes('%PDF-1.7'));
});

// ----------------------------------------------------------------------
// 7. El PDF de prueba
// ----------------------------------------------------------------------
test('el PDF de prueba es un PDF de verdad', async () => {
  const pdf = await script.pdfDePrueba();
  assert.ok(Buffer.isBuffer(pdf));
  assert.ok(pdf.length > 400, 'un PDF de una pagina pesa mas de 400 bytes');
  assert.equal(pdf.slice(0, 5).toString('latin1'), '%PDF-');
  assert.ok(pdf.slice(-1024).toString('latin1').includes('%%EOF'));
});

// ----------------------------------------------------------------------
// 8. La llave no se imprime
// ----------------------------------------------------------------------
test('la llave interna no aparece en la salida del script', async () => {
  let capturado = '';
  // Se inyecta el sumidero del script. NO se parchea process.stdout: hacerlo
  // se come la salida del reporter de node:test y rompe el conteo de la
  // suite completa (el runner solo ve los ultimos tests).
  await script.main([
    'node', 'smoke-produccion.js',
    '--url=http://127.0.0.1:9',
    '--interno=LLAVE-SECRETA-DE-PRUEBA-1234567890',
    '--timeout-ms=1500',
  ], { sink: (linea) => { capturado += String(linea) + '\n'; } });
  assert.equal(capturado.includes('LLAVE-SECRETA-DE-PRUEBA-1234567890'), false,
    'la llave interna no puede quedar en la salida');
  assert.ok(capturado.length > 0, 'la corrida tiene que producir salida');
});

test('el sumidero recibe la salida completa del resumen', async () => {
  let capturado = '';
  await script.main([
    'node', 'smoke-produccion.js',
    '--url=http://127.0.0.1:9',
    '--timeout-ms=1500',
  ], { sink: (linea) => { capturado += String(linea) + '\n'; } });
  assert.match(capturado, /Resumen/);
  assert.match(capturado, /RESULTADO: FALLA/);
});

test('el manifiesto y el archivo legal del repo son los que el script compara', () => {
  assert.equal(script.MANIFIEST_PATH,
    path.resolve(__dirname, '..', '..', 'scripts', 'fixtures', 'acuerdo-ARCHIVO.json'));
  assert.equal(script.ARCHIVO_LEGAL,
    path.resolve(__dirname, '..', '..', 'scripts', 'fixtures', 'acuerdo-v1.0.txt'));
  assert.ok(fs.existsSync(script.MANIFIEST_PATH));
  assert.ok(fs.existsSync(script.ARCHIVO_LEGAL));
});
