/**
 * Readiness · el Anexo de Encargo de las empresas activas.
 *
 * POR QUE EXISTE ESTE ARCHIVO
 * ---------------------------
 * El reporte de readiness tenia un falso positivo: contaba cualquier fecha no
 * nula en `gh_firma_empresas.anexo_encargo_firmado_at` como "Anexo firmado",
 * aunque no existiera el PDF ni la evidencia en `legal-readiness.json`. El
 * caso real: una empresa con una fecha puesta a mano y el manifiesto en
 * "desconocido" salia OK en `empresas_base`.
 *
 * La regla que se fija aca: una FECHA no es EVIDENCIA. El item solo puede salir
 * OK cuando la ficha tiene la fecha Y el manifiesto tiene el estado `firmado`,
 * la fecha y el archivo de evidencia. Si hay fecha sin evidencia, el item queda
 * en `aviso` (que tambien bloquea el gate de primera firma).
 *
 * Los datos son sinteticos.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/connection');
const crypto = require('crypto');
const empresaService = require('../src/services/empresa');
const readiness = require('../src/services/readinessLegal');
const { resetDb } = require('./helpers');

const EMPRESA = '900123456';

const CONFIG_TEST = {
  env: 'test',
  canalProteccionDatos: 'privacidad@example.com',
  canalIncidentes: 'seguridad@example.com',
  plazoTramiteDias: 2,
  exigirMedioPersonalOtp: false,
  exigirAnexoNube: false,
};

const TEXTOS = {
  acuerdoV11: 'Versión del Acuerdo: v1.1',
  anexoNube: 'Anexo de Nube.',
  anexoEncargo: 'Anexo de Nube. Cláusula de otrosí.',
};

/**
 * La huella del texto del Anexo de Encargo que se inyecta.
 *
 * La compuerta contrasta la huella que declara el manifiesto con la del TEXTO
 * vigente: una firma sobre una huella que no es la del texto que se leyo son
 * dos textos y una sola firma (PROMPT.md, trampa 137). El manifiesto que
 * inyecta este test tiene que declarar la huella de lo que se leyo.
 */
const HASH_ENCARGO_INYECTADO = crypto.createHash('sha256')
  .update(TEXTOS.anexoEncargo, 'utf8')
  .digest('hex');

// La FACULTAD acreditada de quien contrafirma por Gesstiar (P7, 10-nov-2026).
// El gate la exige: un Anexo de Encargo firmado sin ese dato no describe el
// instrumento entero.
const FACULTAD_OK = {
  resultado: 'REPRESENTANTE_LEGAL_ENCARGADO',
  nombre: 'Javier Robles Fontalvo',
  cargo: 'Representante Legal',
  tipo: 'REPRESENTACION',
  instrumento_ref: 'Representante legal declarado en el manifiesto legal',
  instrumento_sha256: null,
  id_poder: null,
  verificado_at: '2026-10-21',
};

function manifiesto(anexo) {
  const original = anexo || { estado: 'no_firmado', fecha: null, evidencia: null };
  // El hash acompaña al estado 'firmado': sin el, la firma no se puede
  // contrastar contra el texto y el item no puede salir OK.
  //
  // 📦1047 · punto 3 · P7 La firma del Anexo de Encargo exige además la
  // acreditación de la FACULTAD de quien contrafirma por Gesstiar: sin ella,
  // el item `estado_encargo` —y con él `empresas_base`— no puede salir OK.
  const bloque = original.estado === 'firmado'
    ? Object.assign(
      {},
      original,
      original.hash ? {} : { hash: HASH_ENCARGO_INYECTADO },
      original.contrafirma_facultad ? {} : { contrafirma_facultad: FACULTAD_OK },
    )
    : original;
  return {
    version: 'test',
    anexo_encargo: bloque,
  };
}

function crearEmpresa({ conAnexo = true } = {}) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  empresaService.create({
    id_empresa: EMPRESA,
    razon_social: 'Empresa de Prueba S.A.S.',
    nit: EMPRESA,
    canal_pqrs: 'pqrs@example.com',
  });
  if (conAnexo) {
    empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-21');
  }
}

function evaluar(manifiestoInyectado) {
  return readiness.evaluar({
    gate: 'primera_firma',
    db,
    config: CONFIG_TEST,
    manifiesto: manifiestoInyectado,
    textos: TEXTOS,
  });
}

// El reporte expone los items agrupados (`grupos[].items`); no hay un arreglo
// plano en la raiz. El helper recorre los grupos para no atarse a la forma
// interna de cada uno.
function item(reporte, id) {
  const todos = (reporte.grupos || []).flatMap((g) => g.items);
  return todos.find((i) => i.id === id);
}

test('readiness · una fecha de Anexo sin evidencia en el manifiesto NO es OK', () => {
  resetDb();
  crearEmpresa({ conAnexo: true });

  const r = evaluar(manifiesto());
  const i = item(r, 'empresas_base');

  assert.equal(i.estado, readiness.ESTADOS.AVISO);
  assert.match(i.detalle, /manifiesto no tiene la evidencia/i);
  assert.equal(r.listo, false, 'un aviso en un item bloqueante no deja pasar la primera firma');
});

test('readiness · con evidencia en el manifiesto y fecha en la ficha, empresas_base es OK', () => {
  resetDb();
  crearEmpresa({ conAnexo: true });

  const r = evaluar(manifiesto({
    estado: 'firmado',
    fecha: '2026-10-21',
    evidencia: 'anexo-encargo-firmado.pdf',
  }));
  const i = item(r, 'empresas_base');

  assert.equal(i.estado, readiness.ESTADOS.OK);
  assert.match(i.detalle, /evidencia esta en el manifiesto/i);
});

test('readiness · sin fecha en la ficha el item queda pendiente aunque el manifiesto este completo', () => {
  resetDb();
  crearEmpresa({ conAnexo: false });

  const r = evaluar(manifiesto({
    estado: 'firmado',
    fecha: '2026-10-21',
    evidencia: 'anexo-encargo-firmado.pdf',
  }));
  const i = item(r, 'empresas_base');

  assert.equal(i.estado, readiness.ESTADOS.PENDIENTE);
  assert.match(i.detalle, /sin fecha de Anexo/i);
});

test('readiness · una fecha anterior al alta se avisa pero no se bloquea si hay evidencia', () => {
  resetDb();
  crearEmpresa({ conAnexo: true });

  // La empresa se acaba de crear (2026-10-24) y la fecha del papel es del
  // 21-oct: es legitimo (el contrato se firma antes de cargar la ficha), pero
  // el reporte tiene que senalarlo para que se confronte con el PDF.
  const r = evaluar(manifiesto({
    estado: 'firmado',
    fecha: '2026-10-21',
    evidencia: 'anexo-encargo-firmado.pdf',
  }));
  const i = item(r, 'empresas_base');

  assert.equal(i.estado, readiness.ESTADOS.OK);
  assert.match(i.detalle, /anterior\(es\) al alta/i);
  assert.equal(r.db.empresas.fechas_antes_del_alta, 1);
});
