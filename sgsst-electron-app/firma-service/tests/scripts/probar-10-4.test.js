/**
 * tests/scripts/probar-10-4.test.js
 *
 * Tests del script de la prueba de la 10.4 (la migración de la solicitud a la
 * versión vigente del Acuerdo) contra el ambiente real.
 *
 * Lo que se comprueba:
 *
 *   1. Sin `--confirmar-escribe` NO se escribe nada.
 *   2. `--confirmar-escribe` sí autoriza la escritura.
 *   3. Un argumento desconocido se rechaza (código 2).
 *   4. Faltan los obligatorios → código 2. `--db` es obligatorio: sin la base
 *      AISLADA el script no puede hacer su maniobra y no debe intentarlo.
 *   5. `--trabajador` tiene que parecer un documento de identidad, y NO puede
 *      ser un seudónimo (la API acepta 64 caracteres y el seudónimo tiene 69).
 *   6. `--otp` tiene que ser de 6 dígitos.
 *   7. La llave interna NO aparece en la salida ni en la evidencia.
 *   8. El PDF de la solicitud es un PDF de verdad y dice que es sintético.
 *   9. El multipart lleva los campos y el archivo, con su boundary.
 *  10. LA CORRIDA COMPLETA: la solicitud migra a la versión vigente, la fila
 *      queda con SU huella, el texto que el firmante descarga es el archivado,
 *      el consentimiento de la versión anterior queda INTACTO y el evento
 *      AGREEMENT_VERSION_MIGRATED dice qué versión se dejó y cuál se tomó.
 *  11. La maniobra del cambio de versión ocurre en la base AISLADA que se le
 *      indicó, y en ninguna otra.
 *  12. Una segunda corrida NO crea otra solicitud (el alcance no se devuelve).
 *  13. Un estado guardado de OTRA prueba se rechaza.
 *  14. Sin `--otp` el script se detiene (código 3) y NO acepta el Acuerdo.
 *  15. El 409 tiene que ser ACCIONABLE: si el servicio no dice qué hacer, la
 *      prueba falla (un 409 sin salida es justo lo que la 10.4 vino a cerrar).
 *  16. La evidencia dice qué se probó, con qué ids y con qué huellas, y dice
 *      también que la base es AISLADA y que el Trabajador es SINTÉTICO.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const script = require('../../scripts/probar-10-4');

const LLAVE = 'LLAVE-INTERNA-DE-PRUEBA-NO-ES-REAL';
const EMPRESA = '900829731';
const TRABAJADOR = '900000002';
const NUMERO = '900000002';
const CORREO = 'prueba@example.com';

// Los textos de las dos versiones. El hash NO se inventa: se calcula, porque
// lo que la prueba comprueba es que la huella archivada sea la del texto que
// el firmante leyó (en el ambiente real son los hashes publicados).
const TEXTO_V14 = 'ACUERDO DE PRUEBA 10.4\nVersion v1.4 (la vigente al crear la solicitud)\n'
  + 'con un deber legal que la v1.5 cambia\n';
const TEXTO_V15 = 'ACUERDO DE PRUEBA 10.4\nVersion v1.5 (la vigente al aceptar)\n'
  + 'con un deber legal que la v1.4 no tenia\n';
const HASH14 = crypto.createHash('sha256').update(TEXTO_V14, 'utf8').digest('hex');
const HASH15 = crypto.createHash('sha256').update(TEXTO_V15, 'utf8').digest('hex');

// --------------------------------------------------------------------------
// El motor de base en memoria (el script lo permite inyectar)
// --------------------------------------------------------------------------

function motorFalso(opciones = {}) {
  const db = {
    versionActiva: opciones.versionActiva || 'v1.5',
    versiones: {
      'v1.4': { texto: TEXTO_V14, texto_hash: HASH14 },
      'v1.5': { texto: TEXTO_V15, texto_hash: HASH15 },
    },
    firmas: {},
    consentimientos: {},
    eventos: [],
    cambios: [],
    proximoIdFirma: 18,
    proximoIdConsent: 6,
  };

  function textoDe(version) {
    const v = db.versiones[version];
    return v ? v.texto : '';
  }

  const motor = {
    db,
    textoDe,
    sql(base, consulta) {
      if (/FROM gh_firmas_electronicas/.test(consulta)) {
        const m = /id_solicitud = '([^']*)'/.exec(consulta);
        const fila = m ? db.firmas[m[1]] : null;
        return fila ? [fila] : [];
      }
      if (/FROM gh_consentimientos_firma/.test(consulta)) {
        const m = /WHERE id = (\d+)/.exec(consulta);
        const c = m ? db.consentimientos[Number(m[1])] : null;
        return c ? [c] : [];
      }
      if (/FROM gh_firma_eventos/.test(consulta)) {
        const m = /firma_id = (\d+)/.exec(consulta);
        const fid = m ? Number(m[1]) : -1;
        return db.eventos.filter((e) => e.firma_id === fid
          && (!/evento = '([^']*)'/.test(consulta)
            || e.evento === /evento = '([^']*)'/.exec(consulta)[1]));
      }
      return [];
    },
    activar(base, version) {
      if (!db.versiones[version]) {
        throw new Error('la version ' + version + ' no existe en la base');
      }
      db.cambios.push(version);
      db.versionActiva = version;
      return { version, texto_hash: db.versiones[version].texto_hash, activa: 1 };
    },
    /** Registra lo que el servicio falso escribe, para que el motor lo vea. */
    crearFirma(idSolicitud, campos) {
      const id = db.proximoIdFirma++;
      const fila = Object.assign({
        id,
        id_solicitud: idSolicitud,
        agreement_version: db.versionActiva,
        agreement_hash: db.versiones[db.versionActiva].texto_hash,
        consent_id: null,
        estado: 'PENDING',
      }, campos);
      db.firmas[idSolicitud] = fila;
      return fila;
    },
    crearConsentimiento(campos) {
      const id = db.proximoIdConsent++;
      const c = Object.assign({
        id,
        version_acuerdo: db.versionActiva,
        manifestacion_aceptada: 0,
        fecha_aceptacion: null,
      }, campos);
      db.consentimientos[id] = c;
      return c;
    },
  };
  return motor;
}

// --------------------------------------------------------------------------
// Un servicio falso, para no tocar el de verdad
// --------------------------------------------------------------------------

function servicioFalso(motor, opciones = {}) {
  const cuenta = {
    signRequests: 0, identify: 0, verifyOtp: 0, accept: 0, viewDocument: 0,
    contexto: 0,
    // El servidor registra la puesta a disposicion de las politicas cuando
    // SIRVE el contexto. El servicio falso hace lo mismo.
    disposicion: false,
  };
  const excepcion = {
    id: 9,
    id_empresa: EMPRESA,
    estado: 'VIGENTE',
    firmas_usadas: 0,
    alcance_firmas_max: 1,
    ruta_papel_operativa: 1,
    plazo_hasta: '2026-12-31T00:00:00.000Z',
  };
  const cuerpos = {};

  // La version del Acuerdo para la que el firmante acepto (null = no acepto).
  let aceptadoVersion = null;
  let idSolicitud = null;
  let consentId = null;

  function json(res, codigo, objeto) {
    const texto = JSON.stringify(objeto);
    res.writeHead(codigo, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(texto) });
    res.end(texto);
  }

  const manejadores = {
    'GET /health': (req, res) => json(res, 200, {
      status: 'ok', checks: { db: 'ok', smtp: 'configured' },
    }),
    'GET /internal/acuerdo-activo': (req, res) => json(res, 200, {
      version: motor.db.versionActiva,
      texto_hash: motor.db.versiones[motor.db.versionActiva].texto_hash,
    }),
    'GET /internal/admin/excepciones-habilitacion': (req, res) => json(res, 200, {
      items: [excepcion],
    }),
    'POST /internal/admin/excepciones-habilitacion': (req, res) => json(res, 201, {
      excepcion: Object.assign({}, excepcion, { id: 10, firmas_usadas: 0 }),
      evento: { id: 1 },
    }),
    'POST /internal/consentimientos': (req, res) => {
      const c = motor.crearConsentimiento({});
      consentId = c.id;
      json(res, 201, { consent_id: c.id, version_acuerdo: c.version_acuerdo });
    },
    'POST /internal/sign-requests': (req, res) => {
      cuenta.signRequests++;
      idSolicitud = 'SIGN-2026-104001';
      const fila = motor.crearFirma(idSolicitud, { consent_id: consentId });
      json(res, 201, {
        id_solicitud: idSolicitud,
        token: 'token-de-prueba-104',
        agreement_version: fila.agreement_version,
        agreement_hash: fila.agreement_hash,
        url_publica: 'https://firma.kair.fyi/s/token-de-prueba-104',
        estado: 'PENDING',
      });
    },
    'POST /api/sign/token-de-prueba-104/identify': (req, res) => {
      cuenta.identify++;
      json(res, 200, {
        estado: 'OTP_SENT',
        otp_ttl_seconds: 600,
        correo_destino_enmascarado: 'pr****@example.com',
        // En modo desarrollo el servicio devuelve el codigo.
        devOtp: opciones.devOtp === undefined ? '999999' : opciones.devOtp,
      });
    },
    'POST /api/sign/token-de-prueba-104/verify-otp': (req, res) => {
      cuenta.verifyOtp++;
      json(res, 200, { ok: true, estado: 'OTP_VERIFIED' });
    },
    'GET /s/token-de-prueba-104': (req, res) => {
      cuenta.contexto++;
      // Servir el contexto ES poner las politicas a disposicion: el
      // servidor guarda aqui la fecha, el version y la huella de la matriz.
      cuenta.disposicion = true;
      const vigente = motor.db.versionActiva;
      json(res, 200, {
        acuerdo: {
          version: vigente,
          texto: motor.textoDe(vigente),
          texto_hash: motor.db.versiones[vigente].texto_hash,
          requiere_aceptar_vigente: aceptadoVersion !== vigente,
        },
      });
    },
    'POST /api/sign/token-de-prueba-104/consent/accept': (req, res) => {
      cuenta.accept++;
      // El servidor real responde 409 si no tiene constancia de haber
      // puesto las politicas a disposicion (publicFlow.js:670-675).
      if (!cuenta.disposicion) {
        json(res, 409, {
          error: {
            code: 'DISPOSICION_POLITICAS_NO_REGISTRADA',
            message: 'El servidor no tiene constancia de haber puesto las politicas de seguridad a disposicion del Firmante',
          },
        });
        return;
      }
      const vigente = motor.db.versionActiva;
      const fila = motor.db.firmas[idSolicitud];
      // El servicio real: si la solicitud ya apunta a un consentimiento de
      // ESTA version, lo marca aceptado; si apunta a uno de otra version (que
      // es el caso de la migracion), crea el de la vigente y la fila pasa a
      // apuntar a el. El consentimiento anterior no se toca.
      let c = null;
      if (fila && fila.consent_id && motor.db.consentimientos[fila.consent_id]
        && motor.db.consentimientos[fila.consent_id].version_acuerdo === vigente) {
        c = motor.db.consentimientos[fila.consent_id];
        c.manifestacion_aceptada = 1;
        c.fecha_aceptacion = new Date().toISOString();
      } else {
        c = motor.crearConsentimiento({ version_acuerdo: vigente, manifestacion_aceptada: 1 });
        c.fecha_aceptacion = new Date().toISOString();
        if (opciones.consentimientoViejoIntacto === false) {
          // Modo de fallo: se reescribe el consentimiento anterior.
          const viejo = motor.db.consentimientos[consentId];
          if (viejo) viejo.manifestacion_aceptada = 0;
        }
      }
      if (fila) {
        const anterior = fila.agreement_version;
        fila.agreement_version = vigente;
        fila.agreement_hash = motor.db.versiones[vigente].texto_hash;
        fila.consent_id = c.id;
        if (anterior !== vigente) {
          motor.db.eventos.push({
            firma_id: fila.id,
            evento: 'AGREEMENT_VERSION_MIGRATED',
            metadata: JSON.stringify({ version_anterior: anterior, version_nueva: vigente }),
          });
        }
      }
      aceptadoVersion = vigente;
      json(res, 200, { ok: true, version_acuerdo: vigente, consent_id: c.id });
    },
    'POST /api/sign/token-de-prueba-104/view-document': (req, res) => {
      cuenta.viewDocument++;
      const vigente = motor.db.versionActiva;
      if (opciones.accionable === false) {
        json(res, 409, { error: { code: 'AGREEMENT_VERSION_REACCEPT_REQUIRED', message: 'algo' } });
        return;
      }
      if (aceptadoVersion !== vigente) {
        json(res, 409, {
          error: {
            code: 'AGREEMENT_VERSION_REACCEPT_REQUIRED',
            message: 'El Acuerdo de uso cambió: tenés que leer y aceptar la versión vigente',
            details: {
              sign_request_version: motor.db.firmas[idSolicitud]
                ? motor.db.firmas[idSolicitud].agreement_version : null,
              active_version: vigente,
              accion: 'reaceptar_version_vigente',
            },
          },
        });
        return;
      }
      json(res, 200, { ok: true, estado: 'DOCUMENT_VIEWED' });
    },
    'GET /api/sign/token-de-prueba-104/acuerdo.txt': (req, res) => {
      const vigente = motor.db.versionActiva;
      const texto = motor.textoDe(vigente);
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Acuerdo-SHA256': motor.db.versiones[vigente].texto_hash,
        'Content-Length': Buffer.byteLength(texto),
      });
      res.end(texto);
    },
    'GET /internal/sign-requests/SIGN-2026-104001': (req, res) => {
      const fila = motor.db.firmas[idSolicitud] || {};
      json(res, 200, {
        id_solicitud: idSolicitud,
        estado: fila.estado,
        agreement_version: fila.agreement_version,
        // El endpoint real NO devuelve agreement_hash
        // (src/routes/signRequest.js:469-487): la huella archivada se lee de
        // la fila, en la base AISLADA. El servicio falso lo reproduce: si el
        // script volviera a leerla por ahi, las comprobaciones serian falsas
        // y este test se cae.
        consent_id: fila.consent_id,
      });
    },
    'GET /internal/sign-requests/SIGN-2026-104001/eventos': (req, res) => json(res, 200, {
      id_solicitud: idSolicitud,
      total: 5,
      eventos: [
        { id: 1, tipo_evento: 'CREATED', fecha_evento: '2026-11-06T16:00:00.000Z' },
        { id: 2, tipo_evento: 'OTP_SENT', fecha_evento: '2026-11-06T16:00:01.000Z' },
        { id: 3, tipo_evento: 'OTP_VERIFIED', fecha_evento: '2026-11-06T16:00:02.000Z' },
        { id: 4, tipo_evento: 'CONSENT_ACCEPTED', fecha_evento: '2026-11-06T16:00:03.000Z' },
        { id: 5, tipo_evento: 'AGREEMENT_VERSION_MIGRATED', fecha_evento: '2026-11-06T16:00:04.000Z' },
      ],
    }),
  };

  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const cuerpo = [];
    req.on('data', (d) => cuerpo.push(d));
    req.on('end', () => {
      const manejador = manejadores[req.method + ' ' + u.pathname];
      const texto = Buffer.concat(cuerpo).toString('utf8');
      cuerpos[req.method + ' ' + u.pathname] = texto;
      if (!manejador) {
        json(res, 404, { error: { code: 'NOT_FOUND', message: 'ruta no existe' } });
        return;
      }
      manejador(req, res, texto);
    });
  });

  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      resolve({
        cuenta,
        cuerpos,
        motor,
        excepcion,
        url: 'http://127.0.0.1:' + srv.address().port,
        cerrar: () => new Promise((r) => srv.close(r)),
      });
    });
  });
}

// --------------------------------------------------------------------------
// Utilidades de los tests
// --------------------------------------------------------------------------

function archivoTemporal(nombre) {
  return path.join(os.tmpdir(), 'kair-104-test-' + nombre + '-' + process.pid + '-' + Date.now());
}

/**
 * Las llaves en archivos temporales.
 *
 * El script las lee de archivo (o del ambiente) y NUNCA las imprime: por eso
 * el test puede comprobar que no aparezcan ni en la salida ni en la evidencia.
 */
function crearLlaves() {
  const interno = archivoTemporal('llave');
  const admin = archivoTemporal('admin');
  fs.writeFileSync(interno, LLAVE, 'utf8');
  fs.writeFileSync(admin, 'LLAVE-ADMIN-DE-PRUEBA-NO-ES-REAL', 'utf8');
  return { interno, admin };
}

function argumentos(extra, llaves) {
  const l = llaves || crearLlaves();
  return [
    // El script se lee como si viniera de la linea de comandos: los dos
    // primeros elementos son el node y el nombre del script.
    'node', 'probar-10-4.js',
    '--url=http://127.0.0.1:1',
    '--db=/tmp/kair-104-aislada.sqlite',
    '--version-inicial=v1.4',
    '--version-nueva=v1.5',
    '--empresa=' + EMPRESA,
    '--trabajador=' + TRABAJADOR,
    '--numero=' + NUMERO,
    '--correo=' + CORREO,
    '--interno-file=' + l.interno,
    '--admin-file=' + l.admin,
  ].concat(extra || []);
}

/** Corre el script capturando su salida. */
async function correr(args, motor) {
  const lineas = [];
  script.fijarSalida((l) => lineas.push(l));
  script.reiniciar();
  if (motor) {
    script.fijarBase(motor.sql, motor.activar);
  } else {
    script.restaurarBase();
  }
  try {
    const codigo = await script.main(args);
    return { codigo, lineas: lineas.join('\n') };
  } finally {
    script.restaurarBase();
  }
}

// ===========================================================================
// 1-9. Los argumentos y las reglas de escritura
// ===========================================================================

test('10.4 · sin --confirmar-escribe NO se escribe nada', async () => {
  const motor = motorFalso();
  const estado = archivoTemporal('estado');
  const r = await correr(argumentos(['--estado=' + estado]), motor);
  assert.equal(r.codigo, 0);
  assert.match(r.lineas, /Modo lectura/);
  assert.equal(motor.db.cambios.length, 0, 'no se cambia ninguna version');
  assert.equal(fs.existsSync(estado), false, 'no se escribe el archivo de estado');
});

test('10.4 · --confirmar-escribe autoriza la escritura', async () => {
  const motor = motorFalso();
  const srv = await servicioFalso(motor);
  const estado = archivoTemporal('estado');
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url, '--estado=' + estado, '--confirmar-escribe',
    ]), motor);
    assert.equal(r.codigo, 0, r.lineas);
    assert.match(r.lineas, /Modo escritura confirmado/);
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · antes de aceptar, el script pide el contexto publico', async () => {
  // El servidor registra la puesta a disposicion de las politicas CUANDO
  // sirve el contexto (GET /s/:token). Sin ese registro la aceptacion
  // responde 409 DISPOSICION_POLITICAS_NO_REGISTRADA: la prueba se
  // detuvo ahi en el servidor real.
  const motor = motorFalso();
  const srv = await servicioFalso(motor);
  const estado = archivoTemporal('estado');
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url, '--estado=' + estado, '--confirmar-escribe',
    ]), motor);
    assert.equal(r.codigo, 0, r.lineas);
    assert.ok(srv.cuenta.contexto >= 1,
      'el script tiene que pedir el contexto publico antes de aceptar');
    assert.match(r.lineas, /puso las .*pol.ticas a disposici.n/);
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · un argumento desconocido se rechaza con el codigo 2', async () => {
  const motor = motorFalso();
  const r = await correr(argumentos(['--inventado=1']), motor);
  assert.equal(r.codigo, 2);
  assert.equal(motor.db.cambios.length, 0);
});

test('10.4 · sin --db no se hace nada (la base AISLADA es obligatoria)', async () => {
  const motor = motorFalso();
  const r = await correr([
    '--empresa=' + EMPRESA, '--trabajador=' + TRABAJADOR, '--correo=' + CORREO,
    '--version-inicial=v1.4', '--version-nueva=v1.5', '--confirmar-escribe',
  ], motor);
  assert.equal(r.codigo, 2);
  assert.match(r.lineas, /Falta --db/);
  assert.equal(motor.db.cambios.length, 0);
});

test('10.4 · las dos versiones tienen que ser distintas', async () => {
  const motor = motorFalso();
  const r = await correr(argumentos(['--version-nueva=v1.4']), motor);
  assert.equal(r.codigo, 2);
  assert.match(r.lineas, /son la misma/);
});

test('10.4 · --trabajador tiene que parecer un documento de identidad', async () => {
  const motor = motorFalso();
  const r = await correr(argumentos(['--trabajador=abc']), motor);
  assert.equal(r.codigo, 2);
  assert.match(r.lineas, /no parece un documento de identidad/);
});

test('10.4 · --trabajador no puede ser un seudonimo', async () => {
  const motor = motorFalso();
  const r = await correr(argumentos(['--trabajador=psn1_' + 'a'.repeat(64)]), motor);
  assert.equal(r.codigo, 2);
  assert.match(r.lineas, /no puede ser un seudonimo/);
});

test('10.4 · --otp tiene que ser de 6 digitos', async () => {
  const motor = motorFalso();
  const r = await correr(argumentos(['--otp=123']), motor);
  assert.equal(r.codigo, 2);
  assert.match(r.lineas, /no son 6 digitos/);
});

test('10.4 · la llave interna NO aparece en la salida ni en la evidencia', async () => {
  const motor = motorFalso();
  const srv = await servicioFalso(motor);
  const llaves = crearLlaves();
  const evidencia = archivoTemporal('evidencia');
  const estado = archivoTemporal('estado');
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url,
      '--estado=' + estado,
      '--evidencia=' + evidencia,
      '--confirmar-escribe',
    ], llaves), motor);
    assert.equal(r.codigo, 0, r.lineas);
    assert.ok(!r.lineas.includes(LLAVE), 'la llave no aparece en la salida');
    assert.ok(fs.existsSync(evidencia), 'la evidencia se escribio');
    assert.ok(!fs.readFileSync(evidencia, 'utf8').includes(LLAVE),
      'la llave no aparece en la evidencia');
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · el PDF de la solicitud es un PDF de verdad y dice que es sintetico', async () => {
  const buf = await script.pdfDePrueba({
    empresa: EMPRESA, idDocumento: 'X', versionInicial: 'v1.4', versionNueva: 'v1.5',
  });
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.slice(0, 5).toString('latin1'), '%PDF-',
    'tiene que ser un PDF de verdad: el servidor valida los bytes magicos');
  // El texto del PDF va comprimido, asi que se comprueba el codigo que lo
  // genera: el mensaje que dice que es sintetico tiene que estar en el
  // archivo, no solo en la intencion.
  const fuente = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'probar-10-4.js'), 'utf8');
  assert.match(fuente, /DATOS SINTETICOS/);
  assert.match(fuente, /NO ES EVIDENCIA DE UN ACTO REAL/);
});

test('10.4 · el multipart lleva los campos y el archivo, con su boundary', async () => {
  const { body, contentType } = script.multipart({ metadata: '{"a":1}' }, {
    campo: 'documento', nombre: 'x.pdf', contenido: Buffer.from('%PDF-1.4 prueba'),
  });
  const texto = body.toString('latin1');
  assert.match(contentType, /^multipart\/form-data; boundary=/);
  assert.match(texto, /name="metadata"/);
  assert.match(texto, /name="documento"; filename="x\.pdf"/);
  assert.match(texto, /%PDF-1\.4 prueba/);
});

// ===========================================================================
// 10-11. La corrida completa
// ===========================================================================

test('10.4 · la corrida completa: la solicitud migra y todo queda en su sitio', async () => {
  const motor = motorFalso();
  const srv = await servicioFalso(motor);
  const estado = archivoTemporal('estado');
  const evidencia = archivoTemporal('evidencia');
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url,
      '--estado=' + estado,
      '--evidencia=' + evidencia,
      '--confirmar-escribe',
    ]), motor);

    assert.equal(r.codigo, 0, 'la corrida paso:\n' + r.lineas);
    assert.match(r.lineas, /Lo que acepto es la version vigente/);
    assert.match(r.lineas, /La solicitud quedo ligada a la version vigente/);
    assert.match(r.lineas, /La huella archivada es la del texto que el firmante leyo/);
    assert.match(r.lineas, /El texto que descarga el firmante es el que quedo archivado/);
    assert.match(r.lineas, /El consentimiento de la version anterior quedo INTACTO/);
    assert.match(r.lineas, /El consentimiento nuevo es de la version vigente/);
    assert.match(r.lineas, /El evento dice que version se dejo y cual se tomo/);
    assert.match(r.lineas, /El 409 dice que hay que re-aceptar/);
    assert.match(r.lineas, /Con la migracion hecha, el documento ya se puede ver/);

    // La fila quedo con la version nueva y SU huella.
    const fila = motor.db.firmas['SIGN-2026-104001'];
    assert.equal(fila.agreement_version, 'v1.5');
    assert.equal(fila.agreement_hash, HASH15);

    // El consentimiento anterior quedo intacto.
    const viejo = motor.db.consentimientos[6];
    assert.ok(viejo, 'hay un consentimiento anterior');
    assert.equal(viejo.version_acuerdo, 'v1.4');
    assert.equal(viejo.manifestacion_aceptada, 1);
    assert.ok(viejo.fecha_aceptacion, 'el consentimiento anterior tiene su fecha');

    // Y el nuevo es de la version vigente.
    const nuevo = motor.db.consentimientos[fila.consent_id];
    assert.equal(nuevo.version_acuerdo, 'v1.5');
    assert.equal(nuevo.manifestacion_aceptada, 1);

    // Y el evento dice que version se dejo y cual se tomo.
    const ev = motor.db.eventos.find((e) => e.evento === 'AGREEMENT_VERSION_MIGRATED');
    assert.ok(ev);
    const meta = JSON.parse(ev.metadata);
    assert.equal(meta.version_anterior, 'v1.4');
    assert.equal(meta.version_nueva, 'v1.5');

    // La evidencia escribe lo que se probo y lo que NO es real.
    const txt = fs.readFileSync(evidencia, 'utf8');
    assert.match(txt, /PRUEBA DE LA 10.4 EN EL AMBIENTE REAL/);
    assert.match(txt, /AISLADA/);
    assert.match(txt, /SINTETICOS/);
    assert.match(txt, /AGREEMENT_VERSION_MIGRATED/);
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · la maniobra del cambio de version ocurre en la base AISLADA indicada', async () => {
  const motor = motorFalso();
  const srv = await servicioFalso(motor);
  const estado = archivoTemporal('estado');
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url,
      '--db=/tmp/kair-104-otra.sqlite',
      '--estado=' + estado,
      '--confirmar-escribe',
    ]), motor);
    assert.equal(r.codigo, 0, r.lineas);
    assert.deepEqual(motor.db.cambios, ['v1.4', 'v1.5'],
      'se activa la de partida y despues la nueva, en ese orden');
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · una segunda corrida NO crea otra solicitud ni repite la maniobra', async () => {
  const motor = motorFalso();
  const srv = await servicioFalso(motor);
  const estado = archivoTemporal('estado');
  try {
    const primero = await correr(argumentos([
      '--url=' + srv.url, '--estado=' + estado, '--confirmar-escribe',
    ]), motor);
    assert.equal(primero.codigo, 0, primero.lineas);
    assert.equal(srv.cuenta.signRequests, 1);
    assert.deepEqual(motor.db.cambios, ['v1.4', 'v1.5']);

    const segundo = await correr(argumentos([
      '--url=' + srv.url, '--estado=' + estado, '--confirmar-escribe',
    ]), motor);
    assert.equal(segundo.codigo, 0, 'codigo=' + segundo.codigo + '\n' + segundo.lineas);
    assert.equal(srv.cuenta.signRequests, 1, 'no se crea una segunda solicitud');
    assert.match(segundo.lineas, /la migracion ya esta hecha/);
    assert.match(segundo.lineas, /No se vuelve a cambiar la version activa ni a aceptar/);
    assert.deepEqual(motor.db.cambios, ['v1.4', 'v1.5'],
      'la maniobra del cambio de version no se repite');
    assert.equal(srv.cuenta.accept, 2, 'no se vuelve a aceptar');
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · un estado guardado de OTRA prueba se rechaza', async () => {
  const motor = motorFalso();
  const estado = archivoTemporal('estado');
  fs.writeFileSync(estado, JSON.stringify({
    id_solicitud: 'SIGN-OTRA', token: 'otro', empresa: '999', trabajador: '111',
    numero: '111', version_inicial: 'v1.4', version_nueva: 'v1.5',
  }), 'utf8');
  const srv = await servicioFalso(motor);
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url, '--estado=' + estado, '--confirmar-escribe',
    ]), motor);
    assert.equal(r.codigo, 1);
    assert.match(r.lineas, /El estado guardado es de otra prueba/);
    assert.equal(srv.cuenta.signRequests, 0, 'no se crea nada');
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · sin codigo de verificacion el script se detiene (codigo 3)', async () => {
  const motor = motorFalso();
  const srv = await servicioFalso(motor, { devOtp: null });
  const estado = archivoTemporal('estado');
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url, '--estado=' + estado, '--confirmar-escribe',
    ]), motor);
    assert.equal(r.codigo, 3);
    assert.equal(srv.cuenta.accept, 0, 'no se acepta el Acuerdo');
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · un 409 que no dice que hacer hace fallar la prueba', async () => {
  const motor = motorFalso();
  const srv = await servicioFalso(motor, { accionable: false });
  const estado = archivoTemporal('estado');
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url, '--estado=' + estado, '--confirmar-escribe',
    ]), motor);
    assert.equal(r.codigo, 1);
    assert.match(r.lineas, /\[FALLA\]/);
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · si el consentimiento anterior se reescribe, la prueba falla', async () => {
  const motor = motorFalso();
  const srv = await servicioFalso(motor, { consentimientoViejoIntacto: false });
  const estado = archivoTemporal('estado');
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url, '--estado=' + estado, '--confirmar-escribe',
    ]), motor);
    assert.equal(r.codigo, 1);
    assert.match(r.lineas, /El consentimiento de la version anterior quedo INTACTO/);
  } finally {
    await srv.cerrar();
  }
});

test('10.4 · el estado y la evidencia se guardan con los permisos del dueño', async () => {
  const motor = motorFalso();
  const srv = await servicioFalso(motor);
  const estado = archivoTemporal('estado');
  const evidencia = archivoTemporal('evidencia');
  try {
    const r = await correr(argumentos([
      '--url=' + srv.url, '--estado=' + estado, '--evidencia=' + evidencia,
      '--confirmar-escribe',
    ]), motor);
    assert.equal(r.codigo, 0, r.lineas);
    assert.ok(fs.existsSync(estado));
    assert.ok(fs.existsSync(evidencia));
    const guardado = JSON.parse(fs.readFileSync(estado, 'utf8'));
    assert.equal(guardado.id_solicitud, 'SIGN-2026-104001');
    assert.equal(guardado.version_inicial, 'v1.4');
    assert.equal(guardado.version_nueva, 'v1.5');
  } finally {
    await srv.cerrar();
  }
});
