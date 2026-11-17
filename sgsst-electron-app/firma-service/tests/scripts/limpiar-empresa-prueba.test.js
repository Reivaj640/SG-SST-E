/**
 * Tests del script scripts/limpiar-empresa-prueba.js.
 *
 * QUE ES ESTE ARCHIVO Y POR QUE EXISTE
 * ------------------------------------
 * En produccion hay UNA sola Empresa: ASEPLUS CARIBE S.A.S. (NIT 900829731),
 * que se creo para ensayar el ciclo de suscripcion, verificacion del
 * representante y contrafirma. Con ella en la base, la primera Empresa REAL
 * hereda una ficha ajena, un client key vivo y cinco firmas de ensayo.
 *
 * Este archivo prueba que el script la borra COMPLETA y que no borra de mas:
 *
 *   1. La SIMULACION no toca nada (sin `--ejecutar`).
 *   2. La EJECUCION borra todas las filas de la empresa de prueba, en todas
 *      las tablas, incluidas las que SOLO se llegan por la cascada de FK
 *      (los eventos de las firmas, los eventos de los consentimientos, los
 *      eventos de las solicitudes).
 *   3. La EJECUCION deja intacta la otra empresa: sus filas, sus archivos y
 *      su client key.
 *   4. Los triggers append-only quedan PUESTOS (un DELETE manual sobre
 *      gh_firma_eventos tiene que seguir fallando) y las filas que ellos
 *      protegian se borraron igual.
 *   5. El RESPALDO existe y contiene lo que habia antes de borrar.
 *   6. El RECIBO queda escrito en la tabla append-only de purgas.
 *   7. `--hasta` se NEGA si hay algo mas nuevo que esa fecha, y no borra nada.
 *   8. Sin `--actor` o sin `--motivo` no se hace nada (codigo 2).
 *   9. Es idempotente: correrlo dos veces no rompe.
 *
 * Y las MUTACIONES matan los checks: si alguien degrada el script para que
 * no reponga los triggers, o no borre los archivos, o no haga el respaldo, o
 * borre de mas, estos tests se caen.
 *
 * LOS IDS SON REALES
 * ------------------
 * Las aserciones se anclan a los ids que creo el sembrado (IDS), no a
 * numeros sueltos: la base de pruebas no arranca en 1 en cada corrida, y un
 * check que apunta a un id fijo mediria otra fila.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { after } = require('node:test');

const { resetDb } = require('../helpers');
const db = require('../../src/db/connection');
const script = require('../../scripts/limpiar-empresa-prueba');

const SERVICE = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(SERVICE, 'scripts', 'limpiar-empresa-prueba.js');
const RAIZ_PDF = path.resolve(process.env.PDF_STORAGE_PATH);

const EMPRESA_PRUEBA = '900829731';
const EMPRESA_BONA = '900999999';

// ---------------------------------------------------------------------------
// Sembrar: el escenario real
// ---------------------------------------------------------------------------

/**
 * Inserta una fila y le da valor a las columnas NOT NULL que el llamador no
 * menciono, para que el sembrado no se rompa por una columna que no conozco.
 *
 * @param {object} conexion
 * @param {string} tabla
 * @param {object} valores
 * @returns {object} el resultado de run (con lastInsertRowid)
 */
function insertar(conexion, tabla, valores) {
  const info = conexion.prepare('PRAGMA table_info("' + tabla + '")').all();
  const nombres = info.map(c => c.name);
  const dados = {};
  for (const c of info) {
    if (c.pk) continue;
    if (c.notnull && c.dflt_value === null) {
      const tipo = (c.type || '').toUpperCase();
      dados[c.name] = tipo.includes('INT') ? 0 : 'X';
    }
  }
  Object.assign(dados, valores);
  const claves = Object.keys(dados).filter(k => nombres.includes(k));
  const st = conexion.prepare(
    'INSERT INTO "' + tabla + '" (' + claves.map(k => '"' + k + '"').join(', ') + ') VALUES ('
    + claves.map(() => '?').join(', ') + ')'
  );
  return st.run(...claves.map(k => dados[k]));
}

/**
 * Crea un archivo de prueba dentro del arbol de almacenamiento.
 * @param {string} relativo
 * @returns {string} la ruta absoluta
 */
function crearArchivo(relativo) {
  const p = path.join(RAIZ_PDF, relativo);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'PDF DE PRUEBA\n');
  return p;
}

let sembrado = false;

// Los ids que creo el sembrado: las aserciones se anclan a los ids REALES.
const IDS = {
  suscripcionesNube: [],
  suscripcionesEncargo: [],
  firmas: [],
  firmaBuena: null,
  consentimiento: null,
  consentimientoBuena: null,
  solicitud: null,
};

// Cada test necesita la base CON LA EMPRESA DE PRUEBA: la limpieza del test
// anterior se la llevo. Por eso el sembrado se rehace cada vez (es barato:
// la base de pruebas son 200 KB).
function sembrar() {
  // Los triggers de la corrida anterior todavia estan puestos (el resetDb de
  // los helpers solo baja los de gh_firma_eventos), y el resetDb borra filas:
  // hay que bajarlos ANTES de limpiar, o el reset se negaria.
  quitarTriggersAppendOnly();
  resetDb();
  // El resetDb de los helpers no limpia estas cuatro (tienen UNIQUE por
  // id_empresa), y el sembrado las vuelve a llenar.
  for (const t of ['gh_firma_empresas_cuenta_envio', 'gh_firma_empresas_auditoria',
    'gh_firma_fecha_terminacion', 'gh_firma_excepciones_habilitacion']) {
    try { db.prepare('DELETE FROM "' + t + '"').run(); } catch (e) { /* no existe */ }
  }
  sembrarFilas();
  sembrado = true;
}

function sembrarFilas() {

  // 1. Las dos empresas.
  insertar(db, 'gh_firma_empresas', {
    id_empresa: EMPRESA_PRUEBA,
    razon_social: 'ASEPLUS CARIBE S.A.S.',
    nit: '900829731',
    domicilio: 'Bogota D.C.',
    representante_legal: 'Lilia Maria Vasquez Munoz',
    activo: 1,
    anexo_encargo_firmado_at: '2026-11-12T16:14:31.105Z',
  });
  insertar(db, 'gh_firma_empresas', {
    id_empresa: EMPRESA_BONA,
    razon_social: 'OTRA EMPRESA S.A.S.',
    nit: '900999999',
    activo: 1,
  });

  // 2. Suscripciones de Anexo de Nube (2 de la de prueba, 1 de la buena).
  IDS.suscripcionesNube.push(insertar(db, 'gh_firma_anexo_nube_suscripciones', {
    id_empresa: EMPRESA_PRUEBA,
    token_hash: 'tok-nube-1',
    version: '1.4',
    hash_texto: 'a'.repeat(64),
    correo_firmante: 'jrf2011@live.com',
    nombre_firmante: 'Lilia Maria Vasquez Munoz',
    cargo_firmante: 'Representante legal',
    estado: 'FIRMADA',
    firmado_at: '2026-11-14T17:06:00.000Z',
    contrafirmado_at: '2026-11-14T17:19:00.000Z',
    created_at: '2026-11-14T17:00:00.000Z',
  }).lastInsertRowid);
  IDS.suscripcionesNube.push(insertar(db, 'gh_firma_anexo_nube_suscripciones', {
    id_empresa: EMPRESA_PRUEBA,
    token_hash: 'tok-nube-2',
    version: '1.4',
    hash_texto: 'b'.repeat(64),
    correo_firmante: 'jrf2011@live.com',
    estado: 'FIRMADA',
    firmado_at: '2026-11-14T17:10:00.000Z',
    created_at: '2026-11-14T17:05:00.000Z',
  }).lastInsertRowid);
  const nubeBuena = insertar(db, 'gh_firma_anexo_nube_suscripciones', {
    id_empresa: EMPRESA_BONA,
    token_hash: 'tok-nube-3',
    version: '1.4',
    hash_texto: 'c'.repeat(64),
    correo_firmante: 'otra@ejemplo.com',
    estado: 'FIRMADA',
    firmado_at: '2026-11-14T18:00:00.000Z',
    created_at: '2026-11-14T17:50:00.000Z',
  }).lastInsertRowid;
  insertar(db, 'gh_firma_anexo_nube_eventos', {
    id_suscripcion: IDS.suscripcionesNube[0], id_empresa: EMPRESA_PRUEBA,
    evento: 'CONTRAFIRMA_CODIGO_ENVIADO', fecha_hora: '2026-11-14T17:18:00.000Z',
  });
  insertar(db, 'gh_firma_anexo_nube_eventos', {
    id_suscripcion: IDS.suscripcionesNube[1], id_empresa: EMPRESA_PRUEBA,
    evento: 'SUSCRIPCION_FIRMADA', fecha_hora: '2026-11-14T17:10:00.000Z',
  });
  insertar(db, 'gh_firma_anexo_nube_eventos', {
    id_suscripcion: nubeBuena, id_empresa: EMPRESA_BONA,
    evento: 'SUSCRIPCION_FIRMADA', fecha_hora: '2026-11-14T18:00:00.000Z',
  });

  // 3. Suscripciones de Anexo de Encargo (2 de la de prueba, 1 de la buena).
  IDS.suscripcionesEncargo.push(insertar(db, 'gh_firma_anexo_encargo_suscripciones', {
    id_empresa: EMPRESA_PRUEBA,
    token_hash: 'tok-enc-1',
    version: '2026-11-11',
    hash_texto: 'd'.repeat(64),
    correo_firmante: 'jrf2011@live.com',
    nombre_firmante: 'Lilia Maria Vasquez Munoz',
    estado: 'FIRMADA',
    firmado_at: '2026-11-14T17:04:00.000Z',
    contrafirmado_at: '2026-11-14T17:19:00.000Z',
    created_at: '2026-11-14T17:00:00.000Z',
  }).lastInsertRowid);
  IDS.suscripcionesEncargo.push(insertar(db, 'gh_firma_anexo_encargo_suscripciones', {
    id_empresa: EMPRESA_PRUEBA,
    token_hash: 'tok-enc-2',
    version: '2026-11-11',
    hash_texto: 'e'.repeat(64),
    correo_firmante: 'jrf2011@live.com',
    estado: 'FIRMADA',
    firmado_at: '2026-11-14T17:08:00.000Z',
    created_at: '2026-11-14T17:02:00.000Z',
  }).lastInsertRowid);
  const encargoBuena = insertar(db, 'gh_firma_anexo_encargo_suscripciones', {
    id_empresa: EMPRESA_BONA,
    token_hash: 'tok-enc-3',
    version: '2026-11-11',
    hash_texto: 'f'.repeat(64),
    correo_firmante: 'otra@ejemplo.com',
    estado: 'FIRMADA',
    firmado_at: '2026-11-14T18:10:00.000Z',
    created_at: '2026-11-14T18:05:00.000Z',
  }).lastInsertRowid;
  insertar(db, 'gh_firma_anexo_encargo_eventos', {
    id_suscripcion: IDS.suscripcionesEncargo[0], id_empresa: EMPRESA_PRUEBA,
    evento: 'CONTRAFIRMADA', fecha_hora: '2026-11-14T17:19:00.000Z',
  });
  insertar(db, 'gh_firma_anexo_encargo_eventos', {
    id_suscripcion: encargoBuena, id_empresa: EMPRESA_BONA,
    evento: 'SUSCRIPCION_FIRMADA', fecha_hora: '2026-11-14T18:10:00.000Z',
  });

  // 4. Firmas: 5 de la empresa de prueba, 1 de la buena.
  const pdf1 = crearArchivo('firmados/prueba-1.pdf');
  const pdf2 = crearArchivo('firmados/prueba-2.pdf');
  const pdf3 = crearArchivo('firmados/prueba-3.pdf');
  const pdf4 = crearArchivo('firmados/prueba-4.pdf');
  const pdf5 = crearArchivo('firmados/prueba-5.pdf');
  const pdfBona = crearArchivo('firmados/buena.pdf');
  const constancia = crearArchivo('constancias/prueba-constancia.pdf');
  const constanciaBona = crearArchivo('constancias/buena-constancia.pdf');
  for (let i = 1; i <= 5; i++) {
    const id = insertar(db, 'gh_firmas_electronicas', {
      id_solicitud: 'SIGN-PRUEBA-' + i,
      id_documento: 'DOC-' + i,
      id_trabajador: 'CC-' + i,
      id_empresa: EMPRESA_PRUEBA,
      tipo_firma: 'remoto',
      estado: 'SIGNED',
      document_hash_original: '1'.repeat(64),
      document_hash_firmado: '2'.repeat(64),
      agreement_hash: '3'.repeat(64),
      evidence_hash: '4'.repeat(64),
      token_hash: 'tok-firma-' + i,
      fecha_creacion: '2026-11-14T10:0' + i + ':00.000Z',
      fecha_expiracion: '2026-11-15T10:0' + i + ':00.000Z',
      version_kair: '1.0',
      pdf_original_path: i === 1 ? pdf1 : null,
      pdf_firmado_path: i === 2 ? pdf2 : null,
      constancia_path: i === 3 ? constancia : null,
    }).lastInsertRowid;
    IDS.firmas.push(id);
    insertar(db, 'gh_firma_eventos', {
      firma_id: id, evento: 'FIRMADO', fecha_hora: '2026-11-14T10:0' + i + ':05.000Z',
      id_actor: 'sistema',
    });
    insertar(db, 'gh_firma_sesiones', {
      id: 'SES-PRUEBA-' + i, firma_id: id, estado_sesion: 'CERRADA',
      iniciado_en: '2026-11-14T10:0' + i + ':00.000Z',
      ultimo_cambio_en: '2026-11-14T10:0' + i + ':05.000Z',
    });
  }
  IDS.firmaBuena = insertar(db, 'gh_firmas_electronicas', {
    id_solicitud: 'SIGN-BONA-1',
    id_documento: 'DOC-B',
    id_trabajador: 'CC-B',
    id_empresa: EMPRESA_BONA,
    tipo_firma: 'remoto',
    estado: 'SIGNED',
    document_hash_original: '5'.repeat(64),
    agreement_hash: '6'.repeat(64),
    token_hash: 'tok-firma-buena',
    fecha_creacion: '2026-11-14T12:00:00.000Z',
    fecha_expiracion: '2026-11-15T12:00:00.000Z',
    version_kair: '1.0',
    pdf_original_path: pdfBona,
    constancia_path: constanciaBona,
  }).lastInsertRowid;
  insertar(db, 'gh_firma_eventos', {
    firma_id: IDS.firmaBuena, evento: 'FIRMADO',
    fecha_hora: '2026-11-14T12:00:05.000Z', id_actor: 'sistema',
  });

  // 5. Consentimientos (y sus eventos: se llegan solo por la cascada de FK).
  IDS.consentimiento = insertar(db, 'gh_consentimientos_firma', {
    id_trabajador: 'CC-1', id_empresa: EMPRESA_PRUEBA, version_acuerdo: 'v1.0',
    hash_texto_acuerdo: '7'.repeat(64), correo_verificacion: 'jrf2011@live.com',
    correo_hash: '8'.repeat(64), otp_hash: '9'.repeat(64), otp_sal: 'sal',
    kair_version: '1.0', fecha_aceptacion: '2026-11-14T10:02:00.000Z',
    estado: 'ACEPTADO',
  }).lastInsertRowid;
  insertar(db, 'gh_consentimientos_eventos', {
    consent_id: IDS.consentimiento, evento: 'ACEPTADO',
    fecha_hora: '2026-11-14T10:02:00.000Z',
  });
  IDS.consentimientoBuena = insertar(db, 'gh_consentimientos_firma', {
    id_trabajador: 'CC-B', id_empresa: EMPRESA_BONA, version_acuerdo: 'v1.0',
    hash_texto_acuerdo: '7'.repeat(64), correo_verificacion: 'otra@ejemplo.com',
    correo_hash: '8'.repeat(64), otp_hash: '9'.repeat(64), otp_sal: 'sal',
    kair_version: '1.0', fecha_aceptacion: '2026-11-14T12:02:00.000Z',
    estado: 'ACEPTADO',
  }).lastInsertRowid;
  insertar(db, 'gh_consentimientos_eventos', {
    consent_id: IDS.consentimientoBuena, evento: 'ACEPTADO',
    fecha_hora: '2026-11-14T12:02:00.000Z',
  });

  // 6. El hold que la retencion levanto sobre la primera firma.
  insertar(db, 'gh_firma_holds', {
    firma_id: IDS.firmas[0], motivo: 'deber_legal_conservacion', actor: 'sistema', activo: 1,
  });

  // 7. Los client key (la API key de cada Empresa atada al servicio).
  insertar(db, 'gh_internal_clients', {
    api_key_hash: 'hash-key-prueba', id_empresa: EMPRESA_PRUEBA,
    allowed_operations: 'sign_request:create', description: 'K+AIR empresa de prueba',
  });
  insertar(db, 'gh_internal_clients', {
    api_key_hash: 'hash-key-buena', id_empresa: EMPRESA_BONA,
    allowed_operations: 'sign_request:create', description: 'K+AIR empresa buena',
  });

  // 8. Solicitudes de titular (la peticion de firma del cliente) y sus eventos.
  IDS.solicitud = insertar(db, 'gh_solicitudes_titular', {
    id_empresa: EMPRESA_PRUEBA, id_trabajador: 'CC-1', estado: 'RESPONDIDA',
    fecha_creacion: '2026-11-14T09:00:00.000Z',
  }).lastInsertRowid;
  insertar(db, 'gh_solicitudes_titular_eventos', {
    solicitud_id: IDS.solicitud, evento: 'RESPUESTA', fecha_hora: '2026-11-14T09:30:00.000Z',
  });

  // 9. La auditoria de la ficha y la cuenta de envio.
  insertar(db, 'gh_firma_empresas_auditoria', {
    id_empresa: EMPRESA_PRUEBA, actor: 'admin', motivo: 'alta de prueba',
    fecha_hora: '2026-11-01T10:00:00.000Z',
  });
  insertar(db, 'gh_firma_empresas_cuenta_envio', {
    id_empresa: EMPRESA_PRUEBA, correo: 'privacidad.kair@gmail.com', tipo: 'PROTECCION_DATOS',
  });

  // 10. La fecha de terminacion y la excepcion de habilitacion.
  insertar(db, 'gh_firma_fecha_terminacion', {
    id_empresa: EMPRESA_PRUEBA, fecha_terminacion: '2026-12-04T14:01:43Z',
  });
  insertar(db, 'gh_firma_excepciones_habilitacion', {
    id_empresa: EMPRESA_PRUEBA, alcance: 2, estado: 'VIGENTE',
  });

  // 11. Los triggers append-only.
  //
  // La base de pruebas los borra a proposito (los helpers los quitan porque
  // los tests limpian esas tablas entre casos), pero en PRODUCCION estan
  // puestos: son los que impiden borrar un evento. Este test los pone, para
  // que el script se los encuentre y se los reponga.
  aplicarTriggersAppendOnly();
}

/**
 * Los triggers append-only que hay en produccion, tomados de las
 * migraciones que los crean (020, 055 y 057).
 * @returns {Array<{nombre: string, sql: string}>}
 */
function triggersDeLasMigraciones() {
  const migraciones = ['020_eventos_append_only.sql', '055_anexo_nube_eventos_append_only.sql',
    '057_anexo_encargo_eventos_append_only.sql'];
  const trigs = [];
  for (const m of migraciones) {
    const sql = fs.readFileSync(path.join(SERVICE, 'src', 'db', 'schema', m), 'utf8');
    const re = /CREATE TRIGGER IF NOT EXISTS ([\w]+)[\s\S]*?END;/g;
    let coincidencia;
    while ((coincidencia = re.exec(sql)) !== null) {
      trigs.push({ nombre: coincidencia[1], sql: coincidencia[0] });
    }
  }
  return trigs;
}

/**
 * Pone los triggers append-only que hay en produccion.
 * @returns {number} cuantos se pusieron
 */
function aplicarTriggersAppendOnly() {
  const trigs = triggersDeLasMigraciones();
  for (const t of trigs) db.exec(t.sql);
  return trigs.length;
}

/**
 * Los baja (los tests limpian esas tablas entre casos).
 * @returns {number} cuantos se bajaron
 */
function quitarTriggersAppendOnly() {
  const trigs = triggersDeLasMigraciones();
  for (const t of trigs) db.exec('DROP TRIGGER IF EXISTS ' + t.nombre);
  return trigs.length;
}

/**
 * Cuenta las filas de una Empresa en una tabla.
 * @param {string} tabla
 * @param {string} idEmpresa
 * @returns {number}
 */
function filasDe(tabla, idEmpresa) {
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM "' + tabla + '" WHERE id_empresa = ?').get(idEmpresa).n;
  } catch (e) {
    return -1;
  }
}

/**
 * Cuenta las filas de una tabla por otra columna.
 * @param {string} tabla
 * @param {string} columna
 * @param {number} valor
 * @returns {number}
 */
function filasPor(tabla, columna, valor) {
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM "' + tabla + '" WHERE "' + columna + '" = ?').get(valor).n;
  } catch (e) {
    return -1;
  }
}

/**
 * Los argumentos de una limpieza de verdad, sobre la base de pruebas.
 * @param {string[]} extra
 * @returns {string[]}
 */
function argsLimpieza(extra) {
  return [
    '--empresa=' + EMPRESA_PRUEBA,
    '--actor=Javier Robles Fontalvo',
    '--motivo=Empresa de prueba: se retira del servidor',
    '--db=' + process.env.DB_PATH,
    '--pdf-dir=' + RAIZ_PDF,
  ].concat(extra || []);
}

// ---------------------------------------------------------------------------
// La limpieza final
// ---------------------------------------------------------------------------
//
// Este archivo PONE los triggers append-only (en produccion estan). La base
// de pruebas es compartida con los demas archivos, y el `resetDb` de los
// helpers limpia tablas: si este archivo dejara los triggers puestos, el
// reset del archivo siguiente se negaria. Por eso se bajan al terminar.
after(() => {
  try { quitarTriggersAppendOnly(); } catch (_) { /* nada */ }
});

// ---------------------------------------------------------------------------
// Los checks
// ---------------------------------------------------------------------------

test('la simulacion no borra nada', () => {
  sembrar();
  const codigo = script.main([
    '--empresa=' + EMPRESA_PRUEBA,
    '--actor=Javier Robles Fontalvo',
    '--motivo=Empresa de prueba',
    '--silencioso',
  ]);
  assert.equal(codigo, 0, 'la simulacion tiene que salir con 0');
  assert.equal(filasDe('gh_firma_empresas', EMPRESA_PRUEBA), 1, 'la ficha sigue');
  assert.equal(filasDe('gh_firmas_electronicas', EMPRESA_PRUEBA), 5, 'las firmas siguen');
  assert.equal(filasDe('gh_firma_anexo_nube_suscripciones', EMPRESA_PRUEBA), 2, 'las suscripciones siguen');
});

test('sin --actor o sin --motivo no se hace nada', () => {
  sembrar();
  assert.equal(script.main(['--empresa=' + EMPRESA_PRUEBA, '--motivo=x']), 2);
  assert.equal(script.main(['--empresa=' + EMPRESA_PRUEBA, '--actor=x']), 2);
  assert.equal(filasDe('gh_firmas_electronicas', EMPRESA_PRUEBA), 5, 'no se toco nada');
});

test('la ejecucion borra TODO lo de la empresa de prueba', () => {
  sembrar();
  const codigo = script.main(argsLimpieza(['--ejecutar', '--silencioso']));
  assert.equal(codigo, 0, 'la limpieza tiene que salir con 0');

  // a) Las tablas que apuntan por id_empresa.
  for (const t of [
    'gh_firma_empresas',
    'gh_firma_anexo_nube_suscripciones',
    'gh_firma_anexo_nube_eventos',
    'gh_firma_anexo_encargo_suscripciones',
    'gh_firma_anexo_encargo_eventos',
    'gh_firmas_electronicas',
    'gh_consentimientos_firma',
    'gh_internal_clients',
    'gh_solicitudes_titular',
    'gh_firma_empresas_auditoria',
    'gh_firma_empresas_cuenta_envio',
    'gh_firma_fecha_terminacion',
    'gh_firma_excepciones_habilitacion',
  ]) {
    assert.equal(filasDe(t, EMPRESA_PRUEBA), 0, t + ' tiene que quedar en 0');
  }

  // b) Las tablas que SOLO se llegan por la cascada de FK.
  assert.equal(filasPor('gh_firma_eventos', 'firma_id', IDS.firmas[0]), 0,
    'los eventos de las firmas se borran');
  assert.equal(filasPor('gh_firma_sesiones', 'firma_id', IDS.firmas[0]), 0, 'las sesiones se borran');
  assert.equal(filasPor('gh_consentimientos_eventos', 'consent_id', IDS.consentimiento), 0,
    'los eventos del consentimiento se borran');
  assert.equal(filasPor('gh_solicitudes_titular_eventos', 'solicitud_id', IDS.solicitud), 0,
    'los eventos de la solicitud se borran');
  assert.equal(filasPor('gh_firma_holds', 'firma_id', IDS.firmas[0]), 0, 'el hold se borra');
});

test('la empresa buena no se toca', () => {
  sembrar();
  script.main(argsLimpieza(['--ejecutar', '--silencioso']));
  assert.equal(filasDe('gh_firma_empresas', EMPRESA_BONA), 1, 'la ficha de la otra sigue');
  assert.equal(filasDe('gh_firmas_electronicas', EMPRESA_BONA), 1, 'su firma sigue');
  assert.equal(filasDe('gh_firma_anexo_nube_suscripciones', EMPRESA_BONA), 1, 'su suscripcion sigue');
  assert.equal(filasDe('gh_consentimientos_firma', EMPRESA_BONA), 1, 'su consentimiento sigue');
  assert.equal(filasDe('gh_internal_clients', EMPRESA_BONA), 1, 'su client key sigue');
  assert.equal(filasPor('gh_firma_eventos', 'firma_id', IDS.firmaBuena), 1, 'su evento de firma sigue');
  assert.ok(fs.existsSync(path.join(RAIZ_PDF, 'firmados', 'buena.pdf')), 'su PDF sigue');
  assert.ok(fs.existsSync(path.join(RAIZ_PDF, 'constancias', 'buena-constancia.pdf')), 'su constancia sigue');
});

test('los archivos de la empresa de prueba se borran', () => {
  sembrar();
  script.main(argsLimpieza(['--ejecutar', '--silencioso']));
  assert.ok(!fs.existsSync(path.join(RAIZ_PDF, 'firmados', 'prueba-1.pdf')), 'el PDF de la firma 1 se borro');
  assert.ok(!fs.existsSync(path.join(RAIZ_PDF, 'firmados', 'prueba-2.pdf')), 'el PDF de la firma 2 se borro');
  assert.ok(!fs.existsSync(path.join(RAIZ_PDF, 'constancias', 'prueba-constancia.pdf')), 'la constancia se borro');
});

test('los triggers append-only quedan puestos', () => {
  sembrar();
  script.main(argsLimpieza(['--ejecutar', '--silencioso']));
  const trg = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='gh_firma_eventos'"
  ).all().map(r => r.name);
  assert.ok(trg.length > 0, 'los triggers de gh_firma_eventos tienen que seguir ahi');
  // Un DELETE manual de una fila QUE EXISTE tiene que ser rechazado: un
  // trigger BEFORE DELETE solo se dispara sobre una fila que se va a borrar.
  insertar(db, 'gh_firma_eventos', {
    firma_id: IDS.firmaBuena, evento: 'FIRMADO',
    fecha_hora: '2026-11-14T12:00:05.000Z', id_actor: 'sistema',
  });
  assert.throws(() => {
    db.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = ?').run(IDS.firmaBuena);
  }, 'un DELETE manual tiene que seguir siendo rechazado');
});

test('el respaldo existe y tiene lo que habia antes', () => {
  sembrar();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-respaldo-'));
  script.main(argsLimpieza(['--backup-dir=' + dir, '--ejecutar', '--silencioso']));
  const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.sqlite'));
  assert.equal(archivos.length, 1, 'tiene que haber un respaldo');
  const resp = path.join(dir, archivos[0]);
  assert.ok(fs.statSync(resp).size > 0, 'el respaldo no puede estar vacio');
  const Database = require(path.join(SERVICE, 'node_modules', 'better-sqlite3'));
  const copia = new Database(resp, { readonly: true });
  const n = copia.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas WHERE id_empresa = ?')
    .get(EMPRESA_PRUEBA).n;
  copia.close();
  assert.equal(n, 5, 'el respaldo tiene que tener las 5 firmas de antes');
});

test('el recibo queda escrito en la tabla append-only', () => {
  sembrar();
  script.main(argsLimpieza(['--ejecutar', '--silencioso']));
  const fila = db.prepare(
    "SELECT * FROM gh_firma_purga_log WHERE evento = 'LIMPIEZA_EMPRESA_PRUEBA' ORDER BY id DESC LIMIT 1"
  ).get();
  assert.ok(fila, 'tiene que haber recibo');
  assert.equal(fila.actor, 'Javier Robles Fontalvo');
  assert.equal(fila.motivo, 'Empresa de prueba: se retira del servidor');
});

test('--hasta se niega si hay algo mas nuevo, y no borra nada', () => {
  sembrar();
  const codigo = script.main(argsLimpieza(['--hasta=2020-01-01', '--ejecutar', '--silencioso']));
  assert.equal(codigo, 4, 'con algo mas nuevo el script tiene que negarse');
  assert.equal(filasDe('gh_firmas_electronicas', EMPRESA_PRUEBA), 5, 'no se borro nada');
});

test('es idempotente: correrlo otra vez no rompe', () => {
  sembrar();
  const args = argsLimpieza(['--ejecutar', '--silencioso']);
  assert.equal(script.main(args), 0);
  assert.equal(script.main(args), 0, 'la segunda corrida tambien sale con 0');
  assert.equal(filasDe('gh_firma_empresas', EMPRESA_PRUEBA), 0);
});

test('la corrida dice en la pantalla si borra o simula', () => {
  sembrar();
  // El defecto real (17-nov-2026, la ronda 24): la corrida con `--ejecutar`
  // imprimia el encabezado de SIMULACION y la frase "SIN --ejecutar no se
  // toca nada" justo antes de BORRAR 243 filas en produccion. La pantalla
  // decia una cosa y el script hacia otra.
  const sim = capturarSalida(() => {
    script.main(['--empresa=' + EMPRESA_PRUEBA,
      '--actor=Javier Robles Fontalvo', '--motivo=Prueba']);
  });
  assert.ok(sim.includes('(SIMULACION)'), 'la simulacion se anuncia como simulacion');
  assert.ok(sim.includes('no se toca nada'), 'la simulacion avisa que no toca nada');

  sembrar();
  const eje = capturarSalida(() => {
    script.main(argsLimpieza(['--ejecutar']));
  });
  assert.ok(eje.includes('(EJECUCION)'), 'la ejecucion se anuncia como ejecucion');
  assert.ok(!eje.includes('no se toca nada'),
    'la ejecucion NO puede decir que no se toca nada: esta borrando');
});

/**
 * Corre una funcion guardando lo que escribe en stdout.
 * @param {function} fn
 * @returns {string} lo escrito
 */
function capturarSalida(fn) {
  const original = process.stdout.write;
  let texto = '';
  process.stdout.write = function (chunk) { texto += chunk; return true; };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return texto;
}

// ---------------------------------------------------------------------------
// Las mutaciones: cada una tiene que MORIR
// ---------------------------------------------------------------------------

/**
 * Copia la base sembrada a un archivo temporal y corre el script (mutado o
 * no) como proceso aparte contra esa copia.
 *
 * @param {object} mutacion - {nombre, aplicar}
 * @returns {object} {codigo, base, dir}
 */
function correrEnCopia(mutacion) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-mutante-'));
  const base = path.join(dir, 'firma.sqlite');
  db.prepare('VACUUM INTO ?').run(base);

  let codigo = 0;
  const fuente = fs.readFileSync(SCRIPT, 'utf8');
  const destino = path.join(dir, 'mutado.js');
  const mutada = mutacion.aplicar(fuente);
  assert.notEqual(mutada, fuente, 'la mutacion tiene que cambiar el archivo');
  fs.writeFileSync(destino, mutada, 'utf8');
  try {
    execFileSync(process.execPath, [destino,
      '--empresa=' + EMPRESA_PRUEBA,
      '--actor=Mutante',
      '--motivo=Mutante',
      '--db=' + base,
      '--pdf-dir=' + RAIZ_PDF,
      '--backup-dir=' + path.join(dir, 'backups'),
      '--ejecutar',
      '--silencioso',
    ], {
      env: Object.assign({}, process.env, { FIRMA_APP_DIR: SERVICE }),
      stdio: 'pipe',
    });
    codigo = 0;
  } catch (e) {
    codigo = e.status === undefined ? 'error' : e.status;
    if (e.stderr) {
      process.stderr.write('[mutante] ' + e.stderr.toString().slice(0, 800) + '\n');
    }
  }
  return { codigo, base, dir };
}

test('MUTACION: si el script no repone los triggers, se detecta', () => {
  sembrar();
  const r = correrEnCopia({
    nombre: 'no repone los triggers',
    aplicar: (src) => src.replace(
      '  // 4. Los triggers vuelven, textualmente.\n  for (const trg of triggers) {\n    db.exec(trg.sql);\n  }',
      '  // MUTANTE: los triggers no se reponen'
    ),
  });
  const Database = require(path.join(SERVICE, 'node_modules', 'better-sqlite3'));
  const copia = new Database(r.base, { readonly: false });
  const trg = copia.prepare(
    "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='gh_firma_eventos'"
  ).all().map(x => x.name);
  copia.close();
  assert.ok(!trg.includes('trg_firma_eventos_no_delete'),
    'el mutante deja el trigger de BORRADO sin reponer (y el check lo ve)');
  assert.ok(trg.includes('trg_firma_eventos_no_update'),
    'el trigger de UPDATE nunca se quita (solo el de BORRADO se levanta)');
});

test('MUTACION: si el script no borra los archivos, se detecta', () => {
  sembrar();
  correrEnCopia({
    nombre: 'no borra los archivos',
    aplicar: (src) => src.replace(
      '      fs.unlinkSync(a.ruta);',
      '      /* MUTANTE: no borra */'
    ),
  });
  assert.ok(fs.existsSync(path.join(RAIZ_PDF, 'firmados', 'prueba-1.pdf')),
    'el mutante deja el archivo (y el check lo ve)');
});

test('MUTACION: si el script no hace respaldo, se detecta', () => {
  sembrar();
  const r = correrEnCopia({
    nombre: 'no hace respaldo',
    aplicar: (src) => src.replace(
      '  const respaldo = respaldar(db, destino);',
      '  const respaldo = destino; // MUTANTE: no hace el respaldo'
    ),
  });
  const dir = path.join(r.dir, 'backups');
  const hay = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  assert.equal(hay.length, 0, 'el mutante no deja respaldo (y el check lo ve)');
});

test('MUTACION: si el script borra de mas, se detecta', () => {
  sembrar();
  const r = correrEnCopia({
    nombre: 'borra de mas',
    aplicar: (src) => src.replace(
      "      const res = db.prepare('DELETE FROM \"' + t + '\" WHERE \"' + ident.col + '\" IN (' + filtro + ')').run(...ids);",
      "      const res = db.prepare('DELETE FROM \"' + t + '\" WHERE \"' + ident.col + '\" IN (' + filtro + ') OR 1=1').run(...ids);"
    ),
  });
  const Database = require(path.join(SERVICE, 'node_modules', 'better-sqlite3'));
  const copia = new Database(r.base, { readonly: true });
  const n = copia.prepare('SELECT COUNT(*) AS n FROM gh_firma_empresas WHERE id_empresa = ?')
    .get(EMPRESA_BONA).n;
  copia.close();
  assert.equal(n, 0, 'el mutante borro la empresa buena (y el check lo ve)');
});
