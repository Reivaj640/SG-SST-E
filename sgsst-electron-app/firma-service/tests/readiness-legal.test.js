/**
 * Tests de la auditoría de readiness legal (Etapa 1).
 *
 * Qué se fija acá:
 *   - La detección de placeholders y marcas de borrador.
 *   - Los análisis de los tres documentos legales.
 *   - Que el gate de publicación NO exija D-02, Anexo de Nube ni Anexo base.
 *   - Que el gate de primera firma SÍ los exija.
 *   - Que el reporte no invente datos: con un manifiesto vacío, todo queda
 *     pendiente y con una acción concreta.
 *
 * Los textos son sintéticos. No se usan datos de trabajadores ni de empresas.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const readiness = require('../src/services/readinessLegal');
const { analizarTextoLegal, listarPlaceholders } = require('../src/utils/textoLegal');
// La version del Anexo de Nube vigente la decide el modulo que suscribe. Un
// test que la fija como constante no comprueba el documento: comprueba la
// constante (PROMPT.md §5.19 y la trampa 136).
const VERSION_MODELO_NUBE = require('../src/services/anexoNube').VERSION_MODELO;
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const CONFIG_TEST = {
  env: 'test',
  canalProteccionDatos: 'privacidad@example.com',
  canalIncidentes: 'seguridad@example.com',
  plazoTramiteDias: 2,
  exigirMedioPersonalOtp: false,
  exigirAnexoNube: false,
};

// El Anexo que se FIRMA no lleva el aviso de "no firmar": un documento que
// dice "no firmar" no se firma (lo bloquea el marcador `NO_FIRMAR`). El aviso
// es del MODELO, y el modelo es el que tiene datos pendientes.
const NUBE_OK = [
  'Artículo 2.2.4.6.13 del Decreto 1072 de 2015.',
  'Veinte (20) años.',
  'Hold sin término del contrato electrónico.',
  'Dos (2) días hábiles.',
  'Cloudflare y Google.',
  'DPA / Acuerdo de Tratamiento de Datos.',
  'RTO 4 horas. RPO 1 hora.',
  'Devolución y supresión.',
  'Auditoría del Encargado.',
  'Derechos del Titular.',
  'Transferencia internacional.',
].join('\n');

const ENCARGO_OK = [
  'Anexo de Nube.',
  'Cláusula de otrosí.',
  'Artículo 2.2.4.6.13 del Decreto 1072 de 2015.',
  'Veinte (20) años.',
  'Servicio en nube: firma-service.',
].join('\n');

// El Acuerdo v1.3. El control textual del 8.6 mira el TEXTO, y lo que tiene que
// encontrar es la regla nueva: el piso de veinte (20) años desde el cese (8.6(b)),
// la tabla supletoria de conservación que administra K+AIR a falta de plazo
// declarado (8.6(a) y 8.6(h)), y la ausencia de retención indefinida.
const ACUERDO_OK = [
  'Versión del Acuerdo: v1.1',
  'Veinte (20) años.',
  'Hold sin término del contrato electrónico.',
  'Dos (2) días hábiles.',
  'Artículo 2.2.4.6.13 del Decreto 1072 de 2015.',
  // 8.6(b): el piso legal, contado desde el cese.
  'Los registros del SG-SST enumerados en el artículo 2.2.4.6.13 del Decreto 1072 de 2015 '
    + 'se conservan como mínimo veinte (20) años contados desde el cese de la relación laboral.',
  // 8.6(a): la precedencia.
  'El plazo de conservación se determina por categoría documental: primero por las reglas '
    + 'legales especiales, que no pueden rebajarse; luego por la tabla de retención documental '
    + 'de la Empresa; y a falta de plazo declarado por la Empresa, por la tabla supletoria de '
    + 'conservación que administra K+AIR.',
  // 8.6(h): no hay retención indefinida, y la tabla supletoria es configurable con
  // fundamento y punto de inicio, sin recalcular históricos.
  'No hay retención indefinida.',
  'La tabla supletoria es configurable: cada regla que la integra ha de tener un fundamento y '
    + 'un punto de inicio desde el que corre. Un cambio en esa tabla no altera los plazos ya '
    + 'calculados: un recálculo exige una operación expresa, autorizada y auditada.',
].join('\n');

// El mismo Acuerdo SIN la tabla supletoria: el piso de veinte (20) años está, pero
// no la regla que da un plazo por defecto a falta de plazo declarado.
const ACUERDO_SIN_H = [
  'Versión del Acuerdo: v1.1',
  'Veinte (20) años.',
  'Hold sin término del contrato electrónico.',
  'Dos (2) días hábiles.',
  'Artículo 2.2.4.6.13 del Decreto 1072 de 2015.',
  'Los registros del SG-SST enumerados en el artículo 2.2.4.6.13 del Decreto 1072 de 2015 '
    + 'se conservan como mínimo veinte (20) años contados desde el cese de la relación laboral.',
].join('\n');

// El Acuerdo v1.2: todavía promete el hold por plazo no declarado. La v1.3 lo
// eliminó, así que este texto tiene que FALLAR el control. Es el control de
// AUSENCIA del D1: un texto que conserva la frase vieja no puede pasar.
const ACUERDO_CON_HOLD_VIEJO = [
  'Versión del Acuerdo: v1.1',
  'Veinte (20) años.',
  'Hold sin término del contrato electrónico.',
  'Dos (2) días hábiles.',
  'Artículo 2.2.4.6.13 del Decreto 1072 de 2015.',
  'Los registros del SG-SST enumerados en el artículo 2.2.4.6.13 del Decreto 1072 de 2015 '
    + 'se conservan como mínimo veinte (20) años contados desde el cese de la relación laboral.',
  'Si la Empresa no declara un plazo para una categoría documental, el registro no se suprime: '
    + 'el sistema lo retiene con un hold por plazo no declarado, deja constancia del pendiente '
    + 'y lo reporta a la Empresa.',
].join('\n');

function manifiestoCompleto() {
  return {
    version: 'test',
    acuerdo: {
      v1_1_archivo: 'scripts/fixtures/acuerdo-v1.1.txt',
      v1_1_hash: readiness._internos._hash(ACUERDO_OK),
      v1_1_fecha: '2026-10-23',
      publicado: true,
    },
    encargado: {
      nit: '900123456-7',
      representante_legal: 'Representante de Prueba',
      domicilio: 'Bogotá D.C., Colombia',
      canal_proteccion_datos: 'privacidad@example.com',
      canal_confirmado: true,
      responsable_datos: 'Área de Privacidad',
      url_politica: 'https://example.com/privacidad',
      url_anexo_encargo: 'https://example.com/anexo-encargo',
    },
    infraestructura: {
      ubicacion_servidor: 'Bogotá D.C., Colombia',
      respaldos: 'Responsable de respaldos',
      monitoreo: 'Responsable de monitoreo',
      soporte: 'Responsable de soporte',
      seguridad_fisica: 'Proveedor de datacenter',
      rto_horas: 4,
      rpo_horas: 1,
      plan_continuidad: 'plan-001.pdf',
    },
    subencargados: {
      cloudflare: {
        dpa: true,
        version: '2026-01',
        fecha: '2026-10-23',
        devolucion_supresion: true,
        auditoria: true,
        evidencia: 'dpa-cloudflare.pdf',
      },
      // 📦1047 El proveedor de CORREO. Con la cuenta de Workspace y el CDPA
      // incorporado al Acuerdo, Google interviene como Subencargado de los
      // datos del servicio de correo: el item exige el vinculo, su vigencia,
      // la evidencia de la aceptacion por la cuenta y sus clausulas.
      mail_provider: {
        proveedor: 'Google Ireland Limited',
        servicio: 'Google Workspace',
        cuenta: 'workspace',
        rol: 'subencargado',
        dpa: true,
        version: 'CDPA',
        fecha: '2026-10-30',
        devolucion_supresion: true,
        auditoria: true,
        evidencia: 'cdpa-workspace.html',
        // 📦1047 · P1 La aceptacion del CDPA tiene que decir COMO se acepta:
        // el modo, la fecha y la evidencia del modo. Un `aceptada: true` sin
        // modo es una afirmacion sin respaldo, y el item no lo habilita.
        aceptacion: {
          aceptada: true,
          modo: 'incorporado_por_referencia',
          fecha: '2026-11-10',
          evidencia: 'El CDPA esta incorporado al Acuerdo (evidencia de prueba).',
          cuenta: 'gesstiar.com (Google Workspace)',
          at_testacion: 'Atestacion escrita del owner (prueba).',
          acuerdo: {
            url: 'https://workspace.google.com/terms/premier_terms/?hl=en',
            hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            bytes: 467263,
            descargado: '2026-11-10',
          },
          cdpa: {
            url: 'https://admin.google.com/terms/apps/8/1/en/dpa_terms.html',
            hash: '0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1',
            bytes: 97831,
            descargado: '2026-11-10',
          },
        },
      },
    },
    // 📦1047 La firma del Anexo de Encargo tambien se contrasta con el texto
    // vigente: el manifiesto declara la huella del archivo que el servidor
    // lee, y una firma de otra version no describe ese texto.
    anexo_encargo: {
      estado: 'firmado',
      fecha: '2026-10-21',
      evidencia: 'anexo-encargo-firmado.pdf',
      // 📦1047 · punto 3 · P7 La FACULTAD acreditada de quien contrafirma por
      // Gesstiar: sin ella, el item estado_encargo NO puede quedar ok.
      contrafirma_facultad: {
        resultado: 'REPRESENTANTE_LEGAL_ENCARGADO',
        nombre: 'Javier Robles Fontalvo',
        cargo: 'Representante Legal',
        tipo: 'REPRESENTACION',
        instrumento_ref: 'Representante legal declarado en el manifiesto legal',
        instrumento_sha256: null,
        id_poder: null,
        verificado_at: '2026-10-21',
      },
      version: '2026-10-21',
      hash: readiness._internos._hash(ENCARGO_OK),
    },
    // 📦1047 La suscripcion tiene que ser del TEXTO VIGENTE. El manifiesto
    // declara el modelo (version y huella) y la suscripcion se compara
    // contra el: sin esa comparacion, publicar la v1.2 dejaba el item en ok
    // citando la suscripcion de la v1.1.
    anexo_nube: {
      firmado: true,
      fecha: '2026-10-23',
      version: VERSION_MODELO_NUBE,
      hash: readiness._internos._hash(NUBE_OK),
      evidencia: 'anexo-nube-firmado.pdf',
      // 📦1047 · punto 3 El Anexo de Nube es bilateral (el texto vigente, §10):
      // lo susceptibility la Empresa (primer acto) y lo contrafirma K+AIR
      // (segundo acto). El item contrafirma_nube mide el segundo.
      contrafirmado: true,
      contrafirma_fecha: '2026-10-24',
      contrafirma_actor: 'kair',
      contrafirma_motivo: 'Contrafirma de prueba.',
      contrafirma_evidencia: 'anexo-nube-contrafirmado.pdf',
      // 📦1047 · punto 3 · P7 La FACULTAD acreditada de quien contrafirma por
      // Gesstiar. Sin ella, el item contrafirma_nube NO puede quedar ok: el
      // segundo acto tiene que decir con que poder se firmo.
      contrafirma_facultad: {
        resultado: 'REPRESENTANTE_LEGAL_ENCARGADO',
        nombre: 'Javier Robles Fontalvo',
        cargo: 'Representante Legal',
        tipo: 'REPRESENTACION',
        instrumento_ref: 'Representante legal declarado en el manifiesto legal',
        instrumento_sha256: null,
        id_poder: null,
        verificado_at: '2026-10-24',
      },
      modelo: {
        version: VERSION_MODELO_NUBE,
        hash: readiness._internos._hash(NUBE_OK),
        bytes: NUBE_OK.length,
      },
    },
    n9a: { probada: true, evidencia: 'prueba-9a.txt' },
    n10_4: { probada: true, evidencia: 'prueba-10-4.txt' },
    d03: { probada: true, evidencia: 'prueba-d03.txt' },
    token_unico: { probada: true, evidencia: 'prueba-token.txt' },
    d02: { inventario_buzones: 0, inventario_evidencia: 'inventario.txt' },
    pqrs: { canal: 'pqrs@example.com', responsable: 'Área de PQRS', plazo_dias: 2 },
  };
}

test('textoLegal · detecta corchetes y marcas prohibidas', () => {
  const analisis = analizarTextoLegal(
    'Versión v1.1 con [URL] y [ciudad, país]. ACUERDO DEV. Revisión profesional pendiente.',
  );
  assert.equal(analisis.ok, false);
  assert.equal(analisis.placeholders.total, 2);
  assert.deepEqual(
    analisis.marcadores.map((m) => m.codigo).sort(),
    ['ACUERDO_DEV', 'REVISION_PENDIENTE'],
  );
});

test('textoLegal · un texto limpio no tiene placeholders', () => {
  const analisis = analizarTextoLegal('Texto completo, sin corchetes.');
  assert.equal(analisis.ok, true);
  assert.equal(analisis.placeholders.total, 0);
  assert.deepEqual(analisis.marcadores, []);
});

test('textoLegal · lista placeholders únicos y su total', () => {
  const p = listarPlaceholders('[URL] [URL] [ciudad, país]');
  assert.equal(p.total, 3);
  assert.deepEqual(p.unicos.sort(), ['[URL]', '[ciudad, país]'].sort());
});

test('readiness · Anexo de Nube completo pasa', () => {
  const r = readiness.analizarAnexoNube(NUBE_OK);
  assert.equal(r.ok, true);
  assert.equal(r.faltan.length, 0);
  assert.equal(r.placeholders.total, 0);
});

test('readiness · Anexo de Nube con placeholder no pasa', () => {
  const r = readiness.analizarAnexoNube(NUBE_OK + '\n[NIT]');
  assert.equal(r.ok, false);
  assert.equal(r.placeholders.total, 1);
});

test('readiness · un Anexo con datos pendientes TIENE que advertir que no se firme', () => {
  // El aviso no es una cláusula del documento final: es el aviso del modelo.
  // Si el documento tiene huecos y no lo dice, alguien lo diligencia a mano y
  // se lleva un documento con huecos sin la advertencia.
  const r = readiness.analizarAnexoNube(NUBE_OK + '\n[NIT]');
  assert.ok(
    r.faltan.some((f) => f.id === 'aviso_sin_datos'),
    `faltan: ${JSON.stringify(r.faltan.map((f) => f.id))}`,
  );
  assert.equal(r.ok, false);
});

test('readiness · un Anexo con el aviso de no firmar NO se puede firmar', () => {
  // La direccion contraria: un documento completo que todavia dice "no
  // firmar" tampoco se firma.
  const r = readiness.analizarAnexoNube(NUBE_OK + '\nNO FIRMAR HASTA COMPLETAR LOS DATOS');
  assert.equal(r.placeholders.huecos.total, 0);
  assert.ok(
    r.marcadores.some((m) => m.codigo === 'NO_FIRMAR'),
    `marcadores: ${JSON.stringify(r.marcadores.map((m) => m.codigo))}`,
  );
  assert.equal(r.ok, false);
});

test('readiness · Anexo de Nube sin una cláusula la reporta', () => {
  const r = readiness.analizarAnexoNube('NO FIRMAR HASTA COMPLETAR LOS DATOS\nCloudflare');
  assert.equal(r.ok, false);
  assert.ok(r.faltan.some((f) => f.id === 'devolucion'));
  assert.ok(r.faltan.some((f) => f.id === 'auditoria'));
});

test('readiness · Anexo de Encargo completo y sin revisión pendiente pasa', () => {
  const r = readiness.analizarAnexoEncargo(ENCARGO_OK);
  assert.equal(r.clausulasOk, true);
  assert.equal(r.faltan.length, 0);
});

test('readiness · Anexo de Encargo con revisión pendiente no pasa', () => {
  const r = readiness.analizarAnexoEncargo(ENCARGO_OK + '\nRevisión profesional pendiente');
  assert.equal(r.clausulasOk, false);
});

test('readiness · Acuerdo v1.1 completo pasa', () => {
  const r = readiness.analizarAcuerdo(ACUERDO_OK, 'v1.1');
  assert.equal(r.ok, true);
  assert.equal(r.faltan.length, 0);
});

test('readiness · un acuerdo con placeholders no pasa', () => {
  const r = readiness.analizarAcuerdo(ACUERDO_OK + '\n[URL]', 'v1.1');
  assert.equal(r.ok, false);
  assert.equal(r.placeholders.total, 1);
});

test('readiness · el gate de publicación no exige D-02 ni Anexo de Nube', () => {
  const r = readiness.evaluar({
    gate: 'publicacion',
    db: null,
    config: CONFIG_TEST,
    manifiesto: { version: 'test' },
    textos: { acuerdoV11: null, anexoNube: null, anexoEncargo: null },
  });
  const grupos = new Set(r.bloqueantes.map((b) => b.grupo));
  assert.ok(grupos.has('acuerdo_v1_1'));
  assert.ok(grupos.has('n9a'));
  assert.ok(grupos.has('n10_4'));
  assert.ok(grupos.has('d03'));
  assert.ok(grupos.has('n86'));
  assert.ok(grupos.has('pqrs'));
  assert.equal(grupos.has('d02'), false);
  assert.equal(grupos.has('anexo_nube'), false);
  assert.equal(grupos.has('anexo_encargo'), false);
  assert.equal(r.listo, false);
});

test('readiness · el gate de primera firma sí exige D-02 y Anexo de Nube', () => {
  const r = readiness.evaluar({
    gate: 'primera_firma',
    db: null,
    config: CONFIG_TEST,
    manifiesto: { version: 'test' },
    textos: { acuerdoV11: null, anexoNube: null, anexoEncargo: null },
  });
  const grupos = new Set(r.bloqueantes.map((b) => b.grupo));
  assert.ok(grupos.has('d02'));
  assert.ok(grupos.has('anexo_nube'));
  assert.ok(grupos.has('anexo_encargo'));
  assert.equal(r.listo, false);
});

test('readiness · un manifiesto completo no inventa lo que falta en la base', () => {
  const r = readiness.evaluar({
    gate: 'publicacion',
    db: null,
    config: CONFIG_TEST,
    manifiesto: manifiestoCompleto(),
    textos: {
      acuerdoV11: ACUERDO_OK,
      anexoNube: NUBE_OK,
      anexoEncargo: ENCARGO_OK,
    },
  });
  assert.equal(r.documentos.acuerdo_v1_1.clausulas_ok, true);
  assert.equal(r.documentos.anexo_nube.clausulas_ok, true);
  assert.equal(r.documentos.anexo_encargo.clausulas_ok, true);
  // Sin conexión a SQLite, los items de tablas siguen pendientes: el reporte
  // no puede afirmar que existen.
  const idsPendientes = r.pendientes.map((p) => p.id);
  assert.ok(idsPendientes.includes('tablas_9a'));
  assert.ok(idsPendientes.includes('tablas_d03'));
  assert.ok(!idsPendientes.includes('nit_encargado'));
  assert.ok(!idsPendientes.includes('canal_datos'));
});

// El control `codigo_20` es TEXTUAL sobre el texto del Acuerdo: verifica lo
// que la v1.2 dice, no un literal del código.

test('readiness · el control codigo_20 pasa con el 8.6(b) y el 8.6(h) en el texto', () => {
  const r = readiness.evaluar({
    gate: 'publicacion',
    db: null,
    config: CONFIG_TEST,
    manifiesto: manifiestoCompleto(),
    textos: {
      acuerdoV11: ACUERDO_OK,
      anexoNube: NUBE_OK,
      anexoEncargo: ENCARGO_OK,
    },
  });
  const idsPendientes = r.pendientes.map((p) => p.id);
  assert.ok(
    !idsPendientes.includes('codigo_20'),
    'el texto dice el piso de veinte (20) años desde el cese y la retención por '
      + 'plazo no declarado: el control tiene que pasar'
  );
});

test('readiness · MUTACION: sin la tabla supletoria el control codigo_20 queda pendiente', () => {
  // Si el control se limitara a buscar "veinte (20) años", este texto (que lo
  // tiene) pasaría. El control tiene que exigir ALSO la regla que da el plazo
  // por defecto a falta de plazo declarado.
  const r = readiness.evaluar({
    gate: 'publicacion',
    db: null,
    config: CONFIG_TEST,
    manifiesto: manifiestoCompleto(),
    textos: {
      acuerdoV11: ACUERDO_SIN_H,
      anexoNube: NUBE_OK,
      anexoEncargo: ENCARGO_OK,
    },
  });
  const item = r.pendientes.find((p) => p.id === 'codigo_20');
  assert.ok(item, 'sin la tabla supletoria el control tiene que quedar pendiente');
  assert.match(item.detalle, /tabla supletoria/);
  assert.match(item.detalle, /retenci[oó]n indefinida/);
});

test('readiness · AUSENCIA: un texto que todavia promete el hold por plazo no declarado NO pasa', () => {
  // Este es el control de ausencia del D1. La v1.3 elimino la retencion
  // indefinida: un texto que conserve la frase vieja esta prometiendo un
  // mecanismo que el codigo ya no tiene, y tiene que fallar.
  const r = readiness.evaluar({
    gate: 'publicacion',
    db: null,
    config: CONFIG_TEST,
    manifiesto: manifiestoCompleto(),
    textos: {
      acuerdoV11: ACUERDO_CON_HOLD_VIEJO,
      anexoNube: NUBE_OK,
      anexoEncargo: ENCARGO_OK,
    },
  });
  const item = r.pendientes.find((p) => p.id === 'codigo_20');
  assert.ok(item, 'el texto que aun promete el hold viejo tiene que quedar pendiente');
  assert.match(item.detalle, /hold por plazo no declarado/);
  assert.match(item.detalle, /reporte del plazo pendiente/);
});

test('readiness · el reporte de texto incluye el gate y el estado', () => {
  const r = readiness.evaluar({
    gate: 'publicacion',
    db: null,
    config: CONFIG_TEST,
    manifiesto: { version: 'test' },
    textos: { acuerdoV11: null, anexoNube: null, anexoEncargo: null },
  });
  const texto = readiness.generarReporteTexto(r);
  assert.match(texto, /Gate: publicacion/);
  assert.match(texto, /NO LISTO/);
  assert.match(texto, /no publica, no firma/);
});

test('readiness · analizarAnexos devuelve los tres documentos', () => {
  const r = readiness.analizarAnexos({
    manifiesto: { version: 'test' },
    textos: {
      acuerdoV11: ACUERDO_OK,
      anexoNube: NUBE_OK,
      anexoEncargo: ENCARGO_OK,
    },
  });
  assert.equal(r.acuerdo_v1_1.ok, true);
  assert.equal(r.anexo_nube.ok, true);
  assert.equal(r.anexo_encargo.clausulasOk, true);
  assert.ok(r.anexo_nube.hash.length === 64);
});

test('readiness · la tabla de solicitudes del Titular se detecta con el SQL real de la 028', () => {
  // El nombre de la tabla lo decide la migración 028: `gh_solicitudes_titular`,
  // SIN el prefijo `firma_`, porque esa tabla no cuelga de ninguna firma (la
  // 5B no la alcanza). El check tiene que buscar ese nombre exacto: si
  // busca `gh_firma_solicitudes_titular` no lo encuentra nunca, y el reporte
  // pide "aplicar las migraciones 028/029" cuando ya estan aplicadas.
  // Este test aplica el SQL de la migración, no una copia a mano: si alguien
  // renombra la tabla en la 028, el test se rompe y avisa.
  const ruta = path.join(
    os.tmpdir(),
    'kair-readiness-tablas-' + process.pid + '-' + Date.now() + '.sqlite',
  );
  const bd = new Database(ruta);
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'db', 'schema', '028_solicitudes_titular.sql'),
      'utf8',
    );
    bd.exec(sql);

    const r = readiness.evaluar({
      gate: 'publicacion',
      db: bd,
      config: CONFIG_TEST,
      manifiesto: manifiestoCompleto(),
      textos: {
        acuerdoV11: ACUERDO_OK,
        anexoNube: NUBE_OK,
        anexoEncargo: ENCARGO_OK,
      },
    });
    const idsPendientes = r.pendientes.map((p) => p.id);
    assert.ok(
      !idsPendientes.includes('tabla_solicitudes'),
      `la tabla de solicitudes del Titular quedo pendiente: ${JSON.stringify(idsPendientes)}`,
    );
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (_) { /* el archivo ya no esta */ }
  }
});

test('readiness · con la huella puesta y sin archivo, la accion no manda a registrar la huella', () => {
  // La huella YA esta en el manifiesto. La accion que se le da al operador
  // tiene que decir lo que falta (el archivo aprobado), no mandarlo a
  // registrar una huella que ya esta registrada.
  const r = readiness.evaluar({
    gate: 'publicacion',
    db: null,
    config: CONFIG_TEST,
    manifiesto: manifiestoCompleto(),
    textos: { acuerdoV11: null, anexoNube: null, anexoEncargo: null },
  });
  const item = r.pendientes.find((p) => p.id === 'hash_v1_1');
  assert.ok(item, 'el item hash_v1_1 deberia quedar pendiente sin archivo');
  assert.doesNotMatch(item.accion, /registrarlo en legal-readiness/);
  assert.match(item.accion, /huella ya est/);
});

test('readiness · el Anexo de Encargo con la redaccion de sustitucion pasa', () => {
  // La decision del 24-oct-2026 fue (b) reemplazo: no hay un Anexo base firmado
  // al que anadirle un otrosi, asi que el Anexo nuevo lo sustituye. El check
  // tiene que aceptar las DOS redacciones: exigir una clausula que el
  // documento final no lleva es un requisito que no puede satisfacerse.
  const r = readiness.analizarAnexoEncargo([
    'Anexo de Nube.',
    'Sustituye en su totalidad el Anexo anterior.',
    'Artículo 2.2.4.6.13 del Decreto 1072 de 2015.',
    'Veinte (20) años.',
    'Servicio en nube: firma-service.',
  ].join('\n'));
  assert.equal(r.clausulasOk, true);
  assert.equal(r.faltan.length, 0);
});

test('readiness · el Anexo de Encargo del repo trae las cinco clausulas', () => {
  // El documento que se publica en kair.fyi/anexo-encargo.html. El punto 3 no
  // se cierra con una URL que apunte a un documento viejo: este es el del
  // servicio en la nube, con la remision al Anexo de Nube, la clausula de
  // sustitucion, el art. 2.2.4.6.13, los veinte anos y el servicio en nube.
  const html = fs.readFileSync(
    path.join(__dirname, '..', '..', 'legal', 'anexo-encargo.html'),
    'utf8',
  );
  const r = readiness.analizarAnexoEncargo(html);
  assert.deepEqual(
    r.faltan.map((f) => f.id),
    [],
    `faltan: ${JSON.stringify(r.faltan.map((f) => f.id))}`,
  );
  assert.equal(r.placeholders.huecos.total, 0);
});

test('readiness · la designacion del responsable NO exige un acta de designacion', () => {
  // Lo que la ley exige es DESIGNAR una persona o area (art. 2.2.2.25.4.4 del
  // Decreto 1074 de 2015, que reproduce el art. 23 del Decreto 1377 de 2013).
  // NO exige un acta: la SIC ha precisado que la Ley 1581 y sus normas
  // reglamentarias "no establecen un procedimiento especifico para la
  // designacion" (Resolucion 384 de 2026, Secretaria Juridica Distrital, que
  // cita a la SIC). Exigir el acta era un requisito que la ley no impone.
  const base = manifiestoCompleto();
  const r = readiness.evaluar({
    gate: 'publicacion',
    db: null,
    config: CONFIG_TEST,
    manifiesto: base,
    textos: { acuerdoV11: ACUERDO_OK, anexoNube: NUBE_OK, anexoEncargo: ENCARGO_OK },
  });
  const idsPendientes = r.pendientes.map((p) => p.id);
  assert.ok(
    !idsPendientes.includes('responsable_datos'),
    `el responsable quedo pendiente sin acta: ${JSON.stringify(idsPendientes)}`,
  );
  // Y sin la designacion, el item SI tiene que quedar pendiente.
  const sinResponsable = JSON.parse(JSON.stringify(base));
  sinResponsable.encargado.responsable_datos = null;
  const r2 = readiness.evaluar({
    gate: 'publicacion',
    db: null,
    config: CONFIG_TEST,
    manifiesto: sinResponsable,
    textos: { acuerdoV11: ACUERDO_OK, anexoNube: NUBE_OK, anexoEncargo: ENCARGO_OK },
  });
  const item = r2.pendientes.find((p) => p.id === 'responsable_datos');
  assert.ok(item, 'sin designacion el item responsable_datos debe quedar pendiente');
  assert.match(item.accion, /Designar la persona o el \u00e1rea/);
});

test('readiness · el manifiesto real ya no pide el acta de designacion', () => {
  // Si alguien vuelve a meter `acta_designacion` en el manifiesto, el check
  // tiene que seguir funcionando: el campo se puede ignorar, pero no puede
  // volver a ser un requisito. Este test ata el archivo real.
  const man = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'legal-readiness.json'),
    'utf8',
  ));
  assert.equal(
    Object.prototype.hasOwnProperty.call(man.encargado, 'acta_designacion'),
    false,
    'legal-readiness.json todavia declara acta_designacion',
  );
  assert.ok(man.encargado.responsable_datos, 'falta la designacion del responsable');
});

test('readiness · el manifiesto real declara el representante legal y el canal de PQRS', () => {
  // Datos reales declarados por el owner el 24-oct-2026. El check de
  // `partes_encargado` (NIT + representante + domicilio) y el de `canal_pqrs`
  // (canal + responsable) leen del manifiesto: si estos campos no estan, los
  // dos items quedan pendientes y bloquean la primera firma.
  const man = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'legal-readiness.json'),
    'utf8',
  ));
  assert.equal(man.encargado.representante_legal, 'Javier Robles Fontalvo');
  assert.match(man.encargado.responsable_datos, /Javier Robles Fontalvo/);
  assert.equal(man.pqrs.canal, 'adminkair@gmail.com');
  assert.equal(man.pqrs.responsable, 'Javier Robles Fontalvo');
  assert.equal(man.pqrs.plazo_dias, 2);
});

test('readiness · con el representante legal y el canal de PQRS, los dos items quedan ok', () => {
  const man = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'legal-readiness.json'),
    'utf8',
  ));
  const r = readiness.evaluar({
    gate: 'primera_firma',
    db: null,
    config: CONFIG_TEST,
    manifiesto: man,
    textos: { acuerdoV11: null, anexoNube: null, anexoEncargo: null },
  });
  const idsPendientes = r.pendientes.map((p) => p.id);
  assert.ok(
    !idsPendientes.includes('partes_encargado'),
    `partes_encargado quedo pendiente: ${JSON.stringify(idsPendientes)}`,
  );
  assert.ok(
    !idsPendientes.includes('canal_pqrs'),
    `canal_pqrs quedo pendiente: ${JSON.stringify(idsPendientes)}`,
  );
});

test('readiness · el canal de PQRS declarado es el que se publica', () => {
  // "Canal unico" solo es verificable si el canal esta publicado. El dato del
  // manifiesto tiene que aparecer en los documentos que publica el sitio: si
  // uno cambia y el otro no, hay dos canales y el unico es una fiction.
  const man = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'legal-readiness.json'),
    'utf8',
  ));
  const canal = man.pqrs.canal;
  assert.ok(canal, 'el manifiesto no declara pqrs.canal');
  for (const archivo of [
    path.join(__dirname, '..', '..', '..', 'sitio', 'soporte.html'),
    path.join(__dirname, '..', '..', '..', 'sitio', 'anexo-encargo.html'),
    path.join(__dirname, '..', '..', '..', 'sitio', 'politica-firma.html'),
  ]) {
    const html = fs.readFileSync(archivo, 'utf8');
    assert.ok(
      html.includes(canal),
      `el canal ${canal} no aparece en ${path.basename(archivo)}`,
    );
  }
});

test('readiness · el DPA de Cloudflare esta verificado en la fuente oficial', () => {
  // Cloudflare, Inc.: Data Processing Addendum v6.4, del 3 de abril de 2026.
  // El apartado 3.i obliga a devolver o eliminar los datos personales al
  // terminar el acuerdo o el servicio, y el 5.2 habilita la auditoria con un
  // informe de un auditor externo independiente de no mas de trece (13) meses.
  // Verificado en cloudflare.com/cloudflare-customer-dpa.
  const man = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'legal-readiness.json'),
    'utf8',
  ));
  const cf = man.subencargados.cloudflare;
  assert.equal(cf.dpa, true);
  assert.equal(cf.version, 'v6.4');
  assert.equal(cf.fecha, '2026-04-03');
  assert.equal(cf.devolucion_supresion, true);
  assert.equal(cf.auditoria, true);
  assert.match(cf.evidencia, /cloudflare\.com/);
});

test('readiness · con el DPA de Cloudflare verificado, el item queda ok', () => {
  const man = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'legal-readiness.json'),
    'utf8',
  ));
  const r = readiness.evaluar({
    gate: 'primera_firma',
    db: null,
    config: CONFIG_TEST,
    manifiesto: man,
    textos: { acuerdoV11: null, anexoNube: null, anexoEncargo: null },
  });
  const idsPendientes = r.pendientes.map((p) => p.id);
  assert.ok(
    !idsPendientes.includes('cloudflare_dpa'),
    `cloudflare_dpa quedo pendiente: ${JSON.stringify(idsPendientes)}`,
  );
});

test('readiness · la seguridad fisica del local ya no es un campo que nadie vigila', () => {
  // El campo existia en el manifiesto y NINGUN check lo leia: un dato
  // declarado que no bloquea nada. Ahora tiene su propio item.
  const man = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'legal-readiness.json'),
    'utf8',
  ));
  assert.ok(man.infraestructura.seguridad_fisica, 'falta la seguridad fisica');
  const r = readiness.evaluar({
    gate: 'primera_firma',
    db: null,
    config: CONFIG_TEST,
    manifiesto: man,
    textos: { acuerdoV11: null, anexoNube: null, anexoEncargo: null },
  });
  const idsPendientes = r.pendientes.map((p) => p.id);
  assert.ok(
    !idsPendientes.includes('seguridad_fisica'),
    `seguridad_fisica quedo pendiente: ${JSON.stringify(idsPendientes)}`,
  );
});

test('readiness · las URLs declaradas apuntan a documentos que estan en sitio/', () => {
  // Sellar una URL que no sirve el documento es peor que no sellarla: el
  // Acuerdo apuntaria a algo que no existe o a otra version del documento.
  const man = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'legal-readiness.json'),
    'utf8',
  ));
  const base = 'https://kair.fyi/';
  for (const [clave, archivo] of [
    ['url_politica', 'politica-firma.html'],
    ['url_anexo_encargo', 'anexo-encargo.html'],
  ]) {
    const url = man.encargado[clave];
    assert.ok(url, `${clave} esta en null`);
    assert.ok(url.startsWith(base), `${clave} no apunta a ${base}: ${url}`);
    const nombre = url.slice(base.length);
    assert.ok(
      fs.existsSync(path.join(__dirname, '..', '..', '..', 'sitio', nombre)),
      `el documento publicado ${nombre} no esta en sitio/`,
    );
  }
});

// 📦1047 · La cuenta de consumo se sustituyó por Google Workspace con el
// CDPA incorporado al Acuerdo (Decision A del 9-nov-2026). Los tests de este
// bloque son los del ESTADO VIGENTE; los del estado anterior (la cuenta de
// consumo, 📦956 y 📦957) se retiraron porque ese estado ya no existe en el
// servicio, y el item legado `google_dpa` queda en `no_aplica` para
// dejar constancia de la historia.

// El manifiesto con el proveedor de correo declarado de una manera
// concreta: la cuenta, el papel, el CDPA y la evidencia de la aceptacion por
// la cuenta son los cuatro datos que el item exige.
function manifiestoConMailProvider(cuenta, extra = {}) {
  const man = manifiestoCompleto();
  man.subencargados.mail_provider = Object.assign({
    proveedor: 'Google Ireland Limited',
    servicio: 'Google Workspace',
    cuenta,
    rol: 'subencargado',
    dpa: false,
    version: null,
    fecha: null,
    devolucion_supresion: false,
    auditoria: false,
    evidencia: null,
    aceptacion: { aceptada: false, evidencia: null },
  }, extra);
  return man;
}

// La aceptacion del CDPA COMPLETA, con el modo, la fecha y la evidencia que
// ese modo exige. Los tests que la usan quieren comprobar OTRA cosa (la
// cuenta, el papel, las clausulas): si la aceptacion esta incompleta, el
// item quedaria pendiente por la aceptacion y el test no mediria lo que dice
// medir.
function aceptacionCompleta(extra = {}) {
  return Object.assign({
    aceptada: true,
    modo: 'incorporado_por_referencia',
    fecha: '2026-11-10',
    evidencia: 'El CDPA esta incorporado al Acuerdo (evidencia de prueba).',
    cuenta: 'gesstiar.com (Google Workspace)',
    at_testacion: 'Atestacion escrita del owner (prueba).',
    acuerdo: {
      url: 'https://workspace.google.com/terms/premier_terms/?hl=en',
      hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      bytes: 467263,
      descargado: '2026-11-10',
    },
    cdpa: {
      url: 'https://admin.google.com/terms/apps/8/1/en/dpa_terms.html',
      hash: '0e1c729406410a15758ae1ceb6d93b6b4e200208b325abf17b09ef74f0dc69b1',
      bytes: 97831,
      descargado: '2026-11-10',
    },
  }, extra);
}

// Los textos se inyectan: el gate compara la suscripcion contra el TEXTO
// VIGENTE, y con los textos inyectados esa comparacion es determinista (la
// huella del texto inyectado es la que declara la fixture).
function reporteDe(man) {
  return readiness.evaluar({
    gate: 'primera_firma',
    db: null,
    config: CONFIG_TEST,
    manifiesto: man,
    textos: { acuerdoV11: ACUERDO_OK, anexoNube: NUBE_OK, anexoEncargo: ENCARGO_OK },
  });
}

function idsPendientesDe(man) {
  return reporteDe(man).pendientes.map((p) => p.id);
}

// =============================================================================
// 📦1047 · EL PROVEEDOR DE CORREO Y EL VÍNCULO CON EL CDPA
//
// La cuenta gratuita de consumo se sustituyó por una cuenta de Google
// Workspace con el Cloud Data Processing Addendum (CDPA) incorporado al
// Acuerdo (Decision A del 9-nov-2026). Con ese vínculo, Google interviene
// como SUBCONTRATADO de los datos del servicio de correo, y el item tiene que
// exigir lo que le corresponde: el vínculo, su vigencia, la evidencia de la
// aceptación por la cuenta y sus cláusulas.
//
// El item LEGADO `google_dpa` pasa a `no_aplica`: un item que ya no aplica
// no es un item cumplido, y marcarlo `ok` sería un verde falso.
// =============================================================================

test('readiness · con una cuenta Workspace y el CDPA completo, los items de subencargados quedan ok', () => {
  // La via normal: el proveedor de correo es un subencargado con vinculo
  // contractual, y le aplican las mismas clausulas que a Cloudflare.
  const ids = idsPendientesDe(manifiestoCompleto());
  for (const id of ['mail_provider_dpa', 'devolucion_supresion', 'auditoria']) {
    assert.ok(!ids.includes(id), `${id} quedo pendiente: ${JSON.stringify(ids)}`);
  }
});

test('readiness · el item legado google_dpa queda en no_aplica, NO en ok', () => {
  // El item del estado anterior (la cuenta de consumo) se conserva como
  // marca de la historia, en estado `no_aplica`. NO se marca ok: un item
  // que ya no aplica no es un item cumplido. Y NO queda pendiente: eso seria
  // un bloqueo permanente sin salida.
  const r = reporteDe(manifiestoCompleto());
  const item = r.grupos
    .flatMap((g) => g.items)
    .find((i) => i.id === 'google_dpa');
  assert.ok(item, 'el item legado google_dpa tiene que seguir existiendo');
  assert.equal(item.estado, 'no_aplica',
    `el item legado quedo en ${item.estado}`);
  assert.ok(/mail_provider_dpa/.test(item.detalle),
    `el detalle tiene que apuntar al item que lo sustituye: ${item.detalle}`);
  assert.ok(!r.pendientes.some((p) => p.id === 'google_dpa'),
    'el item legado no puede quedar pendiente');
});

test('readiness · una cuenta de consumidor no habilita el servicio: el item del proveedor de correo sigue pendiente', () => {
  // Una cuenta de consumo no tiene CDPA: Google no es subencargado y el
  // Acuerdo (10.1 y 10.5(f)) prohibe transmitir datos personales a un
  // proveedor no vinculado. El item NO puede quedar ok, y tiene que decir
  // el motivo y la salida.
  const r = reporteDe(manifiestoConMailProvider('consumidor', {
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: true,
    auditoria: true,
    evidencia: 'cdpa.html',
    aceptacion: aceptacionCompleta(),
  }));
  const ids = r.pendientes.map((p) => p.id);
  assert.ok(
    ids.includes('mail_provider_dpa'),
    `mail_provider_dpa quedo ok con una cuenta de consumidor: ${JSON.stringify(ids)}`,
  );
  const item = r.pendientes.find((p) => p.id === 'mail_provider_dpa');
  assert.ok(/workspace|cloud|empresarial|transaccional/.test(item.detalle),
    `el detalle no dice que tipo de cuenta se espera: ${item.detalle}`);
  assert.ok(/Workspace/.test(item.accion),
    `la accion no dice la salida: ${item.accion}`);
});

test('readiness · sin la evidencia de aceptacion del CDPA por la cuenta, el item sigue pendiente', () => {
  // El CDPA se incorpora al Acuerdo por referencia, o el administrador lo
  // acepta en la consola. Sin ese dato, el vinculo no esta verificado: el
  // item no puede quedar ok aunque el resto de las clausulas esten.
  const ids = idsPendientesDe(manifiestoConMailProvider('workspace', {
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: true,
    auditoria: true,
    evidencia: 'cdpa.html',
    aceptacion: { aceptada: false, evidencia: null },
  }));
  assert.ok(ids.includes('mail_provider_dpa'),
    `mail_provider_dpa quedo ok sin la aceptacion: ${JSON.stringify(ids)}`);
});

// 📦1047 · P1 La aceptacion no se declara con un `true` y una frase: se
// declara con el MODO, la FECHA y la evidencia de ESE modo. Un item que
// acepta `aceptada: true` sin mas es un verde falso por la via del papel: el
// manifiesto podria decir que el CDPA esta aceptado sin que nadie diga COMO
// se acepto ni que evidencia lo sostiene.
test('readiness · una aceptacion sin modo no habilita el item', () => {
  const ids = idsPendientesDe(manifiestoConMailProvider('workspace', {
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: true,
    auditoria: true,
    evidencia: 'cdpa.html',
    aceptacion: { aceptada: true, evidencia: 'admin-console.html' },
  }));
  assert.ok(ids.includes('mail_provider_dpa'),
    `mail_provider_dpa quedo ok con una aceptacion sin modo: ${JSON.stringify(ids)}`);
});

test('readiness · una aceptacion sin fecha no habilita el item', () => {
  const ids = idsPendientesDe(manifiestoConMailProvider('workspace', {
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: true,
    auditoria: true,
    evidencia: 'cdpa.html',
    aceptacion: {
      aceptada: true,
      modo: 'incorporado_por_referencia',
      evidencia: 'admin-console.html',
    },
  }));
  assert.ok(ids.includes('mail_provider_dpa'),
    `mail_provider_dpa quedo ok con una aceptacion sin fecha: ${JSON.stringify(ids)}`);
});

test('readiness · la incorporacion por referencia exige las huellas de los dos textos', () => {
  // Sin la huella del Acuerdo y del CDPA, la evidencia no dice QUE texto se
  // esta aplicando: el item no puede quedar ok.
  const ids = idsPendientesDe(manifiestoConMailProvider('workspace', {
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: true,
    auditoria: true,
    evidencia: 'cdpa.html',
    aceptacion: {
      aceptada: true,
      modo: 'incorporado_por_referencia',
      fecha: '2026-11-10',
      evidencia: 'admin-console.html',
      cuenta: 'gesstiar.com',
      at_testacion: 'Atestacion del owner.',
      acuerdo: { url: 'https://workspace.google.com/terms/premier_terms/?hl=en' },
    },
  }));
  assert.ok(ids.includes('mail_provider_dpa'),
    `mail_provider_dpa quedo ok sin las huellas de los textos: ${JSON.stringify(ids)}`);
});

test('readiness · la aceptacion en la consola exige la captura del acto', () => {
  const ids = idsPendientesDe(manifiestoConMailProvider('workspace', {
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: true,
    auditoria: true,
    evidencia: 'cdpa.html',
    aceptacion: {
      aceptada: true,
      modo: 'aceptado_por_administrador',
      fecha: '2026-11-10',
      evidencia: 'admin-console.html',
    },
  }));
  assert.ok(ids.includes('mail_provider_dpa'),
    `mail_provider_dpa quedo ok sin la captura: ${JSON.stringify(ids)}`);
});

test('readiness · una aceptacion completa por consola (con captura) habilita el item', () => {
  const ids = idsPendientesDe(manifiestoConMailProvider('workspace', {
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: true,
    auditoria: true,
    evidencia: 'cdpa.html',
    aceptacion: {
      aceptada: true,
      modo: 'aceptado_por_administrador',
      fecha: '2026-11-10',
      evidencia: 'El administrador acepto el CDPA en la consola.',
      captura: {
        archivo: 'captura-consola.png',
        hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        bytes: 1234,
      },
    },
  }));
  assert.ok(!ids.includes('mail_provider_dpa'),
    `mail_provider_dpa quedo pendiente con la aceptacion completa: ${JSON.stringify(ids)}`);
});

test('readiness · el papel del proveedor tiene que quedar declarado como subencargado', () => {
  // El rol no se deduce: se declara. Un proveedor con CDPA que no dice que
  // papelplaying no habilita el servicio.
  const ids = idsPendientesDe(manifiestoConMailProvider('workspace', {
    rol: 'responsable',
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: true,
    auditoria: true,
    evidencia: 'cdpa.html',
    aceptacion: aceptacionCompleta(),
  }));
  assert.ok(ids.includes('mail_provider_dpa'),
    `mail_provider_dpa quedo ok con un rol que no es subencargado: ${JSON.stringify(ids)}`);
});

test('readiness · sin declarar el tipo de cuenta, los tres items siguen pendientes', () => {
  // Declarar el tipo de cuenta es lo que abre la salida: sin declararlo no
  // se puede asumir nada del vinculo.
  const ids = idsPendientesDe(manifiestoConMailProvider(null));
  for (const id of ['mail_provider_dpa', 'devolucion_supresion', 'auditoria']) {
    assert.ok(ids.includes(id), `${id} quedo ok sin declarar la cuenta: ${JSON.stringify(ids)}`);
  }
});

test('readiness · la devolucion y la auditoria exigen los DOS subencargados', () => {
  // Ya no hay una rama de "el de consumo es aceptable": en el servicio no hay
  // una cuenta de consumo. Los dos subencargados existen y los dos tienen que
  // cumplir sus propias clausulas.
  const ids = idsPendientesDe(manifiestoConMailProvider('workspace', {
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: false,
    auditoria: false,
    evidencia: 'cdpa.html',
    aceptacion: aceptacionCompleta(),
  }));
  for (const id of ['devolucion_supresion', 'auditoria']) {
    assert.ok(ids.includes(id), `${id} quedo ok sin la clausula del proveedor: ${JSON.stringify(ids)}`);
  }
});

test('readiness · una clausula que falta en Cloudflare no la tapa el proveedor de correo', () => {
  // La segunda salida es para el proveedor de correo, no para todos: si
  // Cloudflare no trae la clausula, el item sigue pendiente.
  const man = manifiestoConMailProvider('workspace', {
    dpa: true,
    version: 'CDPA',
    fecha: '2026-10-30',
    devolucion_supresion: true,
    auditoria: true,
    evidencia: 'cdpa.html',
    aceptacion: aceptacionCompleta(),
  });
  man.subencargados.cloudflare.devolucion_supresion = false;
  man.subencargados.cloudflare.auditoria = false;
  const ids = idsPendientesDe(man);
  assert.ok(ids.includes('devolucion_supresion'), `devolucion_supresion no quedo pendiente: ${JSON.stringify(ids)}`);
  assert.ok(ids.includes('auditoria'), `auditoria no quedo pendiente: ${JSON.stringify(ids)}`);
});

// ── El hallazgo 3.3 del plan del 9-nov-2026: el gate no comparaba la
//    suscripcion con el texto vigente ──────────────────────────────────────────

test('readiness · una suscripcion del Anexo de Nube de otra version NO puede quedar ok', () => {
  // El hallazgo 3.3: `firmado_nube` exigia firmado, fecha, version, hash y
  // evidencia, pero NO comparaba la suscripcion con el TEXTO VIGENTE. Con la
  // v1.2 publicada, el gate seguiria diciendo "Anexo de Nube firmado"
  // citando la suscripcion de la v1.1. Este test ata el arreglo.
  const man = manifiestoCompleto();
  man.anexo_nube.version = '1.1';
  man.anexo_nube.hash = readiness._internos._hash('otra-version');
  const ids = idsPendientesDe(man);
  assert.ok(ids.includes('firmado_nube'),
    `firmado_nube quedo ok con una suscripcion de otra version: ${JSON.stringify(ids)}`);
});

test('readiness · una suscripcion con la huella de otro texto NO puede quedar ok', () => {
  // La misma comprobacion por el otro lado: la huella es la que dice QUE
  // texto se firmo. La version sola no alcanza.
  const man = manifiestoCompleto();
  man.anexo_nube.hash = readiness._internos._hash('otro-texto');
  const ids = idsPendientesDe(man);
  assert.ok(ids.includes('firmado_nube'),
    `firmado_nube quedo ok con la huella de otro texto: ${JSON.stringify(ids)}`);
});

test('readiness · el detalle de firmado_nube dice el motivo real', () => {
  // "Falta el Anexo firmado" es verdad a medias cuando lo que falta es la
  // RE-suscripcion del texto vigente: son dos cosas distintas.
  const man = manifiestoCompleto();
  man.anexo_nube.version = '1.1';
  const r = reporteDe(man);
  const item = r.pendientes.find((p) => p.id === 'firmado_nube');
  assert.ok(item, 'firmado_nube no quedo pendiente');
  assert.ok(new RegExp('v' + VERSION_MODELO_NUBE).test(item.detalle),
    `el detalle no nombra el texto vigente: ${item.detalle}`);
  assert.ok(/v1\.1/.test(item.detalle),
    `el detalle no dice que la suscripcion es de otra version: ${item.detalle}`);
});

test('readiness · la accion del documento nombra la version vigente, no una version escrita a mano', () => {
  // La accion de `documento_nube` decia, con la version ESCRITA A MANO,
  // "la v1.1, susceptible de suscripcion". Con la v1.2 publicada, eso manda a
  // buscar un texto que ya no esta vigente. La version sale del modulo que
  // suscribe, no de una constante.
  const r = reporteDe(manifiestoCompleto());
  const item = r.grupos.flatMap((g) => g.items).find((i) => i.id === 'documento_nube');
  assert.ok(item, 'documento_nube tiene que existir');
  assert.ok(item.accion.includes('v' + VERSION_MODELO_NUBE),
    `la accion no nombra la version vigente: ${item.accion}`);
  assert.ok(!/la v1\.1/.test(item.accion),
    `la accion sigue nombrando una version superada: ${item.accion}`);
});

// ── 📦1047 · punto 3: el Anexo de Nube es BILATERAL. El gate no puede
//    declarar el instrumento firmado con un solo acto ─────────────────────────

test('readiness · el Anexo de Nube sin contrafirma NO queda ok en el gate', () => {
  // El texto vigente (parrafo 10) exige DOS actos: la suscripcion de la
  // Empresa y la contrafirma de K+AIR. Con solo el primero, el item
  // `contrafirma_nube` queda pendiente y el gate de primera firma NO pasa.
  const man = manifiestoCompleto();
  man.anexo_nube.contrafirmado = false;
  man.anexo_nube.contrafirma_fecha = null;
  man.anexo_nube.contrafirma_actor = null;
  man.anexo_nube.contrafirma_evidencia = null;
  const ids = idsPendientesDe(man);
  assert.ok(ids.includes('contrafirma_nube'),
    `contrafirma_nube quedo ok sin el segundo acto: ${JSON.stringify(ids)}`);
  assert.ok(!ids.includes('firmado_nube'),
    `el primer acto esta: ${JSON.stringify(ids)}`);
});

test('readiness · con los dos actos, el Anexo de Nube queda ok', () => {
  const ids = idsPendientesDe(manifiestoCompleto());
  assert.ok(!ids.includes('contrafirma_nube'),
    `contrafirma_nube quedo pendiente: ${JSON.stringify(ids)}`);
  assert.ok(!ids.includes('firmado_nube'),
    `firmado_nube quedo pendiente: ${JSON.stringify(ids)}`);
});

test('readiness · una contrafirma sin fecha, sin actor o sin evidencia NO puede quedar ok', () => {
  for (const campo of ['contrafirma_fecha', 'contrafirma_actor', 'contrafirma_evidencia']) {
    const man = manifiestoCompleto();
    man.anexo_nube[campo] = null;
    const ids = idsPendientesDe(man);
    assert.ok(ids.includes('contrafirma_nube'),
      `contrafirma_nube quedo ok sin ${campo}: ${JSON.stringify(ids)}`);
  }
});

test('readiness · una contrafirma SIN la facultad acreditada NO puede quedar ok', () => {
  // 📦1047 · punto 3 · P7 La condicion del abogado: "La ejecucion por una
  // persona distinta del representante legal de Gesstiar S.A.S. requerira
  // acreditar previamente la facultad de representacion o poder suficiente,
  // que debera conservarse en el expediente". Un segundo acto que no dice con
  // que poder se firmo no describe el instrumento entero.
  for (const valor of [null, undefined, {}, { resultado: 'ALGO' }]) {
    const man = manifiestoCompleto();
    man.anexo_nube.contrafirma_facultad = valor;
    const ids = idsPendientesDe(man);
    assert.ok(ids.includes('contrafirma_nube'),
      `contrafirma_nube quedo ok sin la facultad (${JSON.stringify(valor)}): ${JSON.stringify(ids)}`);
  }
});

test('readiness · un poder acreditado sin referencia ni huella NO puede quedar ok', () => {
  const man = manifiestoCompleto();
  man.anexo_nube.contrafirma_facultad = {
    resultado: 'PODER_ACREDITADO',
    nombre: 'PERSONA DE PRUEBA',
    tipo: 'PODER',
    instrumento_ref: null,
    instrumento_sha256: null,
  };
  const ids = idsPendientesDe(man);
  assert.ok(ids.includes('contrafirma_nube'),
    `un poder sin documento no es una acreditacion: ${JSON.stringify(ids)}`);
});

test('readiness · el Anexo de Encargo SIN la facultad acreditada NO puede quedar ok', () => {
  // 📦1047 · punto 3 · P7 El mismo control que en el Anexo de Nube: la
  // contrafirma del Anexo de Encargo es tambien un acto de K+AIR por Gesstiar.
  const man = manifiestoCompleto();
  man.anexo_encargo.contrafirma_facultad = null;
  const ids = idsPendientesDe(man);
  assert.ok(ids.includes('estado_encargo'),
    `estado_encargo quedo ok sin la facultad: ${JSON.stringify(ids)}`);
});

test('readiness · el detalle de contrafirma_nube dice QUE acto falta', () => {
  // Decir "falta el Anexo firmado" cuando lo que falta es la contrafirma
  // manda a la Empresa a hacer un acto que ya hizo.
  const man = manifiestoCompleto();
  man.anexo_nube.contrafirmado = false;
  man.anexo_nube.contrafirma_fecha = null;
  man.anexo_nube.contrafirma_actor = null;
  man.anexo_nube.contrafirma_evidencia = null;
  const r = reporteDe(man);
  const item = r.pendientes.find((p) => p.id === 'contrafirma_nube');
  assert.ok(item, 'contrafirma_nube no quedo pendiente');
  assert.ok(/contrafirma de K\+AIR/.test(item.detalle),
    `el detalle no nombra el segundo acto: ${item.detalle}`);
  assert.ok(!/no está suscrito todavía/.test(item.detalle),
    `el detalle atribuye a la Empresa un acto que ya hizo: ${item.detalle}`);
});

test('readiness · el detalle de contrafirma_nube cuando faltan los DOS actos', () => {
  const man = manifiestoCompleto();
  man.anexo_nube.firmado = false;
  man.anexo_nube.fecha = null;
  man.anexo_nube.version = null;
  man.anexo_nube.hash = null;
  man.anexo_nube.evidencia = null;
  man.anexo_nube.contrafirmado = false;
  man.anexo_nube.contrafirma_fecha = null;
  man.anexo_nube.contrafirma_actor = null;
  man.anexo_nube.contrafirma_evidencia = null;
  const r = reporteDe(man);
  const item = r.pendientes.find((p) => p.id === 'contrafirma_nube');
  assert.ok(item, 'contrafirma_nube no quedo pendiente');
  assert.ok(/los dos actos/.test(item.detalle),
    `el detalle no dice que faltan los dos: ${item.detalle}`);
});

test('readiness · la firma del Anexo de Encargo tambien se contrasta con el texto vigente', () => {
  // El mismo falso positivo del hallazgo 3.3, aplicado al otro instrumento:
  // el manifiesto decia "firmado" sobre un texto que el servidor ya no
  // tenia. El gate tiene que notar la diferencia.
  const man = manifiestoCompleto();
  man.anexo_encargo.hash = readiness._internos._hash('otro-texto');
  const ids = idsPendientesDe(man);
  assert.ok(ids.includes('estado_encargo'),
    `estado_encargo quedo ok con la huella de otro texto: ${JSON.stringify(ids)}`);
});

// =============================================================================
// 📦1049 · LA VERSIÓN EN VIGOR TIENE QUE SER LA QUE DECLARA EL MANIFIESTO
// =============================================================================
// El caso real (11-nov-2026, producción): la v1.5 estaba activa en la base y
// con su autorización operativa, el manifiesto declaraba la v1.6, y el item
// `publicado` daba `ok`. Solo miraba que la versión activa fuera ">= v1.1",
// sin compararla con la que declara el manifiesto: con un texto viejo en
// vigor, la compuerta de publicación quedaba con 0 bloqueantes.
//
// Estos tests aplican el SQL REAL de la 001 (no una copia a mano): si alguien
// renombra la tabla o sus columnas, el test se rompe y avisa.

function bdConAcuerdo(ruta, versiones) {
  const bd = new Database(ruta);
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'db', 'schema', '001_initial.sql'),
    'utf8',
  );
  bd.exec(sql);
  const ins = bd.prepare(
    'INSERT INTO gh_firma_acuerdo_versiones '
    + '(version, texto, texto_hash, fecha_vigencia_inicio, activa, fecha_creacion) '
    + 'VALUES (?, ?, ?, ?, ?, ?)',
  );
  for (const v of versiones) {
    ins.run(
      v.version,
      'TEXTO DE PRUEBA',
      v.hash,
      '2026-11-05T00:00:00.000Z',
      v.activa ? 1 : 0,
      '2026-11-05T00:00:00.000Z',
    );
  }
  return bd;
}

function reporteConBd(bd, man) {
  return readiness.evaluar({
    gate: 'publicacion',
    db: bd,
    config: CONFIG_TEST,
    manifiesto: man,
    textos: { acuerdoV11: ACUERDO_OK, anexoNube: NUBE_OK, anexoEncargo: ENCARGO_OK },
  });
}

function rutaTemporal(nombre) {
  return path.join(os.tmpdir(), nombre + '-' + process.pid + '-' + Date.now() + '.sqlite');
}

test('readiness · con una versión activa distinta de la que declara el manifiesto, `publicado` queda pendiente', () => {
  // El caso de producción: en vigor la v1.5, en el manifiesto la v1.1 (aquí
  // el texto del test). La compuerta tiene que NOTAR la diferencia.
  const man = manifiestoCompleto();
  const ruta = rutaTemporal('kair-readiness-publicado-distinta');
  const bd = bdConAcuerdo(ruta, [{ version: 'v1.5', hash: 'f'.repeat(64), activa: true }]);
  try {
    const r = reporteConBd(bd, man);
    const item = r.pendientes.find((p) => p.id === 'publicado');
    assert.ok(item, 'publicado no quedo pendiente con la v1.5 activa y otra declarada');
    assert.ok(
      /v1\.5/.test(item.detalle),
      `el detalle no dice que la version en vigor es otra: ${item.detalle}`,
    );
  } finally {
    bd.close();
  }
});

test('readiness · con la versión activa igual a la del manifiesto y su huella, `publicado` queda ok', () => {
  const man = manifiestoCompleto();
  const hash = readiness._internos._hash(ACUERDO_OK);
  const ruta = rutaTemporal('kair-readiness-publicado-igual');
  const bd = bdConAcuerdo(ruta, [{ version: 'v1.1', hash: hash, activa: true }]);
  try {
    const r = reporteConBd(bd, man);
    const item = r.pendientes.find((p) => p.id === 'publicado');
    assert.equal(item, undefined, `publicado quedo pendiente con la version del manifiesto activa: ${JSON.stringify(item)}`);
  } finally {
    bd.close();
  }
});

test('readiness · la misma versión con OTRA huella no está publicada (el texto cambió sin cambiar de versión)', () => {
  // El número de versión igual no basta: si el texto que se registra en la
  // base no es el que declara el manifiesto, lo que está en vigor es otro.
  const man = manifiestoCompleto();
  const ruta = rutaTemporal('kair-readiness-publicado-huella');
  const bd = bdConAcuerdo(ruta, [{ version: 'v1.1', hash: 'a'.repeat(64), activa: true }]);
  try {
    const r = reporteConBd(bd, man);
    const item = r.pendientes.find((p) => p.id === 'publicado');
    assert.ok(item, 'publicado quedo ok con la misma version y otra huella');
  } finally {
    bd.close();
  }
});

