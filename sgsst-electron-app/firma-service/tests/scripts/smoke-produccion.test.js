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
 *   9. El e2e pide la notificacion (crear la solicitud NO manda el correo).
 *  10. La notificacion va a /notify-remote con el correo del firmante.
 *  11. Un fallo del servidor de correo NO se reporta como exito.
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
// ----------------------------------------------------------------------
// 9. La idempotencia y el modo legacy
// ----------------------------------------------------------------------
test('en modo legacy la peticion NO lleva Idempotency-Key', () => {
  // El servicio lo rechaza con un 400 explicito
  // (IDEMPOTENCY_LEGACY_NOT_SUPPORTED): la idempotencia exige
  // req.id_empresa y en modo legacy esa empresa es null por diseno.
  const args = script.parseArgs(['node', 'x']);
  const cab = script.cabecerasSignRequest(args, 'LLAVE-INterna', 'multipart/form-data');
  assert.equal(cab['X-Internal-API-Key'], 'LLAVE-INterna');
  assert.equal(cab['Content-Type'], 'multipart/form-data');
  assert.equal(cab['Idempotency-Key'], undefined,
    'mandar Idempotency-Key en modo legacy es un 400 guaranteed');
});

test('con --idempotencia la llave si viaja y es distinta en cada llamada', () => {
  const args = script.parseArgs(['node', 'x', '--idempotencia']);
  const a = script.cabecerasSignRequest(args, 'LLAVE', 'multipart/form-data');
  const b = script.cabecerasSignRequest(args, 'LLAVE', 'multipart/form-data');
  assert.ok(a['Idempotency-Key'], 'la llave de idempotencia tiene que estar');
  assert.match(a['Idempotency-Key'], /^smoke-[0-9a-f]{16}$/);
  assert.notEqual(a['Idempotency-Key'], b['Idempotency-Key']);
});

// ----------------------------------------------------------------------
// 10. El contrato del metadata de la solicitud de firma
// ----------------------------------------------------------------------
test('el metadata lleva los campos que el schema exige', () => {
  const args = script.parseArgs(['node', 'x', '--empresa=900829731', '--trabajador=CC-1']);
  const acuerdo = { version: 'v1.0', texto_hash: 'a'.repeat(64) };
  const meta = script.metadataSignRequest(args, acuerdo, 'b'.repeat(64));

  for (const clave of ['id_documento', 'id_trabajador', 'id_empresa', 'tipo_firma',
    'agreement_version', 'agreement_hash', 'document_hash', 'version_kair']) {
    assert.ok(meta[clave], 'el schema exige ' + clave);
  }
  assert.equal(meta.id_empresa, '900829731');
  assert.equal(meta.agreement_version, 'v1.0');
  assert.equal(meta.agreement_hash, 'a'.repeat(64));
  assert.match(meta.document_hash, /^[0-9a-f]{64}$/);
});

test('el tipo de identificacion del documento es uno valido', () => {
  // "OTRO" NO existe: el valor valido es "OTROSI". Este test fija la regla
  // para que el 400 del schema no vuelva a aparecer por un typo.
  const validos = ['CONTRATO', 'OTROSI', 'ACTA', 'CONSENTIMIENTO', 'AUTORIZACION',
    'REGLAMENTO', 'POLITICA', 'CERTIFICADO'];
  const args = script.parseArgs(['node', 'x']);
  const meta = script.metadataSignRequest(args, { version: 'v1.0', texto_hash: 'a'.repeat(64) },
    'b'.repeat(64));
  assert.ok(validos.includes(meta.tipo_identificacion),
    'tipo_identificacion=' + meta.tipo_identificacion + ' no esta en la lista');
});

test('el blob libre del metadata es un STRING JSON y solo lleva claves permitidas', () => {
  const args = script.parseArgs(['node', 'x']);
  const meta = script.metadataSignRequest(args, { version: 'v1.0', texto_hash: 'a'.repeat(64) },
    'b'.repeat(64));
  // El schema lo declara como z.string().max(8192): un objeto aqui es un 400
  // ("Expected string, received object").
  assert.equal(typeof meta.metadata, 'string',
    'el metadata anidado tiene que ser un string JSON, no un objeto');
  const permitidas = ['subtipo_identificacion', 'nombre_trabajador', 'nombre_empresa',
    'correo_empresa', 'correo'];
  const blob = JSON.parse(meta.metadata);
  for (const clave of Object.keys(blob)) {
    assert.ok(permitidas.includes(clave),
      'la clave ' + clave + ' no se puede archivar: el servicio la rechaza');
  }
});

test('la llave interna no aparece en la salida del script', async () => {  let capturado = '';
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

// ----------------------------------------------------------------------
// 9-11. El e2e tiene que MANDAR la invitacion
// ----------------------------------------------------------------------
//
// Por que estos tres existen: `POST /internal/sign-requests` crea la solicitud
// y devuelve el token, pero NO manda ningun correo. El primer contacto con el
// firmante es `POST /internal/sign-requests/:id/notify-remote`. Un e2e que
// solo crea la solicitud "pasa" sin haber probado el correo, que es
// exactamente lo que se quiere probar: en produccion, el 21-oct, el e2e dio
// OK con 12 comprobaciones y el firmante NUNCA recibio nada.
test('el e2e pide la notificacion: crear la solicitud NO manda el correo', async () => {
  const llamadas = [];
  const pedirDoble = async (op, body) => {
    llamadas.push({ path: op.path, method: op.method, body });
    if (op.path.indexOf('/verify') !== -1) {
      return {
        status: 200,
        texto: '{"id_solicitud":"SIGN-2026-000001"}',
        json: { id_solicitud: 'SIGN-2026-000001' },
      };
    }
    return {
      status: 201,
      texto: '{"id_solicitud":"SIGN-2026-000001"}',
      json: { id_solicitud: 'SIGN-2026-000001', url_publica: 'https://x/s/tok' },
    };
  };
  let notificado = null;
  const notificarDoble = async (args, internoKey, idSolicitud, pedirFn) => {
    notificado = { idSolicitud, hayPedir: typeof pedirFn === 'function' };
    return { ok: true, codigo: 'OK', detalle: '' };
  };

  await script.comprobarE2e(
    {
      e2e: true, confirmarE2e: true, url: 'https://x', timeoutMs: 1000,
      empresa: 'EMP-001', trabajador: 'CC-1', correo: 'firmante@example.com',
      idempotencia: false,
    },
    'llave-interna',
    { version: 'v1.0', texto_hash: 'hash-legal' },
    { pedir: pedirDoble, notificar: notificarDoble },
  );

  assert.notEqual(notificado, null,
    'el e2e tiene que pedir la notificacion: sin ella el correo no sale');
  assert.equal(notificado.idSolicitud, 'SIGN-2026-000001');
  assert.equal(llamadas.length, 2,
    'el e2e hace la creacion y la comprobacion del token: nada mas');
  assert.equal(llamadas[0].path, '/internal/sign-requests');
  assert.equal(llamadas[1].path, '/api/sign/tok/verify',
    'el e2e tiene que abrir el enlace que el mismo creo');
});

test('la notificacion va a /notify-remote con el correo del firmante', async () => {
  const pedidos = [];
  const pedirDoble = async (op, body) => {
    pedidos.push({ op, body });
    return { status: 200, texto: '{"ok":true}', json: { ok: true, messageId: '<m@gmail.com>' } };
  };

  const r = await script.notificarInvitacion(
    { url: 'https://x', correo: 'firmante@example.com', timeoutMs: 1000 },
    'llave-interna', 'SIGN-2026-211245', pedirDoble,
  );

  assert.equal(r.ok, true);
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].op.method, 'POST');
  assert.equal(pedidos[0].op.path,
    '/internal/sign-requests/SIGN-2026-211245/notify-remote');
  assert.equal(pedidos[0].op.headers['X-Internal-API-Key'], 'llave-interna');
  assert.deepEqual(JSON.parse(pedidos[0].body), { correo: 'firmante@example.com' });
});

test('un fallo del servidor de correo NO se reporta como exito', async () => {
  const pedirDoble = async () => ({
    status: 502,
    texto: '{"error":{"code":"INVITE_EMAIL_FAILED"}}',
    json: { error: { code: 'INVITE_EMAIL_FAILED', message: 'No se pudo enviar la invitación por correo' } },
  });

  const r = await script.notificarInvitacion(
    { url: 'https://x', correo: 'firmante@example.com', timeoutMs: 1000 },
    'llave-interna', 'SIGN-2026-211245', pedirDoble,
  );

  assert.equal(r.ok, false, 'un 502 del correo no puede salir como ok');
  assert.equal(r.codigo, 'INVITE_EMAIL_FAILED');

  // Y en el resumen del script tampoco puede quedar como OK: tiene que
  // quedar como AVISO (el servicio esta bien; el correo no salido).
  const ultimo = script.resultados[script.resultados.length - 1];
  assert.equal(ultimo.estado, 'AVISO',
    'el 502 del correo tiene que quedar como AVISO en el resumen, no como OK');
});

// ----------------------------------------------------------------------
// 12-13. La identificacion del firmante
// ----------------------------------------------------------------------
//
// `identify()` exige que la fila tenga `identificacion_tipo` y
// `identificacion_numero_hash`: si faltan, responde 500
// MISSING_IDENTIFICATION_DATA y el firmante no puede firmar. El cliente manda
// el SHA-256 del numero, nunca el numero en claro.
test('la solicitud lleva la identificacion del firmante (tipo + huella del numero)', () => {
  const meta = script.metadataSignRequest(
    { trabajador: 'CC-PRUEBA-001', numeroDocumento: 'PRUEBA-001', empresa: '900829731' },
    { version: 'v1.0', texto_hash: 'a'.repeat(64) },
    'b'.repeat(64),
  );
  assert.equal(meta.identificacion_tipo, 'CC');
  assert.match(meta.identificacion_numero_hash, /^[0-9a-f]{64}$/);
  assert.equal(meta.identificacion_numero_hash,
    require('crypto').createHash('sha256').update('PRUEBA-001').digest('hex'),
    'la huella tiene que ser el sha256 del numero que el firmante va a escribir');
  assert.ok(!('identificacion_numero' in meta),
    'el numero de documento NO viaja en claro: solo su huella');
});

test('sin --numero-documento se usa el --trabajador como numero de identificacion', () => {
  const meta = script.metadataSignRequest(
    { trabajador: 'CC-PRUEBA-001', empresa: '900829731' },
    { version: 'v1.0', texto_hash: 'a'.repeat(64) },
    'b'.repeat(64),
  );
  assert.equal(meta.identificacion_numero_hash,
    require('crypto').createHash('sha256').update('CC-PRUEBA-001').digest('hex'));
});

// ----------------------------------------------------------------------
// 14-16. El token tiene que RESOLVER
// ----------------------------------------------------------------------
//
// ESTOS TRES SON EL CHECK QUE FALTABA. El 21-oct el e2e dio verde con 13
// comprobaciones mientras NINGUN token resolvia (404 TOKEN_NOT_FOUND en
// todas las rutas de datos): el alta daba 201, el correo salia, y el
// firmante abria un enlace muerto. Un check que no muerde no es un check,
// asi que estos tests tienen que FALLAR si el check se degrada.
test('el token de la prueba se resuelve: el e2e abre el enlace que creo', async () => {
  const pedidos = [];
  const pedirDoble = async (op) => {
    pedidos.push(op);
    return {
      status: 200,
      texto: '{"id_solicitud":"SIGN-2026-873182"}',
      json: { id_solicitud: 'SIGN-2026-873182' },
    };
  };

  const r = await script.comprobarTokenResuelve(
    { url: 'https://x', timeoutMs: 1000 },
    'rrk73AtQ5PBeQLlhZhpJbgbMrBkGvsa-',
    pedirDoble,
  );

  assert.equal(r.ok, true);
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].path, '/api/sign/rrk73AtQ5PBeQLlhZhpJbgbMrBkGvsa-/verify');
  assert.equal(pedidos[0].method, 'GET');
});

test('si el token NO resuelve, el check FALLA (no puede quedar en verde)', async () => {
  const pedirDoble = async () => ({
    status: 404,
    texto: '{"error":{"code":"TOKEN_NOT_FOUND","message":"No disponible"}}',
    json: { error: { code: 'TOKEN_NOT_FOUND', message: 'No disponible' } },
  });

  const r = await script.comprobarTokenResuelve(
    { url: 'https://x', timeoutMs: 1000 },
    'tok-que-no-resuelve',
    pedirDoble,
  );

  assert.equal(r.ok, false, 'un token que no resuelve NO puede salir como ok');
  assert.equal(r.codigo, 'TOKEN_NOT_FOUND');

  // Y en el resumen del script tiene que quedar como FALLA, para que el
  // proceso salga con codigo 1 y no con "RESULTADO: OK".
  const ultimo = script.resultados[script.resultados.length - 1];
  assert.equal(ultimo.estado, 'FALLA',
    'el token que no resuelve tiene que quedar como FALLA en el resumen');
});

test('el check del token no puede quedarse sin comprobar: si no hay token, FALLA', async () => {
  const r = await script.comprobarTokenResuelve(
    { url: 'https://x', timeoutMs: 1000 },
    '',
    async () => ({ status: 200, texto: '{}', json: {} }),
  );

  assert.equal(r.ok, false, 'sin token no hay nada que comprobar: eso es una FALLA');
  assert.equal(r.codigo, 'SIN_TOKEN');
});

// ---------------------------------------------------------------------------
// 17. El 409 del D-03 es un AVISO, no una FALLA
// ---------------------------------------------------------------------------
//
// El 409 EMPRESA_NO_HABILITADA es el control del D-03 FUNCIONANDO: el
// servicio se niega a crear la firma de una Empresa sin Anexo de Encargo
// firmado ni canal de PQRS. Contarlo como FALLA hacía que el smoke terminara
// con codigo 1 por un control que se comportó como debe, y tapaba los
// fallos de verdad.
//
// Pero un AVISO que no dice nada es un AVISO inútil: tiene que explicar qué
// es y cuál es la salida.
test('el 409 EMPRESA_NO_HABILITADA queda como AVISO, no como FALLA', async () => {
  const pedirDoble = async () => ({
    status: 409,
    texto: '{"error":{"code":"EMPRESA_NO_HABILITADA","message":"no habilitada"}}',
    json: { error: { code: 'EMPRESA_NO_HABILITADA', message: 'no habilitada' } },
  });

  await script.comprobarE2e(
    {
      e2e: true, confirmarE2e: true, url: 'https://x', timeoutMs: 1000,
      empresa: 'EMP-SIN-ANEXO', trabajador: 'CC-1', correo: 'firmante@example.com',
      idempotencia: false,
    },
    'llave-interna',
    { version: 'v1.0', texto_hash: 'hash-legal' },
    { pedir: pedirDoble, notificar: async () => ({ ok: true, codigo: 'OK', detalle: '' }) },
  );

  const renglones = script.resultados.filter(
    (r) => String(r.detalle || '').indexOf('EMPRESA_NO_HABILITADA') !== -1
  );
  assert.equal(renglones.length, 1, 'el 409 del D-03 deja un renglon en el resumen');
  assert.equal(renglones[0].estado, 'AVISO',
    'el bloqueo del D-03 funcionando NO es una falla del servicio');
  assert.match(renglones[0].detalle, /excepcion auditable/,
    'el aviso dice cual es la salida');
});

test('un 409 que NO es del D-03 sigue siendo FALLA', async () => {
  const pedirDoble = async () => ({
    status: 409,
    texto: '{"error":{"code":"OTRO_CONFLICTO","message":"x"}}',
    json: { error: { code: 'OTRO_CONFLICTO', message: 'x' } },
  });

  await script.comprobarE2e(
    {
      e2e: true, confirmarE2e: true, url: 'https://x', timeoutMs: 1000,
      empresa: 'EMP-001', trabajador: 'CC-1', correo: 'firmante@example.com',
      idempotencia: false,
    },
    'llave-interna',
    { version: 'v1.0', texto_hash: 'hash-legal' },
    { pedir: pedirDoble, notificar: async () => ({ ok: true, codigo: 'OK', detalle: '' }) },
  );

  const renglones = script.resultados.filter(
    (r) => String(r.detalle || '').indexOf('OTRO_CONFLICTO') !== -1
  );
  assert.equal(renglones.length, 1);
  assert.equal(renglones[0].estado, 'FALLA',
    'un 409 que no es del D-03 SI es una falla');
});
