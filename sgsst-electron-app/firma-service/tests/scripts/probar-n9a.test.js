/**
 * tests/scripts/probar-n9a.test.js
 *
 * Tests del script de la prueba de la 9A (los medios autorizados del 8.2 y
 * la firma autográfica del 7.1-7.3) contra el ambiente real.
 *
 * Lo que se comprueba:
 *
 *   1. Sin `--confirmar-escribe` NO se escribe nada: ni una petición de
 *      escritura llega al servicio.
 *   2. `--confirmar-escribe` sí autoriza la escritura.
 *   3. Un argumento desconocido se rechaza (código 2) y no se ejecuta nada.
 *   4. Faltan los obligatorios → código 2.
 *   5. `--trabajador` tiene que parecer un documento de identidad.
 *   6. `--otp` tiene que ser de 6 dígitos.
 *   6-bis. El id del Trabajador y el número con el que se identifica son DOS
 *      COSAS: la identificación viaja con el número y la huella archivada es
 *      la de ese número; el seudónimo NO se puede mandar como id (la API
 *      acepta 64 caracteres y el seudónimo tiene 69).
 *   6-ter. `--numero` tiene que ser de 4 a 20 dígitos, y si no se pasa se
 *      usa el mismo valor de `--trabajador`.
 *   7. La llave interna NO aparece en la salida ni en la evidencia.
 *   8. El PDF "firmado en papel" es un PDF de verdad y dice que es sintético.
 *   9. El multipart lleva los campos y el archivo, con su boundary.
 *  10. LA PRUEBA NO GASTA EL ALCANCE DOS VECES: una segunda corrida continúa
 *      la misma solicitud y NO crea otra. Esto es lo que hace segura la
 *      corrida contra la excepción de habilitación, cuyo alcance no se
 *      devuelve.
 *  11. Un estado guardado de OTRA prueba se rechaza.
 *  12. Sin `--otp` el script se detiene (código 3) y NO registra el papel.
 *  13. La excepción sin alcance bloquea y no se crea nada.
 *  14. La evidencia dice qué se probó, con qué ids y con qué huellas, y dice
 *      también que el Trabajador y el papel son SINTÉTICOS.
 *
 * Por qué el 10 importa: crear la solicitud de firma gasta una unidad del
 * alcance de la excepción de habilitación (`registrarUso`). Un reintento mal
 * hecho se come el piloto. El estado es lo que lo evita.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const script = require('../../scripts/probar-n9a');

// --------------------------------------------------------------------------
// Un servicio falso, para no tocar el de verdad
// --------------------------------------------------------------------------

const LLAVE = 'LLAVE-INTERNA-DE-PRUEBA-NO-ES-REAL';
const HASH_ACUERDO = '952592f078eb3e8ca6a913361beb6a5eb7c32f22bba2c9fa30d17ab09825be28';

// El seudonimo con el que el sistema guarda al Trabajador (`psn1_` + 64 hex).
// Los medios autorizados (el 8.2) estan registrados bajo este id, no bajo el
// numero de documento: por eso el script los lleva por separado.
const SEUDONIMO = 'psn1_' + 'a'.repeat(64);

/**
 * Levanta un servicio falso que responde como el de verdad y cuenta las
 * peticiones de escritura.
 */
function servicioFalso(opciones = {}) {
  const cuenta = { signRequests: 0, firmaPapel: 0, identify: 0, verifyOtp: 0, notify: 0, resendOtp: 0 };
  // La excepcion es MUTABLE a proposito: una prueba tiene que poder gastar el
  // alcance entre dos corridas (que es lo que pasa en el ambiente real).
  cuenta.excepcion = {
    id: 5,
    id_empresa: '900829731',
    estado: (opciones.excepcionEstado === undefined ? 'VIGENTE' : opciones.excepcionEstado),
    firmas_usadas: opciones.firmasUsadas === undefined ? 1 : opciones.firmasUsadas,
    alcance_firmas_max: opciones.alcanceMaximo === undefined ? 2 : opciones.alcanceMaximo,
    ruta_papel_operativa: 1,
    plazo_hasta: '2026-12-04T14:01:43.000Z',
  };
  // Lo que llegó a cada ruta: para comprobar qué se mandó (el id del
  // trabajador y el número con el que se identifica son dos cosas distintas).
  const cuerpos = {};
  const manejadores = {
    'GET /health': (req, res) => json(res, 200, {
      status: 'ok', checks: { db: 'ok', smtp: 'configured' },
    }),
    'GET /internal/acuerdo-activo': (req, res) => json(res, 200, {
      version: 'v1.5', texto_hash: HASH_ACUERDO,
    }),
    'GET /internal/admin/excepciones-habilitacion': (req, res) => json(res, 200, {
      items: [cuenta.excepcion],
    }),
    'POST /internal/consentimientos': (req, res) => json(res, 201, { consent_id: 7 }),
    'POST /internal/sign-requests': (req, res) => {
      cuenta.signRequests++;
      json(res, 201, {
        id_solicitud: 'SIGN-2026-999999',
        token: 'token-de-prueba',
        agreement_hash: HASH_ACUERDO,
        url_publica: 'https://firma.kair.fyi/s/token-de-prueba',
        estado: 'PENDING',
      });
    },
    'POST /internal/sign-requests/SIGN-2026-999999/notify-remote': (req, res) => {
      cuenta.notify++;
      json(res, 200, { ok: true, messageId: '<prueba@ejemplo>' });
    },
    'GET /internal/sign-requests/SIGN-2026-999999/medios': (req, res) => json(res, 200, {
      id_solicitud: 'SIGN-2026-999999',
      medios: [
        { tipo: 'EMAIL_HOJA_VIDA', valor: 'prueba@example.com', estado: 'ACTIVO', origen: 'SISTEMA' },
        { tipo: 'LINK_KAIR', valor: '', estado: 'ACTIVO', origen: 'SISTEMA' },
      ],
      medios_activos: [{ tipo: 'EMAIL_HOJA_VIDA', valor: 'prueba@example.com' }],
    }),
    'POST /api/sign/token-de-prueba/identify': (req, res) => {
      cuenta.identify++;
      json(res, 200, {
        estado: 'OTP_SENT',
        otp_ttl_seconds: 600,
        correo_destino_enmascarado: 'pr****@example.com',
      });
    },
    'POST /api/sign/token-de-prueba/verify-otp': (req, res) => {
      cuenta.verifyOtp++;
      if (opciones.otpVencido) {
        // El codigo REAL del servicio (ver src/services/publicFlow.js):
        // OTP_EXPIRADO con 410.
        json(res, 410, {
          error: { code: 'OTP_EXPIRADO', message: 'El código de verificación expiró' },
        });
        return;
      }
      json(res, 200, { ok: true, estado: 'OTP_VERIFIED' });
    },
    'POST /api/sign/token-de-prueba/resend-otp': (req, res) => {
      cuenta.resendOtp++;
      json(res, 200, { ok: true, estado: 'OTP_SENT', otp_ttl_seconds: 600 });
    },
    'POST /internal/sign-requests/SIGN-2026-999999/firma-papel': (req, res) => {
      cuenta.firmaPapel++;
      json(res, 200, {
        ok: true,
        id_solicitud: 'SIGN-2026-999999',
        estado_papel: 'FIRMADO',
        pdf_hash: 'a'.repeat(64),
        registro_path: '/opt/kair-firma/storage/papel/SIGN-2026-999999-registro.pdf',
        copia: { enviada: true, medio: 'CORREO_OTP', correo: 'prueba@example.com' },
      });
    },
    'GET /internal/sign-requests/SIGN-2026-999999/eventos': (req, res) => json(res, 200, {
      id_solicitud: 'SIGN-2026-999999',
      total: 9,
      eventos: [
        { id: 1, tipo_evento: 'CREATED', fecha_evento: '2026-11-06T15:00:00.000Z' },
        { id: 2, tipo_evento: 'INVITE_SENT', fecha_evento: '2026-11-06T15:00:01.000Z' },
        { id: 3, tipo_evento: 'MEDIO_PERSONAL_CONFIRMADO', fecha_evento: '2026-11-06T15:00:02.000Z' },
        { id: 4, tipo_evento: 'OTP_SENT', fecha_evento: '2026-11-06T15:00:03.000Z' },
        { id: 5, tipo_evento: 'OTP_VERIFIED', fecha_evento: '2026-11-06T15:00:04.000Z' },
        { id: 6, tipo_evento: 'PAPER_OPTION_AVAILABLE', fecha_evento: '2026-11-06T15:00:05.000Z' },
        { id: 7, tipo_evento: 'PAPER_TRACK_OPENED', fecha_evento: '2026-11-06T15:00:06.000Z' },
        { id: 8, tipo_evento: 'PAPER_SIGNATURE_REGISTERED', fecha_evento: '2026-11-06T15:00:07.000Z' },
        { id: 9, tipo_evento: 'ELECTRONIC_FLOW_CANCELLED', fecha_evento: '2026-11-06T15:00:08.000Z' },
      ],
    }),
    'GET /internal/sign-requests/SIGN-2026-999999': (req, res) => json(res, 200, {
      id_solicitud: 'SIGN-2026-999999',
      estado: 'CANCELLED',
      firma_papel: {
        estado: 'FIRMADO',
        pdf_hash: 'a'.repeat(64),
        registro_path: '/opt/kair-firma/storage/papel/SIGN-2026-999999-registro.pdf',
      },
    }),
  };

  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const cuerpo = [];
    req.on('data', (d) => cuerpo.push(d));
    req.on('end', () => {
      const manejador = manejadores[req.method + ' ' + u.pathname];
      if (!manejador) {
        json(res, 404, { error: { code: 'NOT_FOUND', message: 'ruta no existe' } });
        return;
      }
      const texto = Buffer.concat(cuerpo).toString('utf8');
      cuerpos[req.method + ' ' + u.pathname] = texto;
      manejador(req, res, texto);
    });
  });

  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      resolve({
        cuenta,
        cuerpos,
        url: 'http://127.0.0.1:' + srv.address().port,
        cerrar: () => new Promise((r) => srv.close(r)),
      });
    });
  });
}

function json(res, codigo, objeto) {
  const texto = JSON.stringify(objeto);
  res.writeHead(codigo, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(texto) });
  res.end(texto);
}

function temporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-n9a-test-'));
  const admin = path.join(dir, 'admin-key.txt');
  fs.writeFileSync(admin, 'LLAVE-ADMIN-DE-PRUEBA', 'utf8');
  return {
    dir,
    estado: path.join(dir, 'estado.json'),
    evidencia: path.join(dir, 'evidencia.txt'),
    llave: path.join(dir, 'internal-key.txt'),
    admin,
  };
}

/**
 * Los argumentos de una corrida, con el estado y la evidencia en el
 * directorio temporal de la prueba: el estado por omisión (en el temporal
 * del sistema) lo comparten todas las corridas y una prueba no puede dejar
 * un estado que afecte a la siguiente.
 */
function argumentos(url, llave, extra = []) {
  return [
    'node', 'probar-n9a.js',
    '--url=' + url,
    '--interno-file=' + llave,
    '--empresa=900829731',
    '--trabajador=900000001',
    '--correo=prueba@example.com',
    '--confirmar-escribe',
    ...extra,
  ];
}

// --------------------------------------------------------------------------
// 1-6. Argumentos y modo de escritura
// --------------------------------------------------------------------------

test('sin --confirmar-escribe no se escribe nada', async () => {
  const srv = await servicioFalso();
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const lineas = [];
  script.reiniciar();
  script.fijarSalida((l) => lineas.push(l));
  try {
    const code = await script.main([
      'node', 'probar-n9a.js',
      '--url=' + srv.url,
      '--interno-file=' + t.llave, '--admin-file=' + t.admin,
      '--empresa=900829731',
      '--trabajador=900000001',
      '--correo=prueba@example.com',
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
    ]);
    assert.equal(code, 0);
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }

  assert.equal(srv.cuenta.signRequests, 0, 'no se puede crear una solicitud sin confirmar');
  assert.equal(srv.cuenta.firmaPapel, 0);
  assert.match(lineas.join('\n'), /Modo lectura/);
});

test('un argumento desconocido se rechaza con codigo 2 y no se ejecuta nada', async () => {
  script.reiniciar();
  const code = await script.main(['node', 'probar-n9a.js', '--inventado']);
  assert.equal(code, 2);
});

test('faltan los obligatorios y el codigo se rechaza', async () => {
  script.reiniciar();
  assert.equal(await script.main(['node', 'x']), 2);
  assert.equal(await script.main(['node', 'x', '--empresa=900829731']), 2);
  assert.equal(await script.main([
    'node', 'x', '--empresa=900829731', '--trabajador=900000001',
  ]), 2);
});

test('--trabajador tiene que parecer un documento de identidad', async () => {
  script.reiniciar();
  const code = await script.main([
    'node', 'x', '--empresa=900829731', '--trabajador=ABC',
    '--correo=prueba@example.com', '--confirmar-escribe',
  ]);
  assert.equal(code, 2);
});

test('--otp tiene que ser de 6 digitos', async () => {
  script.reiniciar();
  const code = await script.main([
    'node', 'x', '--empresa=900829731', '--trabajador=900000001',
    '--correo=prueba@example.com', '--otp=12345', '--confirmar-escribe',
  ]);
  assert.equal(code, 2);
});

// --------------------------------------------------------------------------
// 6-bis. El id del Trabajador y su numero de identidad son dos cosas
// --------------------------------------------------------------------------

test('el seudonimo NO se puede mandar como id: la API acepta 64 y el seudonimo tiene 69', async () => {
  const srv = await servicioFalso();
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const lineas = [];
  script.reiniciar();
  script.fijarSalida((l) => lineas.push(l));
  let code;
  try {
    code = await script.main([
      'node', 'probar-n9a.js',
      '--url=' + srv.url,
      '--interno-file=' + t.llave, '--admin-file=' + t.admin,
      '--empresa=900829731',
      '--trabajador=' + SEUDONIMO,
      '--numero=900000001',
      '--correo=prueba@example.com',
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
      '--confirmar-escribe',
    ]);
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }

  assert.equal(code, 2, 'el servicio seudonimiza el id crudo: mandarle el seudonimo es un 400');
  assert.equal(srv.cuenta.signRequests, 0);
  assert.match(lineas.join('\n'), /no puede ser un seudonimo/);
});

test('el numero con el que se identifica va aparte del id del trabajador', async () => {
  const srv = await servicioFalso();
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const lineas = [];
  script.reiniciar();
  script.fijarSalida((l) => lineas.push(l));
  let code;
  try {
    code = await script.main([
      'node', 'probar-n9a.js',
      '--url=' + srv.url,
      '--interno-file=' + t.llave, '--admin-file=' + t.admin,
      '--empresa=900829731',
      '--trabajador=900000001',
      '--numero=900000002',
      '--correo=prueba@example.com',
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
      '--confirmar-escribe',
      '--otp=123456',
    ]);
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }

  assert.equal(code, 0, lineas.join('\n'));

  // La identificacion va con el NUMERO, no con el id.
  const identify = JSON.parse(srv.cuerpos['POST /api/sign/token-de-prueba/identify']);
  assert.equal(identify.numero_documento, '900000002');
  assert.equal(identify.tipo_identificacion, 'CC');

  // Y la huella que se archiva es la del numero.
  const multipart = srv.cuerpos['POST /internal/sign-requests'];
  const encontrado = /name="metadata"\r?\n\r?\n([\s\S]*?)\r?\n--/.exec(multipart);
  assert.ok(encontrado, 'el multipart tiene que traer el campo metadata');
  const meta = JSON.parse(encontrado[1]);
  assert.equal(meta.id_trabajador, '900000001');
  assert.equal(meta.identificacion_tipo, 'CC');
  assert.equal(
    meta.identificacion_numero_hash,
    crypto.createHash('sha256').update('900000002').digest('hex'),
    'la huella de la identificacion es la del numero, no la del id'
  );
});

test('sin --numero se usa el mismo valor de --trabajador', async () => {
  const srv = await servicioFalso();
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const lineas = [];
  script.reiniciar();
  script.fijarSalida((l) => lineas.push(l));
  let code;
  try {
    code = await script.main([
      'node', 'probar-n9a.js',
      '--url=' + srv.url,
      '--interno-file=' + t.llave, '--admin-file=' + t.admin,
      '--empresa=900829731',
      '--trabajador=900000001',
      '--correo=prueba@example.com',
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
      '--confirmar-escribe',
      '--otp=123456',
    ]);
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }

  assert.equal(code, 0, lineas.join('\n'));
  const identify = JSON.parse(srv.cuerpos['POST /api/sign/token-de-prueba/identify']);
  assert.equal(identify.numero_documento, '900000001');
});

test('--numero tiene que ser de 4 a 20 digitos', async () => {
  script.reiniciar();
  const code = await script.main([
    'node', 'x', '--empresa=900829731', '--trabajador=900000001',
    '--numero=ABC', '--correo=prueba@example.com', '--confirmar-escribe',
  ]);
  assert.equal(code, 2);
});

// --------------------------------------------------------------------------
// 7-9. La llave, el PDF y el multipart
// --------------------------------------------------------------------------

test('la llave interna no aparece en la salida', async () => {
  const srv = await servicioFalso();
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const lineas = [];
  script.reiniciar();
  script.fijarSalida((l) => lineas.push(l));
  try {
    const code = await script.main(argumentos(srv.url, t.llave, [
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
    ]));
    assert.equal(code, 3, 'sin --otp la corrida espera el código');
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }
  assert.ok(!lineas.join('\n').includes(LLAVE),
    'la llave interna no puede aparecer en la salida');
});

test('el PDF firmado en papel es un PDF de verdad y dice que es sintetico', async () => {
  const pdf = await script.pdfFirmadoEnPapel({
    empresa: '900829731',
    idDocumento: 'PRUEBA-9A-1',
    fechaFirma: '2026-11-06T15:00:00.000Z',
    medio: 'prueba@example.com',
  });
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.slice(0, 5).toString('latin1'), '%PDF-',
    'tiene que ser un PDF de verdad: el servidor valida los bytes magicos');
  // El texto del PDF va comprimido, así que se comprueba el código que lo
  // genera: el mensaje que dice que es sintético tiene que estar en el
  // archivo, no solo en la intención.
  const fuente = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'probar-n9a.js'), 'utf8');
  assert.match(fuente, /DATOS SINTETICOS/);
  assert.match(fuente, /NO ES EVIDENCIA DE UN ACTO REAL/);
});

test('el multipart lleva los campos y el archivo con su boundary', () => {
  const { body, contentType } = script.multipart(
    { metadata: '{"canal":"PRUEBA"}' },
    { campo: 'documento', nombre: 'x.pdf', contenido: Buffer.from('%PDF-1.4') },
  );
  assert.match(contentType, /^multipart\/form-data; boundary=/);
  const texto = body.toString('latin1');
  assert.ok(texto.includes('name="metadata"'));
  assert.ok(texto.includes('PRUEBA'));
  assert.ok(texto.includes('name="documento"; filename="x.pdf"'));
  assert.ok(texto.includes('%PDF-1.4'));
});

// --------------------------------------------------------------------------
// 10-12. El estado: la prueba no gasta el alcance dos veces
// --------------------------------------------------------------------------

test('la corrida completa hace las dos ramas de la 9A y deja evidencia', async () => {
  const srv = await servicioFalso();
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const lineas = [];
  script.reiniciar();
  script.fijarSalida((l) => lineas.push(l));
  let code;
  try {
    code = await script.main([
      'node', 'probar-n9a.js',
      '--url=' + srv.url,
      '--interno-file=' + t.llave, '--admin-file=' + t.admin,
      '--empresa=900829731',
      '--trabajador=900000001',
      '--correo=prueba@example.com',
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
      '--confirmar-escribe',
      '--otp=123456',
    ]);
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }

  assert.equal(code, 0, lineas.join('\n'));
  assert.equal(srv.cuenta.signRequests, 1);
  assert.equal(srv.cuenta.notify, 1);
  assert.equal(srv.cuenta.identify, 1);
  assert.equal(srv.cuenta.verifyOtp, 1);
  assert.equal(srv.cuenta.firmaPapel, 1);

  const salida = lineas.join('\n');
  assert.match(salida, /PAPER_TRACK_OPENED/);
  assert.match(salida, /PAPER_SIGNATURE_REGISTERED/);
  assert.match(salida, /ELECTRONIC_FLOW_CANCELLED/);

  // La evidencia: qué se probó, con ids y huellas, y qué NO es real.
  assert.ok(fs.existsSync(t.evidencia));
  const evidencia = fs.readFileSync(t.evidencia, 'utf8');
  assert.match(evidencia, /SIGN-2026-999999/);
  assert.match(evidencia, /MEDIOS AUTORIZADOS/);
  assert.match(evidencia, /FIRMA AUTOGRAFICA/);
  assert.match(evidencia, /LO QUE ESTA PRUEBA NO ES/);
  assert.match(evidencia, /sintetico/i);
  assert.ok(!evidencia.includes(LLAVE), 'la llave no puede estar en la evidencia');
});

test('una corrida que CONTINUA no se frena aunque el alcance ya este gastado', async () => {
  const srv = await servicioFalso();
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const correr = async (extra) => {
    script.reiniciar();
    script.fijarSalida(() => {});
    try {
      return await script.main([
        'node', 'probar-n9a.js',
        '--url=' + srv.url,
        '--interno-file=' + t.llave, '--admin-file=' + t.admin,
        '--empresa=900829731',
        '--trabajador=900000001',
        '--numero=900000001',
        '--correo=prueba@example.com',
        '--estado=' + t.estado,
        '--evidencia=' + t.evidencia,
        '--confirmar-escribe',
        ...extra,
      ]);
    } finally {
      script.fijarSalida(null);
    }
  };

  // Primera corrida: crea la solicitud (y el alcance queda consumido).
  const primera = await correr([]);
  assert.equal(primera, 3, 'sin el codigo la corrida espera');
  assert.equal(srv.cuenta.signRequests, 1);

  // El alcance ya se uso: 2 de 2. Es lo que ve la corrida que CONTINUA.
  srv.cuenta.excepcion.firmas_usadas = 2;
  srv.cuenta.excepcion.alcance_firmas_max = 2;

  const segunda = await correr(['--otp=123456']);
  await srv.cerrar();

  assert.equal(segunda, 0, 'una corrida que continua no se frena por el alcance');
  assert.equal(srv.cuenta.signRequests, 1, 'no se puede crear una segunda solicitud');
  assert.equal(srv.cuenta.firmaPapel, 1, 'la firma en papel tiene que quedar registrada');
  assert.ok(fs.existsSync(t.evidencia), 'tiene que quedar la evidencia');
});

test('una segunda corrida CONTINUA la solicitud y no crea otra', async () => {
  const srv = await servicioFalso();
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const correr = async (extra) => {
    script.reiniciar();
    script.fijarSalida(() => {});
    try {
      return await script.main([
        'node', 'probar-n9a.js',
        '--url=' + srv.url,
        '--interno-file=' + t.llave, '--admin-file=' + t.admin,
        '--empresa=900829731',
        '--trabajador=900000001',
        '--correo=prueba@example.com',
        '--estado=' + t.estado,
        '--evidencia=' + t.evidencia,
        '--confirmar-escribe',
        ...extra,
      ]);
    } finally {
      script.fijarSalida(null);
    }
  };

  await correr([]);
  await correr(['--otp=123456']);
  await srv.cerrar();

  assert.equal(srv.cuenta.signRequests, 1,
    'crear la solicitud GASTA alcance de la excepcion: no puede pasar dos veces');
  assert.equal(srv.cuenta.firmaPapel, 1,
    'la firma en papel tampoco se puede registrar dos veces');
});

test('un estado guardado de otra prueba se rechaza', async () => {
  const t = temporal();
  fs.writeFileSync(t.estado, JSON.stringify({
    id_solicitud: 'SIGN-2026-000001',
    token: 'otro',
    empresa: '900000000',
    trabajador: '800000000',
    correo: 'otro@example.com',
    creado_at: '2026-11-06T10:00:00.000Z',
    pasos: {},
  }), 'utf8');

  const srv = await servicioFalso();
  script.reiniciar();
  script.fijarSalida(() => {});
  let code;
  try {
    code = await script.main([
      'node', 'probar-n9a.js',
      '--url=' + srv.url,
      '--empresa=900829731',
      '--trabajador=900000001',
      '--correo=prueba@example.com',
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
      '--confirmar-escribe',
      '--otp=123456',
    ]);
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }
  assert.equal(code, 1, 'un estado que es de otra prueba tiene que bloquear');
  assert.equal(srv.cuenta.signRequests, 0);
});

test('sin --otp el script se detiene y NO registra el papel', async () => {
  const srv = await servicioFalso();
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const lineas = [];
  script.reiniciar();
  script.fijarSalida((l) => lineas.push(l));
  let code;
  try {
    code = await script.main([
      'node', 'probar-n9a.js',
      '--url=' + srv.url,
      '--interno-file=' + t.llave, '--admin-file=' + t.admin,
      '--empresa=900829731',
      '--trabajador=900000001',
      '--correo=prueba@example.com',
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
      '--confirmar-escribe',
    ]);
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }

  assert.equal(code, 3, 'sin el codigo el script espera, no falla');
  assert.equal(srv.cuenta.firmaPapel, 0);
  assert.match(lineas.join('\n'), /falta el código de verificación/);
});

test('un codigo vencido pide uno nuevo y espera, en vez de fallar', async () => {
  const srv = await servicioFalso({ otpVencido: true });
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  const lineas = [];
  script.reiniciar();
  script.fijarSalida((l) => lineas.push(l));
  let code;
  try {
    code = await script.main([
      'node', 'probar-n9a.js',
      '--url=' + srv.url,
      '--interno-file=' + t.llave, '--admin-file=' + t.admin,
      '--empresa=900829731',
      '--trabajador=900000001',
      '--correo=prueba@example.com',
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
      '--confirmar-escribe',
      '--otp=123456',
    ]);
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }

  assert.equal(code, 3, 'un código vencido es una espera, no una falla');
  assert.equal(srv.cuenta.resendOtp, 1, 'tiene que pedir el código nuevo');
  assert.equal(srv.cuenta.firmaPapel, 0, 'el papel no se registra sin verificar el medio');
  assert.match(lineas.join('\n'), /Se pidió un código nuevo/);
});

// --------------------------------------------------------------------------
// 13. La excepción sin alcance bloquea
// --------------------------------------------------------------------------
test('una excepción sin alcance bloquea y no se crea nada', async () => {
  const srv = await servicioFalso({ firmasUsadas: 2, alcanceMaximo: 2 });
  const t = temporal();
  fs.writeFileSync(t.llave, LLAVE, 'utf8');

  script.reiniciar();
  script.fijarSalida(() => {});
  let code;
  try {
    code = await script.main([
      'node', 'probar-n9a.js',
      '--url=' + srv.url,
      '--interno-file=' + t.llave, '--admin-file=' + t.admin,
      '--empresa=900829731',
      '--trabajador=900000001',
      '--correo=prueba@example.com',
      '--estado=' + t.estado,
      '--evidencia=' + t.evidencia,
      '--confirmar-escribe',
      '--otp=123456',
    ]);
  } finally {
    script.fijarSalida(null);
    await srv.cerrar();
  }
  assert.equal(code, 1);
  assert.equal(srv.cuenta.signRequests, 0,
    'sin alcance no se puede crear la solicitud: el alcance no se devuelve');
});
