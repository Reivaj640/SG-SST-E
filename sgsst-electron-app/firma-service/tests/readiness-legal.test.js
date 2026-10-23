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

const CONFIG_TEST = {
  env: 'test',
  canalProteccionDatos: 'privacidad@example.com',
  canalIncidentes: 'seguridad@example.com',
  plazoTramiteDias: 2,
  exigirMedioPersonalOtp: false,
  exigirAnexoNube: false,
};

const NUBE_OK = [
  'NO FIRMAR HASTA COMPLETAR LOS DATOS',
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

const ACUERDO_OK = [
  'Versión del Acuerdo: v1.1',
  'Veinte (20) años.',
  'Hold sin término del contrato electrónico.',
  'Dos (2) días hábiles.',
  'Artículo 2.2.4.6.13 del Decreto 1072 de 2015.',
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
      acta_designacion: 'acta-001.pdf',
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
      google: {
        cuenta: 'workspace',
        dpa: true,
        version: '2026-01',
        fecha: '2026-10-23',
        devolucion_supresion: true,
        auditoria: true,
        evidencia: 'dpa-google.pdf',
      },
    },
    anexo_encargo: {
      estado: 'firmado',
      fecha: '2026-10-21',
      evidencia: 'anexo-encargo-firmado.pdf',
    },
    anexo_nube: {
      firmado: true,
      fecha: '2026-10-23',
      version: '1.0',
      hash: readiness._internos._hash('anexo-nube-firmado'),
      evidencia: 'anexo-nube-firmado.pdf',
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
